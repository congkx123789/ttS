from flask import Blueprint, request, jsonify
from backend.core.decorators import jwt_required, get_current_user
from backend.database.db_manager import get_user_db_conn
from backend.core.logger import logger
from backend.core.security import encrypt_message, decrypt_message
from datetime import datetime
import os

user_features_bp = Blueprint("user_features", __name__)

def serialize_row(row):
    if not row:
        return {}
    d = dict(row)
    for k, v in d.items():
        if hasattr(v, "isoformat"):
            d[k] = v.isoformat()
    return d


# ==========================================
# 1. Translation History Endpoints
# ==========================================

@user_features_bp.route("/api/user/history", methods=["GET"])
@jwt_required
def get_translation_history():
    user = get_current_user()
    conn = get_user_db_conn()
    try:
        rows = conn.execute(
            "SELECT * FROM translation_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 100",
            (user["id"],)
        ).fetchall()
        return jsonify({"history": [serialize_row(r) for r in rows], "success": True})
    except Exception as e:
        logger.error(f"[User History] Failed to fetch history: {e}")
        return jsonify({"error": "Failed to fetch translation history", "success": False}), 500
    finally:
        conn.close()

@user_features_bp.route("/api/user/history", methods=["POST"])
@jwt_required
def add_translation_history():
    user = get_current_user()
    data = request.json or {}
    original = data.get("original_text", "").strip()
    translated = data.get("translated_text", "").strip()
    mode = data.get("mode", "fast").strip()
    chars = int(data.get("characters", len(original)))

    if not original or not translated:
        return jsonify({"error": "Original text and translation content cannot be empty", "success": False}), 400

    conn = get_user_db_conn()
    try:
        conn.execute(
            "INSERT INTO translation_history (user_id, original_text, translated_text, mode, characters) VALUES (?, ?, ?, ?, ?)",
            (user["id"], original, translated, mode, chars)
        )
        conn.commit()
        return jsonify({"message": "Translation history entry added", "success": True})
    except Exception as e:
        logger.error(f"[User History] Failed to add entry: {e}")
        return jsonify({"error": "Failed to add translation history entry", "success": False}), 500
    finally:
        conn.close()

@user_features_bp.route("/api/user/history", methods=["DELETE"])
@jwt_required
def clear_translation_history():
    user = get_current_user()
    conn = get_user_db_conn()
    try:
        conn.execute("DELETE FROM translation_history WHERE user_id = ?", (user["id"],))
        conn.commit()
        return jsonify({"message": "Translation history cleared", "success": True})
    except Exception as e:
        logger.error(f"[User History] Failed to clear history: {e}")
        return jsonify({"error": "Failed to clear history", "success": False}), 500
    finally:
        conn.close()

# ==========================================
# 2. Vocabulary/Word Notebook Endpoints
# ==========================================

@user_features_bp.route("/api/user/vocabulary", methods=["GET"])
@jwt_required
def get_vocabulary():
    user = get_current_user()
    conn = get_user_db_conn()
    try:
        rows = conn.execute(
            "SELECT * FROM vocabulary WHERE user_id = ? ORDER BY created_at DESC",
            (user["id"],)
        ).fetchall()
        return jsonify({"vocabulary": [serialize_row(r) for r in rows], "success": True})
    except Exception as e:
        logger.error(f"[Vocabulary] Failed to fetch vocabulary: {e}")
        return jsonify({"error": "Failed to fetch vocabulary list", "success": False}), 500
    finally:
        conn.close()

@user_features_bp.route("/api/user/vocabulary", methods=["POST"])
@jwt_required
def add_vocabulary():
    user = get_current_user()
    data = request.json or {}
    original = data.get("original_text", "").strip()
    translation = data.get("translation", "").strip()
    pinyin_or_hanviet = data.get("pinyin_or_hanviet", "").strip()
    context = data.get("context_sentence", "").strip()
    notes = data.get("notes", "").strip()

    if not original or not translation:
        return jsonify({"error": "Original text and translation content cannot be empty", "success": False}), 400

    conn = get_user_db_conn()
    try:
        conn.execute(
            "INSERT INTO vocabulary (user_id, original_text, pinyin_or_hanviet, translation, context_sentence, notes) VALUES (?, ?, ?, ?, ?, ?)",
            (user["id"], original, pinyin_or_hanviet, translation, context, notes)
        )
        conn.commit()
        return jsonify({"message": "Word saved to vocabulary notebook", "success": True})
    except Exception as e:
        logger.error(f"[Vocabulary] Failed to save word: {e}")
        return jsonify({"error": "Failed to save word notebook entry", "success": False}), 500
    finally:
        conn.close()

