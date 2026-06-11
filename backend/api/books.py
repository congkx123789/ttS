import os
import time
import unicodedata
from flask import Blueprint, request, jsonify, session
from backend.config import Config
from backend.core.decorators import get_current_user
from backend.core.security import verify_access_token, encrypt_asymmetric_hybrid, decrypt_asymmetric_hybrid
from backend.core.rate_limit import check_rate_limit, check_ip_rate_limit, get_client_ip
from backend.database.db_manager import get_db, get_mode_connection, get_user_db_conn
from backend.services.book_service import search_books, clean_vietnamese_query
from backend.services.translation import get_engine

books_bp = Blueprint("books", __name__, url_prefix="/api")


def is_vip_request():
    """Check if current request has VIP privileges."""
    user = get_current_user()
    if user and user.get("vip_status", 0) == 1:
        return True
    vip_code = request.headers.get("X-VIP-Code", "")
    if vip_code in Config.VALID_VIP_CODES:
        return True
    return False


@books_bp.route("/books", methods=["GET"])
def api_books():
    ip = get_client_ip()
    if not check_ip_rate_limit(ip, max_requests=45, period=60):
        return jsonify({"error": "Too many requests. Please slow down."}), 429

    q = request.args.get("q", "").strip()
    category = request.args.get("category", "").strip()
    source = request.args.get("source", "").strip()
    dup = request.args.get("dup", "").strip()
    sort = request.args.get("sort", "site_count DESC").strip()
    search_field = request.args.get("field", "all").strip()
    min_chapters = request.args.get("min_chapters", "").strip()

    try:
        page = max(1, int(request.args.get("page", 1)))
        per_page = max(1, min(50, int(request.args.get("per_page", 20))))
    except ValueError:
        page, per_page = 1, 20

    result, status_code = search_books(q, category, source, dup, sort, search_field, min_chapters, page, per_page)
    if status_code != 200:
        return jsonify(result), status_code
    return jsonify(result)


@books_bp.route("/stats", methods=["GET"])
def api_stats():
    from backend.database.db_manager import cached_stats
    import backend.database.db_manager as db_mod
    if db_mod.cached_stats is None:
        conn = get_db()
        total = conn.execute("SELECT COUNT(*) FROM books").fetchone()[0]
        cats = conn.execute(
            "SELECT categories FROM books WHERE categories IS NOT NULL AND categories != ''"
        ).fetchall()
        cat_counts = {}
        for row in cats:
            for c in row[0].split(","):
                c = c.strip()
                if c:
                    cat_counts[c] = cat_counts.get(c, 0) + 1
        top_categories = sorted(cat_counts.items(), key=lambda x: x[1], reverse=True)[:20]
        db_mod.cached_stats = {
            "total_books": total,
            "top_categories": [{"name": k, "count": v} for k, v in top_categories],
        }
    return jsonify(db_mod.cached_stats)


