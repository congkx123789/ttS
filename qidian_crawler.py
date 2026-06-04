import argparse
import json
import time
from playwright.sync_api import sync_playwright

def crawl_books(start_page=1, end_page=2, output_file="qidian_books.json"):
    print("="*60)
    print(f"BẮT ĐẦU CÀO TRUYỆN QIDIAN (Trang {start_page} -> {end_page})")
    print(f"File đầu ra: {output_file}")
    print("="*60)
    
    all_books = []
    
    with sync_playwright() as p:
        # Launch Chromium với các tham số ẩn danh (Stealth)
        browser = p.chromium.launch(
            headless=True,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
                "--disable-dev-shm-usage"
            ]
        )
        
        context = browser.new_context(
            user_agent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            viewport={"width": 1280, "height": 720}
        )
        
        page = context.new_page()
        
        # Ẩn thuộc tính webdriver của trình duyệt tự động
        page.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        
        for pg in range(start_page, end_page + 1):
            url = f"https://www.qidian.com/all/page{pg}/"
            print(f"\n[+] Đang tải trang {pg}: {url}...")
            
            try:
                # Điều hướng
                response = page.goto(url, wait_until="domcontentloaded", timeout=30000)
                
                # Nếu dính trang challenge 202 (probe.js), đợi một chút để script tự động chạy qua
                if response and response.status == 202:
                    print(" -> Phát hiện màn hình thử thách của Qidian. Chờ 5 giây...")
                    page.wait_for_timeout(5000)
                
                # Đợi danh sách sách (ul.book-img-text) hiển thị trên màn hình
                print(" -> Đang đợi danh sách truyện tải...")
                page.wait_for_selector("ul.book-img-text", timeout=15000)
                
                # Lấy tất cả các thẻ <li> chứa thông tin truyện
                book_locators = page.locator("ul.book-img-text li").all()
                print(f" -> Tìm thấy {len(book_locators)} cuốn truyện ở trang này.")
                
                for idx, book in enumerate(book_locators):
                    try:
                        # Trích xuất thông tin
                        title_el = book.locator(".book-mid-info h2 a")
                        title = title_el.inner_text().strip()
                        book_url = "https:" + (title_el.get_attribute("href") or "")
                        
                        img_el = book.locator(".book-img-box img")
                        # Lấy src hoặc data-original do cơ chế lazy load ảnh của Qidian
                        cover_url = img_el.get_attribute("src") or img_el.get_attribute("data-original") or ""
                        if cover_url and cover_url.startswith("//"):
                            cover_url = "https:" + cover_url
                            
                        desc = book.locator(".book-mid-info .intro").inner_text().strip()
                        author = book.locator(".book-mid-info .author .name").inner_text().strip()
                        category = book.locator(".book-mid-info .author a").nth(1).inner_text().strip()
                        
                        all_books.append({
                            "title": title,
                            "author": author,
                            "category": category,
                            "url": book_url,
                            "cover": cover_url,
                            "description": desc
                        })
                    except Exception as inner_e:
                        continue
                
                # Lưu tạm dữ liệu sau mỗi trang để tránh mất mát nếu bị chặn giữa chừng
                with open(output_file, "w", encoding="utf-8") as f:
                    json.dump(all_books, f, ensure_ascii=False, indent=4)
                    
                print(f"[THÀNH CÔNG] Đã lưu tổng cộng {len(all_books)} truyện vào '{output_file}'.")
                
                # Chờ 3 giây trước khi sang trang tiếp theo để tránh bị quét IP
                time.sleep(3)
                
            except Exception as e:
                print(f"[LỖI] Không thể cào trang {pg}: {e}")
                # Chụp ảnh màn hình lỗi để bạn dễ kiểm tra nguyên nhân
                try:
                    page.screenshot(path=f"error_page_{pg}.png")
                    print(f" -> Đã chụp ảnh màn hình lỗi tại 'error_page_{pg}.png'")
                except:
                    pass
                
        browser.close()
        
    print("\n" + "="*60)
    print(f"HOÀN TẤT CÀO DỮ LIỆU! Đã lưu {len(all_books)} truyện vào '{output_file}'")
    print("="*60)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Tool cào metadata truyện Qidian.")
    parser.add_argument("-s", "--start", type=int, default=1, help="Trang bắt đầu (mặc định: 1)")
    parser.add_argument("-e", "--end", type=int, default=2, help="Trang kết thúc (mặc định: 2)")
    parser.add_argument("-o", "--output", default="qidian_books.json", help="Tên file kết quả JSON (mặc định: qidian_books.json)")
    args = parser.parse_args()
    
    crawl_books(start_page=args.start, end_page=args.end, output_file=args.output)
