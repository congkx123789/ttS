from bs4 import BeautifulSoup

def test():
    with open("qidian_book.html", "r", encoding="utf-8") as f:
        html = f.read()
    soup = BeautifulSoup(html, "html.parser")
    for a in soup.find_all("a"):
        if "轻小说" in a.get_text():
            print("Found Light Novel link:", a)
            print("Parent:", a.parent)
            print("Parent Parent:", a.parent.parent)

if __name__ == "__main__":
    test()
