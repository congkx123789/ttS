import sys
from playwright.sync_api import sync_playwright

def inspect():
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            executable_path="/usr/bin/google-chrome",
            args=["--disable-blink-features=AutomationControlled", "--no-sandbox"]
        )
        context = browser.new_context(
            user_agent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36"
        )
        page = context.new_page()
        page.goto("https://www.qidian.com/all/chanId21-action0-page1/", wait_until="domcontentloaded")
        
        # Wait 3 seconds to be sure it loaded
        page.wait_for_timeout(3000)
        
        print("Page Title:", page.title())
        
        # Find elements containing text '夜无疆' (which is the first book)
        # We find its parent structure
        print("Searching for book card elements...")
        locators = page.locator("text='夜无疆'")
        if locators.count() > 0:
            el = locators.first
            # Go up the DOM tree and print outer HTML and tag names
            parent = el
            for i in range(5):
                parent = parent.locator("xpath=..")
                print(f"Parent {i}: tag={parent.evaluate('el => el.tagName')}, class={parent.evaluate('el => el.className')}")
        else:
            print("Could not find book '夜无疆'")
            
        browser.close()

if __name__ == "__main__":
    inspect()
