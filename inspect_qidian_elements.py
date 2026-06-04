import time
from playwright.sync_api import sync_playwright

def inspect():
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
                "--disable-dev-shm-usage"
            ]
        )
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            viewport={"width": 1280, "height": 720}
        )
        page = context.new_page()
        page.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        
        url = "https://www.qidian.com/book/1048823652/"
        page.goto(url, wait_until="domcontentloaded", timeout=30000)
        time.sleep(5)
        
        # Save HTML
        html = page.content()
        with open("qidian_book.html", "w", encoding="utf-8") as f:
            f.write(html)
            
        print("HTML saved to qidian_book.html")
        browser.close()

if __name__ == "__main__":
    inspect()
