import os
import logging
from flask import Flask, jsonify
from flask_cors import CORS

from backend.config import Config
from backend.database.db_manager import init_user_db, health_check
from backend.api import (
    auth_bp, books_bp, payment_bp, translate_bp, epub_bp, developer_bp, user_features_bp, sects_bp
)
from backend.api.monitoring import monitoring_bp

logger = logging.getLogger("backend")


def create_app():
    """Flask Application Factory."""
    root_dir = Config.ROOT_DIR
    app = Flask(
        __name__,
        static_folder=os.path.join(root_dir, "frontend-web", "dist"),
        static_url_path="",
    )

    # ── Configuration ────────────────────────────────────────────────
    app.secret_key = Config.SECRET_KEY
    app.config["MAX_CONTENT_LENGTH"] = 256 * 1024 * 1024  # 256MB

    # ── CORS ─────────────────────────────────────────────────────────
    CORS(app, resources={
        r"/*": {
            "origins": ["*"],
            "allow_headers": ["Content-Type", "Authorization", "X-VIP-Code", "X-VIP-Key"],
            "methods": ["GET", "POST", "OPTIONS", "DELETE", "PUT"]
        }
    })

    # ── Register Blueprints ───────────────────────────────────────────
    app.register_blueprint(auth_bp)
    app.register_blueprint(books_bp)
    app.register_blueprint(payment_bp)
    app.register_blueprint(translate_bp)
    app.register_blueprint(epub_bp)
    app.register_blueprint(developer_bp)
    app.register_blueprint(user_features_bp)
    app.register_blueprint(sects_bp)
    app.register_blueprint(monitoring_bp)

    # ── Profiler & Latency Monitoring ─────────────────────────────────
    from backend.core.profiler import setup_profiler
    setup_profiler(app)

    # ── Frontend Route ───────────────────────────────────────────────
    @app.route("/")
    def index():
        try:
            return app.send_static_file("index.html")
        except Exception:
            return jsonify({"status": "healthy", "message": "Tienhiep API Backend is running."})

    @app.errorhandler(404)
    def page_not_found(e):
        from flask import request
        path = request.path.lstrip("/")
        if path.startswith("api/") or path.startswith("assets/") or path.startswith("v1/") or path.startswith("health") or path.startswith("translate"):
            return jsonify({"error": "Not Found"}), 404
        try:
            return app.send_static_file("index.html")
        except Exception:
            return jsonify({"error": "Not Found"}), 404

    # ── Health Check ────────────────────────────────────────────────
    @app.route("/health", methods=["GET"])
    def health_endpoint():
        status = health_check()
        http_code = 200 if status["status"] in ("healthy", "degraded") else 503
        return jsonify(status), http_code

    # ── CORS after-request headers ───────────────────────────────────
    @app.after_request
    def add_cors_headers(response):
        from flask import request
        response.headers["X-Content-Type-Options"] = "nosniff"
        if request.path.startswith("/embed"):
            response.headers["Content-Security-Policy"] = "frame-ancestors *"
        else:
            response.headers["X-Frame-Options"] = "SAMEORIGIN"
        return response

    # ── Initialize DB ────────────────────────────────────────────────
    try:
        init_user_db()
        logger.info("✔ Database initialized on app startup.")
    except Exception as e:
        logger.error(f"⚠️ Auto database initialization failed: {e}")

    # ── Start background Email Worker ────────────────────────────────
    if not app.testing and os.environ.get("FLASK_ENV") != "testing" and os.environ.get("DISABLE_FLASK_EMAIL_WORKER") != "true":
        try:
            from backend.workers.email_worker import start_email_worker
            start_email_worker()
        except Exception as e:
            logger.warning(f"⚠️ Email worker could not start: {e}")

    # ── Pre-load translation engine ──────────────────────────────────
    try:
        logger.info("⏳ Pre-loading Vietphrase Engine...")
        from backend.services.translation import get_engine
        get_engine()
        logger.info("✅ Vietphrase Engine loaded successfully.")
    except Exception as e:
        logger.error(f"⚠️ Failed to pre-load translation engine: {e}")

    return app
