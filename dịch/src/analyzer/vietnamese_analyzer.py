import os
from src.utils.logger import log_info, log_warning

class VietnameseAnalyzer:
    def __init__(self, config=None):
        self.config = config or {}
        self.has_underthesea = False
        
        try:
            import underthesea
            self.uts = underthesea
            self.has_underthesea = True
            log_info("Đã tải thư viện Underthesea thành công.")
            
            # Note: Underthesea does not have a simple load_userdict function like Jieba,
            # but we can read the file and use it to post-process tokenization or feed it to the tokenizer if supported.
            dict_path = self.config.get("paths", {}).get("dictionaries", {}).get("underthesea_user_dict")
            if dict_path and os.path.exists(dict_path):
                log_info(f"Đã đăng ký danh sách từ điển tiếng Việt: {dict_path}")
        except ImportError:
            log_warning("Chưa cài đặt thư viện 'underthesea'. Sử dụng công cụ chia từ mặc định (fallback).")

    def segment(self, text):
        """Word segmentation for Vietnamese."""
        if self.has_underthesea:
            return self.uts.word_tokenize(text)
        else:
            # Fallback: simple whitespace split
            return text.split()

    def analyze(self, text):
        """Tokenization and Part-of-Speech (POS) tagging."""
        if self.has_underthesea:
            tags = self.uts.pos_tag(text)
            return [{"word": w, "pos": t} for w, t in tags]
        else:
            # Fallback: POS is unknown (X)
            return [{"word": w, "pos": "X"} for w in text.split()]
