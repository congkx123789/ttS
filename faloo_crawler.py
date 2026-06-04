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

DB_PATH = "faloo_books.db"
BASE_URL = "https://b.faloo.com/{}.html"
CONCURRENCY = 10  # Moderate concurrency to prevent blocking
BATCH_SIZE = 100  # Save to DB every 100 items
START_ID = 1400000
END_ID = 1500000

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS faloo_novels (
            id INTEGER PRIMARY KEY,
            url TEXT UNIQUE,
            title TEXT,
            author TEXT,
            category TEXT,
            subcategory TEXT,
            word_count INTEGER,
            chapters INTEGER,
            status TEXT,
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
    cursor.execute("SELECT id FROM faloo_novels")
    ids = {row[0] for row in cursor.fetchall()}
    conn.close()
    return ids

def save_batch(batch):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    for item in batch:
        cursor.execute("""
            INSERT OR REPLACE INTO faloo_novels (id, url, title, author, category, subcategory, word_count, chapters, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (item['id'], item['url'], item['title'], item['author'], item['category'], item['subcategory'], item['word_count'], item['chapters'], item['status']))
    conn.commit()
    conn.close()

def auto_export_files():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT id, url, title, author, category, subcategory, word_count, chapters, status FROM faloo_novels")
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
                "subcategory": r[5],
                "word_count": r[6],
                "chapters": r[7],
                "status": r[8]
            })
        with open("faloo_books.json", "w", encoding="utf-8") as f:
            json.dump(books, f, ensure_ascii=False, indent=4)
            
        # 2. Export CSV
        with open("faloo_books.csv", "w", encoding="utf-8", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(["ID", "URL", "Title", "Author", "Category", "Subcategory", "Word Count", "Chapters", "Status"])
            writer.writerows(rows)
    except Exception as e:
        print(f"\n[Lỗi tự động xuất file]: {e}")
    finally:
        conn.close()

async def fetch_page(session, book_id, semaphore):
    url = BASE_URL.format(book_id)
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://b.faloo.com/"
    }
    
    async with semaphore:
        for attempt in range(3):
            try:
                async with session.get(url, headers=headers, timeout=12) as response:
                    if response.status == 404:
                        return {
                            "id": book_id, "url": url, "title": None,
                            "author": None, "category": None, "subcategory": None,
                            "word_count": None, "chapters": None, "status": "404"
                        }
                    
                    if response.status != 200:
                        await asyncio.sleep(1 * (attempt + 1))
                        continue
                        
                    # Decode as GB18030 / GB2312
                    html = await response.text(encoding='gb18030', errors='ignore')
                    soup = BeautifulSoup(html, "html.parser")
                    
                    title_tag = soup.select_one("h1#novelName")
                    if not title_tag:
                        # Page exists but not a book page (e.g. error message)
                        return {
                            "id": book_id, "url": url, "title": None,
                            "author": None, "category": None, "subcategory": None,
                            "word_count": None, "chapters": None, "status": "Invalid"
                        }
                        
                    title = title_tag.get_text(strip=True)
                    
                    # Author
                    author = None
                    author_tag = soup.select_one(".T-L-O-Z-Box1 a.colorQianHui")
                    if author_tag:
                        author = author_tag.get_text(strip=True)
                    if not author:
                        author_tag = soup.select_one(".authorInfo .box1 a")
                        if author_tag:
                            author = author_tag.get_text(strip=True)
                            
                    # Category & Subcategory
                    category = None
                    subcategory = None
                    for box in soup.select(".T-R-T-B2-Box1"):
                        text = box.get_text()
                        if "小说分类：" in text:
                            a_tag = box.select_one("a")
                            if a_tag:
                                category = a_tag.get_text(strip=True)
                        elif "小说子类：" in text:
                            a_tag = box.select_one("a")
                            if a_tag:
                                subcategory = a_tag.get_text(strip=True)
                                
                    # Fallback Category/Subcategory from Breadcrumbs
                    if not category or not subcategory:
                        breadcrumbs = soup.select(".C-One a")
                        if len(breadcrumbs) >= 4:
                            if not category:
                                category = breadcrumbs[2].get_text(strip=True)
                            if not subcategory:
                                subcategory = breadcrumbs[3].get_text(strip=True)
                                
                    # Word Count
                    word_count = None
                    for box in soup.select(".T-R-Md-Bobx1"):
                        text = box.get_text()
                        if "已写" in text:
                            spans = box.select("span.SZspan")
                            if spans:
                                try:
                                    word_count = int("".join([span.get_text(strip=True) for span in spans]))
                                except ValueError:
                                    pass
                                    
                    # Max Chapters
                    max_chapter = 0
                    for a_tag in soup.find_all("a", href=True):
                        href = a_tag["href"]
                        ch_match = re.search(rf'{book_id}_(\d+)\.html', href)
                        if ch_match:
                            try:
                                ch_num = int(ch_match.group(1))
                                if ch_num > max_chapter:
                                    max_chapter = ch_num
                            except ValueError:
                                pass
                                
                    # If max_chapter is 0, let's look for latest chapter box
                    if max_chapter == 0:
                        latest_ch_box = soup.select_one(".T-L-Three a")
                        if latest_ch_box and latest_ch_box.get("href"):
                            ch_match = re.search(rf'{book_id}_(\d+)\.html', latest_ch_box.get("href"))
                            if ch_match:
                                max_chapter = int(ch_match.group(1))
                                
                    return {
                        "id": book_id,
                        "url": url,
                        "title": title,
                        "author": author,
                        "category": category,
                        "subcategory": subcategory,
                        "word_count": word_count,
                        "chapters": max_chapter,
                        "status": "Parsed"
                    }
            except Exception as e:
                await asyncio.sleep(0.5 * (attempt + 1))
                
        # If all attempts fail
        return {
            "id": book_id, "url": url, "title": None,
            "author": None, "category": None, "subcategory": None,
            "word_count": None, "chapters": None, "status": "Failed"
        }

async def main():
    init_db()
    completed_ids = get_completed_ids()
    
    # Calculate target IDs to scan
    all_target_ids = list(range(START_ID, END_ID + 1))
    pending_ids = [bid for bid in all_target_ids if bid not in completed_ids]
    
    print("==================================================")
    print("      CRAWLER FALOO.COM CHẠY NGẦM KHỞI ĐỘNG       ")
    print("==================================================")
    print(f"Tổng số ID mục tiêu: {len(all_target_ids)}")
    print(f"Đã hoàn thành trước đó: {len(completed_ids)}")
    print(f"Còn lại cần quét: {len(pending_ids)}")
    
    if not pending_ids:
        print("Không có ID nào cần cào!")
        auto_export_files()
        return
        
    semaphore = asyncio.Semaphore(CONCURRENCY)
    connector = aiohttp.TCPConnector(limit=CONCURRENCY, ttl_dns_cache=300)
    
    parsed_count = 0
    not_found_count = 0
    invalid_count = 0
    error_count = 0
    
    batch = []
    start_time = time.time()
    last_export_time = time.time()
    
    chunk_size = 100
    
    async with aiohttp.ClientSession(connector=connector) as session:
        for i in range(0, len(pending_ids), chunk_size):
            chunk = pending_ids[i:i + chunk_size]
            tasks = [fetch_page(session, bid, semaphore) for bid in chunk]
            results = await asyncio.gather(*tasks)
            
            for res in results:
                batch.append(res)
                if res['status'] == "Parsed":
                    parsed_count += 1
                elif res['status'] == "404":
                    not_found_count += 1
                elif res['status'] == "Invalid":
                    invalid_count += 1
                else:
                    error_count += 1
                    
                if len(batch) >= BATCH_SIZE:
                    save_batch(batch)
                    batch = []
                    
            elapsed = time.time() - start_time
            processed = i + len(chunk)
            speed = processed / elapsed if elapsed > 0 else 0
            remaining = len(pending_ids) - processed
            eta = remaining / speed if speed > 0 else 0
            
            print(f"Tiến độ: {processed}/{len(pending_ids)} ({processed/len(pending_ids)*100:.2f}%) "
                  f"| Thành công: {parsed_count} | 404: {not_found_count} | Lỗi khác: {error_count} "
                  f"| Tốc độ: {speed:.1f} truyện/s | ETA: {eta/3600:.2f}h", flush=True)
                  
            # Auto export to JSON & CSV every 3 minutes or 2000 books
            if time.time() - last_export_time > 180 or processed % 2000 == 0:
                auto_export_files()
                last_export_time = time.time()
                
            await asyncio.sleep(0.3)
            
        if batch:
            save_batch(batch)
            
        auto_export_files()
        print("\n=== HOÀN THÀNH CÀO FALOO.COM ===")
        print(f"Thành công: {parsed_count} | 404: {not_found_count} | Lỗi khác: {error_count}")

if __name__ == "__main__":
    # Allow range customization from CLI: python faloo_crawler.py [start_id] [end_id]
    if len(sys.argv) >= 3:
        try:
            START_ID = int(sys.argv[1])
            END_ID = int(sys.argv[2])
        except ValueError:
            pass
            
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n[ĐÃ DỪNG CRAWLER] Đã lưu tiến trình vào cơ sở dữ liệu.")
