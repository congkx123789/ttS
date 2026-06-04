"""
clean_merged_books.py
Tự động phát hiện và sửa tất cả lỗi dữ liệu trong merged_books.db
"""
import sqlite3, re
from html import unescape

conn = sqlite3.connect("merged_books.db")
conn.row_factory = sqlite3.Row
c = conn.cursor()

c.execute("SELECT COUNT(*) FROM books")
total = c.fetchone()[0]
print(f"Tổng bản ghi ban đầu: {total:,}")

def clean_author_field(a):
    if not a:
        return "佚名"
    
    # 1. Decode HTML entities first
    for _ in range(3):
        new = unescape(a)
        if new == a:
            break
        a = new

    # 2. Split by ">" if it contains name">name or similar broken HTML structure
    if '">' in a:
        parts = a.split('">')
        if len(parts) > 1:
            p0 = parts[0].strip()
            p1 = parts[1].strip()
            if p0 == p1:
                a = p0
            else:
                a = p0

    # 3. Strip common prefix/suffix garbage
    a = re.sub(r"(?i)作者\s*[：:]\s*[>/\s]*", "", a)
    a = re.sub(r"(?i)^[>/\s]+", "", a)
    a = re.sub(r"(?i)[>/\s]+$", "", a)
    
    # 4. If it contains table code or HTML tag fragments like /td, th, tr
    if "td" in a.lower() or "th" in a.lower() or "tr" in a.lower():
        if re.search(r"/[a-z]+|[a-z]+/", a, re.IGNORECASE) or "<" in a or ">" in a:
            return "佚名"
            
    # 5. If author contains self-promotion, extract the actual author name
    if "新书" in a or "望支持" in a:
        m = re.search(r"作者\s*[：:]\s*([^\s\w]+|\w+)", a)
        if m:
            a = m.group(1)
        else:
            # extract last part of string
            parts = a.split()
            if parts:
                a = re.sub(r"[^\w\s]", "", parts[-1])
            
    # 6. Fix &amp; or multiple &amp;amp;
    a = re.sub(r"&amp;+", "&", a)
    a = re.sub(r"&#[a-zA-Z0-9\.]*$", "", a)
    a = re.sub(r"&[a-zA-Z0-9\.]*$", "", a)

    # 7. Strip trailing/leading symbols
    a = re.sub(r"^[<>]+", "", a)
    a = re.sub(r"[<>]+$", "", a)

    a = a.strip()
    if not a or len(a) <= 1 or a == "作者" or a == "未知":
        return "佚名"
    return a

# ───── Utility ─────
def clean_text(text, field="general"):
    if not text:
        if field == "author":
            return "佚名"
        return ""

    if field == "author":
        return clean_author_field(text)

    # 1. Decode HTML entities (including double-encoded)
    t = text
    for _ in range(3):
        new = unescape(t)
        if new == t:
            break
        t = new

    # 2. Strip itemprop garbage in author/title
    t = re.sub(r"(?i)lt;font itemprop=.*$", "", t)
    t = re.sub(r"(?i)font itemprop=.*$", "", t)
    t = re.sub(r"(?i)itemprop=.*$", "", t)
    t = re.sub(r"(?i)&lt;font itemprop=.*$", "", t)
    t = re.sub(r"(?i)itemprop.*$", "", t)

    # 3. Strip leftover HTML tags (like <span>, <font>, etc.)
    t = re.sub(r"<[^>]*>", "", t)

    # 4. Remove trailing incomplete entity fragments, dots, or broken code at end
    t = re.sub(r"&#\.*$", "", t)
    t = re.sub(r"&amp;#\.*$", "", t)
    t = re.sub(r"&\.*$", "", t)
    t = re.sub(r"&#[a-zA-Z0-9\.]*$", "", t)
    t = re.sub(r"&[a-zA-Z0-9\.]*$", "", t)

    # 5. Remove leading/trailing < or >
    t = re.sub(r"^[<>]+", "", t)
    t = re.sub(r"[<>]+$", "", t)

    # 6. Remove newlines, tabs, multiple spaces
    t = re.sub(r"[\r\n\t]+", " ", t)
    t = re.sub(r"\s{2,}", " ", t)

    # 7. Strip 《》 book-title markers from title field (keep content)
    if field == "title":
        t = re.sub(r"^《\s*", "", t)
        t = re.sub(r"\s*》$", "", t)
        # Remove trailing extra text like "\txt 肉泥酱"
        t = re.sub(r"\s*\\txt\s.*$", "", t)

    # 8. Remove remaining &lt; &gt; &amp;
    t = t.replace("&lt;", "").replace("&gt;", "").replace("&amp;", "&")
    t = t.replace("&quot;", '"').replace("&apos;", "'")

    t = t.strip()
    if not t:
        return ""
    return t

