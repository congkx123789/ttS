import sqlite3
import sys
import os
import time
import re

# Add quick_translator to path
sys.path.append("/home/alida/Documents/Tool translate CHinese/quick_translator")
from src.engine import VietphraseEngine

db_path = "merged_books.db"

def main():
    t_start = time.time()
    print("Initializing VietphraseEngine...")
    engine = VietphraseEngine()
    char_dict = engine.char_dict
    print(f"Engine loaded in {time.time() - t_start:.2f}s")

    # Connect to SQLite
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Check and add columns if they don't exist
    cursor.execute("PRAGMA table_info(books)")
    columns = [row[1] for row in cursor.fetchall()]
    
    if "title_vietphrase" not in columns:
        print("Adding column title_vietphrase...")
        conn.execute("ALTER TABLE books ADD COLUMN title_vietphrase TEXT")
    if "title_hanviet" not in columns:
        print("Adding column title_hanviet...")
        conn.execute("ALTER TABLE books ADD COLUMN title_hanviet TEXT")
    if "author_hanviet" not in columns:
        print("Adding column author_hanviet...")
        conn.execute("ALTER TABLE books ADD COLUMN author_hanviet TEXT")
    conn.commit()

    # Get total count
    cursor.execute("SELECT COUNT(*) FROM books")
    total = cursor.fetchone()[0]
    print(f"Total books to translate: {total:,}")

    # Helper function for word-to-word translation using HanViet_CharDict
    def to_hanviet(text):
        if not text:
            return "Vô danh" if text is None else ""
        words = []
        tokens = re.findall(r"[a-zA-Z0-9_\-\./%+]+|.", text)
        for tok in tokens:
            if re.match(r"^[a-zA-Z0-9_\-\./%+]+$", tok):
                words.append(tok)
            elif tok.strip():
                val = char_dict.get(tok, tok)
                if "/" in val:
                    val = val.split("/")[0]
                words.append(val.strip().capitalize())
        return " ".join(words)

    # Fetch all records to update
    cursor.execute("SELECT id, title, author FROM books")
    
    # Process in batches
    BATCH_SIZE = 10000
    batch = []
    count = 0
    t0 = time.time()

    while True:
        rows = cursor.fetchmany(BATCH_SIZE)
        if not rows:
            break
            
        update_data = []
        for row in rows:
            row_id, title, author = row
            
            # 1. Translate title (Vietphrase)
            title_vp = engine.translate(title)
            
            # 2. Translate title (HanViet - word-to-word)
            title_hv = to_hanviet(title)
            
            # 3. Translate author (HanViet - word-to-word)
            author_hv = to_hanviet(author)
            
            update_data.append((title_vp, title_hv, author_hv, row_id))
            
        # Execute batch update
        conn.executemany(
            "UPDATE books SET title_vietphrase=?, title_hanviet=?, author_hanviet=? WHERE id=?", 
            update_data
        )
        conn.commit()
        
        count += len(rows)
        elapsed = time.time() - t0
        speed = count / elapsed if elapsed > 0 else 0
        eta = (total - count) / speed if speed > 0 else 0
        print(f"Processed: {count:,} / {total:,} ({count/total*100:.1f}%) | Speed: {speed:.1f} books/s | ETA: {eta/60:.1f}m")

    conn.close()
    print(f"\nCompleted translation updates for {total:,} books in {time.time() - t_start:.2f}s!")

if __name__ == "__main__":
    main()
