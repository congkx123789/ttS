import db_manager
try:
    print("Trying to get connection...")
    conn = db_manager.get_user_db_conn()
    print("Got connection:", conn)
except Exception as e:
    print("CAUGHT EXCEPTION:", repr(e))
