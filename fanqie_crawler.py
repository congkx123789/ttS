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
import random
from multiprocessing import Process

DB_PATH = "fanqie_books.db"
NUM_PROCESSES = 4              # Number of parallel processes to run
CONCURRENCY_PER_PROCESS = 5    # Async concurrency inside each process
DELAY_BETWEEN_REQUESTS = 0.2    # Polite delay to avoid trigger alerts
CATEGORIES_FILE = "/home/alida/.gemini/antigravity/brain/48dc74e2-79a4-43df-b520-56ae0b30918b/browser/scratchpad_0c563kl0.md"

def load_categories():
    categories = {}
    if os.path.exists(CATEGORIES_FILE):
        with open(CATEGORIES_FILE, "r", encoding="utf-8") as f:
            for line in f:
                match = re.search(r'-\s*\*\*([^*]+)\*\*:\s*`(\d+)`', line)
                if match:
                    name = match.group(1).strip()
                    cat_id = int(match.group(2).strip())
                    categories[name] = cat_id
    if not categories:
        categories = {
            "都市": 1, "现代言情": 3, "校园": 4, "古代言情": 5, "玄幻": 7,
            "科幻末世": 8, "悬疑": 10, "乡村": 11, "历史": 12, "武侠": 16
        }
    return categories

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS fanqie_novels (
            id TEXT PRIMARY KEY,
            url TEXT UNIQUE,
            title TEXT,
            author TEXT,
            category TEXT,
            word_count INTEGER,
            chapters INTEGER,
            creation_status TEXT,
            description TEXT,
            cover TEXT,
            status TEXT DEFAULT 'Pending',
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()

def get_db_conn():
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    conn.execute("PRAGMA journal_mode=WAL")
    return conn

def update_book_details(book):
    # Retry on database locks
    for attempt in range(10):
        try:
            conn = get_db_conn()
            cursor = conn.cursor()
            cursor.execute("""
                INSERT OR REPLACE INTO fanqie_novels 
                (id, url, title, author, category, word_count, chapters, creation_status, description, cover, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Parsed')
            """, (
                book["id"],
                book["url"],
                book["title"],
                book["author"],
                book["category"],
                book["word_count"],
                book["chapters"],
                book["creation_status"],
                book["description"],
                book["cover"],
            ))
            conn.commit()
            conn.close()
            return
        except sqlite3.OperationalError as e:
            if "locked" in str(e).lower():
                time.sleep(random.uniform(0.1, 0.5))
            else:
                raise e

def update_book_status(book_id, status):
    for attempt in range(10):
        try:
            conn = get_db_conn()
            cursor = conn.cursor()
            cursor.execute("UPDATE fanqie_novels SET status = ? WHERE id = ?", (status, book_id))
            conn.commit()
            conn.close()
            return
        except sqlite3.OperationalError as e:
            if "locked" in str(e).lower():
                time.sleep(random.uniform(0.1, 0.5))
            else:
                raise e

def get_pending_books():
    conn = get_db_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT id, url FROM fanqie_novels WHERE status = 'Pending'")
    rows = cursor.fetchall()
    conn.close()
    return [{"id": r[0], "url": r[1]} for r in rows]

def get_db_stats():
    conn = get_db_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM fanqie_novels")
    total = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM fanqie_novels WHERE status = 'Parsed'")
    parsed = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM fanqie_novels WHERE status = 'Pending'")
    pending = cursor.fetchone()[0]
    conn.close()
    return total, parsed, pending

def export_to_files():
    conn = get_db_conn()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT id, url, title, author, category, word_count, chapters, creation_status, description, cover 
            FROM fanqie_novels WHERE status = 'Parsed'
        """)
        rows = cursor.fetchall()
        
        books = []
        for r in rows:
            books.append({
                "id": r[0],
                "url": r[1],
                "title": r[2],
                "author": r[3],
                "category": r[4],
                "word_count": r[5],
                "chapters": r[6],
                "creation_status": r[7],
                "description": r[8],
                "cover": r[9]
            })
            
        with open("fanqie_books.json", "w", encoding="utf-8") as f:
            json.dump(books, f, ensure_ascii=False, indent=4)
            
        with open("fanqie_books.csv", "w", encoding="utf-8", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(["ID", "URL", "Title", "Author", "Category", "Word Count", "Chapters", "Status", "Description", "Cover URL"])
            writer.writerows(rows)
            
        print(f"\n[Xuất File] Đã xuất {len(books)} truyện ra JSON và CSV thành công!")
    except Exception as e:
        print(f"\n[Lỗi tự động xuất file]: {e}")
    finally:
        conn.close()

async def parse_book_detail(session, book, semaphore, worker_id):
    book_id = book["id"]
    url = book["url"]
    
    # Bypass protection using Googlebot user agent
    headers = {
        "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        "Accept-Encoding": "gzip, deflate",
        "Referer": "https://fanqienovel.com/library"
    }
    
    async with semaphore:
        for attempt in range(3):
            try:
                await asyncio.sleep(DELAY_BETWEEN_REQUESTS)
                
                async with session.get(url, headers=headers, timeout=15) as response:
                    if response.status == 404:
                        print(f"[Worker {worker_id}][{book_id}] Không tồn tại (404)")
                        update_book_status(book_id, "404")
                        return
                        
                    if response.status != 200:
                        await asyncio.sleep(2 * (attempt + 1))
                        continue
                        
                    html = await response.text(errors='ignore')
                    
                    idx = html.find("window.__INITIAL_STATE__")
                    if idx == -1:
                        update_book_status(book_id, "Invalid")
                        return
                    
                    start = html.find("{", idx)
                    if start == -1:
                        update_book_status(book_id, "Invalid")
                        return
                        
                    brace_count = 0
                    end = start
                    for i in range(start, len(html)):
                        if html[i] == "{":
                            brace_count += 1
                        elif html[i] == "}":
                            brace_count -= 1
                            if brace_count == 0:
                                end = i + 1
                                break
                                
                    json_str = html[start:end]
                    json_str = json_str.replace("undefined", "null")
                    state = json.loads(json_str)
                    
                    page_data = state.get("page", {})
                    if not page_data or not page_data.get("bookName"):
                        update_book_status(book_id, "Invalid")
                        return
                        
                    title = page_data.get("bookName") or ""
                    author = page_data.get("author") or ""
                    
                    categories_list = page_data.get("categoryV2", [])
                    if isinstance(categories_list, list):
                        categories = [c.get("Name") for c in categories_list if c.get("Name")]
                        category = ", ".join(categories)
                    else:
                        category = page_data.get("category") or ""
                        
                    word_count = page_data.get("wordNumber") or 0
                    chapters = page_data.get("chapterTotal") or 0
                    
                    status_val = page_data.get("status")
                    creation_status = "连载"
                    if status_val == 1:
                        creation_status = "已完结"
                        
                    description = page_data.get("abstract") or ""
                    cover = page_data.get("thumbUrl") or page_data.get("thumbUri") or ""
                    
                    book_info = {
                        "id": book_id,
                        "url": url,
                        "title": title,
                        "author": author,
                        "category": category,
                        "word_count": int(word_count),
                        "chapters": int(chapters),
                        "creation_status": creation_status,
                        "description": description,
                        "cover": cover
                    }
                    
                    update_book_details(book_info)
                    print(f"[Worker {worker_id}] -> Đã cào: {title} | Tác giả: {author} | {chapters} chương")
                    return
                    
            except Exception as e:
                await asyncio.sleep(2)
                
        print(f"[Worker {worker_id}][{book_id}] Thất bại hoàn toàn sau 3 lần thử.")
        update_book_status(book_id, "Failed")

async def worker_async_loop(chunk, worker_id):
    semaphore = asyncio.Semaphore(CONCURRENCY_PER_PROCESS)
    async with aiohttp.ClientSession() as session:
        tasks = []
        for book in chunk:
            tasks.append(parse_book_detail(session, book, semaphore, worker_id))
        await asyncio.gather(*tasks)

def worker_process_main(chunk, worker_id):
    # Each process has its own event loop
    asyncio.run(worker_async_loop(chunk, worker_id))

def main():
    init_db()
    
    print("="*60)
    print("KHỞI CHẠY BỘ CÀO ĐA TIẾN TRÌNH FANQIE NOVEL (MULTIPROCESSING CRAWLER)")
    print("="*60)
    print("Bỏ qua Phase 1 (Tìm ID) do API bị chặn. Sử dụng ID sẵn có trong DB.")
    
    pending_books = get_pending_books()
    if not pending_books:
        print("Không có truyện nào ở trạng thái 'Pending'. Quá trình hoàn tất!")
        return
        
    print(f"Tổng số truyện cần cào: {len(pending_books)}")
    print(f"Chạy đa tiến trình: {NUM_PROCESSES} Processes, mỗi Process {CONCURRENCY_PER_PROCESS} Concurrent tasks.")
    
    # Partition the pending list
    chunks = [[] for _ in range(NUM_PROCESSES)]
    for idx, book in enumerate(pending_books):
        chunks[idx % NUM_PROCESSES].append(book)
        
    # Start processes
    processes = []
    for i in range(NUM_PROCESSES):
        p = Process(target=worker_process_main, args=(chunks[i], i+1))
        processes.append(p)
        p.start()
        print(f"Đã khởi động Worker Process #{i+1} với {len(chunks[i])} truyện.")
        
    # Monitor and wait for completion
    try:
        while any(p.is_alive() for p in processes):
            time.sleep(5)
            total, parsed, pending = get_db_stats()
            print(f"\n[TIẾN ĐỘ] Đã cào: {parsed}/{total} | Còn lại: {pending}")
            export_to_files()
    except KeyboardInterrupt:
        print("\nNhận tín hiệu dừng từ người dùng. Đang tắt các tiến trình con...")
        for p in processes:
            p.terminate()
            p.join()
        sys.exit(0)
        
    # Wait for all processes to exit
    for p in processes:
        p.join()
        
    print("\n" + "="*60)
    print("HỆ THỐNG ĐÃ HOÀN TẤT QUÁ TRÌNH CÀO TRUYỆN FANQIE NOVEL!")
    total, parsed, pending = get_db_stats()
    print(f"Thống kê cuối cùng: Tổng={total}, Đã cào={parsed}, Lỗi/Còn lại={pending}")
    print("="*60)
    export_to_files()

if __name__ == "__main__":
    main()
