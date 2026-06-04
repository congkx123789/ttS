"""
merge_all_books.py
------------------
Gộp tất cả truyện từ các database, loại trùng theo (tên + tác giả),
tổng hợp links, thể loại, số chương, mô tả tốt nhất v.v.

Output:
  - merged_books.json  (đầy đủ)
  - merged_books.csv   (rút gọn)
  - duplicate_report.csv (danh sách truyện xuất hiện ở nhiều nguồn)
"""

import sqlite3, os, json, csv, re, time
from collections import defaultdict

# ──────────────────────────────────────────
# Cấu hình nguồn dữ liệu
# ──────────────────────────────────────────
SOURCES = [
    {
        "name": "Ixdzs",
        "db":   "ixdzs_books.db",
        "table": "ixdzs_novels",
        "status_col": "status",
        "status_val": "Parsed",
        "fields": {
            "id": "id", "url": "url", "title": "title", "author": "author",
            "category": "category", "chapters": "chapters",
            "cover": None, "description": None, "word_count": None,
        }
    },
    {
        "name": "Biquge",
        "db":   "bqg_books.db",
        "table": "bqg_novels",
        "status_col": "crawl_status",
        "status_val": "Parsed",
        "fields": {
            "id": "id", "url": "url", "title": "title", "author": "author",
            "category": "category", "chapters": "chapters",
            "cover": "cover", "description": "description", "word_count": None,
        }
    },
    {
        "name": "41nr",
        "db":   "nr41_books.db",
        "table": "nr41_novels",
        "status_col": "crawl_status",
        "status_val": "Parsed",
        "fields": {
            "id": "id", "url": "url", "title": "title", "author": "author",
            "category": "category", "chapters": None,
            "cover": "cover", "description": "description", "word_count": None,
        }
    },
    {
        "name": "Quanben",
        "db":   "quanben_books.db",
        "table": "quanben_novels",
        "status_col": "status",
        "status_val": "Parsed",
        "fields": {
            "id": "slug", "url": "url", "title": "title", "author": "author",
            "category": "category", "chapters": "chapters",
            "cover": None, "description": None, "word_count": None,
        }
    },
    {
        "name": "Faloo",
        "db":   "faloo_books.db",
        "table": "faloo_novels",
        "status_col": "status",
        "status_val": "Parsed",
        "fields": {
            "id": "id", "url": "url", "title": "title", "author": "author",
            "category": "category", "chapters": "chapters",
            "cover": None, "description": None, "word_count": "word_count",
        }
    },
    {
        "name": "Fanqie",
        "db":   "fanqie_books.db",
        "table": "fanqie_novels",
        "status_col": "status",
        "status_val": "Parsed",
        "fields": {
            "id": "id", "url": "url", "title": "title", "author": "author",
            "category": "category", "chapters": "chapters",
            "cover": "cover", "description": "description", "word_count": "word_count",
        }
    },
    {
        "name": "Hjwzw",
        "db":   "hjwzw_books.db",
        "table": "hjwzw_novels",
        "status_col": "status",
        "status_val": "Parsed",
        "fields": {
            "id": "id", "url": "url", "title": "title", "author": "author",
            "category": None, "chapters": None,
            "cover": None, "description": None, "word_count": None,
        }
    },
]

def normalize(text):
    """Chuẩn hoá chuỗi để so sánh (bỏ khoảng trắng, chữ thường)."""
    if not text:
        return ""
    return re.sub(r"\s+", "", text.strip()).lower()

def load_source(src):
    """Đọc toàn bộ truyện đã Parsed từ một nguồn. Trả về list dict."""
    db = src["db"]
    if not os.path.exists(db):
        print(f"  [!] Bỏ qua {src['name']}: không tìm thấy {db}")
        return []

    conn = sqlite3.connect(db)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # Build SELECT list từ fields mapping
    f = src["fields"]
    select_parts = []
    for logical, col in f.items():
        if col:
            select_parts.append(f'"{col}" as {logical}')
        else:
            select_parts.append(f'NULL as {logical}')

    query = (
        f"SELECT {', '.join(select_parts)} "
        f"FROM {src['table']} "
        f"WHERE {src['status_col']} = ?"
    )
    cursor.execute(query, (src["status_val"],))
    rows = cursor.fetchall()
    conn.close()

    result = []
    for row in rows:
        result.append({
            "source":      src["name"],
            "id":          row["id"],
            "url":         row["url"] or "",
            "title":       (row["title"] or "").strip(),
            "author":      (row["author"] or "").strip(),
            "category":    (row["category"] or "").strip(),
            "chapters":    row["chapters"] if row["chapters"] is not None else 0,
            "cover":       row["cover"] or "",
            "description": row["description"] or "",
            "word_count":  row["word_count"] if row["word_count"] is not None else 0,
        })
    return result

