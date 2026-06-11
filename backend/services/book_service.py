import re
import math
import unicodedata
from flask import jsonify
from backend.database.db_manager import get_db, query_cache, count_cache

CHINESE_CATEGORY_MAP = {
    "言情穿越": "Ngôn tình Xuyên không",
    "都市小说": "Đô thị",
    "历史军事": "Lịch sử Quân sự",
    "游戏竞技": "Võng du Cạnh tranh",
    "游戏异界": "Dị giới Trò chơi",
    "玄幻奇幻": "Huyền huyễn Kỳ huyễn",
    "武侠仙侠": "Võ hiệp Tiên hiệp",
    "科幻空间": "Khoa huyễn Không gian",
    "悬疑灵异": "Huyền bí Linh dị",
    "耽美纯爱": "Đam mỹ",
    "同人小说": "Đồng nhân",
    "都市": "Đô thị",
    "言情": "Ngôn tình",
    "穿越": "Xuyên không",
    "历史": "Lịch sử",
    "军事": "Quân sự",
    "男生": "Nam sinh",
    "女生": "Nữ sinh",
    "游戏": "Trò chơi",
    "竞技": "Cạnh tranh",
    "玄幻": "Huyền huyễn",
    "奇幻": "Kỳ huyễn",
    "武侠": "Võ hiệp",
    "仙侠": "Tiên hiệp",
    "科幻": "Khoa huyễn",
    "悬疑": "Huyền bí",
    "灵异": "Linh dị",
    "耽美": "Đam mỹ",
    "轻小说": "Light Novel",
    "同人": "Đồng nhân"
}

def translate_categories(categories_str):
    if not categories_str:
        return ""
    parts = re.split(r'[,，/、\s]+', categories_str)
    vi_parts = []
    for p in parts:
        p = p.strip()
        if not p:
            continue
        matched = False
        for zh, vi in CHINESE_CATEGORY_MAP.items():
            if zh in p:
                vi_parts.append(vi)
                matched = True
                break
        if not matched:
            try:
                from backend.services.translation import get_engine
                translated = get_engine().translate(p, multi_option=False)
                vi_parts.append(translated)
            except Exception:
                vi_parts.append(p)
    seen = set()
    unique_parts = []
    for vp in vi_parts:
        if vp not in seen:
            seen.add(vp)
            unique_parts.append(vp)
    return ", ".join(unique_parts)

CHINESE_TO_ENGLISH_CATEGORY_MAP = {
    "言情穿越": "Romance & Time Travel",
    "都市小说": "Urban",
    "历史军事": "History & Military",
    "游戏竞技": "Gaming & Competition",
    "游戏异界": "Gaming & Otherworld",
    "玄幻奇幻": "Xianxia & Fantasy",
    "武侠仙侠": "Wuxia & Xianxia",
    "科幻 space": "Sci-Fi Space",
    "科幻空间": "Sci-Fi & Space",
    "悬疑灵异": "Mystery & Supernatural",
    "耽美纯爱": "Danmei Romance",
    "同人小说": "Fan-fiction",
    "都市": "Urban",
    "言情": "Romance",
    "穿越": "Time Travel",
    "历史": "History",
    "军事": "Military",
    "男生": "Male Protagonist",
    "女生": "Female Protagonist",
    "游戏": "Gaming",
    "竞技": "Competition",
    "玄幻": "Fantasy",
    "奇幻": "Eastern Fantasy",
    "武侠": "Wuxia",
    "仙侠": "Xianxia",
    "科幻": "Sci-Fi",
    "悬疑": "Mystery",
    "灵异": "Supernatural",
    "耽美": "Danmei",
    "轻小说": "Light Novel",
    "同人": "Fan-fiction"
}

def translate_categories_to_english(categories_str):
    if not categories_str:
        return ""
    parts = re.split(r'[,，/、\s]+', categories_str)
    en_parts = []
    for p in parts:
        p = p.strip()
        if not p:
            continue
        matched = False
        for zh, en in CHINESE_TO_ENGLISH_CATEGORY_MAP.items():
            if zh in p:
                en_parts.append(en)
                matched = True
                break
        if not matched:
            en_parts.append(p)
    seen = set()
    unique_parts = []
    for ep in en_parts:
        if ep not in seen:
            seen.add(ep)
            unique_parts.append(ep)
    return ", ".join(unique_parts)

def remove_vietnamese_accents(text):
    if not text:
        return ""
    # Normalize to decompose accents
    nfkd_form = unicodedata.normalize('NFKD', text)
    only_ascii = nfkd_form.encode('ASCII', 'ignore').decode('utf-8')
    return only_ascii

def clean_vietnamese_query(text):
    text = text.replace('đ', 'd').replace('Đ', 'D')
    return "".join(c for c in unicodedata.normalize('NFKD', text) if not unicodedata.combining(c)).lower()

