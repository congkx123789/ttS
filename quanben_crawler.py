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

DB_PATH = "quanben_books.db"
CONCURRENCY = 12  # More concurrency since we do fewer requests per book now
BASE_URL = "https://www.quanben5.com"
BATCH_SIZE = 200  # Save to DB every 200 items

CAT_MAP = {
    "xuanhuanxiaoshuo": "玄幻小说",
    "qihuanxiaoshuo": "奇幻小说",
    "kehuanxiaoshuo": "科幻小说",
    "wuxiaxiaoshuo": "武侠小说",
    "xianxiaxiaoshuo": "仙侠小说",
    "wangyouxiaoshuo": "网游小说",
    "tuilixiaoshuo": "推理小说",
    "lingyixiaoshuo": "灵异小说",
    "kongbuxiaoshuo": "恐怖小说",
    "lishixiaoshuo": "历史小说",
    "junshixiaoshuo": "军事小说",
    "dushixiaoshuo": "都市小说",
    "yanqingxiaoshuo": "言情小说",
    "jiakongxiaoshuo": "架空小说",
    "danmeixiaoshuo": "耽美小说",
    "qingchunxiaoshuo": "青春小说",
    "xiaoyuanxiaoshuo": "校园小说",
    "shenghuoxiaoshuo": "生活小说",
    "gudianshuji": "古典书籍",
    "gudianxiaoshuo": "古典小说",
    "qitashuji": "其它书籍"
}

