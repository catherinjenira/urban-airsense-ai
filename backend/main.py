from collections import defaultdict, deque
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
import gzip
import hashlib
import hmac
import json
import math
import os
from pathlib import Path
import re
import secrets
import threading
import time
from typing import Optional

from fastapi import Cookie, Depends, FastAPI, Header, HTTPException, Query, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from backend.db import ensure_schema, get_connection, is_sqlite_mode
from backend.init_db import get_aqi_category, ingest_dataset

TREES_PATH = Path(__file__).resolve().parent / "models" / "rf_inference_trees.json.gz"

VALID_CITY_IDS = {"chennai", "bengaluru", "hyderabad", "delhi", "mumbai", "coimbatore"}
EMAIL_REGEX = re.compile(r"^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$")
PASSWORD_LETTER_RE = re.compile(r"[A-Za-z]")
PASSWORD_DIGIT_RE = re.compile(r"[0-9]")
SESSION_COOKIE_NAME = "airsense_session"


def _get_allowed_origins() -> list[str]:
    """Read configured CORS origins from ALLOWED_ORIGINS or fall back to local dev."""
    raw = os.getenv("ALLOWED_ORIGINS", "").strip()
    if raw:
        return [origin.strip() for origin in raw.split(",") if origin.strip()]
    return ["http://localhost:3000", "http://127.0.0.1:3000"]


class _SlidingWindowRateLimiter:
    """Thread-safe sliding-window rate limiter for authentication endpoints."""

    def __init__(self, max_requests: int = 20, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._buckets: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def check(self, key: str) -> None:
        """Raise HTTP 429 if key exceeded max_requests within window_seconds."""
        now = time.monotonic()
        cutoff = now - self.window_seconds
        with self._lock:
            q = self._buckets[key]
            while q and q[0] < cutoff:
                q.popleft()
            if len(q) >= self.max_requests:
                retry_after = max(1, int(self.window_seconds - (now - q[0])))
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Too many authentication attempts. Please wait and try again.",
                    headers={"Retry-After": str(retry_after)},
                )
            q.append(now)

    def reset(self, max_requests: Optional[int] = None) -> None:
        """Clear all rate-limit buckets and optionally update max_requests."""
        with self._lock:
            self._buckets.clear()
            if max_requests is not None:
                self.max_requests = max_requests


auth_rate_limiter = _SlidingWindowRateLimiter(
    max_requests=int(os.getenv("AUTH_RATE_LIMIT", "25")),
    window_seconds=60,
)

@asynccontextmanager
async def _lifespan(_app: FastAPI):
    """Initialize SQL schema, dataset rows, and Random Forest model on startup."""
    _ensure_initialized()
    _get_trees()
    yield


app = FastAPI(
    title="Urban AirSense AI SQL & Random Forest API",
    version="1.1.0",
    lifespan=_lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_get_allowed_origins(),
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Requested-With"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(_request: Request, _exc: Exception):
    """Return a generic 500 JSON payload without exposing internal tracebacks."""
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An unexpected server error occurred."},
    )


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    """Attach standard security and cache-control headers to every HTTP response."""
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'"
    response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
    if request.url.path.startswith(("/api/auth", "/api/predictions", "/api/exposure")):
        response.headers["Cache-Control"] = "no-store"
    return response


_INIT_LOCK = threading.Lock()
_CACHE_LOCK = threading.Lock()
MODEL_TREES: Optional[dict] = None
_DB_READY = False
_CITY_STATS_CACHE: Optional[tuple[float, list[dict]]] = None


def reset_runtime_caches() -> None:
    """Reset initialization flags and response caches (used by automated tests)."""
    global _DB_READY, _CITY_STATS_CACHE
    with _INIT_LOCK:
        _DB_READY = False
    with _CACHE_LOCK:
        _CITY_STATS_CACHE = None
    auth_rate_limiter.reset(max_requests=int(os.getenv("AUTH_RATE_LIMIT", "25")))


