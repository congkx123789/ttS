import os
from src.utils.logger import log_info, log_warning

class ChineseAnalyzer:
    def __init__(self, config=None):
        self.config = config or {}
        self.has_jieba = False
        self.has_pos = False
        
        # Try loading Jieba
        try:
            import jieba
            import jieba.posseg as pseg
            self.jieba = jieba
            self.pseg = pseg
            self.has_jieba = True
            log_info("Đã tải thư viện Jieba thành công.")
            
            # Load user dictionary if configured
            dict_path = self.config.get("paths", {}).get("dictionaries", {}).get("jieba_user_dict")
            if dict_path:
                # Resolve relative path from project root
                # Assuming config.yaml is in project root
                if os.path.exists(dict_path):
                    self.jieba.load_userdict(dict_path)
                    log_info(f"Đã tải từ điển tùy chỉnh cho Jieba từ: {dict_path}")
                else:
                    # Try checking relative to this script
                    alt_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), dict_path)
                    if os.path.exists(alt_path):
                        self.jieba.load_userdict(alt_path)
                        log_info(f"Đã tải từ điển tùy chỉnh cho Jieba từ: {alt_path}")
                    else:
                        log_warning(f"Không tìm thấy file từ điển Jieba tại: {dict_path}")
        except ImportError:
            log_warning("Chưa cài đặt thư viện 'jieba'. Sử dụng công cụ chia từ mặc định (fallback).")

    def segment(self, text):
        """Tokenize text into words."""
        if self.has_jieba:
            return list(self.jieba.cut(text))
        else:
            # Fallback: simple character split (not ideal, but guarantees it runs)
            return list(text)

    def analyze(self, text):
        """Perform word segmentation and POS tagging."""
        if self.has_jieba:
            words_with_tags = self.pseg.cut(text)
            return [{"word": w, "pos": t} for w, t in words_with_tags]
        else:
            # Fallback: POS is unknown (x)
            return [{"word": char, "pos": "x"} for char in text]
            
    def get_structure_tokens(self, text):
        """Helper to get a flat list of words from text for simple matches."""
        return [token["word"] for token in self.analyze(text)]