def parse_book_sources(book_dict):
    parsed_sources = []
    raw_urls = book_dict.get("urls", "")
    if raw_urls:
        parts = raw_urls.split(" | ")
        for part in parts:
            if ":" in part:
                subparts = part.split(":", 1)
                src_name = subparts[0].strip()
                src_url = subparts[1].strip()
                if src_url.startswith("//"):
                    src_url = "https:" + src_url
                parsed_sources.append({
                    "source": src_name,
                    "url": src_url
                })
    book_dict["parsed_sources"] = parsed_sources
    
    # Dịch thể loại sang tiếng Việt và tiếng Anh
    book_dict["categories_vietphrase"] = translate_categories(book_dict.get("categories", ""))
    book_dict["categories_english"] = translate_categories_to_english(book_dict.get("categories", ""))
    
    # Sinh tên tác giả tiếng Anh (Hán Việt không dấu)
    author_hv = book_dict.get("author_hanviet", "")
    if author_hv:
        book_dict["author_english"] = remove_vietnamese_accents(author_hv)
    else:
        book_dict["author_english"] = book_dict.get("author", "")

    # Dịch nhanh mô tả (120 ký tự đầu) cho danh sách truyện để tăng hiệu năng tìm kiếm
    desc = book_dict.get("description", "")
    if desc:
        short_desc = desc[:120]
        try:
            from backend.services.translation import get_engine
            book_dict["description_vietphrase"] = get_engine().translate(short_desc, multi_option=False)
        except Exception:
            book_dict["description_vietphrase"] = desc
        
        # Tạo fallback description_english bằng cách bỏ dấu bản Việt hóa
        if book_dict.get("description_vietphrase"):
            book_dict["description_english"] = remove_vietnamese_accents(book_dict["description_vietphrase"])
        else:
            book_dict["description_english"] = desc
    else:
        book_dict["description_vietphrase"] = ""
        book_dict["description_english"] = ""
        
    return book_dict

