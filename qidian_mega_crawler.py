import os
import re
import sys
import time
import sqlite3
from playwright.sync_api import sync_playwright

# Cấu hình danh mục và ID của Qidian
CATEGORIES = {
    "Xuan Huan": 21,
    "Qi Huan": 1,
    "Wu Xia": 2,
    "Xian Xia": 22,
    "Du Shi": 4,
    "Xian Shi": 15,
    "Jun Shi": 5,
    "Li Shi": 7,
    "You Xi": 6,
    "Ti Yu": 8,
    "Ke Huan": 9,
    "Zhu Tian Wu Xian": 20122,
    "Xuan Yi": 10,
    "Qing Xiao Shuo": 12
}

# Các bộ lọc trạng thái (0: Đang viết, 1: Đã hoàn thành)
ACTIONS = [0, 1]

DB_PATH = "qidian_books.db"

def init_db():
    conn = sqlite3.connect(DB_PATH)
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
    conn.close()

def save_to_db(books):
    if not books:
        return 0
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    saved = 0
    for book in books:
        try:
            cursor.execute("""
                INSERT OR IGNORE INTO books (id, title, author, category, url, cover, description)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                book["id"],
                book["title"],
                book["author"],
                book["category"],
                book["url"],
                book["cover"],
                book["description"]
            ))
            if cursor.rowcount > 0:
                saved += 1
        except Exception as e:
            print(f"Lỗi ghi DB: {e}")
    conn.commit()
    conn.close()
    return saved

def get_total_count():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM books")
    count = cursor.fetchone()[0]
    conn.close()
    return count

def crawl_mega():
    init_db()
    print("="*60)
    print("KHỞI CHẠY HỆ THỐNG CÀO DỮ LIỆU LỚN QIDIAN (MEGA CRAWLER)")
    print(f"Đang sử dụng SQLite database: {DB_PATH}")
    print(f"Số lượng truyện hiện tại trong database: {get_total_count()}")
    print("="*60)
    
    with sync_playwright() as p:
        # Sử dụng trình duyệt Chrome thực tế đã cài trên máy bạn để vượt Cloudflare dễ dàng
        chrome_path = "/usr/bin/google-chrome"
        if not os.path.exists(chrome_path):
            chrome_path = None
            
        browser = p.chromium.launch(
            headless=True,
            executable_path=chrome_path,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
                "--disable-dev-shm-usage"
            ]
        )
        context = browser.new_context(
            user_agent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
            viewport={"width": 1280, "height": 720}
        )
        page = context.new_page()
        page.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        
        # Duyệt qua các danh mục
        for cat_name, cat_id in CATEGORIES.items():
            for action in ACTIONS:
                status_str = "Hoàn thành" if action == 1 else "Đang viết"
                print(f"\n[DANH MỤC] {cat_name} | Trạng thái: {status_str}")
                
                # Duyệt tối đa 100 trang của bộ lọc này (Giới hạn của Qidian)
                for pg in range(1, 101):
                    # Link kết hợp danh mục + bộ lọc trạng thái
                    url = f"https://www.qidian.com/all/chanId{cat_id}-action{action}-page{pg}/"
                    
                    print(f" -> Đang cào trang {pg}/100: {url}...")
                    
                    try:
                        response = page.goto(url, wait_until="domcontentloaded", timeout=30000)
                        
                        # Vượt màn hình chờ 202
                        if response and response.status == 202:
                            page.wait_for_timeout(5000)
                            
                        # Đợi danh sách sách (.book-img-text) hiển thị trên màn hình
                        page.wait_for_selector(".book-img-text", timeout=30000)
                        
                        book_locators = page.locator(".book-img-text li").all()
                        if not book_locators:
                            print(" -> Không tìm thấy thêm truyện. Chuyển bộ lọc tiếp theo...")
                            break
                            
                        page_books = []
                        for book in book_locators:
                            try:
                                title_el = book.locator(".book-mid-info h2 a")
                                title = title_el.inner_text().strip()
                                book_url = "https:" + (title_el.get_attribute("href") or "")
                                
                                # Trích xuất ID từ URL (ví dụ https://book.qidian.com/info/1016530091 -> 1016530091)
                                book_id = re.search(r'/(\d+)/?', book_url)
                                book_id = book_id.group(1) if book_id else title
                                
                                img_el = book.locator(".book-img-box img")
                                cover_url = img_el.get_attribute("src") or img_el.get_attribute("data-original") or ""
                                if cover_url and cover_url.startswith("//"):
                                    cover_url = "https:" + cover_url
                                    
                                desc = book.locator(".book-mid-info .intro").inner_text().strip()
                                author = book.locator(".book-mid-info .author .name").inner_text().strip()
                                category = book.locator(".book-mid-info .author a").nth(1).inner_text().strip()
                                
                                page_books.append({
                                    "id": book_id,
                                    "title": title,
                                    "author": author,
                                    "category": category,
                                    "url": book_url,
                                    "cover": cover_url,
                                    "description": desc
                                })
                            except Exception as inner:
                                continue
                        
                        # Lưu vào Database
                        new_saved = save_to_db(page_books)
                        print(f" -> Thành công! Đã lấy {len(page_books)} truyện (Thêm mới {new_saved} truyện vào DB). Tổng DB: {get_total_count()}")
                        
                        # Nghỉ ngắn tránh bị chặn IP
                        time.sleep(2)
                        
                    except Exception as e:
                        print(f" -> Lỗi khi xử lý trang {pg}: {e}")
                        try:
                            page.screenshot(path=f"error_mega_page_{pg}.png")
                            print(f" -> Đã lưu ảnh chụp lỗi tại 'error_mega_page_{pg}.png'")
                        except:
                            pass
                        # Nếu bị timeout hoặc chặn hẳn, nghỉ dài hơn
                        time.sleep(10)
                        
        browser.close()
        
    print("\n" + "="*60)
    print(f"QUÁ TRÌNH HOÀN TẤT! Tổng số truyện lưu trong DB: {get_total_count()}")
    print("="*60)

if __name__ == "__main__":
    crawl_mega()
