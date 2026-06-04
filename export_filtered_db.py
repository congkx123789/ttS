import sqlite3
import json
import csv
import sys
import os

DB_PATH = "chinese_novels_filtered.db"

def export_to_json():
    print(f"Đang kết nối tới database '{DB_PATH}'...")
    if not os.path.exists(DB_PATH):
        print(f"[LỖI] Cơ sở dữ liệu '{DB_PATH}' không tồn tại. Hãy chạy script cào/lọc trước.")
        return
        
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        cursor.execute("SELECT title, author, category FROM novels")
        rows = cursor.fetchall()
        
        books = []
        for row in rows:
            books.append({
                "title": row[0],
                "author": row[1],
                "category": row[2]
            })
            
        json_file = "chinese_novels_filtered.json"
        with open(json_file, "w", encoding="utf-8") as f:
            json.dump(books, f, ensure_ascii=False, indent=4)
            
        print(f"[THÀNH CÔNG] Đã xuất {len(books)} truyện ra file JSON: '{json_file}'")
    except Exception as e:
        print(f"[LỖI] Không thể truy vấn hoặc xuất dữ liệu: {e}")
    finally:
        conn.close()

def export_to_csv():
    print(f"Đang kết nối tới database '{DB_PATH}'...")
    if not os.path.exists(DB_PATH):
        print(f"[LỖI] Cơ sở dữ liệu '{DB_PATH}' không tồn tại. Hãy chạy script cào/lọc trước.")
        return
        
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        cursor.execute("SELECT title, author, category FROM novels")
        rows = cursor.fetchall()
        
        csv_file = "chinese_novels_filtered.csv"
        with open(csv_file, "w", encoding="utf-8", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(["Title", "Author", "Category"])
            writer.writerows(rows)
            
        print(f"[THÀNH CÔNG] Đã xuất {len(rows)} truyện ra file CSV: '{csv_file}'")
    except Exception as e:
        print(f"[LỖI] Không thể truy vấn hoặc xuất dữ liệu: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1].lower() == "csv":
        export_to_csv()
    else:
        export_to_json()
        print("Mẹo: Để xuất ra định dạng CSV, hãy chạy lệnh: python export_filtered_db.py csv")
