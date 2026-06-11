import time
import json
import hmac
import hashlib
import requests
import sqlite3
from datetime import datetime
from backend.config import Config
from backend.database.db_manager import get_user_db_conn
from backend.services.auth_service import activate_vip

def verify_payos_webhook_signature(payload_data, expected_signature, checksum_key):
    """Verify PayOS webhook signature using alphabet-sorted query string."""
    sorted_keys = sorted(payload_data.keys())
    parts = []
    for k in sorted_keys:
        v = payload_data[k]
        if v is None or v == "null" or v == "undefined":
            v_str = ""
        elif isinstance(v, list):
            sorted_list = []
            for item in v:
                if isinstance(item, dict):
                    sorted_item = {sub_k: item[sub_k] for sub_k in sorted(item.keys())}
                    sorted_list.append(sorted_item)
                else:
                    sorted_list.append(item)
            v_str = json.dumps(sorted_list, separators=(',', ':'), ensure_ascii=False)
        elif isinstance(v, dict):
            sorted_dict = {sub_k: v[sub_k] for sub_k in sorted(v.keys())}
            v_str = json.dumps(sorted_dict, separators=(',', ':'), ensure_ascii=False)
        else:
            v_str = str(v)
        parts.append(f"{k}={v_str}")
        
    query_str = "&".join(parts)
    computed_sig = hmac.new(
        checksum_key.encode(), query_str.encode(), hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(computed_sig, expected_signature)

def create_payment_order(user_id: int, plan: str):
    """Generates a payment order and produces the relevant PayOS link or fallback VietQR."""
    plan_info = Config.VIP_PLANS.get(plan)
    if not plan_info:
        if plan.startswith("topup_"):
            try:
                price_str = plan.split("_")[1]
                if price_str.endswith("k"):
                    amount = int(price_str[:-1]) * 1000
                else:
                    amount = int(price_str)
                plan_info = {
                    "name_vi": f"Nạp số dư API {amount:,}đ".replace(",", "."),
                    "price": amount
                }
            except Exception:
                return {"error": "Invalid topup plan name. Use e.g. topup_50k or topup_50000"}, 400
        else:
            return {"error": "Invalid plan name"}, 400
        
    amount = plan_info["price"]
    order_code_int = int(time.time()) * 1000 + (int(user_id) % 1000)
    order_id = str(order_code_int)
    
    # Save to database
    conn = get_user_db_conn()
    conn.execute(
        "INSERT INTO payments (user_id, order_id, plan, amount, status) VALUES (?, ?, ?, ?, 'pending')",
        (user_id, order_id, plan, amount)
    )
    conn.commit()
    conn.close()
    
    payos_data = None
    pay_cfg = Config.PAYMENT_CONFIG
    client_id = pay_cfg.get("payos_client_id")
    api_key = pay_cfg.get("payos_api_key")
    checksum_key = pay_cfg.get("payos_checksum_key")
    
    if client_id and api_key and checksum_key:
        cancel_url = pay_cfg.get("payos_webhook_url").replace("/api/payment/webhook", "") or "http://localhost:5050"
        return_url = pay_cfg.get("payos_webhook_url").replace("/api/payment/webhook", "") or "http://localhost:5050"
        description = f"VIP {plan_info.get('name_vi', 'Premium')}"[:25]
        
        raw_str = f"amount={amount}&cancelUrl={cancel_url}&description={description}&orderCode={order_code_int}&returnUrl={return_url}"
        signature = hmac.new(
            checksum_key.encode(), raw_str.encode(), hashlib.sha256
        ).hexdigest()
        
        payload = {
            "orderCode": order_code_int,
            "amount": amount,
            "description": description,
            "cancelUrl": cancel_url,
            "returnUrl": return_url,
            "signature": signature
        }
        
        headers = {
            "x-client-id": client_id,
            "x-api-key": api_key,
            "Content-Type": "application/json"
        }
        
        try:
            r = requests.post(
                "https://api-merchant.payos.vn/v2/payment-requests",
                json=payload,
                headers=headers,
                timeout=10
            )
            res = r.json()
            if r.status_code == 200 and res.get("code") == "00":
                payos_data = res.get("data")
        except Exception as e:
            print(f"[PayOS Request Exception]: {e}")
            
    # Generate QR URL (Using PayOS hosted qrCode if available, else fallback to standard VietQR)
    if payos_data and payos_data.get("qrCode"):
        qr_url = f"https://api.qrserver.com/v1/create-qr-code/?size=250x250&data={requests.utils.quote(payos_data['qrCode'])}"
        checkout_url = payos_data.get("checkoutUrl")
        payos_bank = payos_data.get("bin", pay_cfg["bank_id"])
        payos_account_no = payos_data.get("accountNumber", pay_cfg["account_no"])
        payos_account_name = payos_data.get("accountName", pay_cfg["account_name"])
    else:
        transfer_content = order_id
        qr_url = (
            f"https://img.vietqr.io/image/{pay_cfg['bank_id']}-{pay_cfg['account_no']}-{pay_cfg['template']}.png"
            f"?amount={amount}"
            f"&addInfo={transfer_content}"
            f"&accountName={pay_cfg['account_name'].replace(' ', '%20')}"
        )
        checkout_url = None
        payos_bank = pay_cfg["bank_id"]
        payos_account_no = pay_cfg["account_no"]
        payos_account_name = pay_cfg["account_name"]
        
    return {
        "order_id": order_id,
        "plan": plan,
        "amount": amount,
        "amount_formatted": f"{amount:,}đ".replace(",", "."),
        "qr_url": qr_url,
        "checkout_url": checkout_url,
        "bank_info": {
            "bank": payos_bank,
            "account_no": payos_account_no,
            "account_name": payos_account_name,
            "transfer_content": order_id,
        },
        "expires_in": 900,
        "message": f"Quét mã QR hoặc chuyển khoản {amount:,}đ với nội dung: {order_id}".replace(",", ".")
    }, 200

def confirm_payment(order_id: str, amount: float = 0.0) -> bool:
    """Updates the status of a pending payment order to completed and activates VIP."""
    try:
        conn = get_user_db_conn()
        conn.row_factory = sqlite3.Row
        payment = conn.execute(
            "SELECT * FROM payments WHERE order_id = ? AND status = 'pending'", (order_id,)
        ).fetchone()
        
        if not payment:
            conn.close()
            print(f"⚠️ Payment {order_id} not found or already processed.")
            return False
            
        # Optional validation check for amount consistency
        if amount > 0 and abs(amount - payment["amount"]) > 100:
            conn.close()
            print(f"❌ Amount mismatch for {order_id}: expected {payment['amount']}, got {amount}")
            return False

        now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        conn.execute(
            "UPDATE payments SET status = 'completed', completed_at = ? WHERE id = ?",
            (now, payment["id"])
        )
        conn.commit()
        conn.close()
        
        user_id = payment["user_id"]
        plan = payment["plan"]
        
        # Activate VIP status for user
        success = activate_vip(user_id, plan)
        if success:
            print(f"✅ [Payment Confirmation] Confirmed payment {order_id} & activated VIP.")
            return True
        return False
    except Exception as e:
        print(f"❌ Error confirming payment: {e}")
        return False
