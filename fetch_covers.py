import os
import re
import sqlite3
import asyncio
import aiohttp
from bs4 import BeautifulSoup

dbs = ["merged_books.db", "merged_books_advanced.db", "merged_books_fast.db", "merged_books_hanviet.db"]
root_dir = "/home/alida/Documents/Tool translate CHinese"

def parse_urls(urls_str):
    if not urls_str:
        return {}
    res = {}
    for p in urls_str.split(" | "):
        idx = p.find(": ")
        if idx >= 0:
            res[p[:idx]] = p[idx+2:]
    return res

async def fetch_cover_url(session, title, sources_dict):
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    # Try Quanben first
    if "Quanben" in sources_dict:
        url = sources_dict["Quanben"]
        try:
            async with session.get(url, headers=headers, timeout=10) as resp:
                if resp.status == 200:
                    html = await resp.text()
                    soup = BeautifulSoup(html, "html.parser")
                    # Find image with alt equal to title
                    for img in soup.find_all("img"):
                        alt = img.get("alt", "")
                        src = img.get("src", "")
                        if alt and src and (alt.strip() == title.strip()):
                            if src.startswith("//"):
                                src = "https:" + src
                            return src
        except Exception:
            pass

    # Try Ixdzs second
    if "Ixdzs" in sources_dict:
        url = sources_dict["Ixdzs"]
        try:
            async with session.get(url, headers=headers, timeout=10) as resp:
                if resp.status == 200:
                    html = await resp.text()
                    soup = BeautifulSoup(html, "html.parser")
                    # Find image with alt equal to title + "封面"
                    for img in soup.find_all("img"):
                        alt = img.get("alt", "")
                        src = img.get("src", "")
                        if alt and src and (title.strip() in alt):
                            if src.startswith("//"):
                                src = "https:" + src
                            return src
        except Exception:
            pass
            
    return None

async def worker(queue, session, update_queue, pbar_dict):
    while True:
        item = await queue.get()
        if item is None:
            queue.task_done()
            break
            
        row_id, title, urls_str = item
        sources_dict = parse_urls(urls_str)
        
        cover_url = await fetch_cover_url(session, title, sources_dict)
        if cover_url:
            await update_queue.put((row_id, cover_url))
            pbar_dict["success"] += 1
            
        pbar_dict["processed"] += 1
        processed = pbar_dict["processed"]
        success = pbar_dict["success"]
        
        if processed % 100 == 0:
            print(f"[Tiến trình] Đã xử lý: {processed} truyện | Tìm thấy bìa: {success} | Đang chạy...")
            
        await asyncio.sleep(0.05)
        queue.task_done()

async def db_writer(update_queue):
    # Establish connections to all 4 databases
    conns = []
    for db in dbs:
        db_path = os.path.join(root_dir, db)
        if os.path.exists(db_path):
            conn = sqlite3.connect(db_path)
            conn.execute("PRAGMA journal_mode=WAL")
            conn.execute("PRAGMA synchronous=OFF")
            conns.append(conn)
            
    try:
        while True:
            item = await update_queue.get()
            if item is None:
                update_queue.task_done()
                break
                
            row_id, cover_url = item
            for conn in conns:
                conn.execute("UPDATE books SET cover = ? WHERE id = ?", (cover_url, row_id))
                conn.commit()
                
            update_queue.task_done()
    finally:
        for conn in conns:
            conn.close()

async def main():
    # 1. Query coverless books
    db_primary = os.path.join(root_dir, "merged_books.db")
    conn = sqlite3.connect(db_primary)
    cursor = conn.cursor()
    cursor.execute("SELECT id, title, urls FROM books WHERE cover IS NULL OR cover = ''")
    rows = cursor.fetchall()
    conn.close()
    
    print(f"Tổng số sách chưa có ảnh bìa: {len(rows):,}")
    
    to_process = rows
    print(f"Sẽ xử lý {len(to_process):,} cuốn sách.")
    
    queue = asyncio.Queue()
    update_queue = asyncio.Queue()
    
    for item in to_process:
        await queue.put(item)
        
    pbar_dict = {"processed": 0, "success": 0}
    
    # Start writer task
    writer_task = asyncio.create_task(db_writer(update_queue))
    
    # Start worker tasks
    concurrency = 30
    async with aiohttp.ClientSession() as session:
        workers = []
        for _ in range(concurrency):
            workers.append(asyncio.create_task(worker(queue, session, update_queue, pbar_dict)))
            
        # Wait for all workers to finish processing queue
        await queue.join()
        
        # Stop workers
        for _ in range(concurrency):
            await queue.put(None)
        await asyncio.gather(*workers)
        
    # Stop writer
    await update_queue.put(None)
    await writer_task
    
    print("\n" + "="*50)
    print("HOÀN THÀNH CẬP NHẬT BÌA SÁCH!")
    print(f"Đã duyệt qua: {pbar_dict['processed']} cuốn sách")
    print(f"Đã cập nhật ảnh bìa thành công: {pbar_dict['success']} cuốn")
    print("="*50)

if __name__ == "__main__":
    asyncio.run(main())
