import os
from flask import Blueprint, jsonify, request
from backend.core.decorators import get_current_user
from backend.core.monitoring import collect_all_metrics
from backend.services.alert_service import check_resources_and_alert

monitoring_bp = Blueprint("monitoring", __name__)

@monitoring_bp.route("/api/admin/metrics", methods=["GET"])
def get_metrics():
    """
    Get detailed system metrics and statistics.
    Access is restricted to admin via X-Admin-Key header or logged-in 'admin' user.
    """
    # Authorization checks
    is_admin = False
    
    # 1. Check for secret X-Admin-Key in request headers
    admin_key = request.headers.get("X-Admin-Key")
    expected_key = os.environ.get("ADMIN_PAYMENT_KEY", "LYVUHA_ADMIN_2026")
    if admin_key and admin_key == expected_key:
        is_admin = True
        
    # 2. Check logged-in user session/token
    if not is_admin:
        current_user = get_current_user()
        if current_user and current_user.get("username") == "admin":
            is_admin = True
            
    if not is_admin:
        return jsonify({"error": "Unauthorized admin access required"}), 403
        
    try:
        # Collect system statistics and details
        metrics = collect_all_metrics()
        
        # Trigger checks and alerts if RAM or Disk usage is critical
        check_resources_and_alert()
        
        return jsonify({
            "success": True,
            "metrics": metrics
        }), 200
    except Exception as e:
        return jsonify({
            "success": False,
            "error": f"Failed to retrieve system metrics: {str(e)}"
        }), 500


@monitoring_bp.route("/api/admin/logs", methods=["GET"])
def get_logs():
    """
    Get or download application logs.
    Access is restricted to admin via X-Admin-Key header or logged-in 'admin' user.
    """
    is_admin = False
    
    # 1. Check for secret X-Admin-Key in request headers
    admin_key = request.headers.get("X-Admin-Key")
    expected_key = os.environ.get("ADMIN_PAYMENT_KEY", "LYVUHA_ADMIN_2026")
    if admin_key and admin_key == expected_key:
        is_admin = True
        
    # 2. Check logged-in user session/token
    if not is_admin:
        current_user = get_current_user()
        if current_user and current_user.get("username") == "admin":
            is_admin = True
            
    if not is_admin:
        return jsonify({"error": "Unauthorized admin access required"}), 403

    from backend.config import Config
    log_path = os.path.join(Config.ROOT_DIR, "logs", "app.log")

    # Handle file download option
    if request.args.get("download") == "true":
        if not os.path.exists(log_path):
            return jsonify({"error": "Log file does not exist"}), 404
        from flask import send_file
        return send_file(log_path, as_attachment=True, download_name="app.log")

    # Handle standard retrieval
    lines_count = request.args.get("lines", default=100, type=int)
    lines_count = max(1, min(lines_count, 2000))

    if not os.path.exists(log_path):
        return jsonify({
            "success": True,
            "lines_returned": 0,
            "logs": [],
            "message": "Log file not found."
        }), 200

    try:
        from collections import deque
        with open(log_path, "r", encoding="utf-8", errors="ignore") as f:
            last_lines = list(deque(f, maxlen=lines_count))
        
        return jsonify({
            "success": True,
            "lines_returned": len(last_lines),
            "logs": last_lines
        }), 200
    except Exception as e:
        return jsonify({
            "success": False,
            "error": f"Failed to read logs: {str(e)}"
        }), 500


@monitoring_bp.route("/api/admin/profiler", methods=["GET"])
def get_profiler_stats():
    """
    Get recent request profiles with latency breakdown (Total, DB, External, CPU).
    Access is restricted to admin via X-Admin-Key header or logged-in 'admin' user.
    """
    is_admin = False
    admin_key = request.headers.get("X-Admin-Key")
    expected_key = os.environ.get("ADMIN_PAYMENT_KEY", "LYVUHA_ADMIN_2026")
    if admin_key and admin_key == expected_key:
        is_admin = True
        
    if not is_admin:
        current_user = get_current_user()
        if current_user and current_user.get("username") == "admin":
            is_admin = True
            
    if not is_admin:
        return jsonify({"error": "Unauthorized admin access required"}), 403

    try:
        from backend.core.profiler import get_recent_profiles
        profiles = get_recent_profiles()
        return jsonify({
            "success": True,
            "count": len(profiles),
            "profiles": profiles
        }), 200
    except Exception as e:
        return jsonify({
            "success": False,
            "error": f"Failed to retrieve profiler stats: {str(e)}"
        }), 500


