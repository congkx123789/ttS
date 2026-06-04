import sqlite3

DB_PATH = "fanqie_books.db"

def reset_invalid():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("UPDATE fanqie_novels SET status = 'Pending' WHERE status = 'Invalid'")
    print(f"Đã chuyển {cursor.rowcount} truyện từ trạng thái 'Invalid' về 'Pending'.")
    conn.commit()
    conn.close()

if __name__ == "__main__":
    reset_invalid()
