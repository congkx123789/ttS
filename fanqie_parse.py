import asyncio
import aiohttp
import sqlite3
import re
import json
import csv
import time
import os

DB_PATH = "fanqie_books.db"
CONCURRENCY = 5       # Safe concurrency
DELAY_BETWEEN_REQUESTS = 0.3 # Safe delay in seconds

def get_db_conn():
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    conn.execute("PRAGMA journal_mode=WAL")
    return conn

def get_pending_books():
    conn = get_db_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT id, url FROM fanqie_novels WHERE status = 'Pending'")
    rows = cursor.fetchall()
    conn.close()
    return [{"id": r[0], "url": r[1]} for r in rows]

def update_book_details(book):
    conn = get_db_conn()
    cursor = conn.cursor()
    try:
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
    except Exception as e:
        print(f"Lỗi cập nhật DB: {e}")
    conn.commit()
    conn.close()

def update_book_status(book_id, status):
    conn = get_db_conn()
    cursor = conn.cursor()
    try:
        cursor.execute("UPDATE fanqie_novels SET status = ? WHERE id = ?", (status, book_id))
    except Exception as e:
        pass
    conn.commit()
    conn.close()

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
    try:
        conn = get_db_conn()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, url, title, author, category, word_count, chapters, creation_status, description, cover 
            FROM fanqie_novels WHERE status = 'Parsed'
        """)
        rows = cursor.fetchall()
        conn.close()
        
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
        print(f"\n[Lỗi xuất file]: {e}")

async def parse_book_detail(session, book, semaphore):
    book_id = book["id"]
    url = book["url"]
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Encoding": "gzip, deflate",
        "Referer": "https://fanqienovel.com/library"
    }
    
    async with semaphore:
        for attempt in range(5):
            try:
                # Add delay to stay safe
                await asyncio.sleep(DELAY_BETWEEN_REQUESTS)
                
                async with session.get(url, headers=headers, timeout=15) as response:
                    if response.status == 404:
                        print(f"[{book_id}] 404 - Không tồn tại.")
                        update_book_status(book_id, "404")
                        return
                        
                    if response.status == 444:
                        # Edge block, back off longer
                        print(f"[{book_id}] Bị chặn 444 (Access Denied). Đang chờ giải tỏa chặn...")
                        await asyncio.sleep(30 * (attempt + 1))
                        continue
                        
                    if response.status != 200:
                        await asyncio.sleep(3 * (attempt + 1))
                        continue
                        
                    html = await response.text(errors='ignore')
                    
                    if "TencentCaptcha" in html or "TCaptcha.js" in html:
                        print(f"[{book_id}] Bị chặn Captcha! Chờ 15s...")
                        await asyncio.sleep(15)
                        continue
                        
                    match = re.search(r'window\.__INITIAL_STATE__\s*=\s*(\{.*?\});', html)
                    if not match:
                        update_book_status(book_id, "Invalid")
                        return
                        
                    state = json.loads(match.group(1))
                    page_data = state.get("page", {})
                    
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
                    print(f" -> Đã cào: {title} | Tác giả: {author} | {chapters} chương | {creation_status}")
                    return
                    
            except Exception as e:
                await asyncio.sleep(2)
        
        print(f"[{book_id}] Thất bại hoàn toàn sau nhiều lần thử.")

async def main():
    print("="*60)
    print("KHỞI CHẠY BỘ CÀO AN TOÀN (SAFE PARSER MODE)")
    print("="*60)
    
    semaphore = asyncio.Semaphore(CONCURRENCY)
    
    while True:
        pending_books = get_pending_books()
        if not pending_books:
            print("Không còn truyện ở trạng thái 'Pending'. Đang chờ...")
            await asyncio.sleep(10)
            continue
            
        print(f"\nPhát hiện {len(pending_books)} truyện cần cào chi tiết. Tiến hành...")
        
        async with aiohttp.ClientSession() as session:
            tasks = []
            for book in pending_books:
                tasks.append(parse_book_detail(session, book, semaphore))
                
                if len(tasks) >= 50:
                    await asyncio.gather(*tasks)
                    tasks = []
                    
                    total, parsed, pending = get_db_stats()
                    print(f"\n--- TIẾN ĐỘ TỔNG: Đã cào {parsed}/{total} truyện. Còn lại {pending} ---")
                    export_to_files()
                    await asyncio.sleep(2)
                    
            if tasks:
                await asyncio.gather(*tasks)
                total, parsed, pending = get_db_stats()
                print(f"\n--- TIẾN ĐỘ TỔNG: Đã cào {parsed}/{total} truyện. Còn lại {pending} ---")
                export_to_files()
                
        await asyncio.sleep(5)

if __name__ == "__main__":
    asyncio.run(main())
