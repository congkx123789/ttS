import logging
from flask import Flask, request, jsonify, render_template_string, session
from flask_cors import CORS
import sqlite3, math, os, sys, hashlib, re, unicodedata
import bcrypt, jwt, secrets, hmac, time, json, requests
from datetime import datetime, timedelta
from functools import wraps
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from dotenv import load_dotenv
import smtplib, threading
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

load_dotenv(override=True)  # Load variables from .env and override shell defaults

# Structured logging
logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s [%(name)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    stream=sys.stdout,
)
logger = logging.getLogger("server")

# Add quick_translator to path
root_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(os.path.join(root_dir, "quick_translator"))

# Import production database manager
from db_manager import get_user_db_conn, init_user_db, health_check as db_health_check

# Initialize Flask application
app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "tienhiep_lyvuha_secret_key_9988")

# Initialize Compression to reduce JSON response size by ~90%
try:
    from flask_compress import Compress
    Compress(app)
    logger.info("✔ Flask-Compress activated (GZIP/Brotli).")
except ImportError:
    logger.warning("⚠ Flask-Compress not installed. Run: pip install Flask-Compress")

# Dynamic CORS handling supporting Credentials (Cookies/Sessions) for Chrome Extension and Web Frontend
@app.after_request
def handle_cors_and_credentials(response):
    origin = request.headers.get('Origin')
    if origin:
        # Allow localhost, 127.0.0.1, chrome-extension, tienhiep.lyvuha.com, and Firebase Hosting
        if "localhost" in origin or "127.0.0.1" in origin or origin.startswith("chrome-extension://") or "tienhiep.lyvuha.com" in origin or "web.app" in origin or "firebaseapp.com" in origin:
            response.headers['Access-Control-Allow-Origin'] = origin
            response.headers['Access-Control-Allow-Credentials'] = 'true'
            response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, Cookie'
            response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
    return response

root_dir = os.path.dirname(os.path.abspath(__file__))
DB = os.path.join(root_dir, "merged_books.db")
USER_DB = os.path.join(root_dir, "users_data.db")

# =============================================
# Database wrappers are now in db_manager.py
# =============================================

# =============================================
# JWT AUTHENTICATION CONFIG
# =============================================
JWT_SECRET = app.secret_key + "_jwt_v2_secure"
JWT_ALGORITHM = "HS256"
JWT_ACCESS_TOKEN_EXPIRE = timedelta(minutes=30)
JWT_REFRESH_TOKEN_EXPIRE = timedelta(days=7)

# =============================================
# VIP PAYMENT PLANS
# =============================================
VIP_PLANS = {
    "month": {
        "name_vi": "Gói Tháng",
        "name_en": "Monthly Plan",
        "name_zh": "月套餐",
        "price": 50000,      # 50,000 VND
        "duration_days": 30,
        "description_vi": "VIP 1 tháng — Dịch không giới hạn, AI, TTS, EPUB",
        "description_en": "VIP 1 month — Unlimited translation, AI, TTS, EPUB",
        "description_zh": "VIP 1个月 — 无限翻译、AI、TTS、EPUB",
    },
    "year": {
        "name_vi": "Gói Năm (Tiết kiệm 67%)",
        "name_en": "Yearly Plan (Save 67%)",
        "name_zh": "年套餐 (节省67%)",
        "price": 200000,     # 200,000 VND
        "duration_days": 365,
        "description_vi": "VIP 1 năm — Tất cả quyền lợi VIP, ưu đãi tốt nhất",
        "description_en": "VIP 1 year — All VIP benefits, best value",
        "description_zh": "VIP 1年 — 所有VIP权益，最优惠",
    }
}

# =============================================
# PAYMENT GATEWAY CONFIG (PayOS / VietQR)
# =============================================
# Thay đổi thông tin ngân hàng của bạn tại đây:
PAYMENT_CONFIG = {
    "bank_id": os.environ.get("BANK_ID", "MB"),                        # Mã ngân hàng (MB, VCB, TCB, ACB, BIDV, ...)
    "account_no": os.environ.get("BANK_ACCOUNT_NO", "0349717475"),             # Số tài khoản ngân hàng
    "account_name": os.environ.get("BANK_ACCOUNT_NAME", "LY VU HA"),             # Tên chủ tài khoản
    "template": "compact2",                  # Template QR (compact, compact2, qr_only, print)
    # PayOS Config (nếu dùng PayOS API thay vì VietQR thuần):
    "payos_client_id": os.environ.get("PAYOS_CLIENT_ID", ""),                   # Để trống nếu chưa đăng ký PayOS
    "payos_api_key": os.environ.get("PAYOS_API_KEY", ""),
    "payos_checksum_key": os.environ.get("PAYOS_CHECKSUM_KEY", ""),
    "payos_webhook_url": os.environ.get("PAYOS_WEBHOOK_URL", "https://yourdomain.com/api/payment/webhook"),
}

# =============================================
# RATE LIMITING CONFIG
# =============================================
rate_limit_store = {}  # { "action:identifier": { "count": N, "reset_at": timestamp } }
RATE_LIMITS = {
    "login": {"max": 5, "window": 300},       # 5 lần / 5 phút
    "register": {"max": 3, "window": 600},    # 3 lần / 10 phút
    "otp": {"max": 3, "window": 60},          # 3 lần / 1 phút
    "payment": {"max": 10, "window": 600},    # 10 lần / 10 phút
}

def check_rate_limit(action, identifier):
    """Returns True if rate limit exceeded, False if OK."""
    key = f"{action}:{identifier}"
    now = time.time()
    limit = RATE_LIMITS.get(action, {"max": 100, "window": 60})
    
    if key in rate_limit_store:
        entry = rate_limit_store[key]
        if now > entry["reset_at"]:
            rate_limit_store[key] = {"count": 1, "reset_at": now + limit["window"]}
            return False
        if entry["count"] >= limit["max"]:
            return True
        entry["count"] += 1
        return False
    else:
        rate_limit_store[key] = {"count": 1, "reset_at": now + limit["window"]}
        return False

# =============================================
# SMTP EMAIL CONFIG (Password Reset)
# =============================================
SMTP_CONFIG = {
    "host": "smtp.gmail.com",               # Gmail Workspace host
    "port": 587,
    "username": os.environ.get("SMTP_EMAIL", ""), 
    "password": os.environ.get("SMTP_PASSWORD", ""), 
    "from_name": "Novel Translator VIP",
    "enabled": True if os.environ.get("SMTP_PASSWORD") else False
}

def send_email_async(to_email, subject, html_content):
    if not SMTP_CONFIG["enabled"]:
        return
    def _send():
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = f'{SMTP_CONFIG["from_name"]} <{SMTP_CONFIG["username"]}>'
            msg["To"] = to_email
            msg.attach(MIMEText(html_content, "html"))

            server = smtplib.SMTP(SMTP_CONFIG["host"], SMTP_CONFIG["port"])
            server.starttls()
            server.login(SMTP_CONFIG["username"], SMTP_CONFIG["password"])
            server.sendmail(SMTP_CONFIG["username"], to_email, msg.as_string())
            server.quit()
            print(f"📧 Đã gửi email tới {to_email}")
        except Exception as e:
            print(f"❌ Gửi email thất bại: {e}")
            
    threading.Thread(target=_send).start()

# =============================================
# GOOGLE OAUTH 2.0 CONFIG
# =============================================
GOOGLE_OAUTH_CONFIG = {
    "client_id": os.environ.get("GOOGLE_CLIENT_ID", "846826769861-s88vrg8okk1n71im3pv2oruembouklc1.apps.googleusercontent.com"),
    "client_secret": os.environ.get("GOOGLE_CLIENT_SECRET", ""),
    "redirect_uri": "http://localhost:5051/api/auth/google/callback",
    "enabled": True
}

# VIP Validation & Request Limits
VALID_VIP_CODES = {"VIP2026", "ANTIGRAVITY", "PREMIUM_MEMBER", "VIP_TRANSLATOR"}
translation_limit_tracker = {} # Format: { "IP:YYYY-MM-DD": count }

def is_vip_request():
    # 1. Check session state
    if session.get("vip_status") == 1:
        return True
        
    # 2. Check header
    header_key = request.headers.get("X-VIP-Key", "").strip().upper()
    if header_key in VALID_VIP_CODES:
        return True
        
    # 3. Check JSON request body
    try:
        data = request.json or {}
        body_key = data.get("vip_key", "").strip().upper()
        if body_key in VALID_VIP_CODES:
            return True
    except Exception:
        pass
        
    # 4. Check query param
    param_key = request.args.get("vip_key", "").strip().upper()
    if param_key in VALID_VIP_CODES:
        return True
        
    # 5. Check user database record if logged in
    user = get_current_user()
    user_id = user["id"] if user else None
    if user_id:
        try:
            conn = get_user_db_conn()
            conn.row_factory = sqlite3.Row
            user = conn.execute("SELECT vip_status FROM users WHERE id = ?", (user_id,)).fetchone()
            conn.close()
            if user and user["vip_status"] == 1:
                session["vip_status"] = 1
                return True
        except Exception as e:
            print("Lỗi kiểm tra VIP trong DB:", e)
            
    return False

# init_user_db() is now in db_manager.py

# =============================================
# JWT TOKEN HELPERS
# =============================================
def create_access_token(user_id, username, vip_status):
    """Create a short-lived access token (30 min)."""
    payload = {
        "sub": user_id,
        "username": username,
        "vip": vip_status,
        "type": "access",
        "exp": datetime.utcnow() + JWT_ACCESS_TOKEN_EXPIRE,
        "iat": datetime.utcnow()
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id):
    """Create a long-lived refresh token (7 days), stored in DB."""
    token_str = secrets.token_urlsafe(64)
    expires_at = datetime.utcnow() + JWT_REFRESH_TOKEN_EXPIRE
    conn = get_user_db_conn()
    conn.execute(
        "INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)",
        (user_id, token_str, expires_at.strftime("%Y-%m-%d %H:%M:%S"))
    )
    conn.commit()
    conn.close()
    return token_str

def verify_access_token(token):
    """Verify and decode an access token. Returns payload or None."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            return None
        return payload
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return None

def jwt_required(f):
    """Decorator: require valid JWT OR session auth."""
    @wraps(f)
    def decorated(*args, **kwargs):
        # Try JWT first
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
            payload = verify_access_token(token)
            if payload:
                request._jwt_user = {
                    "id": payload["sub"],
                    "username": payload["username"],
                    "vip_status": payload["vip"]
                }
                return f(*args, **kwargs)
        
        # Fall back to session auth
        if "user_id" in session:
            request._jwt_user = {
                "id": session["user_id"],
                "username": session["username"],
                "vip_status": session.get("vip_status", 0)
            }
            return f(*args, **kwargs)
        
        return jsonify({"error": "Authentication required"}), 401
    return decorated

def get_current_user():
    """Get current user from JWT or session."""
    if hasattr(request, '_jwt_user'):
        return request._jwt_user
        
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
        payload = verify_access_token(token)
        if payload:
            return {
                "id": payload["sub"],
                "username": payload["username"],
                "vip_status": payload["vip"]
            }
            
    if "user_id" in session:
        return {
            "id": session["user_id"],
            "username": session["username"],
            "vip_status": session.get("vip_status", 0)
        }
    return None

# =============================================
# PASSWORD HASHING (BCRYPT)
# =============================================
def hash_password(password):
    """Hash password with bcrypt (industry standard)."""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password, hashed):
    """Verify password against bcrypt hash. Also supports legacy SHA-256."""
    # Try bcrypt first
    try:
        if hashed.startswith("$2b$") or hashed.startswith("$2a$"):
            return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))
    except Exception:
        pass
    # Fall back to legacy SHA-256 for old accounts
    legacy_hash = hashlib.sha256(password.encode()).hexdigest()
    return legacy_hash == hashed

def upgrade_password_hash(user_id, password):
    """Upgrade a user's password from SHA-256 to bcrypt."""
    new_hash = hash_password(password)
    conn = get_user_db_conn()
    conn.execute("UPDATE users SET password_hash = ? WHERE id = ?", (new_hash, user_id))
    conn.commit()
    conn.close()

