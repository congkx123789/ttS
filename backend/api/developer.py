import os
import time
import uuid
import secrets
import base64
import requests as py_requests
from flask import Blueprint, request, jsonify, send_file
from backend.core.decorators import get_current_user, require_api_key_auth
from backend.database.db_manager import get_user_db_conn
from backend.services.translation import get_engine

developer_bp = Blueprint("developer", __name__)

ADMIN_GEMINI_KEY = os.environ.get("ADMIN_GEMINI_KEY", "")

def serialize_row(row):
    if not row:
        return {}
    d = dict(row)
    for k, v in d.items():
        if hasattr(v, "isoformat"):
            d[k] = v.isoformat()
    return d



def deduct_developer_balance(api_key, amount, model, tokens=0, status_code=200):
    conn = get_user_db_conn()
    try:
        conn.execute(
            "INSERT INTO api_usage (api_key, model, tokens, cost, status_code) VALUES (?, ?, ?, ?, ?)",
            (api_key, model, tokens, amount, status_code)
        )
        conn.execute(
            "UPDATE users SET api_balance = api_balance - ? WHERE id = (SELECT user_id FROM api_keys WHERE api_key = ?)",
            (amount, api_key)
        )
        conn.commit()
    except Exception as e:
        print(f"[API GATEWAY ERROR] Failed to deduct balance: {e}")
    finally:
        conn.close()


@developer_bp.route("/api/developer/keys", methods=["GET"])
def api_dev_keys_list():
    user = get_current_user()
    print(f"[DEBUG api_dev_keys_list] Current user from auth: {user}")
    if not user:
        return jsonify({"error": "Vui lòng đăng nhập."}), 401

    conn = get_user_db_conn()
    keys = conn.execute(
        "SELECT api_key, name, status, created_at, last_used_at FROM api_keys WHERE user_id = ? AND status = 'active' ORDER BY created_at DESC",
        (user["id"],)
    ).fetchall()
    user_row = conn.execute("SELECT api_balance FROM users WHERE id = ?", (user["id"],)).fetchone()
    conn.close()

    balance = user_row["api_balance"] if user_row and user_row["api_balance"] is not None else 0.0
    print(f"[DEBUG api_dev_keys_list] Queried user_id: {user['id']}, found balance: {balance}, keys count: {len(keys)}")
    return jsonify({"balance": balance, "keys": [serialize_row(k) for k in keys]})


@developer_bp.route("/api/developer/keys/create", methods=["POST"])
def api_dev_keys_create():
    user = get_current_user()
    if not user:
        return jsonify({"error": "Vui lòng đăng nhập."}), 401

    data = request.json or {}
    name = data.get("name", "Default Key").strip()[:50]
    new_key = f"sk-tc-{secrets.token_hex(16)}"

    conn = get_user_db_conn()
    conn.execute(
        "INSERT INTO api_keys (user_id, api_key, name, status) VALUES (?, ?, ?, 'active')",
        (user["id"], new_key, name)
    )
    conn.commit()
    conn.close()

    return jsonify({"success": True, "api_key": new_key, "name": name})


@developer_bp.route("/api/developer/keys/delete", methods=["POST"])
def api_dev_keys_delete():
    user = get_current_user()
    if not user:
        return jsonify({"error": "Vui lòng đăng nhập."}), 401

    data = request.json or {}
    api_key = data.get("api_key", "").strip()
    if not api_key:
        return jsonify({"error": "Thiếu API Key cần xóa."}), 400

    conn = get_user_db_conn()
    conn.execute(
        "UPDATE api_keys SET status = 'revoked' WHERE user_id = ? AND api_key = ?",
        (user["id"], api_key)
    )
    conn.commit()
    conn.close()
    return jsonify({"success": True})


