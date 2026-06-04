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
from playwright.async_api import async_playwright

DB_PATH = "qidian_books.db"
BASE_URL = "https://www.qidian.com/book/{}/"
CONCURRENCY = 8  # Concurrency limit for HTTP requests
BATCH_SIZE = 100

# Global variables for cookie state
session_cookies = {}
cookie_lock = asyncio.Lock()

def get_db_conn():
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    conn.execute("PRAGMA journal_mode=WAL")
    return conn

def init_db():
    conn = get_db_conn()
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS books (
            id TEXT PRIMARY KEY,
            title TEXT,
            author TEXT,
            category TEXT,
            url TEXT,
            cover TEXT,
            description TEXT
        )
    """)
    conn.commit()
    
    # Check and add new columns if they do not exist
    new_cols = [
        ("subcategory", "TEXT"),
        ("word_count", "TEXT"),
        ("chapters", "INTEGER"),
        ("status", "TEXT")
    ]
    for col_name, col_type in new_cols:
        try:
            cursor.execute(f"ALTER TABLE books ADD COLUMN {col_name} {col_type}")
            conn.commit()
        except sqlite3.OperationalError:
            pass
    conn.close()

def get_completed_ids():
    if not os.path.exists(DB_PATH):
        return set()
    conn = get_db_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM books")
    ids = {row[0] for row in cursor.fetchall()}
    conn.close()
    return ids

def save_batch(batch):
    conn = get_db_conn()
    cursor = conn.cursor()
    for item in batch:
        cursor.execute("""
            INSERT OR REPLACE INTO books (id, title, author, category, subcategory, word_count, chapters, url, cover, description, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            item['id'], item['title'], item['author'], item['category'], 
            item['subcategory'], item['word_count'], item['chapters'], 
            item['url'], item['cover'], item['description'], item['status']
        ))
    conn.commit()
    conn.close()

def auto_export_files():
    conn = get_db_conn()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT id, url, title, author, category, subcategory, word_count, chapters, cover, description, status FROM books WHERE status = 'Parsed'")
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
                "cover": r[8],
                "description": r[9],
                "status": r[10]
            })
        with open("qidian_books.json", "w", encoding="utf-8") as f:
            json.dump(books, f, ensure_ascii=False, indent=4)
            
        # 2. Export CSV
        with open("qidian_books.csv", "w", encoding="utf-8", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(["ID", "URL", "Title", "Author", "Category", "Subcategory", "Word Count", "Chapters", "Cover", "Description", "Status"])
            writer.writerows(rows)
    except Exception as e:
        print(f"\n[Lỗi tự động xuất file]: {e}")
    finally:
        conn.close()

async def get_cookies_via_playwright():
    print("[Playwright] Khởi động trình duyệt để vượt WAF Qidian và lấy Cookies...")
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
                args=[
                    "--disable-blink-features=AutomationControlled",
                    "--no-sandbox",
                    "--disable-dev-shm-usage"
                ]
            )
            context = await browser.new_context(
                user_agent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                viewport={"width": 1280, "height": 720}
            )
            page = await context.new_page()
            await page.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
            
            # Nav to main page first to establish session
            print("[Playwright] Đang tải trang chủ Qidian...")
            await page.goto("https://www.qidian.com/", wait_until="domcontentloaded", timeout=30000)
            await asyncio.sleep(3)
            
            # Nav to a valid book detail to trigger WAF solve
            url = "https://www.qidian.com/book/1048823652/"
            print("[Playwright] Đang tải chi tiết sách để lấy cookie bypass...")
            await page.goto(url, wait_until="domcontentloaded", timeout=30000)
            await asyncio.sleep(6) # Wait for challenge scripts to execute and cookies to set
            
            cookies = await context.cookies()
            await browser.close()
            
            cookie_dict = {c['name']: c['value'] for c in cookies}
            print(f"[Playwright] Lấy thành công {len(cookie_dict)} cookies.")
            return cookie_dict
    except Exception as e:
        print(f"[Playwright LỖI]: Không thể lấy cookies: {e}")
        return {}

last_cookie_refresh_time = 0