# =============================================
# VIP STATUS HELPERS
# =============================================
def check_vip_expiry(user_id):
    """Check if a user's VIP has expired and deactivate if so."""
    conn = get_user_db_conn()
    user = conn.execute("SELECT vip_status, vip_expiry FROM users WHERE id = ?", (user_id,)).fetchone()
    if user and user["vip_status"] == 1 and user["vip_expiry"]:
        try:
            expiry = datetime.strptime(user["vip_expiry"], "%Y-%m-%d %H:%M:%S")
            if datetime.utcnow() > expiry:
                conn.execute("UPDATE users SET vip_status = 0, vip_plan = NULL WHERE id = ?", (user_id,))
                conn.commit()
                conn.close()
                return False  # VIP expired
        except Exception:
            pass
    conn.close()
    return user["vip_status"] == 1 if user else False

def activate_vip(user_id, plan):
    """Activate VIP for a user based on the plan purchased."""
    plan_info = VIP_PLANS.get(plan)
    if not plan_info:
        return False
    
    conn = get_user_db_conn()
    user = conn.execute("SELECT vip_expiry FROM users WHERE id = ?", (user_id,)).fetchone()
    
    # If user already has active VIP, extend from current expiry
    now = datetime.utcnow()
    if user and user["vip_expiry"]:
        try:
            current_expiry = datetime.strptime(user["vip_expiry"], "%Y-%m-%d %H:%M:%S")
            if current_expiry > now:
                new_expiry = current_expiry + timedelta(days=plan_info["duration_days"])
            else:
                new_expiry = now + timedelta(days=plan_info["duration_days"])
        except Exception:
            new_expiry = now + timedelta(days=plan_info["duration_days"])
    else:
        new_expiry = now + timedelta(days=plan_info["duration_days"])
    
    conn.execute(
        "UPDATE users SET vip_status = 1, vip_plan = ?, vip_expiry = ? WHERE id = ?",
        (plan, new_expiry.strftime("%Y-%m-%d %H:%M:%S"), user_id)
    )
    conn.commit()
    conn.close()
    return True

# get_user_db_conn() is now in db_manager.py

HTML = ""


import threading
import unicodedata
from collections import OrderedDict, defaultdict

# Thread-local storage for keeping SQLite connections open per thread
thread_local = threading.local()

# Simple LRU cache implementation for queries and counts
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

# Caches to avoid redundant expensive DB operations
count_cache = SimpleCache(maxsize=1000)
query_cache = SimpleCache(maxsize=1000)
cached_stats = None

# Simple rate limiter to prevent IP scraping abuse
IP_LIMITS = defaultdict(list)
IP_LIMITS_LOCK = threading.Lock()

def check_ip_rate_limit(ip, max_requests=45, period=60):
    import time
    now = time.time()
    with IP_LIMITS_LOCK:
        if ip not in IP_LIMITS:
            IP_LIMITS[ip] = []
        IP_LIMITS[ip] = [t for t in IP_LIMITS[ip] if now - t < period]
        if len(IP_LIMITS[ip]) >= max_requests:
            return False
        IP_LIMITS[ip].append(now)
        return True

def get_client_ip():
    return request.headers.get("CF-Connecting-IP") or request.headers.get("X-Forwarded-For", "").split(",")[0].strip() or request.remote_addr

def get_db():
    db_path = DB
    try:
        config_path = os.path.join(root_dir, "quick_translator", "config.yaml")
        if os.path.exists(config_path):
            import yaml
            with open(config_path, "r", encoding="utf-8") as f:
                config = yaml.safe_load(f)
            mode = config.get("translation", {}).get("mode", "advanced")
            candidate_db = os.path.join(root_dir, f"merged_books_{mode}.db")
            if os.path.exists(candidate_db):
                db_path = candidate_db
    except Exception as e:
        print(f"[WARNING] Error loading dynamic database path: {e}")
        
    if not hasattr(thread_local, "connections"):
        thread_local.connections = {}
        
    if db_path not in thread_local.connections:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        # Enable high-performance SQLite PRAGMAs
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute("PRAGMA cache_size=-30000;") # 30MB page cache
        conn.execute("PRAGMA temp_store=MEMORY;")
        conn.execute("PRAGMA mmap_size=268435456;") # 256MB memory-mapped file access (lightning fast)
        conn.execute("PRAGMA synchronous=OFF;")
        # Ensure essential indexes exist
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
            conn = sqlite3.connect(db_path)
            conn.row_factory = sqlite3.Row
            conn.execute("PRAGMA journal_mode=WAL;")
            conn.execute("PRAGMA cache_size=-10000;") # 10MB page cache
            conn.execute("PRAGMA temp_store=MEMORY;")
            conn.execute("PRAGMA mmap_size=134217728;") # 128MB mmap
            conn.execute("PRAGMA synchronous=OFF;")
            thread_local.connections[db_path] = conn
        else:
            return None
            
    return thread_local.connections[db_path]

def clean_vietnamese_query(text):
    text = text.replace('đ', 'd').replace('Đ', 'D')
    return "".join(c for c in unicodedata.normalize('NFKD', text) if not unicodedata.combining(c)).lower()

@app.route("/")
def index():
    import os
    index_path = os.path.join(root_dir, "Frontend", "web-reader", "index.html")
    if os.path.exists(index_path):
        with open(index_path, "r", encoding="utf-8") as f:
            return f.read()
    return "Web Reader Frontend not found.", 404

@app.route("/api/stats")
def api_stats():
    global cached_stats
    if cached_stats is None:
        conn = get_db()
        total = conn.execute("SELECT COUNT(*) FROM books").fetchone()[0]
        dups  = conn.execute("SELECT COUNT(*) FROM books WHERE site_count > 1").fetchone()[0]
        cached_stats = {"total": total, "duplicates": dups}
    return jsonify(cached_stats)

@app.route("/api/books")
def api_books():
    ip = get_client_ip()
    if not check_ip_rate_limit(ip, max_requests=45, period=60):
        return jsonify({"error": "Too Many Requests. Bạn đang tìm kiếm quá nhanh, vui lòng đợi 1 phút."}), 429

    q            = request.args.get("q", "").strip()
    category     = request.args.get("category", "").strip()
    source       = request.args.get("source", "").strip()
    dup          = request.args.get("dup", "").strip()
    sort         = request.args.get("sort", "site_count DESC")
    search_field = request.args.get("search_field", "all").strip().lower()
    min_chapters = request.args.get("min_chapters", "").strip()
    page         = max(1, int(request.args.get("page", 1)))
    per_page     = min(int(request.args.get("per_page", 30)), 50)  # Cap at 50 to prevent data dumping

    MAX_PAGES_CEILING = 100
    if page > MAX_PAGES_CEILING:
        return jsonify({"error": "Deep pagination limit reached. Giới hạn tối đa 100 trang kết quả."}), 400

    # Whitelist sort options
    allowed_sorts = {
        "site_count DESC", "chapters_max DESC", "word_count_max DESC", "title ASC", "title DESC", "id ASC"
    }
    if sort not in allowed_sorts:
        sort = "site_count DESC"

    where, params = [], []
    fts_match_expr = None
    has_chinese = False

    # FTS5 for Vietnamese (tokenizes correctly), indexed LIKE for Chinese (CJK single-char tokenization breaks FTS phrase search)
    if q:
        has_chinese = any('\u4e00' <= char <= '\u9fff' for char in q)
        if has_chinese:
            # Chinese character search: use B-Tree LIKE indices
            pq = "%" + q + "%"
            if search_field == "title":
                where.append("title LIKE ?")
                params.append(pq)
            elif search_field == "author":
                where.append("author LIKE ?")
                params.append(pq)
            elif search_field == "description":
                where.append("description LIKE ?")
                params.append(pq)
            else:  # all or fallback
                where.append("(title LIKE ? OR author LIKE ? OR description LIKE ?)")
                params += [pq, pq, pq]
        else:
            # Vietnamese / alphanumeric search: clean query
            q_clean = clean_vietnamese_query(q)
            fts_query = q_clean.replace('"', '').replace("'", '')
            if fts_query:
                if search_field == "title":
                    fts_match_expr = f'title_hanviet_clean:"{fts_query}" OR title_vietphrase_clean:"{fts_query}"'
                elif search_field == "author":
                    fts_match_expr = f'author_hanviet_clean:"{fts_query}"'
                elif search_field == "hanviet":
                    fts_match_expr = f'title_hanviet_clean:"{fts_query}" OR author_hanviet_clean:"{fts_query}"'
                elif search_field == "vietphrase":
                    fts_match_expr = f'title_vietphrase_clean:"{fts_query}"'
                elif search_field == "chinese":
                    where.append("(title LIKE ? OR author LIKE ?)")
                    pq = "%" + q + "%"
                    params += [pq, pq]
                elif search_field == "description":
                    where.append("(description LIKE ? OR description_vietphrase LIKE ? OR description_hanviet LIKE ?)")
                    pq = "%" + q + "%"
                    params += [pq, pq, pq]
                else:  # all fields (default)
                    fts_match_expr = f'title_hanviet_clean:"{fts_query}" OR title_vietphrase_clean:"{fts_query}" OR author_hanviet_clean:"{fts_query}"'

    if category:
        where.append("categories LIKE ?")
        params.append("%" + category + "%")
    if source:
        where.append("sources LIKE ?")
        params.append("%" + source + "%")
    if dup == "multi":
        where.append("site_count >= 2")
    elif dup == "single":
        where.append("site_count = 1")
    if min_chapters:
        try:
            min_ch_val = int(min_chapters)
            where.append("chapters_max >= ?")
            params.append(min_ch_val)
        except ValueError:
            pass

    where_sql = ("WHERE " + " AND ".join(where)) if where else ""

    if fts_match_expr:
        # FTS5 search path with JOIN, relevance ranking, and post-filtering
        cache_key = ("fts_search_v2", fts_match_expr, where_sql, page, per_page, tuple(params), sort, q)
        cached_res = query_cache.get(cache_key)
        if cached_res is not None:
            return jsonify(cached_res)

        conn = get_db()
        # Fetch up to 1000 candidates for Python-side filtering
        query = f"""
            SELECT b.*, f.score
            FROM books b
            JOIN (
                SELECT rowid, bm25(books_fts) AS score
                FROM books_fts
                WHERE books_fts MATCH ?
            ) f ON b.id = f.rowid
            {where_sql}
            LIMIT 1000
        """
        rows = conn.execute(query, [fts_match_expr] + params).fetchall()

        if not rows:
            res_data = {"total": 0, "page": 1, "pages": 1, "books": []}
            query_cache.set(cache_key, res_data)
            return jsonify(res_data)

        # Dynamic threshold calculation based on best candidate score
        scores = [r['score'] for r in rows]
        best_score = min(scores)
        threshold = best_score * 0.28  # 28% of best score (most negative is best)

        has_accents = any(c != clean_vietnamese_query(c) for c in q)

        def clean_text_for_tier(txt):
            if not txt:
                return ""
            txt = txt.replace('đ', 'd').replace('Đ', 'D')
            import unicodedata
            txt = "".join(c for c in unicodedata.normalize('NFKD', txt) if not unicodedata.combining(c)).lower()
            return " ".join(re.sub(r'[^a-z0-9\s]', ' ', txt).split())

        q_clean_tier = clean_text_for_tier(q)
        q_norm = q.lower().strip()

        def get_tier(book):
            t_hv_clean = clean_text_for_tier(book.get('title_hanviet', ''))
            t_vp_clean = clean_text_for_tier(book.get('title_vietphrase', ''))
            if t_hv_clean == q_clean_tier or t_vp_clean == q_clean_tier:
                return 1
            if t_hv_clean.startswith(q_clean_tier) or t_vp_clean.startswith(q_clean_tier):
                return 2
            if q_clean_tier in t_hv_clean or q_clean_tier in t_vp_clean:
                return 3
            return 4

        filtered_books = []
        for r in rows:
            book_dict = dict(r)
            tier = get_tier(book_dict)
            score = book_dict['score']

            # 1. Accent collision check
            if has_accents:
                t_hv = (book_dict.get('title_hanviet') or '').lower()
                t_vp = (book_dict.get('title_vietphrase') or '').lower()
                auth = (book_dict.get('author_hanviet') or '').lower()
                desc = (book_dict.get('description') or '').lower()
                if q_norm not in t_hv and q_norm not in t_vp and q_norm not in auth and q_norm not in desc:
                    continue

            # 2. Score threshold check for Tier 3 and Tier 4 (keeps Tiers 1 and 2 intact)
            if tier in (3, 4) and score > threshold:
                continue

            book_dict['tier'] = tier
            filtered_books.append(book_dict)

        # Sorting
        if sort == "title ASC":
            filtered_books.sort(key=lambda x: (x.get('title_hanviet') or '').lower())
        elif sort == "title DESC":
            filtered_books.sort(key=lambda x: (x.get('title_hanviet') or '').lower(), reverse=True)
        elif sort == "chapters_max DESC":
            filtered_books.sort(key=lambda x: x.get('chapters_max') or 0, reverse=True)
        elif sort == "word_count_max DESC":
            filtered_books.sort(key=lambda x: x.get('word_count_max') or 0, reverse=True)
        else:
            # Default: Tier ASC, FTS5 score ASC, site_count DESC
            filtered_books.sort(key=lambda x: (x['tier'], x['score'], -x['site_count']))

        # Pagination slicing
        total = len(filtered_books)
        pages = max(1, math.ceil(total / per_page))
        offset = (page - 1) * per_page
        books_page = filtered_books[offset : offset + per_page]

        res_data = {"total": total, "page": page, "pages": pages, "books": books_page}
        query_cache.set(cache_key, res_data)
        return jsonify(res_data)

    else:
        # Standard path (no FTS, or non-FTS query)
        order_by_sql = sort
        order_params = []
        if q and has_chinese:
            order_by_sql = f"""
                CASE 
                    WHEN title = ? THEN 1
                    WHEN title LIKE ? THEN 2
                    ELSE 3
                END ASC, {sort}
            """
            order_params = [q, q + "%"]

        # Check cache
        cache_key = (where_sql, order_by_sql, page, per_page, tuple(params), tuple(order_params))
        cached_res = query_cache.get(cache_key)
        if cached_res is not None:
            return jsonify(cached_res)

        # 1. Fetch total count
        count_cache_key = (where_sql, tuple(params))
        total = count_cache.get(count_cache_key)
        if total is None:
            conn = get_db()
            total = conn.execute(
                "SELECT COUNT(*) FROM books " + where_sql, params
            ).fetchone()[0]
            count_cache.set(count_cache_key, total)

        pages = max(1, math.ceil(total / per_page))
        if pages > MAX_PAGES_CEILING:
            pages = MAX_PAGES_CEILING
            total = min(total, MAX_PAGES_CEILING * per_page)

        offset = (page - 1) * per_page

        # 2. Query page rows
        conn = get_db()
        rows = conn.execute(
            "SELECT * FROM books " + where_sql +
            " ORDER BY " + order_by_sql +
            " LIMIT ? OFFSET ?",
            params + order_params + [per_page, offset]
        ).fetchall()

        books = [dict(r) for r in rows]
        res_data = {"total": total, "page": page, "pages": pages, "books": books}
        query_cache.set(cache_key, res_data)
        return jsonify(res_data)

