import sqlite3
import json
import os
from collections import Counter

# File paths
db_path = "merged_books.db"
artifact_dir = "/home/alida/.gemini/antigravity/brain/48dc74e2-79a4-43df-b520-56ae0b30918b/artifacts"
os.makedirs(artifact_dir, exist_ok=True)
report_path = os.path.join(artifact_dir, "thong_ke_the_loai.md")

conn = sqlite3.connect(db_path)
c = conn.cursor()
c.execute("SELECT categories FROM books")
rows = c.fetchall()

# Mapping from Chinese to standard Vietnamese categories
mapping = {
    # 1. Huyền Huyễn / Kỳ Huyễn
    "玄幻奇幻": "Huyền Huyễn / Kỳ Huyễn",
    "玄幻": "Huyền Huyễn / Kỳ Huyễn",
    "玄幻小说": "Huyền Huyễn / Kỳ Huyễn",
    "玄幻魔法": "Huyền Huyễn / Kỳ Huyễn",
    "奇幻小说": "Huyền Huyễn / Kỳ Huyễn",
    "奇幻": "Huyền Huyễn / Kỳ Huyễn",
    "魔法校园": "Huyền Huyễn / Kỳ Huyễn",
    "西方奇幻": "Huyền Huyễn / Kỳ Huyễn",
    "异世大陆": "Huyền Huyễn / Kỳ Huyễn",
    "异界大陆": "Huyền Huyễn / Kỳ Huyễn",
    
    # 2. Đô Thị / Thanh Xuân
    "都市青春": "Đô Thị / Thanh Xuân",
    "都市言情": "Đô Thị / Thanh Xuân",
    "都市": "Đô Thị / Thanh Xuân",
    "都市小说": "Đô Thị / Thanh Xuân",
    "青春小说": "Đô Thị / Thanh Xuân",
    "韩流青春": "Đô Thị / Thanh Xuân",
    "青春": "Đô Thị / Thanh Xuân",
    "都市生活": "Đô Thị / Thanh Xuân",
    "娱乐明星": "Đô Thị / Thanh Xuân",
    "官场职场": "Đô Thị / Thanh Xuân",
    "职场励志": "Đô Thị / Thanh Xuân",
    "青春校园": "Đô Thị / Thanh Xuân",
    
    # 3. Ngôn Tình / Nữ Sinh / Đam Mỹ
    "言情穿越": "Ngôn Tình / Nữ Sinh / Xuyên Không",
    "女生": "Ngôn Tình / Nữ Sinh / Xuyên Không",
    "台言古言": "Ngôn Tình / Nữ Sinh / Xuyên Không",
    "言情小说": "Ngôn Tình / Nữ Sinh / Xuyên Không",
    "女生小说": "Ngôn Tình / Nữ Sinh / Xuyên Không",
    "架空小说": "Ngôn Tình / Nữ Sinh / Xuyên Không",
    "耽美小说": "Ngôn Tình / Nữ Sinh / Xuyên Không",
    "耽美": "Ngôn Tình / Nữ Sinh / Xuyên Không",
    "婚姻恋爱": "Ngôn Tình / Nữ Sinh / Xuyên Không",
    "古代言情": "Ngôn Tình / Nữ Sinh / Xuyên Không",
    "现代言情": "Ngôn Tình / Nữ Sinh / Xuyên Không",
    "穿越时空": "Ngôn Tình / Nữ Sinh / Xuyên Không",
    "豪门总裁": "Ngôn Tình / Nữ Sinh / Xuyên Không",
    "浪漫青春": "Ngôn Tình / Nữ Sinh / Xuyên Không",
    "纯爱小说": "Ngôn Tình / Nữ Sinh / Xuyên Không",
    
    # 4. Tu Chân / Tiên Hiệp
    "修真仙侠": "Tu Chân / Tiên Hiệp / Kiếm Hiệp",
    "仙侠小说": "Tu Chân / Tiên Hiệp / Kiếm Hiệp",
    "武侠修真": "Tu Chân / Tiên Hiệp / Kiếm Hiệp",
    "武侠": "Tu Chân / Tiên Hiệp / Kiếm Hiệp",
    "武侠仙侠": "Tu Chân / Tiên Hiệp / Kiếm Hiệp",
    "传统武侠": "Tu Chân / Tiên Hiệp / Kiếm Hiệp",
    "武侠小说": "Tu Chân / Tiên Hiệp / Kiếm Hiệp",
    "现代修真": "Tu Chân / Tiên Hiệp / Kiếm Hiệp",
    "古典仙侠": "Tu Chân / Tiên Hiệp / Kiếm Hiệp",
    "修真小说": "Tu Chân / Tiên Hiệp / Kiếm Hiệp",
    "仙侠": "Tu Chân / Tiên Hiệp / Kiếm Hiệp",
    "幻想修真": "Tu Chân / Tiên Hiệp / Kiếm Hiệp",
    
    # 5. Khoa Huyễn / Linh Dị / Trinh Thám
    "科幻灵异": "Khoa Huyễn / Linh Dị / Trinh Thám",
    "科幻": "Khoa Huyễn / Linh Dị / Trinh Thám",
    "科幻小说": "Khoa Huyễn / Linh Dị / Trinh Thám",
    "侦探推理": "Khoa Huyễn / Linh Dị / Trinh Thám",
    "恐怖灵异": "Khoa Huyễn / Linh Dị / Trinh Thám",
    "恐怖小说": "Khoa Huyễn / Linh Dị / Trinh Thám",
    "灵异小说": "Khoa Huyễn / Linh Dị / Trinh Thám",
    "悬疑推理": "Khoa Huyễn / Linh Dị / Trinh Thám",
    "灵异神怪": "Khoa Huyễn / Linh Dị / Trinh Thám",
    "悬疑": "Khoa Huyễn / Linh Dị / Trinh Thám",
    "推理": "Khoa Huyễn / Linh Dị / Trinh Thám",
    "古怪": "Khoa Huyễn / Linh Dị / Trinh Thám",
    "灵异": "Khoa Huyễn / Linh Dị / Trinh Thám",
    "侦探": "Khoa Huyễn / Linh Dị / Trinh Thám",
    "科幻空间": "Khoa Huyễn / Linh Dị / Trinh Thám",
    
    # 6. Lịch Sử / Quân Sự
    "军事历史": "Lịch Sử / Quân Sự",
    "历史军事": "Lịch Sử / Quân Sự",
    "历史": "Lịch Sử / Quân Sự",
    "历史小说": "Lịch Sử / Quân Sự",
    "军事小说": "Lịch Sử / Quân Sự",
    "架空历史": "Lịch Sử / Quân Sự",
    "战争军事": "Lịch Sử / Quân Sự",
    "军事": "Lịch Sử / Quân Sự",
    "两宋元明": "Lịch Sử / Quân Sự",
    "秦汉三国": "Lịch Sử / Quân Sự",
    "历史传奇": "Lịch Sử / Quân Sự",
    
    # 7. Võng Du / Cạnh Kỹ
    "网游竞技": "Võng Du / Cạnh Kỹ / Game",
    "网游": "Võng Du / Cạnh Kỹ / Game",
    "网游小说": "Võng Du / Cạnh Kỹ / Game",
    "网游动漫": "Võng Du / Cạnh Kỹ / Game",
    "科幻网游": "Võng Du / Cạnh Kỹ / Game",
    "游戏竞技": "Võng Du / Cạnh Kỹ / Game",
    "电子竞技": "Võng Du / Cạnh Kỹ / Game",
    "竞技": "Võng Du / Cạnh Kỹ / Game",
    "游戏": "Võng Du / Cạnh Kỹ / Game",
    
    # 8. Đồng Nhân
    "同人小说": "Đồng Nhân",
    "同人": "Đồng Nhân",
    "耽美同人": "Đồng Nhân",
    "动漫同人": "Đồng Nhân",
    "影视同人": "Đồng Nhân",
    "小说同人": "Đồng Nhân",
    "同人系统": "Đồng Nhân",
    
    # 9. Khác
    "其他": "Khác / Chưa rõ",
    "其它书籍": "Khác / Chưa rõ",
    "其他书籍": "Khác / Chưa rõ",
    "男人小说": "Khác / Chưa rõ",
    "当代现代": "Khác / Chưa rõ",
    "散文诗歌": "Khác / Chưa rõ",
    "名著": "Khác / Chưa rõ",
    "纪实": "Khác / Chưa rõ",
    "科普": "Khác / Chưa rõ",
    "学术": "Khác / Chưa rõ",
}

