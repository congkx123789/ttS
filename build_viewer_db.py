import json, sqlite3, time, os

print("Dang tao merged_books.db tu JSON...")
t0 = time.time()

conn = sqlite3.connect("merged_books.db")
conn.execute("DROP TABLE IF EXISTS books")
conn.execute("""
CREATE TABLE books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    author TEXT,
    site_count INTEGER,
    sources TEXT,
    urls TEXT,
    categories TEXT,
    chapters_max INTEGER,
    chapters_max_source TEXT,
    cover TEXT,
    description TEXT,
    word_count_max INTEGER,
    word_count_max_source TEXT
)
""")
conn.execute("CREATE INDEX idx_title ON books(title)")
conn.execute("CREATE INDEX idx_author ON books(author)")
conn.execute("CREATE INDEX idx_site_count ON books(site_count)")

BATCH = 10000
batch = []
total = 0

print("Loading JSON...")
with open("merged_books.json", encoding="utf-8") as f:
    data = json.load(f)

print("Loaded " + str(len(data)) + " records in " + str(round(time.time()-t0, 1)) + "s")
t1 = time.time()

for b in data:
    urls_str = " | ".join(k + ": " + v for k, v in b.get("urls", {}).items())
    batch.append((
        b.get("title", ""),
        b.get("author", ""),
        b.get("site_count", 1),
        ", ".join(b.get("sources", [])),
        urls_str,
        ", ".join(b.get("categories", [])),
        b.get("chapters_max", 0),
        b.get("chapters_max_source", ""),
        b.get("cover", ""),
        (b.get("description", "") or "")[:500],
        b.get("word_count_max", 0),
        b.get("word_count_max_source", ""),
    ))
    total += 1
    if len(batch) >= BATCH:
        conn.executemany(
            "INSERT INTO books (title,author,site_count,sources,urls,categories,chapters_max,chapters_max_source,cover,description,word_count_max,word_count_max_source) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
            batch
        )
        conn.commit()
        batch = []
        if total % 100000 == 0:
            print("  " + str(total) + " inserted...")

if batch:
    conn.executemany(
        "INSERT INTO books (title,author,site_count,sources,urls,categories,chapters_max,chapters_max_source,cover,description,word_count_max,word_count_max_source) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
        batch
    )
    conn.commit()

conn.close()
size_mb = os.path.getsize("merged_books.db") // 1024 // 1024
print("Xong! " + str(total) + " records -> merged_books.db in " + str(round(time.time()-t1, 1)) + "s")
print("DB size: " + str(size_mb) + " MB")
