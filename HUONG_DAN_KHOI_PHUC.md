# 📖 HƯỚNG DẪN KHÔI PHỤC HỆ THỐNG DỊCH TRUYỆN (TOOL TRANSLATE CHINESE)

Tài liệu này hướng dẫn cách khôi phục lại toàn bộ hệ thống Dịch Truyện của bạn trên một máy tính mới hoàn toàn, với dữ liệu và mã nguồn đã được bảo mật trên Cloud.

---

## 🔒 BƯỚC 0: CHUẨN BỊ (QUAN TRỌNG NHẤT)
Vì lý do bảo mật, Github và HuggingFace **không** lưu trữ các file chứa mật khẩu. Bạn bắt buộc phải có 2 file này từ máy tính cũ (hoặc tự tạo lại dựa trên file mẫu):
1. `consolidated_keys.env`
2. `.env` (Chứa mật khẩu Database Supabase, Email gửi OTP...)
3. `gcp-key.json` (Để deploy lên Firebase nếu cần)

---

## 🐙 BƯỚC 1: TẢI MÃ NGUỒN TỪ GITHUB
Mở Terminal (hoặc Command Prompt) trên máy mới và chạy lệnh:
```bash
# Tải mã nguồn về
git clone git@github.com:congkx123789/ttS.git

# Di chuyển vào thư mục dự án
cd ttS
```
*Sau khi tải xong, hãy Copy 3 file bảo mật ở BƯỚC 0 dán vào thư mục `ttS` này.*

---

## 🤗 BƯỚC 2: TẢI DỮ LIỆU TỪ HUGGINGFACE (8.5 GB)
Hệ thống truyện, tài khoản người dùng và từ điển nằm trên HuggingFace. Hãy chạy các lệnh sau:

```bash
# Cài đặt công cụ HuggingFace
pip install -U "huggingface_hub[cli]"

# Đăng nhập (Nhập Access Token lấy từ Cài đặt HuggingFace của bạn)
huggingface-cli login

# Tải TOÀN BỘ dữ liệu về máy (Lưu ý: Quá trình này sẽ tải ~8.5GB)
huggingface-cli download Cong123779/crawled_chinese_novels --repo-type dataset --local-dir .
```

---

## 🛠️ BƯỚC 3: GIẢI NÉN VÀ CÀI ĐẶT
Sau khi HuggingFace tải xong, bạn cần giải nén Từ Điển và cài đặt thư viện:

```bash
# Giải nén kho Từ Điển
unzip dictionaries_backup.zip

# Giải nén công cụ dịch Offline (nếu cần dùng)
unzip quick_translator.zip

# Cài đặt các thư viện Python cho hệ thống
pip install -r requirements.txt
```

---

## 🚀 BƯỚC 4: KHỞI ĐỘNG HỆ THỐNG
Hệ thống của bạn đã khôi phục 100% về trạng thái cũ! Bây giờ bạn chỉ việc chạy:

```bash
# Khởi động Backend API
python3 viewer_server.py
```
Hệ thống sẽ chạy ở port `5051`. 

*Lưu ý: Nếu bạn muốn chạy tên miền `api-tienhiep.lyvuha.com`, hãy đảm bảo cài đặt và chạy Cloudflared Tunnel trỏ vào `localhost:5051` giống như máy tính cũ.*

---
🎉 **CHÚC BẠN KHÔI PHỤC THÀNH CÔNG!** 🎉
