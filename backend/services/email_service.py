import os
import base64
import smtplib
import threading
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from backend.config import Config

# Service Account delegation config
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

def send_email_smtp(to_email, subject, html_content):
    """Sends an email using standard SMTP with App Password."""
    smtp_cfg = Config.SMTP_CONFIG
    if not smtp_cfg["username"] or not smtp_cfg["password"]:
        print("⚠️ SMTP credentials not configured in Config.")
        return False
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{smtp_cfg['from_name']} <{smtp_cfg['username']}>"
        msg["To"] = to_email
        msg.attach(MIMEText(html_content, "html", "utf-8"))

        server = smtplib.SMTP(smtp_cfg["host"], smtp_cfg["port"])
        server.starttls()
        server.login(smtp_cfg["username"], smtp_cfg["password"])
        server.sendmail(smtp_cfg["username"], to_email, msg.as_string())
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
    if os.path.exists(SERVICE_ACCOUNT_FILE):
        threading.Thread(target=send_email_gmail_api, args=(to_email, subject, html_content)).start()
    else:
        threading.Thread(target=send_email_smtp, args=(to_email, subject, html_content)).start()
