import os
import re
from datetime import datetime
from flask import Blueprint, request, jsonify, session
from backend.config import Config
from backend.core.decorators import get_current_user
from backend.core.security import verify_access_token
from backend.core.rate_limit import check_rate_limit, get_client_ip
from backend.database.db_manager import get_user_db_conn
from backend.services.payment_service import (
    create_payment_order, confirm_payment, verify_payos_webhook_signature
)
from backend.services.auth_service import check_vip_expiry, activate_vip

payment_bp = Blueprint("payment", __name__, url_prefix="/api/payment")


def _get_user_id_from_request():
    """Helper to get user_id from session or JWT."""
    user = get_current_user()
    if user:
        return user["id"]
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        payload = verify_access_token(auth_header[7:])
        if payload:
            return int(payload["sub"])
    return None


def _process_payment_webhook(order_id, amount):
    """Internal handler called from the webhook to confirm payment & activate VIP/topup."""
    conn = get_user_db_conn()
    payment = conn.execute(
        "SELECT * FROM payments WHERE order_id = ? AND status = 'pending'", (order_id,)
    ).fetchone()

    if not payment:
        conn.close()
        return jsonify({"error": "Order not found or already processed"}), 404

    if amount > 0 and abs(amount - payment["amount"]) > 100:
        conn.close()
        return jsonify({"error": "Amount mismatch"}), 400

    now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
    conn.execute(
        "UPDATE payments SET status = 'completed', completed_at = ? WHERE id = ?",
        (now, payment["id"])
    )
    conn.commit()
    conn.close()

    if payment["plan"].startswith("topup_"):
        conn = get_user_db_conn()
        conn.execute(
            "UPDATE users SET api_balance = COALESCE(api_balance, 0.0) + ? WHERE id = ?",
            (payment["amount"], payment["user_id"])
        )
        conn.commit()
        conn.close()
        return jsonify({"success": True, "message": f"Nạp thành công {payment['amount']:,}đ vào số dư API!".replace(",", ".")})
    else:
        activate_vip(payment["user_id"], payment["plan"])
        if session.get("user_id") == payment["user_id"]:
            session["vip_status"] = 1
        print(f"[PAYMENT] ✅ Order {order_id} completed — User #{payment['user_id']} → VIP {payment['plan']}")
        return jsonify({"success": True, "message": "Payment confirmed, VIP activated!"})


@payment_bp.route("/plans", methods=["GET"])
def api_payment_plans():
    lang = request.args.get("lang", "vi")
    plans = []
    for key, plan in Config.VIP_PLANS.items():
        plans.append({
            "id": key,
            "name": plan.get(f"name_{lang}", plan["name_vi"]),
            "description": plan.get(f"description_{lang}", plan["description_vi"]),
            "price": plan["price"],
            "price_formatted": f"{plan['price']:,}đ".replace(",", "."),
            "duration_days": plan["duration_days"],
        })
    return jsonify({"plans": plans})


@payment_bp.route("/create", methods=["POST"])
def api_payment_create():
    user_id = _get_user_id_from_request()
    if not user_id:
        return jsonify({"error": "Vui lòng đăng nhập để mua VIP."}), 401

    ip = get_client_ip()
    if check_rate_limit("payment", ip):
        return jsonify({"error": "Bạn đã tạo quá nhiều đơn hàng. Vui lòng thử lại sau."}), 429

    data = request.json or {}
    plan = data.get("plan", "month")

    result, status_code = create_payment_order(user_id, plan)
    return jsonify(result), status_code


@payment_bp.route("/status/<order_id>", methods=["GET"])
def api_payment_status(order_id):
    user_id = _get_user_id_from_request()

    conn = get_user_db_conn()
    if user_id:
        payment = conn.execute(
            "SELECT * FROM payments WHERE order_id = ? AND user_id = ?", (order_id, user_id)
        ).fetchone()
    else:
        payment = conn.execute(
            "SELECT * FROM payments WHERE order_id = ?", (order_id,)
        ).fetchone()
    conn.close()

    if not payment:
        return jsonify({"error": "Payment order not found."}), 404

    return jsonify({
        "order_id": payment["order_id"],
        "plan": payment["plan"],
        "amount": payment["amount"],
        "status": payment["status"],
        "created_at": payment["created_at"],
        "completed_at": payment["completed_at"]
    })


