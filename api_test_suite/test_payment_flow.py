import requests
import random
import psycopg2
from config import BACKEND_URL, DB_URL

def test_payment_flow():
    print("\n💳 Running Payment & VIP Billing Tests...")
    
    rand_id = random.randint(100000, 999999)
    username = f"pay_user_{rand_id}"
    email = f"pay_user_{rand_id}@example.com"
    password = f"secret_pass_{rand_id}"
    
    # Register test user
    requests.post(f"{BACKEND_URL}/api/auth/register", json={
        "username": username,
        "email": email,
        "password": password
    })
    
    # Login to get JWT
    login_res = requests.post(f"{BACKEND_URL}/api/auth/login", json={
        "username": username,
        "password": password
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # Verify initial VIP status is 0
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    cur.execute("SELECT vip_status FROM users WHERE email = %s", (email,))
    initial_vip = cur.fetchone()[0]
    conn.close()
    print(f"  [+] Initial VIP status: {initial_vip} (expected: 0)")
    assert initial_vip == 0 or initial_vip is None, "User should not be VIP initially"
    
    # 1. Create a payment order
    print(f"  [+] Creating payment order for VIP Month Plan")
    res_create = requests.post(
        f"{BACKEND_URL}/api/payment/create",
        json={"plan": "month"},
        headers=headers
    )
    print(f"      Response: {res_create.status_code} | {res_create.json()}")
    assert res_create.status_code == 200, "Failed to create payment"
    body = res_create.json()
    order_id = body["order_id"]
    qr_url = body["qr_url"]
    assert qr_url.startswith("http"), "Invalid QR code URL"
    print(f"      Created Order ID: {order_id} | QR URL: {qr_url[:40]}...")
    
    # 2. Check pending status
    print(f"  [+] Checking payment status for Order ID: {order_id}")
    res_status = requests.get(f"{BACKEND_URL}/api/payment/status/{order_id}")
    print(f"      Response: {res_status.status_code} | Status: {res_status.json().get('status')}")
    assert res_status.status_code == 200, "Failed to fetch status"
    assert res_status.json()["status"] == "pending", "Order status should be pending initially"
    
    # 3. Confirm payment manually (Admin confirmation simulation)
    print(f"  [+] Confirming payment manually using admin key...")
    res_confirm = requests.post(f"{BACKEND_URL}/api/payment/confirm-manual", json={
        "order_id": order_id,
        "admin_key": "LYVUHA_ADMIN_2026"
    })
    print(f"      Response: {res_confirm.status_code} | {res_confirm.json()}")
    assert res_confirm.status_code == 200, "Failed to confirm payment manually"
    
    # 4. Verify completed status
    print(f"  [+] Checking payment status after confirmation...")
    res_status2 = requests.get(f"{BACKEND_URL}/api/payment/status/{order_id}")
    print(f"      Response: {res_status2.status_code} | Status: {res_status2.json().get('status')}")
    assert res_status2.json()["status"] == "completed", "Order status should be completed after confirmation"
    
    # 5. Verify VIP status update in DB
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    cur.execute("SELECT vip_status FROM users WHERE email = %s", (email,))
    final_vip = cur.fetchone()[0]
    conn.close()
    print(f"  [+] Final VIP status: {final_vip} (expected: 1)")
    assert final_vip == 1, "User did not get upgraded to VIP status"
    
    print("✅ Payment & Billing Tests Completed successfully!")

if __name__ == "__main__":
    test_payment_flow()
