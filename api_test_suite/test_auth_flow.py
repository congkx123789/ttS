import requests
import random
from config import BACKEND_URL

def test_auth_features():
    print("\n🔑 Running Authentication Tests...")
    
    rand_id = random.randint(100000, 999999)
    username = f"user_{rand_id}"
    email = f"user_{rand_id}@example.com"
    password = f"secret_pass_{rand_id}"
    
    # 1. Register new user
    print(f"  [+] Registering user: {username}")
    res = requests.post(f"{BACKEND_URL}/api/auth/register", json={
        "username": username,
        "email": email,
        "password": password
    })
    print(f"      Response: {res.status_code} | {res.json()}")
    assert res.status_code == 200, "Registration failed"
    
    # 2. Register duplicate username
    print(f"  [+] Testing duplicate username registration prevention")
    res_dup = requests.post(f"{BACKEND_URL}/api/auth/register", json={
        "username": username,
        "email": f"different_email_{rand_id}@example.com",
        "password": password
    })
    print(f"      Response (expected error): {res_dup.status_code} | {res_dup.json()}")
    assert res_dup.status_code == 400, "Duplicate username was not blocked"
    assert "Tên tài khoản này đã được sử dụng." in res_dup.json().get("error", ""), "Incorrect error message for duplicate username"

    # 3. Register duplicate email
    print(f"  [+] Testing duplicate email registration prevention")
    res_dup_email = requests.post(f"{BACKEND_URL}/api/auth/register", json={
        "username": f"different_user_{rand_id}",
        "email": email,
        "password": password
    })
    print(f"      Response (expected error): {res_dup_email.status_code} | {res_dup_email.json()}")
    assert res_dup_email.status_code == 400, "Duplicate email was not blocked"
    assert "Email này đã được sử dụng bởi một tài khoản khác." in res_dup_email.json().get("error", ""), "Incorrect error message for duplicate email"
    
    # 3. Login with incorrect password
    print(f"  [+] Testing login with wrong credentials")
    res_wrong = requests.post(f"{BACKEND_URL}/api/auth/login", json={
        "username": username,
        "password": "wrong_password"
    })
    print(f"      Response (expected error): {res_wrong.status_code} | {res_wrong.json()}")
    assert res_wrong.status_code == 401, "Invalid login succeeded"
    
    # 4. Login with correct password
    print(f"  [+] Testing login with correct credentials")
    res_login = requests.post(f"{BACKEND_URL}/api/auth/login", json={
        "username": username,
        "password": password
    })
    print(f"      Response: {res_login.status_code} | Has access_token: {'access_token' in res_login.json()}")
    assert res_login.status_code == 200, "Login failed"
    
    token = res_login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # 5. Fetch profile
    print(f"  [+] Testing profile retrieval (/api/auth/me)")
    res_me = requests.get(f"{BACKEND_URL}/api/auth/me", headers=headers)
    print(f"      Response: {res_me.status_code} | User ID: {res_me.json().get('user', {}).get('id')}")
    assert res_me.status_code == 200, "Profile fetch failed"
    
    # 6. Logout
    print(f"  [+] Testing logout")
    res_logout = requests.post(f"{BACKEND_URL}/api/auth/logout", headers=headers)
    print(f"      Response: {res_logout.status_code} | {res_logout.json()}")
    assert res_logout.status_code == 200, "Logout failed"
    
    print("✅ Authentication Tests Completed successfully!")
    return username, email, password

if __name__ == "__main__":
    test_auth_features()
