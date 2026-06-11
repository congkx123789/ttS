import os
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv(override=True)

class Config:
    # Flask settings
    SECRET_KEY = os.environ.get("FLASK_SECRET_KEY", "tienhiep_lyvuha_secret_key_9988")
    
    # Base directories and DB paths
    ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    DB_PATH = os.path.join(ROOT_DIR, "merged_books.db")
    USER_DB_PATH = os.path.join(ROOT_DIR, "users_data.db")
    
    # JWT authentication settings
    JWT_SECRET = SECRET_KEY + "_jwt_v2_secure"
    JWT_ALGORITHM = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE = timedelta(minutes=30)
    JWT_REFRESH_TOKEN_EXPIRE = timedelta(days=7)
    
    # VIP plans
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
    
    # Payment Gateway Config
    PAYMENT_CONFIG = {
        "bank_id": os.environ.get("BANK_ID", "MB"),
        "account_no": os.environ.get("BANK_ACCOUNT_NO", "0349717475"),
        "account_name": os.environ.get("BANK_ACCOUNT_NAME", "LY VU HA"),
        "template": "compact2",
        "payos_client_id": os.environ.get("PAYOS_CLIENT_ID", ""),
        "payos_api_key": os.environ.get("PAYOS_API_KEY", ""),
        "payos_checksum_key": os.environ.get("PAYOS_CHECKSUM_KEY", ""),
        "payos_webhook_url": os.environ.get("PAYOS_WEBHOOK_URL", "https://yourdomain.com/api/payment/webhook"),
    }
    
    # Rate Limiting
    RATE_LIMITS = {
        "login": {"max": 5, "window": 300},
        "register": {"max": 3, "window": 600},
        "otp": {"max": 3, "window": 60},
        "payment": {"max": 10, "window": 600},
    }
    
    # SMTP email config
    SMTP_CONFIG = {
        "host": "smtp.gmail.com",
        "port": 587,
        "username": os.environ.get("SMTP_EMAIL", ""),
        "password": os.environ.get("SMTP_PASSWORD", ""),
        "from_name": "Novel Translator VIP",
        "enabled": True if os.environ.get("SMTP_PASSWORD") else False
    }
    
    # Google OAuth
    GOOGLE_OAUTH_CONFIG = {
        "client_id": os.environ.get("GOOGLE_CLIENT_ID", ""),
        "client_secret": os.environ.get("GOOGLE_CLIENT_SECRET", ""),
        "redirect_uri": os.environ.get("GOOGLE_REDIRECT_URI", "http://localhost:5050/api/auth/google/callback"),
        "enabled": True
    }
    
    # VIP Validation Codes
    _vip_codes_env = os.environ.get("VALID_VIP_CODES", "")
    if _vip_codes_env:
        VALID_VIP_CODES = set(c.strip() for c in _vip_codes_env.split(",") if c.strip())
    else:
        VALID_VIP_CODES = {"VIP2026", "ANTIGRAVITY", "PREMIUM_MEMBER", "VIP_TRANSLATOR", "VIP_SERVER"}
