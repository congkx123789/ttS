import requests
import sys

def test_tts_auth_methods(backend_url="http://localhost:5050"):
    print(f"\n🗣️ Running TTS Authentication Methods Test against: {backend_url}")
    
    test_text = "Đại Chu hoàng triều, võ đạo hưng thịnh."
    payload = {
        "input": test_text,
        "speed": 1.0
    }
    
    # Bypass Rate Limit header
    headers_base = {
        "X-Bypass-Rate-Limit": "tienhiep_bypass_secret_9988"
    }

    # 1. Test using X-VIP-Key header with static VIP code
    print("\n  [+] Method 1: Testing X-VIP-Key Header with 'VIP_SERVER'")
    headers = {**headers_base, "X-VIP-Key": "VIP_SERVER"}
    res = requests.post(f"{backend_url}/v1/audio/speech", json=payload, headers=headers)
    print(f"      Status: {res.status_code}")
    if res.status_code == 200:
        print(f"      [✓] Success! Audio size: {len(res.content)} bytes")
    else:
        print(f"      [❌] Failed: {res.text}")
        
    # 2. Test using X-VIP-Code header with static VIP code
    print("\n  [+] Method 2: Testing X-VIP-Code Header with 'VIP_SERVER'")
    headers = {**headers_base, "X-VIP-Code": "VIP_SERVER"}
    res = requests.post(f"{backend_url}/v1/audio/speech", json=payload, headers=headers)
    print(f"      Status: {res.status_code}")
    if res.status_code == 200:
        print(f"      [✓] Success! Audio size: {len(res.content)} bytes")
    else:
        print(f"      [❌] Failed: {res.text}")

    # 3. Test using vip_key parameter in JSON body
    print("\n  [+] Method 3: Testing vip_key in JSON body")
    body_vip = {**payload, "vip_key": "VIP_SERVER"}
    res = requests.post(f"{backend_url}/v1/audio/speech", json=body_vip, headers=headers_base)
    print(f"      Status: {res.status_code}")
    if res.status_code == 200:
        print(f"      [✓] Success! Audio size: {len(res.content)} bytes")
    else:
        print(f"      [❌] Failed: {res.text}")

    # 4. Test invalid / missing key
    print("\n  [+] Method 4: Testing missing auth (should fail)")
    res = requests.post(f"{backend_url}/v1/audio/speech", json=payload, headers=headers_base)
    print(f"      Status: {res.status_code} (Expected: 401)")
    if res.status_code == 401:
        print("      [✓] Correctly rejected with 401 Unauthorized")
    else:
        print(f"      [❌] Unexpected result: {res.status_code}")

if __name__ == "__main__":
    url = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:5050"
    test_tts_auth_methods(url)