@user_features_bp.route("/api/user/vocabulary/<int:item_id>", methods=["DELETE"])
@jwt_required
def delete_vocabulary(item_id):
    user = get_current_user()
    conn = get_user_db_conn()
    try:
        # Verify ownership
        row = conn.execute("SELECT user_id FROM vocabulary WHERE id = ?", (item_id,)).fetchone()
        if not row:
            return jsonify({"error": "Entry not found", "success": False}), 404
        if int(row["user_id"]) != int(user["id"]):
            return jsonify({"error": "Unauthorized action", "success": False}), 403

        conn.execute("DELETE FROM vocabulary WHERE id = ?", (item_id,))
        conn.commit()
        return jsonify({"message": "Word deleted from notebook", "success": True})
    except Exception as e:
        logger.error(f"[Vocabulary] Failed to delete item {item_id}: {e}")
        return jsonify({"error": "Failed to delete item", "success": False}), 500
    finally:
        conn.close()

# ==========================================
# 3. Personalization Settings Endpoints
# ==========================================

@user_features_bp.route("/api/user/settings", methods=["GET"])
@jwt_required
def get_user_settings():
    user = get_current_user()
    conn = get_user_db_conn()
    try:
        row = conn.execute("SELECT * FROM user_settings WHERE user_id = ?", (user["id"],)).fetchone()
        if not row:
            # Insert defaults
            conn.execute(
                "INSERT INTO user_settings (user_id, theme, default_language, auto_read, font_size) VALUES (?, 'dark', 'vi', 0, 14)",
                (user["id"],)
            )
            conn.commit()
            row = conn.execute("SELECT * FROM user_settings WHERE user_id = ?", (user["id"],)).fetchone()

        return jsonify({"settings": serialize_row(row), "success": True})
    except Exception as e:
        logger.error(f"[UserSettings] Failed to fetch settings: {e}")
        return jsonify({"error": "Failed to fetch settings", "success": False}), 500
    finally:
        conn.close()

@user_features_bp.route("/api/user/settings", methods=["POST"])
@jwt_required
def update_user_settings():
    user = get_current_user()
    data = request.json or {}
    theme = data.get("theme", "dark").strip()
    lang = data.get("default_language", "vi").strip()
    auto_read = int(data.get("auto_read", 0))
    font_size = int(data.get("font_size", 14))
    now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")

    conn = get_user_db_conn()
    try:
        conn.execute(
            """INSERT INTO user_settings (user_id, theme, default_language, auto_read, font_size, updated_at) 
               VALUES (?, ?, ?, ?, ?, ?)
               ON CONFLICT(user_id) DO UPDATE SET 
               theme = excluded.theme, 
               default_language = excluded.default_language, 
               auto_read = excluded.auto_read, 
               font_size = excluded.font_size,
               updated_at = excluded.updated_at""",
            (user["id"], theme, lang, auto_read, font_size, now)
        )
        conn.commit()
        return jsonify({"message": "Settings updated successfully", "success": True})
    except Exception as e:
        logger.error(f"[UserSettings] Failed to update settings: {e}")
        return jsonify({"error": "Failed to update settings", "success": False}), 500
    finally:
        conn.close()


# ==========================================
# 4. Usage Tracking & System/API Statistics
# ==========================================

@user_features_bp.route("/api/user/track", methods=["POST"])
@jwt_required
def track_user_usage():
    user = get_current_user()
    data = request.json or {}
    source = data.get("source", "web").strip().lower()
    action = data.get("action", "read").strip().lower()
    duration = int(data.get("duration", 0))
    mode = data.get("mode", "online").strip().lower()

    if not source or not action:
        return jsonify({"error": "Missing source or action", "success": False}), 400

    conn = get_user_db_conn()
    try:
        conn.execute(
            "INSERT INTO usage_tracking (user_id, source, action, duration, mode) VALUES (?, ?, ?, ?, ?)",
            (user["id"], source, action, duration, mode)
        )
        conn.commit()
        return jsonify({"message": "Usage tracked successfully", "success": True})
    except Exception as e:
        logger.error(f"[Usage Tracking] Failed to log usage: {e}")
        return jsonify({"error": "Failed to track usage", "success": False}), 500
    finally:
        conn.close()


