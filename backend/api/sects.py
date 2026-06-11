from flask import Blueprint, request, jsonify
from backend.core.decorators import jwt_required, get_current_user
from backend.database.db_manager import get_user_db_conn
from backend.core.logger import logger
from backend.core.security import encrypt_message, decrypt_message
from datetime import datetime

sects_bp = Blueprint("sects", __name__)

def serialize_row(row):
    if not row:
        return {}
    d = dict(row)
    for k, v in d.items():
        if hasattr(v, "isoformat"):
            d[k] = v.isoformat()
    return d

@sects_bp.route("/api/sects/list", methods=["GET"])
def list_sects():
    conn = get_user_db_conn()
    try:
        rows = conn.execute("""
            SELECT s.id, s.name, s.slogan, s.badge, s.level, s.contribution, s.created_at,
                   u.username as leader_name,
                   (SELECT COUNT(*) FROM sect_members WHERE sect_id = s.id) as member_count
            FROM sects s
            LEFT JOIN users u ON s.leader_id = u.id
            ORDER BY s.contribution DESC, s.created_at DESC
        """).fetchall()
        
        user = get_current_user()
        user_requests = []
        if user:
            req_rows = conn.execute("SELECT sect_id FROM sect_join_requests WHERE user_id = ? AND status = 'pending'", (user["id"],)).fetchall()
            user_requests = [r["sect_id"] for r in req_rows]

        return jsonify({
            "sects": [serialize_row(r) for r in rows],
            "pending_requests": user_requests
        })
    except Exception as e:
        logger.error(f"Error listing sects: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

@sects_bp.route("/api/sects/create", methods=["POST"])
@jwt_required
def create_sect():
    user = get_current_user()
    data = request.json or {}
    name = data.get("name", "").strip()
    slogan = data.get("slogan", "").strip()
    badge = data.get("badge", "purple").strip()

    if not name:
        return jsonify({"error": "Tên tông môn không được để trống"}), 400

    conn = get_user_db_conn()
    try:
        # Check if user is already in a sect
        in_sect = conn.execute("SELECT sect_id FROM sect_members WHERE user_id = ?", (user["id"],)).fetchone()
        if in_sect:
            return jsonify({"error": "Bạn đã thuộc một tông môn khác, hãy rời tông cũ trước"}), 400

        # Check if name exists
        exists = conn.execute("SELECT id FROM sects WHERE name = ?", (name,)).fetchone()
        if exists:
            return jsonify({"error": "Tên tông môn này đã được lập từ trước"}), 400

        cursor = conn.execute(
            "INSERT INTO sects (name, slogan, badge, leader_id, announcement) VALUES (?, ?, ?, ?, ?)",
            (name, slogan, badge, user["id"], f"Tông môn {name} được thành lập. Chúc các đồng môn tu tiên đắc đạo!")
        )
        sect_id = cursor.lastrowid

        conn.execute(
            "INSERT INTO sect_members (sect_id, user_id, role, contribution) VALUES (?, ?, 'leader', 100)",
            (sect_id, user["id"])
        )
        conn.execute(
            "UPDATE sects SET contribution = 100 WHERE id = ?",
            (sect_id,)
        )
        # Delete any pending join requests of this user elsewhere
        conn.execute("DELETE FROM sect_join_requests WHERE user_id = ?", (user["id"],))
        
        conn.commit()
        return jsonify({"success": True, "message": f"Sáng lập {name} tông thành công!", "sect_id": sect_id})
    except Exception as e:
        logger.error(f"Error creating sect: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

@sects_bp.route("/api/sects/join", methods=["POST"])
@jwt_required
def join_sect():
    user = get_current_user()
    data = request.json or {}
    sect_id = data.get("sect_id")

    if not sect_id:
        return jsonify({"error": "Thiếu sect_id"}), 400

    conn = get_user_db_conn()
    try:
        # Check if user is already in a sect
        in_sect = conn.execute("SELECT sect_id FROM sect_members WHERE user_id = ?", (user["id"],)).fetchone()
        if in_sect:
            return jsonify({"error": "Bạn đã ở trong một tông môn khác"}), 400

        # Check if sect exists
        sect = conn.execute("SELECT name FROM sects WHERE id = ?", (sect_id,)).fetchone()
        if not sect:
            return jsonify({"error": "Tông môn không tồn tại"}), 404

        # Check if already requested
        req_exists = conn.execute("SELECT id FROM sect_join_requests WHERE sect_id = ? AND user_id = ?", (sect_id, user["id"])).fetchone()
        if req_exists:
            return jsonify({"error": "Bạn đã gửi yêu cầu gia nhập tông này và đang chờ duyệt"}), 400

        conn.execute(
            "INSERT INTO sect_join_requests (sect_id, user_id, status) VALUES (?, ?, 'pending')",
            (sect_id, user["id"])
        )
        conn.commit()
        return jsonify({"success": True, "message": f"Đã gửi yêu cầu bái kiến gia nhập {sect['name']}! Vui lòng chờ duyệt."})
    except Exception as e:
        logger.error(f"Error joining sect: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

@sects_bp.route("/api/sects/leave", methods=["POST"])
@jwt_required
def leave_sect():
    user = get_current_user()
    conn = get_user_db_conn()
    try:
        member = conn.execute("SELECT sect_id, role FROM sect_members WHERE user_id = ?", (user["id"],)).fetchone()
        if not member:
            return jsonify({"error": "Bạn chưa gia nhập tông môn nào"}), 400

        sect_id = member["sect_id"]
        if member["role"] == "leader":
            # Leader leaving dissolves the sect
            conn.execute("DELETE FROM sect_chat_groups WHERE sect_id = ?", (sect_id,))
            conn.execute("DELETE FROM sect_messages WHERE sect_id = ?", (sect_id,))
            conn.execute("DELETE FROM sect_members WHERE sect_id = ?", (sect_id,))
            conn.execute("DELETE FROM sect_join_requests WHERE sect_id = ?", (sect_id,))
            conn.execute("DELETE FROM sect_books WHERE sect_id = ?", (sect_id,))
            conn.execute("DELETE FROM sects WHERE id = ?", (sect_id,))
            msg = "Bạn là tông chủ, rời đi đồng nghĩa với việc giải tán tông môn!"
        else:
            conn.execute("DELETE FROM sect_members WHERE user_id = ? AND sect_id = ?", (user["id"], sect_id))
            msg = "Bạn đã rời khỏi tông môn thành công!"

        conn.commit()
        return jsonify({"success": True, "message": msg})
    except Exception as e:
        logger.error(f"Error leaving sect: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

@sects_bp.route("/api/sects/my-sect", methods=["GET"])
@jwt_required
def my_sect():
    user = get_current_user()
    conn = get_user_db_conn()
    try:
        member = conn.execute("SELECT sect_id, role, contribution as my_contrib FROM sect_members WHERE user_id = ?", (user["id"],)).fetchone()
        if not member:
            return jsonify({"in_sect": False})

        sect_id = member["sect_id"]
        sect = conn.execute("""
            SELECT s.id, s.name, s.slogan, s.announcement, s.badge, s.level, s.contribution, s.created_at,
                   u.username as leader_name, u.id as leader_id
            FROM sects s
            LEFT JOIN users u ON s.leader_id = u.id
            WHERE s.id = ?
        """, (sect_id,)).fetchone()

        members = conn.execute("""
            SELECT sm.user_id, sm.role, sm.contribution, sm.joined_at, u.username, u.avatar
            FROM sect_members sm
            LEFT JOIN users u ON sm.user_id = u.id
            WHERE sm.sect_id = ?
            ORDER BY 
              CASE sm.role 
                WHEN 'leader' THEN 1 
                WHEN 'elder' THEN 2 
                ELSE 3 
              END, 
              sm.contribution DESC
        """, (sect_id,)).fetchall()

        return jsonify({
            "in_sect": True,
            "role": member["role"],
            "my_contribution": member["my_contrib"],
            "sect": serialize_row(sect),
            "members": [serialize_row(m) for m in members]
        })
    except Exception as e:
        logger.error(f"Error getting my sect: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

@sects_bp.route("/api/sects/chat/history", methods=["GET"])
@jwt_required
def get_sect_chat_history():
    user = get_current_user()
    chat_type = request.args.get("chat_type", "general").strip()
    target_id = request.args.get("target_id")
    group_id = request.args.get("group_id")

    conn = get_user_db_conn()
    try:
        member = conn.execute("SELECT sect_id FROM sect_members WHERE user_id = ?", (user["id"],)).fetchone()
        if not member:
            return jsonify({"error": "Bạn chưa gia nhập tông môn"}), 403

        sect_id = member["sect_id"]

        if chat_type == "direct":
            if not target_id:
                return jsonify({"error": "Thiếu target_id cho chat riêng"}), 400
            rows = conn.execute("""
                SELECT sm.id, sm.sender_id, sm.message, sm.created_at, sm.chat_type, sm.target_id,
                       u.username as sender_name, u.avatar as sender_avatar
                FROM sect_messages sm
                LEFT JOIN users u ON sm.sender_id = u.id
                WHERE sm.sect_id = ? AND sm.chat_type = 'direct'
                  AND ((sm.sender_id = ? AND sm.target_id = ?) OR (sm.sender_id = ? AND sm.target_id = ?))
                ORDER BY sm.created_at ASC LIMIT 100
            """, (sect_id, user["id"], target_id, target_id, user["id"])).fetchall()

        elif chat_type == "book":
            if not target_id:
                return jsonify({"error": "Thiếu target_id cho chat truyện"}), 400
            rows = conn.execute("""
                SELECT sm.id, sm.sender_id, sm.message, sm.created_at, sm.chat_type, sm.target_id,
                       u.username as sender_name, u.avatar as sender_avatar
                FROM sect_messages sm
                LEFT JOIN users u ON sm.sender_id = u.id
                WHERE sm.sect_id = ? AND sm.chat_type = 'book' AND sm.target_id = ?
                ORDER BY sm.created_at ASC LIMIT 100
            """, (sect_id, target_id)).fetchall()

        elif chat_type == "group":
            if not group_id:
                return jsonify({"error": "Thiếu group_id cho chat nhóm"}), 400
            
            # Check group access
            group = conn.execute("SELECT members_csv FROM sect_chat_groups WHERE id = ? AND sect_id = ?", (group_id, sect_id)).fetchone()
            if not group:
                return jsonify({"error": "Nhóm chat không tồn tại"}), 404
            
            members_list = [int(x) for x in group["members_csv"].split(",") if x.strip()]
            if user["id"] not in members_list:
                return jsonify({"error": "Bạn không phải thành viên của nhóm chat này"}), 403

            rows = conn.execute("""
                SELECT sm.id, sm.sender_id, sm.message, sm.created_at, sm.chat_type, sm.group_id,
                       u.username as sender_name, u.avatar as sender_avatar
                FROM sect_messages sm
                LEFT JOIN users u ON sm.sender_id = u.id
                WHERE sm.sect_id = ? AND sm.chat_type = 'group' AND sm.group_id = ?
                ORDER BY sm.created_at ASC LIMIT 100
            """, (sect_id, group_id)).fetchall()

        else: # general chat
            rows = conn.execute("""
                SELECT sm.id, sm.sender_id, sm.message, sm.created_at, sm.chat_type,
                       u.username as sender_name, u.avatar as sender_avatar
                FROM sect_messages sm
                LEFT JOIN users u ON sm.sender_id = u.id
                WHERE sm.sect_id = ? AND (sm.chat_type IS NULL OR sm.chat_type = 'general')
                ORDER BY sm.created_at ASC LIMIT 100
            """, (sect_id,)).fetchall()

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
        logger.error(f"Error getting sect chat: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

@sects_bp.route("/api/sects/chat/send", methods=["POST"])
@jwt_required
def send_sect_chat():
    user = get_current_user()
    data = request.json or {}
    message = data.get("message", "").strip()
    chat_type = data.get("chat_type", "general").strip()
    target_id = data.get("target_id")
    group_id = data.get("group_id")

    if not message:
        return jsonify({"error": "Nội dung tin nhắn trống"}), 400

    conn = get_user_db_conn()
    try:
        member = conn.execute("SELECT sect_id FROM sect_members WHERE user_id = ?", (user["id"],)).fetchone()
        if not member:
            return jsonify({"error": "Bạn chưa gia nhập tông môn"}), 403

        sect_id = member["sect_id"]

        # Validate target / group access
        if chat_type == "group" and group_id:
            group = conn.execute("SELECT members_csv FROM sect_chat_groups WHERE id = ? AND sect_id = ?", (group_id, sect_id)).fetchone()
            if not group:
                return jsonify({"error": "Nhóm chat không tồn tại"}), 404
            members_list = [int(x) for x in group["members_csv"].split(",") if x.strip()]
            if user["id"] not in members_list:
                return jsonify({"error": "Bạn không có quyền chat trong nhóm này"}), 403

        enc_msg = encrypt_message(message)
        cursor = conn.execute(
            """INSERT INTO sect_messages (sect_id, sender_id, message, chat_type, target_id, group_id)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (sect_id, user["id"], enc_msg, chat_type, target_id, group_id)
        )
        msg_id = cursor.lastrowid
        conn.commit()
        return jsonify({"success": True, "msg_id": msg_id})
    except Exception as e:
        logger.error(f"Error sending sect chat: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

@sects_bp.route("/api/sects/chat/groups/create", methods=["POST"])
@jwt_required
def create_sect_chat_group():
    user = get_current_user()
    data = request.json or {}
    name = data.get("name", "").strip()
    member_ids = data.get("members", [])

    if not name:
        return jsonify({"error": "Tên nhóm chat không được để trống"}), 400

    conn = get_user_db_conn()
    try:
        member = conn.execute("SELECT sect_id FROM sect_members WHERE user_id = ?", (user["id"],)).fetchone()
        if not member:
            return jsonify({"error": "Bạn chưa gia nhập tông môn"}), 403

        sect_id = member["sect_id"]

        if user["id"] not in member_ids:
            member_ids.append(user["id"])

        valid_members = []
        for uid in member_ids:
            is_valid = conn.execute("SELECT 1 FROM sect_members WHERE user_id = ? AND sect_id = ?", (uid, sect_id)).fetchone()
            if is_valid:
                valid_members.append(str(uid))

        members_csv = ",".join(valid_members)

        cursor = conn.execute(
            "INSERT INTO sect_chat_groups (sect_id, name, creator_id, members_csv) VALUES (?, ?, ?, ?)",
            (sect_id, name, user["id"], members_csv)
        )
        group_id = cursor.lastrowid
        conn.commit()

        return jsonify({"success": True, "message": f"Tạo nhóm chat '{name}' thành công!", "group_id": group_id})
    except Exception as e:
        logger.error(f"Error creating sect chat group: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

@sects_bp.route("/api/sects/chat/groups/list", methods=["GET"])
@jwt_required
def list_sect_chat_groups():
    user = get_current_user()
    conn = get_user_db_conn()
    try:
        member = conn.execute("SELECT sect_id FROM sect_members WHERE user_id = ?", (user["id"],)).fetchone()
        if not member:
            return jsonify({"error": "Bạn chưa gia nhập tông môn"}), 403

        sect_id = member["sect_id"]
        groups = conn.execute("SELECT * FROM sect_chat_groups WHERE sect_id = ?", (sect_id,)).fetchall()

        my_groups = []
        for g in groups:
            members_list = [int(x) for x in g["members_csv"].split(",") if x.strip()]
            if user["id"] in members_list:
                my_groups.append(serialize_row(g))

        return jsonify({"groups": my_groups})
    except Exception as e:
        logger.error(f"Error listing sect groups: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

@sects_bp.route("/api/sects/contribute", methods=["POST"])
@jwt_required
def contribute_sect():
    user = get_current_user()
    data = request.json or {}
    amount = int(data.get("amount", 0))

    if amount <= 0:
        return jsonify({"error": "Số lượng linh thạch cống hiến phải lớn hơn 0"}), 400

    conn = get_user_db_conn()
    try:
        member = conn.execute("SELECT sect_id FROM sect_members WHERE user_id = ?", (user["id"],)).fetchone()
        if not member:
            return jsonify({"error": "Bạn không ở trong tông môn nào"}), 400

        sect_id = member["sect_id"]
        
        # Increase user contribution
        conn.execute(
            "UPDATE sect_members SET contribution = contribution + ? WHERE user_id = ? AND sect_id = ?",
            (amount, user["id"], sect_id)
        )
        
        # Increase sect total contribution
        conn.execute(
            "UPDATE sects SET contribution = contribution + ? WHERE id = ?",
            (amount, sect_id)
        )
        
        # Calculate new level (1000 contribution per level)
        sect = conn.execute("SELECT contribution FROM sects WHERE id = ?", (sect_id,)).fetchone()
        new_level = max(1, int(sect["contribution"] / 1000) + 1)
        conn.execute("UPDATE sects SET level = ? WHERE id = ?", (new_level, sect_id))
        
        conn.commit()
        return jsonify({
            "success": True,
            "message": f"Cống hiến thành công {amount} linh thạch!",
            "new_level": new_level
        })
    except Exception as e:
        logger.error(f"Error contributing to sect: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

@sects_bp.route("/api/sects/kick", methods=["POST"])
@jwt_required
def kick_member():
    user = get_current_user()
    data = request.json or {}
    target_user_id = data.get("user_id")

    if not target_user_id:
        return jsonify({"error": "Thiếu user_id thành viên cần trục xuất"}), 400

    conn = get_user_db_conn()
    try:
        # Check if user is leader/elder
        member = conn.execute("SELECT sect_id, role FROM sect_members WHERE user_id = ?", (user["id"],)).fetchone()
        if not member or member["role"] not in ['leader', 'elder']:
            return jsonify({"error": "Bạn không đủ quyền hạn (Chỉ Tông chủ hoặc Trưởng lão)"}), 403

        sect_id = member["sect_id"]
        
        # Check target
        target = conn.execute("SELECT role FROM sect_members WHERE user_id = ? AND sect_id = ?", (target_user_id, sect_id)).fetchone()
        if not target:
            return jsonify({"error": "Thành viên này không thuộc tông môn của bạn"}), 400

        # Elder cannot kick leader or another elder
        if member["role"] == 'elder' and target["role"] in ['leader', 'elder']:
            return jsonify({"error": "Trưởng lão không thể trục xuất Tông chủ hoặc Trưởng lão khác"}), 403

        if target["role"] == 'leader':
            return jsonify({"error": "Không thể trục xuất Tông chủ"}), 400

        conn.execute("DELETE FROM sect_members WHERE user_id = ? AND sect_id = ?", (target_user_id, sect_id))
        conn.commit()
        return jsonify({"success": True, "message": "Đã trục xuất thành viên ra khỏi tông môn!"})
    except Exception as e:
        logger.error(f"Error kicking member: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

# ==========================================
# ADVANCED SECTS & ALLIANCES FEATURES
# ==========================================

@sects_bp.route("/api/sects/announcement", methods=["POST"])
@jwt_required
def update_announcement():
    user = get_current_user()
    data = request.json or {}
    announcement = data.get("announcement", "").strip()

    conn = get_user_db_conn()
    try:
        member = conn.execute("SELECT sect_id, role FROM sect_members WHERE user_id = ?", (user["id"],)).fetchone()
        if not member or member["role"] not in ['leader', 'elder']:
            return jsonify({"error": "Chỉ Tông chủ hoặc Trưởng lão mới có quyền đổi thông cáo"}), 403

        conn.execute("UPDATE sects SET announcement = ? WHERE id = ?", (announcement, member["sect_id"]))
        conn.commit()
        return jsonify({"success": True, "message": "Cập nhật thông cáo tông môn thành công!"})
    except Exception as e:
        logger.error(f"Error updating announcement: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

@sects_bp.route("/api/sects/promote", methods=["POST"])
@jwt_required
def promote_member():
    user = get_current_user()
    data = request.json or {}
    target_user_id = data.get("user_id")
    new_role = data.get("role", "member").lower() # 'elder' or 'member'

    if new_role not in ['elder', 'member']:
        return jsonify({"error": "Chức vị không hợp lệ"}), 400

    conn = get_user_db_conn()
    try:
        member = conn.execute("SELECT sect_id, role FROM sect_members WHERE user_id = ?", (user["id"],)).fetchone()
        if not member or member["role"] != 'leader':
            return jsonify({"error": "Chỉ có Tông chủ mới được thăng/giáng chức đệ tử"}), 403

        sect_id = member["sect_id"]
        
        target = conn.execute("SELECT role FROM sect_members WHERE user_id = ? AND sect_id = ?", (target_user_id, sect_id)).fetchone()
        if not target:
            return jsonify({"error": "Thành viên này không thuộc tông môn của bạn"}), 400

        if target["role"] == 'leader':
            return jsonify({"error": "Không thể thay đổi chức vị của Tông chủ"}), 400

        conn.execute("UPDATE sect_members SET role = ? WHERE user_id = ? AND sect_id = ?", (new_role, target_user_id, sect_id))
        conn.commit()
        
        role_name = "Trưởng Lão" if new_role == 'elder' else "Môn đồ"
        return jsonify({"success": True, "message": f"Đã thăng/giáng chức thành viên thành {role_name}!"})
    except Exception as e:
        logger.error(f"Error promoting member: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

@sects_bp.route("/api/sects/requests/list", methods=["GET"])
@jwt_required
def list_join_requests():
    user = get_current_user()
    conn = get_user_db_conn()
    try:
        member = conn.execute("SELECT sect_id, role FROM sect_members WHERE user_id = ?", (user["id"],)).fetchone()
        if not member or member["role"] not in ['leader', 'elder']:
            return jsonify({"error": "Chỉ Tông chủ hoặc Trưởng lão mới xem được danh sách yêu cầu"}), 403

        rows = conn.execute("""
            SELECT r.id, r.user_id, r.status, r.created_at, u.username, u.avatar
            FROM sect_join_requests r
            LEFT JOIN users u ON r.user_id = u.id
            WHERE r.sect_id = ? AND r.status = 'pending'
            ORDER BY r.created_at DESC
        """, (member["sect_id"],)).fetchall()

        return jsonify({"requests": [serialize_row(r) for r in rows]})
    except Exception as e:
        logger.error(f"Error listing requests: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

@sects_bp.route("/api/sects/requests/respond", methods=["POST"])
@jwt_required
def respond_join_request():
    user = get_current_user()
    data = request.json or {}
    req_id = data.get("request_id")
    action = data.get("action", "").lower() # 'approve' or 'reject'

    if not req_id or action not in ['approve', 'reject']:
        return jsonify({"error": "Dữ liệu phản hồi không hợp lệ"}), 400

    conn = get_user_db_conn()
    try:
        member = conn.execute("SELECT sect_id, role FROM sect_members WHERE user_id = ?", (user["id"],)).fetchone()
        if not member or member["role"] not in ['leader', 'elder']:
            return jsonify({"error": "Chỉ Tông chủ hoặc Trưởng lão mới được phê duyệt"}), 403

        sect_id = member["sect_id"]
        
        req = conn.execute("SELECT user_id FROM sect_join_requests WHERE id = ? AND sect_id = ?", (req_id, sect_id)).fetchone()
        if not req:
            return jsonify({"error": "Yêu cầu gia nhập không tồn tại hoặc đã được xử lý"}), 404

        target_user_id = req["user_id"]

        if action == 'approve':
            # Check if target is already in a sect
            already_in = conn.execute("SELECT sect_id FROM sect_members WHERE user_id = ?", (target_user_id,)).fetchone()
            if already_in:
                conn.execute("DELETE FROM sect_join_requests WHERE id = ?", (req_id,))
                conn.commit()
                return jsonify({"error": "Người dùng này đã gia nhập một tông môn khác, yêu cầu tự động hủy."}), 400

            # Add member
            conn.execute(
                "INSERT INTO sect_members (sect_id, user_id, role, contribution) VALUES (?, ?, 'member', 0)",
                (sect_id, target_user_id)
            )
            # Delete target requests from all other sects
            conn.execute("DELETE FROM sect_join_requests WHERE user_id = ?", (target_user_id,))
            msg = "Đã phê duyệt gia nhập tông môn!"
        else:
            # Reject
            conn.execute("DELETE FROM sect_join_requests WHERE id = ?", (req_id,))
            msg = "Đã từ chối yêu cầu gia nhập!"

        conn.commit()
        return jsonify({"success": True, "message": msg})
    except Exception as e:
        logger.error(f"Error responding join request: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

# ==========================================
# SECT LIBRARY (BOOK SHELF SHARING)
# ==========================================

@sects_bp.route("/api/sects/library/list", methods=["GET"])
@jwt_required
def list_sect_library():
    user = get_current_user()
    conn = get_user_db_conn()
    try:
        member = conn.execute("SELECT sect_id FROM sect_members WHERE user_id = ?", (user["id"],)).fetchone()
        if not member:
            return jsonify({"error": "Bạn chưa gia nhập tông môn"}), 403

        sect_id = member["sect_id"]
        
        # We need to join with the main books database to fetch book title and cover
        # Since SQLite can ATTACH databases, or we can fetch metadata, we'll fetch from sect_books
        # and query titles from books database. Let's do it cleanly:
        rows = conn.execute("""
            SELECT sb.id, sb.book_id, sb.added_at, u.username as added_by_name
            FROM sect_books sb
            LEFT JOIN users u ON sb.added_by = u.id
            WHERE sb.sect_id = ?
            ORDER BY sb.added_at DESC
        """, (sect_id,)).fetchall()

        from backend.database.db_manager import get_db
        main_conn = get_db()
        
        book_list = []
        for r in rows:
            book_row = main_conn.execute("""
                SELECT id, title, title_vietphrase, title_hanviet, author, cover, description
                FROM books WHERE id = ?
            """, (r["book_id"],)).fetchone()
            if book_row:
                b = serialize_row(book_row)
                b["added_by_name"] = r["added_by_name"]
                b["added_at"] = r["added_at"].isoformat() if hasattr(r["added_at"], "isoformat") else r["added_at"]
                book_list.append(b)

        return jsonify({"books": book_list})
    except Exception as e:
        logger.error(f"Error listing sect library: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

@sects_bp.route("/api/sects/library/add", methods=["POST"])
@jwt_required
def add_to_sect_library():
    user = get_current_user()
    data = request.json or {}
    book_id = data.get("book_id")

    if not book_id:
        return jsonify({"error": "Thiếu book_id truyện đóng góp"}), 400

    conn = get_user_db_conn()
    try:
        member = conn.execute("SELECT sect_id FROM sect_members WHERE user_id = ?", (user["id"],)).fetchone()
        if not member:
            return jsonify({"error": "Bạn không thuộc tông môn nào"}), 400

        sect_id = member["sect_id"]

        # Check if already added
        exists = conn.execute("SELECT id FROM sect_books WHERE sect_id = ? AND book_id = ?", (sect_id, book_id)).fetchone()
        if exists:
            return jsonify({"error": "Truyện này đã được đệ tử khác đóng góp vào thư viện tông môn từ trước"}), 400

        conn.execute(
            "INSERT INTO sect_books (sect_id, book_id, added_by) VALUES (?, ?, ?)",
            (sect_id, book_id, user["id"])
        )
        
        # Reward user 20 contribution points for sharing a book
        conn.execute(
            "UPDATE sect_members SET contribution = contribution + 20 WHERE user_id = ? AND sect_id = ?",
            (user["id"], sect_id)
        )
        # Increase sect total contribution
        conn.execute(
            "UPDATE sects SET contribution = contribution + 20 WHERE id = ?",
            (sect_id,)
        )
        
        conn.commit()
        return jsonify({"success": True, "message": "Chia sẻ truyện vào Thư viện Tông môn thành công! Nhận 20 điểm cống hiến."})
    except Exception as e:
        logger.error(f"Error adding to sect library: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

@sects_bp.route("/api/sects/library/remove", methods=["POST"])
@jwt_required
def remove_from_sect_library():
    user = get_current_user()
    data = request.json or {}
    book_id = data.get("book_id")

    if not book_id:
        return jsonify({"error": "Thiếu book_id truyện cần gỡ"}), 400

    conn = get_user_db_conn()
    try:
        member = conn.execute("SELECT sect_id, role FROM sect_members WHERE user_id = ?", (user["id"],)).fetchone()
        if not member:
            return jsonify({"error": "Bạn không thuộc tông môn nào"}), 400

        sect_id = member["sect_id"]
        
        # Check who added it
        book = conn.execute("SELECT added_by FROM sect_books WHERE sect_id = ? AND book_id = ?", (sect_id, book_id)).fetchone()
        if not book:
            return jsonify({"error": "Truyện không có trong thư viện tông môn"}), 404

        # Only leader, elder, or the original adder can remove
        if member["role"] not in ['leader', 'elder'] and book["added_by"] != user["id"]:
            return jsonify({"error": "Bạn không có quyền gỡ truyện này (Chỉ Tông chủ, Trưởng lão hoặc người đóng góp)"}), 403

        conn.execute("DELETE FROM sect_books WHERE sect_id = ? AND book_id = ?", (sect_id, book_id))
        conn.commit()
        return jsonify({"success": True, "message": "Đã gỡ truyện khỏi thư viện Tông môn!"})
    except Exception as e:
        logger.error(f"Error removing from sect library: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


# ==========================================
# SECT SEARCH & PROFILE BY ID
# ==========================================

ROLE_ORDER = {
    "leader": 1,
    "vice_leader": 2,
    "elder": 3,
    "inner_disciple": 4,
    "member": 5,
}

ROLE_LABELS = {
    "leader": "Tông chủ",
    "vice_leader": "Phó Tông chủ",
    "elder": "Trưởng lão",
    "inner_disciple": "Nội môn đệ tử",
    "member": "Ngoại môn đệ tử",
}

VALID_ROLES = list(ROLE_ORDER.keys())


@sects_bp.route("/api/sects/search", methods=["GET"])
def search_sects():
    """Search sects by name or slogan. No auth required."""
    q = request.args.get("q", "").strip()
    page = int(request.args.get("page", 1))
    per_page = int(request.args.get("per_page", 20))
    offset = (page - 1) * per_page

    conn = get_user_db_conn()
    try:
        if q:
            rows = conn.execute("""
                SELECT s.id, s.name, s.slogan, s.badge, s.level, s.contribution, s.created_at,
                       u.username as leader_name,
                       (SELECT COUNT(*) FROM sect_members WHERE sect_id = s.id) as member_count
                FROM sects s
                LEFT JOIN users u ON s.leader_id = u.id
                WHERE s.name LIKE ? OR s.slogan LIKE ?
                ORDER BY s.contribution DESC, s.created_at DESC
                LIMIT ? OFFSET ?
            """, (f"%{q}%", f"%{q}%", per_page, offset)).fetchall()

            total = conn.execute(
                "SELECT COUNT(*) as cnt FROM sects WHERE name LIKE ? OR slogan LIKE ?",
                (f"%{q}%", f"%{q}%")
            ).fetchone()["cnt"]
        else:
            rows = conn.execute("""
                SELECT s.id, s.name, s.slogan, s.badge, s.level, s.contribution, s.created_at,
                       u.username as leader_name,
                       (SELECT COUNT(*) FROM sect_members WHERE sect_id = s.id) as member_count
                FROM sects s
                LEFT JOIN users u ON s.leader_id = u.id
                ORDER BY s.contribution DESC, s.created_at DESC
                LIMIT ? OFFSET ?
            """, (per_page, offset)).fetchall()
            total = conn.execute("SELECT COUNT(*) as cnt FROM sects").fetchone()["cnt"]

        return jsonify({
            "sects": [serialize_row(r) for r in rows],
            "total": total,
            "page": page,
            "per_page": per_page,
            "total_pages": max(1, (total + per_page - 1) // per_page)
        })
    except Exception as e:
        logger.error(f"Error searching sects: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


@sects_bp.route("/api/sects/<int:sect_id>", methods=["GET"])
def get_sect_by_id(sect_id):
    """View full sect profile by ID. No auth required for basic info."""
    conn = get_user_db_conn()
    try:
        sect = conn.execute("""
            SELECT s.id, s.name, s.slogan, s.announcement, s.badge, s.level, s.contribution, s.created_at,
                   u.username as leader_name, u.id as leader_id, u.avatar as leader_avatar
            FROM sects s
            LEFT JOIN users u ON s.leader_id = u.id
            WHERE s.id = ?
        """, (sect_id,)).fetchone()

        if not sect:
            return jsonify({"error": "Tông môn không tồn tại"}), 404

        members = conn.execute("""
            SELECT sm.user_id, sm.role, sm.contribution, sm.joined_at,
                   u.username, u.avatar,
                   COALESCE(sm.role, 'member') as role
            FROM sect_members sm
            LEFT JOIN users u ON sm.user_id = u.id
            WHERE sm.sect_id = ?
            ORDER BY
              CASE sm.role
                WHEN 'leader' THEN 1
                WHEN 'vice_leader' THEN 2
                WHEN 'elder' THEN 3
                WHEN 'inner_disciple' THEN 4
                ELSE 5
              END,
              sm.contribution DESC
        """, (sect_id,)).fetchall()

        # Enrich members with Vietnamese role labels
        member_list = []
        for m in members:
            md = serialize_row(m)
            md["role_label"] = ROLE_LABELS.get(m["role"], "Môn đồ")
            member_list.append(md)

        # Count by role
        role_counts = {}
        for m in member_list:
            r = m["role"]
            role_counts[r] = role_counts.get(r, 0) + 1

        return jsonify({
            "sect": serialize_row(sect),
            "members": member_list,
            "member_count": len(member_list),
            "role_counts": role_counts,
            "role_labels": ROLE_LABELS,
        })
    except Exception as e:
        logger.error(f"Error fetching sect {sect_id}: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


# ==========================================
# FULL RANK PROMOTION SYSTEM (5 Ranks)
# ==========================================

@sects_bp.route("/api/sects/promote/rank", methods=["POST"])
@jwt_required
def promote_member_rank():
    """
    Full 5-rank promotion system:
    leader > vice_leader > elder > inner_disciple > member
    Only leader can set: vice_leader, elder, inner_disciple, member
    vice_leader can set: elder, inner_disciple, member
    elder can set: inner_disciple, member
    """
    user = get_current_user()
    data = request.json or {}
    target_user_id = data.get("user_id")
    new_role = data.get("role", "").lower()

    if new_role not in VALID_ROLES or new_role == "leader":
        return jsonify({
            "error": f"Chức vị không hợp lệ. Các chức vị có thể gán: {', '.join(VALID_ROLES[1:])}",
            "valid_roles": VALID_ROLES[1:],
            "role_labels": ROLE_LABELS,
        }), 400

    if not target_user_id:
        return jsonify({"error": "Thiếu user_id"}), 400

    conn = get_user_db_conn()
    try:
        caller = conn.execute(
            "SELECT sect_id, role FROM sect_members WHERE user_id = ?", (user["id"],)
        ).fetchone()
        if not caller:
            return jsonify({"error": "Bạn chưa gia nhập tông môn"}), 403

        sect_id = caller["sect_id"]
        caller_role = caller["role"]
        caller_order = ROLE_ORDER.get(caller_role, 99)
        new_role_order = ROLE_ORDER.get(new_role, 99)

        # Permission matrix: caller must outrank new_role
        if caller_order >= new_role_order:
            return jsonify({
                "error": f"Bạn ({ROLE_LABELS.get(caller_role)}) không đủ quyền gán chức vị {ROLE_LABELS.get(new_role)}"
            }), 403

        target = conn.execute(
            "SELECT role FROM sect_members WHERE user_id = ? AND sect_id = ?",
            (target_user_id, sect_id)
        ).fetchone()
        if not target:
            return jsonify({"error": "Thành viên không thuộc tông môn của bạn"}), 404

        if target["role"] == "leader":
            return jsonify({"error": "Không thể thay đổi chức vị của Tông chủ"}), 400

        target_order = ROLE_ORDER.get(target["role"], 99)
        if caller_order >= target_order:
            return jsonify({
                "error": f"Bạn ({ROLE_LABELS.get(caller_role)}) không thể thay đổi chức vị của người ngang hoặc cao hơn bạn"
            }), 403

        conn.execute(
            "UPDATE sect_members SET role = ? WHERE user_id = ? AND sect_id = ?",
            (new_role, target_user_id, sect_id)
        )
        conn.commit()

        return jsonify({
            "success": True,
            "message": f"Đã gán chức vị {ROLE_LABELS.get(new_role)} thành công!",
            "new_role": new_role,
            "new_role_label": ROLE_LABELS.get(new_role),
        })
    except Exception as e:
        logger.error(f"Error promoting rank: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


@sects_bp.route("/api/sects/members", methods=["GET"])
@jwt_required
def list_sect_members():
    """List all members of current user's sect with full role info."""
    user = get_current_user()
    role_filter = request.args.get("role")
    conn = get_user_db_conn()
    try:
        member = conn.execute(
            "SELECT sect_id FROM sect_members WHERE user_id = ?", (user["id"],)
        ).fetchone()
        if not member:
            return jsonify({"error": "Bạn chưa gia nhập tông môn"}), 403

        sect_id = member["sect_id"]

        if role_filter and role_filter in VALID_ROLES:
            rows = conn.execute("""
                SELECT sm.user_id, sm.role, sm.contribution, sm.joined_at,
                       u.username, u.avatar
                FROM sect_members sm
                LEFT JOIN users u ON sm.user_id = u.id
                WHERE sm.sect_id = ? AND sm.role = ?
                ORDER BY sm.contribution DESC
            """, (sect_id, role_filter)).fetchall()
        else:
            rows = conn.execute("""
                SELECT sm.user_id, sm.role, sm.contribution, sm.joined_at,
                       u.username, u.avatar
                FROM sect_members sm
                LEFT JOIN users u ON sm.user_id = u.id
                WHERE sm.sect_id = ?
                ORDER BY
                  CASE sm.role
                    WHEN 'leader' THEN 1
                    WHEN 'vice_leader' THEN 2
                    WHEN 'elder' THEN 3
                    WHEN 'inner_disciple' THEN 4
                    ELSE 5
                  END,
                  sm.contribution DESC
            """, (sect_id,)).fetchall()

        member_list = []
        for r in rows:
            rd = serialize_row(r)
            rd["role_label"] = ROLE_LABELS.get(r["role"], "Môn đồ")
            member_list.append(rd)

        return jsonify({
            "members": member_list,
            "total": len(member_list),
            "role_labels": ROLE_LABELS,
            "valid_roles": VALID_ROLES,
        })
    except Exception as e:
        logger.error(f"Error listing members: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


# ==========================================
# SECT CHAT GROUPS – MANAGE MEMBERS
# ==========================================

@sects_bp.route("/api/sects/chat/groups/<int:group_id>/members/add", methods=["POST"])
@jwt_required
def add_to_chat_group(group_id):
    """Add member(s) to a sub-group chat."""
    user = get_current_user()
    data = request.json or {}
    new_member_ids = data.get("user_ids", [])

    conn = get_user_db_conn()
    try:
        my_member = conn.execute(
            "SELECT sect_id, role FROM sect_members WHERE user_id = ?", (user["id"],)
        ).fetchone()
        if not my_member:
            return jsonify({"error": "Bạn chưa gia nhập tông môn"}), 403

        sect_id = my_member["sect_id"]
        group = conn.execute(
            "SELECT id, creator_id, members_csv FROM sect_chat_groups WHERE id = ? AND sect_id = ?",
            (group_id, sect_id)
        ).fetchone()

        if not group:
            return jsonify({"error": "Nhóm chat không tồn tại"}), 404

        # Only group creator, leader, vice_leader, elder can add
        if group["creator_id"] != user["id"] and my_member["role"] not in ["leader", "vice_leader", "elder"]:
            return jsonify({"error": "Chỉ người tạo nhóm hoặc Ban quản lý mới có thể thêm thành viên"}), 403

        current_members = [int(x) for x in group["members_csv"].split(",") if x.strip()]
        added = []
        for uid in new_member_ids:
            uid = int(uid)
            if uid not in current_members:
                # Check uid is in sect
                in_sect = conn.execute(
                    "SELECT 1 FROM sect_members WHERE user_id = ? AND sect_id = ?", (uid, sect_id)
                ).fetchone()
                if in_sect:
                    current_members.append(uid)
                    added.append(uid)

        new_csv = ",".join(str(x) for x in current_members)
        conn.execute(
            "UPDATE sect_chat_groups SET members_csv = ? WHERE id = ?",
            (new_csv, group_id)
        )
        conn.commit()
        return jsonify({"success": True, "added": added, "members": current_members})
    except Exception as e:
        logger.error(f"Error adding to chat group: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


@sects_bp.route("/api/sects/chat/groups/<int:group_id>/members/remove", methods=["POST"])
@jwt_required
def remove_from_chat_group(group_id):
    """Remove a member from a sub-group chat."""
    user = get_current_user()
    data = request.json or {}
    target_id = data.get("user_id")

    conn = get_user_db_conn()
    try:
        my_member = conn.execute(
            "SELECT sect_id, role FROM sect_members WHERE user_id = ?", (user["id"],)
        ).fetchone()
        if not my_member:
            return jsonify({"error": "Bạn chưa gia nhập tông môn"}), 403

        sect_id = my_member["sect_id"]
        group = conn.execute(
            "SELECT id, creator_id, members_csv FROM sect_chat_groups WHERE id = ? AND sect_id = ?",
            (group_id, sect_id)
        ).fetchone()
        if not group:
            return jsonify({"error": "Nhóm chat không tồn tại"}), 404

        if group["creator_id"] != user["id"] and my_member["role"] not in ["leader", "vice_leader", "elder"]:
            return jsonify({"error": "Không đủ quyền xóa thành viên khỏi nhóm chat"}), 403

        current_members = [int(x) for x in group["members_csv"].split(",") if x.strip()]
        if int(target_id) not in current_members:
            return jsonify({"error": "Thành viên không có trong nhóm chat này"}), 400

        current_members.remove(int(target_id))
        new_csv = ",".join(str(x) for x in current_members)
        conn.execute("UPDATE sect_chat_groups SET members_csv = ? WHERE id = ?", (new_csv, group_id))
        conn.commit()
        return jsonify({"success": True, "members": current_members})
    except Exception as e:
        logger.error(f"Error removing from chat group: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


@sects_bp.route("/api/sects/chat/groups/<int:group_id>", methods=["GET"])
@jwt_required
def get_chat_group_info(group_id):
    """Get info and member list of a sub-group chat."""
    user = get_current_user()
    conn = get_user_db_conn()
    try:
        my_member = conn.execute(
            "SELECT sect_id FROM sect_members WHERE user_id = ?", (user["id"],)
        ).fetchone()
        if not my_member:
            return jsonify({"error": "Bạn chưa gia nhập tông môn"}), 403

        sect_id = my_member["sect_id"]
        group = conn.execute(
            "SELECT * FROM sect_chat_groups WHERE id = ? AND sect_id = ?",
            (group_id, sect_id)
        ).fetchone()
        if not group:
            return jsonify({"error": "Nhóm chat không tồn tại"}), 404

        member_ids = [int(x) for x in group["members_csv"].split(",") if x.strip()]
        if user["id"] not in member_ids:
            return jsonify({"error": "Bạn không phải thành viên của nhóm chat này"}), 403

        # Fetch member details
        members = []
        for uid in member_ids:
            row = conn.execute("""
                SELECT sm.user_id, sm.role, sm.contribution, u.username, u.avatar
                FROM sect_members sm
                LEFT JOIN users u ON sm.user_id = u.id
                WHERE sm.user_id = ? AND sm.sect_id = ?
            """, (uid, sect_id)).fetchone()
            if row:
                rd = serialize_row(row)
                rd["role_label"] = ROLE_LABELS.get(row["role"], "Môn đồ")
                members.append(rd)

        return jsonify({
            "group": serialize_row(group),
            "members": members,
            "member_count": len(members),
        })
    except Exception as e:
        logger.error(f"Error fetching chat group: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


@sects_bp.route("/api/sects/chat/groups", methods=["GET"])
@jwt_required
def list_all_sect_chat_groups():
    """List all sub-group chats the current user is part of in their sect."""
    user = get_current_user()
    conn = get_user_db_conn()
    try:
        my_member = conn.execute(
            "SELECT sect_id FROM sect_members WHERE user_id = ?", (user["id"],)
        ).fetchone()
        if not my_member:
            return jsonify({"error": "Bạn chưa gia nhập tông môn"}), 403

        sect_id = my_member["sect_id"]
        groups = conn.execute(
            "SELECT id, name, creator_id, members_csv, created_at FROM sect_chat_groups WHERE sect_id = ?",
            (sect_id,)
        ).fetchall()

        result = []
        for g in groups:
            member_ids = [int(x) for x in g["members_csv"].split(",") if x.strip()]
            if user["id"] in member_ids:
                gd = serialize_row(g)
                gd["member_count"] = len(member_ids)
                result.append(gd)

        return jsonify({"groups": result})
    except Exception as e:
        logger.error(f"Error listing chat groups: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

