import os
import re
import base64
import hmac
import hashlib
import time
import sqlite3
import smtplib
import imaplib
import email
from email.header import decode_header
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


# =====================================================================
# SMTP & IMAP CONFIGURATION (Method B - App Password)
# =====================================================================
SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = 587
SMTP_EMAIL = os.environ.get("SMTP_EMAIL", "")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")

# =====================================================================
# GMAIL API SERVICE CONFIGURATION (Method A - Domain-Wide Delegation)
# =====================================================================
SERVICE_ACCOUNT_FILE = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON", "gmail-delegator-key.json")
DELEGATED_USER_EMAIL = os.environ.get("GMAIL_DELEGATED_EMAIL", "support@lyvuha.com")

SCOPES = [
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.modify"
]

def get_gmail_service():
    """Builds and returns a Gmail API service client impersonating the DELEGATED_USER_EMAIL."""
    if not os.path.exists(SERVICE_ACCOUNT_FILE):
        return None
    try:
        from google.oauth2 import service_account
        from googleapiclient.discovery import build
        
        creds = service_account.Credentials.from_service_account_file(
            SERVICE_ACCOUNT_FILE, 
            scopes=SCOPES
        )
        delegated_creds = creds.with_subject(DELEGATED_USER_EMAIL)
        service = build('gmail', 'v1', credentials=delegated_creds)
        return service
    except Exception as e:
        print(f"❌ Error initializing Gmail API Service: {e}")
        return None

# =====================================================================
# SEND EMAIL FUNCTIONS
# =====================================================================
def send_email_smtp(to_email, subject, html_content):
    """Sends an email using standard SMTP with App Password."""
    if not SMTP_EMAIL or not SMTP_PASSWORD:
        print("⚠️ SMTP credentials not configured in .env.")
        return False
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"Novel Translator VIP <{SMTP_EMAIL}>"
        msg["To"] = to_email
        msg.attach(MIMEText(html_content, "html", "utf-8"))

        server = smtplib.SMTP(SMTP_HOST, SMTP_PORT)
        server.starttls()
        server.login(SMTP_EMAIL, SMTP_PASSWORD)
        server.sendmail(SMTP_EMAIL, to_email, msg.as_string())
        server.quit()
        print(f"📧 [SMTP] Successfully sent email to {to_email}")
        return True
    except Exception as e:
        print(f"❌ [SMTP] Failed to send email: {e}")
        return False

def send_email_gmail_api(to_email, subject, html_content):
    """Sends an email using Gmail API via Service Account impersonation."""
    service = get_gmail_service()
    if not service:
        return send_email_smtp(to_email, subject, html_content)
    try:
        message = MIMEText(html_content, 'html', 'utf-8')
        message['to'] = to_email
        message['from'] = DELEGATED_USER_EMAIL
        message['subject'] = subject

        raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode('utf-8')
        body = {'raw': raw_message}
        
        service.users().messages().send(userId='me', body=body).execute()
        print(f"📧 [Gmail API] Successfully sent email to {to_email} from {DELEGATED_USER_EMAIL}")
        return True
    except Exception as e:
        print(f"❌ [Gmail API] Failed to send email, falling back to SMTP: {e}")
        return send_email_smtp(to_email, subject, html_content)

def send_email_async(to_email, subject, html_content):
    """Helper to send emails asynchronously in a background thread."""
    import threading
    if os.path.exists(SERVICE_ACCOUNT_FILE):
        threading.Thread(target=send_email_gmail_api, args=(to_email, subject, html_content)).start()
    else:
        threading.Thread(target=send_email_smtp, args=(to_email, subject, html_content)).start()

# =====================================================================
# READ & RESPOND EMAIL WORKER (Automated Payment Processing)
# =====================================================================
def check_bank_emails_imap():
    """
    Connects to Gmail via IMAP, searches for unread bank notification emails,
    parses VIP order IDs, confirms payments, and sends replies via SMTP.
    """
    if not SMTP_EMAIL or not SMTP_PASSWORD:
        print("⚠️ SMTP/IMAP credentials not configured in .env.")
        return
        
    try:
        print(f"📥 [IMAP] Connecting to imap.gmail.com as {SMTP_EMAIL}...")
        mail = imaplib.IMAP4_SSL("imap.gmail.com")
        mail.login(SMTP_EMAIL, SMTP_PASSWORD)
        mail.select("inbox")
        
        # Search for unseen/unread emails
        status, response = mail.search(None, 'UNSEEN')
        if status != "OK":
            print("❌ Search failed.")
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
            
            # Decode Subject
            subject, encoding = decode_header(msg["Subject"])[0]
            if isinstance(subject, bytes):
                subject = subject.decode(encoding or "utf-8", errors="ignore")
                
            # Parse Body
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
            
            # Parse Order ID (e.g. VIP123)
            order_match = re.search(r'(VIP\w+)', combined_content, re.IGNORECASE)
            
            # Parse Amount
            amount_match = re.search(r'(?:S\d+ti\d+n|s\u1ed1 ti\u1ec1n|giao d\u1ecbch|ph\u00e1t sinh|c\u1ed9ng)\s*(?:\+)?\s*([0-9.,]+)\s*(?:VND|đ|d|\u0111)', combined_content, re.IGNORECASE)
            
            if order_match:
                order_id = order_match.group(1).upper()
                amount = 0
                if amount_match:
                    amount_str = amount_match.group(1).replace('.', '').replace(',', '')
                    try:
                        amount = float(amount_str)
                    except ValueError:
                        pass
                        
                print(f"🔍 [IMAP] Detected transaction in email. Order ID: {order_id}, parsed amount: {amount}")
                
                # Process local payment and activate VIP
                success = process_local_payment(order_id, amount)
                if success:
                    # Reply to customer
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
                        send_email_smtp(customer_email, reply_subject, reply_html)
            
            # Mark as read (seen)
            mail.store(msg_id, '+FLAGS', '\\Seen')
            
        mail.close()
        mail.logout()
    except Exception as e:
        print(f"❌ Error during IMAP polling worker: {e}")

