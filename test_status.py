import asyncio
import aiohttp
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()
        await page.goto("https://www.qidian.com/book/1048823652/")
        await asyncio.sleep(6)
        cookies = await context.cookies()
        await browser.close()
        
        cookie_dict = {c['name']: c['value'] for c in cookies}
        print("Cookies retrieved:", len(cookie_dict))
        
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Referer": "https://www.qidian.com/"
        }
        
        async with aiohttp.ClientSession() as session:
            session.cookie_jar.update_cookies(cookie_dict)
            async with session.get("https://www.qidian.com/book/1/", headers=headers) as resp:
                print("Status code for book 1:", resp.status)
                print("Headers:", dict(resp.headers))
                html = await resp.text()
                print("HTML snippet:", html[:500])

asyncio.run(main())
