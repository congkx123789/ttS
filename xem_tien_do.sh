#!/bin/bash
# Script kiểm tra tiến độ cào Qidian hiện tại

echo "=================================================="
echo "    BÁO CÁO TIẾN ĐỘ CÀO TRUYỆN QIDIAN & FALOO    "
echo "=================================================="
echo ""

# 1. Kiểm tra Qidian SQLite DB
if [ -f "qidian_books.db" ]; then
    TOTAL=$(sqlite3 qidian_books.db "SELECT COUNT(*) FROM books")
    PARSED=$(sqlite3 qidian_books.db "SELECT COUNT(*) FROM books WHERE status = 'Parsed'")
    NOTFOUND=$(sqlite3 qidian_books.db "SELECT COUNT(*) FROM books WHERE status = '404'")
    INVALID=$(sqlite3 qidian_books.db "SELECT COUNT(*) FROM books WHERE status = 'Invalid'")
    FAILED=$(sqlite3 qidian_books.db "SELECT COUNT(*) FROM books WHERE status = 'Failed'")
    
    echo "[Qidian Database]"
    echo " -> Tổng số bản ghi (đã quét): $TOTAL"
    echo " -> Số truyện lấy thành công: $PARSED"
    echo " -> Số ID không tồn tại (404): $NOTFOUND"
    echo " -> Số ID không hợp lệ/đã hạ: $INVALID"
    echo " -> Số ID lỗi kết nối: $FAILED"
    echo ""
else
    echo "[Qidian Database] Chưa có file qidian_books.db"
    echo ""
fi

# 2. Kiểm tra Faloo SQLite DB
if [ -f "faloo_books.db" ]; then
    F_TOTAL=$(sqlite3 faloo_books.db "SELECT COUNT(*) FROM faloo_novels")
    echo "[Faloo Database]"
    echo " -> Tổng số truyện đã cào: $F_TOTAL"
    echo ""
else
    echo "[Faloo Database] Chưa có file faloo_books.db"
    echo ""
fi

# 3. Kiểm tra Fanqie SQLite DB
if [ -f "fanqie_books.db" ]; then
    FQ_TOTAL=$(sqlite3 fanqie_books.db "SELECT COUNT(*) FROM fanqie_novels")
    FQ_PARSED=$(sqlite3 fanqie_books.db "SELECT COUNT(*) FROM fanqie_novels WHERE status = 'Parsed'")
    FQ_PENDING=$(sqlite3 fanqie_books.db "SELECT COUNT(*) FROM fanqie_novels WHERE status = 'Pending'")
    FQ_404=$(sqlite3 fanqie_books.db "SELECT COUNT(*) FROM fanqie_novels WHERE status = '404'")
    
    echo "[Fanqie Database]"
    echo " -> Tổng số bản ghi trong DB: $FQ_TOTAL"
    echo " -> Số truyện lấy thành công: $FQ_PARSED"
    echo " -> Số ID đang chờ cào (Pending): $FQ_PENDING"
    echo " -> Số ID lỗi/không tồn tại (404): $FQ_404"
    echo ""
else
    echo "[Fanqie Database] Chưa có file fanqie_books.db"
    echo ""
fi

# 4. Kiểm tra các tiến trình đang chạy
echo "[Tiến trình đang hoạt động]"
ps aux | grep -E "qidian_id_crawler|faloo_crawler|fanqie_discover|fanqie_parse|fanqie_crawler" | grep -v grep
echo ""

# 5. Log mới nhất của Fanqie Crawler
echo "[Log Fanqie Crawler]"
if [ -f "fanqie_crawler.log" ]; then
    tail -n 10 fanqie_crawler.log
else
    echo "(Không tìm thấy log crawler)"
fi
echo ""
