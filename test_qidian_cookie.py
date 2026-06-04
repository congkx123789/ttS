import time
import requests
from playwright.sync_api import sync_playwright

def test_cookie():
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
        
        # Navigate to set the WAF cookie
        url = "https://www.qidian.com/book/1048823652/"
        page.goto(url, wait_until="domcontentloaded")
        time.sleep(5)
        
        # Get cookies
        playwright_cookies = context.cookies()
        print("Playwright cookies obtained:", len(playwright_cookies))
        
        # Convert to requests session format
        session = requests.Session()
        for cookie in playwright_cookies:
            session.cookies.set(cookie['name'], cookie['value'], domain=cookie['domain'])
            
        # Add headers to match
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Referer": "https://www.qidian.com/"
        }
        
        # Now try to fetch the book using requests
        print("Fetching with requests...")
        r = session.get(url, headers=headers, timeout=10)
        print("Requests response status:", r.status_code)
        
        # Try fetching a non-existent book using requests
        bad_url = "https://www.qidian.com/book/9999999999/"
        print("Fetching non-existent with requests...")
        r_bad = session.get(bad_url, headers=headers, timeout=10)
        print("Requests non-existent response status:", r_bad.status_code)
        
        if "error--起点中文网" in r_bad.text:
            print("Successfully detected bad book using requests!")
            
        browser.close()

if __name__ == "__main__":
    test_cookie()
