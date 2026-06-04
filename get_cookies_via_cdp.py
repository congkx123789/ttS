import asyncio
from playwright.async_api import async_playwright

async def get_cookies():
    try:
        async with async_playwright() as p:
            # Connect to the existing Chrome instance over CDP
            print("Connecting to Chrome on port 9222...")
            browser = await p.chromium.connect_over_cdp("http://localhost:9222")
            
            # Find the active page/tab or open a new one
            contexts = browser.contexts
            if not contexts:
                print("No contexts found.")
                return
                
            context = contexts[0]
            pages = context.pages
            print(f"Found {len(pages)} pages.")
            
            target_page = None
            for page in pages:
                url = page.url
                print("Page URL:", url)
                if "fanqienovel.com" in url:
                    target_page = page
                    break
                    
            if not target_page:
                # Open a new page in the same context to retrieve cookies
                print("Opening new page to get cookies...")
                target_page = await context.new_page()
                await target_page.goto("https://fanqienovel.com/library")
                await target_page.wait_for_timeout(1000)
                
            cookie_str = await target_page.evaluate("document.cookie")
            print("\n--- COOKIES EXTRACTED ---")
            print(cookie_str)
            print("-------------------------\n")
            
            # Save cookies to a json file
            cookies = await context.cookies()
            with open("fanqie_cookies.json", "w") as f:
                json.dump(cookies, f, indent=4)
                print("Saved cookies to fanqie_cookies.json")
                
            await browser.close()
    except Exception as e:
        print("Error connecting over CDP:", e)

if __name__ == "__main__":
    import json
    asyncio.run(get_cookies())
