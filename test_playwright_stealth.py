import sys
from playwright.sync_api import sync_playwright

def test():
    print("Starting Playwright (Stealth mode)...")
    with sync_playwright() as p:
        try:
            # Launch with custom args
            browser = p.chromium.launch(
                headless=True,
                args=[
                    "--disable-blink-features=AutomationControlled",
                    "--no-sandbox"
                ]
            )
            
            # Create a context with user agent and custom settings
            context = browser.new_context(
                user_agent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                viewport={"width": 1280, "height": 720}
            )
            
            page = context.new_page()
            
            # Exclude webdriver detection
            page.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
            
            print("Navigating to Qidian...")
            response = page.goto("https://www.qidian.com/all/", timeout=30000)
            
            print(f"Response status: {response.status if response else 'No Response'}")
            print(f"Page Title: {page.title()}")
            
            # Wait for content or probe to load (wait 5s for any challenges to pass)
            page.wait_for_timeout(5000)
            
            # Check if we got through
            try:
                page.wait_for_selector("ul.book-img-text", timeout=5000)
                print("SUCCESS: Found book list!")
                first_book = page.locator("ul.book-img-text li h2 a").first
                if first_book:
                    print(f"First Book: {first_book.inner_text()}")
            except Exception as e:
                print(f"Failed to find book list. Title: {page.title()}")
                print("HTML content snippet:")
                print(page.content()[:1000])
                
        except Exception as e:
            print(f"Error occurred: {e}")
        finally:
            if 'browser' in locals():
                browser.close()

if __name__ == "__main__":
    test()
