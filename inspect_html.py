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
        page.wait_for_timeout(8000)
        
        # Save HTML to file
        html_content = page.content()
        with open("qidian_page.html", "w", encoding="utf-8") as f:
            f.write(html_content)
        print("Successfully saved HTML to qidian_page.html")
        
        browser.close()

if __name__ == "__main__":
    inspect()
