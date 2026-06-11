import requests
import random
from config import BACKEND_URL

def test_books_endpoints():
    print("\n📖 Running Books & Bookshelf API Tests...")
    
    rand_id = random.randint(100000, 999999)
    username = f"books_user_{rand_id}"
    email = f"books_user_{rand_id}@example.com"
    password = f"secret_pass_{rand_id}"
    
    # 1. Fetch category stats
    print("  [+] Fetching book statistics (/api/stats)...")
    res_stats = requests.get(f"{BACKEND_URL}/api/stats")
    print(f"      Response: {res_stats.status_code} | Total books: {res_stats.json().get('total_books')}")
    assert res_stats.status_code == 200, "Stats fetch failed"
    
    # 2. Search novels
    search_query = "thần"
    print(f"  [+] Searching novels with query '{search_query}'...")
    res_search = requests.get(f"{BACKEND_URL}/api/books", params={"q": search_query})
    print(f"      Response: {res_search.status_code} | Matches found: {len(res_search.json().get('books', []))}")
    assert res_search.status_code == 200, "Search query failed"
    books = res_search.json().get("books", [])
    
    if not books:
        print("      ⚠️ No books in database to run detailed bookshelf tests. Skipping bookshelf add/remove.")
        print("✅ Books API Tests Completed!")
        return
        
    target_book = books[0]
    book_id = target_book["id"]
    book_title = target_book.get("title_vietphrase", "Unknown Title")
    print(f"      Target Book ID: {book_id} | Title: {book_title}")
    
    # Register and login to test authenticated bookshelf/history
    requests.post(f"{BACKEND_URL}/api/auth/register", json={
        "username": username,
        "email": email,
        "password": password
    })
    login_res = requests.post(f"{BACKEND_URL}/api/auth/login", json={
        "username": username,
        "password": password
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # 3. Add to bookshelf
    print(f"  [+] Adding Book #{book_id} to bookshelf...")
    res_add = requests.post(f"{BACKEND_URL}/api/bookshelf/add", json={"book_id": book_id}, headers=headers)
    print(f"      Response: {res_add.status_code} | {res_add.json()}")
    assert res_add.status_code == 200, "Add to bookshelf failed"
    
    # 4. Fetch bookshelf
    print("  [+] Retrieving user bookshelf...")
    res_shelf = requests.get(f"{BACKEND_URL}/api/bookshelf", headers=headers)
    print(f"      Response: {res_shelf.status_code} | Books in shelf: {len(res_shelf.json())}")
    assert res_shelf.status_code == 200, "Fetch bookshelf failed"
    assert any(b["book_id"] == book_id for b in res_shelf.json()), "Added book not found in bookshelf"
    
    # 5. Add to reading history
    print(f"  [+] Recording reading history for Book #{book_id}...")
    res_hist_add = requests.post(f"{BACKEND_URL}/api/history/add", json={"book_id": book_id, "last_chapter": "Chương 2"}, headers=headers)
    print(f"      Response: {res_hist_add.status_code} | {res_hist_add.json()}")
    assert res_hist_add.status_code == 200, "Add to history failed"
    
    # 6. Fetch reading history
    print("  [+] Retrieving reading history...")
    res_hist = requests.get(f"{BACKEND_URL}/api/history", headers=headers)
    print(f"      Response: {res_hist.status_code} | Groups count: {len(res_hist.json())}")
    assert res_hist.status_code == 200, "Fetch history failed"
    
    # 7. Remove from bookshelf
    print(f"  [+] Removing Book #{book_id} from bookshelf...")
    res_remove = requests.post(f"{BACKEND_URL}/api/bookshelf/remove", json={"book_id": book_id}, headers=headers)
    print(f"      Response: {res_remove.status_code} | {res_remove.json()}")
    assert res_remove.status_code == 200, "Remove from bookshelf failed"
    
    print("✅ Books & Bookshelf API Tests Completed successfully!")

if __name__ == "__main__":
    test_books_endpoints()