@user_features_bp.route("/api/user/stats", methods=["GET"])
@jwt_required
def get_user_stats():
    user = get_current_user()
    conn = get_user_db_conn()
    try:
        # 1. Total active/reading duration by source
        web_duration_row = conn.execute(
            "SELECT SUM(duration) as total FROM usage_tracking WHERE user_id = ? AND source = 'web'",
            (user["id"],)
        ).fetchone()
        web_duration = web_duration_row["total"] or 0 if web_duration_row else 0

        ext_duration_row = conn.execute(
            "SELECT SUM(duration) as total FROM usage_tracking WHERE user_id = ? AND source = 'extension'",
            (user["id"],)
        ).fetchone()
        ext_duration = ext_duration_row["total"] or 0 if ext_duration_row else 0

        # 2. Total active/reading duration by online/offline mode
        online_duration_row = conn.execute(
            "SELECT SUM(duration) as total FROM usage_tracking WHERE user_id = ? AND mode = 'online'",
            (user["id"],)
        ).fetchone()
        online_duration = online_duration_row["total"] or 0 if online_duration_row else 0

        offline_duration_row = conn.execute(
            "SELECT SUM(duration) as total FROM usage_tracking WHERE user_id = ? AND mode = 'offline'",
            (user["id"],)
        ).fetchone()
        offline_duration = offline_duration_row["total"] or 0 if offline_duration_row else 0

        # 3. Translation calls count (from translation_history)
        trans_calls_row = conn.execute(
            "SELECT COUNT(*) as cnt, SUM(characters) as total_chars FROM translation_history WHERE user_id = ?",
            (user["id"],)
        ).fetchone()
        trans_calls = trans_calls_row["cnt"] or 0 if trans_calls_row else 0
        total_chars = trans_calls_row["total_chars"] or 0 if trans_calls_row else 0

        # 4. API keys & API usage stats (from api_keys and api_usage)
        api_keys_count_row = conn.execute(
            "SELECT COUNT(*) as cnt FROM api_keys WHERE user_id = ?",
            (user["id"],)
        ).fetchone()
        api_keys_count = api_keys_count_row["cnt"] or 0 if api_keys_count_row else 0

        api_usage_row = conn.execute(
            """SELECT COUNT(u.id) as cnt, SUM(u.tokens) as tokens 
               FROM api_usage u 
               JOIN api_keys k ON u.api_key = k.api_key 
               WHERE k.user_id = ?""",
            (user["id"],)
        ).fetchone()
        api_usage_calls = api_usage_row["cnt"] or 0 if api_usage_row else 0
        api_usage_chars = api_usage_row["tokens"] or 0 if api_usage_row else 0

        # 5. Recent actions log
        recent_actions = conn.execute(
            "SELECT source, action, duration, mode, timestamp FROM usage_tracking WHERE user_id = ? ORDER BY timestamp DESC, id DESC LIMIT 20",
            (user["id"],)
        ).fetchall()

        return jsonify({
            "success": True,
            "stats": {
                "web_duration": web_duration,
                "ext_duration": ext_duration,
                "online_duration": online_duration,
                "offline_duration": offline_duration,
                "total_reading_time": web_duration + ext_duration,
                "translation_calls": trans_calls,
                "translation_chars": total_chars,
                "api_keys_count": api_keys_count,
                "api_usage_calls": api_usage_calls,
                "api_usage_chars": api_usage_chars
            },
            "recent_actions": [serialize_row(r) for r in recent_actions]
        })
    except Exception as e:
        logger.error(f"[User Stats] Failed to fetch stats: {e}")
        return jsonify({"error": "Failed to fetch stats", "success": False}), 500
    finally:
        conn.close()


# ==========================================
# 5. Feedback Submissions
# ==========================================

