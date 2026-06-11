import re
import base64
import time
import email
import imaplib
import os
import sqlite3
import threading
from email.header import decode_header
from datetime import datetime
from backend.config import Config
from backend.services.email_service import (
    get_gmail_service, send_email_smtp, send_email_gmail_api, SERVICE_ACCOUNT_FILE
)
from backend.database.db_manager import get_user_db_conn

def get_customer_email_by_order(order_id: str):
    try:
        conn = get_user_db_conn()
        conn.row_factory = sqlite3.Row
        row = conn.execute(
            "SELECT u.email FROM payments p JOIN users u ON p.user_id = u.id WHERE p.order_id = ?",
            (order_id,)
        ).fetchone()
        conn.close()
        return row["email"] if row and row["email"] else None
    except Exception:
        return None

def process_bank_email_payload(combined_content: str, send_reply_fn):
    """Parse payment email content and process activation."""
    order_match = re.search(r'(VIP\w+)', combined_content, re.IGNORECASE)
    amount_match = re.search(
        r'(?:S\d+ti\d+n|số tiền|giao dịch|phát sinh|cộng)\s*(?:\+)?\s*([0-9.,]+)\s*(?:VND|đ|d|đ)',
        combined_content, re.IGNORECASE
    )

    if not order_match:
        return False

    from backend.services.payment_service import confirm_payment
    
    order_id = order_match.group(1).upper()
    amount = 0
    if amount_match:
        amount_str = amount_match.group(1).replace('.', '').replace(',', '')
        try:
            amount = float(amount_str)
        except ValueError:
            pass

    print(f"🔍 [Email Worker] Detected transaction. Order ID: {order_id}, parsed amount: {amount}")
    success = confirm_payment(order_id, amount)

    if success:
        customer_email = get_customer_email_by_order(order_id)
        if customer_email:
            reply_subject = f"Xác nhận thanh toán thành công đơn hàng {order_id}"
            reply_html = f"""
            <div style="font-family: sans-serif; padding: 20px; line-height: 1.6;">
                <h2 style="color: #4CAF50;">Thanh toán thành công!</h2>
                <p>Xin chào,</p>
                <p>Hệ thống đã nhận được số tiền chuyển khoản của bạn cho đơn hàng <strong>{order_id}</strong>.</p>
                <p>Tài khoản VIP của bạn đã được nâng cấp và kích hoạt tự động thành công.</p>
                <p>Chúc bạn có những trải nghiệm đọc truyện tuyệt vời!</p>
                <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                <p style="font-size: 12px; color: #888;">Đội ngũ hỗ trợ Ly Vu Ha Novel</p>
            </div>
            """
            send_reply_fn(customer_email, reply_subject, reply_html)
    return success

def check_bank_emails_imap():
    """Connects to Gmail via IMAP and processes unread bank payment emails."""
    smtp_cfg = Config.SMTP_CONFIG
    if not smtp_cfg["username"] or not smtp_cfg["password"]:
        print("⚠️ SMTP/IMAP credentials not configured.")
        return
    try:
        print(f"📥 [IMAP] Connecting to imap.gmail.com as {smtp_cfg['username']}...")
        mail = imaplib.IMAP4_SSL("imap.gmail.com")
        mail.login(smtp_cfg["username"], smtp_cfg["password"])
        mail.select("inbox")

        status, response = mail.search(None, 'UNSEEN')
        if status != "OK":
            return

        messages = response[0].split()
        if not messages:
            print("✅ [IMAP] No unread emails in inbox.")
            return

        print(f"📧 [IMAP] Found {len(messages)} unread email(s). Processing...")

        for msg_id in messages:
            status, data = mail.fetch(msg_id, "(RFC822)")
            if status != "OK":
                continue

            raw_email = data[0][1]
            msg = email.message_from_bytes(raw_email)

            subject, encoding = decode_header(msg["Subject"])[0]
            if isinstance(subject, bytes):
                subject = subject.decode(encoding or "utf-8", errors="ignore")

            body = ""
            if msg.is_multipart():
                for part in msg.walk():
                    content_type = part.get_content_type()
                    content_disposition = str(part.get("Content-Disposition"))
                    if content_type == "text/plain" and "attachment" not in content_disposition:
                        payload = part.get_payload(decode=True)
                        body += payload.decode("utf-8", errors="ignore")
            else:
                body = msg.get_payload(decode=True).decode("utf-8", errors="ignore")

            combined_content = f"{subject} {body}"
            process_bank_email_payload(combined_content, send_email_smtp)

            # Mark email as read
            mail.store(msg_id, '+FLAGS', '\\Seen')

        mail.close()
        mail.logout()
    except Exception as e:
        print(f"❌ Error during IMAP polling worker: {e}")

def check_bank_emails_gmail_api():
    """Checks Gmail inbox using Gmail API for unread bank/payment emails."""
    service = get_gmail_service()
    if not service:
        return
    try:
        query = "is:unread (MB Bank OR Bank OR \"biến động số dư\" OR \"chuyển khoản\")"
        results = service.users().messages().list(userId='me', q=query).execute()
        messages = results.get('messages', [])

        if not messages:
            return

        print(f"📧 [Gmail API] Found {len(messages)} unread bank/payment email(s). Processing...")

        for msg in messages:
            msg_id = msg['id']
            message_details = service.users().messages().get(userId='me', id=msg_id, format='full').execute()

            payload = message_details.get('payload', {})
            headers = payload.get('headers', [])
            subject = next((h['value'] for h in headers if h['name'].lower() == 'subject'), '')

            body_text = ""
            if 'parts' in payload:
                for part in payload['parts']:
                    if part['mimeType'] == 'text/plain':
                        data = part['body'].get('data', '')
                        body_text += base64.urlsafe_b64decode(data.encode('utf-8')).decode('utf-8', errors='ignore')
            else:
                data = payload.get('body', {}).get('data', '')
                if data:
                    body_text = base64.urlsafe_b64decode(data.encode('utf-8')).decode('utf-8', errors='ignore')

            combined_content = f"{subject} {body_text}"
            success = process_bank_email_payload(combined_content, send_email_gmail_api)

            # Mark as read regardless
            service.users().messages().batchModify(
                userId='me',
                body={'ids': [msg_id], 'removeLabelIds': ['UNREAD']}
            ).execute()

    except Exception as e:
        print(f"❌ Error during Gmail polling worker: {e}")

def check_bank_emails_and_process():
    """Dispatch between Gmail API and IMAP method."""
    if os.path.exists(SERVICE_ACCOUNT_FILE):
        check_bank_emails_gmail_api()
    else:
        check_bank_emails_imap()

def start_email_worker():
    """Start background daemon thread polling Gmail every 15 seconds."""
    def poll_loop():
        while True:
            try:
                check_bank_emails_and_process()
            except Exception as e:
                print(f"❌ [Email Worker] Error in polling loop: {e}")
            time.sleep(15)

    t = threading.Thread(target=poll_loop, daemon=True)
    t.start()
    print("📧 [Email Worker] Background polling started.")


if __name__ == "__main__":
    print("📧 [Email Worker] Standalone polling loop started in foreground...")
    while True:
        try:
            check_bank_emails_and_process()
        except Exception as e:
            print(f"❌ [Email Worker] Error in polling loop: {e}")
        time.sleep(15)

