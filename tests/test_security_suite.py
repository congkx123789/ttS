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
            conn.execute("DROP TABLE IF EXISTS sects")
            conn.execute("DROP TABLE IF EXISTS sect_members")
            conn.execute("DROP TABLE IF EXISTS sect_messages")
            conn.execute("DROP TABLE IF EXISTS book_comments")
            
            # Khởi tạo lại toàn bộ schema
            from backend.database.db_manager import _init_db_schema_for_conn
            _init_db_schema_for_conn(conn)
            
            # Gieo dữ liệu giả lập (mồi)
            # 1. Tạo 2 user
            conn.execute(
                "INSERT INTO users (id, username, password_hash, vip_status) VALUES (?, ?, ?, ?)",
                (999, "sender_dao_huu", hash_password("pass123"), 1)
            )
            conn.execute(
                "INSERT INTO users (id, username, password_hash, vip_status) VALUES (?, ?, ?, ?)",
                (888, "receiver_dao_huu", hash_password("pass123"), 0)
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


if __name__ == "__main__":
    unittest.main()
