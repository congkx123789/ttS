import requests
import random
from config import BACKEND_URL

def test_developer_console():
    print("\n🛠️ Running Developer Console Tests...")
    
    rand_id = random.randint(100000, 999999)
    username = f"dev_user_{rand_id}"
    email = f"dev_user_{rand_id}@example.com"
    password = f"secret_pass_{rand_id}"
    
    # Register and login to get JWT
    requests.post(f"{BACKEND_URL}/api/auth/register", json={
        "username": username,
        "email": email,
        "password": password
    })
    login_res = requests.post(f"{BACKEND_URL}/api/auth/login", json={
        "username": username,
        "password": password
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # 1. Create a key
    key_name = "Python Suite Test Key"
    print(f"  [+] Creating developer key: '{key_name}'")
    res_create = requests.post(
        f"{BACKEND_URL}/api/developer/keys/create", 
        json={"name": key_name}, 
        headers=headers
    )
    print(f"      Response: {res_create.status_code} | {res_create.json()}")
    assert res_create.status_code == 200, "Failed to create API key"
    api_key = res_create.json()["api_key"]
    
    # 2. List keys
    print(f"  [+] Fetching developer keys list")
    res_list = requests.get(f"{BACKEND_URL}/api/developer/keys", headers=headers)
    print(f"      Response: {res_list.status_code} | Keys found: {len(res_list.json().get('keys', []))}")
    assert res_list.status_code == 200, "Failed to retrieve API keys list"
    keys = res_list.json()["keys"]
    matching_keys = [k for k in keys if k["api_key"] == api_key]
    assert len(matching_keys) == 1, "Created key not found in keys list"
    print(f"      Verified: Created key is present in keys list.")
    
    # 3. Revoke/Delete the key
    print(f"  [+] Revoking developer key: {api_key[:12]}...")
    res_delete = requests.post(
        f"{BACKEND_URL}/api/developer/keys/delete", 
        json={"api_key": api_key}, 
        headers=headers
    )
    print(f"      Response: {res_delete.status_code} | {res_delete.json()}")
    assert res_delete.status_code == 200, "Failed to revoke API key"
    
    # 4. List keys again to verify removal
    print(f"  [+] Fetching keys list again to verify revocation")
    res_list2 = requests.get(f"{BACKEND_URL}/api/developer/keys", headers=headers)
    keys2 = res_list2.json().get("keys", [])
    matching_keys2 = [k for k in keys2 if k["api_key"] == api_key]
    assert len(matching_keys2) == 0, "Revoked key is still present in keys list"
    print(f"      Verified: Revoked key is no longer in keys list.")
    
    print("✅ Developer Console Tests Completed successfully!")

if __name__ == "__main__":
    test_developer_console()