@app.route("/api/book/<int:book_id>/translations")
def api_book_translations(book_id):
    # Paths to the 4 mode-specific databases
    adv_db_path = os.path.join(root_dir, "merged_books_advanced.db")
    fast_db_path = os.path.join(root_dir, "merged_books_fast.db")
    vp_db_path = os.path.join(root_dir, "merged_books_vietphrase.db")
    hv_db_path = os.path.join(root_dir, "merged_books_hanviet.db")
    
    res = {
        "advanced": {"title": None, "desc": None},
        "fast": {"title": None, "desc": None},
        "vietphrase": {"title": None, "desc": None},
        "hanviet": {"title": None, "desc": None}
    }
    
    # Load Advanced
    conn_adv = get_mode_connection(adv_db_path)
    if conn_adv:
        try:
            r = conn_adv.execute("SELECT title_vietphrase, description_vietphrase FROM books WHERE id = ?", (book_id,)).fetchone()
            if r:
                res["advanced"] = {"title": r["title_vietphrase"], "desc": r["description_vietphrase"]}
        except Exception as e:
            print(f"[ERROR] Loading advanced book details: {e}")
            
    # Load Fast
    conn_fast = get_mode_connection(fast_db_path)
    if conn_fast:
        try:
            r = conn_fast.execute("SELECT title_vietphrase, description_vietphrase FROM books WHERE id = ?", (book_id,)).fetchone()
            if r:
                res["fast"] = {"title": r["title_vietphrase"], "desc": r["description_vietphrase"]}
        except Exception as e:
            print(f"[ERROR] Loading fast book details: {e}")
            
    # Load Vietphrase
    conn_vp = get_mode_connection(vp_db_path)
    if conn_vp:
        try:
            r = conn_vp.execute("SELECT title_vietphrase, description_vietphrase FROM books WHERE id = ?", (book_id,)).fetchone()
            if r:
                res["vietphrase"] = {"title": r["title_vietphrase"], "desc": r["description_vietphrase"]}
        except Exception as e:
            print(f"[ERROR] Loading vietphrase book details: {e}")
            
    # Load HanViet
    conn_hv = get_mode_connection(hv_db_path)
    if conn_hv:
        try:
            r = conn_hv.execute("SELECT title_vietphrase, description_vietphrase FROM books WHERE id = ?", (book_id,)).fetchone()
            if r:
                res["hanviet"] = {"title": r["title_vietphrase"], "desc": r["description_vietphrase"]}
        except Exception as e:
            print(f"[ERROR] Loading hanviet book details: {e}")
            
    return jsonify(res)


# ==========================================
# AUTH, BOOKSHELF AND HISTORY APIS
# ==========================================

@app.route("/api/auth/register", methods=["POST"])
def auth_register():
    ip = get_client_ip()
    if check_rate_limit("register", ip):
        return jsonify({"error": "Bạn đã đăng ký quá nhiều lần. Vui lòng thử lại sau 10 phút."}), 429
    
    data = request.json or {}
    username = data.get("username", "").strip().lower()
    password = data.get("password", "")
    email = data.get("email", "").strip().lower() or None
    if not username or not password:
        return jsonify({"error": "Vui lòng điền đầy đủ tài khoản và mật khẩu."}), 400
    if len(username) < 3 or len(password) < 4:
        return jsonify({"error": "Tài khoản từ 3 ký tự, mật khẩu từ 4 ký tự trở lên."}), 400
    
    pw_hash = hash_password(password)  # Bcrypt instead of SHA-256
    try:
        conn = get_user_db_conn()
        conn.execute("INSERT INTO users (username, password_hash, email) VALUES (?, ?, ?)", (username, pw_hash, email))
        conn.commit()
        conn.close()
        
        # Send Welcome Email
        if email:
            welcome_html = f"""
            <h3>Chào mừng {username} đến với Novel Translator VIP!</h3>
            <p>Tài khoản của bạn đã được khởi tạo thành công trên hệ thống của chúng tôi.</p>
            <p>Trân trọng,<br>Đội ngũ hỗ trợ Ly Vu Ha</p>
            """
            send_email_async(email, "Chào mừng bạn đến với Novel Translator VIP!", welcome_html)
            
        return jsonify({"message": "Đăng ký thành công! Hãy đăng nhập."})
    except sqlite3.IntegrityError:
        return jsonify({"error": "Tài khoản này đã tồn tại."}), 400

@app.route("/api/auth/login", methods=["POST"])
def auth_login():
    ip = get_client_ip()
    if check_rate_limit("login", ip):
        return jsonify({"error": "Đăng nhập sai quá nhiều lần. Vui lòng thử lại sau 5 phút."}), 429
    
    data = request.json or {}
    username = data.get("username", "").strip().lower()
    password = data.get("password", "")
    
    conn = get_user_db_conn()
    user = conn.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
    conn.close()
    
    if user and verify_password(password, user["password_hash"]):
        # Auto-upgrade SHA-256 hash to bcrypt on successful login
        if not user["password_hash"].startswith("$2b$"):
            upgrade_password_hash(user["id"], password)
        
        # Check and update VIP expiry status
        check_vip_expiry(user["id"])
        
        # Reload user to get updated vip_status
        conn = get_user_db_conn()
        user = conn.execute("SELECT * FROM users WHERE id = ?", (user["id"],)).fetchone()
        conn.close()
        
        # Set session (for Web UI)
        session["user_id"] = user["id"]
        session["username"] = user["username"]
        session["vip_status"] = user["vip_status"]
        
        # Generate JWT tokens (for API/Extension)
        access_token = create_access_token(user["id"], user["username"], user["vip_status"])
        refresh_token = create_refresh_token(user["id"])
        
        return jsonify({
            "message": "Đăng nhập thành công!",
            "user": {
                "id": user["id"],
                "username": user["username"],
                "vip_status": user["vip_status"],
                "vip_plan": user["vip_plan"],
                "vip_expiry": user["vip_expiry"],
                "email": user["email"]
            },
            "access_token": access_token,
            "refresh_token": refresh_token
        })
    return jsonify({"error": "Sai tài khoản hoặc mật khẩu."}), 401

@app.route("/api/auth/forgot-password", methods=["POST"])
def auth_forgot_password():
    ip = get_client_ip()
    if check_rate_limit("otp", ip):
        return jsonify({"error": "Bạn đã yêu cầu OTP quá nhiều lần. Vui lòng thử lại sau 1 phút."}), 429

    data = request.json or {}
    email = data.get("email", "").strip().lower()
    if not email:
        return jsonify({"error": "Vui lòng nhập email."}), 400

    conn = get_user_db_conn()
    user = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    if not user:
        conn.close()
        return jsonify({"error": "Email không tồn tại trong hệ thống."}), 400

    # Generate 6-digit OTP code using secrets module
    otp_code = f"{secrets.randbelow(900000) + 100000}"
    expires_at = (datetime.utcnow() + timedelta(minutes=10)).strftime("%Y-%m-%d %H:%M:%S")

    # Save to password_reset_tokens
    # First, mark any existing tokens for this user as used/invalidated
    conn.execute("UPDATE password_reset_tokens SET used = 1 WHERE user_id = ?", (user["id"],))
    conn.execute(
        "INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)",
        (user["id"], otp_code, expires_at)
    )
    conn.commit()
    conn.close()

    # Send email
    subject = "Mã OTP khôi phục mật khẩu Novel Translator"
    html_content = f"""
    <h3>Mã OTP khôi phục mật khẩu của bạn</h3>
    <p>Chào bạn,</p>
    <p>Chúng tôi nhận được yêu cầu khôi phục mật khẩu cho tài khoản <strong>{user["username"]}</strong>.</p>
    <p>Mã OTP của bạn là: <strong style="font-size: 1.5rem; color: #4f46e5; letter-spacing: 2px;">{otp_code}</strong></p>
    <p>Mã OTP này có hiệu lực trong 10 phút. Nếu bạn không yêu cầu hành động này, vui lòng bỏ qua email.</p>
    <p>Trân trọng,<br>Đội ngũ hỗ trợ Ly Vu Ha</p>
    """
    send_email_async(email, subject, html_content)

    return jsonify({"message": "Mã OTP đã được gửi về email của bạn."})

@app.route("/api/auth/reset-password", methods=["POST"])
def auth_reset_password():
    data = request.json or {}
    email = data.get("email", "").strip().lower()
    otp = data.get("otp", "").strip()
    new_password = data.get("password", "")

    if not email or not otp or not new_password:
        return jsonify({"error": "Vui lòng nhập đầy đủ email, mã OTP và mật khẩu mới."}), 400

    if len(new_password) < 4:
        return jsonify({"error": "Mật khẩu mới phải từ 4 ký tự trở lên."}), 400

    conn = get_user_db_conn()
    user = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    if not user:
        conn.close()
        return jsonify({"error": "Email không tồn tại trong hệ thống."}), 400

    # Verify OTP token
    now_str = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
    token_entry = conn.execute(
        "SELECT * FROM password_reset_tokens WHERE user_id = ? AND token = ? AND used = 0 AND expires_at > ?",
        (user["id"], otp, now_str)
    ).fetchone()

    if not token_entry:
        conn.close()
        return jsonify({"error": "Mã OTP không đúng hoặc đã hết hạn."}), 400

    # Mark token as used
    conn.execute("UPDATE password_reset_tokens SET used = 1 WHERE id = ?", (token_entry["id"],))

    # Update password
    pw_hash = hash_password(new_password)
    conn.execute("UPDATE users SET password_hash = ? WHERE id = ?", (pw_hash, user["id"]))
    conn.commit()
    conn.close()

    return jsonify({"message": "Đổi mật khẩu thành công! Hãy đăng nhập lại."})