def _ensure_initialized() -> None:
    """Thread-safely ensure SQL schema exists and dataset is ingested."""
    global _DB_READY
    if _DB_READY:
        return
    with _INIT_LOCK:
        if not _DB_READY:
            ensure_schema()
            ingest_dataset(force=False)
            _DB_READY = True


def _get_trees() -> dict:
    """Thread-safely load and cache the compressed Random Forest tree artifact."""
    global MODEL_TREES
    if MODEL_TREES is not None:
        return MODEL_TREES
    with _INIT_LOCK:
        if MODEL_TREES is None:
            if not TREES_PATH.exists():
                raise RuntimeError(f"Trained Random Forest artifact missing at {TREES_PATH}")
            with gzip.open(TREES_PATH, "rt", encoding="utf-8") as gz:
                MODEL_TREES = json.load(gz)
    return MODEL_TREES


def _impute_features(values: dict, feature_names: list[str], medians: list[float]) -> list[float]:
    """Build ordered feature vector using training medians for missing inputs."""
    vec = []
    for idx, name in enumerate(feature_names):
        raw = values.get(name)
        if raw is None or (isinstance(raw, float) and math.isnan(raw)):
            vec.append(float(medians[idx]))
        else:
            vec.append(float(raw))
    return vec


def _traverse_tree(tree: dict, vec: list[float]):
    """Evaluate a single serialized CART tree on a numeric feature vector."""
    left = tree["l"]
    right = tree["r"]
    feat = tree["f"]
    thresh = tree["t"]
    node = 0
    while left[node] != -1:
        if vec[feat[node]] <= thresh[node]:
            node = left[node]
        else:
            node = right[node]
    return tree["v"][node]


def _predict_regressor_trees(model_dict: dict, values: dict) -> list[float]:
    """Return individual predictions across all regression trees in the forest."""
    vec = _impute_features(values, model_dict["features"], model_dict["medians"])
    return [float(_traverse_tree(tree, vec)) for tree in model_dict["trees"]]


def _predict_classifier_trees(model_dict: dict, values: dict) -> dict[str, float]:
    """Return averaged class probabilities across all classification trees."""
    vec = _impute_features(values, model_dict["features"], model_dict["medians"])
    classes = model_dict["classes"]
    totals = [0.0] * len(classes)
    trees = model_dict["trees"]
    for tree in trees:
        probs = _traverse_tree(tree, vec)
        for i, p in enumerate(probs):
            totals[i] += p
    n = float(len(trees)) or 1.0
    return {classes[i]: totals[i] / n for i in range(len(classes))}


def _percentile(sorted_vals: list[float], pct: float) -> float:
    """Compute linear-interpolated percentile from a sorted numeric list."""
    if not sorted_vals:
        return 0.0
    if len(sorted_vals) == 1:
        return sorted_vals[0]
    pos = (pct / 100.0) * (len(sorted_vals) - 1)
    lo = int(math.floor(pos))
    hi = int(math.ceil(pos))
    if lo == hi:
        return sorted_vals[lo]
    frac = pos - lo
    return sorted_vals[lo] * (1.0 - frac) + sorted_vals[hi] * frac


def _hash_password(password: str, salt: Optional[str] = None) -> str:
    """Hash a password using PBKDF2-HMAC-SHA256 with a 128-bit random salt."""
    salt_val = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt_val.encode("utf-8"), 200_000
    ).hex()
    return f"{salt_val}${digest}"


def _verify_password(password: str, stored_hash: str) -> bool:
    """Verify a plaintext password against a stored PBKDF2 hash in constant time."""
    try:
        salt_val, expected_hex = stored_hash.split("$", 1)
    except ValueError:
        return False
    candidate = _hash_password(password, salt=salt_val)
    return hmac.compare_digest(candidate, f"{salt_val}${expected_hex}")


