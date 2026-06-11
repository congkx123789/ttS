from backend.api.auth import auth_bp
from backend.api.books import books_bp
from backend.api.payment import payment_bp
from backend.api.translate import translate_bp
from backend.api.epub import epub_bp
from backend.api.developer import developer_bp
from backend.api.user_features import user_features_bp
from backend.api.sects import sects_bp

__all__ = ["auth_bp", "books_bp", "payment_bp", "translate_bp", "epub_bp", "developer_bp", "user_features_bp", "sects_bp"]