# 1. Count raw categories
raw_cats = Counter()
for (c_str,) in rows:
    if c_str:
        for cat in c_str.split(","):
            cat = cat.strip()
            if cat:
                raw_cats[cat] += 1

# 2. Map to Vietnamese categories
vi_cats = Counter()
for cat, cnt in raw_cats.items():
    mapped_name = mapping.get(cat, "Khác / Chưa rõ")
    vi_cats[mapped_name] += cnt

total_books_counted = sum(vi_cats.values())

# Write report markdown
with open(report_path, "w", encoding="utf-8") as f:
    f.write("# 📊 Báo Cáo Thống Kê Thể Loại Truyện\n\n")
    f.write("Báo cáo chi tiết phân bố thể loại truyện trong cơ sở dữ liệu `merged_books.db` với tổng số **944.432** đầu truyện.\n\n")
    
    f.write("## 1. Phân Bố Theo Thể Loại Lớn (Đã dịch & Phân nhóm)\n\n")
    f.write("| STT | Thể Loại | Số Lượng Truyện | Tỷ Lệ (%) | Ghi Chú |\n")
    f.write("| :---: | :--- | :---: | :---: | :--- |\n")
    
    for i, (name, cnt) in enumerate(vi_cats.most_common(), 1):
        percentage = (cnt / total_books_counted) * 100
        f.write(f"| {i} | **{name}** | {cnt:,} | {percentage:.2f}% | |\n")
        
    f.write("\n## 2. Chi Tiết Top 30 Thể Loại Gốc (Tiếng Trung)\n\n")
    f.write("| STT | Thể Loại Gốc | Nghĩa Hán Việt / Tiếng Việt | Số Lượng Truyện | Tỷ Lệ (%) |\n")
    f.write("| :---: | :--- | :--- | :---: | :---: |\n")
    
    # Manual translations for table
    translations = {
        "玄幻奇幻": "Huyền huyễn Kỳ huyễn",
        "都市青春": "Đô thị Thanh xuân",
        "言情穿越": "Ngôn tình Xuyên không",
        "女生": "Nữ sinh (Dành cho nữ)",
        "其他": "Khác",
        "台言古言": "Ngôn tình Đài Loan / Cổ đại",
        "科幻灵异": "Khoa huyễn Linh dị",
        "言情小说": "Tiểu thuyết ngôn tình",
        "修真仙侠": "Tu chân Tiên hiệp",
        "都市言情": "Đô thị Ngôn tình",
        "军事历史": "Quân sự Lịch sử",
        "玄幻": "Huyền huyễn",
        "都市": "Đô thị",
        "网游竞技": "Võng du Cạnh kỹ",
        "玄幻魔法": "Huyền huyễn Ma pháp",
        "玄幻小说": "Tiểu thuyết Huyền huyễn",
        "同人小说": "Tiểu thuyết Đồng nhân",
        "都市小说": "Tiểu thuyết Đô thị",
        "其它书籍": "Sách khác",
        "科幻": "Khoa huyễn",
        "同人": "Đồng nhân",
        "历史军事": "Lịch sử Quân sự",
        "科幻小说": "Tiểu thuyết Khoa huyễn",
        "男人小说": "Truyện nam sinh",
        "侦探推理": "Trinh thám Suy luận",
        "武侠修真": "Võng du Tu chân",
        "历史": "Lịch sử",
        "女生小说": "Tiểu thuyết Nữ sinh",
        "网游": "Võng du",
        "仙侠小说": "Tiểu thuyết Tiên hiệp",
        "武侠": "Kiếm hiệp (Võ hiệp)"
    }
    
    for i, (name, cnt) in enumerate(raw_cats.most_common(30), 1):
        percentage = (cnt / total_books_counted) * 100
        vn_mean = translations.get(name, name)
        f.write(f"| {i} | `{name}` | {vn_mean} | {cnt:,} | {percentage:.2f}% |\n")

print("Đã tạo báo cáo thống kê thể loại tại:", report_path)
conn.close()