def check_bank_emails_gmail_api():
    """Checks the Gmail inbox using the Gmail API."""
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
            order_match = re.search(r'(VIP\w+)', combined_content, re.IGNORECASE)
            amount_match = re.search(r'(?:S\d+ti\d+n|s\u1ed1 ti\u1ec1n|giao d\u1ecbch|ph\u00e1t sinh|c\u1ed9ng)\s*(?:\+)?\s*([0-9.,]+)\s*(?:VND|đ|d|\u0111)', combined_content, re.IGNORECASE)
            
            if order_match:
                order_id = order_match.group(1).upper()
                amount = 0
                if amount_match:
                    amount_str = amount_match.group(1).replace('.', '').replace(',', '')
                    try:
                        amount = float(amount_str)
                    except ValueError:
                        pass
                
                print(f"🔍 [Gmail API] Detected transaction. Order ID: {order_id}, parsed amount: {amount}")
                success = process_local_payment(order_id, amount)
                if success:
                    service.users().messages().batchModify(
                        userId='me',
                        body={'ids': [msg_id], 'removeLabelIds': ['UNREAD']}
                    ).execute()
                    
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
                        send_email_gmail_api(customer_email, reply_subject, reply_html)
            else:
                service.users().messages().batchModify(
                    userId='me',
                    body={'ids': [msg_id], 'removeLabelIds': ['UNREAD']}
                ).execute()
    except Exception as e:
        print(f"❌ Error during Gmail polling worker: {e}")

def check_bank_emails_and_process():
    """Unifies Method A and Method B checking."""
    if os.path.exists(SERVICE_ACCOUNT_FILE):
        check_bank_emails_gmail_api()
    else:
        check_bank_emails_imap()

# =====================================================================
# DATABASE OPERATIONS
# =====================================================================
def get_user_db_conn():
    # Make path absolute relative to directory of this script to avoid path issues
    base_dir = os.path.dirname(os.path.abspath(__file__))
    db_path = os.path.join(base_dir, "users_data.db")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn

def get_customer_email_by_order(order_id):
    try:
        conn = get_user_db_conn()
        row = conn.execute(
            "SELECT u.email FROM payments p JOIN users u ON p.user_id = u.id WHERE p.order_id = ?",
            (order_id,)
        ).fetchone()
        conn.close()
        return row["email"] if row and row["email"] else None
    except Exception:
        return None

def process_local_payment(order_id, amount):
    """Integrates directly with database to confirm payment and activate VIP."""
    try:
        conn = get_user_db_conn()
        payment = conn.execute(
            "SELECT * FROM payments WHERE order_id = ? AND status = 'pending'", (order_id,)
        ).fetchone()
        
        if not payment:
            conn.close()
            print(f"⚠️ Payment {order_id} not found or already processed.")
            return False
            
        if amount > 0 and abs(amount - payment["amount"]) > 100:
            conn.close()
            print(f"❌ Amount mismatch for {order_id}: expected {payment['amount']}, got {amount}")
            return False

        now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        conn.execute(
            "UPDATE payments SET status = 'completed', completed_at = ? WHERE id = ?",
            (now, payment["id"])
        )
        
        user_id = payment["user_id"]
        plan = payment["plan"]
        
        days = 30
        if "year" in plan.lower():
            days = 365
        elif "lifetime" in plan.lower():
            days = 99999
            
        cursor = conn.execute("SELECT vip_expiry FROM users WHERE id = ?", (user_id,)).fetchone()
        current_expiry_str = cursor["vip_expiry"] if cursor and cursor["vip_expiry"] else None
        
        from datetime import timedelta
        base_date = datetime.utcnow()
        if current_expiry_str:
            try:
                parsed_expiry = datetime.strptime(current_expiry_str, "%Y-%m-%d %H:%M:%S")
                if parsed_expiry > base_date:
                    base_date = parsed_expiry
            except Exception:
                pass
                
        new_expiry = (base_date + timedelta(days=days)).strftime("%Y-%m-%d %H:%M:%S")
        
        conn.execute(
            "UPDATE users SET vip_status = 1, vip_expiry = ? WHERE id = ?",
            (new_expiry, user_id)
        )
        
        conn.commit()
        conn.close()
        print(f"✅ [Email Activation] Successfully confirmed payment for {order_id} via Email scan. VIP activated.")
        return True
    except Exception as e:
        print(f"❌ Error processing local payment: {e}")
        return False

if __name__ == "__main__":
    print("🚀 [Email Worker] Starting standalone email polling daemon...")
    while True:
        try:
            check_bank_emails_and_process()
        except Exception as e:
            print(f"❌ [Email Worker] Error: {e}")
        time.sleep(15)
