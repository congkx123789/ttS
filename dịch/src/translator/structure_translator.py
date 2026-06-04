from src.analyzer.grammar_matcher import GrammarMatcher
from src.utils.logger import log_info, log_success

class StructureTranslator:
    def __init__(self, config=None, analyzer=None):
        self.config = config or {}
        self.analyzer = analyzer
        self.matcher = GrammarMatcher(config=self.config)
        
        # Simple dictionary for clause demo translation
        self.demo_dictionary = {
            "中文很难": "tiếng Trung rất khó",
            "他坚持学习": "anh ấy vẫn kiên trì học tập",
            "今天下雨": "hôm nay trời mưa",
            "我们没去公园": "chúng tôi không đi công viên",
            "他会说汉语": "anh ấy biết nói tiếng Trung",
            "还会写汉字": "còn biết viết chữ Hán",
            "明天天气好": "ngày mai thời tiết tốt",
            "我们就去爬山": "chúng tôi sẽ đi leo núi",
            "努力": "nỗ lực",
            "一定能成功": "nhất định sẽ thành công"
        }

    def translate_clause(self, clause):
        """Translates a simple clause. Uses demo dictionary or a placeholder."""
        clause_stripped = clause.strip()
        if clause_stripped in self.demo_dictionary:
            return self.demo_dictionary[clause_stripped]
            
        # Try substring matching
        for k, v in self.demo_dictionary.items():
            if k in clause_stripped:
                return clause_stripped.replace(k, v)
                
        return f"[dịch: {clause_stripped}]"

    def translate(self, zh_sentence):
        """
        Translates a sentence by first checking for grammatical structures.
        If a structure matches, it translates the sub-clauses and embeds them in the target pattern.
        """
        matches = self.matcher.match_sentence(zh_sentence)
        
        if not matches:
            log_info("Không phát hiện cấu trúc đặc biệt. Tiến hành dịch từ-nối-từ hoặc chuyển tiếp cho LLM.")
            return self.translate_clause(zh_sentence)
            
        # Match found - use the first match for structure translation
        match = matches[0]
        pattern_vi = match["pattern_vi"]  # e.g. "Tuy... nhưng..."
        clauses = match["clauses"]        # e.g. ["中文很难", "他坚持学习"]
        
        # Translate each clause
        translated_clauses = [self.translate_clause(c) for c in clauses]
        
        # Reconstruct the sentence structure
        # Standard format is replacing "..." with translated clauses
        parts = pattern_vi.split("...")
        result = ""
        
        for i in range(len(translated_clauses)):
            part = parts[i].strip()
            clause = translated_clauses[i].strip()
            
            if result and not result.endswith(" ") and part:
                result += " "
            result += part
            if result and not result.endswith(" ") and clause:
                result += " "
            result += clause
            
        if len(parts) > len(translated_clauses):
            last_part = parts[-1].strip()
            if last_part:
                if result and not result.endswith(" "):
                    result += " "
                result += last_part
        
        # Clean up double punctuation or spaces
        result = result.replace("  ", " ").strip()
        
        log_success(f"Dịch cấu trúc thành công: {result}")
        return {
            "source": zh_sentence,
            "target": result,
            "grammar_detected": match["rule_name"],
            "clauses_zh": clauses,
            "clauses_vi": translated_clauses
        }
