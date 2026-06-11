import os
import shutil
import sqlite3
import datetime
from backend.config import Config
from backend.database.db_manager import get_user_db_conn, get_db

def get_cpu_load():
    """Retrieve CPU 1m, 5m, 15m load average on Linux."""
    try:
        if os.path.exists("/proc/loadavg"):
            with open("/proc/loadavg", "r") as f:
                load = f.read().strip().split()
                return {
                    "load_1m": float(load[0]),
                    "load_5m": float(load[1]),
                    "load_15m": float(load[2])
                }
    except Exception:
        pass
    return {"load_1m": 0.0, "load_5m": 0.0, "load_15m": 0.0}

def get_memory_info():
    """Retrieve system RAM and process Resident Set Size (RSS) memory info."""
    mem_total = 0
    mem_available = 0
    process_rss = 0
    
    try:
        if os.path.exists("/proc/meminfo"):
            with open("/proc/meminfo", "r") as f:
                for line in f:
                    if line.startswith("MemTotal:"):
                        mem_total = int(line.split()[1]) * 1024  # kB to bytes
                    elif line.startswith("MemAvailable:"):
                        mem_available = int(line.split()[1]) * 1024
        
        if os.path.exists("/proc/self/status"):
            with open("/proc/self/status", "r") as f:
                for line in f:
                    if line.startswith("VmRSS:"):
                        process_rss = int(line.split()[1]) * 1024
                        break
    except Exception:
        pass
        
    mem_used = mem_total - mem_available
    mem_pct = (mem_used / mem_total * 100) if mem_total > 0 else 0.0
    
    return {
        "total_bytes": mem_total,
        "used_bytes": mem_used,
        "available_bytes": mem_available,
        "percent": round(mem_pct, 2),
        "process_rss_bytes": process_rss
    }

def get_disk_info():
    """Retrieve disk space usage of root partition."""
    try:
        total, used, free = shutil.disk_usage("/")
        percent = (used / total * 100) if total > 0 else 0.0
        return {
            "total_bytes": total,
            "used_bytes": used,
            "free_bytes": free,
            "percent": round(percent, 2)
        }
    except Exception:
        return {
            "total_bytes": 0,
            "used_bytes": 0,
            "free_bytes": 0,
            "percent": 0.0
        }

def get_database_sizes():
    """Get the sizes of SQLite databases on disk."""
    sizes = {}
    db_paths = {
        "user_db": Config.USER_DB_PATH,
        "books_db": Config.DB_PATH,
        "books_advanced": os.path.join(Config.ROOT_DIR, "merged_books_advanced.db"),
        "books_fast": os.path.join(Config.ROOT_DIR, "merged_books_fast.db"),
        "books_vietphrase": os.path.join(Config.ROOT_DIR, "merged_books_vietphrase.db"),
        "books_hanviet": os.path.join(Config.ROOT_DIR, "merged_books_hanviet.db"),
    }
    
    for key, path in db_paths.items():
        if os.path.exists(path):
            sizes[key] = os.path.getsize(path)
        else:
            sizes[key] = 0
            
    return sizes

def count_log_errors():
    """Scan logs/app.log and count the number of [ERROR] or ERROR level log messages."""
    log_path = os.path.join(Config.ROOT_DIR, "logs", "app.log")
    count = 0
    if not os.path.exists(log_path):
        return 0
    try:
        # Read the file. Since it's limited to 10MB, it's safe to scan
        with open(log_path, "r", encoding="utf-8", errors="ignore") as f:
            for line in f:
                if "ERROR" in line or "[ERROR]" in line:
                    count += 1
    except Exception:
        pass
    return count

def get_system_statistics():
    """Query user database to pull statistics like total users, payments, and API requests."""
    stats = {
        "total_users": 0,
        "vip_users": 0,
        "total_payments": 0,
        "total_api_keys": 0,
        "total_api_calls": 0,
        "total_books_scraped": 0
    }
    
    try:
        conn = get_user_db_conn()
        stats["total_users"] = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
        stats["vip_users"] = conn.execute("SELECT COUNT(*) FROM users WHERE vip_status = 1").fetchone()[0]
        
        # Check if tables exist before querying
        tables = [r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
        
        if "payments" in tables:
            stats["total_payments"] = conn.execute("SELECT COUNT(*) FROM payments WHERE status = 'completed'").fetchone()[0]
        if "api_keys" in tables:
            stats["total_api_keys"] = conn.execute("SELECT COUNT(*) FROM api_keys").fetchone()[0]
        if "api_usage" in tables:
            stats["total_api_calls"] = conn.execute("SELECT COUNT(*) FROM api_usage").fetchone()[0]
            
        conn.close()
    except Exception:
        pass
        
    try:
        main_conn = get_db()
        stats["total_books_scraped"] = main_conn.execute("SELECT COUNT(*) FROM books").fetchone()[0]
    except Exception:
        pass
        
    return stats

def collect_all_metrics():
    """Gather all diagnostics into a consolidated system metrics dictionary."""
    return {
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "cpu": get_cpu_load(),
        "memory": get_memory_info(),
        "disk": get_disk_info(),
        "databases": get_database_sizes(),
        "error_logs_count": count_log_errors(),
        "statistics": get_system_statistics()
    }