CAT_PAGES = {
    "xuanhuanxiaoshuo": 119,
    "qihuanxiaoshuo": 7,
    "kehuanxiaoshuo": 33,
    "wuxiaxiaoshuo": 6,
    "xianxiaxiaoshuo": 40,
    "wangyouxiaoshuo": 22,
    "tuilixiaoshuo": 1,
    "lingyixiaoshuo": 18,
    "kongbuxiaoshuo": 19,
    "lishixiaoshuo": 48,
    "junshixiaoshuo": 11,
    "dushixiaoshuo": 154,
    "yanqingxiaoshuo": 332,
    "jiakongxiaoshuo": 29,
    "danmeixiaoshuo": 14,
    "qingchunxiaoshuo": 23,
    "xiaoyuanxiaoshuo": 3,
    "shenghuoxiaoshuo": 1,
    "gudianshuji": 1,
    "gudianxiaoshuo": 2,
    "qitashuji": 130
}

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS quanben_novels (
            slug TEXT PRIMARY KEY,
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
    conn.close()

def get_completed_slugs():
    if not os.path.exists(DB_PATH):
        return set()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT slug FROM quanben_novels WHERE status = 'Parsed'")
    slugs = {row[0] for row in cursor.fetchall()}
    conn.close()
    return slugs

def get_all_db_slugs():
    if not os.path.exists(DB_PATH):
        return set()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT slug FROM quanben_novels")
    slugs = {row[0] for row in cursor.fetchall()}
    conn.close()
    return slugs

def save_batch_novels(batch):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    for item in batch:
        cursor.execute("""
            INSERT OR REPLACE INTO quanben_novels (slug, url, title, author, category, chapters, status)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (item['slug'], item['url'], item['title'], item['author'], item['category'], item['chapters'], item['status']))
    conn.commit()
    conn.close()

def insert_discovered_books(books):
    """books is a list of (slug, url, title, author, cat) tuples."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    for slug, url, title, author, cat in books:
        # If author already known from listing page, save it immediately
        # so Phase 2 only needs to fetch the chapters page.
        cursor.execute("""
            INSERT OR IGNORE INTO quanben_novels (slug, url, title, author, category, status)
            VALUES (?, ?, ?, ?, ?, 'Pending')
        """, (slug, url, title, author, cat))
    conn.commit()
    conn.close()

def auto_export_files():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT slug, url, title, author, category, chapters, status FROM quanben_novels")
        rows = cursor.fetchall()
        
        books = []
        for r in rows:
            books.append({
                "slug": r[0],
                "url": r[1],
                "title": r[2],
                "author": r[3],
                "category": r[4],
                "chapters": r[5],
                "status": r[6]
            })
        with open("quanben_books.json", "w", encoding="utf-8") as f:
            json.dump(books, f, ensure_ascii=False, indent=4)
            
        with open("quanben_books.csv", "w", encoding="utf-8", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(["Slug", "URL", "Title", "Author", "Category", "Chapters", "Status"])
            writer.writerows(rows)
    except Exception as e:
        print(f"\n[Lỗi tự động xuất file]: {e}")
    finally:
        conn.close()

async def discover_category_page(session, cat, url, semaphore):
    """Scrape a category listing page. Extracts slug, title, author, and category
    directly from the <div class='pic_txt_list'> cards — no extra requests needed.
    Returns list of (slug, url, title, author, cat_chinese)."""
    async with semaphore:
        for attempt in range(4):
            try:
                headers = {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                }
                await asyncio.sleep(0.1)
                async with session.get(url, headers=headers, timeout=15) as response:
                    if response.status == 429:
                        await asyncio.sleep(4.0)
                        continue
                    if response.status != 200:
                        await asyncio.sleep(1.0 * (attempt + 1))
                        continue
                    
                    html = await response.text(errors='ignore')
                    soup = BeautifulSoup(html, "html.parser")
                    
                    cat_chinese = CAT_MAP.get(cat, "其它书籍")
                    books_found = []
                    
                    # Each book card: <div class="pic_txt_list">
                    #   <h3><a href="/n/slug/"><span>Title</span></a></h3>
                    #   <p class="info">作者: <span class="author">AuthorName</span></p>
                    for card in soup.find_all("div", class_="pic_txt_list"):
                        a_tag = card.find("h3").find("a") if card.find("h3") else None
                        if not a_tag:
                            continue
                        href = a_tag.get("href", "")
                        match = re.match(r'^/n/([a-zA-Z0-9_-]+)/?$', href)
                        if not match:
                            continue
                        slug = match.group(1)
                        title_span = a_tag.find("span")
                        title = title_span.get_text().strip() if title_span else a_tag.get_text().strip()
                        if not title or title in ["开始阅读", "阅读"]:
                            continue
                        # Author from <span class="author"> in this card
                        author_span = card.find("span", class_="author")
                        author = author_span.get_text().strip() if author_span else None
                        
                        books_found.append((slug, f"{BASE_URL}/n/{slug}/", title, author, cat_chinese))
                    
                    return books_found
            except Exception:
                await asyncio.sleep(0.5 * (attempt + 1))
        return []

async def fetch_book_details(session, slug, title, author, category, semaphore):
    """Fetch only the chapters page for a book.
    Author is already known from the category listing page.
    Only falls back to intro page if author is still missing."""
    intro_url = f"{BASE_URL}/n/{slug}/"
    chapters_url = f"{BASE_URL}/n/{slug}/xiaoshuo.html"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    async with semaphore:
        chapters = None
        
        # --- Fetch Chapters Page ONLY (author already known from listing) ---
        attempt = 0
        while attempt < 4:
            try:
                await asyncio.sleep(0.15)
                async with session.get(chapters_url, headers=headers, timeout=12) as r:
                    if r.status == 429:
                        await asyncio.sleep(5.0)
                        continue
                    if r.status == 404:
                        # Book doesn't exist on this mirror
                        return {
                            "slug": slug, "url": intro_url, "title": title,
                            "author": author, "category": category, "chapters": 0,
                            "status": "404"
                        }
                    if r.status != 200:
                        attempt += 1
                        await asyncio.sleep(1.0 * attempt)
                        continue
                    
                    html = await r.text(errors='ignore')
                    soup = BeautifulSoup(html, "html.parser")
                    
                    # Count <li> elements with chapter links like /n/slug/N.html
                    chapter_items = [li for li in soup.find_all("li")
                                     if li.find("a") and re.search(
                                         r"/n/[^/]+/\d+\.html",
                                         li.find("a").get("href", "")
                                     )]
                    chapters = len(chapter_items)
                    
                    # Fallback: if author still unknown, grab it from intro page
                    if not author:
                        try:
                            async with session.get(intro_url, headers=headers, timeout=10) as ri:
                                if ri.status == 200:
                                    si = BeautifulSoup(await ri.text(errors='ignore'), "html.parser")
                                    sp = si.find("span", class_="author")
                                    if sp: author = sp.get_text().strip()
                        except Exception:
                            pass
                    break
            except Exception:
                attempt += 1
                await asyncio.sleep(0.5 * attempt)
                
        if chapters is not None:
            return {
                "slug": slug, "url": intro_url, "title": title,
                "author": author, "category": category,
                "chapters": chapters, "status": "Parsed"
            }
        else:
            return {
                "slug": slug, "url": intro_url, "title": title,
                "author": author, "category": category,
                "chapters": None, "status": "Failed"
            }

async def main():
    init_db()
    
    # Check if there are already pending books in the database
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM quanben_novels WHERE status = 'Pending'")
    pending_count = cursor.fetchone()[0]
    conn.close()
    
    semaphore = asyncio.Semaphore(CONCURRENCY)
    connector = aiohttp.TCPConnector(limit=CONCURRENCY, ttl_dns_cache=300)
    
    async with aiohttp.ClientSession(connector=connector) as session:
        if pending_count == 0:
            # Generate all category page URLs
            pages_to_discover = []
            for cat, max_p in CAT_PAGES.items():
                for p in range(1, max_p + 1):
                    if p == 1:
                        pages_to_discover.append((cat, f"{BASE_URL}/category/{cat}.html"))
                    else:
                        pages_to_discover.append((cat, f"{BASE_URL}/category/{cat}-{p}.html"))
                        
            # --- PHASE 1: DISCOVER ALL BOOKS ---
            print(f"=== GIAI ĐOẠN 1: QUÉT TẤT CẢ DANH MỤC TRUYỆN ({len(pages_to_discover)} trang) ===")
            start_time = time.time()
            
            # Scrape page by page in chunks
            chunk_size = 50
            all_discovered = []
            for i in range(0, len(pages_to_discover), chunk_size):
                chunk = pages_to_discover[i:i + chunk_size]
                tasks = [discover_category_page(session, cat, url, semaphore) for cat, url in chunk]
                results = await asyncio.gather(*tasks)
                
                # Save chunk to DB
                chunk_books = []
                for res in results:
                    chunk_books.extend(res)
                
                if chunk_books:
                    insert_discovered_books(chunk_books)
                    all_discovered.extend(chunk_books)
                    
                elapsed = time.time() - start_time
                speed = (i + len(chunk)) / elapsed if elapsed > 0 else 0
                eta = (len(pages_to_discover) - (i + len(chunk))) / speed if speed > 0 else 0
                print(f"Danh mục đã quét: {i + len(chunk)}/{len(pages_to_discover)} ({((i + len(chunk))/len(pages_to_discover))*100:.2f}%) "
                      f"| Đã tìm thấy: {len(all_discovered)} link | Tốc độ: {speed:.1f} trang/s | ETA: {eta:.1f}s")
                      
            print(f"Đã hoàn thành quét danh mục. Tổng số truyện tìm thấy: {len(all_discovered)}")
        else:
            print(f"Phát hiện {pending_count} truyện ở trạng thái 'Pending'. Bỏ qua Giai đoạn 1 và tiến hành cào chi tiết ngay.")
            
        # --- PHASE 2: FETCH CHAPTERS ONLY (author already in DB from listing) ---
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT slug, title, author, category FROM quanben_novels WHERE status = 'Pending'")
        pending_books = cursor.fetchall()
        conn.close()
        
        print(f"\n=== GIAI ĐOẠN 2: CÀO SỐ CHƯƠNG ({len(pending_books)} truyện chưa cào — tác giả đã biết từ trang listing) ===")
        if not pending_books:
            print("Không có truyện nào đang chờ cào!")
            auto_export_files()
            return
            
        batch = []
        parsed_count = 0
        not_found_count = 0
        error_count = 0
        
        start_time = time.time()
        last_export_count = 0
        
        chunk_size = 400
        for i in range(0, len(pending_books), chunk_size):
            chunk = pending_books[i:i + chunk_size]
            tasks = [fetch_book_details(session, slug, title, author, cat, semaphore) for slug, title, author, cat in chunk]
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
                    save_batch_novels(batch)
                    batch = []
                    
            elapsed = time.time() - start_time
            processed = (i + len(chunk))
            speed = processed / elapsed if elapsed > 0 else 0
            remaining = len(pending_books) - processed
            eta = remaining / speed if speed > 0 else 0
            
            print(f"Tiến độ: {processed}/{len(pending_books)} ({processed/len(pending_books)*100:.2f}%) "
                  f"| Thành công: {parsed_count} | 404: {not_found_count} | Lỗi khác: {error_count} "
                  f"| Tốc độ: {speed:.1f} truyện/s | ETA: {eta/3600:.2f}h")
                  
            if (processed - last_export_count) >= 5000:
                auto_export_files()
                last_export_count = processed
                
            await asyncio.sleep(0.5)
            
        if batch:
            save_batch_novels(batch)
            
        auto_export_files()
        print("\n=== HOÀN THÀNH CÀO QUANBEN-XIAOSHUO ===")
        print(f"Tổng số truyện đã cào chi tiết: {len(pending_books)}")
        print(f"Thành công: {parsed_count} | 404: {not_found_count} | Lỗi khác: {error_count}")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n[ĐÃ DỪNG CRAWLER] Đã lưu tiến trình vào cơ sở dữ liệu.")
