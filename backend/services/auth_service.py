import sqlite3
from datetime import datetime, timedelta
from backend.config import Config
from backend.database.db_manager import get_user_db_conn

def check_vip_expiry(user_id: int, conn=None) -> bool:
    """Check if a user's VIP has expired and deactivate if so."""
    should_close = False
    if conn is None:
        conn = get_user_db_conn()
        should_close = True
        
    try:
        conn.row_factory = sqlite3.Row
    except Exception:
        pass
        
    user = conn.execute("SELECT vip_status, vip_expiry FROM users WHERE id = ?", (user_id,)).fetchone()
    if user and user["vip_status"] == 1 and user["vip_expiry"]:
        try:
            expiry_val = user["vip_expiry"]
            if isinstance(expiry_val, str):
                expiry = datetime.strptime(expiry_val, "%Y-%m-%d %H:%M:%S")
            else:
                expiry = expiry_val
                
            if datetime.utcnow() > expiry:
                conn.execute("UPDATE users SET vip_status = 0, vip_plan = NULL WHERE id = ?", (user_id,))
                if hasattr(conn, "commit"):
                    conn.commit()
                if should_close:
                    conn.close()
                return False  # VIP expired
        except Exception:
            pass
    if should_close:
        conn.close()
    return user["vip_status"] == 1 if user else False

def activate_vip(user_id: int, plan: str) -> bool:
    """Activate VIP for a user based on the plan purchased."""
    plan_info = Config.VIP_PLANS.get(plan)
    if not plan_info:
        # Check for lifetime manual plans
        if "lifetime" in plan.lower():
            duration_days = 99999
        else:
            return False
    else:
        duration_days = plan_info["duration_days"]
    
    conn = get_user_db_conn()
    conn.row_factory = sqlite3.Row
    user = conn.execute("SELECT vip_expiry FROM users WHERE id = ?", (user_id,)).fetchone()
    
    now = datetime.utcnow()
    if user and user["vip_expiry"]:
        try:
            current_expiry = datetime.strptime(user["vip_expiry"], "%Y-%m-%d %H:%M:%S")
            if current_expiry > now:
                new_expiry = current_expiry + timedelta(days=duration_days)
            else:
                new_expiry = now + timedelta(days=duration_days)
        except Exception:
            new_expiry = now + timedelta(days=duration_days)
    else:
        new_expiry = now + timedelta(days=duration_days)
    
    conn.execute(
        "UPDATE users SET vip_status = 1, vip_plan = ?, vip_expiry = ? WHERE id = ?",
        (plan, new_expiry.strftime("%Y-%m-%d %H:%M:%S"), user_id)
    )
    conn.commit()
    conn.close()
    return True