@payment_bp.route("/webhook", methods=["POST"])
def api_payment_webhook():
    # Verify PAYMENT_WEBHOOK_KEY if set in environment
    webhook_key = os.environ.get("PAYMENT_WEBHOOK_KEY", "")
    if webhook_key:
        auth_header = request.headers.get("Authorization", "")
        provided_key = auth_header.replace("Bearer ", "").replace("Apikey ", "").strip()
        query_key = request.args.get("webhook_key", "")
        if provided_key != webhook_key and query_key != webhook_key:
            return jsonify({"error": "Unauthorized webhook request"}), 401

    data = request.json or {}

    # PayOS format
    if "data" in data and "orderCode" in data.get("data", {}):
        order_code = str(data["data"]["orderCode"])
        amount = data["data"].get("amount", 0)
        checksum_key = Config.PAYMENT_CONFIG.get("payos_checksum_key", "")
        if checksum_key and "signature" in data:
            if not verify_payos_webhook_signature(data["data"], data.get("signature", ""), checksum_key):
                return jsonify({"error": "Invalid signature"}), 403
        return _process_payment_webhook(order_code, amount)

    # SePay / Generic format
    if "transferAmount" in data:
        content = data.get("content", "")
        amount = data.get("transferAmount", 0)
        match = re.search(r"(VIP\w+)", content.upper())
        if match:
            return _process_payment_webhook(match.group(1), amount)

    # Simple manual format
    order_id = data.get("order_id", "")
    if order_id:
        return _process_payment_webhook(order_id, data.get("amount", 0))

    return jsonify({"error": "Invalid webhook payload"}), 400


@payment_bp.route("/confirm-manual", methods=["POST"])
def api_payment_confirm_manual():
    data = request.json or {}
    admin_key = data.get("admin_key", "")
    order_id = data.get("order_id", "")
    ADMIN_KEY = os.environ.get("ADMIN_PAYMENT_KEY", "LYVUHA_ADMIN_2026")
    if admin_key != ADMIN_KEY:
        return jsonify({"error": "Unauthorized"}), 403
    if not order_id:
        return jsonify({"error": "order_id is required"}), 400
    return _process_payment_webhook(order_id, 0)


@payment_bp.route("/history", methods=["GET"])
def api_payment_history():
    user_id = _get_user_id_from_request()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    conn = get_user_db_conn()
    payments = conn.execute(
        "SELECT order_id, plan, amount, status, created_at, completed_at FROM payments WHERE user_id = ? ORDER BY created_at DESC LIMIT 20",
        (user_id,)
    ).fetchall()
    conn.close()
    return jsonify({"payments": [dict(p) for p in payments]})


@payment_bp.route("/vip-status", methods=["GET"])
def api_user_vip_status():
    user_id = _get_user_id_from_request()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    check_vip_expiry(user_id)
    conn = get_user_db_conn()
    user = conn.execute("SELECT vip_status, vip_plan, vip_expiry FROM users WHERE id = ?", (user_id,)).fetchone()
    conn.close()

    if not user:
        return jsonify({"error": "User not found"}), 404

    days_remaining = 0
    if user["vip_expiry"]:
        try:
            expiry = datetime.strptime(user["vip_expiry"], "%Y-%m-%d %H:%M:%S")
            days_remaining = max(0, (expiry - datetime.utcnow()).days)
        except Exception:
            pass

    return jsonify({
        "vip_status": user["vip_status"],
        "vip_plan": user["vip_plan"],
        "vip_expiry": user["vip_expiry"],
        "days_remaining": days_remaining,
        "is_active": user["vip_status"] == 1
    })