@app.route("/api/auth/google/login")
def auth_google_login():
    """Redirect to Google OAuth2 Consent Screen (Implicit Flow for ID Token)."""
    client_id = GOOGLE_OAUTH_CONFIG.get("client_id")
    redirect_uri = GOOGLE_OAUTH_CONFIG.get("redirect_uri")
    auth_url = f"https://accounts.google.com/o/oauth2/v2/auth?client_id={client_id}&redirect_uri={redirect_uri}&response_type=id_token&scope=email%20profile&nonce=random123&prompt=select_account"
    return redirect(auth_url)

@app.route("/api/auth/google/callback", methods=["GET", "POST"])
def auth_google_callback():
    """Handle Google OAuth 2.0 ID Token verification and login/register."""
    if request.method == "GET":
        # Google redirects here with #id_token=... in the fragment.
        # Server can't read fragments, so we serve a tiny JS page to POST it back.
        return """
        <html><body>
        <script>
            const hash = window.location.hash.substring(1);
            const params = new URLSearchParams(hash);
            const idToken = params.get('id_token');
            if (idToken) {
                fetch('/api/auth/google/callback', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ credential: idToken })
                })
                .then(res => res.json())
                .then(data => {
                    if(data.access_token) {
                        localStorage.setItem('accessToken', data.access_token);
                        localStorage.setItem('user', JSON.stringify(data.user));
                        window.location.href = '/';
                    } else {
                        document.body.innerHTML = "Lỗi đăng nhập: " + (data.error || "Unknown");
                    }
                })
                .catch(err => {
                    document.body.innerHTML = "Lỗi kết nối: " + err;
                });
            } else {
                document.body.innerHTML = "Không tìm thấy token từ Google.";
            }
        </script>
        </body></html>
        """

    """Handle Google OAuth 2.0 ID Token verification and login/register."""
    if not GOOGLE_OAUTH_CONFIG.get("enabled"):
        return jsonify({"error": "Google login is currently disabled."}), 400

    data = request.json or {}
    token = data.get("credential") # Google ID token sent from the client

    if not token:
        return jsonify({"error": "Missing Google ID token."}), 400

    try:
        # Try to verify as ID Token (Web Client / Popup)
        client_id = GOOGLE_OAUTH_CONFIG.get("client_id")
        try:
            idinfo = id_token.verify_oauth2_token(token, google_requests.Request(), client_id)
        except ValueError:
            # Fallback to Access Token (Chrome Extension chrome.identity)
            resp = requests.get(
                "https://www.googleapis.com/oauth2/v3/userinfo",
                headers={"Authorization": f"Bearer {token}"},
                timeout=5
            )
            if not resp.ok:
                return jsonify({"error": "Invalid Google token."}), 401
            idinfo = resp.json()

        email = idinfo.get("email")
        google_id = idinfo.get("sub")
        # Ensure unique username
        base_username = email.split("@")[0].lower() if email else f"google_{google_id[:8]}"
        
        conn = get_user_db_conn()
        
        # Find user by google_id or email
        user = conn.execute("SELECT * FROM users WHERE google_id = ? OR email = ?", (google_id, email)).fetchone()
        
        if not user:
            # Create new user. Find unique username if collision occurs.
            username = base_username
            suffix = 1
            while conn.execute("SELECT 1 FROM users WHERE username = ?", (username,)).fetchone():
                username = f"{base_username}{suffix}"
                suffix += 1
                
            # Random strong password for oauth users
            random_pw = hash_password(secrets.token_urlsafe(32))
            cursor = conn.execute(
                "INSERT INTO users (username, password_hash, email, google_id) VALUES (?, ?, ?, ?)",
                (username, random_pw, email, google_id)
            )
            user_id = cursor.lastrowid
            
            # Send Welcome Email for Google user
            if email:
                welcome_html = f"""
                <h3>Chào mừng {username} đến với Novel Translator VIP!</h3>
                <p>Tài khoản của bạn đã được đăng ký tự động thành công thông qua Google.</p>
                <p>Trân trọng,<br>Đội ngũ hỗ trợ Ly Vu Ha</p>
                """
                send_email_async(email, "Chào mừng bạn đến với Novel Translator VIP!", welcome_html)
        else:
            # Update google_id if matched by email but google_id is missing
            if not user["google_id"]:
                conn.execute("UPDATE users SET google_id = ? WHERE id = ?", (google_id, user["id"]))
            user_id = user["id"]

        conn.commit()
        conn.close()

        # Check and update VIP expiry
        check_vip_expiry(user_id)
        
        # Reload user to get latest state
        conn = get_user_db_conn()
        user = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        conn.close()

        # Set session (for Web UI)
        session["user_id"] = user["id"]
        session["username"] = user["username"]
        session["vip_status"] = user["vip_status"]
        
        # Generate JWT tokens (for API/Extension)
        access_token = create_access_token(user["id"], user["username"], user["vip_status"])
        refresh_token = create_refresh_token(user["id"])
        
        return jsonify({
            "message": "Đăng nhập Google thành công!",
            "user": {
                "id": user["id"],
                "username": user["username"],
                "vip_status": user["vip_status"],
                "vip_plan": user["vip_plan"],
                "vip_expiry": user["vip_expiry"],
                "email": user["email"]
            },
            "access_token": access_token,
            "refresh_token": refresh_token
        })

    except ValueError:
        return jsonify({"error": "Invalid Google token."}), 401
    except Exception as e:
        return jsonify({"error": f"Internal server error: {str(e)}"}), 500

@app.route("/api/auth/refresh", methods=["POST"])
def auth_refresh():
    """Exchange a valid refresh token for a new access token."""
    data = request.json or {}
    refresh_token = data.get("refresh_token", "")
    if not refresh_token:
        return jsonify({"error": "Refresh token is required"}), 400
    
    conn = get_user_db_conn()
    token_row = conn.execute(
        "SELECT * FROM refresh_tokens WHERE token = ? AND revoked = 0", (refresh_token,)
    ).fetchone()
    
    if not token_row:
        conn.close()
        return jsonify({"error": "Invalid refresh token"}), 401
    
    # Check expiry
    try:
        expires_at = datetime.strptime(token_row["expires_at"], "%Y-%m-%d %H:%M:%S")
        if datetime.utcnow() > expires_at:
            conn.execute("UPDATE refresh_tokens SET revoked = 1 WHERE id = ?", (token_row["id"],))
            conn.commit()
            conn.close()
            return jsonify({"error": "Refresh token expired"}), 401
    except Exception:
        conn.close()
        return jsonify({"error": "Invalid token format"}), 401
    
    # Get user
    user = conn.execute("SELECT * FROM users WHERE id = ?", (token_row["user_id"],)).fetchone()
    conn.close()
    
    if not user:
        return jsonify({"error": "User not found"}), 401
    
    check_vip_expiry(user["id"])
    
    # Reload user
    conn = get_user_db_conn()
    user = conn.execute("SELECT * FROM users WHERE id = ?", (user["id"],)).fetchone()
    conn.close()
    
    access_token = create_access_token(user["id"], user["username"], user["vip_status"])
    return jsonify({
        "access_token": access_token,
        "user": {
            "id": user["id"],
            "username": user["username"],
            "vip_status": user["vip_status"],
            "vip_plan": user["vip_plan"],
            "vip_expiry": user["vip_expiry"]
        }
    })

@app.route("/api/auth/logout", methods=["POST"])
def auth_logout():
    # Revoke refresh token if provided
    data = request.json or {}
    refresh_token = data.get("refresh_token", "")
    if refresh_token:
        conn = get_user_db_conn()
        conn.execute("UPDATE refresh_tokens SET revoked = 1 WHERE token = ?", (refresh_token,))
        conn.commit()
        conn.close()
    session.clear()
    return jsonify({"message": "Đã đăng xuất."})

@app.route("/api/auth/me", methods=["GET"])
def auth_me():
    # Try JWT first
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        payload = verify_access_token(auth_header[7:])
        if payload:
            conn = get_user_db_conn()
            user = conn.execute("SELECT * FROM users WHERE id = ?", (payload["sub"],)).fetchone()
            conn.close()
            if user:
                check_vip_expiry(user["id"])
                conn = get_user_db_conn()
                user = conn.execute("SELECT * FROM users WHERE id = ?", (user["id"],)).fetchone()
                conn.close()
                return jsonify({
                    "logged_in": True,
                    "user": {
                        "id": user["id"],
                        "username": user["username"],
                        "vip_status": user["vip_status"],
                        "vip_plan": user["vip_plan"],
                        "vip_expiry": user["vip_expiry"],
                        "email": user["email"]
                    }
                })
    
    # Fall back to session
    if "user_id" in session:
        check_vip_expiry(session["user_id"])
        conn = get_user_db_conn()
        user = conn.execute("SELECT * FROM users WHERE id = ?", (session["user_id"],)).fetchone()
        conn.close()
        if user:
            session["vip_status"] = user["vip_status"]
            return jsonify({
                "logged_in": True,
                "user": {
                    "id": user["id"],
                    "username": user["username"],
                    "vip_status": user["vip_status"],
                    "vip_plan": user["vip_plan"],
                    "vip_expiry": user["vip_expiry"],
                    "email": user["email"]
                }
            })
    return jsonify({"logged_in": False})

# =============================================
# 💳 PAYMENT API — VIP Subscription System
# =============================================

@app.route("/api/payment/plans", methods=["GET"])
def api_payment_plans():
    """Get available VIP plans with pricing."""
    lang = request.args.get("lang", "vi")
    plans = []
    for key, plan in VIP_PLANS.items():
        plans.append({
            "id": key,
            "name": plan.get(f"name_{lang}", plan["name_vi"]),
            "description": plan.get(f"description_{lang}", plan["description_vi"]),
            "price": plan["price"],
            "price_formatted": f"{plan['price']:,}đ".replace(",", "."),
            "duration_days": plan["duration_days"],
        })
    return jsonify({"plans": plans})