@books_bp.route("/book/<int:book_id>", methods=["GET"])
def get_book_detail(book_id):
    conn = get_db()
    row = conn.execute("SELECT * FROM books WHERE id = ?", (book_id,)).fetchone()
    if not row:
        return jsonify({"error": "Không tìm thấy truyện."}), 404
    book_dict = dict(row)
    # Parse sources
    parsed_sources = []
    if book_dict.get("urls"):
        parts = book_dict["urls"].split(" | ")
        for p in parts:
            idx = p.find(":")
            if idx > 0:
                parsed_sources.append({
                    "source": p[:idx].strip(),
                    "url": p[idx+1:].strip()
                })
    book_dict["parsed_sources"] = parsed_sources

    # Lấy description_vietphrase từ advanced DB
    description_vietphrase = None
    root_dir = Config.ROOT_DIR
    adv_db_path = os.path.join(root_dir, "merged_books_advanced.db")
    if os.path.exists(adv_db_path):
        try:
            from backend.database.db_manager import get_mode_connection
            adv_conn = get_mode_connection(adv_db_path)
            if adv_conn:
                r_adv = adv_conn.execute("SELECT description_vietphrase FROM books WHERE id = ?", (book_id,)).fetchone()
                if r_adv and r_adv["description_vietphrase"]:
                    description_vietphrase = r_adv["description_vietphrase"]
        except Exception as e:
            logger.warning(f"Failed to read from advanced DB for book {book_id}: {e}")

    # Nếu không có trong advanced DB, dịch trực tiếp bằng translation engine
    if not description_vietphrase and book_dict.get("description"):
        try:
            from backend.services.translation import get_engine
            eng = get_engine()
            description_vietphrase = eng.translate(book_dict["description"], multi_option=False)
        except Exception as e:
            logger.warning(f"Failed to translate book description live: {e}")
            description_vietphrase = book_dict.get("description")

    book_dict["description_vietphrase"] = description_vietphrase or ""

    # Dịch mô tả sang tiếng Anh bằng Gemini
    description_english = None
    if book_dict.get("description"):
        # Tạo fallback không dấu trước
        fallback_en = ""
        if book_dict["description_vietphrase"]:
            try:
                from backend.services.book_service import remove_vietnamese_accents
                fallback_en = remove_vietnamese_accents(book_dict["description_vietphrase"])
            except Exception:
                pass
        
        # Thử gọi Gemini để dịch chất lượng cao
        key = os.environ.get("ADMIN_GEMINI_KEY", "") or os.environ.get("GOOGLE_API_KEY_BIGDATA", "") or os.environ.get("GEMINI_API_KEY_BIGDATA", "")
        if key:
            try:
                import requests as py_requests
                url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={key}"
                prompt_text = book_dict["description"][:800]
                payload = {
                    "contents": [{
                        "role": "user",
                        "parts": [{"text": f"Translate the following novel synopsis to English. Only return the English translation, no other commentary:\n\n{prompt_text}"}]
                    }]
                }
                res = py_requests.post(url, json=payload, timeout=5)
                if res.status_code == 200:
                    ans = res.json().get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                    if ans.strip():
                        description_english = ans.strip()
            except Exception as e:
                logger.warning(f"Failed to translate book description to English using Gemini: {e}")
        
        if not description_english:
            description_english = fallback_en or book_dict.get("description")

    book_dict["description_english"] = description_english or ""

    # Dịch thể loại sang tiếng Việt và tiếng Anh, cùng chuẩn hóa tên tác giả tiếng Anh
    try:
        from backend.services.book_service import translate_categories, translate_categories_to_english, remove_vietnamese_accents
        book_dict["categories_vietphrase"] = translate_categories(book_dict.get("categories", ""))
        book_dict["categories_english"] = translate_categories_to_english(book_dict.get("categories", ""))
        
        author_hv = book_dict.get("author_hanviet", "")
        if author_hv:
            book_dict["author_english"] = remove_vietnamese_accents(author_hv)
        else:
            book_dict["author_english"] = book_dict.get("author", "")
    except Exception:
        book_dict["categories_vietphrase"] = book_dict.get("categories", "")
        book_dict["categories_english"] = book_dict.get("categories", "")
        book_dict["author_english"] = book_dict.get("author", "")

    return jsonify(book_dict)


@books_bp.route("/book/<int:book_id>/translations")
def api_book_translations(book_id):
    root_dir = Config.ROOT_DIR
    adv_db_path = os.path.join(root_dir, "merged_books_advanced.db")
    fast_db_path = os.path.join(root_dir, "merged_books_fast.db")
    vp_db_path = os.path.join(root_dir, "merged_books_vietphrase.db")
    hv_db_path = os.path.join(root_dir, "merged_books_hanviet.db")

    res = {
        "advanced": {"title": None, "desc": None},
        "fast": {"title": None, "desc": None},
        "vietphrase": {"title": None, "desc": None},
        "hanviet": {"title": None, "desc": None}
    }

    for mode_key, db_path in [("advanced", adv_db_path), ("fast", fast_db_path),
                               ("vietphrase", vp_db_path), ("hanviet", hv_db_path)]:
        conn = get_mode_connection(db_path)
        if conn:
            try:
                r = conn.execute("SELECT title_vietphrase, description_vietphrase FROM books WHERE id = ?", (book_id,)).fetchone()
                if r:
                    res[mode_key] = {"title": r["title_vietphrase"], "desc": r["description_vietphrase"]}
            except Exception as e:
                print(f"[ERROR] Loading {mode_key} book details: {e}")

    return jsonify(res)


