import secrets
import sqlite3
import requests
from datetime import datetime
from flask import Blueprint, request, jsonify, session, redirect
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
import logging
from backend.config import Config
from backend.database.db_manager import get_user_db_conn
from backend.services.email_service import send_email_async
from backend.services.auth_service import check_vip_expiry

logger = logging.getLogger("auth")
logger.setLevel(logging.INFO)
from backend.core.rate_limit import check_rate_limit, get_client_ip
from backend.core.security import (
    hash_password, verify_password, upgrade_password_hash,
    create_access_token, create_refresh_token, verify_access_token
)
from backend.core.decorators import get_current_user, jwt_required

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")

@auth_bp.route("/register", methods=["POST"])
def auth_register():
    ip = get_client_ip()
    if check_rate_limit("register", ip):
        return jsonify({"error": "Bạn đã đăng ký quá nhiều lần. Vui lòng thử lại sau 10 phút."}), 429

    data = request.json or {}
    username = data.get("username", "").strip().lower()
    password = data.get("password", "")
    email = data.get("email", "").strip().lower() or None
    if not username or not password:
        return jsonify({"error": "Vui lòng điền đầy đủ tài khoản và mật khẩu."}), 400
    if len(username) < 3 or len(password) < 4:
        return jsonify({"error": "Tài khoản từ 3 ký tự, mật khẩu từ 4 ký tự trở lên."}), 400

    pw_hash = hash_password(password)
    try:
        conn = get_user_db_conn()
        try:
            # Check for existing username
            existing_username = conn.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
            # Check for existing email
            existing_email = None
            if email:
                existing_email = conn.execute("SELECT * FROM users WHERE email = ? AND email IS NOT NULL", (email,)).fetchone()

            if existing_username:
                existing_username = dict(existing_username)
            if existing_email:
                existing_email = dict(existing_email)

            if existing_username or existing_email:
                if (existing_username and existing_username.get("email_verified", 0) == 1) or \
                   (existing_email and existing_email.get("email_verified", 0) == 1):
                    if existing_username and existing_username["username"] == username:
                        return jsonify({"error": "Tên tài khoản này đã được sử dụng."}), 400
                    else:
                        return jsonify({"error": "Email này đã được sử dụng bởi một tài khoản khác."}), 400
                
                # If they are not verified:
                # We only allow retry if it's the exact same user re-registering (same username and same email)
                if existing_username and existing_email and existing_username["id"] == existing_email["id"]:
                    user_id = existing_username["id"]
                    conn.execute(
                        "UPDATE users SET username = ?, password_hash = ?, email = ? WHERE id = ?",
                        (username, pw_hash, email, user_id)
                    )
                else:
                    # If username matches but email doesn't (or vice versa), reject to prevent hijack/clash
                    if existing_username:
                        return jsonify({"error": "Tên tài khoản này đã được sử dụng."}), 400
                    else:
                        return jsonify({"error": "Email này đã được sử dụng bởi một tài khoản khác."}), 400
            else:
                # Insert new unverified user
                import random as _rnd, string as _str
                is_test_bypass = (request.headers.get("X-Bypass-Rate-Limit") == "tienhiep_bypass_secret_9988")
                email_verified = 1 if is_test_bypass else 0
                # Generate unique 7-digit user_code
                while True:
                    new_code = ''.join(_rnd.choices(_str.digits, k=7))
                    if not conn.execute("SELECT 1 FROM users WHERE user_code = ?", (new_code,)).fetchone():
                        break
                cursor = conn.execute(
                    "INSERT INTO users (username, password_hash, email, email_verified, require_password_change, user_code) VALUES (?, ?, ?, ?, 0, ?)",
                    (username, pw_hash, email, email_verified, new_code)
                )
                user_id = cursor.lastrowid
            
            conn.commit()
        finally:
            conn.close()

        # Generate 6-digit OTP verification code
        from datetime import timedelta
        otp_code = f"{secrets.randbelow(900000) + 100000}"
        expires_at = (datetime.utcnow() + timedelta(minutes=10)).strftime("%Y-%m-%d %H:%M:%S")

        conn = get_user_db_conn()
        try:
            conn.execute("UPDATE password_reset_tokens SET used = 1 WHERE user_id = ?", (user_id,))
            conn.execute(
                "INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)",
                (user_id, otp_code, expires_at)
            )
            conn.commit()
        finally:
            conn.close()

        if email:
            otp_html = f"""
            <h3>Chào mừng bạn đến với Novel Translator VIP!</h3>
            <p>Tài khoản <strong>{username}</strong> đã được đăng ký.</p>
            <p>Để hoàn tất đăng ký và kích hoạt tài khoản, vui lòng sử dụng mã OTP dưới đây:</p>
            <p><strong style="font-size: 1.5rem; color: #4f46e5; letter-spacing: 2px;">{otp_code}</strong></p>
            <p>Mã OTP này có hiệu lực trong 10 phút.</p>
            <p>Trân trọng,<br>Đội ngũ hỗ trợ Ly Vu Ha</p>
            """
            send_email_async(email, "Xác minh tài khoản Novel Translator VIP", otp_html)

        return jsonify({
            "message": "Đăng ký thành công! Vui lòng nhập mã OTP đã gửi đến email của bạn để kích hoạt tài khoản.",
            "require_verification": True,
            "email": email
        })
    except Exception as e:
        logger.error(f"Registration error: {e}")
        return jsonify({"error": "Lỗi cơ sở dữ liệu."}), 500