@user_features_bp.route("/api/feedback/submit", methods=["POST"])
def submit_feedback():
    data = request.json or {}
    email = data.get("email", "").strip()
    message = data.get("message", "").strip()

    if not email or not message:
        return jsonify({"error": "Email và nội dung phản hồi không được để trống", "success": False}), 400

    # 1. Log to logs/feedback.log
    os.makedirs("logs", exist_ok=True)
    log_path = "logs/feedback.log"
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    log_entry = f"[{timestamp}] EMAIL: {email} | MESSAGE: {message}\n"
    try:
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(log_entry)
    except Exception as e:
        logger.error(f"Failed to write feedback to log file: {e}")

    # 2. Save to SQLite database
    conn = get_user_db_conn()
    try:
        conn.execute(
            """CREATE TABLE IF NOT EXISTS user_feedbacks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT,
                message TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )"""
        )
        conn.execute(
            "INSERT INTO user_feedbacks (email, message) VALUES (?, ?)",
            (email, message)
        )
        conn.commit()
        return jsonify({"message": "Gửi phản hồi thành công!", "success": True})
    except Exception as e:
        logger.error(f"[Feedback] Failed to save feedback: {e}")
        return jsonify({"error": "Gửi phản hồi thất bại", "success": False}), 500
    finally:
        conn.close()


@user_features_bp.route("/api/feedback/list", methods=["GET"])
def list_feedbacks():
    conn = get_user_db_conn()
    try:
        conn.execute(
            """CREATE TABLE IF NOT EXISTS user_feedbacks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT,
                message TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )"""
        )
        rows = conn.execute("SELECT * FROM user_feedbacks ORDER BY id DESC").fetchall()
        feedbacks = [serialize_row(r) for r in rows]
        return jsonify({"feedbacks": feedbacks, "success": True})
    except Exception as e:
        logger.error(f"[Feedback] Failed to list feedback: {e}")
        return jsonify({"error": "Không thể lấy danh sách phản hồi", "success": False}), 500
    finally:
        conn.close()


# ==========================================
# 6. Social, Friends, and Private Messaging APIs
# ==========================================

@user_features_bp.route("/api/users/search", methods=["GET"])
def search_users():
    q = request.args.get("q", "").strip()
    if not q:
        return jsonify({"users": []})
    user = get_current_user()
    user_id = user["id"] if user else None
    conn = get_user_db_conn()
    try:
        like_q = "%" + q + "%"
        if user_id:
            rows = conn.execute(
                """SELECT id, username, user_code, display_name, avatar FROM users 
                   WHERE id != ? AND (
                     username LIKE ? OR 
                     email LIKE ? OR 
                     user_code = ?
                   ) LIMIT 15""",
                (user_id, like_q, like_q, q)
            ).fetchall()
        else:
            rows = conn.execute(
                """SELECT id, username, user_code, display_name, avatar FROM users 
                   WHERE username LIKE ? OR email LIKE ? OR user_code = ? LIMIT 15""",
                (like_q, like_q, q)
            ).fetchall()
        return jsonify({"users": [serialize_row(r) for r in rows]})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


@user_features_bp.route("/api/notifications/unread-counts", methods=["GET"])
def get_unread_counts():
    """Separate unread counts: messages vs friend/other notifications."""
    user = get_current_user()
    if not user:
        return jsonify({"messages": 0, "notifications": 0})
    conn = get_user_db_conn()
    try:
        # Unread personal messages from direct_messages table
        msg_count = conn.execute(
            "SELECT COUNT(*) as c FROM direct_messages WHERE receiver_id = ? AND is_read = 0",
            (user["id"],)
        ).fetchone()["c"]
        # Unread other notifications (friend_request, friend_accept, book_share etc)
        notif_count = conn.execute(
            "SELECT COUNT(*) as c FROM personal_notifications WHERE user_id = ? AND is_read = 0 AND type != 'message'",
            (user["id"],)
        ).fetchone()["c"]
        return jsonify({"messages": msg_count, "notifications": notif_count})
    except Exception as e:
        return jsonify({"messages": 0, "notifications": 0})
    finally:
        conn.close()


@user_features_bp.route("/api/friends/request", methods=["POST"])
def send_friend_request():
    user = get_current_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401
    
    data = request.json or {}
    # Accept username, user_code, or email
    query = data.get("friend_username") or data.get("friend_code") or data.get("friend_email") or ""
    query = query.strip()
    if not query:
        return jsonify({"error": "Thiếu thông tin tìm kiếm bạn bè"}), 400
    
    conn = get_user_db_conn()
    try:
        target = conn.execute(
            "SELECT id, username FROM users WHERE username = ? OR user_code = ? OR email = ?",
            (query, query, query.lower())
        ).fetchone()
        if not target:
            return jsonify({"error": "Không tìm thấy người dùng"}), 404
        
        target_id = target["id"]
        if target_id == user["id"]:
            return jsonify({"error": "Không thể kết bạn với chính mình"}), 400
        
        exists = conn.execute("SELECT status FROM friendships WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)",
                             (user["id"], target_id, target_id, user["id"])).fetchone()
        if exists:
            return jsonify({"error": f"Đã có lời mời kết bạn hoặc đã là bạn bè (Trạng thái: {exists['status']})"}), 400
        
        conn.execute("INSERT INTO friendships (user_id, friend_id, status) VALUES (?, ?, 'pending')", (user["id"], target_id))
        
        conn.execute(
            "INSERT INTO personal_notifications (user_id, sender_id, type, message, related_id) VALUES (?, ?, 'friend_request', ?, ?)",
            (target_id, user["id"], f"{user['username']} đã gửi cho bạn một lời mời kết bạn.", user["id"])
        )
        conn.commit()
        return jsonify({"success": True, "message": "Đã gửi lời mời kết bạn!", "to_user": target["username"]})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