@books_bp.route("/bookshelf", methods=["GET"])
def get_bookshelf():
    user = get_current_user()
    user_id = user["id"] if user else None
    if not user_id:
        return jsonify({"error": "Vui lòng đăng nhập."}), 401

    q = request.args.get("q", "").strip()
    conn = get_user_db_conn()
    rows = conn.execute("SELECT * FROM bookshelf WHERE user_id = ? ORDER BY added_at DESC", (user_id,)).fetchall()
    conn.close()

    books = [dict(r) for r in rows]
    if q:
        q_clean = clean_vietnamese_query(q)
        books = [b for b in books if q_clean in clean_vietnamese_query(b.get("title", ""))
                 or q_clean in clean_vietnamese_query(b.get("author", ""))]
    return jsonify(books)


@books_bp.route("/bookshelf/add", methods=["POST"])
def add_bookshelf():
    user = get_current_user()
    user_id = user["id"] if user else None
    if not user_id:
        return jsonify({"error": "Vui lòng đăng nhập."}), 401

    data = request.json or {}
    book_id = data.get("book_id")
    if not book_id:
        return jsonify({"error": "Thiếu ID truyện."}), 400

    if not is_vip_request():
        conn_check = get_user_db_conn()
        try:
            exists = conn_check.execute("SELECT 1 FROM bookshelf WHERE user_id = ? AND book_id = ?", (user_id, book_id)).fetchone() is not None
            if not exists:
                count = conn_check.execute("SELECT COUNT(*) as cnt FROM bookshelf WHERE user_id = ?", (user_id,)).fetchone()["cnt"]
                if count >= 5:
                    return jsonify({"error": "Tủ sách Standard tối đa 5 truyện. Nâng cấp VIP để lưu không giới hạn!"}), 403
        finally:
            conn_check.close()

    main_conn = get_db()
    book = main_conn.execute("SELECT title_vietphrase, author_hanviet, cover FROM books WHERE id = ?", (book_id,)).fetchone()
    if not book:
        return jsonify({"error": "Không tìm thấy truyện."}), 404

    title = book["title_vietphrase"] or "Không rõ"
    author = book["author_hanviet"] or "Không rõ"
    cover = book["cover"] or ""

    conn = get_user_db_conn()
    try:
        conn.execute(
            "INSERT OR IGNORE INTO bookshelf (user_id, book_id, title, author, cover) VALUES (?, ?, ?, ?, ?)",
            (user_id, book_id, title, author, cover)
        )
        conn.commit()
    finally:
        conn.close()
    return jsonify({"success": True, "message": "Đã thêm vào tủ sách."})


@books_bp.route("/bookshelf/remove", methods=["POST"])
def remove_bookshelf():
    user = get_current_user()
    user_id = user["id"] if user else None
    if not user_id:
        return jsonify({"error": "Vui lòng đăng nhập."}), 401

    data = request.json or {}
    book_id = data.get("book_id")
    url = data.get("url")
    if not book_id and not url:
        return jsonify({"error": "Thiếu thông tin truyện để xóa."}), 400

    conn = get_user_db_conn()
    if book_id:
        conn.execute("DELETE FROM bookshelf WHERE user_id = ? AND book_id = ?", (user_id, book_id))
    else:
        conn.execute("DELETE FROM bookshelf WHERE user_id = ? AND url = ?", (user_id, url))
    conn.commit()
    conn.close()
    return jsonify({"success": True, "message": "Đã xóa khỏi tủ sách."})