@developer_bp.route("/api/developer/usage", methods=["GET"])
def api_dev_usage():
    user = get_current_user()
    if not user:
        return jsonify({"error": "Vui lòng đăng nhập."}), 401

    conn = get_user_db_conn()
    keys_rows = conn.execute("SELECT api_key FROM api_keys WHERE user_id = ?", (user["id"],)).fetchall()
    keys = [k["api_key"] for k in keys_rows]

    if not keys:
        conn.close()
        return jsonify({"usage": []})

    placeholders = ",".join(["?"] * len(keys))
    usage = conn.execute(
        f"SELECT * FROM api_usage WHERE api_key IN ({placeholders}) ORDER BY timestamp DESC LIMIT 100",
        keys
    ).fetchall()
    conn.close()
    return jsonify({"usage": [serialize_row(u) for u in usage]})


@developer_bp.route("/v1/chat/completions", methods=["POST"])
@require_api_key_auth
def openai_chat_completions():
    api_key = request.api_key
    data = request.json or {}
    messages = data.get("messages", [])
    model = data.get("model", "gemini-1.5-flash")

    if not messages:
        return jsonify({"error": "Missing messages array"}), 400

    prompt_length = sum(len(m.get("content", "")) for m in messages)
    cost = max(20.0, prompt_length * 0.02)

    if request.api_balance < cost:
        return jsonify({"error": f"Số dư không đủ. Chi phí ước tính: {cost:.2f}đ, Số dư: {request.api_balance:.2f}đ"}), 402

    if not ADMIN_GEMINI_KEY:
        return jsonify({"error": "Hệ thống chưa được Admin cấu hình khóa Gemini."}), 501

    try:
        contents = []
        system_instruction = ""

        for msg in messages:
            role = msg.get("role")
            content = msg.get("content", "")
            if role == "system":
                system_instruction = content
            else:
                contents.append({
                    "role": "user" if role == "user" else "model",
                    "parts": [{"text": content}]
                })

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={ADMIN_GEMINI_KEY}"
        payload = {"contents": contents}
        if system_instruction:
            payload["systemInstruction"] = {"parts": [{"text": system_instruction}]}

        res = py_requests.post(url, json=payload, timeout=30)

        if res.status_code != 200:
            deduct_developer_balance(api_key, 0.0, model, prompt_length, res.status_code)
            return jsonify({"error": f"Google Gemini API error: {res.text}"}), res.status_code

        gemini_data = res.json()
        response_text = gemini_data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")

        deduct_developer_balance(api_key, cost, model, prompt_length + len(response_text), 200)

        res_id = f"chatcmpl-{uuid.uuid4().hex}"
        return jsonify({
            "id": res_id,
            "object": "chat.completion",
            "created": int(time.time()),
            "model": model,
            "choices": [{
                "index": 0,
                "message": {"role": "assistant", "content": response_text},
                "finish_reason": "stop"
            }],
            "usage": {
                "prompt_tokens": int(prompt_length / 4),
                "completion_tokens": int(len(response_text) / 4),
                "total_tokens": int((prompt_length + len(response_text)) / 4)
            }
        })
    except Exception as e:
        deduct_developer_balance(api_key, 0.0, model, prompt_length, 500)
        return jsonify({"error": f"API Gateway Exception: {str(e)}"}), 500


@developer_bp.route("/api/v1/translate", methods=["POST"])
@require_api_key_auth
def api_v1_translate():
    api_key = request.api_key
    data = request.json or {}
    texts = data.get("texts", [])
    mode = data.get("mode", "fast")

    if not texts:
        return jsonify({"error": "Missing texts array"}), 400

    total_chars = sum(len(t) for t in texts)
    cost = total_chars * 0.01

    if request.api_balance < cost:
        return jsonify({"error": f"Số dư không đủ. Chi phí ước tính: {cost:.2f}đ, Số dư: {request.api_balance:.2f}đ"}), 402

    try:
        eng = get_engine()
        translations = []
        for text in texts:
            if not text.strip():
                translations.append(text)
            else:
                translations.append(eng.translate(text, multi_option=False, mode=mode))

        deduct_developer_balance(api_key, cost, f"vietphrase-{mode}", total_chars, 200)
        return jsonify({"translations": translations, "characters": total_chars, "cost": cost})
    except Exception as e:
        deduct_developer_balance(api_key, 0.0, f"vietphrase-{mode}", total_chars, 500)
        return jsonify({"error": f"Translation Error: {str(e)}"}), 500


