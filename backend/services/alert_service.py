import os
import time
import logging
from backend.config import Config
from backend.services.email_service import send_email_async

logger = logging.getLogger("backend.alert")

# Rate limit: 30 minutes in seconds
THROTTLE_INTERVAL = 30 * 60

# In-memory store for tracking the last time an alert of a specific type was sent
# format: { alert_type: timestamp }
_last_sent_alerts = {}

def send_alert_to_admin(alert_type: str, subject: str, message_html: str):
    """
    Sends an email alert to the system administrator.
    
    Includes throttling to avoid spamming the admin email (maximum 1 alert per 30 minutes per type).
    """
    admin_email = os.environ.get("ADMIN_EMAIL") or Config.SMTP_CONFIG.get("username")
    if not admin_email:
        logger.warning(f"⚠️ [Alerting] No ADMIN_EMAIL or SMTP username configured. Skipping alert: {subject}")
        return False
        
    current_time = time.time()
    last_sent = _last_sent_alerts.get(alert_type, 0)
    
    if current_time - last_sent < THROTTLE_INTERVAL:
        logger.info(f"🔇 [Alerting] Alert '{alert_type}' throttled. Last sent at: {last_sent}. Skipping...")
        return False
        
    # Update last sent timestamp
    _last_sent_alerts[alert_type] = current_time
    
    # Send email asynchronously
    logger.info(f"🚨 [Alerting] Sending alert email to Admin ({admin_email}): {subject}")
    
    # Append styling to alert email
    styled_html = f"""
    <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ffcccc; border-radius: 8px; background-color: #fffafb;">
        <h2 style="color: #d32f2f; border-bottom: 2px solid #d32f2f; padding-bottom: 10px; margin-top: 0;">Novel Translator Alert</h2>
        <p><strong>Loại cảnh báo:</strong> <span style="background-color: #ffebee; color: #c62828; padding: 2px 6px; border-radius: 4px; font-family: monospace;">{alert_type}</span></p>
        <div style="background-color: #fff; padding: 15px; border-left: 4px solid #d32f2f; margin: 15px 0; font-family: monospace; font-size: 13px; line-height: 1.5; white-space: pre-wrap; overflow-x: auto;">
            {message_html}
        </div>
        <p style="font-size: 11px; color: #777; margin-top: 20px; border-top: 1px solid #eee; padding-top: 10px;">
            Đây là email tự động gửi từ hệ thống giám sát trên VM. Cảnh báo này sẽ bị tạm khóa (throttled) trong 30 phút tiếp theo.
        </p>
    </div>
    """
    
    send_email_async(admin_email, f"[SYSTEM ALERT] {subject}", styled_html)
    return True

def check_resources_and_alert():
    """
    Checks RAM and Disk metrics, and triggers alerts if they exceed thresholds (90%).
    This should be called periodically or during health queries.
    """
    from backend.core.monitoring import get_memory_info, get_disk_info
    
    try:
        mem = get_memory_info()
        if mem["percent"] >= 90.0:
            subject = f"Cảnh báo: Bộ nhớ RAM cực kỳ thấp ({mem['percent']}%)"
            body = f"Hệ thống đang chạy trên VM có lượng RAM khả dụng cực kỳ thấp.<br>" \
                   f"Tổng RAM: {mem['total_bytes'] / (1024*1024*1024):.2f} GB<br>" \
                   f"Đã dùng: {mem['used_bytes'] / (1024*1024*1024):.2f} GB ({mem['percent']}%)<br>" \
                   f"Tiến trình python RSS: {mem['process_rss_bytes'] / (1024*1024):.2f} MB"
            send_alert_to_admin("low_memory", subject, body)
            
        disk = get_disk_info()
        if disk["percent"] >= 90.0:
            subject = f"Cảnh báo: Dung lượng ổ đĩa sắp đầy ({disk['percent']}%)"
            body = f"Ổ đĩa trên VM sắp hết bộ nhớ.<br>" \
                   f"Tổng dung lượng: {disk['total_bytes'] / (1024*1024*1024):.2f} GB<br>" \
                   f"Đã dùng: {disk['used_bytes'] / (1024*1024*1024):.2f} GB ({disk['percent']}%)<br>" \
                   f"Dung lượng trống: {disk['free_bytes'] / (1024*1024*1024):.2f} GB"
            send_alert_to_admin("low_disk", subject, body)
    except Exception as e:
        logger.error(f"Error checking system resources: {e}")
