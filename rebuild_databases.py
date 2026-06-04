import os
import sys
import re
import sqlite3
import time
import shutil
from multiprocessing import Pool, cpu_count

# Add quick_translator to path
sys.path.append("/home/alida/Documents/Tool translate CHinese/quick_translator")
from src.engine import VietphraseEngine

db_path = "/home/alida/Documents/Tool translate CHinese/merged_books.db"

# Global dictionary for worker processes
global_engines = {}

def init_worker():
    global global_engines
    # Initialize engines for the worker
    global_engines['advanced'] = VietphraseEngine(config={"translation": {"mode": "advanced"}})
    global_engines['fast'] = VietphraseEngine(config={"translation": {"mode": "fast"}})
    global_engines['vietphrase'] = VietphraseEngine(config={"translation": {"mode": "vietphrase"}})
    global_engines['hanviet'] = VietphraseEngine(config={"translation": {"mode": "hanviet"}})

def to_hanviet(char_dict, text):
    if not text:
        return ""
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

def process_chunk(chunk):
    # chunk is a list of tuples: (id, title, author, description)
    results = []
    char_dict = global_engines['advanced'].char_dict
    
    for row_id, title, author, description in chunk:
        # Translate author (HanViet)
        author_hv = to_hanviet(char_dict, author)
        
        # Translate title/description for advanced mode
        title_adv = global_engines['advanced'].translate(title)
        desc_adv = global_engines['advanced'].translate(description) if description else ""
        
        # Translate title/description for fast mode
        title_fst = global_engines['fast'].translate(title)
        desc_fst = global_engines['fast'].translate(description) if description else ""
        
        # Translate title/description for vietphrase mode
        title_vp = global_engines['vietphrase'].translate(title)
        desc_vp = global_engines['vietphrase'].translate(description) if description else ""
        
        # Translate title/description for hanviet mode
        title_hv_mode = global_engines['hanviet'].translate(title)
        desc_hv_mode = global_engines['hanviet'].translate(description) if description else ""
        
        # Word-to-word HanViet for title and description
        title_hv = to_hanviet(char_dict, title)
        desc_hv = to_hanviet(char_dict, description) if description else ""
        
        results.append({
            'id': row_id,
            'author_hanviet': author_hv,
            'title_hanviet': title_hv,
            'description_hanviet': desc_hv,
            'advanced': (title_adv, desc_adv),
            'fast': (title_fst, desc_fst),
            'vietphrase': (title_vp, desc_vp),
            'hanviet': (title_hv_mode, desc_hv_mode)
        })
    return results

