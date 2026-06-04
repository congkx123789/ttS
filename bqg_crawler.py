import asyncio
import aiohttp
import sqlite3
import os
import sys
import time
import json
import csv

DB_PATH = "bqg_books.db"
CONCURRENCY = 15  # Good speed since API is fast and doesn't block easily
BATCH_SIZE = 200
START_ID = 1
END_ID = 200298

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS bqg_novels (
            id INTEGER PRIMARY KEY,
            url TEXT UNIQUE,
            title TEXT,
            author TEXT,
            category TEXT,
            status TEXT,
            chapters INTEGER,
            cover TEXT,
            description TEXT,
            crawl_status TEXT DEFAULT 'Pending',
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()

def get_completed_ids():
    if not os.path.exists(DB_PATH):
        return set()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM bqg_novels")
    ids = {row[0] for row in cursor.fetchall()}
    conn.close()
    return ids

def save_batch(batch):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    for item in batch:
        cursor.execute("""
            INSERT OR REPLACE INTO bqg_novels (id, url, title, author, category, status, chapters, cover, description, crawl_status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            item['id'], item['url'], item['title'], item['author'],
            item['category'], item['status'], item['chapters'],
            item['cover'], item['description'], item['crawl_status']
        ))
    conn.commit()
    conn.close()

def auto_export_files():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT id, url, title, author, category, status, chapters, cover, description, crawl_status 
            FROM bqg_novels 
            WHERE crawl_status = 'Parsed'
        """)
        rows = cursor.fetchall()
        
        # 1. Export JSON
        books = []
        for r in rows:
            books.append({
                "id": r[0],
                "url": r[1],
                "title": r[2],
                "author": r[3],
                "category": r[4],
                "status": r[5],
                "chapters": r[6],
                "cover": r[7],
                "description": r[8],
                "crawl_status": r[9]
            })
        with open("bqg_books.json", "w", encoding="utf-8") as f:
            json.dump(books, f, ensure_ascii=False, indent=4)
            
        # 2. Export CSV
        with open("bqg_books.csv", "w", encoding="utf-8", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(["ID", "URL", "Title", "Author", "Category", "Status", "Chapters", "Cover", "Description", "CrawlStatus"])
            writer.writerows(rows)
    except Exception as e:
        print(f"\n[Lỗi tự động xuất file]: {e}")
    finally:
        conn.close()

async def fetch_book(session, book_id, semaphore):
    api_url = f"https://d122cc8ae764.bqg731.xyz/api/book?id={book_id}"
    web_url = f"https://d122cc8ae764.bqg731.xyz/#/book/{book_id}/"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    async with semaphore:
        attempt = 0
        max_attempts = 5
        while attempt < max_attempts:
            try:
                # Polite delay
                await asyncio.sleep(0.05)
                
                async with session.get(api_url, headers=headers, timeout=10) as response:
                    if response.status == 429:
                        await asyncio.sleep(3.0)
                        continue
                    if response.status == 403 or response.status == 404:
                        return {
                            "id": book_id, "url": web_url, "title": None, "author": None,
                            "category": None, "status": None, "chapters": 0,
                            "cover": None, "description": None, "crawl_status": str(response.status)
                        }
                    if response.status != 200:
                        attempt += 1
                        await asyncio.sleep(0.5 * attempt)
                        continue
                        
                    data = await response.json(content_type=None)
                    
                    title = data.get("title")
                    author = data.get("author")
                    category = data.get("sortname")
                    status = data.get("full")
                    description = data.get("intro")
                    
                    try:
                        chapters = int(data.get("lastchapterid") or 0)
                    except ValueError:
                        chapters = 0
                        
                    cover = f"https://www.bqg731.xyz/bookimg/{book_id // 1000}/{book_id}.jpg"
                    
                    return {
                        "id": book_id, "url": web_url, "title": title, "author": author,
                        "category": category, "status": status, "chapters": chapters,
                        "cover": cover, "description": description, "crawl_status": "Parsed"
                    }
            except Exception:
                attempt += 1
                await asyncio.sleep(0.5 * attempt)
                
        return {
            "id": book_id, "url": web_url, "title": None, "author": None,
            "category": None, "status": None, "chapters": 0,
            "cover": None, "description": None, "crawl_status": "Failed"
        }

async def run_crawler():
    init_db()
    completed_ids = get_completed_ids()
    print(f"Đã hoàn thành trước đó: {len(completed_ids)} IDs.")
    
    all_ids = set(range(START_ID, END_ID + 1))
    pending_ids = sorted(list(all_ids - completed_ids))
    print(f"Còn lại cần quét: {len(pending_ids)} IDs (từ {START_ID} đến {END_ID}).")
    
    if not pending_ids:
        print("Tất cả IDs đã hoàn thành!")
        auto_export_files()
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
            tasks = [fetch_book(session, book_id, semaphore) for book_id in chunk]
            
            results = await asyncio.gather(*tasks)
            
            for res in results:
                batch.append(res)
                if res['crawl_status'] == "Parsed":
                    parsed_count += 1
                elif res['crawl_status'] in ("403", "404"):
                    not_found_count += 1
                else:
                    error_count += 1
                    
                if len(batch) >= BATCH_SIZE:
                    save_batch(batch)
                    batch = []
                    
            elapsed = time.time() - start_time
            processed = (i + len(chunk))
            speed = processed / elapsed if elapsed > 0 else 0
            remaining_ids = len(pending_ids) - processed
            eta = remaining_ids / speed if speed > 0 else 0
            
            print(f"Tiến độ: {processed}/{len(pending_ids)} ({processed/len(pending_ids)*100:.2f}%) "
                  f"| Thành công: {parsed_count} | Không tồn tại (403/404): {not_found_count} | Lỗi khác: {error_count} "
                  f"| Tốc độ: {speed:.1f} id/s | ETA: {eta/3600:.2f}h")
                  
            if (processed - last_export_count) >= 10000:
                auto_export_files()
                last_export_count = processed
                
            await asyncio.sleep(0.2)
            
        if batch:
            save_batch(batch)
            
        auto_export_files()
        print("\n=== HOÀN THÀNH QUÉT DỮ LIỆU BQG ===")
        print(f"Thành công: {parsed_count} | Không tồn tại: {not_found_count} | Lỗi khác: {error_count}")

if __name__ == "__main__":
    try:
        asyncio.run(run_crawler())
    except KeyboardInterrupt:
        print("\n[ĐÃ DỪNG CRAWLER] Đã lưu tiến trình vào cơ sở dữ liệu.")