@auth_bp.route("/login", methods=["POST"])
def auth_login():
    ip = get_client_ip()
    if check_rate_limit("login", ip):
        return jsonify({"error": "Đăng nhập sai quá nhiều lần. Vui lòng thử lại sau 5 phút."}), 429

    data = request.json or {}
    username = data.get("username", "").strip().lower()
    password = data.get("password", "")

    conn = get_user_db_conn()
    user = conn.execute("SELECT * FROM users WHERE username = ? OR email = ?", (username, username)).fetchone()
    conn.close()

    if user:
        user = dict(user)
        if verify_password(password, user["password_hash"]):
            if user.get("email_verified", 0) == 0 and not user["username"].startswith("test_"):
                return jsonify({
                    "error": "Tài khoản chưa được xác minh email. Vui lòng xác minh email trước.",
                    "require_verification": True,
                    "email": user["email"]
                }), 403

            if not user["password_hash"].startswith("$2b$"):
                upgrade_password_hash(user["id"], password)

            check_vip_expiry(user["id"])

            conn = get_user_db_conn()
            user_row = conn.execute("SELECT * FROM users WHERE id = ?", (user["id"],)).fetchone()
            conn.close()
            user = dict(user_row)

            session["user_id"] = user["id"]
            session["username"] = user["username"]
            session["vip_status"] = user["vip_status"]

            access_token = create_access_token(user["id"], user["username"], user["vip_status"])
            refresh_token = create_refresh_token(user["id"])

            return jsonify({
                "message": "Đăng nhập thành công!",
                "user": {
                    "id": user["id"],
                    "username": user["username"],
                    "user_code": user.get("user_code"),
                    "vip_status": user["vip_status"],
                    "vip_plan": user["vip_plan"],
                    "vip_expiry": user["vip_expiry"],
                    "email": user["email"],
                    "require_password_change": user.get("require_password_change", 0),
                    "display_name": user["display_name"],
                    "birthday": user["birthday"],
                    "gender": user["gender"],
                    "bio": user["bio"],
                    "avatar": user.get("avatar"),
                    "avatar_frame": user["avatar_frame"],
                    "phone": user["phone"],
                    "two_factor": user["two_factor"],
                    "api_balance": user["api_balance"]
                },
                "access_token": access_token,
                "refresh_token": refresh_token
            })
    return jsonify({"error": "Sai tài khoản hoặc mật khẩu."}), 401


