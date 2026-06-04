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
CONCURRENCY = 15  # Limit concurrent connections
BATCH_SIZE = 100

def get_db_conn():
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    conn.execute("PRAGMA journal_mode=WAL")
    return conn

def get_target_books():
    conn = get_db_conn()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, url 
        FROM ixdzs_novels 
        WHERE (chapters IS NULL OR chapters = 0 OR chapters = '') 
          AND status = 'Parsed'
    """)
    books = cursor.fetchall()
    conn.close()
    return books

def update_batch(batch):
    conn = get_db_conn()
    cursor = conn.cursor()
    for book_id, chapters in batch:
        cursor.execute("UPDATE ixdzs_novels SET chapters = ? WHERE id = ?", (chapters, book_id))
    conn.commit()
    conn.close()

def auto_export_files():
    conn = get_db_conn()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT id, url, title, author, category, chapters, status FROM ixdzs_novels")
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
                "chapters": r[5],
                "status": r[6]
            })
        with open("ixdzs_books.json", "w", encoding="utf-8") as f:
            json.dump(books, f, ensure_ascii=False, indent=4)
            
        # 2. Export CSV
        with open("ixdzs_books.csv", "w", encoding="utf-8", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(["ID", "URL", "Title", "Author", "Category", "Chapters", "Status"])
            writer.writerows(rows)
        print("[Xuất File] Đã cập nhật ixdzs_books.json và ixdzs_books.csv thành công!")
    except Exception as e:
        print(f"\n[Lỗi tự động xuất file]: {e}")
    finally:
        conn.close()

async def fetch_chapters(session, book_id, url, semaphore):
    async with semaphore:
        for attempt in range(3):
            try:
                headers = {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8"
                }
                async with session.get(url, headers=headers, timeout=10, allow_redirects=True) as response:
                    if response.status == 404:
                        return book_id, 0
                    
                    if response.status != 200:
                        await asyncio.sleep(0.5 * (attempt + 1))
                        continue
                        
                    html = await response.text(errors='ignore')
                    soup = BeautifulSoup(html, "html.parser")
                    
                    chapters = None
                    chapters_span = soup.find("span", class_="sub-text-r")
                    if chapters_span:
                        span_text = chapters_span.get_text().strip()
                        digits = re.findall(r'\d+', span_text)
                        if digits:
                            chapters = int(digits[0])
                    
                    if chapters is not None:
                        return book_id, chapters
                    else:
                        # Try to count chapter links as fallback
                        ul_chapter = soup.find("ul", class_="u-chapter")
                        if ul_chapter:
                            li_tags = ul_chapter.find_all("li")
                            chapter_count = sum(1 for li in li_tags if li.find("a"))
                            return book_id, chapter_count
                        return book_id, 0
            except Exception:
                await asyncio.sleep(0.5 * (attempt + 1))
        return book_id, None

async def main():
    target_books = get_target_books()
    print("==================================================")
    print("      IXDZS CHAPTER PATCHER KHỞI ĐỘNG             ")
    print("==================================================")
    print(f"Tổng số sách cần cập nhật số chương: {len(target_books)}")
    
    if not target_books:
        print("Không tìm thấy sách nào thiếu số chương!")
        return
        
    semaphore = asyncio.Semaphore(CONCURRENCY)
    connector = aiohttp.TCPConnector(limit=CONCURRENCY, ttl_dns_cache=300)
    
    success_count = 0
    batch = []
    start_time = time.time()
    last_export_time = time.time()
    
    chunk_size = 100
    
    async with aiohttp.ClientSession(connector=connector) as session:
        for i in range(0, len(target_books), chunk_size):
            chunk = target_books[i:i + chunk_size]
            tasks = [fetch_chapters(session, bid, url, semaphore) for bid, url in chunk]
            results = await asyncio.gather(*tasks)
            
            for bid, ch in results:
                if ch is not None:
                    batch.append((bid, ch))
                    success_count += 1
                    
                if len(batch) >= BATCH_SIZE:
                    update_batch(batch)
                    batch = []
            
            elapsed = time.time() - start_time
            processed = i + len(chunk)
            speed = processed / elapsed if elapsed > 0 else 0
            remaining = len(target_books) - processed
            eta = remaining / speed if speed > 0 else 0
            
            print(f"Tiến độ: {processed}/{len(target_books)} ({processed/len(target_books)*100:.2f}%) "
                  f"| Đã cập nhật thành công: {success_count} | Tốc độ: {speed:.1f} truyện/s | ETA: {eta/60:.1f} phút", flush=True)
                  
            if time.time() - last_export_time > 120 or processed % 2000 == 0:
                if batch:
                    update_batch(batch)
                    batch = []
                auto_export_files()
                last_export_time = time.time()
                
            await asyncio.sleep(0.1)
            
        if batch:
            update_batch(batch)
        auto_export_files()
        print("\n=== HOÀN THÀNH CẬP NHẬT SỐ CHƯƠNG IXDZS ===")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n[ĐÃ DỪNG] Đã lưu các thay đổi hiện tại.")
