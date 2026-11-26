from contextlib import contextmanager
import os
from pathlib import Path
import re
import sqlite3
import ssl
import tempfile
import pymysql
from pymysql.cursors import DictCursor
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

_SQLITE_PATH = (
    Path(tempfile.gettempdir()) / "urban_airsense.db"
    if os.getenv("VERCEL")
    else (BASE_DIR / "backend" / "urban_airsense.db")
)
_RESOLVED_MODE: str | None = None
_DB_NAME_PATTERN = re.compile(r"^[A-Za-z0-9_]{1,64}$")


def reset_db_mode_cache() -> None:
    """Reset the cached database mode (useful for automated test isolation)."""
    global _RESOLVED_MODE
    _RESOLVED_MODE = None


def validate_db_identifier(name: str) -> str:
    """Validate SQL database identifier against strict alphanumeric/underscore rules."""
    cleaned = name.strip()
    if not _DB_NAME_PATTERN.fullmatch(cleaned):
        raise ValueError("Invalid database identifier.")
    return cleaned


def is_sqlite_mode() -> bool:
    """Determine whether to use MySQL (default) or serverless SQLite fallback."""
    global _RESOLVED_MODE
    if _RESOLVED_MODE is not None:
        return _RESOLVED_MODE == "sqlite"

    explicit = os.getenv("DB_TYPE", "").strip().lower()
    if explicit == "sqlite":
        _RESOLVED_MODE = "sqlite"
        return True
    if explicit == "mysql":
        _RESOLVED_MODE = "mysql"
        return False

    host = os.getenv("DB_HOST", "127.0.0.1").strip()
    is_cloud = bool(os.getenv("VERCEL") or os.getenv("VERCEL_ENV"))
    if is_cloud and host in ("", "127.0.0.1", "localhost"):
        _RESOLVED_MODE = "sqlite"
        return True

    _RESOLVED_MODE = "mysql"
    return False


def get_db_config(include_db: bool = True) -> dict:
    """Return MySQL connection configuration from environment variables."""
    cfg = {
        "host": os.getenv("DB_HOST", "127.0.0.1"),
        "port": int(os.getenv("DB_PORT", "3306")),
        "user": os.getenv("DB_USER", "root"),
        "password": os.getenv("DB_PASSWORD", ""),
        "charset": "utf8mb4",
        "cursorclass": DictCursor,
        "autocommit": False,
        "connect_timeout": 10,
    }
    if os.getenv("DB_SSL", "").strip().lower() in ("1", "true", "yes", "required"):
        cfg["ssl"] = ssl.create_default_context()
    if include_db:
        cfg["database"] = validate_db_identifier(os.getenv("DB_NAME", "urban_airsense_db"))
    return cfg


class _SQLiteCompatCursor:
    """Thin wrapper making sqlite3 cursor behave like PyMySQL DictCursor."""

    def __init__(self, cur: sqlite3.Cursor):
        self._cur = cur

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        self._cur.close()

    @staticmethod
    def _adapt_sql(query: str) -> str:
        return query.replace("%s", "?")

    def execute(self, query: str, params=None):
        """Execute a single parameterized SQL query."""
        sql = self._adapt_sql(query)
        if params is None:
            self._cur.execute(sql)
        else:
            self._cur.execute(sql, tuple(params))
        return self._cur.rowcount

    def executemany(self, query: str, seq_of_params):
        """Execute a parameterized SQL statement across a sequence of rows."""
        sql = self._adapt_sql(query)
        self._cur.executemany(sql, seq_of_params)
        return self._cur.rowcount

    def fetchone(self):
        """Fetch the next result row as a dict or None."""
        row = self._cur.fetchone()
        return dict(row) if row is not None else None

    def fetchall(self):
        """Fetch all remaining result rows as a list of dicts."""
        return [dict(r) for r in self._cur.fetchall()]

    @property
    def lastrowid(self):
        """Return the last inserted row ID."""
        return self._cur.lastrowid