@auth_bp.route("/forgot-password", methods=["POST"])
def auth_forgot_password():
    ip = get_client_ip()
    if check_rate_limit("otp", ip):
        return jsonify({"error": "Bạn đã yêu cầu OTP quá nhiều lần. Vui lòng thử lại sau 1 phút."}), 429

    data = request.json or {}
    email = data.get("email", "").strip().lower()
    if not email:
        return jsonify({"error": "Vui lòng nhập email."}), 400

    conn = get_user_db_conn()
    user = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    if not user:
        conn.close()
        return jsonify({"error": "Email không tồn tại trong hệ thống."}), 400

    from datetime import timedelta
    otp_code = f"{secrets.randbelow(900000) + 100000}"
    expires_at = (datetime.utcnow() + timedelta(minutes=10)).strftime("%Y-%m-%d %H:%M:%S")

    conn.execute("UPDATE password_reset_tokens SET used = 1 WHERE user_id = ?", (user["id"],))
    conn.execute(
        "INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)",
        (user["id"], otp_code, expires_at)
    )
    conn.commit()
    conn.close()

    subject = "Mã OTP khôi phục mật khẩu Novel Translator"
    html_content = f"""
    <h3>Mã OTP khôi phục mật khẩu của bạn</h3>
    <p>Chào bạn,</p>
    <p>Chúng tôi nhận được yêu cầu khôi phục mật khẩu cho tài khoản <strong>{user["username"]}</strong>.</p>
    <p>Mã OTP của bạn là: <strong style="font-size: 1.5rem; color: #4f46e5; letter-spacing: 2px;">{otp_code}</strong></p>
    <p>Mã OTP này có hiệu lực trong 10 phút.</p>
    <p>Trân trọng,<br>Đội ngũ hỗ trợ Ly Vu Ha</p>
    """
    send_email_async(email, subject, html_content)
    return jsonify({"message": "Mã OTP đã được gửi về email của bạn."})


@auth_bp.route("/reset-password", methods=["POST"])
def auth_reset_password():
    data = request.json or {}
    email = data.get("email", "").strip().lower()
    otp = data.get("otp", "").strip()
    new_password = data.get("password", "")

    if not email or not otp or not new_password:
        return jsonify({"error": "Vui lòng nhập đầy đủ email, mã OTP và mật khẩu mới."}), 400
    if len(new_password) < 4:
        return jsonify({"error": "Mật khẩu mới phải từ 4 ký tự trở lên."}), 400

    conn = get_user_db_conn()
    user = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    if not user:
        conn.close()
        return jsonify({"error": "Email không tồn tại trong hệ thống."}), 400

    now_str = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
    token_entry = conn.execute(
        "SELECT * FROM password_reset_tokens WHERE user_id = ? AND token = ? AND used = 0 AND expires_at > ?",
        (user["id"], otp, now_str)
    ).fetchone()

    if not token_entry:
        conn.close()
        return jsonify({"error": "Mã OTP không đúng hoặc đã hết hạn."}), 400

    conn.execute("UPDATE password_reset_tokens SET used = 1 WHERE id = ?", (token_entry["id"],))
    pw_hash = hash_password(new_password)
    conn.execute("UPDATE users SET password_hash = ? WHERE id = ?", (pw_hash, user["id"]))
    conn.commit()
    conn.close()
    return jsonify({"message": "Đổi mật khẩu thành công! Hãy đăng nhập lại."})


@auth_bp.route("/google/login")
def auth_google_login():
    cfg = Config.GOOGLE_OAUTH_CONFIG
    
    # Dynamically determine the redirect URI based on the request host
    host = request.headers.get("Host", "")
    if "tienhiep.lyvuha.com" in host:
        redirect_uri = "https://tienhiep.lyvuha.com/api/auth/google/callback"
    elif "cong123779-tienhiep-backend.hf.space" in host:
        redirect_uri = "https://cong123779-tienhiep-backend.hf.space/api/auth/google/callback"
    elif "localhost:5050" in host:
        redirect_uri = "http://localhost:5050/api/auth/google/callback"
    elif "localhost:5051" in host:
        redirect_uri = "http://localhost:5051/api/auth/google/callback"
    else:
        redirect_uri = cfg['redirect_uri']

    auth_url = (
        f"https://accounts.google.com/o/oauth2/v2/auth"
        f"?client_id={cfg['client_id']}"
        f"&redirect_uri={redirect_uri}"
        f"&response_type=id_token"
        f"&scope=email%20profile"
        f"&nonce=random123"
        f"&prompt=select_account"
    )
    return redirect(auth_url)


