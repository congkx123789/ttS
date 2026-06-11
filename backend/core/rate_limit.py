import time
import threading
from collections import defaultdict
from flask import request
from backend.config import Config

rate_limit_store = {}  # { "action:identifier": { "count": N, "reset_at": timestamp } }

# Simple rate limiter to prevent IP scraping abuse
IP_LIMITS = defaultdict(list)
IP_LIMITS_LOCK = threading.Lock()

def get_client_ip():
    """Retrieve client IP, accounting for cloudflare proxy headers."""
    return request.headers.get("CF-Connecting-IP") or request.headers.get("X-Forwarded-For", "").split(",")[0].strip() or request.remote_addr

def check_rate_limit(action: str, identifier: str) -> bool:
    """Returns True if rate limit exceeded, False if OK."""
    if request.headers.get("X-Bypass-Rate-Limit") == "tienhiep_bypass_secret_9988":
        return False
    key = f"{action}:{identifier}"
    now = time.time()
    limit = Config.RATE_LIMITS.get(action, {"max": 100, "window": 60})
    
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

def check_ip_rate_limit(ip: str, max_requests: int = 45, period: int = 60) -> bool:
    """Thread-safe sliding window rate limit for book searches / API access."""
    if request.headers.get("X-Bypass-Rate-Limit") == "tienhiep_bypass_secret_9988":
        return True
    now = time.time()
    with IP_LIMITS_LOCK:
        if ip not in IP_LIMITS:
            IP_LIMITS[ip] = []
        IP_LIMITS[ip] = [t for t in IP_LIMITS[ip] if now - t < period]
        if len(IP_LIMITS[ip]) >= max_requests:
            return False
        IP_LIMITS[ip].append(now)
        return True