@app.route("/api/payment/create", methods=["POST"])
def api_payment_create():
    """Create a new payment order and generate VietQR code."""
    user = get_current_user()
    user_id = user["id"] if user else None
    
    # Also support JWT auth
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        payload = verify_access_token(auth_header[7:])
        if payload:
            user_id = payload["sub"]
    
    if not user_id:
        return jsonify({"error": "Vui lòng đăng nhập để mua VIP."}), 401
    
    ip = get_client_ip()
    if check_rate_limit("payment", ip):
        return jsonify({"error": "Bạn đã tạo quá nhiều đơn hàng. Vui lòng thử lại sau."}), 429
    
    data = request.json or {}
    plan = data.get("plan", "month")
    
    if plan.startswith("topup_"):
        try:
            amount = int(plan.split("_")[1])
            if amount < 10000 or amount > 10000000:
                return jsonify({"error": "Số tiền nạp tối thiểu là 10.000đ và tối đa là 10.000.000đ."}), 400
            plan_info = {
                "name_vi": f"Nạp {amount:,}đ số dư API".replace(",", "."),
                "price": amount,
                "duration_days": 0
            }
        except Exception:
            return jsonify({"error": "Định dạng gói nạp tiền không hợp lệ."}), 400
    else:
        if plan not in VIP_PLANS:
            return jsonify({"error": "Gói VIP không hợp lệ."}), 400
        plan_info = VIP_PLANS[plan]
        amount = plan_info["price"]
    
    # Generate unique numeric order ID for PayOS compatibility (must be integer <= 9007199254740991)
    # Using timestamp + user_id segment to prevent collisions
    order_code_int = int(time.time()) * 1000 + (int(user_id) % 1000)
    order_id = str(order_code_int)
    
    # Save to DB
    conn = get_user_db_conn()
    conn.execute(
        "INSERT INTO payments (user_id, order_id, plan, amount, status) VALUES (?, ?, ?, ?, 'pending')",
        (user_id, order_id, plan, amount)
    )
    conn.commit()
    conn.close()
    
    # Try PayOS Integration first if credentials exist
    payos_data = None
    client_id = PAYMENT_CONFIG.get("payos_client_id")
    api_key = PAYMENT_CONFIG.get("payos_api_key")
    checksum_key = PAYMENT_CONFIG.get("payos_checksum_key")
    
    if client_id and api_key and checksum_key:
        cancel_url = PAYMENT_CONFIG.get("payos_webhook_url").replace("/api/payment/webhook", "") or "http://localhost:5050"
        return_url = PAYMENT_CONFIG.get("payos_webhook_url").replace("/api/payment/webhook", "") or "http://localhost:5050"
        description = f"VIP {plan_info.get('name_vi', 'Premium')}"[:25]
        
        # Sort and build signature string
        raw_str = f"amount={amount}&cancelUrl={cancel_url}&description={description}&orderCode={order_code_int}&returnUrl={return_url}"
        signature = hmac.new(
            checksum_key.encode(), raw_str.encode(), hashlib.sha256
        ).hexdigest()
        
        payload = {
            "orderCode": order_code_int,
            "amount": amount,
            "description": description,
            "cancelUrl": cancel_url,
            "returnUrl": return_url,
            "signature": signature
        }
        
        headers = {
            "x-client-id": client_id,
            "x-api-key": api_key,
            "Content-Type": "application/json"
        }
        
        try:
            r = requests.post(
                "https://api-merchant.payos.vn/v2/payment-requests",
                json=payload,
                headers=headers,
                timeout=10
            )
            res = r.json()
            if r.status_code == 200 and res.get("code") == "00":
                payos_data = res.get("data")
        except Exception as e:
            print(f"[PayOS Request Exception]: {e}")
            
    # Generate QR URL (Using PayOS hosted qrCode if available, else fallback to standard VietQR)
    bank = PAYMENT_CONFIG
    if payos_data and payos_data.get("qrCode"):
        # PayOS provides the raw EMVCo content. We convert it to a visual QR code image
        qr_url = f"https://api.qrserver.com/v1/create-qr-code/?size=250x250&data={requests.utils.quote(payos_data['qrCode'])}"
        checkout_url = payos_data.get("checkoutUrl")
        # Use bank info from PayOS response
        payos_bank = payos_data.get("bin", bank["bank_id"])
        payos_account_no = payos_data.get("accountNumber", bank["account_no"])
        payos_account_name = payos_data.get("accountName", bank["account_name"])
    else:
        transfer_content = order_id
        qr_url = (
            f"https://img.vietqr.io/image/{bank['bank_id']}-{bank['account_no']}-{bank['template']}.png"
            f"?amount={amount}"
            f"&addInfo={transfer_content}"
            f"&accountName={bank['account_name'].replace(' ', '%20')}"
        )
        checkout_url = None
        payos_bank = bank["bank_id"]
        payos_account_no = bank["account_no"]
        payos_account_name = bank["account_name"]
        
    return jsonify({
        "order_id": order_id,
        "plan": plan,
        "amount": amount,
        "amount_formatted": f"{amount:,}đ".replace(",", "."),
        "qr_url": qr_url,
        "checkout_url": checkout_url,
        "bank_info": {
            "bank": payos_bank,
            "account_no": payos_account_no,
            "account_name": payos_account_name,
            "transfer_content": order_id,
        },
        "expires_in": 900,  # QR valid for 15 minutes
        "message": f"Quét mã QR hoặc chuyển khoản {amount:,}đ với nội dung: {order_id}".replace(",", ".")
    })

@app.route("/api/payment/status/<order_id>", methods=["GET"])
def api_payment_status(order_id):
    """Check payment status (for polling from client)."""
    user = get_current_user()
    user_id = user["id"] if user else None
    
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        payload = verify_access_token(auth_header[7:])
        if payload:
            user_id = payload["sub"]
    
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401
    
    conn = get_user_db_conn()
    payment = conn.execute(
        "SELECT * FROM payments WHERE order_id = ? AND user_id = ?", (order_id, user_id)
    ).fetchone()
    conn.close()
    
    if not payment:
        return jsonify({"error": "Không tìm thấy đơn hàng."}), 404
    
    # Check if order is too old (auto-expire after 30 minutes)
    try:
        created = datetime.strptime(payment["created_at"], "%Y-%m-%d %H:%M:%S")
        if payment["status"] == "pending" and (datetime.utcnow() - created).total_seconds() > 1800:
            conn = get_user_db_conn()
            conn.execute("UPDATE payments SET status = 'expired' WHERE id = ?", (payment["id"],))
            conn.commit()
            conn.close()
            return jsonify({"order_id": order_id, "status": "expired"})
    except Exception:
        pass
    
    return jsonify({
        "order_id": order_id,
        "plan": payment["plan"],
        "amount": payment["amount"],
        "status": payment["status"],
        "created_at": payment["created_at"],
        "completed_at": payment["completed_at"]
    })