async def refresh_cookies_async():
    global session_cookies, last_cookie_refresh_time
    async with cookie_lock:
        if time.time() - last_cookie_refresh_time < 30:
            return
        new_cookies = await get_cookies_via_playwright()
        if new_cookies:
            session_cookies = new_cookies
            last_cookie_refresh_time = time.time()
            print("[Cookies] Đã làm mới session cookies.")
        else:
            print("[Cookies LỖI] Làm mới cookies thất bại, tiếp tục với cookies cũ.")

async def fetch_book(session, book_id, semaphore):
    global session_cookies
    url = BASE_URL.format(book_id)
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://www.qidian.com/"
    }
    
    async with semaphore:
        for attempt in range(4):
            try:
                # Update cookies in session jar
                session.cookie_jar.update_cookies(session_cookies)
                
                async with session.get(url, headers=headers, timeout=12, allow_redirects=True) as response:
                    # 1. Check if WAF Challenge screen or block is shown (usually 202 or 403 status)
                    if response.status in (202, 403):
                        print(f" -> ID {book_id}: Phát hiện WAF/Block {response.status}. Đang chờ và làm mới cookies...")
                        await refresh_cookies_async()
                        await asyncio.sleep(5)
                        continue
                        
                    # 2. Check 404 (Non-existent book)
                    if response.status == 404:
                        return {
                            "id": str(book_id), "title": None, "author": None, "category": None,
                            "subcategory": None, "word_count": None, "chapters": None,
                            "url": url, "cover": None, "description": None, "status": "404"
                        }
                        
                    if response.status != 200:
                        print(f" -> ID {book_id}: HTTP {response.status}. Thử lại sau 5s...")
                        await asyncio.sleep(5)
                        continue
                        
                    html = await response.text(errors='ignore')
                    
                    # Check if Captcha is triggered
                    if "TencentCaptcha" in html or "TCaptcha.js" in html:
                        print(f" -> ID {book_id}: Phát hiện Tencent Captcha trong HTML. Đang làm mới cookies...")
                        await refresh_cookies_async()
                        await asyncio.sleep(5)
                        continue
                    
                    # 3. Check redirect/error pages inside HTML content
                    if "error--起点中文网" in html or "找不到了" in html or "该书暂未上线" in html or "该书已下架" in html:
                        return {
                            "id": str(book_id), "title": None, "author": None, "category": None,
                            "subcategory": None, "word_count": None, "chapters": None,
                            "url": url, "cover": None, "description": None, "status": "Invalid"
                        }
                        
                    soup = BeautifulSoup(html, "html.parser")
                    
                    title_tag = soup.select_one("h1#bookName")
                    if not title_tag:
                        # Page loaded, but not a valid book page structure
                        return {
                            "id": str(book_id), "title": None, "author": None, "category": None,
                            "subcategory": None, "word_count": None, "chapters": None,
                            "url": url, "cover": None, "description": None, "status": "Invalid"
                        }
                        
                    title = title_tag.get_text(strip=True)
                    
                    # Author
                    author = None
                    author_tag = soup.select_one("a.writer-name")
                    if author_tag:
                        author = author_tag.get_text(strip=True)
                    if not author:
                        author_meta = soup.find("meta", property="og:novel:author")
                        if author_meta:
                            author = author_meta.get("content", "").strip()
                            
                    # Description
                    description = None
                    desc_meta = soup.find("meta", property="og:description")
                    if desc_meta:
                        description = desc_meta.get("content", "").strip()
                    if not description:
                        desc_p = soup.select_one("p.intro")
                        if desc_p:
                            description = desc_p.get_text(strip=True)
                            
                    # Cover
                    cover = None
                    cover_meta = soup.find("meta", property="og:image")
                    if cover_meta:
                        cover = cover_meta.get("content", "").strip()
                        if cover.startswith("//"):
                            cover = "https:" + cover
                            
                    # Category & Subcategory
                    category = None
                    subcategory = None
                    cat_meta = soup.find("meta", property="og:novel:category")
                    if cat_meta:
                        category = cat_meta.get("content", "").strip()
                        
                    crumbs = [a.get_text(strip=True) for a in soup.select(".crumbs-nav-new span a")]
                    if len(crumbs) >= 3:
                        if not category:
                            category = crumbs[1].replace("频道", "")
                        subcategory = crumbs[2]
                        
                    # Fallback for category
                    if not category:
                        cat_tag = soup.select_one(".book-attribute a[data-eid='qd_G10']")
                        if cat_tag:
                            category = cat_tag.get_text(strip=True)
                    if not subcategory:
                        subcat_tag = soup.select_one(".book-attribute a[data-eid='qd_G11']")
                        if subcat_tag:
                            subcategory = subcat_tag.get_text(strip=True)
                            
                    # Word Count
                    word_count = None
                    count_em = soup.select(".book-info-top p.count em")
                    if count_em:
                        word_count = count_em[0].get_text(strip=True) + "字"
                        
                    # Chapters
                    chapters = 0
                    latest_ch_tag = soup.select_one(".book-latest-chapter")
                    if latest_ch_tag:
                        ch_match = re.search(r'第\s*(\d+)\s*[章回节]', latest_ch_tag.get_text())
                        if ch_match:
                            chapters = int(ch_match.group(1))
                            
                    return {
                        "id": str(book_id),
                        "title": title,
                        "author": author,
                        "category": category,
                        "subcategory": subcategory,
                        "word_count": word_count,
                        "chapters": chapters,
                        "url": url,
                        "cover": cover,
                        "description": description,
                        "status": "Parsed"
                    }
            except Exception as e:
                # Network or parser error
                print(f" -> ID {book_id}: Lỗi kết nối (Lần thử {attempt+1}): {e}. Đợi 5s...")
                await asyncio.sleep(5)
                
        # If all attempts failed
        return {
            "id": str(book_id), "title": None, "author": None, "category": None,
            "subcategory": None, "word_count": None, "chapters": None,
            "url": url, "cover": None, "description": None, "status": "Failed"
        }

