import datetime
import os
import requests as py_requests
from flask import Blueprint, request, jsonify, Response, session, current_app
from backend.config import Config
from backend.core.decorators import get_current_user
from backend.core.rate_limit import get_client_ip
from backend.core.security import verify_access_token
from backend.services.translation import (
    get_engine, translate_texts, translate_stream_generator,
    translation_limit_tracker, call_ai_chat_proxy
)

translate_bp = Blueprint("translate", __name__)


def is_vip_request():
    """Check if current request has VIP privileges (session, JWT, or header code)."""
    user = get_current_user()
    if user and user.get("vip_status", 0) == 1:
        return True
    
    # Check headers
    vip_code = request.headers.get("X-VIP-Code", "") or request.headers.get("X-VIP-Key", "")
    if not vip_code:
        # Check request body
        try:
            data = request.json or {}
            vip_code = data.get("vip_key", "") or data.get("vip_code", "")
        except:
            pass
            
    if vip_code and vip_code in Config.VALID_VIP_CODES:
        return True
    return False


def _check_translation_rate_limit(texts):
    """Returns (exceeded: bool, tracker_key, count) for standard users."""
    client_ip = get_client_ip()
    today_str = datetime.date.today().isoformat()
    tracker_key = f"{client_ip}:{today_str}"
    current_count = translation_limit_tracker.get(tracker_key, 0)
    requested_count = len([t for t in texts if t.strip()])
    exceeded = (current_count + requested_count) > 50
    return exceeded, tracker_key, requested_count


@translate_bp.route("/translate", methods=["POST"])
def translate():
    data = request.json
    if not data or "texts" not in data:
        return jsonify({"error": "Missing 'texts' array"}), 400

    texts = data["texts"]

    if not is_vip_request():
        exceeded, tracker_key, count = _check_translation_rate_limit(texts)
        if exceeded:
            return jsonify({
                "error": "Hạn mức dịch máy chủ Standard đã hết (50 đoạn/ngày). Vui lòng nâng cấp tài khoản VIP!"
            }), 403
        translation_limit_tracker[tracker_key] = translation_limit_tracker.get(tracker_key, 0) + count

    mode = data.get("mode")

    # If standalone translation server is running, proxy request to it
    local_translate_url = os.environ.get("LOCAL_TRANSLATE_URL", "")
    if not local_translate_url:
        local_tts_url = os.environ.get("LOCAL_TTS_URL", "")
        if local_tts_url:
            local_translate_url = local_tts_url.split("/v1/")[0]

    if local_translate_url:
        try:
            translate_url = f"{local_translate_url.rstrip('/')}/v1/translate"
            r = py_requests.post(translate_url, json={"texts": texts, "mode": mode}, timeout=60)
            if r.status_code == 200:
                return jsonify(r.json())
            current_app.logger.error(f"[Translate Proxy Error]: {r.status_code} - {r.text}")
        except Exception as e:
            current_app.logger.error(f"[Translate Proxy Exception]: {e}")

    translations = translate_texts(texts, mode)
    return jsonify({"translations": translations})


@translate_bp.route("/translate_stream", methods=["POST"])
def translate_stream():
    data = request.json
    if not data or "texts" not in data:
        return jsonify({"error": "Missing 'texts' array"}), 400

    texts = data["texts"]

    if not is_vip_request():
        exceeded, tracker_key, count = _check_translation_rate_limit(texts)
        if exceeded:
            return jsonify({
                "error": "Hạn mức dịch máy chủ Standard đã hết (50 đoạn/ngày). Vui lòng nâng cấp tài khoản VIP!"
            }), 403
        translation_limit_tracker[tracker_key] = translation_limit_tracker.get(tracker_key, 0) + count

    mode = data.get("mode")

    # If standalone translation server is running, proxy stream request to it
    local_translate_url = os.environ.get("LOCAL_TRANSLATE_URL", "")
    if not local_translate_url:
        local_tts_url = os.environ.get("LOCAL_TTS_URL", "")
        if local_tts_url:
            local_translate_url = local_tts_url.split("/v1/")[0]

    if local_translate_url:
        try:
            translate_url = f"{local_translate_url.rstrip('/')}/v1/translate_stream"
            r = py_requests.post(translate_url, json={"texts": texts, "mode": mode}, stream=True, timeout=60)
            if r.status_code == 200:
                def stream_forwarder():
                    for chunk in r.iter_content(chunk_size=1024):
                        if chunk:
                            yield chunk
                response = Response(stream_forwarder(), mimetype="text/event-stream")
                response.headers["X-Accel-Buffering"] = "no"
                response.headers["Cache-Control"] = "no-cache, no-transform"
                response.headers["Connection"] = "keep-alive"
                response.headers["X-Content-Type-Options"] = "nosniff"
                return response
            current_app.logger.error(f"[Translate Stream Proxy Error]: {r.status_code} - {r.text}")
        except Exception as e:
            current_app.logger.error(f"[Translate Stream Proxy Exception]: {e}")

    response = Response(translate_stream_generator(texts, mode), mimetype="text/event-stream")
    response.headers["X-Accel-Buffering"] = "no"
    response.headers["Cache-Control"] = "no-cache, no-transform"
    response.headers["Connection"] = "keep-alive"
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response


@translate_bp.route("/api/ai/chat", methods=["POST"])
def ai_chat_proxy():
    if not is_vip_request():
        return jsonify({
            "error": "Chức năng AI chỉ dành cho thành viên VIP. Vui lòng nâng cấp hoặc nhập API Key cá nhân trong cài đặt!"
        }), 403

    data = request.json or {}
    messages = data.get("messages", [])
    model = data.get("model", "gemini-1.5-flash")
    prompt = data.get("prompt", "")

    try:
        text = call_ai_chat_proxy(messages, model, prompt)
        return jsonify({"text": text})
    except ValueError as e:
        return jsonify({"error": str(e)}), 501
    except RuntimeError as e:
        return jsonify({"error": str(e)}), 502
    except Exception as e:
        return jsonify({"error": f"Lỗi xử lý AI Proxy: {str(e)}"}), 500
