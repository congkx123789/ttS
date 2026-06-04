import os
import sys
import sqlite3
import pandas as pd
from huggingface_hub import HfApi, hf_hub_download
import time

DB_PATH = "chinese_novels_filtered.db"
REPO_ID = "jetaudio/chinese_web_novels"

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS novels (
            title TEXT,
            author TEXT,
            category TEXT,
            UNIQUE(title, author)
        )
    """)
    conn.commit()
    conn.close()

def save_batch_to_db(df, title_col, author_col, cat_col):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Chuẩn hóa tên cột để trích xuất an toàn
    extracted = pd.DataFrame()
    extracted["title"] = df[title_col]
    extracted["author"] = df[author_col]
    
    # Nếu thể loại trùng với tên/tác giả (do không có cột thể loại thực), gán giá trị mặc định
    if cat_col and cat_col in df.columns and cat_col != title_col and cat_col != author_col:
        extracted["category"] = df[cat_col]
    else:
        extracted["category"] = "Chưa rõ"
    
    # Loại bỏ các hàng bị thiếu hoặc trùng lặp trong chính batch này
    extracted = extracted.dropna(subset=["title", "author"])
    extracted["title"] = extracted["title"].astype(str).str.strip()
    extracted["author"] = extracted["author"].astype(str).str.strip()
    extracted["category"] = extracted["category"].astype(str).str.strip()
    
    # Ghi đè hoặc bỏ qua nếu trùng khóa Unique
    records = extracted.to_records(index=False)
    
    saved_count = 0
    for record in records:
        try:
            cursor.execute("""
                INSERT OR IGNORE INTO novels (title, author, category)
                VALUES (?, ?, ?)
            """, (record[0], record[1], record[2]))
            if cursor.rowcount > 0:
                saved_count += 1
        except Exception:
            pass
            
    conn.commit()
    conn.close()
    return saved_count

def get_total_count():
    if not os.path.exists(DB_PATH):
        return 0
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM novels")
    count = cursor.fetchone()[0]
    conn.close()
    return count

def main():
    init_db()
    
    print("=" * 60)
    print("HỆ THỐNG LỌC TẬP DỮ LIỆU CHINESE WEB NOVELS TỪ HUGGING FACE")
    print("=" * 60)
    
    # 1. Yêu cầu nhập token Hugging Face
    print("Lưu ý: Tập dữ liệu này bị Gated (yêu cầu xác thực tài khoản).")
    print("Hãy truy cập https://huggingface.co/datasets/jetaudio/chinese_web_novels để chấp nhận điều khoản.")
    print("Sau đó lấy Access Token (Read) tại https://huggingface.co/settings/tokens")
    
    token = os.environ.get("HF_TOKEN")
    if not token:
        token = input("Nhập Hugging Face Access Token của bạn: ").strip()
        if not token:
            print("[LỖI] Cần có Access Token để tải file từ gated dataset.")
            sys.exit(1)
            
    api = HfApi(token=token)
    
    # 2. Liệt kê danh sách các file parquet
    print("\n[1/3] Đang tải danh sách file từ Hugging Face...")
    try:
        files = api.list_repo_files(repo_id=REPO_ID, repo_type="dataset")
        parquet_files = sorted([f for f in files if f.endswith('.parquet')])
        print(f"[OK] Tìm thấy {len(parquet_files)} file Parquet.")
    except Exception as e:
        print(f"[LỖI] Không thể kết nối hoặc xác thực thất bại: {e}")
        print("Vui lòng kiểm tra lại Token và đảm bảo bạn đã nhấn 'Accept' trên trang dataset.")
        sys.exit(1)
        
    if not parquet_files:
        print("[LỖI] Không tìm thấy file parquet nào.")
        sys.exit(1)
        
    # 3. Tải thử 1 file để xác định tên cột (schema)
    print("\n[2/3] Đang tải thử một file để xác định cấu trúc cột...")
    test_file = parquet_files[0]
    try:
        local_path = hf_hub_download(
            repo_id=REPO_ID,
            filename=test_file,
            repo_type="dataset",
            token=token
        )
        # Đọc cấu trúc cột
        df_test = pd.read_parquet(local_path)
        cols = list(df_test.columns)
        print(f"Các cột có sẵn trong file: {cols}")
        
        # Tìm các cột phù hợp nhất
        title_col = None
        author_col = None
        cat_col = None
        
        for col in cols:
            col_lower = col.lower()
            if col_lower in ['title', 'name', 'bookname', 'book_name', 'novelname', 'novel_name']:
                title_col = col
            elif col_lower in ['author', 'writer', 'creator']:
                author_col = col
            elif col_lower in ['category', 'genre', 'tag', 'tags', 'type', 'class']:
                cat_col = col
                
        # Nếu không tự nhận diện được, lấy mặc định
        if not title_col:
            title_col = cols[0]
        if not author_col:
            author_col = cols[1] if len(cols) > 1 else cols[0]
        if not cat_col:
            # Không có cột thể loại thì dùng tạm cột tên truyện làm placeholder
            cat_col = title_col
            
        print(f"\n[OK] Đã chọn cấu trúc bản ghi:")
        print(f" - Tên truyện: '{title_col}'")
        print(f" - Tác giả: '{author_col}'")
        print(f" - Thể loại: '{cat_col}'")
        
        # Xóa file test sau khi dùng xong
        if os.path.exists(local_path):
            os.remove(local_path)
            
    except Exception as e:
        print(f"[LỖI] Không thể tải hoặc đọc file mẫu: {e}")
        sys.exit(1)
        
    # 4. Bắt đầu tải và trích xuất hàng loạt
    print("\n[3/3] Bắt đầu xử lý hàng loạt...")
    start_time = time.time()
    
    # Cho phép người dùng tiếp tục nếu trước đó bị dừng
    processed_count = 0
    total_saved = get_total_count()
    print(f"Số lượng truyện hiện có sẵn trong database: {total_saved}")
    
    for idx, filename in enumerate(parquet_files):
        print(f"\n[{idx+1}/{len(parquet_files)}] Đang xử lý file: {filename}")
        local_file = None
        try:
            # Tải file parquet
            local_file = hf_hub_download(
                repo_id=REPO_ID,
                filename=filename,
                repo_type="dataset",
                token=token
            )
            
            # Đọc file parquet chỉ lấy các cột cần thiết (dùng set để loại bỏ trùng lặp)
            read_cols = list(set([title_col, author_col, cat_col]))
            df = pd.read_parquet(local_file, columns=read_cols)
            
            # Lưu vào DB
            added = save_batch_to_db(df, title_col, author_col, cat_col)
            processed_count += 1
            total_saved = get_total_count()
            
            print(f" -> Đã trích xuất {len(df)} hàng (Thêm mới thành công {added} truyện). Tổng DB hiện tại: {total_saved}")
            
        except KeyboardInterrupt:
            print("\n[DỪNG] Đã dừng chương trình theo yêu cầu của bạn.")
            break
        except Exception as e:
            print(f" -> [LỖI] Không thể xử lý file này: {e}")
        finally:
            # LUÔN LUÔN xóa file parquet đã tải về để giải phóng ổ đĩa lập tức
            if local_file and os.path.exists(local_file):
                try:
                    os.remove(local_file)
                except Exception:
                    pass
                    
    duration = time.time() - start_time
    print("\n" + "=" * 60)
    print("HOÀN THÀNH QUÁ TRÌNH LỌC DỮ LIỆU!")
    print(f"Tổng số truyện trong cơ sở dữ liệu '{DB_PATH}': {get_total_count()}")
    print(f"Thời gian thực hiện: {duration:.2f} giây.")
    print("=" * 60)

if __name__ == "__main__":
    main()
