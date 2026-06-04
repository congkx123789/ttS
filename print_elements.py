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
        page.wait_for_timeout(5000)
        
        print("Page Title:", page.title())
        
        # Print all headers
        h2_elements = page.locator("h2").all()
        print(f"Total H2 elements found: {len(h2_elements)}")
        for idx, h2 in enumerate(h2_elements[:15]):
            print(f"H2 {idx}: text='{h2.inner_text().strip()}', class='{h2.get_attribute('class') or ''}'")
            
        # Print links with class or text
        print("\nAll list items (li) classes on page:")
        li_elements = page.locator("li").all()
        li_classes = set()
        for li in li_elements:
            cls = li.get_attribute("class")
            if cls:
                li_classes.add(cls)
        print("LI classes found:", li_classes)
        
        browser.close()

if __name__ == "__main__":
    inspect()
