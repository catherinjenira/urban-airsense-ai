from pathlib import Path

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    """Provide an isolated FastAPI TestClient backed by a fresh SQLite test DB."""
    db_file = tmp_path / "test_urban_airsense.db"
    monkeypatch.setenv("DB_TYPE", "sqlite")
    monkeypatch.setenv("SQLITE_DB_PATH", str(db_file))
    monkeypatch.setenv("AUTH_RATE_LIMIT", "12")

    from backend.db import reset_db_mode_cache
    from backend.main import app, reset_runtime_caches

    reset_db_mode_cache()
    reset_runtime_caches()

    with TestClient(app) as test_client:
        yield test_client

    reset_db_mode_cache()
    reset_runtime_caches()


CSRF_HEADERS = {"X-Requested-With": "XMLHttpRequest"}


def _signup_and_get_token(client: TestClient, email: str = "alice@example.com") -> str:
    res = client.post(
        "/api/auth/signup",
        headers=CSRF_HEADERS,
        json={
            "fullName": "Alice Tester",
            "email": email,
            "password": "StrongPassword123",
            "preferredCity": "chennai",
        },
    )
    assert res.status_code == 201, res.text
    assert "token" not in res.json()
    cookie_token = res.cookies.get("airsense_session")
    assert cookie_token
    return cookie_token