def _hash_session_token(raw_token: str) -> str:
    """Hash bearer tokens with SHA-256 before storing or querying in SQL."""
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def _health_guidance(category: str) -> str:
    """Return official CPCB-aligned respiratory health guidance for an AQI category."""
    guidance = {
        "Good": "Minimal air quality impact. Ideal conditions for sustained outdoor activity across all age groups.",
        "Satisfactory": "Acceptable ambient air for most residents; sensitive individuals may notice minor discomfort near heavy traffic.",
        "Moderate": "Sensitive groups—children, older adults, and people with asthma—should moderate prolonged outdoor exertion.",
        "Poor": "Elevated particulate burden. Shift vigorous workouts indoors and wear an N95/FFP2 respirator along arterial corridors.",
        "Very Poor": "Widespread respiratory strain expected on sustained exposure. Avoid strenuous outdoor activity and filter indoor air.",
        "Severe": "Acute pollution episode. Minimize outdoor movement, keep indoor spaces sealed/filtered, and follow health advisories.",
    }
    return guidance.get(category, guidance["Moderate"])


# -------------------- Pydantic Schemas --------------------


class SignupRequest(BaseModel):
    """Payload for creating a new user account."""

    fullName: str = Field(min_length=2, max_length=120)
    email: str = Field(min_length=5, max_length=190)
    password: str = Field(min_length=8, max_length=128)
    preferredCity: str = Field(default="chennai", max_length=64)


class LoginRequest(BaseModel):
    """Payload for authenticating an existing user."""

    email: str = Field(min_length=5, max_length=190)
    password: str = Field(min_length=1, max_length=128)


class PredictRequest(BaseModel):
    """Pollutant and coordinate inputs for Random Forest AQI & PM2.5 inference."""

    city: str = Field(default="Chennai", max_length=100)
    station: Optional[str] = Field(default=None, max_length=255)
    pm25: Optional[float] = Field(default=None, ge=0, le=1000)
    pm10: float = Field(ge=0, le=1000)
    no2: float = Field(ge=0, le=500)
    so2: float = Field(ge=0, le=500)
    co: float = Field(ge=0, le=500)
    ozone: float = Field(ge=0, le=500)
    nh3: float = Field(ge=0, le=500)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    estimatePm25: bool = False


class ExposureCreateRequest(BaseModel):
    """Payload for persisting a personal air-quality exposure entry."""

    entryDate: str = Field(min_length=1, max_length=64)
    cityId: str = Field(min_length=2, max_length=64)
    activity: str = Field(min_length=2, max_length=32)
    durationMinutes: int = Field(ge=5, le=480)
    estimatedPm25: float = Field(ge=0, le=1000)
    inhaledDoseUg: float = Field(ge=0, le=100000)


# -------------------- Auth Dependency --------------------


def _utc_now_str() -> str:
    """Return current UTC timestamp formatted consistently for MySQL and SQLite."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")


def _set_session_cookie(response: Response, request: Request, token: str) -> None:
    """Attach an HttpOnly, SameSite=Lax session cookie on auth responses."""
    is_https = request.url.scheme == "https" or bool(os.getenv("VERCEL"))
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        max_age=7 * 24 * 60 * 60,
        httponly=True,
        samesite="lax",
        secure=is_https,
        path="/",
    )


def _user_row_to_dict(user_row: dict) -> dict:
    """Normalize a SQL user row into a public UserProfile dictionary."""
    created_at = user_row.get("created_at")
    return {
        "id": user_row["id"],
        "fullName": user_row["full_name"],
        "email": user_row["email"],
        "preferredCity": user_row["preferred_city"],
        "createdAt": created_at.isoformat() if hasattr(created_at, "isoformat") else str(created_at or ""),
    }


def get_current_user(
    request: Request,
    authorization: Optional[str] = Header(default=None),
    airsense_session: Optional[str] = Cookie(default=None),
    x_requested_with: Optional[str] = Header(default=None),
) -> dict:
    """Validate explicit Bearer token or HttpOnly session cookie (with CSRF check on mutations)."""
    _ensure_initialized()
    token = ""
    used_cookie = False
    if authorization and authorization.startswith("Bearer "):
        token = authorization.removeprefix("Bearer ").strip()
    elif airsense_session:
        token = airsense_session.strip()
        used_cookie = True

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please log in.",
        )

    if used_cookie and request.method in ("POST", "PUT", "PATCH", "DELETE"):
        if x_requested_with != "XMLHttpRequest":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Missing CSRF protection header.",
            )

    token_hash = _hash_session_token(token)
    now_str = _utc_now_str()
    with get_connection(include_db=True) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT u.id, u.full_name, u.email, u.preferred_city, u.created_at
                FROM user_sessions s
                JOIN users u ON u.id = s.user_id
                WHERE s.token = %s AND s.expires_at > %s
                LIMIT 1
                """,
                (token_hash, now_str),
            )
            user = cur.fetchone()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired or invalid. Please log in again.",
        )
    created_at = user["created_at"]
    return {
        "id": user["id"],
        "fullName": user["full_name"],
        "email": user["email"],
        "preferredCity": user["preferred_city"],
        "createdAt": created_at.isoformat() if hasattr(created_at, "isoformat") else str(created_at or ""),
        "tokenHash": token_hash,
    }


