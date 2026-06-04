import time
from playwright.sync_api import sync_playwright

def test_qidian():
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
        print(f"Navigating to {url}...")
        response = page.goto(url, wait_until="domcontentloaded", timeout=30000)
        print(f"Initial response status: {response.status if response else 'None'}")
        
        # Wait 5 seconds for WAF check
        time.sleep(5)
        
        # Print title
        title = page.title()
        print(f"Page title: {title}")
        
        # Check if book title is visible
        try:
            # Let's see what selectors Qidian uses for book info.
            # In Qidian, book title is often inside `.book-info h1 em` or similar.
            # Let's save a screenshot to check the visual state.
            page.screenshot(path="qidian_book_test.png")
            print("Screenshot saved to qidian_book_test.png")
            
            h1 = page.locator("h1").first.inner_text()
            print(f"First H1: {h1}")
        except Exception as e:
            print(f"Error checking elements: {e}")
            
        browser.close()

if __name__ == "__main__":
    test_qidian()