def verify_payos_webhook_signature(payload_data, expected_signature, checksum_key):
    """Verify PayOS webhook signature using alphabet-sorted query string."""
    sorted_keys = sorted(payload_data.keys())
    parts = []
    for k in sorted_keys:
        v = payload_data[k]
        if v is None or v == "null" or v == "undefined":
            v_str = ""
        elif isinstance(v, list):
            # Sort nested elements if they are dicts
            sorted_list = []
            for item in v:
                if isinstance(item, dict):
                    sorted_item = {sub_k: item[sub_k] for sub_k in sorted(item.keys())}
                    sorted_list.append(sorted_item)
                else:
                    sorted_list.append(item)
            v_str = json.dumps(sorted_list, separators=(',', ':'), ensure_ascii=False)
        elif isinstance(v, dict):
            sorted_dict = {sub_k: v[sub_k] for sub_k in sorted(v.keys())}
            v_str = json.dumps(sorted_dict, separators=(',', ':'), ensure_ascii=False)
        else:
            v_str = str(v)
        parts.append(f"{k}={v_str}")
        
    query_str = "&".join(parts)
    computed_sig = hmac.new(
        checksum_key.encode("utf-8"),
        query_str.encode("utf-8"),
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(computed_sig, expected_signature)

@app.route("/api/payment/webhook", methods=["POST"])
def api_payment_webhook():
    """
    Webhook endpoint for PayOS / SePay / manual confirmation.
    When payment gateway confirms a transfer, it calls this endpoint.
    
    PayOS Webhook payload example:
    {
        "code": "00",
        "desc": "success",
        "data": {
            "orderCode": 123456,
            "amount": 50000,
            "description": "VIP...",
            "accountNumber": "...",
            "reference": "...",
            "transactionDateTime": "..."
        },
        "signature": "..."
    }
    """
    data = request.json or {}
    
    # ---- PayOS format ----
    if "data" in data and "orderCode" in data.get("data", {}):
        order_code = str(data["data"]["orderCode"])
        amount = data["data"].get("amount", 0)
        
        # Verify PayOS signature if checksum_key is configured
        checksum_key = PAYMENT_CONFIG.get("payos_checksum_key", "")
        if checksum_key and "signature" in data:
            if not verify_payos_webhook_signature(data["data"], data.get("signature", ""), checksum_key):
                return jsonify({"error": "Invalid signature"}), 403
        
        return _process_payment_confirmation(order_code, amount)
    
    # ---- SePay / Generic format ----
    if "transferAmount" in data:
        content = data.get("content", "")
        amount = data.get("transferAmount", 0)
        # Extract order_id from transfer content
        import re
        match = re.search(r"(VIP\w+)", content.upper())
        if match:
            return _process_payment_confirmation(match.group(1), amount)
    
    # ---- Manual / simple format ----
    order_id = data.get("order_id", "")
    if order_id:
        return _process_payment_confirmation(order_id, data.get("amount", 0))
    
    return jsonify({"error": "Invalid webhook payload"}), 400

def _process_payment_confirmation(order_id, amount):
    """Internal: confirm a payment and activate VIP."""
    conn = get_user_db_conn()
    payment = conn.execute(
        "SELECT * FROM payments WHERE order_id = ? AND status = 'pending'", (order_id,)
    ).fetchone()
    
    if not payment:
        conn.close()
        return jsonify({"error": "Order not found or already processed"}), 404
    
    # Verify amount matches (allow small tolerance for bank fees)
    if amount > 0 and abs(amount - payment["amount"]) > 100:
        conn.close()
        return jsonify({"error": "Amount mismatch"}), 400
    
    # Mark payment as completed
    now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
    conn.execute(
        "UPDATE payments SET status = 'completed', completed_at = ? WHERE id = ?",
        (now, payment["id"])
    )
    conn.commit()
    conn.close()
    
    # Activate VIP or Topup Balance
    if payment["plan"].startswith("topup_"):
        conn = get_user_db_conn()
        conn.execute(
            "UPDATE users SET api_balance = COALESCE(api_balance, 0.0) + ? WHERE id = ?",
            (payment["amount"], payment["user_id"])
        )
        conn.commit()
        conn.close()
        print(f"[PAYMENT] ✅ API Topup {payment['amount']} VNĐ completed for User #{payment['user_id']}")
        return jsonify({"success": True, "message": f"Nạp thành công {payment['amount']:,}đ vào số dư API!".replace(",", ".")})
    else:
        activate_vip(payment["user_id"], payment["plan"])
        
        # Update session if the user is currently logged in
        if session.get("user_id") == payment["user_id"]:
            session["vip_status"] = 1
        
        print(f"[PAYMENT] ✅ Order {order_id} completed — User #{payment['user_id']} → VIP {payment['plan']}")
        return jsonify({"success": True, "message": "Payment confirmed, VIP activated!"})

@app.route("/api/payment/confirm-manual", methods=["POST"])
def api_payment_confirm_manual():
    """
    Admin endpoint: Manually confirm a payment.
    Used when PayOS webhook is not set up yet, or for manual bank transfer checking.
    Requires admin authentication (simple shared secret for now).
    """
    data = request.json or {}
    admin_key = data.get("admin_key", "")
    order_id = data.get("order_id", "")
    
    # Simple admin auth — change this to a secure key
    ADMIN_KEY = os.environ.get("ADMIN_PAYMENT_KEY", "LYVUHA_ADMIN_2026")
    if admin_key != ADMIN_KEY:
        return jsonify({"error": "Unauthorized"}), 403
    
    if not order_id:
        return jsonify({"error": "order_id is required"}), 400
    
    return _process_payment_confirmation(order_id, 0)

@app.route("/api/payment/history", methods=["GET"])
def api_payment_history():
    """Get payment history for the current user."""
    user = get_current_user()
    user_id = user["id"] if user else None
    
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        payload = verify_access_token(auth_header[7:])
        if payload:
            user_id = payload["sub"]
    
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401
    
    conn = get_user_db_conn()
    payments = conn.execute(
        "SELECT order_id, plan, amount, status, created_at, completed_at FROM payments WHERE user_id = ? ORDER BY created_at DESC LIMIT 20",
        (user_id,)
    ).fetchall()
    conn.close()
    
    return jsonify({
        "payments": [dict(p) for p in payments]
    })

@app.route("/api/user/vip-status", methods=["GET"])
def api_user_vip_status():
    """Get detailed VIP status for current user."""
    user = get_current_user()
    user_id = user["id"] if user else None
    
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        payload = verify_access_token(auth_header[7:])
        if payload:
            user_id = payload["sub"]
    
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401
    
    # Check and update VIP expiry
    is_vip = check_vip_expiry(user_id)
    
    conn = get_user_db_conn()
    user = conn.execute("SELECT vip_status, vip_plan, vip_expiry FROM users WHERE id = ?", (user_id,)).fetchone()
    conn.close()
    
    if not user:
        return jsonify({"error": "User not found"}), 404
    
    days_remaining = 0
    if user["vip_expiry"]:
        try:
            expiry = datetime.strptime(user["vip_expiry"], "%Y-%m-%d %H:%M:%S")
            delta = expiry - datetime.utcnow()
            days_remaining = max(0, delta.days)
        except Exception:
            pass
    
    return jsonify({
        "vip_status": user["vip_status"],
        "vip_plan": user["vip_plan"],
        "vip_expiry": user["vip_expiry"],
        "days_remaining": days_remaining,
        "is_active": user["vip_status"] == 1
    })

@app.route("/api/bookshelf", methods=["GET"])
def get_bookshelf():
    user = get_current_user()
    user_id = user["id"] if user else None
    if not user_id:
        return jsonify({"error": "Vui lòng đăng nhập."}), 401
    
    q = request.args.get("q", "").strip()
    conn = get_user_db_conn()
    rows = conn.execute("SELECT * FROM bookshelf WHERE user_id = ? ORDER BY added_at DESC", (user_id,)).fetchall()
    conn.close()
    
    books = [dict(r) for r in rows]
    if q:
        q_clean = clean_vietnamese_query(q)
        filtered = []
        for b in books:
            title_clean = clean_vietnamese_query(b.get("title", ""))
            author_clean = clean_vietnamese_query(b.get("author", ""))
            if q_clean in title_clean or q_clean in author_clean:
                filtered.append(b)
        return jsonify(filtered)
        
    return jsonify(books)

@app.route("/api/bookshelf/add", methods=["POST"])
def add_bookshelf():
    user = get_current_user()
    user_id = user["id"] if user else None
    if not user_id:
        return jsonify({"error": "Vui lòng đăng nhập."}), 401
        
    data = request.json or {}
    book_id = data.get("book_id")
    if not book_id:
        return jsonify({"error": "Thiếu ID truyện."}), 400
        
    # Standard membership limit checks
    if not is_vip_request():
        conn_check = get_user_db_conn()
        try:
            # Check if book is already in bookshelf to allow updating without blocking
            exists = conn_check.execute("SELECT 1 FROM bookshelf WHERE user_id = ? AND book_id = ?", (user_id, book_id)).fetchone() is not None
            if not exists:
                count = conn_check.execute("SELECT COUNT(*) as cnt FROM bookshelf WHERE user_id = ?", (user_id,)).fetchone()["cnt"]
                if count >= 5:
                    return jsonify({"error": "Tủ sách trực tuyến Standard tối đa 5 truyện. Nâng cấp VIP để lưu trữ không giới hạn!"}), 403
        finally:
            conn_check.close()
        
    main_conn = get_db()
    book = main_conn.execute("SELECT title_vietphrase, author_hanviet, cover FROM books WHERE id = ?", (book_id,)).fetchone()
    if not book:
        return jsonify({"error": "Không tìm thấy truyện."}), 404
        
    title = book["title_vietphrase"] or "Không rõ"
    author = book["author_hanviet"] or "Không rõ"
    cover = book["cover"] or ""
    
    conn = get_user_db_conn()
    try:
        conn.execute(
            "INSERT OR IGNORE INTO bookshelf (user_id, book_id, title, author, cover) VALUES (?, ?, ?, ?, ?)",
            (user_id, book_id, title, author, cover)
        )
        conn.commit()
    finally:
        conn.close()
    return jsonify({"success": True, "message": "Đã thêm vào tủ sách."})

@app.route("/api/bookshelf/remove", methods=["POST"])
def remove_bookshelf():
    user = get_current_user()
    user_id = user["id"] if user else None
    if not user_id:
        return jsonify({"error": "Vui lòng đăng nhập."}), 401
    data = request.json or {}
    book_id = data.get("book_id")
    url = data.get("url")
    if not book_id and not url:
        return jsonify({"error": "Thiếu thông tin truyện để xóa."}), 400
        
    conn = get_user_db_conn()
    if book_id:
        conn.execute("DELETE FROM bookshelf WHERE user_id = ? AND book_id = ?", (user_id, book_id))
    else:
        conn.execute("DELETE FROM bookshelf WHERE user_id = ? AND url = ?", (user_id, url))
    conn.commit()
    conn.close()
    return jsonify({"success": True, "message": "Đã xóa khỏi tủ sách."})

@app.route("/api/history", methods=["GET"])
def get_history():
    user = get_current_user()
    user_id = user["id"] if user else None
    if not user_id:
        return jsonify({"error": "Vui lòng đăng nhập."}), 401
    
    q = request.args.get("q", "").strip()
    conn = get_user_db_conn()
    rows = conn.execute("SELECT * FROM reading_history WHERE user_id = ? ORDER BY timestamp DESC", (user_id,)).fetchall()
    conn.close()
    
    books = [dict(r) for r in rows]
    if q:
        q_clean = clean_vietnamese_query(q)
        books = [b for b in books if q_clean in clean_vietnamese_query(b.get("title", "")) or q_clean in clean_vietnamese_query(b.get("author", ""))]
    
    import time
    struct_now = time.localtime()
    today_str = f"{struct_now.tm_year:04d}-{struct_now.tm_mon:02d}-{struct_now.tm_mday:02d}"
    
    yesterday_t = time.time() - 86400
    struct_y = time.localtime(yesterday_t)
    yesterday_str = f"{struct_y.tm_year:04d}-{struct_y.tm_mon:02d}-{struct_y.tm_mday:02d}"
    
    this_month_prefix = f"{struct_now.tm_year:04d}-{struct_now.tm_mon:02d}"

    groups = {
        "Hôm nay": [],
        "Hôm qua": [],
        "Tháng này": [],
        "Trước đây": []
    }
    
    for b in books:
        r_date = b.get("read_date", "")
        if r_date == today_str:
            groups["Hôm nay"].append(b)
        elif r_date == yesterday_str:
            groups["Hôm qua"].append(b)
        elif r_date.startswith(this_month_prefix):
            groups["Tháng này"].append(b)
        else:
            groups["Trước đây"].append(b)
            
    result_groups = []
    for gname in ["Hôm nay", "Hôm qua", "Tháng này", "Trước đây"]:
        if groups[gname]:
            result_groups.append({
                "group_name": gname,
                "books": groups[gname]
            })
            
    return jsonify(result_groups)

@app.route("/api/history/add", methods=["POST"])
def add_history():
    user = get_current_user()
    user_id = user["id"] if user else None
    if not user_id:
        return jsonify({"error": "Vui lòng đăng nhập."}), 401
        
    data = request.json or {}
    book_id = data.get("book_id")
    last_chapter = data.get("last_chapter", "Chương đầu")
    if not book_id:
        return jsonify({"error": "Thiếu ID truyện."}), 400
        
    main_conn = get_db()
    book = main_conn.execute("SELECT title_vietphrase, author_hanviet, cover FROM books WHERE id = ?", (book_id,)).fetchone()
    if not book:
        return jsonify({"error": "Không tìm thấy truyện."}), 404
        
    title = book["title_vietphrase"] or "Không rõ"
    author = book["author_hanviet"] or "Không rõ"
    cover = book["cover"] or ""
    
    import time
    struct_now = time.localtime()
    today_str = f"{struct_now.tm_year:04d}-{struct_now.tm_mon:02d}-{struct_now.tm_mday:02d}"
    
    conn = get_user_db_conn()
    try:
        conn.execute("""
            INSERT OR REPLACE INTO reading_history (user_id, book_id, title, author, cover, last_chapter, read_date, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        """, (user_id, book_id, title, author, cover, last_chapter, today_str))
        conn.commit()
    finally:
        conn.close()
    return jsonify({"success": True})

@app.route("/api/history/clear", methods=["POST"])
def clear_history():
    user = get_current_user()
    user_id = user["id"] if user else None
    if not user_id:
        return jsonify({"error": "Vui lòng đăng nhập."}), 401
    conn = get_user_db_conn()
    conn.execute("DELETE FROM reading_history WHERE user_id = ?", (user_id,))
    conn.commit()
    conn.close()
    return jsonify({"success": True})


@app.route("/api/extension/sync", methods=["POST"])
def extension_sync():
    user = get_current_user()
    user_id = user["id"] if user else None
    if not user_id:
        return jsonify({"error": "Vui lòng đăng nhập trên website chính."}), 401
        
    data = request.json or {}
    title_zh = data.get("title", "").strip()
    author_zh = data.get("author", "").strip()
    cover = data.get("cover", "").strip()
    last_chapter_zh = data.get("last_chapter", "").strip()
    url = data.get("url", "").strip()
    action = data.get("action", "history")  # "history" or "bookshelf"
    
    if not title_zh and not url:
        return jsonify({"error": "Thiếu thông tin tên truyện hoặc liên kết đường dẫn."}), 400
        
    book = None
    book_id = None
    title_vi = None
    author_vi = None
    
    eng = get_engine()
    
    if not title_zh:
        from urllib.parse import urlparse
        try:
            domain = urlparse(url).netloc
            title_vi = f"Truyện ngoài ({domain})"
        except Exception:
            title_vi = "Truyện ngoài"
        title_zh = title_vi
        author_vi = "Không rõ"
    else:
        # Attempt to match with database
        main_conn = get_db()
        
        # Try direct Chinese title match
        book = main_conn.execute(
            "SELECT id, title_vietphrase, author_hanviet, cover FROM books WHERE title = ? LIMIT 1",
            (title_zh,)
        ).fetchone()
    
    # Logic continues with the values resolved above
    
    if book:
        book_id = book["id"]
        title_vi = book["title_vietphrase"]
        author_vi = book["author_hanviet"]
        if not cover and book["cover"]:
            cover = book["cover"]
    else:
        # Not found in DB, translate title & author dynamically if not already set
        if not title_vi:
            try:
                title_vi = eng.translate(title_zh, multi_option=False)
            except Exception:
                title_vi = title_zh
            
        if not author_vi:
            if author_zh:
                try:
                    author_vi = eng.translate(author_zh, multi_option=False)
                except Exception:
                    author_vi = author_zh
            else:
                author_vi = "Không rõ"
            
    # Always translate chapter title if provided
    last_chapter_vi = "Chương đầu"
    if last_chapter_zh:
        try:
            last_chapter_vi = eng.translate(last_chapter_zh, multi_option=False)
        except Exception:
            last_chapter_vi = last_chapter_zh
            
    # Fallback default values
    if not title_vi:
        title_vi = title_zh
    if not author_vi:
        author_vi = "Không rõ"
        
    import time
    struct_now = time.localtime()
    today_str = f"{struct_now.tm_year:04d}-{struct_now.tm_mon:02d}-{struct_now.tm_mday:02d}"
    
    conn = get_user_db_conn()
    try:
        if action == "bookshelf":
            # Standard membership check: maximum 5 books in bookshelf
            if not is_vip_request():
                exists = False
                if book_id:
                    exists = conn.execute("SELECT 1 FROM bookshelf WHERE user_id = ? AND book_id = ?", (user_id, book_id)).fetchone() is not None
                else:
                    exists = conn.execute("SELECT 1 FROM bookshelf WHERE user_id = ? AND url = ?", (user_id, url)).fetchone() is not None
                
                if not exists:
                    count = conn.execute("SELECT COUNT(*) as cnt FROM bookshelf WHERE user_id = ?", (user_id,)).fetchone()["cnt"]
                    if count >= 5:
                        return jsonify({"error": "Tủ sách trực tuyến Standard tối đa 5 truyện. Nâng cấp VIP để lưu trữ không giới hạn!"}), 403

            # If book_id exists, match on user_id, book_id; else match on user_id, url
            if book_id:
                conn.execute("""
                    INSERT OR REPLACE INTO bookshelf (user_id, book_id, title, author, cover, url)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (user_id, book_id, title_vi, author_vi, cover, url))
            else:
                # We need to make sure we don't duplicate by URL
                existing = conn.execute("SELECT id FROM bookshelf WHERE user_id = ? AND url = ?", (user_id, url)).fetchone()
                if existing:
                    conn.execute("""
                        UPDATE bookshelf SET title = ?, author = ?, cover = ? WHERE id = ?
                    """, (title_vi, author_vi, cover, existing["id"]))
                else:
                    conn.execute("""
                        INSERT INTO bookshelf (user_id, book_id, title, author, cover, url)
                        VALUES (?, NULL, ?, ?, ?, ?)
                    """, (user_id, title_vi, author_vi, cover, url))
            conn.commit()
            msg = "Đã lưu vào Tủ sách!"
        else:
            # history
            if book_id:
                conn.execute("""
                    INSERT OR REPLACE INTO reading_history (user_id, book_id, title, author, cover, last_chapter, read_date, url)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (user_id, book_id, title_vi, author_vi, cover, last_chapter_vi, today_str, url))
            else:
                existing = conn.execute("SELECT id FROM reading_history WHERE user_id = ? AND url = ?", (user_id, url)).fetchone()
                if existing:
                    conn.execute("""
                        UPDATE reading_history 
                        SET title = ?, author = ?, cover = ?, last_chapter = ?, read_date = ?, timestamp = CURRENT_TIMESTAMP
                        WHERE id = ?
                    """, (title_vi, author_vi, cover, last_chapter_vi, today_str, existing["id"]))
                else:
                    conn.execute("""
                        INSERT INTO reading_history (user_id, book_id, title, author, cover, last_chapter, read_date, url)
                        VALUES (?, NULL, ?, ?, ?, ?, ?, ?)
                    """, (user_id, title_vi, author_vi, cover, last_chapter_vi, today_str, url))
            conn.commit()
            msg = "Đã cập nhật Lịch sử!"
    finally:
        conn.close()
        
    return jsonify({
        "success": True,
        "message": msg,
        "matched": book is not None,
        "book_id": book_id,
        "title_vi": title_vi,
        "author_vi": author_vi,
        "last_chapter_vi": last_chapter_vi
    })
engine = None

def get_engine():
    global engine
    if engine is None:
        print("Lazy-loading Vietphrase Engine...")
        from src.engine import VietphraseEngine
        engine = VietphraseEngine()
    return engine

@app.route('/translate', methods=['POST'])
def translate():
    data = request.json
    if not data or 'texts' not in data:
        return jsonify({"error": "Missing 'texts' array"}), 400
    
    texts = data['texts']
    
    # 50-paragraph rate-limit for Standard users
    if not is_vip_request():
        import datetime
        client_ip = get_client_ip()
        today_str = datetime.date.today().isoformat()
        tracker_key = f"{client_ip}:{today_str}"
        
        current_count = translation_limit_tracker.get(tracker_key, 0)
        requested_count = len([t for t in texts if t.strip()])
        
        if current_count + requested_count > 50:
            return jsonify({
                "error": "Hạn mức dịch máy chủ Standard đã hết (50 đoạn/ngày). Vui lòng nâng cấp tài khoản VIP hoặc nhập mã kích hoạt VIP để dịch không giới hạn!"
            }), 403
            
        translation_limit_tracker[tracker_key] = current_count + requested_count
        
    mode = data.get('mode')
    translations = []
    eng = get_engine()
    for text in texts:
        if not text.strip():
            translations.append(text)
        else:
            try:
                trans = eng.translate(text, multi_option=False, mode=mode)
                translations.append(trans)
            except Exception as e:
                print(f"Error translating: {e}")
                translations.append(text)
                
    return jsonify({"translations": translations})


# Admin-configured API Key for VIP users to use AI without entering personal key
ADMIN_GEMINI_KEY = os.environ.get("ADMIN_GEMINI_KEY", "")

@app.route("/api/ai/chat", methods=["POST"])
def ai_chat_proxy():
    if not is_vip_request():
        return jsonify({"error": "Chức năng AI trọn gói chỉ dành cho thành viên VIP. Tài khoản Standard vui lòng tự cấu hình API Key cá nhân trong cài đặt để sử dụng!"}), 403
        
    data = request.json or {}
    messages = data.get("messages", [])
    model = data.get("model", "gemini-1.5-flash")
    prompt = data.get("prompt", "")
    
    if not ADMIN_GEMINI_KEY:
        return jsonify({
            "error": "Máy chủ chưa cấu hình API Key hệ thống của Admin. Thành viên VIP vui lòng tạm thời tự nhập API Key cá nhân trong Cài đặt (Options) để sử dụng!"
        }), 501
        
    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={ADMIN_GEMINI_KEY}"
        
        contents = []
        for msg in messages:
            contents.append({
                "role": "user" if msg.get("role") == "user" else "model",
                "parts": [{"text": msg.get("text", "")}]
            })
            
        payload = {
            "contents": contents,
            "systemInstruction": {
                "parts": [{"text": prompt}]
            }
        }
        
        import requests as py_requests
        res = py_requests.post(url, json=payload, timeout=30)
        if res.status_code != 200:
            return jsonify({"error": f"Gemini API returned error: {res.text}"}), res.status_code
            
        gemini_data = res.json()
        response_text = gemini_data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "Không nhận được phản hồi.")
        return jsonify({"text": response_text})
        
    except Exception as e:
        return jsonify({"error": f"Lỗi xử lý AI Proxy: {str(e)}"}), 500


