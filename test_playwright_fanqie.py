import asyncio
from playwright.async_api import async_playwright
import json
import re

async def test_playwright():
    async with async_playwright() as p:
        # Launch browser in headless mode
        browser = await p.chromium.launch(headless=True)
        # Create a new browser context with a realistic user agent
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        page = await context.new_page()
        
        # Navigate to a book page
        url = "https://fanqienovel.com/page/7402200659753176126"
        print(f"Navigating to {url}...")
        
        response = await page.goto(url)
        print("Status code:", response.status)
        
        # Wait for the script tag to be loaded or just wait a bit
        await page.wait_for_timeout(2000)
        
        # Extract window.__INITIAL_STATE__
        try:
            state = await page.evaluate("window.__INITIAL_STATE__")
            if state:
                print("Successfully extracted state!")
                print("Book Title:", state.get("page", {}).get("bookName"))
                print("Author:", state.get("page", {}).get("author"))
            else:
                print("window.__INITIAL_STATE__ is empty or not found.")
        except Exception as e:
            print("Error evaluating JS:", e)
            
        await browser.close()

if __name__ == "__main__":
    asyncio.run(test_playwright())
