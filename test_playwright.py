import sys
from playwright.sync_api import sync_playwright

def test():
    print("Starting Playwright...")
    with sync_playwright() as p:
        try:
            # Launch chromium
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()
            
            # Go to Qidian
            print("Navigating to Qidian...")
            response = page.goto("https://www.qidian.com/all/", timeout=30000)
            
            print(f"Response status: {response.status if response else 'No Response'}")
            print(f"Page Title: {page.title()}")
            
            # Wait for list to load
            page.wait_for_selector("ul.book-img-text", timeout=5000)
            print("Found book list!")
            
            # Print first book title
            first_book = page.locator("ul.book-img-text li h2 a").first
            if first_book:
                print(f"First Book: {first_book.inner_text()}")
                
        except Exception as e:
            print(f"Error occurred: {e}")
            if 'page' in locals():
                print("Page content snippet:")
                print(page.content()[:1000])
        finally:
            if 'browser' in locals():
                browser.close()

if __name__ == "__main__":
    test()
