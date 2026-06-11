from functools import wraps
from datetime import datetime
from flask import request, jsonify, session
from backend.core.security import verify_access_token
from backend.database.db_manager import get_user_db_conn

def jwt_required(f):
    """Decorator: require valid JWT OR session auth."""
    @wraps(f)
    def decorated(*args, **kwargs):
        # Try JWT first
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
            payload = verify_access_token(token)
            if payload:
                request._jwt_user = {
                    "id": int(payload["sub"]),
                    "username": payload["username"],
                    "vip_status": payload["vip"]
                }
                return f(*args, **kwargs)
        
        # Fall back to session auth
        if "user_id" in session:
            request._jwt_user = {
                "id": session["user_id"],
                "username": session["username"],
                "vip_status": session.get("vip_status", 0)
            }
            return f(*args, **kwargs)
        
        return jsonify({"error": "Authentication required"}), 401
    return decorated

def require_api_key_auth(f):
    """Decorator: require valid Developer API Key or VIP Validation Code auth."""
    @wraps(f)
    def decorated(*args, **kwargs):
        # 1. Try to find the key in Authorization header
        auth_header = request.headers.get("Authorization", "")
        api_key = ""
        if auth_header.startswith("Bearer "):
            api_key = auth_header[7:].strip()
            
        # 2. Try X-VIP-Key header
        if not api_key:
            api_key = request.headers.get("X-VIP-Key", "").strip()
            
        # 3. Try X-VIP-Code header
        if not api_key:
            api_key = request.headers.get("X-VIP-Code", "").strip()
            
        # 4. Try request JSON body
        if not api_key:
            try:
                data = request.json or {}
                api_key = data.get("vip_key", "") or data.get("vip_code", "") or data.get("api_key", "")
                if isinstance(api_key, str):
                    api_key = api_key.strip()
                else:
                    api_key = ""
            except:
                pass
                
        # 5. Check if it's empty
        if not api_key:
            return jsonify({"error": "Missing API Key or VIP Code. Please authenticate."}), 401
            
        # 6. Check if it is a valid static VIP code
        from backend.config import Config
        if api_key in Config.VALID_VIP_CODES:
            # Bypassed - treat as static VIP access with unlimited balance
            request.api_key = api_key
            request.api_user_id = None
            request.api_balance = 999999.0
            return f(*args, **kwargs)
            
        # 7. Otherwise, it must be a developer key starting with sk-tc-
        if not api_key.startswith("sk-tc-"):
            return jsonify({"error": "Invalid API key format. Key must start with 'sk-tc-' or be a valid VIP Code."}), 401
            
        conn = get_user_db_conn()
        key_record = conn.execute(
            "SELECT k.*, u.api_balance FROM api_keys k JOIN users u ON k.user_id = u.id WHERE k.api_key = ? AND k.status = 'active'", 
            (api_key,)
        ).fetchone()
        
        if not key_record:
            conn.close()
            return jsonify({"error": "API Key not found, inactive, or revoked."}), 401
            
        balance = key_record["api_balance"] if key_record["api_balance"] is not None else 0.0
        if balance <= 0.0:
            conn.close()
            return jsonify({
                "error": f"Tài khoản hết số dư API (Số dư hiện tại: {balance:.2f}đ). Vui lòng nạp thêm tiền tại website để tiếp tục sử dụng."
            }), 402
            
        # Update last_used_at
        now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        conn.execute("UPDATE api_keys SET last_used_at = ? WHERE api_key = ?", (now, api_key))
        conn.commit()
        conn.close()
        
        request.api_key = api_key
        request.api_user_id = key_record["user_id"]
        request.api_balance = balance
        return f(*args, **kwargs)
    return decorated

def get_current_user():
    """Get current user from JWT or session."""
    if hasattr(request, '_jwt_user'):
        return request._jwt_user
        
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
        payload = verify_access_token(token)
        if payload:
            return {
                "id": int(payload["sub"]),
                "username": payload["username"],
                "vip_status": payload["vip"]
            }
            
    if "user_id" in session:
        return {
            "id": session["user_id"],
            "username": session["username"],
            "vip_status": session.get("vip_status", 0)
        }
    return None
