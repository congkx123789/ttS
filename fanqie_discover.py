import asyncio
import aiohttp
import sqlite3
import os
import re

DB_PATH = "fanqie_books.db"
CATEGORIES_FILE = "/home/alida/.gemini/antigravity/brain/48dc74e2-79a4-43df-b520-56ae0b30918b/browser/scratchpad_0c563kl0.md"
MAX_PAGES_PER_CATEGORY = 10  # Limit to 10 pages to keep it fast

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

def save_pending_ids(book_ids):
    if not book_ids:
        return 0
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    conn.execute("PRAGMA journal_mode=WAL")
    cursor = conn.cursor()
    saved = 0
    for bid in book_ids:
        url = f"https://fanqienovel.com/page/{bid}"
        try:
            cursor.execute("""
                INSERT OR IGNORE INTO fanqie_novels (id, url, status)
                VALUES (?, ?, 'Pending')
            """, (bid, url))
            if cursor.rowcount > 0:
                saved += 1
        except Exception as e:
            pass
    conn.commit()
    conn.close()
    return saved

async def main():
    init_db()
    print("="*60)
    print("KHỞI CHẠY THIẾT BỊ PHÁT HIỆN ID FANQIE (FANQIE DISCOVER)")
    print("="*60)
    
    categories = load_categories()
    print(f"Đã tải {len(categories)} danh mục để quét.")
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://fanqienovel.com/library"
    }
    
    total_new = 0
    
    async with aiohttp.ClientSession() as session:
        for i, (cat_name, cat_id) in enumerate(categories.items(), 1):
            print(f"[{i}/{len(categories)}] Đang quét '{cat_name}' (ID: {cat_id})...")
            
            for page in range(MAX_PAGES_PER_CATEGORY):
                url = f"https://fanqienovel.com/api/author/library/book_list/v0/?page_count=18&page_index={page}&gender=-1&category_id={cat_id}&creation_status=-1&word_count=-1&book_type=-1&sort=0"
                try:
                    async with session.get(url, headers=headers, timeout=10) as response:
                        if response.status != 200:
                            break
                        res_data = await response.json()
                        data = res_data.get("data", {})
                        book_list = data.get("book_list", [])
                        has_more = data.get("has_more", False)
                        
                        if not book_list:
                            break
                            
                        bids = [str(b["book_id"]) for b in book_list if b.get("book_id")]
                        saved = save_pending_ids(bids)
                        total_new += saved
                        
                        if not has_more:
                            break
                except Exception as e:
                    break
                await asyncio.sleep(0.1) # Tiny gap
                
            # Log progress per 10 categories
            if i % 10 == 0:
                conn = sqlite3.connect(DB_PATH)
                c = conn.cursor()
                c.execute("SELECT COUNT(*) FROM fanqie_novels")
                total = c.fetchone()[0]
                conn.close()
                print(f" -> Tiến độ: Đã quét {i} danh mục. Tổng ID phát hiện trong DB: {total} (+{total_new} mới)")
                
    print("\n" + "="*60)
    print(f"QUÁ TRÌNH TÌM ID HOÀN TẤT! Tổng số ID mới phát hiện: {total_new}")
    print("="*60)

if __name__ == "__main__":
    asyncio.run(main())
