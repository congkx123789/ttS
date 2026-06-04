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

DB_PATH = "nr41_books.db"
CONCURRENCY = 4  # Polite concurrency to prevent Cloudflare rate-limiting
BATCH_SIZE = 20
START_ID = 1
END_ID = 100000

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS nr41_novels (
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
    cursor.execute("SELECT id FROM nr41_novels")
    ids = {row[0] for row in cursor.fetchall()}
    conn.close()
    return ids

def save_batch(batch):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    for item in batch:
        cursor.execute("""
            INSERT OR REPLACE INTO nr41_novels (id, url, title, author, category, status, chapters, cover, description, crawl_status)
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
            FROM nr41_novels 
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
        with open("nr41_books.json", "w", encoding="utf-8") as f:
            json.dump(books, f, ensure_ascii=False, indent=4)
            
        # 2. Export CSV
        with open("nr41_books.csv", "w", encoding="utf-8", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(["ID", "URL", "Title", "Author", "Category", "Status", "Chapters", "Cover", "Description", "CrawlStatus"])
            writer.writerows(rows)
    except Exception as e:
        print(f"\n[Lỗi tự động xuất file]: {e}")
    finally:
        conn.close()

async def fetch_page(session, book_id, semaphore):
    url = f"https://m.41nr.com/txt/{book_id}.html"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    async with semaphore:
        attempt = 0
        max_attempts = 5
        while attempt < max_attempts:
            try:
                # Polite sleep before request
                await asyncio.sleep(0.3)
                
                async with session.get(url, headers=headers, timeout=10) as response:
                    if response.status == 429:
                        # 429: Too Many Requests -> Sleep 4s and retry without incrementing attempt
                        await asyncio.sleep(4.0)
                        continue
                        
                    if response.status == 404:
                        return {
                            "id": book_id, "url": url, "title": None, "author": None,
                            "category": None, "status": None, "chapters": 0,
                            "cover": None, "description": None, "crawl_status": "404"
                        }
                    if response.status != 200:
                        attempt += 1
                        await asyncio.sleep(1.0 * attempt)
                        continue
                        
                    html = await response.text(errors='ignore')
                    soup = BeautifulSoup(html, "html.parser")
                    
                    block = soup.find("div", class_="block_txt2")
                    if not block:
                        return {
                            "id": book_id, "url": url, "title": None, "author": None,
                            "category": None, "status": None, "chapters": 0,
                            "cover": None, "description": None, "crawl_status": "Empty"
                        }
                        
                    title = block.find("h2").get_text().strip() if block.find("h2") else None
                    
                    author = None
                    category = None
                    status = None
                    chapters = 0
                    
                    for p in block.find_all("p"):
                        text = p.get_text()
                        if "作者" in text:
                            a = p.find("a")
                            if a: author = a.get_text().strip()
                        elif "分类" in text:
                            a = p.find("a")
                            if a: category = a.get_text().strip()
                        elif "状态" in text:
                            span = p.find("span")
                            if span: status = span.get_text().strip()
                        elif "最新" in text:
                            a = p.find("a")
                            if a:
                                href = a.get("href")
                                m = re.search(r"/chapter/\d+/(\d+)\.html", href)
                                if m: chapters = int(m.group(1))
                                
                    # cover
                    img_div = soup.find("div", class_="block_img2")
                    cover = img_div.find("img").get("src") if img_div and img_div.find("img") else None
                    
                    # description
                    intro_div = soup.find("div", class_="intro_info")
                    description = intro_div.get_text().strip() if intro_div else None
                    
                    if title or author:
                        return {
                            "id": book_id, "url": url, "title": title, "author": author,
                            "category": category, "status": status, "chapters": chapters,
                            "cover": cover, "description": description, "crawl_status": "Parsed"
                        }
                    else:
                        return {
                            "id": book_id, "url": url, "title": None, "author": None,
                            "category": None, "status": None, "chapters": 0,
                            "cover": None, "description": None, "crawl_status": "Failed"
                        }
            except Exception:
                attempt += 1
                await asyncio.sleep(1.0 * attempt)
                
        return {
            "id": book_id, "url": url, "title": None, "author": None,
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
        
        chunk_size = 50
        for i in range(0, len(pending_ids), chunk_size):
            chunk = pending_ids[i:i + chunk_size]
            tasks = [fetch_page(session, book_id, semaphore) for book_id in chunk]
            
            results = await asyncio.gather(*tasks)
            
            for res in results:
                batch.append(res)
                if res['crawl_status'] == "Parsed":
                    parsed_count += 1
                elif res['crawl_status'] == "404":
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
                  f"| Thành công: {parsed_count} | 404: {not_found_count} | Lỗi khác: {error_count} "
                  f"| Tốc độ: {speed:.1f} id/s | ETA: {eta/3600:.2f}h")
                  
            if (processed - last_export_count) >= 5000:
                auto_export_files()
                last_export_count = processed
                
            await asyncio.sleep(0.3)
            
        if batch:
            save_batch(batch)
            
        auto_export_files()
        print("\n=== HOÀN THÀNH QUÉT DỮ LIỆU ===")
        print(f"Thành công: {parsed_count} | 404: {not_found_count} | Lỗi khác: {error_count}")

if __name__ == "__main__":
    try:
        asyncio.run(run_crawler())
    except KeyboardInterrupt:
        print("\n[ĐÃ DỪNG CRAWLER] Đã lưu tiến trình vào cơ sở dữ liệu.")
