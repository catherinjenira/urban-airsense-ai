from collections import defaultdict
import csv
from statistics import mean

from backend.db import BASE_DIR, ensure_schema, get_connection, is_sqlite_mode

DATASET_PATH = BASE_DIR / "3b01bcb8-0b14-4abf-b6f2-c1bfd384ba69.csv"


def get_aqi_category(aqi: float) -> str:
    """Map numeric AQI to official CPCB category labels."""
    if aqi <= 50:
        return "Good"
    if aqi <= 100:
        return "Satisfactory"
    if aqi <= 200:
        return "Moderate"
    if aqi <= 300:
        return "Poor"
    if aqi <= 400:
        return "Very Poor"
    return "Severe"


def _parse_optional_float(val: str):
    if val is None:
        return None
    s = val.strip()
    if not s or s.upper() == "NA":
        return None
    try:
        return float(s)
    except ValueError:
        return None


def ingest_dataset(force: bool = False) -> dict:
    """Create schema and ingest the CSV dataset into SQL tables."""
    ensure_schema()
    if not DATASET_PATH.exists():
        raise FileNotFoundError(f"Dataset not found at {DATASET_PATH}")

    with DATASET_PATH.open("r", encoding="utf-8", newline="") as f:
        raw_rows = list(csv.DictReader(f))

    with get_connection(include_db=True) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) AS cnt FROM air_quality_observations")
            obs_count = cur.fetchone()["cnt"]

            if obs_count == 0 or force:
                if is_sqlite_mode():
                    cur.execute("DELETE FROM air_quality_observations")
                else:
                    cur.execute("TRUNCATE TABLE air_quality_observations")

                rows = [
                    (
                        r["country"].strip(),
                        r["state"].strip(),
                        r["city"].strip(),
                        r["station"].strip(),
                        r["last_update"].strip(),
                        float(r["latitude"]),
                        float(r["longitude"]),
                        r["pollutant_id"].strip(),
                        _parse_optional_float(r.get("pollutant_min", "")),
                        _parse_optional_float(r.get("pollutant_max", "")),
                        _parse_optional_float(r.get("pollutant_avg", "")),
                    )
                    for r in raw_rows
                ]
                cur.executemany(
                    """
                    INSERT INTO air_quality_observations (
                        country, state, city, station, last_update,
                        latitude, longitude, pollutant_id,
                        pollutant_min, pollutant_max, pollutant_avg
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    rows,
                )

            cur.execute("SELECT COUNT(*) AS cnt FROM station_profiles")
            station_count = cur.fetchone()["cnt"]

            if station_count == 0 or force:
                grouped: dict[tuple, dict[str, list[float]]] = defaultdict(
                    lambda: defaultdict(list)
                )
                for r in raw_rows:
                    key = (
                        r["state"].strip(),
                        r["city"].strip(),
                        r["station"].strip(),
                        float(r["latitude"]),
                        float(r["longitude"]),
                    )
                    val = _parse_optional_float(r.get("pollutant_avg", ""))
                    if val is not None:
                        grouped[key][r["pollutant_id"].strip()].append(val)

                if is_sqlite_mode():
                    cur.execute("DELETE FROM station_profiles")
                else:
                    cur.execute("TRUNCATE TABLE station_profiles")

                pollutant_cols = ["PM2.5", "PM10", "NO2", "SO2", "CO", "OZONE", "NH3"]
                station_rows = []
                for (state, city, station, lat, lon), pmap in sorted(grouped.items()):
                    vals = [
                        mean(pmap[col]) if pmap.get(col) else None
                        for col in pollutant_cols
                    ]
                    non_null = [v for v in vals if v is not None]
                    has_particulate = vals[0] is not None or vals[1] is not None
                    if len(non_null) >= 3 and has_particulate:
                        actual_aqi = float(max(non_null))
                        category = get_aqi_category(actual_aqi)
                    else:
                        actual_aqi = None
                        category = None

                    station_rows.append(
                        (
                            state,
                            city,
                            station,
                            lat,
                            lon,
                            vals[0],
                            vals[1],
                            vals[2],
                            vals[3],
                            vals[4],
                            vals[5],
                            vals[6],
                            actual_aqi,
                            category,
                        )
                    )

                cur.executemany(
                    """
                    INSERT INTO station_profiles (
                        state, city, station, latitude, longitude,
                        pm25, pm10, no2, so2, co, ozone, nh3,
                        actual_aqi, aqi_category
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    station_rows,
                )

            cur.execute("SELECT COUNT(*) AS cnt FROM air_quality_observations")
            final_obs = cur.fetchone()["cnt"]
            cur.execute("SELECT COUNT(*) AS cnt FROM station_profiles")
            final_stations = cur.fetchone()["cnt"]

    return {
        "observations": final_obs,
        "stations": final_stations,
    }


if __name__ == "__main__":
    summary = ingest_dataset(force=True)
    print(f"Database initialized and ingested: {summary}")
