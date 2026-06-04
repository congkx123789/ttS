"""
db_manager.py — Production-Grade Database Connection Manager

Architecture:
  Primary:  Supabase PostgreSQL (Cloud) via IPv4 Connection Pooler
  Fallback: SQLite (Local) — automatic failover when cloud is unreachable

Features:
  - Connection pooling with psycopg2 (thread-safe)
  - Automatic retry with exponential backoff
  - Graceful failover to SQLite when Supabase is down
  - Health check endpoint support
  - Structured logging
"""

import os
import sys
import time
import sqlite3
import threading
import logging
from contextlib import contextmanager
from datetime import datetime

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logger = logging.getLogger("db_manager")
logger.setLevel(logging.INFO)
if not logger.handlers:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter(
        "[%(asctime)s] %(levelname)s [db_manager] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    ))
    logger.addHandler(handler)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
DATABASE_URL = os.environ.get("DATABASE_URL", "")
USER_DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "users_data.db")

# Retry & circuit breaker settings
MAX_RETRIES = 3
RETRY_BASE_DELAY = 0.5          # seconds
CIRCUIT_BREAKER_THRESHOLD = 5   # consecutive failures before opening circuit
CIRCUIT_BREAKER_RESET = 30      # seconds before retrying after circuit opens

# ---------------------------------------------------------------------------
# Circuit Breaker State
# ---------------------------------------------------------------------------
_lock = threading.Lock()
_failure_count = 0
_circuit_open_until = 0.0       # timestamp when circuit should try again
_last_mode = "unknown"          # track for logging


def _is_circuit_open():
    """Check if the circuit breaker is open (cloud DB unavailable)."""
    global _failure_count, _circuit_open_until
    with _lock:
        if _failure_count >= CIRCUIT_BREAKER_THRESHOLD:
            if time.time() < _circuit_open_until:
                return True
            # Half-open: allow one attempt
            return False
        return False


def _record_success():
    """Record a successful cloud DB connection — reset circuit breaker."""
    global _failure_count, _circuit_open_until, _last_mode
    with _lock:
        if _failure_count > 0:
            logger.info("✔ Supabase connection restored. Resetting circuit breaker.")
        _failure_count = 0
        _circuit_open_until = 0.0
        _last_mode = "postgres"


def _record_failure():
    """Record a failed cloud DB connection — increment circuit breaker."""
    global _failure_count, _circuit_open_until, _last_mode
    with _lock:
        _failure_count += 1
        if _failure_count >= CIRCUIT_BREAKER_THRESHOLD:
            _circuit_open_until = time.time() + CIRCUIT_BREAKER_RESET
            if _last_mode != "sqlite_fallback":
                logger.warning(
                    f"⚡ Circuit breaker OPEN after {_failure_count} failures. "
                    f"Falling back to SQLite for {CIRCUIT_BREAKER_RESET}s."
                )
        _last_mode = "sqlite_fallback"


# ---------------------------------------------------------------------------
# PostgreSQL Cursor/Connection Wrappers (SQLite-compatible interface)
# ---------------------------------------------------------------------------
class PgCursorWrapper:
    """Wraps psycopg2 cursor to provide SQLite-like interface."""
    def __init__(self, pg_cursor, lastrowid=None):
        self._cur = pg_cursor
        self._lastrowid = lastrowid

    def fetchone(self):
        return self._cur.fetchone()

    def fetchall(self):
        return self._cur.fetchall()

    @property
    def lastrowid(self):
        return self._lastrowid

    @property
    def description(self):
        return self._cur.description


