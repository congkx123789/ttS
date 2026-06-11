import requests
import random
import psycopg2
from config import BACKEND_URL, DB_URL

def test_translation_endpoints():
    print("\n⛩️ Running Translation API Tests...")
    
    rand_id = random.randint(100000, 999999)
    username = f"trans_dev_{rand_id}"
    email = f"trans_dev_{rand_id}@example.com"
    password = f"secret_pass_{rand_id}"
    
    # Register and setup VIP status + balance in DB
    requests.post(f"{BACKEND_URL}/api/auth/register", json={
        "username": username,
        "email": email,
        "password": password
    })
    
    initial_balance = 2000.0
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    cur.execute("UPDATE users SET vip_status = 1, api_balance = %s WHERE email = %s", (initial_balance, email))
    conn.commit()
    conn.close()
    
    # Login to get JWT
    login_res = requests.post(f"{BACKEND_URL}/api/auth/login", json={
        "username": username,
        "password": password
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # Create developer key
    key_res = requests.post(f"{BACKEND_URL}/api/developer/keys/create", json={"name": "Translation Test Key"}, headers=headers)
    api_key = key_res.json()["api_key"]
    dev_headers = {"Authorization": f"Bearer {api_key}"}
    
    # 1. Test translation in fast mode
    chinese_texts = ["第一章", "叶凡迈步走入大厅。"]
    print(f"  [+] Testing fast translation for: {chinese_texts}")
    res_fast = requests.post(f"{BACKEND_URL}/api/v1/translate", json={
        "texts": chinese_texts,
        "mode": "fast"
    }, headers=dev_headers)
    print(f"      Response: {res_fast.status_code} | {res_fast.json()}")
    assert res_fast.status_code == 200, "Fast translation failed"
    body = res_fast.json()
    assert "translations" in body, "No translations key in response"
    assert len(body["translations"]) == 2, "Mismatch in translation count"
    
    # 2. Test translation in vietphrase mode
    print(f"  [+] Testing smooth/vietphrase translation mode")
    res_vp = requests.post(f"{BACKEND_URL}/api/v1/translate", json={
        "texts": chinese_texts,
        "mode": "vietphrase"
    }, headers=dev_headers)
    print(f"      Response: {res_vp.status_code} | {res_vp.json()}")
    assert res_vp.status_code == 200, "Vietphrase translation failed"
    
    # 3. Verify balance deduction
    print(f"  [+] Verifying balance deduction for API calls")
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    cur.execute("SELECT api_balance FROM users WHERE email = %s", (email,))
    final_balance = cur.fetchone()[0]
    conn.close()
    
    print(f"      Initial Balance: {initial_balance:.2f}đ | Final Balance: {final_balance:.2f}đ")
    assert final_balance < initial_balance, "Balance was not deducted"
    print(f"      Verified: Balance successfully deducted by {initial_balance - final_balance:.2f}đ")
    
    print("✅ Translation Tests Completed successfully!")

if __name__ == "__main__":
    test_translation_endpoints()