def _create_session(user_id: int) -> str:
    """Generate a cryptographic session token, store its SHA-256 hash, and prune expired rows."""
    raw_token = secrets.token_urlsafe(48)
    token_hash = _hash_session_token(raw_token)
    now_str = _utc_now_str()
    expires_at = (datetime.now(timezone.utc) + timedelta(days=7)).strftime("%Y-%m-%d %H:%M:%S")
    with get_connection(include_db=True) as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM user_sessions WHERE expires_at <= %s", (now_str,))
            cur.execute(
                "INSERT INTO user_sessions (user_id, token, expires_at) VALUES (%s, %s, %s)",
                (user_id, token_hash, expires_at),
            )
    return raw_token


def _client_key(request: Request, suffix: str) -> str:
    """Build rate-limiter key from client IP and endpoint suffix."""
    host = request.client.host if request.client else "unknown"
    return f"{host}:{suffix}"


# -------------------- Routes --------------------


@app.get("/api/health")
def health_check():
    """Verify database connectivity, station count, and loaded Random Forest version."""
    _ensure_initialized()
    trees = _get_trees()
    with get_connection(include_db=True) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT 1 AS ok")
            cur.execute("SELECT COUNT(*) AS cnt FROM station_profiles")
            station_count = cur.fetchone()["cnt"]
    return {
        "status": "ok",
        "database": "sqlite-fallback" if is_sqlite_mode() else "mysql",
        "modelVersion": trees["metadata"]["modelVersion"],
        "stationsInDb": station_count,
    }


@app.post("/api/auth/signup", status_code=status.HTTP_201_CREATED)
def signup(payload: SignupRequest, request: Request, response: Response):
    """Register a new user in SQL and issue an HttpOnly session cookie + token."""
    auth_rate_limiter.check(_client_key(request, "signup"))
    _ensure_initialized()

    email = payload.email.strip().lower()
    if not EMAIL_REGEX.match(email):
        raise HTTPException(status_code=400, detail="Please enter a valid email address.")

    if not PASSWORD_LETTER_RE.search(payload.password) or not PASSWORD_DIGIT_RE.search(payload.password):
        raise HTTPException(
            status_code=400,
            detail="Password must include at least one letter and one number.",
        )

    full_name = " ".join(payload.fullName.strip().split())
    if len(full_name) < 2:
        raise HTTPException(status_code=400, detail="Full name must be at least 2 characters.")

    preferred_city = payload.preferredCity.strip().lower()
    if preferred_city not in VALID_CITY_IDS:
        preferred_city = "chennai"

    pw_hash = _hash_password(payload.password)

    with get_connection(include_db=True) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM users WHERE email = %s", (email,))
            if cur.fetchone():
                raise HTTPException(
                    status_code=409,
                    detail="An account with this email already exists. Please log in.",
                )
            cur.execute(
                """
                INSERT INTO users (full_name, email, password_hash, preferred_city)
                VALUES (%s, %s, %s, %s)
                """,
                (full_name, email, pw_hash, preferred_city),
            )
            user_id = cur.lastrowid
            cur.execute(
                "SELECT id, full_name, email, preferred_city, created_at FROM users WHERE id = %s",
                (user_id,),
            )
            user_row = cur.fetchone()

    token = _create_session(user_id)
    _set_session_cookie(response, request, token)
    return {"user": _user_row_to_dict(user_row)}


