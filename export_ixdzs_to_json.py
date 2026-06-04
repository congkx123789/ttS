import sqlite3
import json
import csv
import sys
import os

DB_PATH = "ixdzs_books.db"

def export_to_json():
    print(f"Đang kết nối tới database '{DB_PATH}'...")
    if not os.path.exists(DB_PATH):
        print(f"[LỖI] Cơ sở dữ liệu '{DB_PATH}' không tồn tại.")
        return
        
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        cursor.execute("SELECT id, url, title, author, category, status FROM ixdzs_novels")
        rows = cursor.fetchall()
        
        books = []
        for row in rows:
            books.append({
                "id": row[0],
                "url": row[1],
                "title": row[2],
                "author": row[3],
                "category": row[4],
                "status": row[5]
            })
            
        json_file = "ixdzs_books.json"
        with open(json_file, "w", encoding="utf-8") as f:
            json.dump(books, f, ensure_ascii=False, indent=4)
            
        print(f"[THÀNH CÔNG] Đã xuất {len(books)} dòng ra file JSON: '{json_file}'")
    except Exception as e:
        print(f"[LỖI] Không thể truy vấn hoặc xuất dữ liệu: {e}")
    finally:
        conn.close()

def export_to_csv():
    print(f"Đang kết nối tới database '{DB_PATH}'...")
    if not os.path.exists(DB_PATH):
        print(f"[LỖI] Cơ sở dữ liệu '{DB_PATH}' không tồn tại.")
        return
        
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        cursor.execute("SELECT id, url, title, author, category, status FROM ixdzs_novels")
        rows = cursor.fetchall()
        
        csv_file = "ixdzs_books.csv"
        with open(csv_file, "w", encoding="utf-8", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(["ID", "URL", "Title", "Author", "Category", "Status"])
            writer.writerows(rows)
            
        print(f"[THÀNH CÔNG] Đã xuất {len(rows)} dòng ra file CSV: '{csv_file}'")
    except Exception as e:
        print(f"[LỖI] Không thể truy vấn hoặc xuất dữ liệu: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1].lower() == "csv":
        export_to_csv()
    else:
        export_to_json()
        print("Mẹo: Để xuất ra định dạng CSV, hãy chạy lệnh: python export_ixdzs_to_json.py csv")