async def main():
    global session_cookies
    init_db()
    
    # Default range
    start_id = 1040000000
    end_id = 1050000000
    
    if len(sys.argv) >= 3:
        try:
            start_id = int(sys.argv[1])
            end_id = int(sys.argv[2])
        except ValueError:
            pass
            
    # Get completed IDs to skip
    completed_ids = get_completed_ids()
    all_target_ids = list(range(start_id, end_id + 1))
    pending_ids = [bid for bid in all_target_ids if str(bid) not in completed_ids]
    
    print("==================================================")
    print("      CRAWLER QIDIAN ID-RANGE KHỞI ĐỘNG           ")
    print("==================================================")
    print(f"Quét dải ID: từ {start_id} đến {end_id}")
    print(f"Tổng số ID mục tiêu: {len(all_target_ids)}")
    print(f"Đã hoàn thành trước đó: {len(completed_ids)}")
    print(f"Số ID cần cào: {len(pending_ids)}")
    
    if not pending_ids:
        print("Không có ID nào cần cào!")
        auto_export_files()
        return
        
    # Get initial WAF cookies via Playwright
    session_cookies = await get_cookies_via_playwright()
    if not session_cookies:
        print("CẢNH BÁO: Không lấy được cookies ban đầu. Sẽ cố gắng làm mới sau.")
        
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
            tasks = [fetch_book(session, bid, semaphore) for bid in chunk]
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
                  f"| Thành công: {parsed_count} | 404: {not_found_count} | Khác: {invalid_count+error_count} "
                  f"| Tốc độ: {speed:.1f} truyện/s | ETA: {eta/3600:.2f} giờ", flush=True)
                  
            # Auto export to JSON & CSV periodically
            if time.time() - last_export_time > 180 or processed % 1000 == 0:
                auto_export_files()
                last_export_time = time.time()
                
            await asyncio.sleep(0.5) # Sleep between chunks to reduce pressure
            
        if batch:
            save_batch(batch)
            
        auto_export_files()
        print("\n=== HOÀN THÀNH CÀO QIDIAN ===")
        print(f"Thành công: {parsed_count} | Không tồn tại/Lỗi: {not_found_count + invalid_count + error_count}")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n[ĐÃ DỪNG CRAWLER] Đã lưu tiến trình vào cơ sở dữ liệu.")