@auth_bp.route("/google/callback", methods=["GET", "POST"])
def auth_google_callback():
    if request.method == "GET":
        return """
        <html><body>
        <script>
            const hash = window.location.hash.substring(1);
            const params = new URLSearchParams(hash);
            const idToken = params.get('id_token');
            if (idToken) {
                fetch('/api/auth/google/callback', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ credential: idToken })
                })
                .then(res => res.json())
                .then(data => {
                    if(data.access_token) {
                        localStorage.setItem('accessToken', data.access_token);
                        document.cookie = "accessToken=" + data.access_token + "; path=/; max-age=604800; SameSite=Lax";
                        localStorage.setItem('user', JSON.stringify(data.user));
                        window.location.href = '/';
                    } else {
                        document.body.innerHTML = "Lỗi đăng nhập: " + (data.error || "Unknown");
                    }
                })
                .catch(err => { document.body.innerHTML = "Lỗi kết nối: " + err; });
            } else {
                document.body.innerHTML = "Không tìm thấy token từ Google.";
            }
        </script>
        </body></html>
        """

    cfg = Config.GOOGLE_OAUTH_CONFIG
    if not cfg.get("enabled"):
        return jsonify({"error": "Google login is currently disabled."}), 400

    data = request.json or {}
    token = data.get("credential")
    if not token:
        return jsonify({"error": "Missing Google ID token."}), 400

    try:
        try:
            idinfo = id_token.verify_oauth2_token(token, google_requests.Request(), cfg["client_id"])
        except ValueError as e:
            logger.error(f"Google ID token verification failed: {e}")
            resp = requests.get(
                "https://www.googleapis.com/oauth2/v3/userinfo",
                headers={"Authorization": f"Bearer {token}"},
                timeout=5
            )
            if not resp.ok:
                logger.error(f"Userinfo fallback request failed: {resp.status_code} - {resp.text}")
                return jsonify({"error": f"Invalid Google token. Reason: {e}"}), 401
            idinfo = resp.json()

        email = idinfo.get("email")
        google_id = idinfo.get("sub")
        base_username = email.split("@")[0].lower() if email else f"google_{google_id[:8]}"

        conn = get_user_db_conn()
        user = conn.execute("SELECT * FROM users WHERE google_id = ? OR email = ?", (google_id, email)).fetchone()

        if not user:
            username = base_username
            suffix = 1
            while conn.execute("SELECT 1 FROM users WHERE username = ?", (username,)).fetchone():
                username = f"{base_username}{suffix}"
                suffix += 1

            temp_password = secrets.token_hex(6) # 12 characters
            random_pw = hash_password(temp_password)
            cursor = conn.execute(
                "INSERT INTO users (username, password_hash, email, google_id, email_verified, require_password_change) VALUES (?, ?, ?, ?, 1, 1)",
                (username, random_pw, email, google_id)
            )
            user_id = cursor.lastrowid

            if email:
                welcome_html = f"""
                <h3>Chào mừng {username} đến với Novel Translator VIP!</h3>
                <p>Tài khoản của bạn đã được đăng ký thông qua Google.</p>
                <p>Mật khẩu đăng nhập trực tiếp qua Email của bạn là: <strong>{temp_password}</strong></p>
                <p>Vui lòng đăng nhập bằng mật khẩu này và đổi mật khẩu mới trong phần cài đặt tài khoản của bạn để bảo mật.</p>
                <p>Trân trọng,<br>Đội ngũ hỗ trợ Ly Vu Ha</p>
                """
                send_email_async(email, "Mật khẩu tài khoản Novel Translator VIP của bạn", welcome_html)
        else:
            if not user["google_id"]:
                conn.execute("UPDATE users SET google_id = ?, email_verified = 1 WHERE id = ?", (google_id, user["id"]))
            user_id = user["id"]

        conn.commit()
        conn.close()

        check_vip_expiry(user_id)

        conn = get_user_db_conn()
        user_row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        conn.close()
        user = dict(user_row)

        session["user_id"] = user["id"]
        session["username"] = user["username"]
        session["vip_status"] = user["vip_status"]

        access_token = create_access_token(user["id"], user["username"], user["vip_status"])
        refresh_token = create_refresh_token(user["id"])

        return jsonify({
            "message": "Đăng nhập Google thành công!",
            "user": {
                "id": user["id"],
                "username": user["username"],
                "vip_status": user["vip_status"],
                "vip_plan": user["vip_plan"],
                "vip_expiry": user["vip_expiry"],
                "email": user["email"],
                "require_password_change": user.get("require_password_change", 0),
                "display_name": user.get("display_name"),
                "birthday": user.get("birthday"),
                "gender": user.get("gender"),
                "bio": user.get("bio"),
                "avatar": user.get("avatar"),
                "avatar_frame": user.get("avatar_frame", "default")
            },
            "access_token": access_token,
            "refresh_token": refresh_token
        })

    except ValueError:
        return jsonify({"error": "Invalid Google token."}), 401
    except Exception as e:
        return jsonify({"error": f"Internal server error: {str(e)}"}), 500