def test_health_and_security_headers(client: TestClient):
    res = client.get("/api/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert body["stationsInDb"] == 570
    assert body["modelVersion"] == "RF-CPCB-v1.0"
    assert res.headers["x-content-type-options"] == "nosniff"
    assert res.headers["x-frame-options"] == "DENY"
    assert "strict-origin-when-cross-origin" in res.headers["referrer-policy"]
    assert res.headers["content-security-policy"] == "default-src 'none'; frame-ancestors 'none'"
    assert "max-age=" in res.headers["strict-transport-security"]


def test_db_identifier_and_aqi_category_boundaries():
    from backend.db import validate_db_identifier
    from backend.init_db import get_aqi_category

    assert validate_db_identifier("urban_airsense_db") == "urban_airsense_db"
    with pytest.raises(ValueError):
        validate_db_identifier("bad; DROP TABLE users")
    with pytest.raises(ValueError):
        validate_db_identifier("")

    assert get_aqi_category(0) == "Good"
    assert get_aqi_category(50) == "Good"
    assert get_aqi_category(51) == "Satisfactory"
    assert get_aqi_category(100) == "Satisfactory"
    assert get_aqi_category(101) == "Moderate"
    assert get_aqi_category(200) == "Moderate"
    assert get_aqi_category(201) == "Poor"
    assert get_aqi_category(300) == "Poor"
    assert get_aqi_category(301) == "Very Poor"
    assert get_aqi_category(400) == "Very Poor"
    assert get_aqi_category(401) == "Severe"


def test_signup_validation_and_duplicate_rejection(client: TestClient):
    bad_email = client.post(
        "/api/auth/signup",
        json={
            "fullName": "Bob",
            "email": "not-an-email",
            "password": "StrongPassword123",
            "preferredCity": "delhi",
        },
    )
    assert bad_email.status_code == 400

    short_pw = client.post(
        "/api/auth/signup",
        json={
            "fullName": "Bob",
            "email": "bob@example.com",
            "password": "short",
            "preferredCity": "delhi",
        },
    )
    assert short_pw.status_code == 422

    no_digit_pw = client.post(
        "/api/auth/signup",
        json={
            "fullName": "Bob Builder",
            "email": "bob@example.com",
            "password": "OnlyLettersPassword",
            "preferredCity": "delhi",
        },
    )
    assert no_digit_pw.status_code == 400

    first = client.post(
        "/api/auth/signup",
        json={
            "fullName": "Bob Builder",
            "email": "bob@example.com",
            "password": "StrongPassword123",
            "preferredCity": "unknown-city",
        },
    )
    assert first.status_code == 201
    assert "token" not in first.json()
    assert first.json()["user"]["preferredCity"] == "chennai"
    assert first.headers.get("cache-control") == "no-store"

    dup = client.post(
        "/api/auth/signup",
        json={
            "fullName": "Bob Builder",
            "email": "bob@example.com",
            "password": "StrongPassword123",
            "preferredCity": "delhi",
        },
    )
    assert dup.status_code == 409


def test_httponly_cookie_csrf_and_session_hashing(client: TestClient):
    from backend.db import get_connection

    raw_token = _signup_and_get_token(client, "cookieuser@example.com")

    # Verify session token is stored hashed in SQL, never plaintext
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT token FROM user_sessions")
            rows = cur.fetchall()
            assert len(rows) == 1
            assert rows[0]["token"] != raw_token
            assert len(rows[0]["token"]) == 64

    # Authenticate via HttpOnly cookie alone for GET
    me_cookie = client.get("/api/auth/me")
    assert me_cookie.status_code == 200
    assert me_cookie.json()["user"]["email"] == "cookieuser@example.com"

    # Cookie-authenticated POST without X-Requested-With must be rejected (CSRF protection)
    csrf_blocked = client.post("/api/auth/logout")
    assert csrf_blocked.status_code == 403

    logout_res = client.post("/api/auth/logout", headers=CSRF_HEADERS)
    assert logout_res.status_code == 200

    after_logout = client.get("/api/auth/me")
    assert after_logout.status_code == 401

    bad_login = client.post(
        "/api/auth/login",
        json={"email": "cookieuser@example.com", "password": "wrong-password"},
    )
    assert bad_login.status_code == 401

    good_login = client.post(
        "/api/auth/login",
        json={"email": "cookieuser@example.com", "password": "StrongPassword123"},
    )
    assert good_login.status_code == 200
    assert "token" not in good_login.json()
    assert "airsense_session" in good_login.cookies


def test_auth_rate_limiting(client: TestClient):
    _signup_and_get_token(client, "ratelimit@example.com")
    statuses = []
    for _ in range(15):
        r = client.post(
            "/api/auth/login",
            json={"email": "ratelimit@example.com", "password": "bad"},
        )
        statuses.append(r.status_code)
    assert 429 in statuses


def test_dataset_and_model_endpoints(client: TestClient):
    info = client.get("/api/model/info")
    assert info.status_code == 200
    data = info.json()
    assert data["aqiMetrics"]["r2"] > 0.95
    assert data["dataset"]["totalStations"] == 570
    assert data["databaseStats"]["observationRows"] == 3990

    stations_all = client.get("/api/dataset/stations?limit=15")
    assert stations_all.status_code == 200
    assert stations_all.json()["count"] == 15

    stations_city = client.get("/api/dataset/stations?city=Chennai&limit=20")
    assert stations_city.status_code == 200
    assert stations_city.json()["count"] >= 5

    stations_both = client.get("/api/dataset/stations?city=Chennai&search=Arumbakkam&limit=10")
    assert stations_both.status_code == 200
    assert stations_both.json()["count"] >= 1

    search = client.get("/api/dataset/stations?search=Patna&limit=10")
    assert search.status_code == 200
    assert search.json()["count"] >= 1

    city_stats_1 = client.get("/api/dataset/city-stats")
    city_stats_2 = client.get("/api/dataset/city-stats")
    assert city_stats_1.status_code == 200
    assert city_stats_1.json() == city_stats_2.json()
    assert len(city_stats_1.json()["cities"]) == 6


def test_random_forest_prediction_and_history(client: TestClient):
    unauth = client.post(
        "/api/predict",
        headers=CSRF_HEADERS,
        json={
            "city": "Chennai",
            "pm25": 45,
            "pm10": 80,
            "no2": 22,
            "so2": 10,
            "co": 30,
            "ozone": 24,
            "nh3": 4,
            "latitude": 13.08,
            "longitude": 80.27,
        },
    )
    assert unauth.status_code == 401

    _signup_and_get_token(client, "predictor@example.com")
    pred_direct = client.post(
        "/api/predict",
        headers=CSRF_HEADERS,
        json={
            "city": "Chennai",
            "station": "Arumbakkam, Chennai - TNPCB",
            "pm25": 42,
            "pm10": 68,
            "no2": 24,
            "so2": 8,
            "co": 34,
            "ozone": 28,
            "nh3": 4,
            "latitude": 13.072,
            "longitude": 80.21,
            "estimatePm25": False,
        },
    )
    assert pred_direct.status_code == 200
    p1 = pred_direct.json()
    assert p1["intervalLow"] <= p1["predictedAqi"] <= p1["intervalHigh"]
    assert 60 <= p1["confidencePct"] <= 100
    assert p1["pm25WasEstimated"] is False

    pred_est = client.post(
        "/api/predict",
        headers=CSRF_HEADERS,
        json={
            "city": "Delhi",
            "station": "Estimated PM2.5 Station",
            "pm10": 210,
            "no2": 64,
            "so2": 18,
            "co": 52,
            "ozone": 32,
            "nh3": 11,
            "latitude": 28.6139,
            "longitude": 77.209,
            "estimatePm25": True,
        },
    )
    assert pred_est.status_code == 200
    p2 = pred_est.json()
    assert p2["pm25WasEstimated"] is True
    assert p2["effectivePm25"] == p2["estimatedPm25FromCoPollutants"]

    hist = client.get("/api/predictions/history")
    assert hist.status_code == 200
    assert len(hist.json()["history"]) == 2


def test_exposure_crud_and_user_isolation(client: TestClient):
    token_a = _signup_and_get_token(client, "user_a@example.com")
    client.cookies.clear()
    token_b = _signup_and_get_token(client, "user_b@example.com")

    created = client.post(
        "/api/exposure",
        headers={**CSRF_HEADERS, "Authorization": f"Bearer {token_a}"},
        json={
            "entryDate": "Today · 09:30",
            "cityId": "chennai",
            "activity": "Jogging",
            "durationMinutes": 45,
            "estimatedPm25": 34.0,
            "inhaledDoseUg": 47.5,
        },
    )
    assert created.status_code == 201
    entry_id = created.json()["entry"]["id"]

    # User B must not see User A's exposure logs or delete them
    list_b = client.get("/api/exposure", headers={"Authorization": f"Bearer {token_b}"})
    assert list_b.status_code == 200
    assert len(list_b.json()["entries"]) == 0

    client.delete(
        f"/api/exposure/{entry_id}",
        headers={**CSRF_HEADERS, "Authorization": f"Bearer {token_b}"},
    )

    list_a = client.get("/api/exposure", headers={"Authorization": f"Bearer {token_a}"})
    assert list_a.status_code == 200
    assert len(list_a.json()["entries"]) == 1

    deleted = client.delete(
        f"/api/exposure/{entry_id}",
        headers={**CSRF_HEADERS, "Authorization": f"Bearer {token_a}"},
    )
    assert deleted.status_code == 200
    assert len(
        client.get("/api/exposure", headers={"Authorization": f"Bearer {token_a}"}).json()["entries"]
    ) == 0


def test_tree_inference_and_optional_sklearn_parity():
    from backend.main import _get_trees, _predict_classifier_trees, _predict_regressor_trees

    trees = _get_trees()
    assert len(trees["aqi_regressor"]["trees"]) == 250
    assert len(trees["aqi_classifier"]["trees"]) == 250
    assert len(trees["pm25_regressor"]["trees"]) == 250

    sample = {
        "pm25": 168.0,
        "pm10": 148.0,
        "no2": 32.0,
        "so2": 12.0,
        "co": 42.0,
        "ozone": 23.0,
        "nh3": 5.0,
        "latitude": 25.6,
        "longitude": 85.1,
    }
    low_sample = {**sample, "pm25": 18.0, "pm10": 32.0}

    py_preds = _predict_regressor_trees(trees["aqi_regressor"], sample)
    py_aqi = sum(py_preds) / len(py_preds)
    low_preds = _predict_regressor_trees(trees["aqi_regressor"], low_sample)
    low_aqi = sum(low_preds) / len(low_preds)
    assert py_aqi > low_aqi

    py_probs = _predict_classifier_trees(trees["aqi_classifier"], sample)
    assert abs(sum(py_probs.values()) - 1.0) < 1e-4

    import importlib.util

    bundle_path = Path(__file__).resolve().parent.parent / "backend" / "models" / "rf_air_quality_bundle.joblib"
    if (
        bundle_path.exists()
        and importlib.util.find_spec("joblib") is not None
        and importlib.util.find_spec("pandas") is not None
    ):
        import joblib
        import pandas as pd

        bundle = joblib.load(bundle_path)
        df_aqi = pd.DataFrame([sample])[bundle["aqi_features"]]
        sk_aqi = float(bundle["aqi_regressor"].predict(df_aqi)[0])
        assert abs(sk_aqi - py_aqi) < 1e-3

        sk_cls = str(bundle["aqi_classifier"].predict(df_aqi)[0])
        py_cls = max(py_probs.items(), key=lambda x: x[1])[0]
        assert sk_cls == py_cls
