import sqlite3
import os

dbs = ["merged_books.db", "merged_books_advanced.db", "merged_books_fast.db", "merged_books_vietphrase.db", "merged_books_hanviet.db"]

sql_deletes = [
    # 1. Title contains junk SEO keywords
    "DELETE FROM books WHERE title LIKE '%免费阅读%'",
    "DELETE FROM books WHERE title LIKE '%无弹窗%'",
    "DELETE FROM books WHERE title LIKE '%最新章节%'",
    "DELETE FROM books WHERE title LIKE '%全文免费%'",
    "DELETE FROM books WHERE title LIKE '%完整版%'",
    "DELETE FROM books WHERE title LIKE '%完结阅读%'",
    "DELETE FROM books WHERE title LIKE '%的小说%'",
    "DELETE FROM books WHERE title LIKE '%小说全文%'",
    "DELETE FROM books WHERE title LIKE '%怎么了%'",
    "DELETE FROM books WHERE title LIKE '%怎么回事%'",
    "DELETE FROM books WHERE title LIKE '%结局是什么%'",
    "DELETE FROM books WHERE title LIKE '%txt下载%'",
    "DELETE FROM books WHERE title LIKE '%全部目录%'",
    "DELETE FROM books WHERE title LIKE '%是什么小说%'",
    "DELETE FROM books WHERE title LIKE '%小说最新%'",
    "DELETE FROM books WHERE title LIKE '%小说免费%'",
    "DELETE FROM books WHERE title LIKE '%免费全文%'",
    "DELETE FROM books WHERE title LIKE '%在线阅读%'",
    "DELETE FROM books WHERE title LIKE '%全文完结%'",
    "DELETE FROM books WHERE title LIKE '%笔趣阁%'",
    "DELETE FROM books WHERE title LIKE '%无删减%'",
    "DELETE FROM books WHERE title LIKE '%和谁在一起%'",
    "DELETE FROM books WHERE title LIKE '%推倒%'",
    "DELETE FROM books WHERE title LIKE '%的真实身份%'",
    "DELETE FROM books WHERE title LIKE '%结局怎么样%'",
    "DELETE FROM books WHERE title LIKE '%更新最快%'",
    "DELETE FROM books WHERE title LIKE '%顶点小说%'",
    "DELETE FROM books WHERE title LIKE '%爱下电子书%'",
    "DELETE FROM books WHERE title LIKE '%下载%'",
    "DELETE FROM books WHERE title LIKE '%大结局%'",
    "DELETE FROM books WHERE title LIKE '%全文免费阅读%'",
    
    # 2. Author contains junk or character lists (that are not real author names)
    "DELETE FROM books WHERE author LIKE '%最新更新%'",
    "DELETE FROM books WHERE author LIKE '%一号狂枭%'",
    "DELETE FROM books WHERE author LIKE '%离婚时孕吐%'",
    "DELETE FROM books WHERE author LIKE '%逃荒后我逆袭了%'",
    "DELETE FROM books WHERE author LIKE '%荒年不愁%'",
    "DELETE FROM books WHERE author LIKE '%在你深情中陨落%'",
    "DELETE FROM books WHERE author LIKE '%女主角%'",
    "DELETE FROM books WHERE author LIKE '%男主角%'",
    "DELETE FROM books WHERE author LIKE '%章节%'",
    
    # 3. Specific cleanup for characters names in title/author of 一号狂枭
    "DELETE FROM books WHERE title LIKE '%一号狂枭%' AND author = '凌皓秦雨欣'",
    "DELETE FROM books WHERE title LIKE '%一号狂枭%' AND author = '最新更新'",
    "DELETE FROM books WHERE title LIKE '%一号狂枭%' AND author = '皮卡丘'",
    "DELETE FROM books WHERE title LIKE '%一号狂枭%' AND author = '李清风夏仙音'",
    "DELETE FROM books WHERE title LIKE '%一号狂枭%' AND author = '凌皓秦雨欣蕊蕊'",
    "DELETE FROM books WHERE title LIKE '%一号狂枭%' AND title != '一号狂枭'",
]

for db in dbs:
    db_path = f"/home/alida/Documents/Tool translate CHinese/{db}"
    if not os.path.exists(db_path):
        continue
    print(f"Cleaning database: {db}...")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Check total books before
    cursor.execute("SELECT COUNT(*) FROM books")
    before = cursor.fetchone()[0]
    
    deleted_total = 0
    for sql in sql_deletes:
        cursor.execute(sql)
        deleted_total += cursor.rowcount
        
    conn.commit()
    
    # Vacuum database to reclaim space
    print(f"Vacuuming {db}...")
    cursor.execute("VACUUM")
    conn.commit()
    
    # Check total books after
    cursor.execute("SELECT COUNT(*) FROM books")
    after = cursor.fetchone()[0]
    
    print(f"Database: {db}")
    print(f"  Books before:  {before:,}")
    print(f"  Books deleted: {before - after:,}")
    print(f"  Books after:   {after:,}\n")
    
    conn.close()

print("All databases cleaned successfully.")
