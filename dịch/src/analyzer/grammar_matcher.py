import os
import yaml
from src.utils.logger import log_info, log_warning, log_structure

class GrammarMatcher:
    def __init__(self, config=None, rules_path=None):
        self.config = config or {}
        self.rules = []
        
        # Determine rules path
        if not rules_path:
            rules_path = self.config.get("paths", {}).get("dictionaries", {}).get("custom_grammar_rules")
            if not rules_path:
                rules_path = "config/grammar_rules.yaml"
                
        self.load_rules(rules_path)

    def load_rules(self, rules_path):
        """Loads grammar rules from a YAML configuration file."""
        if os.path.exists(rules_path):
            try:
                with open(rules_path, "r", encoding="utf-8") as f:
                    data = yaml.safe_load(f)
                    self.rules = data.get("rules", [])
                log_info(f"Đã tải {len(self.rules)} quy tắc ngữ pháp từ: {rules_path}")
            except Exception as e:
                log_warning(f"Lỗi khi đọc file quy tắc ngữ pháp: {e}")
                self._load_default_rules()
        else:
            # Fallback path check
            alt_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), rules_path)
            if os.path.exists(alt_path):
                try:
                    with open(alt_path, "r", encoding="utf-8") as f:
                        data = yaml.safe_load(f)
                        self.rules = data.get("rules", [])
                    log_info(f"Đã tải {len(self.rules)} quy tắc ngữ pháp từ: {alt_path}")
                except Exception as e:
                    log_warning(f"Lỗi khi đọc file quy tắc ngữ pháp: {e}")
                    self._load_default_rules()
            else:
                log_warning(f"Không tìm thấy file quy tắc ngữ pháp. Khởi tạo quy tắc mặc định.")
                self._load_default_rules()

    def _load_default_rules(self):
        """Fallback hardcoded rules if config is missing."""
        self.rules = [
            {
                "id": "concession_although",
                "name": "Cấu trúc Nhượng bộ (Tuy... Nhưng...)",
                "pattern_zh_words": ["虽然", "但是"],
                "pattern_vi": "Tuy... nhưng...",
                "description": "Biểu thị quan hệ nhượng bộ"
            },
            {
                "id": "cause_effect",
                "name": "Cấu trúc Nhân quả (Vì... Nên...)",
                "pattern_zh_words": ["因为", "所以"],
                "pattern_vi": "Vì... nên...",
                "description": "Biểu thị quan hệ nguyên nhân - kết quả"
            }
        ]

    def match_sentence(self, sentence, tokens=None):
        """
        Analyzes a sentence and matches it against loaded grammar rules.
        Returns a list of match dictionary results.
        """
        matches = []
        for rule in self.rules:
            keywords = rule.get("pattern_zh_words", [])
            if not keywords and "pattern_zh" in rule:
                keywords = rule["pattern_zh"]
                
            if not keywords or len(keywords) < 2:
                continue
                
            # Simple keyword position checking
            positions = []
            found_all = True
            
            for kw in keywords:
                idx = sentence.find(kw)
                if idx == -1:
                    found_all = False
                    break
                positions.append((kw, idx))
                
            if found_all:
                # Verify key terms order (e.g., although must precede but)
                in_order = True
                for i in range(len(positions) - 1):
                    if positions[i][1] >= positions[i+1][1]:
                        in_order = False
                        break
                        
                if in_order:
                    # Extract clauses based on keyword boundary markers
                    clauses = []
                    
                    # Clause 1: Between Kw[0] and Kw[1]
                    start_kw, start_idx = positions[0]
                    end_kw, end_idx = positions[1]
                    clause_1 = sentence[start_idx + len(start_kw):end_idx].strip(",， ")
                    clauses.append(clause_1)
                    
                    # Clause 2: After Kw[1]
                    clause_2 = sentence[end_idx + len(end_kw):].strip(",， 。.！!")
                    clauses.append(clause_2)
                    
                    match_result = {
                        "rule_id": rule.get("id"),
                        "rule_name": rule.get("name"),
                        "keywords": keywords,
                        "clauses": clauses,
                        "pattern_vi": rule.get("pattern_vi"),
                        "description": rule.get("description")
                    }
                    matches.append(match_result)
                    
                    # Log the structure found
                    log_structure(rule.get("name"), f"Phát hiện cấu trúc '{'...'.join(keywords)}' trong câu.")
                    
        return matches
