import secrets
import hashlib
from datetime import datetime
import bcrypt
import jwt
from backend.config import Config
from backend.database.db_manager import get_user_db_conn

def hash_password(password: str) -> str:
    """Hash password with bcrypt."""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    """Verify password against bcrypt hash. Also supports legacy SHA-256."""
    try:
        if hashed.startswith("$2b$") or hashed.startswith("$2a$"):
            return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))
    except Exception:
        pass
    # Fall back to legacy SHA-256 for old accounts
    legacy_hash = hashlib.sha256(password.encode()).hexdigest()
    return legacy_hash == hashed

def upgrade_password_hash(user_id: int, password: str):
    """Upgrade a user's password from SHA-256 to bcrypt."""
    new_hash = hash_password(password)
    conn = get_user_db_conn()
    conn.execute("UPDATE users SET password_hash = ? WHERE id = ?", (new_hash, user_id))
    conn.commit()
    conn.close()

def create_access_token(user_id: int, username: str, vip_status: int) -> str:
    """Create a short-lived access token (30 min)."""
    payload = {
        "sub": str(user_id),
        "username": username,
        "vip": vip_status,
        "type": "access",
        "exp": datetime.utcnow() + Config.JWT_ACCESS_TOKEN_EXPIRE,
        "iat": datetime.utcnow()
    }
    return jwt.encode(payload, Config.JWT_SECRET, algorithm=Config.JWT_ALGORITHM)

def create_refresh_token(user_id: int) -> str:
    """Create a long-lived refresh token (7 days), stored in DB."""
    token_str = secrets.token_urlsafe(64)
    expires_at = datetime.utcnow() + Config.JWT_REFRESH_TOKEN_EXPIRE
    conn = get_user_db_conn()
    conn.execute(
        "INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)",
        (user_id, token_str, expires_at.strftime("%Y-%m-%d %H:%M:%S"))
    )
    conn.commit()
    conn.close()
    return token_str

def verify_access_token(token: str):
    """Verify and decode an access token. Returns payload or None."""
    try:
        payload = jwt.decode(token, Config.JWT_SECRET, algorithms=[Config.JWT_ALGORITHM])
        if payload.get("type") != "access":
            print(f"[DEBUG JWT] Token type is not access: {payload.get('type')}", flush=True)
            return None
        return payload
    except jwt.ExpiredSignatureError as e:
        print(f"[DEBUG JWT] Token expired: {e}", flush=True)
        return None
    except jwt.InvalidTokenError as e:
        print(f"[DEBUG JWT] Invalid token: {e}", flush=True)
        return None
    except Exception as e:
        print(f"[DEBUG JWT] Decode failed: {e}", flush=True)
        return None

import base64
from cryptography.fernet import Fernet

def _get_fernet_key() -> bytes:
    key_hash = hashlib.sha256(Config.SECRET_KEY.encode()).digest()
    return base64.urlsafe_b64encode(key_hash)

def encrypt_message(message: str) -> str:
    """Encrypt message text using symmetric AES encryption."""
    if not message:
        return ""
    try:
        f = Fernet(_get_fernet_key())
        return f.encrypt(message.encode('utf-8')).decode('utf-8')
    except Exception as e:
        return message

def decrypt_message(encrypted_message: str) -> str:
    """Decrypt message text. Falls back to original text if not encrypted or fails."""
    if not encrypted_message:
        return ""
    try:
        f = Fernet(_get_fernet_key())
        return f.decrypt(encrypted_message.encode('utf-8')).decode('utf-8')
    except Exception:
        return encrypted_message