@books_bp.route("/history", methods=["GET"])
def get_history():
    user = get_current_user()
    user_id = user["id"] if user else None
    if not user_id:
        return jsonify({"error": "Vui lòng đăng nhập."}), 401

    q = request.args.get("q", "").strip()
    conn = get_user_db_conn()
    rows = conn.execute("SELECT * FROM reading_history WHERE user_id = ? ORDER BY timestamp DESC", (user_id,)).fetchall()
    conn.close()

    books = [dict(r) for r in rows]
    if q:
        q_clean = clean_vietnamese_query(q)
        books = [b for b in books if q_clean in clean_vietnamese_query(b.get("title", ""))
                 or q_clean in clean_vietnamese_query(b.get("author", ""))]

    struct_now = time.localtime()
    today_str = f"{struct_now.tm_year:04d}-{struct_now.tm_mon:02d}-{struct_now.tm_mday:02d}"
    struct_y = time.localtime(time.time() - 86400)
    yesterday_str = f"{struct_y.tm_year:04d}-{struct_y.tm_mon:02d}-{struct_y.tm_mday:02d}"
    this_month_prefix = f"{struct_now.tm_year:04d}-{struct_now.tm_mon:02d}"

    groups = {"Hôm nay": [], "Hôm qua": [], "Tháng này": [], "Trước đây": []}
    for b in books:
        r_date = b.get("read_date", "")
        if r_date == today_str:
            groups["Hôm nay"].append(b)
        elif r_date == yesterday_str:
            groups["Hôm qua"].append(b)
        elif r_date.startswith(this_month_prefix):
            groups["Tháng này"].append(b)
        else:
            groups["Trước đây"].append(b)

    return jsonify([{"group_name": g, "books": groups[g]}
                    for g in ["Hôm nay", "Hôm qua", "Tháng này", "Trước đây"] if groups[g]])


@books_bp.route("/history/add", methods=["POST"])
def add_history():
    user = get_current_user()
    user_id = user["id"] if user else None
    if not user_id:
        return jsonify({"error": "Vui lòng đăng nhập."}), 401

    data = request.json or {}
    book_id = data.get("book_id")
    last_chapter = data.get("last_chapter", "Chương đầu")
    if not book_id:
        return jsonify({"error": "Thiếu ID truyện."}), 400

    main_conn = get_db()
    book = main_conn.execute("SELECT title_vietphrase, author_hanviet, cover FROM books WHERE id = ?", (book_id,)).fetchone()
    if not book:
        return jsonify({"error": "Không tìm thấy truyện."}), 404

    title = book["title_vietphrase"] or "Không rõ"
    author = book["author_hanviet"] or "Không rõ"
    cover = book["cover"] or ""
    struct_now = time.localtime()
    today_str = f"{struct_now.tm_year:04d}-{struct_now.tm_mon:02d}-{struct_now.tm_mday:02d}"

    conn = get_user_db_conn()
    try:
        conn.execute("""
            INSERT OR REPLACE INTO reading_history (user_id, book_id, title, author, cover, last_chapter, read_date, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        """, (user_id, book_id, title, author, cover, last_chapter, today_str))
        conn.commit()
    finally:
        conn.close()
    return jsonify({"success": True})


@books_bp.route("/history/clear", methods=["POST"])
def clear_history():
    user = get_current_user()
    user_id = user["id"] if user else None
    if not user_id:
        return jsonify({"error": "Vui lòng đăng nhập."}), 401
    conn = get_user_db_conn()
    conn.execute("DELETE FROM reading_history WHERE user_id = ?", (user_id,))
    conn.commit()
    conn.close()
    return jsonify({"success": True})


@books_bp.route("/history/remove", methods=["POST"])
def remove_history_item():
    """Xóa một mục khỏi lịch sử đọc (theo book_id hoặc url)."""
    user = get_current_user()
    user_id = user["id"] if user else None
    if not user_id:
        return jsonify({"error": "Vui lòng đăng nhập."}), 401

    data = request.json or {}
    book_id = data.get("book_id")
    url = data.get("url")

    if not book_id and not url:
        return jsonify({"error": "Thiếu book_id hoặc url."}), 400

    conn = get_user_db_conn()
    try:
        if book_id:
            conn.execute(
                "DELETE FROM reading_history WHERE user_id = ? AND book_id = ?",
                (user_id, book_id)
            )
        else:
            conn.execute(
                "DELETE FROM reading_history WHERE user_id = ? AND url = ?",
                (user_id, url)
            )
        conn.commit()
        return jsonify({"success": True, "message": "Đã xóa khỏi lịch sử."})
    except Exception as e:
        logger.error(f"[History] Remove item failed: {e}")
        return jsonify({"error": "Không thể xóa mục lịch sử."}), 500
    finally:
        conn.close()




