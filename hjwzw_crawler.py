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

DB_PATH = "hjwzw_books.db"
CONCURRENCY = 15  # Good speed since it is only 1504 pages in total
BATCH_SIZE = 100

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS hjwzw_novels (
            id INTEGER PRIMARY KEY,
            url TEXT UNIQUE,
            title TEXT,
            author TEXT,
            status TEXT DEFAULT 'Parsed',
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()

def get_completed_pages():
    # Store page progress in a helper table
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("CREATE TABLE IF NOT EXISTS completed_pages (page INTEGER PRIMARY KEY)")
    cursor.execute("SELECT page FROM completed_pages")
    pages = {row[0] for row in cursor.fetchall()}
    conn.close()
    return pages

def save_page_completed(page):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("INSERT OR IGNORE INTO completed_pages (page) VALUES (?)", (page,))
    conn.commit()
    conn.close()

def save_books_batch(books):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    for b in books:
        url = f"https://tw.hjwzw.com/Book/{b['id']}"
        cursor.execute("""
            INSERT OR REPLACE INTO hjwzw_novels (id, url, title, author, status)
            VALUES (?, ?, ?, ?, 'Parsed')
        """, (b['id'], url, b['title'], b['author']))
    conn.commit()
    conn.close()

def export_all():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT id, url, title, author, status FROM hjwzw_novels")
        rows = cursor.fetchall()
        
        # 1. Export JSON
        books = []
        for r in rows:
            books.append({
                "id": r[0],
                "url": r[1],
                "title": r[2],
                "author": r[3],
                "status": r[4]
            })
        with open("hjwzw_books.json", "w", encoding="utf-8") as f:
            json.dump(books, f, ensure_ascii=False, indent=4)
            
        # 2. Export CSV
        with open("hjwzw_books.csv", "w", encoding="utf-8", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(["ID", "URL", "Title", "Author", "Status"])
            writer.writerows(rows)
        print(f"\n[Đã xuất thành công {len(rows)} truyện ra hjwzw_books.json và hjwzw_books.csv]")
    except Exception as e:
        print(f"\n[Lỗi xuất file]: {e}")
    finally:
        conn.close()

async def fetch_and_parse_page(session, page, semaphore):
    url = f"https://tw.hjwzw.com/List/all__{page}"
    async with semaphore:
        for attempt in range(3):
            try:
                headers = {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                }
                async with session.get(url, headers=headers, timeout=10) as r:
                    if r.status != 200:
                        await asyncio.sleep(0.5 * (attempt + 1))
                        continue
                    
                    html = await r.text(errors='ignore')
                    soup = BeautifulSoup(html, "html.parser")
                    
                    books = []
                    for span in soup.find_all("span", class_="wd10"):
                        title_a = span.find("a")
                        if not title_a:
                            continue
                        href = title_a.get("href")
                        title = title_a.get_text().strip()
                        m = re.search(r'/Book/(\d+)', href)
                        if not m:
                            continue
                        book_id = int(m.group(1))
                        
                        table = span.find_parent("table")
                        author = None
                        if table:
                            author_span = table.find("span", class_="wd7")
                            if author_span:
                                author_a = author_span.find("a")
                                if author_a:
                                    author = author_a.get_text().strip()
                                    
                        books.append({"id": book_id, "title": title, "author": author})
                    
                    return books
            except Exception:
                await asyncio.sleep(0.5 * (attempt + 1))
        return None

async def run_crawler():
    init_db()
    completed_pages = get_completed_pages()
    
    all_pages = set(range(1, 1505))
    pending_pages = sorted(list(all_pages - completed_pages))
    
    print(f"Đã hoàn thành: {len(completed_pages)} trang. Còn lại cần quét: {len(pending_pages)} trang.")
    if not pending_pages:
        print("Tất cả các trang đã được cào hoàn tất!")
        export_all()
        return
        
    semaphore = asyncio.Semaphore(CONCURRENCY)
    connector = aiohttp.TCPConnector(limit=CONCURRENCY)
    
    async with aiohttp.ClientSession(connector=connector) as session:
        start_time = time.time()
        
        chunk_size = 50
        for i in range(0, len(pending_pages), chunk_size):
            chunk = pending_pages[i:i + chunk_size]
            tasks = [fetch_and_parse_page(session, page, semaphore) for page in chunk]
            
            results = await asyncio.gather(*tasks)
            
            page_books = []
            for page, res in zip(chunk, results):
                if res is not None:
                    page_books.extend(res)
                    save_page_completed(page)
                    
            if page_books:
                save_books_batch(page_books)
                
            elapsed = time.time() - start_time
            processed = i + len(chunk)
            speed = processed / elapsed if elapsed > 0 else 0
            remaining = len(pending_pages) - processed
            eta = remaining / speed if speed > 0 else 0
            
            print(f"Tiến độ: {processed}/{len(pending_pages)} trang ({processed/len(pending_pages)*100:.2f}%) "
                  f"| Tốc độ: {speed:.1f} trang/s | ETA: {eta/60:.1f} phút")
                  
            await asyncio.sleep(0.3)
            
        export_all()
        print("\n=== HOÀN THÀNH QUÉT DỮ LIỆU ===")

if __name__ == "__main__":
    try:
        asyncio.run(run_crawler())
    except KeyboardInterrupt:
        print("\n[ĐÃ DỪNG CRAWLER] Tiến trình đã được lưu lại.")
