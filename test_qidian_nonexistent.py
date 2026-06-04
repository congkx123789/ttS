import time
from playwright.sync_api import sync_playwright

def test():
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
        
        url = "https://www.qidian.com/book/9999999999/"
        print(f"Navigating to {url}...")
        response = page.goto(url, wait_until="domcontentloaded", timeout=30000)
        time.sleep(8)
        print(f"Final URL: {page.url}")
        print(f"Page title: {page.title()}")
        print(f"Response status: {response.status if response else 'None'}")
        
        # Save screenshot of error
        page.screenshot(path="qidian_nonexistent.png")
        
        # Check if we can identify non-existence
        # E.g. title contains 404, or redirects to qidian.com/404, or has "该书暂未上线" or "未找到相关书籍"
        content = page.content()
        if "暂未上线" in content or "该书已下架" in content or "404" in page.url or "找不到了" in content:
            print("Detected as non-existent book!")
            
        browser.close()

if __name__ == "__main__":
    test()