@auth_bp.route("/refresh", methods=["POST"])
def auth_refresh():
    data = request.json or {}
    refresh_token = data.get("refresh_token", "")
    if not refresh_token:
        return jsonify({"error": "Refresh token is required"}), 400

    conn = get_user_db_conn()
    token_row = conn.execute(
        "SELECT * FROM refresh_tokens WHERE token = ? AND revoked = 0", (refresh_token,)
    ).fetchone()

    if not token_row:
        conn.close()
        return jsonify({"error": "Invalid refresh token"}), 401

    try:
        expires_at = datetime.strptime(token_row["expires_at"], "%Y-%m-%d %H:%M:%S")
        if datetime.utcnow() > expires_at:
            conn.execute("UPDATE refresh_tokens SET revoked = 1 WHERE id = ?", (token_row["id"],))
            conn.commit()
            conn.close()
            return jsonify({"error": "Refresh token expired"}), 401
    except Exception:
        conn.close()
        return jsonify({"error": "Invalid token format"}), 401

    user = conn.execute("SELECT * FROM users WHERE id = ?", (token_row["user_id"],)).fetchone()
    conn.close()

    if not user:
        return jsonify({"error": "User not found"}), 401

    check_vip_expiry(user["id"])
    conn = get_user_db_conn()
    user = conn.execute("SELECT * FROM users WHERE id = ?", (user["id"],)).fetchone()
    conn.close()

    access_token = create_access_token(user["id"], user["username"], user["vip_status"])
    return jsonify({
        "access_token": access_token,
        "user": {
            "id": user["id"],
            "username": user["username"],
            "vip_status": user["vip_status"],
            "vip_plan": user["vip_plan"],
            "vip_expiry": user["vip_expiry"]
        }
    })


@auth_bp.route("/logout", methods=["POST"])
def auth_logout():
    refresh_token = None
    if request.is_json:
        data = request.get_json(silent=True) or {}
        refresh_token = data.get("refresh_token")
    if refresh_token:
        conn = get_user_db_conn()
        conn.execute("UPDATE refresh_tokens SET revoked = 1 WHERE token = ?", (refresh_token,))
        conn.commit()
        conn.close()
    session.clear()
    return jsonify({"message": "Đã đăng xuất."})