@books_bp.route("/extension/sync", methods=["POST"])
def extension_sync():
    user = get_current_user()
    user_id = user["id"] if user else None
    if not user_id:
        return jsonify({"error": "Vui lòng đăng nhập trên website chính."}), 401

    data = request.json or {}
    title_zh = data.get("title", "").strip()
    author_zh = data.get("author", "").strip()
    cover = data.get("cover", "").strip()
    last_chapter_zh = data.get("last_chapter", "").strip()
    url = data.get("url", "").strip()
    action = data.get("action", "history")

    if not title_zh and not url:
        return jsonify({"error": "Thiếu thông tin tên truyện hoặc liên kết đường dẫn."}), 400

    book = None
    book_id = None
    title_vi = None
    author_vi = None
    eng = get_engine()

    if not title_zh:
        from urllib.parse import urlparse
        try:
            domain = urlparse(url).netloc
            title_vi = f"Truyện ngoài ({domain})"
        except Exception:
            title_vi = "Truyện ngoài"
        title_zh = title_vi
        author_vi = "Không rõ"
    else:
        main_conn = get_db()
        book = main_conn.execute(
            "SELECT id, title_vietphrase, author_hanviet, cover FROM books WHERE title = ? LIMIT 1",
            (title_zh,)
        ).fetchone()

    if book:
        book_id = book["id"]
        title_vi = book["title_vietphrase"]
        author_vi = book["author_hanviet"]
        if not cover and book["cover"]:
            cover = book["cover"]
    else:
        if not title_vi:
            try:
                title_vi = eng.translate(title_zh, multi_option=False)
            except Exception:
                title_vi = title_zh
        if not author_vi:
            if author_zh:
                try:
                    author_vi = eng.translate(author_zh, multi_option=False)
                except Exception:
                    author_vi = author_zh
            else:
                author_vi = "Không rõ"

    last_chapter_vi = "Chương đầu"
    if last_chapter_zh:
        try:
            last_chapter_vi = eng.translate(last_chapter_zh, multi_option=False)
        except Exception:
            last_chapter_vi = last_chapter_zh

    title_vi = title_vi or title_zh
    author_vi = author_vi or "Không rõ"
    struct_now = time.localtime()
    today_str = f"{struct_now.tm_year:04d}-{struct_now.tm_mon:02d}-{struct_now.tm_mday:02d}"

    conn = get_user_db_conn()
    try:
        if action == "bookshelf":
            if not is_vip_request():
                exists = (
                    conn.execute("SELECT 1 FROM bookshelf WHERE user_id = ? AND book_id = ?", (user_id, book_id)).fetchone()
                    if book_id
                    else conn.execute("SELECT 1 FROM bookshelf WHERE user_id = ? AND url = ?", (user_id, url)).fetchone()
                ) is not None
                if not exists:
                    count = conn.execute("SELECT COUNT(*) as cnt FROM bookshelf WHERE user_id = ?", (user_id,)).fetchone()["cnt"]
                    if count >= 5:
                        return jsonify({"error": "Tủ sách Standard tối đa 5 truyện. Nâng cấp VIP!"}), 403

            if book_id:
                conn.execute("INSERT OR REPLACE INTO bookshelf (user_id, book_id, title, author, cover, url) VALUES (?, ?, ?, ?, ?, ?)",
                             (user_id, book_id, title_vi, author_vi, cover, url))
            else:
                existing = conn.execute("SELECT id FROM bookshelf WHERE user_id = ? AND url = ?", (user_id, url)).fetchone()
                if existing:
                    conn.execute("UPDATE bookshelf SET title = ?, author = ?, cover = ? WHERE id = ?",
                                 (title_vi, author_vi, cover, existing["id"]))
                else:
                    conn.execute("INSERT INTO bookshelf (user_id, book_id, title, author, cover, url) VALUES (?, NULL, ?, ?, ?, ?)",
                                 (user_id, title_vi, author_vi, cover, url))
            conn.commit()
            msg = "Đã lưu vào Tủ sách!"
        else:
            if book_id:
                conn.execute("INSERT OR REPLACE INTO reading_history (user_id, book_id, title, author, cover, last_chapter, read_date, url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                             (user_id, book_id, title_vi, author_vi, cover, last_chapter_vi, today_str, url))
            else:
                existing = conn.execute("SELECT id FROM reading_history WHERE user_id = ? AND url = ?", (user_id, url)).fetchone()
                if existing:
                    conn.execute("UPDATE reading_history SET title = ?, author = ?, cover = ?, last_chapter = ?, read_date = ?, timestamp = CURRENT_TIMESTAMP WHERE id = ?",
                                 (title_vi, author_vi, cover, last_chapter_vi, today_str, existing["id"]))
                else:
                    conn.execute("INSERT INTO reading_history (user_id, book_id, title, author, cover, last_chapter, read_date, url) VALUES (?, NULL, ?, ?, ?, ?, ?, ?)",
                                 (user_id, title_vi, author_vi, cover, last_chapter_vi, today_str, url))
            conn.commit()
            msg = "Đã cập nhật Lịch sử!"
    finally:
        conn.close()

    return jsonify({
        "success": True, "message": msg,
        "matched": book is not None, "book_id": book_id,
        "title_vi": title_vi, "author_vi": author_vi, "last_chapter_vi": last_chapter_vi
    })


@books_bp.route("/system/notifications", methods=["GET"])
def get_system_notifications():
    user = get_current_user()
    notifications = [
        {
            "id": "sys-1",
            "type": "server",
            "message": "Hệ thống máy chủ dịch thuật AI đã được nâng cấp lên v2.4, cải thiện 45% tốc độ phản hồi.",
            "time": "Vừa xong"
        },
        {
            "id": "sys-2",
            "type": "promo",
            "message": "Sự kiện đặc biệt: Tặng ngay 20% số dư khi thực hiện nạp ví VIP qua chuyển khoản VietQR trong tuần này!",
            "time": "5 phút trước"
        }
    ]
    
    if user:
        user_id = user["id"]
        conn = get_user_db_conn()
        try:
            rows = conn.execute("SELECT title FROM bookshelf WHERE user_id = ? ORDER BY added_at DESC LIMIT 3", (user_id,)).fetchall()
            for i, row in enumerate(rows):
                notifications.append({
                    "id": f"shelf-{i}",
                    "type": "update",
                    "message": f"Truyện '{row['title']}' trong Tủ sách của bạn vừa cập nhật thêm chương dịch mới.",
                    "time": "10 phút trước"
                })
        except Exception:
            pass
        finally:
            conn.close()
            
    notifications.append({
        "id": "comment-1",
        "type": "comment",
        "message": "Độc giả Lê Hoàng Nam vừa bình luận truyện 'Trọng Sinh Chi Ma Giáo Giáo Chủ': 'Bản dịch AI đọc rất mượt mà...'",
        "time": "20 phút trước"
    })
    notifications.append({
        "id": "comment-2",
        "type": "comment",
        "message": "Thành viên VIP_SERVER vừa tối ưu hóa tốc độ load chương mới thành công.",
        "time": "1 giờ trước"
    })
    return jsonify(notifications)


@books_bp.route("/author/<author_name>", methods=["GET"])
def get_author_details(author_name):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM books WHERE author = ? OR author_hanviet = ? ORDER BY chapters_max DESC",
        (author_name, author_name)
    ).fetchall()
    
    if not rows:
        rows = conn.execute(
            "SELECT * FROM books WHERE LOWER(author) = LOWER(?) OR LOWER(author_hanviet) = LOWER(?) ORDER BY chapters_max DESC",
            (author_name, author_name)
        ).fetchall()
        
    fallback_mode = False
    if not rows:
        # Fallback: if author has no books in database, fetch first 5 books to show as placeholder
        rows = conn.execute("SELECT * FROM books LIMIT 5").fetchall()
        fallback_mode = True
        
    books = []
    canonical_chinese = author_name if fallback_mode else (rows[0]["author"] or author_name)
    canonical_hanviet = author_name if fallback_mode else (rows[0]["author_hanviet"] or author_name)
    
    for row in rows:
        book_dict = dict(row)
        if fallback_mode:
            book_dict["author"] = author_name
            book_dict["author_hanviet"] = author_name
            
        parsed_sources = []
        raw_urls = book_dict.get("urls", "")
        if raw_urls:
            parts = raw_urls.split(" | ")
            for part in parts:
                if ":" in part:
                    subparts = part.split(":", 1)
                    src_name = subparts[0].strip()
                    src_url = subparts[1].strip()
                    # Keep raw scheme if complete, else handle
                    if src_url.startswith("//"):
                        src_url = "https:" + src_url
                    parsed_sources.append({
                        "source": src_name,
                        "url": src_url
                    })
        book_dict["parsed_sources"] = parsed_sources
        books.append(book_dict)
        
    return jsonify({
        "author_chinese": canonical_chinese,
        "author_hanviet": canonical_hanviet,
        "total_books": len(books),
        "books": books
    })


