import asyncio
import aiohttp
from bs4 import BeautifulSoup
import sqlite3
import os
import sys
import time
import json
import csv
import re

DB_PATH = "ixdzs_books.db"
BASE_URL = "https://ixdzs8.com/read/{}/"
CONCURRENCY = 15  # Hạn chế số kết nối đồng thời để tránh bị chặn IP
BATCH_SIZE = 100  # Lưu vào DB sau mỗi 100 kết quả để tối ưu ghi ổ đĩa
START_ID = 1
END_ID = 646042

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS ixdzs_novels (
            id INTEGER PRIMARY KEY,
            url TEXT UNIQUE,
            title TEXT,
            author TEXT,
            category TEXT,
            chapters INTEGER,
            status TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    
    # Nâng cấp database nếu là DB cũ chưa có cột chapters
    try:
        cursor.execute("ALTER TABLE ixdzs_novels ADD COLUMN chapters INTEGER")
        conn.commit()
    except sqlite3.OperationalError:
        # Cột đã tồn tại hoặc bảng mới được khởi tạo hoàn chỉnh
        pass
        
    conn.close()

def get_completed_ids():
    if not os.path.exists(DB_PATH):
        return set()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM ixdzs_novels")
    ids = {row[0] for row in cursor.fetchall()}
    conn.close()
    return ids

def save_batch(batch):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    for item in batch:
        cursor.execute("""
            INSERT OR REPLACE INTO ixdzs_novels (id, url, title, author, category, chapters, status)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (item['id'], item['url'], item['title'], item['author'], item['category'], item['chapters'], item['status']))
    conn.commit()
    conn.close()

def auto_export_files():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT id, url, title, author, category, chapters, status FROM ixdzs_novels")
        rows = cursor.fetchall()
        
        # 1. Xuất JSON
        books = []
        for r in rows:
            books.append({
                "id": r[0],
                "url": r[1],
                "title": r[2],
                "author": r[3],
                "category": r[4],
                "chapters": r[5],
                "status": r[6]
            })
        with open("ixdzs_books.json", "w", encoding="utf-8") as f:
            json.dump(books, f, ensure_ascii=False, indent=4)
            
        # 2. Xuất CSV
        with open("ixdzs_books.csv", "w", encoding="utf-8", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(["ID", "URL", "Title", "Author", "Category", "Chapters", "Status"])
            writer.writerows(rows)
    except Exception as e:
        print(f"\n[Lỗi tự động xuất file]: {e}")
    finally:
        conn.close()

async def fetch_page(session, book_id, semaphore):
    url = BASE_URL.format(book_id)
    async with semaphore:
        for attempt in range(3):  # Thử lại tối đa 3 lần nếu lỗi mạng
            try:
                headers = {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8"
                }
                async with session.get(url, headers=headers, timeout=10, allow_redirects=True) as response:
                    if response.status == 404:
                        return {
                            "id": book_id,
                            "url": url,
                            "title": None,
                            "author": None,
                            "category": None,
                            "chapters": None,
                            "status": "404"
                        }
                    
                    if response.status != 200:
                        await asyncio.sleep(1 * (attempt + 1))
                        continue
                        
                    html = await response.text(errors='ignore')
                    soup = BeautifulSoup(html, "html.parser")
                    
                    # Trích xuất bằng Meta tags (rất nhanh và chuẩn xác)
                    title_meta = soup.find("meta", property="og:novel:book_name") or soup.find("meta", property="og:title")
                    author_meta = soup.find("meta", property="og:novel:author")
                    cat_meta = soup.find("meta", property="og:novel:category")
                    
                    title = title_meta["content"].strip() if title_meta and title_meta.get("content") else None
                    author = author_meta["content"].strip() if author_meta and author_meta.get("content") else None
                    category = cat_meta["content"].strip() if cat_meta and cat_meta.get("content") else None
                    
                    # Fallback sang Selector thường nếu không có Meta tags
                    if not title:
                        h1_tag = soup.find("h1")
                        title = h1_tag.get_text().strip() if h1_tag else None
                        
                    if not author:
                        a_author = soup.find("a", class_="bauthor")
                        author = a_author.get_text().strip() if a_author else None
                        
                    if not category:
                        a_cat = soup.find("a", class_="nsort")
                        category = a_cat.get_text().strip() if a_cat else None
                        
                    # Lấy số chương từ thẻ <span class="sub-text-r">共103章</span>
                    chapters = None
                    chapters_span = soup.find("span", class_="sub-text-r")
                    if chapters_span:
                        span_text = chapters_span.get_text().strip()
                        digits = re.findall(r'\d+', span_text)
                        if digits:
                            chapters = int(digits[0])
                        
                    # Nếu tìm thấy tiêu đề và tác giả
                    if title or author:
                        return {
                            "id": book_id,
                            "url": url,
                            "title": title,
                            "author": author,
                            "category": category,
                            "chapters": chapters,
                            "status": "Parsed"
                        }
                    else:
                        # Không tìm thấy thông tin nhưng page vẫn 200 -> có thể bị chặn hoặc trang trống
                        return {
                            "id": book_id,
                            "url": url,
                            "title": None,
                            "author": None,
                            "category": None,
                            "chapters": None,
                            "status": "EmptyOrBlocked"
                        }
                        
            except Exception as e:
                if attempt == 2:
                    return {
                        "id": book_id,
                        "url": url,
                        "title": None,
                        "author": None,
                        "category": None,
                        "chapters": None,
                        "status": f"Error: {str(e)[:50]}"
                    }
                await asyncio.sleep(0.5 * (attempt + 1))
        
        # Nếu thử 3 lần vẫn lỗi
        return {
            "id": book_id,
            "url": url,
            "title": None,
            "author": None,
            "category": None,
            "chapters": None,
            "status": "Timeout/Failed"
        }

async def run_crawler():
    init_db()
    completed_ids = get_completed_ids()
    print(f"Đã hoàn thành trước đó: {len(completed_ids)} IDs.")
    
    # Chỉ quét các ID chưa hoàn thành
    all_ids = set(range(START_ID, END_ID + 1))
    pending_ids = sorted(list(all_ids - completed_ids))
    print(f"Còn lại cần quét: {len(pending_ids)} IDs (từ {START_ID} đến {END_ID}).")
    
    if not pending_ids:
        print("Tất cả IDs đã hoàn thành!")
        return
        
    semaphore = asyncio.Semaphore(CONCURRENCY)
    connector = aiohttp.TCPConnector(limit=CONCURRENCY, ttl_dns_cache=300)
    
    async with aiohttp.ClientSession(connector=connector) as session:
        batch = []
        parsed_count = 0
        not_found_count = 0
        error_count = 0
        
        start_time = time.time()
        last_export_count = 0
        
        chunk_size = 500
        for i in range(0, len(pending_ids), chunk_size):
            chunk = pending_ids[i:i + chunk_size]
            tasks = [fetch_page(session, book_id, semaphore) for book_id in chunk]
            
            results = await asyncio.gather(*tasks)
            
            for res in results:
                batch.append(res)
                if res['status'] == "Parsed":
                    parsed_count += 1
                elif res['status'] == "404":
                    not_found_count += 1
                else:
                    error_count += 1
                    
                if len(batch) >= BATCH_SIZE:
                    save_batch(batch)
                    batch = []
                    
            # Hiển thị tiến trình
            elapsed = time.time() - start_time
            processed = (i + len(chunk))
            speed = processed / elapsed if elapsed > 0 else 0
            remaining_ids = len(pending_ids) - processed
            eta = remaining_ids / speed if speed > 0 else 0
            
            print(f"Tiến độ: {processed}/{len(pending_ids)} ({processed/len(pending_ids)*100:.2f}%) "
                  f"| Thành công: {parsed_count} | 404: {not_found_count} | Lỗi khác: {error_count} "
                  f"| Tốc độ: {speed:.1f} id/s | ETA: {eta/3600:.2f}h")
                  
            # Tự động ghi đè file JSON/CSV sau mỗi 5,000 ID xử lý
            if (processed - last_export_count) >= 5000:
                auto_export_files()
                last_export_count = processed
                
            # Nghỉ ngắn giữa các chunk để tránh bị block IP
            await asyncio.sleep(0.5)
            
        if batch:
            save_batch(batch)
            
        # Xuất file lần cuối để đồng bộ toàn bộ dữ liệu
        auto_export_files()
            
        print("\n=== HOÀN THÀNH QUÉT DỮ LIỆU ===")
        print(f"Tổng số bản ghi đã xử lý thêm: {len(pending_ids)}")
        print(f"Thành công: {parsed_count} | 404: {not_found_count} | Lỗi khác: {error_count}")

if __name__ == "__main__":
    try:
        asyncio.run(run_crawler())
    except KeyboardInterrupt:
        print("\n[ĐÃ DỪNG CRAWLER] Đã lưu tiến trình vào cơ sở dữ liệu.")