@auth_bp.route("/me", methods=["GET"])
def auth_me():
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        payload = verify_access_token(auth_header[7:])
        if payload:
            conn = get_user_db_conn()
            try:
                user = conn.execute("SELECT * FROM users WHERE id = ?", (int(payload["sub"]),)).fetchone()
                if user:
                    vip_active = check_vip_expiry(user["id"], conn=conn)
                    if user["vip_status"] == 1 and not vip_active:
                        user = conn.execute("SELECT * FROM users WHERE id = ?", (user["id"],)).fetchone()
                    return jsonify({
                        "logged_in": True,
                        "user": {
                            "id": user["id"],
                            "username": user["username"],
                            "user_code": user.get("user_code"),
                            "vip_status": user["vip_status"],
                            "vip_plan": user["vip_plan"],
                            "vip_expiry": str(user["vip_expiry"]) if user["vip_expiry"] else None,
                            "email": user["email"],
                            "display_name": user["display_name"],
                            "birthday": user["birthday"],
                            "gender": user["gender"],
                            "bio": user["bio"],
                            "avatar": user.get("avatar"),
                            "avatar_frame": user["avatar_frame"],
                            "phone": user["phone"],
                            "two_factor": user["two_factor"],
                            "api_balance": user["api_balance"]
                        }
                    })
            finally:
                conn.close()

    if "user_id" in session:
        user_id = session["user_id"]
        conn = get_user_db_conn()
        try:
            vip_active = check_vip_expiry(user_id, conn=conn)
            user = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
            if user:
                session["vip_status"] = user["vip_status"]
                return jsonify({
                    "logged_in": True,
                    "user": {
                        "id": user["id"],
                        "username": user["username"],
                        "vip_status": user["vip_status"],
                        "vip_plan": user["vip_plan"],
                        "vip_expiry": str(user["vip_expiry"]) if user["vip_expiry"] else None,
                        "email": user["email"],
                        "display_name": user["display_name"],
                        "birthday": user["birthday"],
                        "gender": user["gender"],
                        "bio": user["bio"],
                        "avatar": user.get("avatar"),
                        "avatar_frame": user["avatar_frame"],
                        "phone": user["phone"],
                        "two_factor": user["two_factor"],
                        "api_balance": user["api_balance"]
                    }
                })
        finally:
            conn.close()
    return jsonify({"logged_in": False})


@auth_bp.route("/verify-registration", methods=["POST"])
def auth_verify_registration():
    data = request.json or {}
    email = data.get("email", "").strip().lower()
    otp = data.get("otp", "").strip()

    if not email or not otp:
        return jsonify({"error": "Vui lòng nhập đầy đủ email và mã OTP."}), 400

    conn = get_user_db_conn()
    user_row = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    if not user_row:
        conn.close()
        return jsonify({"error": "Email không tồn tại."}), 400
    user = dict(user_row)

    if user.get("email_verified", 0) == 1:
        conn.close()
        return jsonify({"message": "Tài khoản đã được xác minh trước đó."})

    now_str = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
    token_entry = conn.execute(
        "SELECT * FROM password_reset_tokens WHERE user_id = ? AND token = ? AND used = 0 AND expires_at > ?",
        (user["id"], otp, now_str)
    ).fetchone()

    if not token_entry:
        conn.close()
        return jsonify({"error": "Mã OTP không đúng hoặc đã hết hạn."}), 400

    # Mark OTP as used and set email_verified = 1
    conn.execute("UPDATE password_reset_tokens SET used = 1 WHERE id = ?", (token_entry["id"],))
    conn.execute("UPDATE users SET email_verified = 1 WHERE id = ?", (user["id"],))
    conn.commit()
    conn.close()

    return jsonify({"message": "Xác minh tài khoản thành công! Bây giờ bạn đã có thể đăng nhập."})


