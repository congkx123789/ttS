import os
import sys
import time
import sqlite3
import threading
import logging
from collections import OrderedDict
from backend.config import Config

logger = logging.getLogger("db_manager")
logger.setLevel(logging.INFO)
if not logger.handlers:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter(
        "[%(asctime)s] %(levelname)s [db_manager] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    ))
    logger.addHandler(handler)

DATABASE_URL = os.environ.get("DATABASE_URL", "")
USE_LOCAL_SQLITE = os.environ.get("USE_LOCAL_SQLITE", "false").lower() == "true"
if USE_LOCAL_SQLITE:
    DATABASE_URL = ""
USER_DB_PATH = Config.USER_DB_PATH

# Retry & circuit breaker settings
MAX_RETRIES = 3
RETRY_BASE_DELAY = 0.5          # seconds
CIRCUIT_BREAKER_THRESHOLD = 5   # consecutive failures before opening circuit
CIRCUIT_BREAKER_RESET = 30      # seconds before retrying after circuit opens

# Circuit Breaker State
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

# PostgreSQL wrappers
class PgCursorWrapper:
    def __init__(self, pg_cursor, lastrowid=None, conn_wrapper=None):
        self._cur = pg_cursor
        self._lastrowid = lastrowid
        self._conn_wrapper = conn_wrapper

    def execute(self, sql, parameters=None):
        if self._conn_wrapper:
            sql = self._conn_wrapper._translate_sql(sql)
        if parameters:
            self._cur.execute(sql, parameters)
        else:
            self._cur.execute(sql)
        return self

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
    def __init__(self, pg_conn):
        self._conn = pg_conn

    @property
    def row_factory(self):
        return None

    @row_factory.setter
    def row_factory(self, val):
        pass

    def cursor(self):
        import psycopg2.extras
        cursor = self._conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        return PgCursorWrapper(cursor, conn_wrapper=self)

    def execute(self, sql, parameters=None):
        sql_pg = self._translate_sql(sql)
        is_insert = sql_pg.strip().upper().startswith("INSERT")
        if is_insert and "RETURNING" not in sql_pg.upper():
            if "USER_SETTINGS" in sql_pg.upper():
                sql_pg += " RETURNING user_id"
            else:
                sql_pg += " RETURNING id"

        import psycopg2.extras
        cursor = self._conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        sql_upper = sql_pg.upper()
        
        start_time = time.time()
        try:
            if parameters:
                cursor.execute(sql_pg, parameters)
            elif "CREATE TABLE" in sql_upper or "ALTER TABLE" in sql_upper:
                try:
                    cursor.execute("SAVEPOINT sp_ddl")
                    cursor.execute(sql_pg)
                    cursor.execute("RELEASE SAVEPOINT sp_ddl")
                except Exception as e:
                    cursor.execute("ROLLBACK TO SAVEPOINT sp_ddl")
                    cursor.execute("RELEASE SAVEPOINT sp_ddl")
                    raise
            else:
                cursor.execute(sql_pg)
        finally:
            try:
                from backend.core.profiler import record_db_time
                record_db_time(time.time() - start_time)
            except Exception:
                pass

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
        start_time = time.time()
        try:
            self._conn.commit()
        finally:
            try:
                from backend.core.profiler import record_db_time
                record_db_time(time.time() - start_time)
            except Exception:
                pass

    def close(self):
        self._conn.close()

    @staticmethod
    def _translate_sql(sql):
        import re
        if re.search(r"INSERT\s+OR\s+IGNORE\s+INTO\s+bookshelf", sql, re.IGNORECASE):
            sql = re.sub(r"INSERT\s+OR\s+IGNORE\s+INTO", "INSERT INTO", sql, flags=re.IGNORECASE)
            if "ON CONFLICT" not in sql.upper():
                sql += " ON CONFLICT (user_id, book_id) DO NOTHING"
        elif re.search(r"INSERT\s+OR\s+REPLACE\s+INTO\s+bookshelf", sql, re.IGNORECASE):
            sql = re.sub(r"INSERT\s+OR\s+REPLACE\s+INTO", "INSERT INTO", sql, flags=re.IGNORECASE)
            if "ON CONFLICT" not in sql.upper():
                sql += " ON CONFLICT (user_id, book_id) DO UPDATE SET title = EXCLUDED.title, author = EXCLUDED.author, cover = EXCLUDED.cover, url = EXCLUDED.url"
        elif re.search(r"INSERT\s+OR\s+REPLACE\s+INTO\s+reading_history", sql, re.IGNORECASE):
            sql = re.sub(r"INSERT\s+OR\s+REPLACE\s+INTO", "INSERT INTO", sql, flags=re.IGNORECASE)
            if "ON CONFLICT" not in sql.upper():
                if "URL" in sql.upper():
                    sql += " ON CONFLICT (user_id, book_id) DO UPDATE SET title = EXCLUDED.title, author = EXCLUDED.author, cover = EXCLUDED.cover, last_chapter = EXCLUDED.last_chapter, read_date = EXCLUDED.read_date, url = EXCLUDED.url"
                else:
                    sql += " ON CONFLICT (user_id, book_id) DO UPDATE SET title = EXCLUDED.title, author = EXCLUDED.author, cover = EXCLUDED.cover, last_chapter = EXCLUDED.last_chapter, read_date = EXCLUDED.read_date, timestamp = EXCLUDED.timestamp"

        sql_upper = sql.upper()
        if "CREATE TABLE" in sql_upper:
            sql = sql.replace("CREATE TABLE ", "CREATE TABLE IF NOT EXISTS ")
            sql = sql.replace("CREATE TABLE IF NOT EXISTS IF NOT EXISTS",
                              "CREATE TABLE IF NOT EXISTS")
            sql = sql.replace("INTEGER PRIMARY KEY AUTOINCREMENT", "SERIAL PRIMARY KEY")
            sql = sql.replace("DATETIME DEFAULT CURRENT_TIMESTAMP",
                              "TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
            sql = sql.replace("DATETIME", "TIMESTAMP")
        sql = sql.replace('?', '%s')
        return sql

def _try_postgres_connect():
    import psycopg2
    conn = psycopg2.connect(DATABASE_URL, connect_timeout=5)
    return PgConnectionWrapper(conn)

class ProfiledSqliteConnection(sqlite3.Connection):
    def execute(self, sql, *args):
        start_time = time.time()
        try:
            return super().execute(sql, *args)
        finally:
            try:
                from backend.core.profiler import record_db_time
                record_db_time(time.time() - start_time)
            except Exception:
                pass

def _get_sqlite_conn():
    conn = sqlite3.connect(USER_DB_PATH, timeout=10, factory=ProfiledSqliteConnection)
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA synchronous=NORMAL;")
    conn.execute("PRAGMA cache_size=-64000;")
    conn.execute("PRAGMA temp_store=MEMORY;")
    conn.row_factory = sqlite3.Row
    return conn

def get_user_db_conn():
    """Get user database connection with automatic failover."""
    if not DATABASE_URL:
        return _get_sqlite_conn()
    if _is_circuit_open():
        return _get_sqlite_conn()
    
    last_error = None
    for attempt in range(MAX_RETRIES):
        try:
            conn = _try_postgres_connect()
            _record_success()
            return conn
        except Exception as e:
            last_error = e
            delay = RETRY_BASE_DELAY * (2 ** attempt)
            if attempt < MAX_RETRIES - 1:
                logger.warning(
                    f"Supabase connection attempt {attempt + 1}/{MAX_RETRIES} failed: "
                    f"{e}. Retrying in {delay:.1f}s..."
                )
                time.sleep(delay)

    _record_failure()
    logger.error(f"Supabase unreachable: {last_error}. Using SQLite fallback.")
    return _get_sqlite_conn()

def health_check():
    status = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
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

def _init_db_schema_for_conn(conn):
    is_postgres = (type(conn).__name__ == "PgConnectionWrapper")
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
        email_verified INTEGER DEFAULT 0,
        require_password_change INTEGER DEFAULT 0,
        display_name TEXT,
        birthday TEXT,
        gender TEXT,
        bio TEXT,
        avatar_frame TEXT DEFAULT 'default',
        avatar TEXT,
        two_factor INTEGER DEFAULT 0,
        api_balance REAL DEFAULT 0.0,
        user_code TEXT UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    """)
    # Run database migrations for users columns if needed
    if is_postgres:
        # Postgres columns check
        cursor = conn.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'users'")
        columns = [row[0] for row in cursor.fetchall()]
    else:
        # SQLite columns check
        cursor = conn.execute("PRAGMA table_info(users)")
        columns = [row[1] for row in cursor.fetchall()]

    if "email_verified" not in columns:
        conn.execute("ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0")
    if "require_password_change" not in columns:
        conn.execute("ALTER TABLE users ADD COLUMN require_password_change INTEGER DEFAULT 0")
    if "display_name" not in columns:
        conn.execute("ALTER TABLE users ADD COLUMN display_name TEXT")
    if "birthday" not in columns:
        conn.execute("ALTER TABLE users ADD COLUMN birthday TEXT")
    if "gender" not in columns:
        conn.execute("ALTER TABLE users ADD COLUMN gender TEXT")
    if "bio" not in columns:
        conn.execute("ALTER TABLE users ADD COLUMN bio TEXT")
    if "avatar_frame" not in columns:
        conn.execute("ALTER TABLE users ADD COLUMN avatar_frame TEXT DEFAULT 'default'")
    if "avatar" not in columns:
        conn.execute("ALTER TABLE users ADD COLUMN avatar TEXT")
    if "two_factor" not in columns:
        conn.execute("ALTER TABLE users ADD COLUMN two_factor INTEGER DEFAULT 0")
    if "api_balance" not in columns:
        conn.execute("ALTER TABLE users ADD COLUMN api_balance REAL DEFAULT 0.0")
    if "user_code" not in columns:
        conn.execute("ALTER TABLE users ADD COLUMN user_code TEXT")
        # Backfill existing users with random 7-digit codes
        import random, string
        existing_users = conn.execute("SELECT id FROM users WHERE user_code IS NULL").fetchall()
        for u in existing_users:
            while True:
                code = ''.join(random.choices(string.digits, k=7))
                clash = conn.execute("SELECT 1 FROM users WHERE user_code = ?", (code,)).fetchone()
                if not clash:
                    conn.execute("UPDATE users SET user_code = ? WHERE id = ?", (code, u['id']))
                    break

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
    conn.execute("""
    CREATE TABLE IF NOT EXISTS api_keys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        api_key TEXT UNIQUE NOT NULL,
        name TEXT DEFAULT 'Default Key',
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_used_at DATETIME,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )
    """)
    conn.execute("""
    CREATE TABLE IF NOT EXISTS api_usage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        api_key TEXT NOT NULL,
        model TEXT NOT NULL,
        tokens INTEGER DEFAULT 0,
        cost REAL DEFAULT 0.0,
        status_code INTEGER,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (api_key) REFERENCES api_keys(api_key)
    )
    """)
    conn.execute("""
    CREATE TABLE IF NOT EXISTS translation_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        original_text TEXT NOT NULL,
        translated_text TEXT NOT NULL,
        mode TEXT DEFAULT 'fast',
        characters INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )
    """)
    conn.execute("""
    CREATE TABLE IF NOT EXISTS vocabulary (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        original_text TEXT NOT NULL,
        pinyin_or_hanviet TEXT,
        translation TEXT NOT NULL,
        context_sentence TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )
    """)
    conn.execute("""
    CREATE TABLE IF NOT EXISTS user_settings (
        user_id INTEGER PRIMARY KEY,
        theme TEXT DEFAULT 'dark',
        default_language TEXT DEFAULT 'vi',
        auto_read INTEGER DEFAULT 0,
        font_size INTEGER DEFAULT 14,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )
    """)
    conn.execute("""
    CREATE TABLE IF NOT EXISTS usage_tracking (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        source TEXT NOT NULL,
        action TEXT NOT NULL,
        duration INTEGER DEFAULT 0,
        mode TEXT DEFAULT 'online',
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )
    """)
    conn.execute("""
    CREATE TABLE IF NOT EXISTS friendships (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        friend_id INTEGER NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (friend_id) REFERENCES users(id),
        UNIQUE(user_id, friend_id)
    )
    """)
    conn.execute("""
    CREATE TABLE IF NOT EXISTS direct_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender_id INTEGER NOT NULL,
        receiver_id INTEGER NOT NULL,
        message TEXT NOT NULL,
        is_read INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sender_id) REFERENCES users(id),
        FOREIGN KEY (receiver_id) REFERENCES users(id)
    )
    """)
    conn.execute("""
    CREATE TABLE IF NOT EXISTS personal_notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        sender_id INTEGER,
        type TEXT NOT NULL,
        message TEXT NOT NULL,
        related_id INTEGER,
        is_read INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (sender_id) REFERENCES users(id)
    )
    """)

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
        ("api_balance", "REAL DEFAULT 0.0"),
    ]
    for col_name, col_type in new_user_cols:
        try:
            conn.execute(f"ALTER TABLE users ADD COLUMN {col_name} {col_type}")
        except Exception:
            pass

    conn.execute("CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)")
    conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_user_code ON users(user_code)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_reading_history_user_id ON reading_history(user_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_reading_history_url ON reading_history(url)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_bookshelf_user_id ON bookshelf(user_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_translation_history_user_id ON translation_history(user_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_vocabulary_user_id ON vocabulary(user_id)")

    conn.execute("""
    CREATE TABLE IF NOT EXISTS sects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE,
        slogan TEXT,
        announcement TEXT,
        badge TEXT,
        leader_id INTEGER,
        level INTEGER DEFAULT 1,
        contribution INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    """)
    conn.execute("""
    CREATE TABLE IF NOT EXISTS sect_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sect_id INTEGER,
        user_id INTEGER UNIQUE,
        role TEXT DEFAULT 'member',
        contribution INTEGER DEFAULT 0,
        joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sect_id) REFERENCES sects(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
    )
    """)
    conn.execute("""
    CREATE TABLE IF NOT EXISTS sect_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sect_id INTEGER,
        sender_id INTEGER,
        message TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sect_id) REFERENCES sects(id),
        FOREIGN KEY (sender_id) REFERENCES users(id)
    )
    """)
    conn.execute("""
    CREATE TABLE IF NOT EXISTS sect_join_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sect_id INTEGER,
        user_id INTEGER,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sect_id) REFERENCES sects(id),
        FOREIGN KEY (user_id) REFERENCES users(id),
        UNIQUE(sect_id, user_id)
    )
    """)
    conn.execute("""
    CREATE TABLE IF NOT EXISTS sect_books (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sect_id INTEGER,
        book_id INTEGER,
        added_by INTEGER,
        added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sect_id) REFERENCES sects(id),
        FOREIGN KEY (added_by) REFERENCES users(id),
        UNIQUE(sect_id, book_id)
    )
    """)

    conn.execute("""
    CREATE TABLE IF NOT EXISTS sect_chat_groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sect_id INTEGER,
        name TEXT,
        creator_id INTEGER,
        members_csv TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sect_id) REFERENCES sects(id),
        FOREIGN KEY (creator_id) REFERENCES users(id)
    )
    """)

    conn.execute("""
    CREATE TABLE IF NOT EXISTS book_comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        book_id INTEGER NOT NULL,
        user_id INTEGER,
        is_anonymous INTEGER DEFAULT 0,
        content_ciphertext TEXT NOT NULL,
        encrypted_aes_key TEXT NOT NULL,
        aes_nonce TEXT NOT NULL,
        aes_tag TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    """)


    try:
        conn.execute("ALTER TABLE sects ADD COLUMN announcement TEXT")
    except Exception:
        pass

    for col_name, col_type in [("chat_type", "TEXT DEFAULT 'general'"), ("target_id", "INTEGER"), ("group_id", "INTEGER")]:
        try:
            conn.execute(f"ALTER TABLE sect_messages ADD COLUMN {col_name} {col_type}")
        except Exception:
            pass

    conn.execute("CREATE INDEX IF NOT EXISTS idx_sect_members_sect_id ON sect_members(sect_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_sect_members_user_id ON sect_members(user_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_sect_messages_sect_id ON sect_messages(sect_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_sect_books_sect_id ON sect_books(sect_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_sect_join_requests_sect_id ON sect_join_requests(sect_id)")

    conn.commit()


def init_user_db():
    conn = get_user_db_conn()
    try:
        _init_db_schema_for_conn(conn)
        logger.info("✔ Database initialized successfully.")
    except Exception as e:
        logger.error(f"❌ Database initialization failed: {e}")
        raise
    finally:
        conn.close()

    is_postgres = (type(conn).__name__ == "PgConnectionWrapper")
    if is_postgres:
        try:
            sqlite_conn = sqlite3.connect(USER_DB_PATH)
            sqlite_conn.row_factory = sqlite3.Row
            _init_db_schema_for_conn(sqlite_conn)
            sqlite_conn.close()
            logger.info("✔ SQLite fallback database synchronized successfully.")
        except Exception as sqlite_err:
            logger.warning(f"⚠️ Could not synchronize SQLite fallback database schema: {sqlite_err}")

# ---------------------------------------------------------------------------
# Books SQLite databases thread local caching
# ---------------------------------------------------------------------------
thread_local = threading.local()

class SimpleCache:
    def __init__(self, maxsize=500):
        self.cache = OrderedDict()
        self.maxsize = maxsize
        self.lock = threading.Lock()
        
    def get(self, key):
        with self.lock:
            if key in self.cache:
                self.cache.move_to_end(key)
                return self.cache[key]
            return None
        
    def set(self, key, value):
        with self.lock:
            if key in self.cache:
                self.cache.move_to_end(key)
            self.cache[key] = value
            if len(self.cache) > self.maxsize:
                self.cache.popitem(last=False)

count_cache = SimpleCache(maxsize=1000)
query_cache = SimpleCache(maxsize=1000)
cached_stats = None

def get_db():
    db_path = Config.DB_PATH
    try:
        config_path = os.path.join(Config.ROOT_DIR, "quick_translator", "config.yaml")
        if os.path.exists(config_path):
            import yaml
            with open(config_path, "r", encoding="utf-8") as f:
                config = yaml.safe_load(f)
            mode = config.get("translation", {}).get("mode", "advanced")
            candidate_db = os.path.join(Config.ROOT_DIR, f"merged_books_{mode}.db")
            if os.path.exists(candidate_db):
                db_path = candidate_db
    except Exception as e:
        print(f"[WARNING] Error loading dynamic database path: {e}")
        
    if not hasattr(thread_local, "connections"):
        thread_local.connections = {}
        
    if db_path not in thread_local.connections:
        conn = sqlite3.connect(db_path, factory=ProfiledSqliteConnection)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute("PRAGMA cache_size=-30000;")
        conn.execute("PRAGMA temp_store=MEMORY;")
        conn.execute("PRAGMA mmap_size=268435456;")
        conn.execute("PRAGMA synchronous=OFF;")
        try:
            conn.execute("CREATE INDEX IF NOT EXISTS idx_categories ON books(categories);")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_chapters_max ON books(chapters_max);")
        except Exception:
            pass
        thread_local.connections[db_path] = conn
        
    return thread_local.connections[db_path]

def get_mode_connection(db_path):
    if not hasattr(thread_local, "connections"):
        thread_local.connections = {}
        
    if db_path not in thread_local.connections:
        if os.path.exists(db_path):
            conn = sqlite3.connect(db_path, factory=ProfiledSqliteConnection)
            conn.row_factory = sqlite3.Row
            conn.execute("PRAGMA journal_mode=WAL;")
            conn.execute("PRAGMA cache_size=-10000;")
            conn.execute("PRAGMA temp_store=MEMORY;")
            conn.execute("PRAGMA mmap_size=134217728;")
            conn.execute("PRAGMA synchronous=OFF;")
            thread_local.connections[db_path] = conn
        else:
            return None
            
    return thread_local.connections[db_path]
