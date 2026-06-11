import requests
import random
import psycopg2
from config import BACKEND_URL, DB_URL

def test_otp_and_recovery():
    print("\n📨 Running OTP & Password Recovery Tests...")
    
    rand_id = random.randint(100000, 999999)
    username = f"otp_user_{rand_id}"
    email = f"otp_user_{rand_id}@example.com"
    password = f"old_pass_{rand_id}"
    new_password = f"new_pass_{rand_id}"
    
    # Register test user
    requests.post(f"{BACKEND_URL}/api/auth/register", json={
        "username": username,
        "email": email,
        "password": password
    })
    
    # 1. Request OTP
    print(f"  [+] Requesting OTP for {email}")
    res = requests.post(f"{BACKEND_URL}/api/auth/forgot-password", json={"email": email})
    print(f"      Response: {res.status_code} | {res.json()}")
    assert res.status_code == 200, "Forgot password request failed"
    
    # 2. Get OTP from DB
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    cur.execute("""
        SELECT token FROM password_reset_tokens 
        WHERE user_id = (SELECT id FROM users WHERE email = %s) 
        AND used = 0 
        ORDER BY expires_at DESC LIMIT 1
    """, (email,))
    row = cur.fetchone()
    conn.close()
    
    assert row is not None, "Failed to retrieve OTP from database"
    otp_code = row[0]
    print(f"      Retrieved OTP from DB: {otp_code}")
    
    # 3. Test wrong OTP
    print(f"  [+] Resetting password with WRONG OTP")
    res_wrong = requests.post(f"{BACKEND_URL}/api/auth/reset-password", json={
        "email": email,
        "otp": "999999",
        "password": new_password
    })
    print(f"      Response (expected error): {res_wrong.status_code} | {res_wrong.json()}")
    assert res_wrong.status_code == 400, "Password reset with wrong OTP was not blocked"
    
    # 4. Test correct OTP
    print(f"  [+] Resetting password with CORRECT OTP")
    res_correct = requests.post(f"{BACKEND_URL}/api/auth/reset-password", json={
        "email": email,
        "otp": otp_code,
        "password": new_password
    })
    print(f"      Response: {res_correct.status_code} | {res_correct.json()}")
    assert res_correct.status_code == 200, "Password reset failed"
    
    # 5. Verify login with new password
    print(f"  [+] Logging in with new password")
    res_login = requests.post(f"{BACKEND_URL}/api/auth/login", json={
        "username": username,
        "password": new_password
    })
    print(f"      Response: {res_login.status_code} | Has access_token: {'access_token' in res_login.json()}")
    assert res_login.status_code == 200, "Login with new password failed"
    
    print("✅ OTP Recovery Tests Completed successfully!")

if __name__ == "__main__":
    test_otp_and_recovery()
