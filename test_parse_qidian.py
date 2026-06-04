from bs4 import BeautifulSoup
import re

def test_parse():
    with open("qidian_book.html", "r", encoding="utf-8") as f:
        html = f.read()
        
    soup = BeautifulSoup(html, "html.parser")
    
    # Let's search for book title
    # The page title was "天幕：摸金完美世界，被斗罗直播..."
    # Let's search all tags containing "天幕" or "摸金"
    for tag in soup.find_all(True):
        if tag.name in ['h1', 'h2', 'span', 'p', 'a', 'em'] and tag.get_text() and "天幕" in tag.get_text():
            print(f"[{tag.name}] class={tag.get('class')}, id={tag.get('id')}: {tag.get_text(strip=True)[:100]}")
            
    print("\n--- Writer Info ---")
    for tag in soup.find_all(True):
        if tag.name in ['span', 'p', 'a', 'em'] and tag.get_text() and "年少不可得之物" in tag.get_text():
            print(f"[{tag.name}] class={tag.get('class')}: {tag.get_text(strip=True)[:100]}")

    print("\n--- Breadcrumbs or categories ---")
    # Let's search for category tags like "轻小说" or similar in perfect world tags
    for tag in soup.find_all("a", href=re.compile(r'chanId|subId|category|genre')):
        print(f"Category link: href={tag.get('href')}, text={tag.get_text(strip=True)}")

if __name__ == "__main__":
    test_parse()