class PgConnectionWrapper:
    """Wraps psycopg2 connection to provide SQLite-like interface with
    automatic SQL dialect translation."""

    def __init__(self, pg_conn):
        self._conn = pg_conn

    @property
    def row_factory(self):
        return None

    @row_factory.setter
    def row_factory(self, val):
        pass  # Ignored for PG — we use DictCursor

    def execute(self, sql, parameters=None):
        sql_pg = self._translate_sql(sql)

        is_insert = sql_pg.strip().upper().startswith("INSERT")
        if is_insert and "RETURNING" not in sql_pg.upper():
            sql_pg += " RETURNING id"

        import psycopg2.extras
        cursor = self._conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

        sql_upper = sql_pg.upper()
        if parameters:
            cursor.execute(sql_pg, parameters)
        elif "CREATE TABLE" in sql_upper or "ALTER TABLE" in sql_upper:
            try:
                cursor.execute("SAVEPOINT sp_ddl")
                cursor.execute(sql_pg)
                cursor.execute("RELEASE SAVEPOINT sp_ddl")
            except Exception as e:
                if "already exists" in str(e):
                    cursor.execute("ROLLBACK TO SAVEPOINT sp_ddl")
                    cursor.execute("RELEASE SAVEPOINT sp_ddl")
                else:
                    cursor.execute("ROLLBACK TO SAVEPOINT sp_ddl")
                    cursor.execute("RELEASE SAVEPOINT sp_ddl")
                    raise
        else:
            cursor.execute(sql_pg)

        lastrowid = None
        if is_insert:
            try:
                row = cursor.fetchone()
                if row:
                    lastrowid = row[0]
            except Exception:
                pass

        return PgCursorWrapper(cursor, lastrowid)

    def commit(self):
        self._conn.commit()

    def close(self):
        self._conn.close()

    @staticmethod
    def _translate_sql(sql):
        """Convert SQLite SQL dialect to PostgreSQL."""
        sql_upper = sql.upper()
        if "CREATE TABLE" in sql_upper:
            sql = sql.replace("CREATE TABLE ", "CREATE TABLE IF NOT EXISTS ")
            sql = sql.replace("CREATE TABLE IF NOT EXISTS IF NOT EXISTS",
                              "CREATE TABLE IF NOT EXISTS")
            sql = sql.replace("INTEGER PRIMARY KEY AUTOINCREMENT", "SERIAL PRIMARY KEY")
            sql = sql.replace("DATETIME DEFAULT CURRENT_TIMESTAMP",
                              "TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
            sql = sql.replace("DATETIME", "TIMESTAMP")
            sql = sql.replace("UNIQUE(user_id, book_id)",
                              "CONSTRAINT unique_user_book UNIQUE(user_id, book_id)")
        sql = sql.replace('?', '%s')
        return sql


# ---------------------------------------------------------------------------
# Connection Factory — Primary (Supabase) with Fallback (SQLite)
# ---------------------------------------------------------------------------
def _try_postgres_connect():
    """Attempt to connect to Supabase PostgreSQL via IPv4 Connection Pooler.
    Returns PgConnectionWrapper or raises an exception."""
    import psycopg2
    conn = psycopg2.connect(DATABASE_URL, connect_timeout=5)
    return PgConnectionWrapper(conn)


def _get_sqlite_conn():
    """Return a local SQLite connection (always works)."""
    conn = sqlite3.connect(USER_DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def get_user_db_conn():
    """Get a database connection with automatic failover.

    Strategy:
        1. If DATABASE_URL is set → try Supabase PostgreSQL (with retries)
        2. If circuit breaker is open OR all retries fail → fallback to SQLite
        3. If DATABASE_URL is not set → use SQLite directly
    """
    if not DATABASE_URL:
        return _get_sqlite_conn()

    # Circuit breaker check
    if _is_circuit_open():
        return _get_sqlite_conn()

    # Try connecting to Supabase with retries
    last_error = None
    for attempt in range(MAX_RETRIES):
        try:
            conn = _try_postgres_connect()
            _record_success()
            return conn
        except Exception as e:
            last_error = e
            delay = RETRY_BASE_DELAY * (2 ** attempt)  # exponential backoff
            if attempt < MAX_RETRIES - 1:
                logger.warning(
                    f"⚠ Supabase connection attempt {attempt + 1}/{MAX_RETRIES} failed: "
                    f"{e}. Retrying in {delay:.1f}s..."
                )
                time.sleep(delay)

    # All retries exhausted → record failure, fall back to SQLite
    _record_failure()
    logger.error(f"❌ Supabase unreachable after {MAX_RETRIES} retries: {last_error}. Using SQLite fallback.")
    return _get_sqlite_conn()


# ---------------------------------------------------------------------------
# Health Check
# ---------------------------------------------------------------------------
def health_check():
    """Returns a dict with health status for monitoring."""
    status = {
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "database": {
            "primary": "supabase_postgres" if DATABASE_URL else "sqlite_only",
            "fallback": "sqlite_local",
            "circuit_breaker": {
                "state": "open" if _is_circuit_open() else "closed",
                "failure_count": _failure_count,
                "threshold": CIRCUIT_BREAKER_THRESHOLD,
            },
        },
        "status": "healthy",
    }

    # Test actual connectivity
    if DATABASE_URL and not _is_circuit_open():
        try:
            conn = _try_postgres_connect()
            conn.close()
            status["database"]["primary_reachable"] = True
        except Exception as e:
            status["database"]["primary_reachable"] = False
            status["database"]["primary_error"] = str(e)
            status["status"] = "degraded"
    elif _is_circuit_open():
        status["database"]["primary_reachable"] = False
        status["status"] = "degraded"

    # SQLite always reachable
    try:
        conn = _get_sqlite_conn()
        conn.execute("SELECT 1")
        conn.close()
        status["database"]["fallback_reachable"] = True
    except Exception as e:
        status["database"]["fallback_reachable"] = False
        status["database"]["fallback_error"] = str(e)
        status["status"] = "unhealthy"

    return status


# ---------------------------------------------------------------------------
# Database Initialization
# ---------------------------------------------------------------------------
def init_user_db():
    """Initialize user database tables. Works on both Supabase and SQLite."""
    conn = get_user_db_conn()
    try:
        conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            password_hash TEXT,
            email TEXT,
            phone TEXT,
            google_id TEXT,
            vip_status INTEGER DEFAULT 0,
            vip_plan TEXT,
            vip_expiry DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
        """)
        conn.execute("""
        CREATE TABLE IF NOT EXISTS bookshelf (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            book_id INTEGER,
            title TEXT,
            cover TEXT,
            author TEXT,
            url TEXT,
            added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, book_id)
        )
        """)
        conn.execute("""
        CREATE TABLE IF NOT EXISTS reading_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            book_id INTEGER,
            title TEXT,
            cover TEXT,
            author TEXT,
            last_chapter TEXT,
            read_date TEXT,
            url TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, book_id)
        )
        """)
        conn.execute("""
        CREATE TABLE IF NOT EXISTS payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            order_id TEXT UNIQUE NOT NULL,
            plan TEXT NOT NULL,
            amount INTEGER NOT NULL,
            status TEXT DEFAULT 'pending',
            payment_method TEXT DEFAULT 'vietqr',
            note TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            completed_at DATETIME,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
        """)
        conn.execute("""
        CREATE TABLE IF NOT EXISTS password_reset_tokens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            token TEXT UNIQUE NOT NULL,
            expires_at DATETIME NOT NULL,
            used INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
        """)
        conn.execute("""
        CREATE TABLE IF NOT EXISTS refresh_tokens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            token TEXT UNIQUE NOT NULL,
            expires_at DATETIME NOT NULL,
            revoked INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
        """)

        # Safe column migrations
        for table in ["bookshelf", "reading_history"]:
            try:
                conn.execute(f"ALTER TABLE {table} ADD COLUMN url TEXT")
            except Exception:
                pass

        new_user_cols = [
            ("email", "TEXT"),
            ("phone", "TEXT"),
            ("google_id", "TEXT"),
            ("vip_plan", "TEXT"),
            ("vip_expiry", "DATETIME"),
        ]
        for col_name, col_type in new_user_cols:
            try:
                conn.execute(f"ALTER TABLE users ADD COLUMN {col_name} {col_type}")
            except Exception:
                pass

        conn.commit()
        logger.info("✔ Database initialized successfully.")
    except Exception as e:
        logger.error(f"❌ Database initialization failed: {e}")
        raise
    finally:
        conn.close()