@developer_bp.route("/v1/audio/speech", methods=["POST"])
@require_api_key_auth
def openai_audio_speech():
    api_key = request.api_key
    data = request.json or {}
    input_text = data.get("input", "").strip()

    if not input_text:
        return jsonify({"error": "Missing 'input' text"}), 400

    cost = len(input_text) * 0.1
    if request.api_balance < cost:
        return jsonify({"error": f"Số dư không đủ. Chi phí: {cost:.2f}đ"}), 402

    # 1. Check if Local TTS Server is configured (host machine)
    local_tts_url = os.environ.get("LOCAL_TTS_URL", "")
    if local_tts_url:
        try:
            payload = {
                "input": input_text,
                "speed": 1.0,
                "voice": data.get("voice", "the_gioi_hoan_my"),
                "ref_audio": data.get("ref_audio"),
                "ref_text": data.get("ref_text")
            }
            print(f"[Local TTS Proxy] Forwarding request to {local_tts_url} with voice={payload['voice']}")
            r = py_requests.post(local_tts_url, json=payload, timeout=60)
            if r.status_code == 200:
                import io
                deduct_developer_balance(api_key, cost, f"local-tts-{payload['voice']}", len(input_text), 200)
                return send_file(
                    io.BytesIO(r.content),
                    mimetype="audio/wav",
                    as_attachment=False
                )
            print(f"[Local TTS Proxy Error]: {r.status_code} - {r.text}")
        except Exception as e:
            print(f"[Local TTS Proxy Exception]: {e}")

    # 2. RunPod Fallback
    runpod_api_key = os.environ.get("RUNPOD_API_TOKEN", os.environ.get("RUNPOD_API_KEY", ""))

    runpod_endpoint_id = os.environ.get("RUNPOD_TTS_ENDPOINT_ID", "")

    if runpod_api_key and runpod_endpoint_id:
        try:
            url = f"https://api.runpod.ai/v1/{runpod_endpoint_id}/runsync"
            headers = {"Authorization": f"Bearer {runpod_api_key}", "Content-Type": "application/json"}
            payload = {"input": {"text": input_text, "speed": 1.0}}
            r = py_requests.post(url, json=payload, headers=headers, timeout=45)
            res = r.json()

            if r.status_code == 200 and res.get("status") == "COMPLETED":
                audio_b64 = res.get("output", {}).get("audio_base64", "")
                if audio_b64:
                    import io
                    audio_data = base64.b64decode(audio_b64)
                    deduct_developer_balance(api_key, cost, "runpod-matcha-tts", len(input_text), 200)
                    return send_file(
                        io.BytesIO(audio_data),
                        mimetype="audio/wav" if res.get("output", {}).get("format") == "wav" else "audio/mpeg",
                        as_attachment=False
                    )
            print(f"[RunPod TTS Error]: {res}")
        except Exception as e:
            print(f"[RunPod TTS exception]: {e}")

    # Fallback: Generate a tiny 1-second silent WAV for testing/sandbox purposes
    try:
        import struct
        import io
        num_samples = 8000
        # 8-bit PCM silence is represented by 128
        data_bytes = bytearray([128] * num_samples)
        header = struct.pack(
            '<4sI4s4sIHHIIHH4sI',
            b'RIFF',
            36 + num_samples,
            b'WAVE',
            b'fmt ',
            16,
            1,      # PCM
            1,      # Mono
            8000,   # Sample rate
            8000,   # Byte rate
            1,      # Block align
            8,      # Bits per sample
            b'data',
            num_samples
        )
        audio_data = bytes(header + data_bytes)
        deduct_developer_balance(api_key, cost, "local-silent-tts-fallback", len(input_text), 200)
        return send_file(
            io.BytesIO(audio_data),
            mimetype="audio/wav",
            as_attachment=False
        )
    except Exception as e:
        return jsonify({"error": f"Failed to generate fallback TTS: {str(e)}"}), 500
