from playwright.sync_api import sync_playwright
import os

# Đường dẫn test (Vì Qidian chặn headless bot, ta dùng Wikipedia Tiếng Trung để demo)
URL = "https://zh.wikipedia.org/wiki/%E4%B8%AD%E5%9B%BD"

def run():
    with sync_playwright() as p:
        print("Mở trình duyệt Chromium (tắt bảo mật để cho phép kết nối localhost HTTP)...")
        browser = p.chromium.launch(headless=True, args=["--disable-web-security"])
        page = browser.new_page()
        
        print(f"Truy cập vào Wikipedia: {URL}")
        page.goto(URL, timeout=60000)
        
        try:
            page.wait_for_selector("#mw-content-text", timeout=10000)
            print("Đã tải xong nội dung truyện/bài viết.")
        except Exception as e:
            print("Không tìm thấy nội dung, có thể trang web tải chậm.")

        print("Đang cào chữ Hán bằng TreeWalker siêu cấp và gửi sang server dịch...")
        
        # Tiêm script TreeWalker vào thẳng trình duyệt và gọi API dịch
        # Đây chính là kịch bản mô phỏng 100% giống Content Script của Extension!
        translated_count = page.evaluate("""
            async () => {
                const rootElement = document.body;
                const walker = document.createTreeWalker(
                    rootElement,
                    NodeFilter.SHOW_TEXT,
                    {
                        acceptNode: function(node) {
                            const parentName = node.parentNode.nodeName;
                            if (parentName === 'SCRIPT' || 
                                parentName === 'STYLE' || 
                                parentName === 'NOSCRIPT' ||
                                node.nodeValue.trim() === '') {
                                return NodeFilter.FILTER_REJECT;
                            }
                            return NodeFilter.FILTER_ACCEPT;
                        }
                    },
                    false
                );

                let node;
                let textNodesToTranslate = [];
                let extractedParagraphs = [];

                while ((node = walker.nextNode())) {
                    let originalText = node.nodeValue;
                    if (/[\\u4e00-\\u9fa5]/.test(originalText)) {
                        let cleanText = originalText.replace(/[\\u200B-\\u200D\\uFEFF]/g, '').replace(/\\s+/g, ' ').trim();
                        textNodesToTranslate.push(node);
                        extractedParagraphs.push(cleanText);
                    }
                }

                if (extractedParagraphs.length === 0) return 0;

                try {
                    const res = await fetch("http://localhost:5050/translate", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ texts: extractedParagraphs })
                    });
                    
                    const data = await res.json();
                    
                    if (data.translations) {
                        data.translations.forEach((translatedText, i) => {
                            // Cập nhật giá trị văn bản nguyên gốc (Text Node)
                            textNodesToTranslate[i].nodeValue = translatedText;
                        });
                        return data.translations.length;
                    }
                } catch(e) {
                    return -1;
                }
                return 0;
            }
        """)

        print(f"Hoàn tất! Đã thay thế thành công {translated_count} node chữ Hán bằng bản dịch Việt trực tiếp tại DOM.")

        # Chụp màn hình kết quả
        output_image = "/home/alida/.gemini/antigravity/brain/48dc74e2-79a4-43df-b520-56ae0b30918b/.tempmediaStorage/wiki_treewalker_translated.png"
        os.makedirs(os.path.dirname(output_image), exist_ok=True)
        page.screenshot(path=output_image, full_page=True)
        print(f"Đã chụp ảnh kết quả lưu tại: {output_image}")

        browser.close()

if __name__ == "__main__":
    run()
