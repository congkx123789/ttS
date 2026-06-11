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

import os
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives import serialization, hashes
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

KEYS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "keys")
PRIVATE_KEY_PATH = os.path.join(KEYS_DIR, "private_key.pem")
PUBLIC_KEY_PATH = os.path.join(KEYS_DIR, "public_key.pem")

def get_or_create_rsa_keys():
    """Get RSA keys or generate if they don't exist."""
    if not os.path.exists(KEYS_DIR):
        os.makedirs(KEYS_DIR, exist_ok=True)
        
    if not os.path.exists(PRIVATE_KEY_PATH) or not os.path.exists(PUBLIC_KEY_PATH):
        # Generate private key
        private_key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=2048
        )
        # Write private key
        with open(PRIVATE_KEY_PATH, "wb") as f:
            f.write(
                private_key.private_bytes(
                    encoding=serialization.Encoding.PEM,
                    format=serialization.PrivateFormat.PKCS8,
                    encryption_algorithm=serialization.NoEncryption()
                )
            )
        # Generate and write public key
        public_key = private_key.public_key()
        with open(PUBLIC_KEY_PATH, "wb") as f:
            f.write(
                public_key.public_bytes(
                    encoding=serialization.Encoding.PEM,
                    format=serialization.PublicFormat.SubjectPublicKeyInfo
                )
            )

def encrypt_asymmetric_hybrid(plaintext: str) -> dict:
    """
    Encrypt text using Hybrid Encryption (AES-256-GCM + RSA-2048).
    Returns a dict with base64 encoded parts.
    """
    if not plaintext:
        return {"ciphertext": "", "encrypted_key": "", "nonce": "", "tag": ""}
    
    # Ensure keys exist
    get_or_create_rsa_keys()
    
    # 1. Generate random 256-bit AES key and 12-byte nonce
    aes_key = os.urandom(32)
    nonce = os.urandom(12)
    
    # 2. Encrypt plaintext using AES-GCM
    cipher = Cipher(algorithms.AES(aes_key), modes.GCM(nonce))
    encryptor = cipher.encryptor()
    ciphertext = encryptor.update(plaintext.encode('utf-8')) + encryptor.finalize()
    tag = encryptor.tag
    
    # 3. Encrypt the AES key using RSA public key
    with open(PUBLIC_KEY_PATH, "rb") as f:
        public_key = serialization.load_pem_public_key(f.read())
        
    encrypted_aes_key = public_key.encrypt(
        aes_key,
        padding.OAEP(
            mgf=padding.MGF1(algorithm=hashes.SHA256()),
            algorithm=hashes.SHA256(),
            label=None
        )
    )
    
    # 4. Return all parts as base64 string
    return {
        "ciphertext": base64.b64encode(ciphertext).decode('utf-8'),
        "encrypted_key": base64.b64encode(encrypted_aes_key).decode('utf-8'),
        "nonce": base64.b64encode(nonce).decode('utf-8'),
        "tag": base64.b64encode(tag).decode('utf-8')
    }

def decrypt_asymmetric_hybrid(ciphertext_b64: str, encrypted_key_b64: str, nonce_b64: str, tag_b64: str) -> str:
    """
    Decrypt asymmetric hybrid encrypted payload.
    """
    if not ciphertext_b64 or not encrypted_key_b64:
        return ""
    
    # Check if private key exists
    if not os.path.exists(PRIVATE_KEY_PATH):
        print("[SECURITY] Private key does not exist. Decryption failed.", flush=True)
        return ""
    
    try:
        # Decode base64 parts
        ciphertext = base64.b64decode(ciphertext_b64.encode('utf-8'))
        encrypted_aes_key = base64.b64decode(encrypted_key_b64.encode('utf-8'))
        nonce = base64.b64decode(nonce_b64.encode('utf-8'))
        tag = base64.b64decode(tag_b64.encode('utf-8'))
        
        # 1. Decrypt AES key using RSA private key
        with open(PRIVATE_KEY_PATH, "rb") as f:
            private_key = serialization.load_pem_private_key(f.read(), password=None)
            
        aes_key = private_key.decrypt(
            encrypted_aes_key,
            padding.OAEP(
                mgf=padding.MGF1(algorithm=hashes.SHA256()),
                algorithm=hashes.SHA256(),
                label=None
            )
        )
        
        # 2. Decrypt ciphertext using AES-GCM
        cipher = Cipher(algorithms.AES(aes_key), modes.GCM(nonce, tag))
        decryptor = cipher.decryptor()
        decrypted_bytes = decryptor.update(ciphertext) + decryptor.finalize()
        
        return decrypted_bytes.decode('utf-8')
    except Exception as e:
        import traceback
        print(f"[SECURITY] Hybrid decryption failed: {e}", flush=True)
        traceback.print_exc()
        return ""