class _SQLiteCompatConnection:
    """Thin wrapper exposing PyMySQL-style connection methods on sqlite3."""

    def __init__(self, conn: sqlite3.Connection):
        self._conn = conn

    def cursor(self):
        """Return a dict-compatible cursor."""
        return _SQLiteCompatCursor(self._conn.cursor())

    def commit(self):
        """Commit the current transaction."""
        self._conn.commit()

    def rollback(self):
        """Roll back the current transaction."""
        self._conn.rollback()

    def close(self):
        """Close the SQLite connection."""
        self._conn.close()


@contextmanager
def get_connection(include_db: bool = True):
    """Yield a MySQL (or serverless SQLite fallback) connection cleanly."""
    if is_sqlite_mode():
        sqlite_path = Path(os.getenv("SQLITE_DB_PATH", str(_SQLITE_PATH)))
        sqlite_path.parent.mkdir(parents=True, exist_ok=True)
        raw = sqlite3.connect(str(sqlite_path), check_same_thread=False)
        raw.row_factory = sqlite3.Row
        raw.execute("PRAGMA foreign_keys = ON")
        conn = _SQLiteCompatConnection(raw)
    else:
        conn = pymysql.connect(**get_db_config(include_db=include_db))

    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


_SQLITE_DDL = [
    """
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        full_name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        preferred_city TEXT NOT NULL DEFAULT 'chennai',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS user_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token TEXT NOT NULL UNIQUE,
        expires_at TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_session_expires ON user_sessions(expires_at)",
    """
    CREATE TABLE IF NOT EXISTS air_quality_observations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        country TEXT NOT NULL,
        state TEXT NOT NULL,
        city TEXT NOT NULL,
        station TEXT NOT NULL,
        last_update TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        pollutant_id TEXT NOT NULL,
        pollutant_min REAL NULL,
        pollutant_max REAL NULL,
        pollutant_avg REAL NULL
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_obs_city ON air_quality_observations(city)",
    "CREATE INDEX IF NOT EXISTS idx_obs_station ON air_quality_observations(station)",
    """
    CREATE TABLE IF NOT EXISTS station_profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        state TEXT NOT NULL,
        city TEXT NOT NULL,
        station TEXT NOT NULL UNIQUE,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        pm25 REAL NULL,
        pm10 REAL NULL,
        no2 REAL NULL,
        so2 REAL NULL,
        co REAL NULL,
        ozone REAL NULL,
        nh3 REAL NULL,
        actual_aqi REAL NULL,
        aqi_category TEXT NULL
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_station_city ON station_profiles(city)",
    "CREATE INDEX IF NOT EXISTS idx_station_state ON station_profiles(state)",
    """
    CREATE TABLE IF NOT EXISTS prediction_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        city TEXT NOT NULL,
        station TEXT NULL,
        pm25 REAL NOT NULL,
        pm10 REAL NOT NULL,
        no2 REAL NOT NULL,
        so2 REAL NOT NULL,
        co REAL NOT NULL,
        ozone REAL NOT NULL,
        nh3 REAL NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        predicted_aqi REAL NOT NULL,
        predicted_pm25 REAL NULL,
        predicted_category TEXT NOT NULL,
        confidence_pct REAL NOT NULL,
        model_version TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_pred_user_created ON prediction_logs(user_id, created_at)",
    """
    CREATE TABLE IF NOT EXISTS exposure_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        entry_date TEXT NOT NULL,
        city_id TEXT NOT NULL,
        activity TEXT NOT NULL,
        duration_minutes INTEGER NOT NULL,
        estimated_pm25 REAL NOT NULL,
        inhaled_dose_ug REAL NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_exp_user_created ON exposure_logs(user_id, created_at)",
]

_MYSQL_DDL = [
    """
    CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        full_name VARCHAR(120) NOT NULL,
        email VARCHAR(190) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        preferred_city VARCHAR(64) NOT NULL DEFAULT 'chennai',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """,
    """
    CREATE TABLE IF NOT EXISTS user_sessions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        token VARCHAR(128) NOT NULL UNIQUE,
        expires_at DATETIME NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_session_user
            FOREIGN KEY (user_id) REFERENCES users(id)
            ON DELETE CASCADE,
        INDEX idx_session_expires (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """,
    """
    CREATE TABLE IF NOT EXISTS air_quality_observations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        country VARCHAR(64) NOT NULL,
        state VARCHAR(100) NOT NULL,
        city VARCHAR(100) NOT NULL,
        station VARCHAR(255) NOT NULL,
        last_update VARCHAR(64) NOT NULL,
        latitude DOUBLE NOT NULL,
        longitude DOUBLE NOT NULL,
        pollutant_id VARCHAR(20) NOT NULL,
        pollutant_min DOUBLE NULL,
        pollutant_max DOUBLE NULL,
        pollutant_avg DOUBLE NULL,
        INDEX idx_obs_city (city),
        INDEX idx_obs_station (station)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """,
    """
    CREATE TABLE IF NOT EXISTS station_profiles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        state VARCHAR(100) NOT NULL,
        city VARCHAR(100) NOT NULL,
        station VARCHAR(255) NOT NULL UNIQUE,
        latitude DOUBLE NOT NULL,
        longitude DOUBLE NOT NULL,
        pm25 DOUBLE NULL,
        pm10 DOUBLE NULL,
        no2 DOUBLE NULL,
        so2 DOUBLE NULL,
        co DOUBLE NULL,
        ozone DOUBLE NULL,
        nh3 DOUBLE NULL,
        actual_aqi DOUBLE NULL,
        aqi_category VARCHAR(32) NULL,
        INDEX idx_station_city (city),
        INDEX idx_station_state (state)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """,
    """
    CREATE TABLE IF NOT EXISTS prediction_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        city VARCHAR(100) NOT NULL,
        station VARCHAR(255) NULL,
        pm25 DOUBLE NOT NULL,
        pm10 DOUBLE NOT NULL,
        no2 DOUBLE NOT NULL,
        so2 DOUBLE NOT NULL,
        co DOUBLE NOT NULL,
        ozone DOUBLE NOT NULL,
        nh3 DOUBLE NOT NULL,
        latitude DOUBLE NOT NULL,
        longitude DOUBLE NOT NULL,
        predicted_aqi DOUBLE NOT NULL,
        predicted_pm25 DOUBLE NULL,
        predicted_category VARCHAR(32) NOT NULL,
        confidence_pct DOUBLE NOT NULL,
        model_version VARCHAR(64) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_pred_user
            FOREIGN KEY (user_id) REFERENCES users(id)
            ON DELETE CASCADE,
        INDEX idx_pred_user_created (user_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """,
    """
    CREATE TABLE IF NOT EXISTS exposure_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        entry_date VARCHAR(64) NOT NULL,
        city_id VARCHAR(64) NOT NULL,
        activity VARCHAR(32) NOT NULL,
        duration_minutes INT NOT NULL,
        estimated_pm25 DOUBLE NOT NULL,
        inhaled_dose_ug DOUBLE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_exp_user
            FOREIGN KEY (user_id) REFERENCES users(id)
            ON DELETE CASCADE,
        INDEX idx_exp_user_created (user_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """,
]


def _ensure_sqlite_schema() -> None:
    """Create SQLite fallback tables and indexes."""
    with get_connection(include_db=True) as conn:
        with conn.cursor() as cur:
            for ddl in _SQLITE_DDL:
                cur.execute(ddl)


def _ensure_mysql_schema() -> None:
    """Create the MySQL database and tables if they do not exist."""
    db_name = validate_db_identifier(os.getenv("DB_NAME", "urban_airsense_db"))
    with get_connection(include_db=False) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "CREATE DATABASE IF NOT EXISTS `"
                + db_name
                + "` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
            )

    with get_connection(include_db=True) as conn:
        with conn.cursor() as cur:
            for ddl in _MYSQL_DDL:
                cur.execute(ddl)


def ensure_schema() -> None:
    """Create the database and required tables for the active SQL backend."""
    if is_sqlite_mode():
        _ensure_sqlite_schema()
    else:
        _ensure_mysql_schema()