# ============================================================
# 16. VIP EPUB UTILITIES AND CONVERSION
# ============================================================

def parse_custom_dict_text(dict_text):
    if not dict_text:
        return None
    custom_dict = []
    lines = dict_text.split('\n')
    for line in lines:
        line = line.strip()
        if not line or '=' not in line:
            continue
        parts = line.split('=', 1)
        zh = parts[0].strip()
        vi = parts[1].strip()
        if zh and vi:
            custom_dict.append((zh, vi))
    custom_dict.sort(key=lambda x: len(x[0]), reverse=True)
    return custom_dict

@app.route("/api/epub/translate", methods=["POST"])
def api_epub_translate():
    from flask import send_file
    import epub_tools
    
    if not is_vip_request():
        return jsonify({"error": "Chức năng Dịch EPUB nâng cao chỉ dành cho thành viên VIP!"}), 403
        
    if 'file' not in request.files:
        return jsonify({"error": "Không tìm thấy file EPUB tải lên!"}), 400
        
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "Tên file rỗng!"}), 400
        
    mode = request.form.get("mode", "fast")
    limit_chapters = int(request.form.get("limit_chapters", "-1"))
    clean_styles = request.form.get("clean_styles", "false").lower() == "true"
    strip_images = request.form.get("strip_images", "false").lower() == "true"
    strip_fonts = request.form.get("strip_fonts", "false").lower() == "true"
    custom_dict_text = request.form.get("custom_dict", "").strip()
    
    custom_dict = parse_custom_dict_text(custom_dict_text)
    
    # Save uploaded file to temp path
    temp_dir = tempfile.gettempdir()
    src_path = os.path.join(temp_dir, f"src_{uuid.uuid4().hex}.epub")
    dest_path = os.path.join(temp_dir, f"translated_{uuid.uuid4().hex}.epub")
    
    try:
        file.save(src_path)
        
        # Get translation engine
        eng = get_engine()
        
        # Run translation
        duration = epub_tools.translate_epub_file(
            src_path, dest_path, eng, mode=mode, 
            limit_chapters=limit_chapters, custom_dict=custom_dict, 
            clean_styles=clean_styles, strip_images=strip_images, strip_fonts=strip_fonts
        )
        
        print(f"[VIP EPUB] Translated {file.filename} in {duration:.2f}s in mode {mode}")
        
        # Set output download filename
        base, ext = os.path.splitext(file.filename)
        output_filename = f"{base}_Dich_{mode}{ext}"
        
        return send_file(
            dest_path,
            as_attachment=True,
            download_name=output_filename,
            mimetype="application/epub+zip"
        )
    except Exception as e:
        print(f"[VIP EPUB ERROR] Translate failed: {e}")
        return jsonify({"error": f"Lỗi trong quá trình dịch EPUB: {str(e)}"}), 500
    finally:
        # Cleanup source file
        if os.path.exists(src_path):
            try: os.remove(src_path)
            except: pass


@app.route("/api/epub/convert-txt", methods=["POST"])
def api_epub_convert_txt():
    from flask import send_file
    import epub_tools
    
    if not is_vip_request():
        return jsonify({"error": "Chức năng chuyển đổi truyện sang EPUB chỉ dành cho thành viên VIP!"}), 403
        
    title = request.form.get("title", "Truyện convert").strip()
    author = request.form.get("author", "Vô danh").strip()
    description = request.form.get("description", "").strip()
    split_regex = request.form.get("split_regex", r"第\s*\d+\s*[章|回|节]").strip()
    translate_bool = request.form.get("translate", "false").lower() == "true"
    mode = request.form.get("mode", "fast")
    custom_dict_text = request.form.get("custom_dict", "").strip()
    
    txt_content = ""
    if 'file' in request.files:
        file = request.files['file']
        if file.filename != '':
            txt_content = file.read().decode('utf-8', errors='ignore')
    else:
        txt_content = request.form.get("text", "").strip()
        
    if not txt_content:
        return jsonify({"error": "Nội dung văn bản rỗng!"}), 400
        
    custom_dict = parse_custom_dict_text(custom_dict_text)
    
    temp_dir = tempfile.gettempdir()
    dest_path = os.path.join(temp_dir, f"converted_{uuid.uuid4().hex}.epub")
    
    try:
        eng = get_engine() if translate_bool else None
        
        epub_tools.convert_txt_to_epub(
            txt_content, title, author, split_regex, dest_path,
            description=description, engine=eng, mode=mode if translate_bool else None,
            custom_dict=custom_dict
        )
        
        output_filename = f"{title}.epub"
        
        return send_file(
            dest_path,
            as_attachment=True,
            download_name=output_filename,
            mimetype="application/epub+zip"
        )
    except Exception as e:
        print(f"[VIP EPUB ERROR] Convert TXT failed: {e}")
        return jsonify({"error": f"Lỗi tạo EPUB: {str(e)}"}), 500


@app.route("/api/epub/optimize", methods=["POST"])
def api_epub_optimize():
    from flask import send_file
    import epub_tools
    
    if not is_vip_request():
        return jsonify({"error": "Chức năng Tối ưu hóa EPUB chỉ dành cho thành viên VIP!"}), 403
        
    if 'file' not in request.files:
        return jsonify({"error": "Không tìm thấy file EPUB tải lên!"}), 400
        
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "Tên file rỗng!"}), 400
        
    strip_images = request.form.get("strip_images", "false").lower() == "true"
    strip_fonts = request.form.get("strip_fonts", "false").lower() == "true"
        
    temp_dir = tempfile.gettempdir()
    src_path = os.path.join(temp_dir, f"opt_src_{uuid.uuid4().hex}.epub")
    dest_path = os.path.join(temp_dir, f"opt_dest_{uuid.uuid4().hex}.epub")
    
    try:
        file.save(src_path)
        
        # Optimize means rewriting with clean_styles option without translating
        class MockEngine:
            def translate(self, text, **kwargs): return text
            
        epub_tools.translate_epub_file(
            src_path, dest_path, MockEngine(), mode=None, 
            limit_chapters=-1, custom_dict=None, clean_styles=True,
            strip_images=strip_images, strip_fonts=strip_fonts
        )
        
        base, ext = os.path.splitext(file.filename)
        output_filename = f"{base}_Optimized{ext}"
        
        return send_file(
            dest_path,
            as_attachment=True,
            download_name=output_filename,
            mimetype="application/epub+zip"
        )
    except Exception as e:
        return jsonify({"error": f"Lỗi tối ưu EPUB: {str(e)}"}), 500
    finally:
        if os.path.exists(src_path):
            try: os.remove(src_path)
            except: pass


import tempfile, uuid

def start_email_polling_worker():
    import email_service
    def poll_loop():
        print("🚀 [Email Worker] Starting email polling background thread...")
        while True:
            try:
                email_service.check_bank_emails_and_process()
            except Exception as e:
                print(f"❌ [Email Worker] Error in polling loop: {e}")
            time.sleep(15)  # Poll every 15 seconds
            
    t = threading.Thread(target=poll_loop, daemon=True)
    t.start()


# ============================================================
# 💳 DEVELOPER API GATEWAY & API KEYS SYSTEM (API STORE)
# ============================================================

