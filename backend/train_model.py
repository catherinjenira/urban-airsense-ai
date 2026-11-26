from datetime import datetime, timezone
import gzip
import json
from pathlib import Path
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.metrics import accuracy_score, mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import KFold, cross_val_score, train_test_split
from sklearn.pipeline import Pipeline

from backend.db import get_connection
from backend.init_db import ingest_dataset

MODELS_DIR = Path(__file__).resolve().parent / "models"
BUNDLE_PATH = MODELS_DIR / "rf_air_quality_bundle.joblib"
TREES_PATH = MODELS_DIR / "rf_inference_trees.json.gz"
METADATA_PATH = MODELS_DIR / "model_metadata.json"

AQI_FEATURES = [
    "pm25",
    "pm10",
    "no2",
    "so2",
    "co",
    "ozone",
    "nh3",
    "latitude",
    "longitude",
]

PM25_FEATURES = [
    "pm10",
    "no2",
    "so2",
    "co",
    "ozone",
    "nh3",
    "latitude",
    "longitude",
]

FEATURE_LABELS = {
    "pm25": "PM2.5",
    "pm10": "PM10",
    "no2": "NO2",
    "so2": "SO2",
    "co": "CO",
    "ozone": "Ozone (O3)",
    "nh3": "NH3",
    "latitude": "Latitude",
    "longitude": "Longitude",
}


