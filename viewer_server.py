"""
viewer_server.py — Application Entrypoint

This file was refactored from a 2800-line monolith into a clean entrypoint.
All business logic has been moved to the `backend/` package:

    backend/
    ├── __init__.py        ← App Factory (create_app)
    ├── config.py          ← All config & environment variables
    ├── api/               ← Flask Blueprints (routes/controllers)
    │   ├── auth.py
    │   ├── books.py
    │   ├── payment.py
    │   ├── translate.py
    │   ├── epub.py
    │   └── developer.py
    ├── services/          ← Business logic layer
    │   ├── auth_service.py
    │   ├── book_service.py
    │   ├── payment_service.py
    │   ├── email_service.py
    │   ├── epub_service.py
    │   └── translation.py
    ├── database/
    │   └── db_manager.py  ← DB connections, circuit breaker, caches
    ├── core/
    │   ├── security.py    ← JWT, bcrypt helpers
    │   ├── decorators.py  ← @jwt_required, @require_api_key_auth
    │   └── rate_limit.py  ← IP rate limiters
    └── workers/
        └── email_worker.py ← Background IMAP/Gmail email polling

To run the server:
    python viewer_server.py
Or with gunicorn:
    gunicorn -w 4 -b 0.0.0.0:5051 "viewer_server:app"
"""

import logging
import sys
import traceback
from flask import jsonify

from backend.core.logger import setup_logger
logger = setup_logger("server")

from backend import create_app

app = create_app()

@app.errorhandler(Exception)
def handle_exception(e):
    """Global unhandled exception handler to output clean JSON in production."""
    # Log the complete stack trace
    error_msg = f"Unhandled exception encountered: {str(e)}"
    stack_trace = traceback.format_exc()
    logger.error(error_msg)
    logger.error(stack_trace)
    
    # Trigger asynchronous alert email to Admin
    try:
        from backend.services.alert_service import send_alert_to_admin
        subject = f"Lỗi nghiêm trọng (500 Internal Error): {str(e)[:50]}"
        body = f"Đã xảy ra lỗi chưa xử lý trên server:<br><strong>Lỗi:</strong> {str(e)}<br><br><strong>Stack Trace:</strong><br>{stack_trace.replace(chr(10), '<br>')}"
        send_alert_to_admin("critical_error", subject, body)
    except Exception as alert_err:
        logger.error(f"Failed to trigger alert email for exception: {alert_err}")
    
    # Return JSON response instead of HTML traceback page
    return jsonify({
        "error": "Internal Server Error. Please contact administrator.",
        "success": False
    }), 500

if __name__ == "__main__":
    logger.info("🚀 Server đang khởi động tại: http://localhost:5051")
    app.run(host="0.0.0.0", port=5051, debug=False, threaded=True)