def search_books(q, category, source, dup, sort, search_field, min_chapters, page, per_page):
    """Business logic for searching books with high-performance FTS5 or LIKE queries."""
    MAX_PAGES_CEILING = 100
    if page > MAX_PAGES_CEILING:
        return {"error": "Deep pagination limit reached. Giới hạn tối đa 100 trang kết quả."}, 400

    # Whitelist sort options
    allowed_sorts = {
        "site_count DESC", "chapters_max DESC", "word_count_max DESC", "title ASC", "title DESC", "id ASC"
    }
    if sort not in allowed_sorts:
        sort = "site_count DESC"

    where, params = [], []
    fts_match_expr = None
    has_chinese = False

    if q:
        has_chinese = any('\u4e00' <= char <= '\u9fff' for char in q)
        if has_chinese:
            pq = "%" + q + "%"
            if search_field == "title":
                where.append("title LIKE ?")
                params.append(pq)
            elif search_field == "author":
                where.append("author LIKE ?")
                params.append(pq)
            elif search_field == "description":
                where.append("description LIKE ?")
                params.append(pq)
            else:
                where.append("(title LIKE ? OR author LIKE ? OR description LIKE ?)")
                params += [pq, pq, pq]
        else:
            q_clean = clean_vietnamese_query(q)
            fts_query = q_clean.replace('"', '').replace("'", '')
            if fts_query:
                if search_field == "title":
                    fts_match_expr = f'title_hanviet_clean:"{fts_query}" OR title_vietphrase_clean:"{fts_query}"'
                elif search_field == "author":
                    fts_match_expr = f'author_hanviet_clean:"{fts_query}"'
                elif search_field == "hanviet":
                    fts_match_expr = f'title_hanviet_clean:"{fts_query}" OR author_hanviet_clean:"{fts_query}"'
                elif search_field == "vietphrase":
                    fts_match_expr = f'title_vietphrase_clean:"{fts_query}"'
                elif search_field == "chinese":
                    where.append("(title LIKE ? OR author LIKE ?)")
                    pq = "%" + q + "%"
                    params += [pq, pq]
                elif search_field == "description":
                    where.append("(description LIKE ? OR description_vietphrase LIKE ? OR description_hanviet LIKE ?)")
                    pq = "%" + q + "%"
                    params += [pq, pq, pq]
                else:
                    fts_match_expr = f'title_hanviet_clean:"{fts_query}" OR title_vietphrase_clean:"{fts_query}" OR author_hanviet_clean:"{fts_query}"'

    if category:
        where.append("categories LIKE ?")
        params.append("%" + category + "%")
    if source:
        where.append("sources LIKE ?")
        params.append("%" + source + "%")
    if dup == "multi":
        where.append("site_count >= 2")
    elif dup == "single":
        where.append("site_count = 1")
    if min_chapters:
        try:
            min_ch_val = int(min_chapters)
            where.append("chapters_max >= ?")
            params.append(min_ch_val)
        except ValueError:
            pass

    where_sql = ("WHERE " + " AND ".join(where)) if where else ""

    if fts_match_expr:
        cache_key = ("fts_search_v2", fts_match_expr, where_sql, page, per_page, tuple(params), sort, q)
        cached_res = query_cache.get(cache_key)
        if cached_res is not None:
            return cached_res, 200

        conn = get_db()
        query = f"""
            SELECT b.*, f.score
            FROM books b
            JOIN (
                SELECT rowid, bm25(books_fts) AS score
                FROM books_fts
                WHERE books_fts MATCH ?
            ) f ON b.id = f.rowid
            {where_sql}
            LIMIT 1000
        """
        rows = conn.execute(query, [fts_match_expr] + params).fetchall()

        if not rows:
            res_data = {"total": 0, "page": 1, "pages": 1, "books": []}
            query_cache.set(cache_key, res_data)
            return res_data, 200

        scores = [r['score'] for r in rows]
        best_score = min(scores)
        threshold = best_score * 0.28

        has_accents = any(c != clean_vietnamese_query(c) for c in q)

        def clean_text_for_tier(txt):
            if not txt:
                return ""
            txt = txt.replace('đ', 'd').replace('Đ', 'D')
            txt = "".join(c for c in unicodedata.normalize('NFKD', txt) if not unicodedata.combining(c)).lower()
            return " ".join(re.sub(r'[^a-z0-9\s]', ' ', txt).split())

        q_clean_tier = clean_text_for_tier(q)
        q_norm = q.lower().strip()

        def get_tier(book):
            t_hv_clean = clean_text_for_tier(book.get('title_hanviet', ''))
            t_vp_clean = clean_text_for_tier(book.get('title_vietphrase', ''))
            if t_hv_clean == q_clean_tier or t_vp_clean == q_clean_tier:
                return 1
            if t_hv_clean.startswith(q_clean_tier) or t_vp_clean.startswith(q_clean_tier):
                return 2
            if q_clean_tier in t_hv_clean or q_clean_tier in t_vp_clean:
                return 3
            return 4

        filtered_books = []
        for r in rows:
            book_dict = dict(r)
            tier = get_tier(book_dict)
            score = book_dict['score']

            if has_accents:
                t_hv = (book_dict.get('title_hanviet') or '').lower()
                t_vp = (book_dict.get('title_vietphrase') or '').lower()
                auth = (book_dict.get('author_hanviet') or '').lower()
                desc = (book_dict.get('description') or '').lower()
                if q_norm not in t_hv and q_norm not in t_vp and q_norm not in auth and q_norm not in desc:
                    continue

            if tier in (3, 4) and score > threshold:
                continue

            book_dict['tier'] = tier
            filtered_books.append(book_dict)

        if sort == "title ASC":
            filtered_books.sort(key=lambda x: (x.get('title_hanviet') or '').lower())
        elif sort == "title DESC":
            filtered_books.sort(key=lambda x: (x.get('title_hanviet') or '').lower(), reverse=True)
        elif sort == "chapters_max DESC":
            filtered_books.sort(key=lambda x: x.get('chapters_max') or 0, reverse=True)
        elif sort == "word_count_max DESC":
            filtered_books.sort(key=lambda x: x.get('word_count_max') or 0, reverse=True)
        else:
            filtered_books.sort(key=lambda x: (x['tier'], x['score'], -x['site_count']))

        total = len(filtered_books)
        pages = max(1, math.ceil(total / per_page))
        offset = (page - 1) * per_page
        books_page = [parse_book_sources(b) for b in filtered_books[offset : offset + per_page]]

        res_data = {"total": total, "page": page, "pages": pages, "books": books_page}
        query_cache.set(cache_key, res_data)
        return res_data, 200

    else:
        order_by_sql = sort
        order_params = []
        if q and has_chinese:
            order_by_sql = f"""
                CASE 
                    WHEN title = ? THEN 1
                    WHEN title LIKE ? THEN 2
                    ELSE 3
                END ASC, {sort}
            """
            order_params = [q, q + "%"]

        cache_key = (where_sql, order_by_sql, page, per_page, tuple(params), tuple(order_params))
        cached_res = query_cache.get(cache_key)
        if cached_res is not None:
            return cached_res, 200

        count_cache_key = (where_sql, tuple(params))
        total = count_cache.get(count_cache_key)
        if total is None:
            conn = get_db()
            total = conn.execute(
                "SELECT COUNT(*) FROM books " + where_sql, params
            ).fetchone()[0]
            count_cache.set(count_cache_key, total)

        pages = max(1, math.ceil(total / per_page))
        if pages > MAX_PAGES_CEILING:
            pages = MAX_PAGES_CEILING
            total = min(total, MAX_PAGES_CEILING * per_page)

        offset = (page - 1) * per_page

        conn = get_db()
        rows = conn.execute(
            "SELECT * FROM books " + where_sql +
            " ORDER BY " + order_by_sql +
            " LIMIT ? OFFSET ?",
            params + order_params + [per_page, offset]
        ).fetchall()

        books = [parse_book_sources(dict(r)) for r in rows]
        res_data = {"total": total, "page": page, "pages": pages, "books": books}
        query_cache.set(cache_key, res_data)
        return res_data, 200