@user_features_bp.route("/api/friends/respond", methods=["POST"])
def respond_friend_request():
    user = get_current_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401
    
    data = request.json or {}
    sender_id = data.get("sender_id")
    action = data.get("action", "").lower()
    
    if not sender_id or action not in ['accept', 'reject']:
        return jsonify({"error": "Dữ liệu không hợp lệ"}), 400
    
    conn = get_user_db_conn()
    try:
        req = conn.execute("SELECT id FROM friendships WHERE user_id = ? AND friend_id = ? AND status = 'pending'", (sender_id, user["id"])).fetchone()
        if not req:
            return jsonify({"error": "Không tìm thấy lời mời kết bạn"}), 404
        
        if action == 'accept':
            conn.execute("UPDATE friendships SET status = 'accepted' WHERE user_id = ? AND friend_id = ?", (sender_id, user["id"]))
            # Cross-compatibility check instead of INSERT OR IGNORE
            exists = conn.execute("SELECT 1 FROM friendships WHERE user_id = ? AND friend_id = ?", (user["id"], sender_id)).fetchone()
            if not exists:
                conn.execute("INSERT INTO friendships (user_id, friend_id, status) VALUES (?, ?, 'accepted')", (user["id"], sender_id))
            conn.execute(
                "INSERT INTO personal_notifications (user_id, sender_id, type, message, related_id) VALUES (?, ?, 'friend_accept', ?, ?)",
                (sender_id, user["id"], f"{user['username']} đã chấp nhận lời mời kết bạn.", user["id"])
            )
        else:
            conn.execute("DELETE FROM friendships WHERE user_id = ? AND friend_id = ?", (sender_id, user["id"]))
        
        conn.execute(
            "UPDATE personal_notifications SET is_read = 1 WHERE user_id = ? AND sender_id = ? AND type = 'friend_request'",
            (user["id"], sender_id)
        )
        conn.commit()
        return jsonify({"success": True, "message": f"Đã {'chấp nhận' if action == 'accept' else 'từ chối'} kết bạn."})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


@user_features_bp.route("/api/friends/list", methods=["GET"])
def list_friends():
    user = get_current_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401
    
    conn = get_user_db_conn()
    try:
        rows = conn.execute(
            """SELECT u.id, u.username, u.user_code, u.avatar,
                      (SELECT COUNT(*) FROM direct_messages dm WHERE dm.sender_id = u.id AND dm.receiver_id = ? AND dm.is_read = 0) as unread_messages
               FROM friendships f
               JOIN users u ON f.friend_id = u.id
               WHERE f.user_id = ? AND f.status = 'accepted'""",
            (user["id"], user["id"])
        ).fetchall()
        return jsonify({"friends": [serialize_row(r) for r in rows]})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


@user_features_bp.route("/api/messages/send", methods=["POST"])
def send_message():
    user = get_current_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401
    
    data = request.json or {}
    receiver_id = data.get("receiver_id")
    message = data.get("message", "").strip()
    
    if not receiver_id or not message:
        return jsonify({"error": "Thiếu người nhận hoặc nội dung tin nhắn"}), 400
    
    conn = get_user_db_conn()
    try:
        enc_msg = encrypt_message(message)
        cursor = conn.execute(
            "INSERT INTO direct_messages (sender_id, receiver_id, message) VALUES (?, ?, ?)",
            (user["id"], receiver_id, enc_msg)
        )
        msg_id = cursor.lastrowid
        
        conn.execute(
            "INSERT INTO personal_notifications (user_id, sender_id, type, message, related_id) VALUES (?, ?, 'message', ?, ?)",
            (receiver_id, user["id"], f"{user['username']} đã gửi cho bạn một tin nhắn mới.", msg_id)
        )
        conn.commit()
        return jsonify({"success": True, "message": "Gửi tin nhắn thành công!", "msg_id": msg_id})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


