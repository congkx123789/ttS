import os
import sys
import json
import time
import requests as py_requests
from backend.config import Config

# Dynamic path addition for local translation engine
if Config.ROOT_DIR not in sys.path:
    sys.path.append(Config.ROOT_DIR)

engine = None
translation_limit_tracker = {} # Format: { "IP:YYYY-MM-DD": count }
ADMIN_GEMINI_KEY = os.environ.get("ADMIN_GEMINI_KEY", "")

def get_engine():
    global engine
    if engine is None:
        print("Lazy-loading Vietphrase Engine...")
        from backend.engine.engine import VietphraseEngine
        engine = VietphraseEngine()
    return engine

def parse_custom_dict_text(dict_text):
    if not dict_text:
        return None
    custom_dict = []
    lines = dict_text.split('\n')
    for line in lines:
        line = line.strip()
        if not line or '=' not in line:
            continue
        parts = line.split('=', 1)
        zh = parts[0].strip()
        vi = parts[1].strip()
        if zh and vi:
            custom_dict.append((zh, vi))
    # Sort by key length descending to avoid prefix collision during greedy replacement
    custom_dict.sort(key=lambda x: len(x[0]), reverse=True)
    return custom_dict

def translate_texts(texts, mode=None):
    eng = get_engine()
    translations = []
    for text in texts:
        if not text.strip():
            translations.append(text)
        else:
            try:
                trans = eng.translate(text, multi_option=False, mode=mode)
                translations.append(trans)
            except Exception as e:
                print(f"Error translating: {e}")
                translations.append(text)
    return translations

def translate_stream_generator(texts, mode=None):
    eng = get_engine()
    for i, text in enumerate(texts):
        if not text.strip():
            trans = text
        else:
            try:
                trans = eng.translate(text, multi_option=False, mode=mode)
            except Exception as e:
                print(f"Error translating: {e}")
                trans = text
        yield f"data: {json.dumps({'index': i, 'text': trans}, ensure_ascii=False)}\n\n"
        time.sleep(0.001)

def call_ai_chat_proxy(messages, model="gemini-1.5-flash", prompt=""):
    if not ADMIN_GEMINI_KEY:
        raise ValueError("Admin Gemini key not configured on server.")
        
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={ADMIN_GEMINI_KEY}"
    
    contents = []
    for msg in messages:
        contents.append({
            "role": "user" if msg.get("role") == "user" else "model",
            "parts": [{"text": msg.get("text", "")}]
        })
        
    payload = {
        "contents": contents,
        "systemInstruction": {
            "parts": [{"text": prompt}]
        }
    }
    
    res = py_requests.post(url, json=payload, timeout=30)
    if res.status_code != 200:
        raise RuntimeError(f"Gemini API returned error: {res.text}")
        
    gemini_data = res.json()
    response_text = gemini_data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "Không nhận được phản hồi.")
    return response_text