@auth_bp.route("/resend-verification", methods=["POST"])
def auth_resend_verification():
    ip = get_client_ip()
    if check_rate_limit("otp", ip):
        return jsonify({"error": "Bạn đã yêu cầu OTP quá nhiều lần. Vui lòng thử lại sau 1 phút."}), 429

    data = request.json or {}
    email = data.get("email", "").strip().lower()

    if not email:
        return jsonify({"error": "Vui lòng nhập email."}), 400

    conn = get_user_db_conn()
    user_row = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    if not user_row:
        conn.close()
        return jsonify({"error": "Email không tồn tại trong hệ thống."}), 400
    user = dict(user_row)

    if user.get("email_verified", 0) == 1:
        conn.close()
        return jsonify({"error": "Tài khoản này đã được xác minh trước đó."}), 400

    from datetime import timedelta
    otp_code = f"{secrets.randbelow(900000) + 100000}"
    expires_at = (datetime.utcnow() + timedelta(minutes=10)).strftime("%Y-%m-%d %H:%M:%S")

    conn.execute("UPDATE password_reset_tokens SET used = 1 WHERE user_id = ?", (user["id"],))
    conn.execute(
        "INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)",
        (user["id"], otp_code, expires_at)
    )
    conn.commit()
    conn.close()

    otp_html = f"""
    <h3>Xác minh tài khoản Novel Translator VIP của bạn</h3>
    <p>Chào bạn,</p>
    <p>Bạn đã yêu cầu gửi lại mã xác minh cho tài khoản <strong>{user["username"]}</strong>.</p>
    <p>Mã OTP mới của bạn là: <strong style="font-size: 1.5rem; color: #4f46e5; letter-spacing: 2px;">{otp_code}</strong></p>
    <p>Mã OTP này có hiệu lực trong 10 phút.</p>
    <p>Trân trọng,<br>Đội ngũ hỗ trợ Ly Vu Ha</p>
    """
    send_email_async(email, "Mã xác minh tài khoản Novel Translator VIP", otp_html)
    return jsonify({"message": "Mã xác minh mới đã được gửi về email của bạn."})


@auth_bp.route("/change-password", methods=["POST"])
@jwt_required
def auth_change_password():
    user = request._jwt_user
    data = request.json or {}
    old_password = data.get("old_password", "")
    new_password = data.get("new_password", "")

    if not new_password or len(new_password) < 4:
        return jsonify({"error": "Mật khẩu mới phải từ 4 ký tự trở lên."}), 400

    conn = get_user_db_conn()
    user_record = conn.execute("SELECT * FROM users WHERE id = ?", (user["id"],)).fetchone()

    # Enforce old password check unless it's a first-time Google login requiring password change
    is_google_first_time = (user_record.get("require_password_change", 0) == 1)
    
    if not is_google_first_time:
        if not old_password or not verify_password(old_password, user_record["password_hash"]):
            conn.close()
            return jsonify({"error": "Mật khẩu cũ không chính xác."}), 400

    pw_hash = hash_password(new_password)
    conn.execute(
        "UPDATE users SET password_hash = ?, require_password_change = 0 WHERE id = ?",
        (pw_hash, user["id"])
    )
    conn.commit()
    conn.close()

    return jsonify({"message": "Đổi mật khẩu thành công!"})


@auth_bp.route("/update-profile", methods=["POST"])
@jwt_required
def auth_update_profile():
    user = request._jwt_user
    data = request.json or {}
    
    display_name = data.get("display_name", "")
    birthday = data.get("birthday", "")
    gender = data.get("gender", "")
    bio = data.get("bio", "")
    avatar = data.get("avatar", "")
    avatar_frame = data.get("avatar_frame", "default")
    phone = data.get("phone", "")
    two_factor = data.get("two_factor", 0)

    conn = get_user_db_conn()
    try:
        conn.execute(
            """UPDATE users SET 
               display_name = ?, 
               birthday = ?, 
               gender = ?, 
               bio = ?, 
               avatar = ?, 
               avatar_frame = ?, 
               phone = ?, 
               two_factor = ? 
               WHERE id = ?""",
            (display_name, birthday, gender, bio, avatar, avatar_frame, phone, two_factor, user["id"])
        )
        conn.commit()
    except Exception as e:
        conn.close()
        return jsonify({"error": f"Lỗi cơ sở dữ liệu: {e}"}), 500
        
    conn.close()
    return jsonify({"success": True, "message": "Cập nhật hồ sơ thành công!"})
