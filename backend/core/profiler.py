import time
import logging
import requests
from collections import deque
from flask import g, has_app_context, request

logger = logging.getLogger("profiler")
logger.setLevel(logging.INFO)
if not logger.handlers:
    import sys
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter("[%(asctime)s] %(message)s"))
    logger.addHandler(handler)

# Ring buffer for recent profiled requests
recent_profiles = deque(maxlen=100)

# 1. Monkey patch requests to measure all outbound HTTP API calls
_original_request = requests.request

def _monitored_request(*args, **kwargs):
    start_time = time.time()
    try:
        return _original_request(*args, **kwargs)
    finally:
        duration = time.time() - start_time
        if has_app_context():
            if not hasattr(g, "external_time"):
                g.external_time = 0.0
            g.external_time += duration

requests.request = _monitored_request

# DB tracking helper
def record_db_time(duration: float):
    if has_app_context():
        if not hasattr(g, "db_time"):
            g.db_time = 0.0
        g.db_time += duration

def get_recent_profiles():
    return list(recent_profiles)

def setup_profiler(app):
    @app.before_request
    def start_timer():
        g.start_time = time.time()
        g.db_time = 0.0
        g.external_time = 0.0

    @app.after_request
    def log_and_header(response):
        if not hasattr(g, "start_time"):
            return response
            
        total_time = time.time() - g.start_time
        db_time = getattr(g, "db_time", 0.0)
        ext_time = getattr(g, "external_time", 0.0)
        cpu_time = max(0.0, total_time - db_time - ext_time)
        
        # Add latency/breakdown headers in milliseconds
        response.headers["X-Response-Time-Ms"] = f"{int(total_time * 1000)}"
        response.headers["X-DB-Time-Ms"] = f"{int(db_time * 1000)}"
        response.headers["X-External-Time-Ms"] = f"{int(ext_time * 1000)}"
        response.headers["X-CPU-Process-Time-Ms"] = f"{int(cpu_time * 1000)}"
        
        log_entry = {
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "method": request.method,
            "path": request.path,
            "status_code": response.status_code,
            "total_ms": round(total_time * 1000, 1),
            "db_ms": round(db_time * 1000, 1),
            "external_ms": round(ext_time * 1000, 1),
            "cpu_ms": round(cpu_time * 1000, 1)
        }
        recent_profiles.append(log_entry)
        
        # Print directly to stdout/gunicorn logs
        logger.info(
            f"[PROFILER] {request.method} {request.path} ({response.status_code}) - "
            f"Total: {log_entry['total_ms']}ms | "
            f"DB: {log_entry['db_ms']}ms | "
            f"External: {log_entry['external_ms']}ms | "
            f"CPU/Internal: {log_entry['cpu_ms']}ms"
        )
        return response
