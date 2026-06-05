import db_manager
from datetime import datetime, timedelta

conn = db_manager.get_user_db_conn()
user_id = 3
plan = "month"

# Activate VIP
now = datetime.utcnow()
expiry = now + timedelta(days=30)
conn.execute(
    "UPDATE users SET vip_status = 1, vip_plan = %s, vip_expiry = %s WHERE id = %s",
    (plan, expiry.strftime("%Y-%m-%d %H:%M:%S"), user_id)
)

# Mark payment as completed
conn.execute(
    "UPDATE payments SET status = 'completed', completed_at = %s WHERE order_id = '1780634375003'",
    (now.strftime("%Y-%m-%d %H:%M:%S"),)
)

conn.commit()
print("VIP Activated successfully for user cong (id=3)!")
