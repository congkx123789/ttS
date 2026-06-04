import sqlite3
import json
import os

DB_PATH = "qidian_books.db"
JSON_PATH = "qidian_books.json"

def export():
    if not os.path.exists(DB_PATH):
        print(f"Lỗi: Không tìm thấy file database '{DB_PATH}'. Bạn cần chạy file crawl trước!")
        return

    print(f"Đang kết nối tới database '{DB_PATH}'...")
    conn = sqlite3.connect(DB_PATH)
    # Cấu hình trả về dạng dict thay vì tuple
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM books")
    rows = cursor.fetchall()
    
    books = []
    for row in rows:
        books.append({
            "id": row["id"],
            "title": row["title"],
            "author": row["author"],
            "category": row["category"],
            "url": row["url"],
            "cover": row["cover"],
            "description": row["description"]
        })
        
    # Lưu ra file JSON sạch
    with open(JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(books, f, ensure_ascii=False, indent=4)
        
    print(f"[THÀNH CÔNG] Đã xuất {len(books)} cuốn truyện ra file text JSON: '{JSON_PATH}'")
    conn.close()

if __name__ == "__main__":
    export()
