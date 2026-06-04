import os
import re
from bs4 import BeautifulSoup

def inspect_html():
    file_path = "faloo_page.html"
    if not os.path.exists(file_path):
        print(f"File {file_path} not found.")
        return
        
    with open(file_path, "r", encoding="utf-8") as f:
        html = f.read()
        
    soup = BeautifulSoup(html, "html.parser")
    
    # 1. Title
    title_tag = soup.select_one("h1#novelName")
    title = title_tag.get_text(strip=True) if title_tag else None
    
    # 2. Author
    author = None
    author_tag = soup.select_one(".T-L-O-Z-Box1 a.colorQianHui")
    if author_tag:
        author = author_tag.get_text(strip=True)
    if not author:
        # Fallback to authorInfo section
        author_tag = soup.select_one(".authorInfo .box1 a")
        if author_tag:
            author = author_tag.get_text(strip=True)
            
    # 3. Category & Subcategory
    category = None
    subcategory = None
    
    # Let's find from T-R-T-B2-Box1 elements
    for box in soup.select(".T-R-T-B2-Box1"):
        text = box.get_text()
        if "小说分类：" in text:
            a_tag = box.select_one("a")
            if a_tag:
                category = a_tag.get_text(strip=True)
        elif "小说子类：" in text:
            a_tag = box.select_one("a")
            if a_tag:
                subcategory = a_tag.get_text(strip=True)
                
    # Fallback to breadcrumbs
    if not category or not subcategory:
        breadcrumbs = soup.select(".C-One a")
        # Breadcrumbs are like: Home > Faloo > Main Category > Sub Category
        if len(breadcrumbs) >= 4:
            if not category:
                category = breadcrumbs[2].get_text(strip=True)
            if not subcategory:
                subcategory = breadcrumbs[3].get_text(strip=True)
                
    # 4. Word Count
    word_count = None
    for box in soup.select(".T-R-Md-Bobx1"):
        text = box.get_text()
        if "已写" in text:
            spans = box.select("span.SZspan")
            if spans:
                word_count = "".join([span.get_text(strip=True) for span in spans])
                
    # 5. Latest/Max Chapter from HTML
    # Let's find all links matching book_id_chapter.html
    # In b.faloo.com, the links are like: //b.faloo.com/1457128_1.html
    # Let's match the pattern \d+_\d+\.html
    chapter_links = []
    max_chapter = 0
    
    # We can also extract book ID from one of the links
    book_id = None
    for a in soup.find_all("a", href=True):
        href = a["href"]
        match = re.search(r'/(\d+)[_/]', href)
        if match:
            book_id = match.group(1)
            break
            
    if book_id:
        for a in soup.find_all("a", href=True):
            href = a["href"]
            # Look for 1457128_X.html
            ch_match = re.search(rf'{book_id}_(\d+)\.html', href)
            if ch_match:
                ch_num = int(ch_match.group(1))
                if ch_num > max_chapter:
                    max_chapter = ch_num
                    
    print("=== INSPECT FALOO HTML ===")
    print(f"Book ID: {book_id}")
    print(f"Title: {title}")
    print(f"Author: {author}")
    print(f"Category: {category}")
    print(f"Subcategory: {subcategory}")
    print(f"Word Count: {word_count}")
    print(f"Max Chapter Found: {max_chapter}")

if __name__ == "__main__":
    inspect_html()