def load_station_dataframe() -> pd.DataFrame:
    """Load station profiles from SQL, initializing from CSV if empty."""
    ingest_dataset(force=False)
    with get_connection(include_db=True) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT state, city, station, latitude, longitude,
                       pm25, pm10, no2, so2, co, ozone, nh3,
                       actual_aqi, aqi_category
                FROM station_profiles
                """
            )
            rows = cur.fetchall()
    return pd.DataFrame(rows)


def _build_rf_regressor() -> Pipeline:
    """Create a scikit-learn median-imputing Random Forest regressor pipeline."""
    return Pipeline(
        [
            ("imputer", SimpleImputer(strategy="median")),
            (
                "rf",
                RandomForestRegressor(
                    n_estimators=250,
                    max_depth=16,
                    min_samples_leaf=2,
                    random_state=42,
                    n_jobs=-1,
                ),
            ),
        ]
    )


def _build_aqi_classifier() -> Pipeline:
    """Create a scikit-learn balanced Random Forest classifier pipeline."""
    return Pipeline(
        [
            ("imputer", SimpleImputer(strategy="median")),
            (
                "rf",
                RandomForestClassifier(
                    n_estimators=250,
                    max_depth=16,
                    min_samples_leaf=2,
                    class_weight="balanced",
                    random_state=42,
                    n_jobs=-1,
                ),
            ),
        ]
    )


def _serialize_regressor_pipeline(pipe: Pipeline, features: list[str]) -> dict:
    medians = [round(float(v), 6) for v in pipe.named_steps["imputer"].statistics_]
    trees = []
    for est in pipe.named_steps["rf"].estimators_:
        t = est.tree_
        trees.append(
            {
                "l": [int(x) for x in t.children_left],
                "r": [int(x) for x in t.children_right],
                "f": [int(x) for x in t.feature],
                "t": [round(float(x), 6) for x in t.threshold],
                "v": [round(float(x[0][0]), 6) for x in t.value],
            }
        )
    return {
        "features": features,
        "medians": medians,
        "trees": trees,
    }


def _serialize_classifier_pipeline(pipe: Pipeline, features: list[str]) -> dict:
    medians = [round(float(v), 6) for v in pipe.named_steps["imputer"].statistics_]
    classes = [str(c) for c in pipe.named_steps["rf"].classes_]
    trees = []
    for est in pipe.named_steps["rf"].estimators_:
        t = est.tree_
        values = []
        for row in t.value:
            counts = row[0]
            total = float(counts.sum()) or 1.0
            values.append([round(float(c / total), 6) for c in counts])
        trees.append(
            {
                "l": [int(x) for x in t.children_left],
                "r": [int(x) for x in t.children_right],
                "f": [int(x) for x in t.feature],
                "t": [round(float(x), 6) for x in t.threshold],
                "v": values,
            }
        )
    return {
        "features": features,
        "medians": medians,
        "classes": classes,
        "trees": trees,
    }


def train_and_save_models() -> dict:
    """Train Random Forest models on station data and persist artifacts."""
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    df = load_station_dataframe()

    labeled = df.dropna(subset=["actual_aqi", "aqi_category"]).copy()
    X = labeled[AQI_FEATURES]
    y_reg = labeled["actual_aqi"].astype(float)
    y_cls = labeled["aqi_category"].astype(str)

    X_train, X_test, y_reg_train, y_reg_test, y_cls_train, y_cls_test = train_test_split(
        X, y_reg, y_cls, test_size=0.2, random_state=42
    )

    eval_reg = _build_rf_regressor()
    eval_reg.fit(X_train, y_reg_train)
    reg_preds = eval_reg.predict(X_test)

    eval_cls = _build_aqi_classifier()
    eval_cls.fit(X_train, y_cls_train)
    cls_preds = eval_cls.predict(X_test)

    cv = KFold(n_splits=5, shuffle=True, random_state=42)
    cv_scores = cross_val_score(_build_rf_regressor(), X, y_reg, cv=cv, scoring="r2")

    prod_reg = _build_rf_regressor()
    prod_reg.fit(X, y_reg)

    prod_cls = _build_aqi_classifier()
    prod_cls.fit(X, y_cls)

    pm25_df = labeled.dropna(subset=["pm25"]).copy()
    X_pm = pm25_df[PM25_FEATURES]
    y_pm = pm25_df["pm25"].astype(float)
    Xp_train, Xp_test, yp_train, yp_test = train_test_split(
        X_pm, y_pm, test_size=0.2, random_state=42
    )
    eval_pm = _build_rf_regressor()
    eval_pm.fit(Xp_train, yp_train)
    pm_preds = eval_pm.predict(Xp_test)

    prod_pm = _build_rf_regressor()
    prod_pm.fit(X_pm, y_pm)

    aqi_importances = [
        {
            "feature": col,
            "label": FEATURE_LABELS[col],
            "importance": round(float(imp), 4),
        }
        for col, imp in sorted(
            zip(AQI_FEATURES, prod_reg.named_steps["rf"].feature_importances_),
            key=lambda item: item[1],
            reverse=True,
        )
    ]

    pm25_importances = [
        {
            "feature": col,
            "label": FEATURE_LABELS[col],
            "importance": round(float(imp), 4),
        }
        for col, imp in sorted(
            zip(PM25_FEATURES, prod_pm.named_steps["rf"].feature_importances_),
            key=lambda item: item[1],
            reverse=True,
        )
    ]

    category_counts = labeled["aqi_category"].value_counts().to_dict()

    metadata = {
        "modelVersion": "RF-CPCB-v1.0",
        "algorithm": "Random Forest (250 trees)",
        "trainedAt": datetime.now(timezone.utc).isoformat(),
        "dataset": {
            "totalStations": int(len(df)),
            "labeledStations": int(len(labeled)),
            "citiesCount": int(df["city"].nunique()),
            "statesCount": int(df["state"].nunique()),
            "categoryDistribution": category_counts,
        },
        "aqiMetrics": {
            "r2": round(float(r2_score(y_reg_test, reg_preds)), 4),
            "cvR2Mean": round(float(np.mean(cv_scores)), 4),
            "mae": round(float(mean_absolute_error(y_reg_test, reg_preds)), 2),
            "rmse": round(float(np.sqrt(mean_squared_error(y_reg_test, reg_preds))), 2),
            "classifierAccuracy": round(float(accuracy_score(y_cls_test, cls_preds)), 4),
            "testSamples": int(len(X_test)),
            "trainSamples": int(len(X_train)),
        },
        "pm25Metrics": {
            "r2": round(float(r2_score(yp_test, pm_preds)), 4),
            "mae": round(float(mean_absolute_error(yp_test, pm_preds)), 2),
            "rmse": round(float(np.sqrt(mean_squared_error(yp_test, pm_preds))), 2),
            "samples": int(len(pm25_df)),
        },
        "aqiFeatureImportances": aqi_importances,
        "pm25FeatureImportances": pm25_importances,
    }

    bundle = {
        "aqi_regressor": prod_reg,
        "aqi_classifier": prod_cls,
        "pm25_regressor": prod_pm,
        "aqi_features": AQI_FEATURES,
        "pm25_features": PM25_FEATURES,
        "metadata": metadata,
    }

    joblib.dump(bundle, BUNDLE_PATH)
    METADATA_PATH.write_text(json.dumps(metadata, indent=2), encoding="utf-8")

    lightweight_trees = {
        "aqi_regressor": _serialize_regressor_pipeline(prod_reg, AQI_FEATURES),
        "aqi_classifier": _serialize_classifier_pipeline(prod_cls, AQI_FEATURES),
        "pm25_regressor": _serialize_regressor_pipeline(prod_pm, PM25_FEATURES),
        "metadata": metadata,
    }
    with gzip.open(TREES_PATH, "wt", encoding="utf-8") as gz:
        json.dump(lightweight_trees, gz, separators=(",", ":"))

    return metadata


if __name__ == "__main__":
    meta = train_and_save_models()
    print(json.dumps(meta, indent=2))