@app.post("/api/auth/login")
def login(payload: LoginRequest, request: Request, response: Response):
    """Authenticate user credentials against SQL and issue an HttpOnly session cookie."""
    auth_rate_limiter.check(_client_key(request, "login"))
    _ensure_initialized()

    email = payload.email.strip().lower()
    with get_connection(include_db=True) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, full_name, email, password_hash, preferred_city, created_at
                FROM users
                WHERE email = %s
                LIMIT 1
                """,
                (email,),
            )
            user_row = cur.fetchone()

    if not user_row or not _verify_password(payload.password, user_row["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    token = _create_session(user_row["id"])
    _set_session_cookie(response, request, token)
    return {"user": _user_row_to_dict(user_row)}


@app.post("/api/auth/logout")
def logout(response: Response, user: dict = Depends(get_current_user)):
    """Revoke the current user session token in SQL and clear the cookie."""
    with get_connection(include_db=True) as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM user_sessions WHERE token = %s", (user["tokenHash"],))
    response.delete_cookie(key=SESSION_COOKIE_NAME, path="/")
    return {"ok": True}


@app.get("/api/auth/me")
def get_me(user: dict = Depends(get_current_user)):
    """Return the authenticated user's profile."""
    return {
        "user": {
            "id": user["id"],
            "fullName": user["fullName"],
            "email": user["email"],
            "preferredCity": user["preferredCity"],
            "createdAt": user["createdAt"],
        }
    }


@app.get("/api/model/info")
def get_model_info():
    """Return Random Forest evaluation metrics, feature importances, and SQL row counts."""
    _ensure_initialized()
    trees = _get_trees()
    with get_connection(include_db=True) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) AS cnt FROM air_quality_observations")
            obs_count = cur.fetchone()["cnt"]
            cur.execute("SELECT COUNT(*) AS cnt FROM prediction_logs")
            pred_count = cur.fetchone()["cnt"]
            cur.execute("SELECT COUNT(*) AS cnt FROM users")
            user_count = cur.fetchone()["cnt"]

    return {
        **trees["metadata"],
        "databaseStats": {
            "observationRows": obs_count,
            "predictionLogsCount": pred_count,
            "registeredUsers": user_count,
        },
    }