# ───── Fetch all rows ─────
c.execute("SELECT id, title, author, description FROM books")
rows = c.fetchall()

updates = 0
to_delete = []

batch = []
for row in rows:
    row_id, title, author, desc = row["id"], row["title"], row["author"], row["description"]

    new_title  = clean_text(title, "title")
    new_author = clean_text(author, "author")
    new_desc   = clean_text(desc, "description")

    # Mark for deletion: title too short (≤1 char) after cleaning
    if len(new_title) <= 1:
        to_delete.append(row_id)
        continue

    if new_title != title or new_author != author or new_desc != desc:
        batch.append((new_title, new_author, new_desc, row_id))
        updates += 1

    if len(batch) >= 5000:
        c.executemany("UPDATE books SET title=?, author=?, description=? WHERE id=?", batch)
        conn.commit()
        batch = []

if batch:
    c.executemany("UPDATE books SET title=?, author=?, description=? WHERE id=?", batch)
    conn.commit()

print(f"Đã sửa: {updates:,} bản ghi")
print(f"Sẽ xóa (tên quá ngắn/rỗng sau khi làm sạch): {len(to_delete)}")

# Delete if confirmed
if to_delete:
    c.execute("DELETE FROM books WHERE id IN (" + ",".join("?"*len(to_delete)) + ")", to_delete)
    conn.commit()
    print(f"Đã xóa {len(to_delete)} bản ghi không hợp lệ.")

# ───── Final scan ─────
print("\n=== KIỂM TRA LẠI SAU KHI SỬA ===")

c.execute("SELECT id, title, author FROM books")
all_rows = c.fetchall()

html_tags_errors = 0
html_entities_errors = 0
newline_tab_errors = 0
short_title_errors = 0
itemprop_errors = 0
empty_author_errors = 0

for r in all_rows:
    t, a = r["title"], r["author"]
    
    # Check for real HTML tags like <span> or trailing/leading < or >
    if re.search(r"<[a-zA-Z/]+>", t) or re.search(r"<[a-zA-Z/]+>", a) or t.startswith("<") or t.endswith("<") or t.startswith(">") or t.endswith(">") or a.startswith("<") or a.endswith("<") or a.startswith(">") or a.endswith(">"):
        html_tags_errors += 1
        
    if "&#" in t or "&#" in a or "&amp;" in t or "&amp;" in a:
        html_entities_errors += 1
        
    if "\n" in t or "\r" in t or "\t" in t:
        newline_tab_errors += 1
        
    if len(t) <= 1:
        short_title_errors += 1
        
    if "itemprop" in t or "itemprop" in a:
        itemprop_errors += 1
        
    if not a or a == "" or a == "未知":
        empty_author_errors += 1

print(f"  HTML tags (<,>)          : {'✅ OK' if html_tags_errors == 0 else f'[!] {html_tags_errors}'}")
print(f"  HTML entities (&)        : {'✅ OK' if html_entities_errors == 0 else f'[!] {html_entities_errors}'}")
print(f"  Newline/Tab              : {'✅ OK' if newline_tab_errors == 0 else f'[!] {newline_tab_errors}'}")
print(f"  Tên ≤1 ký tự             : {'✅ OK' if short_title_errors == 0 else f'[!] {short_title_errors}'}")
print(f"  itemprop                 : {'✅ OK' if itemprop_errors == 0 else f'[!] {itemprop_errors}'}")
print(f"  Tác giả trống            : {'✅ OK' if empty_author_errors == 0 else f'[!] {empty_author_errors}'}")

c.execute("SELECT COUNT(*) FROM books")
final_total = c.fetchone()[0]
print(f"\nTổng sau khi làm sạch: {final_total:,}")
if html_tags_errors == 0 and html_entities_errors == 0 and newline_tab_errors == 0 and short_title_errors == 0 and itemprop_errors == 0 and empty_author_errors == 0:
    print("✅ Dữ liệu đã hoàn toàn sạch!")
conn.close()
