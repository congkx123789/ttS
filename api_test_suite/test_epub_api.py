import requests
import random
import psycopg2
import io
from config import BACKEND_URL, DB_URL

def test_epub_endpoints():
    print("\n📚 Running EPUB API Tests (VIP Only)...")
    
    rand_id = random.randint(100000, 999999)
    username = f"epub_vip_{rand_id}"
    email = f"epub_vip_{rand_id}@example.com"
    password = f"secret_pass_{rand_id}"
    
    # 1. Register user
    requests.post(f"{BACKEND_URL}/api/auth/register", json={
        "username": username,
        "email": email,
        "password": password
    })
    
    # 2. Upgrade user to VIP in DB
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    cur.execute("UPDATE users SET vip_status = 1 WHERE email = %s", (email,))
    conn.commit()
    conn.close()
    
    # 3. Login to get JWT
    login_res = requests.post(f"{BACKEND_URL}/api/auth/login", json={
        "username": username,
        "password": password
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # 4. Test EPUB creation from TXT (/api/epub/convert-txt)
    print("  [+] Creating EPUB from raw TXT content...")
    txt_content = "第一章 洪荒世界\n盘古开天辟地，身体化为世间万物。"
    files = {
        "file": ("sample.txt", io.BytesIO(txt_content.encode("utf-8")), "text/plain")
    }
    data = {
        "title": f"Test Book {rand_id}",
        "author": "Author Name",
        "description": "Short description",
        "split_regex": r"第\s*\d+\s*[章|回]",
        "translate": "false"
    }
    res_convert = requests.post(f"{BACKEND_URL}/api/epub/convert-txt", data=data, files=files, headers=headers)
    print(f"      Response: {res_convert.status_code} | Content-Type: {res_convert.headers.get('Content-Type')} | Length: {len(res_convert.content)}")
    assert res_convert.status_code == 200, "EPUB convert-txt failed"
    assert "epub" in res_convert.headers.get("Content-Type", ""), "Invalid Content-Type returned"
    
    epub_bytes = res_convert.content
    
    # 5. Test EPUB Translation (/api/epub/translate)
    print("  [+] Testing EPUB translation (fast mode)...")
    trans_files = {
        "file": ("test_book.epub", io.BytesIO(epub_bytes), "application/epub+zip")
    }
    trans_data = {
        "mode": "fast",
        "limit_chapters": "1",
        "clean_styles": "true"
    }
    res_trans = requests.post(f"{BACKEND_URL}/api/epub/translate", data=trans_data, files=trans_files, headers=headers)
    print(f"      Response: {res_trans.status_code} | Content-Type: {res_trans.headers.get('Content-Type')} | Length: {len(res_trans.content)}")
    assert res_trans.status_code == 200, "EPUB translation failed"
    
    # 6. Test EPUB Optimization (/api/epub/optimize)
    print("  [+] Testing EPUB optimization...")
    opt_files = {
        "file": ("test_book.epub", io.BytesIO(epub_bytes), "application/epub+zip")
    }
    opt_data = {
        "strip_images": "true",
        "strip_fonts": "true"
    }
    res_opt = requests.post(f"{BACKEND_URL}/api/epub/optimize", data=opt_data, files=opt_files, headers=headers)
    print(f"      Response: {res_opt.status_code} | Content-Type: {res_opt.headers.get('Content-Type')} | Length: {len(res_opt.content)}")
    assert res_opt.status_code == 200, "EPUB optimization failed"
    
    # 7. Test access prevention for non-VIP
    print("  [+] Testing VIP access enforcement for non-VIP users...")
    non_vip_username = f"epub_nonvip_{rand_id}"
    non_vip_email = f"epub_nonvip_{rand_id}@example.com"
    requests.post(f"{BACKEND_URL}/api/auth/register", json={
        "username": non_vip_username,
        "email": non_vip_email,
        "password": password
    })
    non_vip_login = requests.post(f"{BACKEND_URL}/api/auth/login", json={
        "username": non_vip_username,
        "password": password
    })
    non_vip_token = non_vip_login.json()["access_token"]
    non_vip_headers = {"Authorization": f"Bearer {non_vip_token}"}
    
    non_vip_files = {
        "file": ("test_book.epub", io.BytesIO(epub_bytes), "application/epub+zip")
    }
    res_non_vip = requests.post(f"{BACKEND_URL}/api/epub/optimize", data=opt_data, files=non_vip_files, headers=non_vip_headers)
    print(f"      Response: {res_non_vip.status_code} | {res_non_vip.json()}")
    assert res_non_vip.status_code == 403, "Non-VIP user was not blocked from optimize"
    
    print("✅ EPUB API Tests Completed successfully!")

if __name__ == "__main__":
    test_epub_endpoints()