@app.get("/api/dataset/stations")
def list_dataset_stations(
    city: Optional[str] = Query(default=None, max_length=100),
    search: Optional[str] = Query(default=None, max_length=100),
    limit: int = Query(default=100, ge=1, le=600),
):
    """Query CPCB monitoring station profiles stored in SQL using static parameterized queries."""
    _ensure_initialized()
    cleaned_city = city.strip() if city and city.strip() else None
    cleaned_search = search.strip() if search and search.strip() else None

    with get_connection(include_db=True) as conn:
        with conn.cursor() as cur:
            if cleaned_city and cleaned_search:
                like_term = f"%{cleaned_search}%"
                cur.execute(
                    """
                    SELECT id, state, city, station, latitude, longitude,
                           pm25, pm10, no2, so2, co, ozone, nh3,
                           actual_aqi AS actualAqi, aqi_category AS aqiCategory
                    FROM station_profiles
                    WHERE LOWER(city) = LOWER(%s)
                      AND actual_aqi IS NOT NULL
                      AND (station LIKE %s OR city LIKE %s OR state LIKE %s)
                    ORDER BY (actual_aqi IS NULL) ASC, city ASC, station ASC
                    LIMIT %s
                    """,
                    (cleaned_city, like_term, like_term, like_term, limit),
                )
            elif cleaned_city:
                cur.execute(
                    """
                    SELECT id, state, city, station, latitude, longitude,
                           pm25, pm10, no2, so2, co, ozone, nh3,
                           actual_aqi AS actualAqi, aqi_category AS aqiCategory
                    FROM station_profiles
                    WHERE LOWER(city) = LOWER(%s)
                    ORDER BY (actual_aqi IS NULL) ASC, city ASC, station ASC
                    LIMIT %s
                    """,
                    (cleaned_city, limit),
                )
            elif cleaned_search:
                like_term = f"%{cleaned_search}%"
                cur.execute(
                    """
                    SELECT id, state, city, station, latitude, longitude,
                           pm25, pm10, no2, so2, co, ozone, nh3,
                           actual_aqi AS actualAqi, aqi_category AS aqiCategory
                    FROM station_profiles
                    WHERE actual_aqi IS NOT NULL
                      AND (station LIKE %s OR city LIKE %s OR state LIKE %s)
                    ORDER BY (actual_aqi IS NULL) ASC, city ASC, station ASC
                    LIMIT %s
                    """,
                    (like_term, like_term, like_term, limit),
                )
            else:
                cur.execute(
                    """
                    SELECT id, state, city, station, latitude, longitude,
                           pm25, pm10, no2, so2, co, ozone, nh3,
                           actual_aqi AS actualAqi, aqi_category AS aqiCategory
                    FROM station_profiles
                    ORDER BY (actual_aqi IS NULL) ASC, city ASC, station ASC
                    LIMIT %s
                    """,
                    (limit,),
                )
            rows = cur.fetchall()

    return {"stations": rows, "count": len(rows)}


