import requests
import random
import psycopg2
from config import BACKEND_URL, DB_URL

def test_tts_endpoints():
    print("\n🗣️ Running Text-to-Speech (TTS) Tests...")
    
    rand_id = random.randint(100000, 999999)
    username = f"tts_dev_{rand_id}"
    email = f"tts_dev_{rand_id}@example.com"
    password = f"secret_pass_{rand_id}"
    
    # 1. Register and setup VIP status + balance in DB
    print(f"  [+] Creating VIP user with balance: {username}")
    requests.post(f"{BACKEND_URL}/api/auth/register", json={
        "username": username,
        "email": email,
        "password": password
    })
    
    # Enable VIP status and set balance
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    cur.execute("UPDATE users SET vip_status = 1, api_balance = 5000.0 WHERE email = %s", (email,))
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
    key_res = requests.post(f"{BACKEND_URL}/api/developer/keys/create", json={"name": "TTS Test Key"}, headers=headers)
    api_key = key_res.json()["api_key"]
    print(f"      Created API Key: {api_key}")
    
    dev_headers = {"Authorization": f"Bearer {api_key}"}
    
    # 2. Test valid TTS request
    test_text = "武之极，破苍穹，动乾坤！"
    print(f"  [+] Testing TTS speech synthesis: '{test_text}'")
    res_tts = requests.post(f"{BACKEND_URL}/v1/audio/speech", json={
        "input": test_text,
        "speed": 1.0
    }, headers=dev_headers)
    print(f"      Response: {res_tts.status_code} | Content-Type: {res_tts.headers.get('Content-Type')} | Length: {len(res_tts.content)}")
    assert res_tts.status_code == 200, "TTS request failed"
    assert "audio" in res_tts.headers.get("Content-Type", ""), "Invalid Content-Type returned"
    
    # 3. Test speed parameter modification
    print(f"  [+] Testing TTS speech synthesis with speed=1.5x")
    res_tts_speed = requests.post(f"{BACKEND_URL}/v1/audio/speech", json={
        "input": test_text,
        "speed": 1.5
    }, headers=dev_headers)
    print(f"      Response: {res_tts_speed.status_code} | Content-Type: {res_tts_speed.headers.get('Content-Type')} | Length: {len(res_tts_speed.content)}")
    assert res_tts_speed.status_code == 200, "TTS with speed request failed"
    
    # 4. Test wrong API key
    print(f"  [+] Testing TTS with invalid API Key")
    res_invalid_key = requests.post(f"{BACKEND_URL}/v1/audio/speech", json={
        "input": test_text
    }, headers={"Authorization": "Bearer sk-tc-invalidkey123456"})
    print(f"      Response (expected error): {res_invalid_key.status_code} | {res_invalid_key.json()}")
    assert res_invalid_key.status_code == 401, "TTS request with invalid key succeeded"
    
    # 5. Test zero balance
    print(f"  [+] Testing TTS with insufficient balance")
    # Reset balance to 0 in DB
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    cur.execute("UPDATE users SET api_balance = 0.0 WHERE email = %s", (email,))
    conn.commit()
    conn.close()
    
    res_no_bal = requests.post(f"{BACKEND_URL}/v1/audio/speech", json={
        "input": test_text
    }, headers=dev_headers)
    print(f"      Response (expected error): {res_no_bal.status_code} | {res_no_bal.json()}")
    assert res_no_bal.status_code == 402, "TTS request with zero balance succeeded"
    
    print("✅ TTS Tests Completed successfully!")

if __name__ == "__main__":
    test_tts_endpoints()