@user_features_bp.route("/api/messages/chat/<int:friend_id>", methods=["GET"])
def get_chat_history(friend_id):
    user = get_current_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401
    
    conn = get_user_db_conn()
    try:
        rows = conn.execute(
            """SELECT id, sender_id, receiver_id, message, is_read, created_at 
               FROM direct_messages 
               WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
               ORDER BY created_at ASC""",
            (user["id"], friend_id, friend_id, user["id"])
        ).fetchall()
        
        conn.execute(
            "UPDATE direct_messages SET is_read = 1 WHERE sender_id = ? AND receiver_id = ?",
            (friend_id, user["id"])
        )
        conn.execute(
            "UPDATE personal_notifications SET is_read = 1 WHERE user_id = ? AND sender_id = ? AND type = 'message'",
            (user["id"], friend_id)
        )
        conn.commit()
        
        messages = []
        for r in rows:
            d = dict(r)
            d["message"] = decrypt_message(d.get("message", ""))
            for k, v in d.items():
                if hasattr(v, "isoformat"):
                    d[k] = v.isoformat()
            messages.append(d)
            
        return jsonify({"messages": messages})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


@user_features_bp.route("/api/books/share", methods=["POST"])
def share_book():
    user = get_current_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401
    
    data = request.json or {}
    friend_id = data.get("friend_id")
    book_id = data.get("book_id")
    custom_message = data.get("message", "").strip()
    
    if not friend_id or not book_id:
        return jsonify({"error": "Thiếu thông tin người nhận hoặc truyện cần chia sẻ"}), 400
    
    conn = get_user_db_conn()
    try:
        book_title = "Truyện"
        from backend.database.db_manager import get_db
        main_conn = get_db()
        row = main_conn.execute("SELECT title_vietphrase, title_hanviet, title FROM books WHERE id = ?", (book_id,)).fetchone()
        if row:
            book_title = row["title_vietphrase"] or row["title_hanviet"] or row["title"]
            
        msg_content = f"{user['username']} đã chia sẻ truyện '{book_title}' với bạn."
        if custom_message:
            msg_content += f" Lời nhắn: \"{custom_message}\""
            
        conn.execute(
            "INSERT INTO personal_notifications (user_id, sender_id, type, message, related_id) VALUES (?, ?, 'book_share', ?, ?)",
            (friend_id, user["id"], msg_content, book_id)
        )
        
        share_chat_msg = f"[Chia sẻ truyện] '{book_title}' - Xem chi tiết tại /book/{book_id}"
        if custom_message:
            share_chat_msg += f"\nLời nhắn: {custom_message}"
        enc_share_msg = encrypt_message(share_chat_msg)
        conn.execute(
            "INSERT INTO direct_messages (sender_id, receiver_id, message) VALUES (?, ?, ?)",
            (user["id"], friend_id, enc_share_msg)
        )
        
        conn.commit()
        return jsonify({"success": True, "message": "Chia sẻ truyện thành công!"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


@user_features_bp.route("/api/notifications/personal", methods=["GET"])
def get_personal_notifications():
    user = get_current_user()
    if not user:
        return jsonify({"notifications": []})
    
    conn = get_user_db_conn()
    try:
        rows = conn.execute(
            """SELECT n.id, n.sender_id, n.type, n.message, n.related_id, n.is_read, n.created_at, u.username as sender_name
               FROM personal_notifications n
               LEFT JOIN users u ON n.sender_id = u.id
               WHERE n.user_id = ?
               ORDER BY n.created_at DESC LIMIT 50""",
            (user["id"],)
        ).fetchall()
        return jsonify({"notifications": [serialize_row(r) for r in rows]})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


@user_features_bp.route("/api/notifications/personal/read", methods=["POST"])
def read_personal_notification():
    user = get_current_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401
    
    data = request.json or {}
    notif_id = data.get("notification_id")
    
    if not notif_id:
        return jsonify({"error": "Thiếu notification_id"}), 400
    
    conn = get_user_db_conn()
    try:
        conn.execute(
            "UPDATE personal_notifications SET is_read = 1 WHERE id = ? AND user_id = ?",
            (notif_id, user["id"])
        )
        conn.commit()
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