@app.get("/api/dataset/city-stats")
def get_city_stats():
    """Return per-city SQL aggregates and Random Forest benchmark predictions (cached 60s)."""
    global _CITY_STATS_CACHE
    _ensure_initialized()

    now = time.monotonic()
    with _CACHE_LOCK:
        if _CITY_STATS_CACHE is not None and (now - _CITY_STATS_CACHE[0]) < 60.0:
            return {"cities": _CITY_STATS_CACHE[1]}

    trees = _get_trees()
    aqi_reg_model = trees["aqi_regressor"]
    target_cities = ["Chennai", "Bengaluru", "Hyderabad", "Delhi", "Mumbai", "Coimbatore"]

    with get_connection(include_db=True) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT city,
                       COUNT(*) AS stationCount,
                       ROUND(AVG(pm25), 1) AS avgPm25,
                       ROUND(AVG(pm10), 1) AS avgPm10,
                       ROUND(AVG(no2), 1) AS avgNo2,
                       ROUND(AVG(so2), 1) AS avgSo2,
                       ROUND(AVG(co), 1) AS avgCo,
                       ROUND(AVG(ozone), 1) AS avgOzone,
                       ROUND(AVG(nh3), 1) AS avgNh3,
                       ROUND(AVG(latitude), 4) AS avgLat,
                       ROUND(AVG(longitude), 4) AS avgLon,
                       ROUND(AVG(actual_aqi), 1) AS avgActualAqi,
                       ROUND(MAX(actual_aqi), 1) AS maxActualAqi
                FROM station_profiles
                WHERE city IN (%s, %s, %s, %s, %s, %s)
                GROUP BY city
                """,
                tuple(target_cities),
            )
            rows = cur.fetchall()

    results = []
    for r in rows:
        tree_preds = _predict_regressor_trees(
            aqi_reg_model,
            {
                "pm25": r["avgPm25"],
                "pm10": r["avgPm10"],
                "no2": r["avgNo2"],
                "so2": r["avgSo2"],
                "co": r["avgCo"],
                "ozone": r["avgOzone"],
                "nh3": r["avgNh3"],
                "latitude": r["avgLat"],
                "longitude": r["avgLon"],
            },
        )
        rf_aqi = round(sum(tree_preds) / len(tree_preds), 1)
        avg_actual = r["avgActualAqi"] if r["avgActualAqi"] is not None else rf_aqi
        max_actual = r["maxActualAqi"] if r["maxActualAqi"] is not None else rf_aqi
        results.append(
            {
                **r,
                "avgActualAqi": avg_actual,
                "maxActualAqi": max_actual,
                "cityId": r["city"].lower(),
                "rfPredictedAqi": rf_aqi,
                "rfCategory": get_aqi_category(rf_aqi),
            }
        )

    with _CACHE_LOCK:
        _CITY_STATS_CACHE = (now, results)

    return {"cities": results}


def _run_random_forest_inference(payload: PredictRequest) -> dict:
    """Run Random Forest PM2.5 estimation, AQI regression, and category classification."""
    trees = _get_trees()
    pm25_preds = _predict_regressor_trees(
        trees["pm25_regressor"],
        {
            "pm10": payload.pm10,
            "no2": payload.no2,
            "so2": payload.so2,
            "co": payload.co,
            "ozone": payload.ozone,
            "nh3": payload.nh3,
            "latitude": payload.latitude,
            "longitude": payload.longitude,
        },
    )
    estimated_pm25 = sum(pm25_preds) / len(pm25_preds)

    effective_pm25 = (
        estimated_pm25
        if (payload.estimatePm25 or payload.pm25 is None)
        else float(payload.pm25)
    )

    aqi_input = {
        "pm25": effective_pm25,
        "pm10": payload.pm10,
        "no2": payload.no2,
        "so2": payload.so2,
        "co": payload.co,
        "ozone": payload.ozone,
        "nh3": payload.nh3,
        "latitude": payload.latitude,
        "longitude": payload.longitude,
    }

    tree_preds = _predict_regressor_trees(trees["aqi_regressor"], aqi_input)
    n_trees = float(len(tree_preds))
    predicted_aqi = sum(tree_preds) / n_trees
    sorted_preds = sorted(tree_preds)
    interval_low = max(0.0, _percentile(sorted_preds, 5.0))
    interval_high = _percentile(sorted_preds, 95.0)
    variance = sum((x - predicted_aqi) ** 2 for x in tree_preds) / n_trees
    tree_std = math.sqrt(variance)

    probs_map = _predict_classifier_trees(trees["aqi_classifier"], aqi_input)
    sorted_probs = sorted(probs_map.items(), key=lambda item: item[1], reverse=True)
    predicted_category = sorted_probs[0][0]
    category_probabilities = {
        lbl: round(prob * 100.0, 1) for lbl, prob in sorted_probs
    }

    spread_penalty = min(28.0, (tree_std / max(25.0, predicted_aqi)) * 100.0)
    confidence_pct = round(max(62.0, min(99.0, 97.5 - spread_penalty)), 1)

    return {
        "effectivePm25": round(effective_pm25, 1),
        "estimatedPm25FromCoPollutants": round(estimated_pm25, 1),
        "pm25WasEstimated": bool(payload.estimatePm25 or payload.pm25 is None),
        "predictedAqi": round(predicted_aqi, 1),
        "intervalLow": round(interval_low, 1),
        "intervalHigh": round(interval_high, 1),
        "treeStd": round(tree_std, 2),
        "predictedCategory": predicted_category,
        "aqiCategoryFromScore": get_aqi_category(predicted_aqi),
        "categoryProbabilities": category_probabilities,
        "confidencePct": confidence_pct,
        "healthGuidance": _health_guidance(predicted_category),
        "modelVersion": trees["metadata"]["modelVersion"],
        "algorithm": trees["metadata"]["algorithm"],
    }


@app.post("/api/predict")
def predict_aqi(payload: PredictRequest, user: dict = Depends(get_current_user)):
    """Execute Random Forest inference and persist the run to prediction_logs."""
    result = _run_random_forest_inference(payload)

    with get_connection(include_db=True) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO prediction_logs (
                    user_id, city, station, pm25, pm10, no2, so2, co, ozone, nh3,
                    latitude, longitude, predicted_aqi, predicted_pm25,
                    predicted_category, confidence_pct, model_version
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    user["id"],
                    payload.city,
                    payload.station,
                    result["effectivePm25"],
                    payload.pm10,
                    payload.no2,
                    payload.so2,
                    payload.co,
                    payload.ozone,
                    payload.nh3,
                    payload.latitude,
                    payload.longitude,
                    result["predictedAqi"],
                    result["estimatedPm25FromCoPollutants"],
                    result["predictedCategory"],
                    result["confidencePct"],
                    result["modelVersion"],
                ),
            )
            log_id = cur.lastrowid

    return {
        "logId": log_id,
        **result,
    }


@app.get("/api/predictions/history")
def prediction_history(
    limit: int = Query(default=20, ge=1, le=100),
    user: dict = Depends(get_current_user),
):
    """Fetch the authenticated user's saved Random Forest prediction runs."""
    with get_connection(include_db=True) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, city, station, pm25, pm10, no2, so2, co, ozone, nh3,
                       latitude, longitude,
                       predicted_aqi AS predictedAqi,
                       predicted_pm25 AS predictedPm25,
                       predicted_category AS predictedCategory,
                       confidence_pct AS confidencePct,
                       model_version AS modelVersion,
                       created_at AS createdAt
                FROM prediction_logs
                WHERE user_id = %s
                ORDER BY created_at DESC, id DESC
                LIMIT %s
                """,
                (user["id"], limit),
            )
            rows = cur.fetchall()

    for r in rows:
        if r["createdAt"] is not None and hasattr(r["createdAt"], "isoformat"):
            r["createdAt"] = r["createdAt"].isoformat()
    return {"history": rows}


@app.get("/api/exposure")
def list_exposure_logs(user: dict = Depends(get_current_user)):
    """Fetch the authenticated user's personal exposure entries from SQL."""
    with get_connection(include_db=True) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, entry_date AS date, city_id AS cityId, activity,
                       duration_minutes AS durationMinutes,
                       estimated_pm25 AS estimatedPm25,
                       inhaled_dose_ug AS inhaledDoseUg
                FROM exposure_logs
                WHERE user_id = %s
                ORDER BY id DESC
                LIMIT 50
                """,
                (user["id"],),
            )
            rows = cur.fetchall()
    return {"entries": rows}


@app.post("/api/exposure", status_code=status.HTTP_201_CREATED)
def create_exposure_log(
    payload: ExposureCreateRequest, user: dict = Depends(get_current_user)
):
    """Persist a personal exposure entry for the authenticated user."""
    with get_connection(include_db=True) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO exposure_logs (
                    user_id, entry_date, city_id, activity,
                    duration_minutes, estimated_pm25, inhaled_dose_ug
                ) VALUES (%s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    user["id"],
                    payload.entryDate,
                    payload.cityId,
                    payload.activity,
                    payload.durationMinutes,
                    payload.estimatedPm25,
                    payload.inhaledDoseUg,
                ),
            )
            entry_id = cur.lastrowid
    return {
        "entry": {
            "id": str(entry_id),
            "date": payload.entryDate,
            "cityId": payload.cityId,
            "activity": payload.activity,
            "durationMinutes": payload.durationMinutes,
            "estimatedPm25": payload.estimatedPm25,
            "inhaledDoseUg": payload.inhaledDoseUg,
        }
    }


@app.delete("/api/exposure/{entry_id}")
def delete_exposure_log(entry_id: int, user: dict = Depends(get_current_user)):
    """Delete an exposure entry owned by the authenticated user."""
    with get_connection(include_db=True) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM exposure_logs WHERE id = %s AND user_id = %s",
                (entry_id, user["id"]),
            )
    return {"ok": True}


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("API_PORT", "8000"))
    uvicorn.run("backend.main:app", host="127.0.0.1", port=port, reload=False)