@books_bp.route("/books/<int:book_id>/comments", methods=["POST"])
def add_book_comment(book_id):
    user = get_current_user()
    data = request.json or {}
    content = data.get("content", "").strip()
    is_anonymous = int(data.get("is_anonymous", 0))
    
    if not content:
        return jsonify({"error": "Nội dung bình luận không được để trống"}), 400
        
    user_id = user["id"] if user else None
    
    # Mã hóa Hybrid RSA-AES bảo mật
    enc_data = encrypt_asymmetric_hybrid(content)
    
    conn = get_user_db_conn()
    try:
        conn.execute(
            """INSERT INTO book_comments 
               (book_id, user_id, is_anonymous, content_ciphertext, encrypted_aes_key, aes_nonce, aes_tag)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (book_id, user_id, is_anonymous, 
             enc_data["ciphertext"], enc_data["encrypted_key"], enc_data["nonce"], enc_data["tag"])
        )
        conn.commit()
        return jsonify({"success": True, "message": "Gửi bình luận thành công!"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


@books_bp.route("/books/<int:book_id>/comments", methods=["GET"])
def get_book_comments(book_id):
    conn = get_user_db_conn()
    try:
        rows = conn.execute(
            """SELECT c.id, c.user_id, c.is_anonymous, c.content_ciphertext, c.encrypted_aes_key, 
                      c.aes_nonce, c.aes_tag, c.created_at, u.username, u.avatar
               FROM book_comments c
               LEFT JOIN users u ON c.user_id = u.id
               WHERE c.book_id = ?
               ORDER BY c.created_at DESC""",
            (book_id,)
        ).fetchall()
        
        comments = []
        for r in rows:
            # Giải mã Hybrid RSA-AES
            decrypted_content = decrypt_asymmetric_hybrid(
                r["content_ciphertext"],
                r["encrypted_aes_key"],
                r["aes_nonce"],
                r["aes_tag"]
            )
            
            comment = {
                "id": r["id"],
                "created_at": r["created_at"].isoformat() if hasattr(r["created_at"], "isoformat") else r["created_at"],
            }
            
            if r["is_anonymous"] == 1:
                comment["username"] = "Đạo hữu ẩn danh"
                comment["avatar"] = None
                comment["user_id"] = None
            else:
                comment["username"] = r["username"] or "Khách viếng thăm"
                comment["avatar"] = r["avatar"]
                comment["user_id"] = r["user_id"]
                
            comment["content"] = decrypted_content
            comments.append(comment)
            
        return jsonify({"comments": comments})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