def require_api_key_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing or invalid Authorization header. Must be 'Bearer sk-tc-...'"}), 401
        
        api_key = auth_header[7:].strip()
        if not api_key.startswith("sk-tc-"):
            return jsonify({"error": "Invalid API key format. Key must start with 'sk-tc-'"}), 401
            
        conn = get_user_db_conn()
        key_record = conn.execute(
            "SELECT k.*, u.api_balance FROM api_keys k JOIN users u ON k.user_id = u.id WHERE k.api_key = ? AND k.status = 'active'", 
            (api_key,)
        ).fetchone()
        
        if not key_record:
            conn.close()
            return jsonify({"error": "API Key not found, inactive, or revoked."}), 401
            
        balance = key_record["api_balance"] if key_record["api_balance"] is not None else 0.0
        if balance <= 0.0:
            conn.close()
            return jsonify({
                "error": f"Tài khoản hết số dư API (Số dư hiện tại: {balance:.2f}đ). Vui lòng nạp thêm tiền tại website để tiếp tục sử dụng."
            }), 402
            
        # Update last_used_at
        now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        conn.execute("UPDATE api_keys SET last_used_at = ? WHERE api_key = ?", (now, api_key))
        conn.commit()
        conn.close()
        
        request.api_key = api_key
        request.api_user_id = key_record["user_id"]
        request.api_balance = balance
        return f(*args, **kwargs)
    return decorated

@app.route('/api/developer/keys', methods=['GET'])
def api_dev_keys_list():
    user = get_current_user()
    if not user:
        return jsonify({"error": "Vui lòng đăng nhập."}), 401
        
    conn = get_user_db_conn()
    keys = conn.execute(
        "SELECT api_key, name, status, created_at, last_used_at FROM api_keys WHERE user_id = ? AND status = 'active' ORDER BY created_at DESC", 
        (user["id"],)
    ).fetchall()
    user_row = conn.execute("SELECT api_balance FROM users WHERE id = ?", (user["id"],)).fetchone()
    conn.close()
    
    balance = user_row["api_balance"] if user_row and user_row["api_balance"] is not None else 0.0
    return jsonify({
        "balance": balance,
        "keys": [dict(k) for k in keys]
    })

@app.route('/api/developer/keys/create', methods=['POST'])
def api_dev_keys_create():
    user = get_current_user()
    if not user:
        return jsonify({"error": "Vui lòng đăng nhập."}), 401
        
    data = request.json or {}
    name = data.get("name", "Default Key").strip()[:50]
    
    import secrets
    new_key = f"sk-tc-{secrets.token_hex(16)}"
    
    conn = get_user_db_conn()
    conn.execute(
        "INSERT INTO api_keys (user_id, api_key, name, status) VALUES (?, ?, ?, 'active')",
        (user["id"], new_key, name)
    )
    conn.commit()
    conn.close()
    
    return jsonify({
        "success": True,
        "api_key": new_key,
        "name": name
    })

@app.route('/api/developer/keys/delete', methods=['POST'])
def api_dev_keys_delete():
    user = get_current_user()
    if not user:
        return jsonify({"error": "Vui lòng đăng nhập."}), 401
        
    data = request.json or {}
    api_key = data.get("api_key", "").strip()
    
    if not api_key:
        return jsonify({"error": "Thiếu API Key cần xóa."}), 400
        
    conn = get_user_db_conn()
    conn.execute(
        "UPDATE api_keys SET status = 'revoked' WHERE user_id = ? AND api_key = ?",
        (user["id"], api_key)
    )
    conn.commit()
    conn.close()
    
    return jsonify({"success": True})

@app.route('/api/developer/usage', methods=['GET'])
def api_dev_usage():
    user = get_current_user()
    if not user:
        return jsonify({"error": "Vui lòng đăng nhập."}), 401
        
    conn = get_user_db_conn()
    keys_rows = conn.execute("SELECT api_key FROM api_keys WHERE user_id = ?", (user["id"],)).fetchall()
    keys = [k["api_key"] for k in keys_rows]
    
    if not keys:
        conn.close()
        return jsonify({"usage": []})
        
    placeholders = ",".join(["?"] * len(keys))
    usage = conn.execute(
        f"SELECT * FROM api_usage WHERE api_key IN ({placeholders}) ORDER BY timestamp DESC LIMIT 100",
        keys
    ).fetchall()
    conn.close()
    
    return jsonify({
        "usage": [dict(u) for u in usage]
    })

def deduct_developer_balance(api_key, amount, model, tokens=0, status_code=200):
    conn = get_user_db_conn()
    try:
        conn.execute(
            "INSERT INTO api_usage (api_key, model, tokens, cost, status_code) VALUES (?, ?, ?, ?, ?)",
            (api_key, model, tokens, amount, status_code)
        )
        conn.execute(
            "UPDATE users SET api_balance = api_balance - ? WHERE id = (SELECT user_id FROM api_keys WHERE api_key = ?)",
            (amount, api_key)
        )
        conn.commit()
    except Exception as e:
        print(f"[API GATEWAY ERROR] Failed to deduct balance: {e}")
    finally:
        conn.close()

# OpenAI-Compatible API: v1/chat/completions (Proxy to Gemini)
@app.route('/v1/chat/completions', methods=['POST'])
@require_api_key_auth
def openai_chat_completions():
    api_key = request.api_key
    data = request.json or {}
    messages = data.get("messages", [])
    model = data.get("model", "gemini-1.5-flash")
    
    if not messages:
        return jsonify({"error": "Missing messages array"}), 400
        
    prompt_length = sum(len(m.get("content", "")) for m in messages)
    cost = max(20.0, prompt_length * 0.02) # Min 20đ, then 0.02đ per character
    
    if request.api_balance < cost:
        return jsonify({"error": f"Số dư không đủ cho yêu cầu này. Chi phí ước tính: {cost:.2f}đ, Số dư hiện tại: {request.api_balance:.2f}đ"}), 402

    if not ADMIN_GEMINI_KEY:
        return jsonify({"error": "Hệ thống dịch chưa được Admin cấu hình khóa Gemini."}), 501
        
    try:
        contents = []
        system_instruction = ""
        
        for msg in messages:
            role = msg.get("role")
            content = msg.get("content", "")
            if role == "system":
                system_instruction = content
            else:
                contents.append({
                    "role": "user" if role == "user" else "model",
                    "parts": [{"text": content}]
                })
                
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={ADMIN_GEMINI_KEY}"
        payload = {
            "contents": contents
        }
        if system_instruction:
            payload["systemInstruction"] = {
                "parts": [{"text": system_instruction}]
            }
            
        import requests as py_requests
        res = py_requests.post(url, json=payload, timeout=30)
        
        if res.status_code != 200:
            deduct_developer_balance(api_key, 0.0, model, prompt_length, res.status_code)
            return jsonify({"error": f"Google Gemini API error: {res.text}"}), res.status_code
            
        gemini_data = res.json()
        response_text = gemini_data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
        
        deduct_developer_balance(api_key, cost, model, prompt_length + len(response_text), 200)
        
        import uuid
        res_id = f"chatcmpl-{uuid.uuid4().hex}"
        return jsonify({
            "id": res_id,
            "object": "chat.completion",
            "created": int(time.time()),
            "model": model,
            "choices": [{
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": response_text
                },
                "finish_reason": "stop"
            }],
            "usage": {
                "prompt_tokens": int(prompt_length / 4),
                "completion_tokens": int(len(response_text) / 4),
                "total_tokens": int((prompt_length + len(response_text)) / 4)
            }
        })
    except Exception as e:
        deduct_developer_balance(api_key, 0.0, model, prompt_length, 500)
        return jsonify({"error": f"API Gateway Exception: {str(e)}"}), 500

# Dedicated translation API
@app.route('/api/v1/translate', methods=['POST'])
@require_api_key_auth
def api_v1_translate():
    api_key = request.api_key
    data = request.json or {}
    texts = data.get("texts", [])
    mode = data.get("mode", "fast")
    
    if not texts:
        return jsonify({"error": "Missing texts array"}), 400
        
    total_chars = sum(len(t) for t in texts)
    cost = total_chars * 0.01 # 0.01đ per character (10.000đ/triệu ký tự)
    
    if request.api_balance < cost:
        return jsonify({"error": f"Số dư không đủ cho yêu cầu này. Chi phí ước tính: {cost:.2f}đ, Số dư hiện tại: {request.api_balance:.2f}đ"}), 402
        
    try:
        eng = get_engine()
        translations = []
        for text in texts:
            if not text.strip():
                translations.append(text)
            else:
                trans = eng.translate(text, multi_option=False, mode=mode)
                translations.append(trans)
                
        deduct_developer_balance(api_key, cost, f"vietphrase-{mode}", total_chars, 200)
        return jsonify({
            "translations": translations,
            "characters": total_chars,
            "cost": cost
        })
    except Exception as e:
        deduct_developer_balance(api_key, 0.0, f"vietphrase-{mode}", total_chars, 500)
        return jsonify({"error": f"Translation Error: {str(e)}"}), 500

# OpenAI-Compatible TTS API: /v1/audio/speech (Proxy to RunPod Serverless / Mock)
@app.route('/v1/audio/speech', methods=['POST'])
@require_api_key_auth
def openai_audio_speech():
    api_key = request.api_key
    data = request.json or {}
    input_text = data.get("input", "").strip()
    response_format = data.get("response_format", "mp3")
    speed = data.get("speed", 1.0)
    
    if not input_text:
        return jsonify({"error": "Missing 'input' text"}), 400
        
    # Cost: 0.1đ per character
    cost = len(input_text) * 0.1
    if request.api_balance < cost:
        return jsonify({"error": f"Số dư không đủ cho yêu cầu này. Chi phí: {cost:.2f}đ"}), 402
        
    runpod_api_key = os.environ.get("RUNPOD_API_TOKEN", os.environ.get("RUNPOD_API_KEY", ""))
    runpod_endpoint_id = os.environ.get("RUNPOD_TTS_ENDPOINT_ID", "")
    
    if runpod_api_key and runpod_endpoint_id:
        try:
            url = f"https://api.runpod.ai/v1/{runpod_endpoint_id}/runsync"
            headers = {
                "Authorization": f"Bearer {runpod_api_key}",
                "Content-Type": "application/json"
            }
            payload = {
                "input": {
                    "text": input_text,
                    "speed": 0.95 / speed
                }
            }
            import requests as py_requests
            r = py_requests.post(url, json=payload, headers=headers, timeout=45)
            res = r.json()
            
            if r.status_code == 200 and res.get("status") == "COMPLETED":
                audio_b64 = res.get("output", {}).get("audio_base64", "")
                if audio_b64:
                    import base64
                    audio_data = base64.b64decode(audio_b64)
                    
                    deduct_developer_balance(api_key, cost, "runpod-matcha-tts", len(input_text), 200)
                    
                    from flask import send_file
                    import io
                    return send_file(
                        io.BytesIO(audio_data),
                        mimetype="audio/wav" if res.get("output", {}).get("format") == "wav" else "audio/mpeg",
                        as_attachment=False
                    )
            
            print(f"[RunPod TTS Error]: {res}")
        except Exception as e:
            print(f"[RunPod TTS exception]: {e}")
            
    return jsonify({
        "error": "Chức năng TTS qua API yêu cầu Admin cấu hình RUNPOD_API_TOKEN và RUNPOD_TTS_ENDPOINT_ID trong file .env."
    }), 501


# =============================================
# HEALTH CHECK ENDPOINT
# =============================================
@app.route('/health', methods=['GET'])
def health_endpoint():
    """Production health check — used by Docker HEALTHCHECK and monitoring."""
    status = db_health_check()
    http_code = 200 if status["status"] in ("healthy", "degraded") else 503
    return jsonify(status), http_code

# Auto-initialize database tables when imported/started
try:
    init_user_db()
except Exception as e:
    logger.error(f"⚠️ Auto database initialization failed: {e}")

# Pre-load translation engine to avoid 15s latency on first request
try:
    logger.info("⏳ Pre-loading Vietphrase Engine (Dictionaries)... This will take ~10 seconds.")
    get_engine()
    logger.info("✅ Vietphrase Engine loaded successfully.")
except Exception as e:
    logger.error(f"⚠️ Failed to pre-load translation engine: {e}")

if __name__ == "__main__":
    if not os.path.exists(DB):
        logger.error(f"Loi: Khong tim thay {DB}")
        logger.error("Hay chay build_viewer_db.py truoc.")
    else:
        try:
            start_email_polling_worker()
        except Exception as e:
            logger.error(f"❌ Cannot start email polling worker: {e}")

        logger.info("Server dang chay tai: http://localhost:5051")
        logger.info("Nhan Ctrl+C de dung.")
        app.run(host="0.0.0.0", port=5051, debug=False, threaded=True)