def merge_all():
    print("=" * 60)
    print("  GỘP DỮ LIỆU TẤT CẢ CÁC NGUỒN TRUYỆN")
    print("=" * 60)

    # key = (title_norm, author_norm)  →  merged record
    merged = {}
    total_raw = 0

    for src in SOURCES:
        t0 = time.time()
        books = load_source(src)
        total_raw += len(books)
        print(f"  Đã tải {src['name']}: {len(books):,} truyện  ({time.time()-t0:.1f}s)")

        for b in books:
            title_norm  = normalize(b["title"])
            author_norm = normalize(b["author"])
            key = (title_norm, author_norm)

            if not title_norm:          # bỏ qua record không có tên
                continue

            if key not in merged:
                merged[key] = {
                    # Tên chuẩn (lấy từ bản ghi đầu tiên gặp)
                    "title":            b["title"],
                    "author":           b["author"],

                    # Danh sách nguồn (tên site)
                    "sources":          [],

                    # Dict { "SiteName": "url" }
                    "urls":             {},

                    # Thể loại: set → list (không trùng)
                    "categories":       set(),

                    # Số chương: lấy max
                    "chapters_max":     0,
                    "chapters_max_source": "",

                    # Ảnh bìa (lấy cái đầu tiên có)
                    "cover":            "",

                    # Mô tả (lấy cái dài nhất)
                    "description":      "",

                    # Số từ (lấy max)
                    "word_count_max":   0,
                    "word_count_max_source": "",

                    # Số lần xuất hiện qua các nguồn
                    "site_count": 0,
                }

            rec = merged[key]

            # Cập nhật nguồn
            if b["source"] not in rec["sources"]:
                rec["sources"].append(b["source"])
                rec["site_count"] += 1

            # URL theo từng site (mỗi site chỉ lưu 1 URL)
            if b["source"] not in rec["urls"] and b["url"]:
                rec["urls"][b["source"]] = b["url"]

            # Thể loại
            if b["category"]:
                rec["categories"].add(b["category"])

            # Số chương → lấy max
            ch = b["chapters"] or 0
            if ch > rec["chapters_max"]:
                rec["chapters_max"] = ch
                rec["chapters_max_source"] = b["source"]

            # Ảnh bìa (lấy cái đầu tiên có)
            if not rec["cover"] and b["cover"]:
                rec["cover"] = b["cover"]

            # Mô tả (lấy cái dài nhất)
            if len(b["description"]) > len(rec["description"]):
                rec["description"] = b["description"]

            # Số từ → max
            wc = b["word_count"] or 0
            if wc > rec["word_count_max"]:
                rec["word_count_max"] = wc
                rec["word_count_max_source"] = b["source"]

    print(f"\nTổng bản ghi thô: {total_raw:,}")
    print(f"Sau khi gộp (unique title+author): {len(merged):,}")

    # Chuyển categories từ set → list
    for rec in merged.values():
        rec["categories"] = list(rec["categories"])
        rec["urls_str"]    = " | ".join(
            f"{site}: {url}" for site, url in rec["urls"].items()
        )
        rec["sources_str"] = ", ".join(rec["sources"])
        rec["categories_str"] = ", ".join(rec["categories"])

    records = list(merged.values())
    # Sắp xếp: truyện xuất hiện nhiều nguồn nhất trước
    records.sort(key=lambda x: (-x["site_count"], x["title"]))

    # ── Xuất JSON ──
    print("\nĐang xuất merged_books.json ...")
    json_out = []
    for r in records:
        json_out.append({
            "title":              r["title"],
            "author":             r["author"],
            "site_count":         r["site_count"],
            "sources":            r["sources"],
            "urls":               r["urls"],
            "categories":         r["categories"],
            "chapters_max":       r["chapters_max"],
            "chapters_max_source": r["chapters_max_source"],
            "cover":              r["cover"],
            "description":        r["description"],
            "word_count_max":     r["word_count_max"],
            "word_count_max_source": r["word_count_max_source"],
        })
    with open("merged_books.json", "w", encoding="utf-8") as f:
        json.dump(json_out, f, ensure_ascii=False, indent=2)
    print(f"  → Đã ghi {len(json_out):,} bản ghi vào merged_books.json")

    # ── Xuất CSV rút gọn ──
    print("Đang xuất merged_books.csv ...")
    csv_headers = [
        "Title", "Author", "SiteCount", "Sources",
        "URLs", "Categories",
        "ChaptersMax", "ChaptersMaxSource",
        "Cover", "WordCountMax", "WordCountMaxSource",
        "Description",
    ]
    with open("merged_books.csv", "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(csv_headers)
        for r in records:
            writer.writerow([
                r["title"], r["author"], r["site_count"],
                r["sources_str"], r["urls_str"], r["categories_str"],
                r["chapters_max"], r["chapters_max_source"],
                r["cover"], r["word_count_max"], r["word_count_max_source"],
                r["description"][:500] if r["description"] else "",
            ])
    print(f"  → Đã ghi {len(records):,} bản ghi vào merged_books.csv")

    # ── Xuất báo cáo trùng lặp ──
    print("Đang xuất duplicate_report.csv ...")
    duplicates = [r for r in records if r["site_count"] > 1]
    duplicates.sort(key=lambda x: -x["site_count"])
    with open("duplicate_report.csv", "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["Title", "Author", "SiteCount", "Sources", "URLs", "ChaptersMax", "ChaptersMaxSource"])
        for r in duplicates:
            writer.writerow([
                r["title"], r["author"], r["site_count"],
                r["sources_str"], r["urls_str"],
                r["chapters_max"], r["chapters_max_source"],
            ])
    print(f"  → {len(duplicates):,} truyện xuất hiện ở nhiều nguồn → duplicate_report.csv")

    # ── Thống kê nhanh ──
    print()
    print("=" * 60)
    print("  THỐNG KÊ TỔNG HỢP")
    print("=" * 60)
    by_site = defaultdict(int)
    for r in records:
        for s in r["sources"]:
            by_site[s] += 1
    for site, cnt in sorted(by_site.items(), key=lambda x: -x[1]):
        print(f"  {site:<12}: {cnt:>10,} truyện unique")
    print()
    cnt_dist = defaultdict(int)
    for r in records:
        cnt_dist[r["site_count"]] += 1
    for k in sorted(cnt_dist):
        label = f"Có ở {k} nguồn"
        print(f"  {label:<20}: {cnt_dist[k]:>10,} truyện")
    print()
    print(f"  Tổng unique (title+author): {len(records):,}")
    print("=" * 60)

if __name__ == "__main__":
    t_start = time.time()
    merge_all()
    print(f"\nHoàn thành trong {time.time()-t_start:.1f} giây.")
