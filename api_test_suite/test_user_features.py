import requests
import random
from config import BACKEND_URL

def test_user_features():
    print("\n⚙️ Running User Features (History, Vocabulary, Settings) Tests...")
    
    rand_id = random.randint(100000, 999999)
    username = f"feat_user_{rand_id}"
    email = f"feat_user_{rand_id}@example.com"
    password = f"secret_pass_{rand_id}"
    
    # Register and login to test user features
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
    
    # 1. Translation History
    print("  [+] Adding translation history entry...")
    res_hist_add = requests.post(f"{BACKEND_URL}/api/user/history", json={
        "original_text": "你好",
        "translated_text": "Xin chào",
        "mode": "fast"
    }, headers=headers)
    print(f"      Response: {res_hist_add.status_code} | {res_hist_add.json()}")
    assert res_hist_add.status_code == 200, "Failed to add translation history"
    
    print("  [+] Fetching translation history list...")
    res_hist_get = requests.get(f"{BACKEND_URL}/api/user/history", headers=headers)
    print(f"      Response: {res_hist_get.status_code} | Entries: {len(res_hist_get.json().get('history', []))}")
    assert res_hist_get.status_code == 200, "Failed to fetch translation history"
    assert len(res_hist_get.json().get("history", [])) == 1, "Expected exactly 1 translation history entry"
    
    # 2. Vocabulary/Word Notebook
    print("  [+] Saving word to vocabulary notebook...")
    res_vocab_add = requests.post(f"{BACKEND_URL}/api/user/vocabulary", json={
        "original_text": "修真",
        "translation": "Tu chân",
        "pinyin_or_hanviet": "xiū zhēn",
        "context_sentence": "主角踏上了修真之路。",
        "notes": "Quan trọng trong tiểu thuyết tiên hiệp"
    }, headers=headers)
    print(f"      Response: {res_vocab_add.status_code} | {res_vocab_add.json()}")
    assert res_vocab_add.status_code == 200, "Failed to add word to vocabulary"
    
    print("  [+] Fetching vocabulary notebook list...")
    res_vocab_get = requests.get(f"{BACKEND_URL}/api/user/vocabulary", headers=headers)
    vocab_items = res_vocab_get.json().get("vocabulary", [])
    print(f"      Response: {res_vocab_get.status_code} | Words: {len(vocab_items)}")
    assert res_vocab_get.status_code == 200, "Failed to fetch vocabulary"
    assert len(vocab_items) == 1, "Expected exactly 1 vocabulary item"
    
    item_id = vocab_items[0]["id"]
    
    # 3. Personalization Settings
    print("  [+] Fetching user settings...")
    res_settings_get = requests.get(f"{BACKEND_URL}/api/user/settings", headers=headers)
    print(f"      Response: {res_settings_get.status_code} | Theme: {res_settings_get.json().get('settings', {}).get('theme')}")
    assert res_settings_get.status_code == 200, "Failed to fetch settings"
    
    print("  [+] Updating user settings...")
    res_settings_post = requests.post(f"{BACKEND_URL}/api/user/settings", json={
        "theme": "light",
        "default_language": "vi",
        "auto_read": 1,
        "font_size": 18
    }, headers=headers)
    print(f"      Response: {res_settings_post.status_code} | {res_settings_post.json()}")
    assert res_settings_post.status_code == 200, "Failed to update settings"
    
    # Re-fetch settings to verify update
    res_settings_get2 = requests.get(f"{BACKEND_URL}/api/user/settings", headers=headers)
    theme = res_settings_get2.json().get("settings", {}).get("theme")
    print(f"      Verified Theme: {theme} (expected: light)")
    assert theme == "light", "Settings theme did not update correctly"
    
    # 4. Clean up Vocabulary & History
    print(f"  [+] Deleting word #{item_id} from vocabulary notebook...")
    res_vocab_del = requests.delete(f"{BACKEND_URL}/api/user/vocabulary/{item_id}", headers=headers)
    print(f"      Response: {res_vocab_del.status_code} | {res_vocab_del.json()}")
    assert res_vocab_del.status_code == 200, "Failed to delete vocabulary item"
    
    print("  [+] Clearing all translation history...")
    res_hist_clear = requests.delete(f"{BACKEND_URL}/api/user/history", headers=headers)
    print(f"      Response: {res_hist_clear.status_code} | {res_hist_clear.json()}")
    assert res_hist_clear.status_code == 200, "Failed to clear translation history"
    
    print("✅ User Features Tests Completed successfully!")

if __name__ == "__main__":
    test_user_features()