def main():
    t_start = time.time()
    
    # 1. Create database copies
    print("Creating copies of database...")
    db_adv = "/home/alida/Documents/Tool translate CHinese/merged_books_advanced.db"
    db_fst = "/home/alida/Documents/Tool translate CHinese/merged_books_fast.db"
    db_vp  = "/home/alida/Documents/Tool translate CHinese/merged_books_vietphrase.db"
    db_hv  = "/home/alida/Documents/Tool translate CHinese/merged_books_hanviet.db"
    
    shutil.copy(db_path, db_adv)
    shutil.copy(db_path, db_fst)
    shutil.copy(db_path, db_vp)
    shutil.copy(db_path, db_hv)
    
    # 2. Add columns to all 4 databases
    print("Preparing table columns in the databases...")
    for db_file in [db_adv, db_fst, db_vp, db_hv]:
        conn = sqlite3.connect(db_file)
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(books)")
        cols = [r[1] for r in cursor.fetchall()]
        
        # Add columns if missing
        if "title_vietphrase" not in cols:
            conn.execute("ALTER TABLE books ADD COLUMN title_vietphrase TEXT")
        if "title_hanviet" not in cols:
            conn.execute("ALTER TABLE books ADD COLUMN title_hanviet TEXT")
        if "author_hanviet" not in cols:
            conn.execute("ALTER TABLE books ADD COLUMN author_hanviet TEXT")
        if "description_vietphrase" not in cols:
            conn.execute("ALTER TABLE books ADD COLUMN description_vietphrase TEXT")
        if "description_hanviet" not in cols:
            conn.execute("ALTER TABLE books ADD COLUMN description_hanviet TEXT")
            
        conn.commit()
        conn.close()

    # 3. Read data from source database
    print("Reading books from source database...")
    conn_src = sqlite3.connect(db_path)
    cursor_src = conn_src.cursor()
    cursor_src.execute("SELECT id, title, author, description FROM books")
    rows = cursor_src.fetchall()
    total_books = len(rows)
    conn_src.close()
    print(f"Total books to process: {total_books:,}")
    
    # Chunking rows
    CHUNK_SIZE = 1000
    chunks = [rows[i:i + CHUNK_SIZE] for i in range(0, total_books, CHUNK_SIZE)]
    print(f"Split into {len(chunks)} chunks.")
    
    # 4. Open destination connections
    conn_adv = sqlite3.connect(db_adv)
    conn_fst = sqlite3.connect(db_fst)
    conn_vp  = sqlite3.connect(db_vp)
    conn_hv  = sqlite3.connect(db_hv)
    
    # Use journal_mode = WAL and synchronous = OFF for high performance writes
    for conn in [conn_adv, conn_fst, conn_vp, conn_hv]:
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA synchronous=OFF")
        
    num_workers = min(cpu_count(), 24)
    print(f"Starting multiprocessing pool with {num_workers} workers...")
    
    processed = 0
    t0 = time.time()
    
    # Process chunks using Pool
    with Pool(processes=num_workers, initializer=init_worker) as pool:
        results_iterator = pool.imap_unordered(process_chunk, chunks)
        
        for chunk_results in results_iterator:
            batch_adv = []
            batch_fst = []
            batch_vp  = []
            batch_hv  = []
            
            for res in chunk_results:
                row_id = res['id']
                author_hv = res['author_hanviet']
                title_hv = res['title_hanviet']
                desc_hv = res['description_hanviet']
                
                title_adv, desc_adv = res['advanced']
                title_fst, desc_fst = res['fast']
                title_vp, desc_vp = res['vietphrase']
                title_hv_mode, desc_hv_mode = res['hanviet']
                
                batch_adv.append((title_adv, title_hv, author_hv, desc_adv, desc_hv, row_id))
                batch_fst.append((title_fst, title_hv, author_hv, desc_fst, desc_hv, row_id))
                batch_vp.append((title_vp, title_hv, author_hv, desc_vp, desc_hv, row_id))
                batch_hv.append((title_hv_mode, title_hv, author_hv, desc_hv_mode, desc_hv, row_id))
                
            # Write to databases
            conn_adv.executemany(
                "UPDATE books SET title_vietphrase=?, title_hanviet=?, author_hanviet=?, description_vietphrase=?, description_hanviet=? WHERE id=?",
                batch_adv
            )
            conn_fst.executemany(
                "UPDATE books SET title_vietphrase=?, title_hanviet=?, author_hanviet=?, description_vietphrase=?, description_hanviet=? WHERE id=?",
                batch_fst
            )
            conn_vp.executemany(
                "UPDATE books SET title_vietphrase=?, title_hanviet=?, author_hanviet=?, description_vietphrase=?, description_hanviet=? WHERE id=?",
                batch_vp
            )
            conn_hv.executemany(
                "UPDATE books SET title_vietphrase=?, title_hanviet=?, author_hanviet=?, description_vietphrase=?, description_hanviet=? WHERE id=?",
                batch_hv
            )
            
            # Commit periodically
            conn_adv.commit()
            conn_fst.commit()
            conn_vp.commit()
            conn_hv.commit()
            
            processed += len(chunk_results)
            elapsed = time.time() - t0
            speed = processed / elapsed if elapsed > 0 else 0
            eta = (total_books - processed) / speed if speed > 0 else 0
            print(f"Processed: {processed:,} / {total_books:,} ({processed/total_books*100:.2f}%) | Speed: {speed:.1f} books/s | ETA: {eta/60:.1f}m")
            
    # Close connections
    conn_adv.close()
    conn_fst.close()
    conn_vp.close()
    conn_hv.close()
    
    print(f"\nAll databases rebuilt and updated successfully in {time.time() - t_start:.2f}s!")

if __name__ == "__main__":
    main()
