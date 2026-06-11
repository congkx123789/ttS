import os
import sys
import re
import jieba.posseg as pseg

from backend.config import Config

NUM_RE = re.compile(r'^[0-9一二三四五六七八九十百千万几数多半两]+$')
PUNCT_SET = {',', '.', '!', '?', ';', ':', '"', '\'', '(', ')', '[', ']', '{', '}',
             '，', '。', '！', '？', '；', '：', '“', '”', '‘', '’', '（', '）', '【', '】', '《', '》', '、', '—', '～'}


class SimpleToken:
    def __init__(self, word, tag):
        self.word = word
        self.tag = tag
        self.translated = None
        
    @property
    def flag(self):
        return self.tag
        
    @flag.setter
    def flag(self, value):
        self.tag = value

class VietphraseEngine:
    def __init__(self, config=None):
        self.config = config or {}
        self.load_dictionaries()
        
        # Check translation mode
        self.translation_mode = self.config.get("translation", {}).get("mode", "advanced")
        if self.config.get("translation", {}).get("fast_mode", False):
            self.translation_mode = "fast"
            
        # Warm-up jieba
        import jieba
        try:
            # Fix segmenter splitting overlapping words like 重生于
            jieba.add_word("重生", tag="v")
            jieba.suggest_freq(("生", "于"), True)
            jieba.suggest_freq(("着", "重"), True)
            jieba.suggest_freq(("醉", "人"), True)
            # Tag grades as nouns instead of proper names (nr)
            jieba.add_word("高一", tag="n")
            jieba.add_word("高二", tag="n")
            jieba.add_word("高三", tag="n")
        except Exception as e:
            print("Error initializing custom word splits in Jieba:", e)

        # Always initialize both tokenizers to support dynamic mode switching
        self.jieba_tokenizer = jieba.dt
        self.pseg_dict = pseg.dt.word_tag_tab
        list(self.jieba_tokenizer.cut("暖洋洋"))
        list(pseg.cut("暖洋洋"))

    def load_dictionaries(self):
        paths = self.config.get("paths", {}).get("dictionaries", {})
        vp_path = paths.get("vietphrase", "")
        if not vp_path or not os.path.isabs(vp_path):
            vp_path = os.path.join(Config.ROOT_DIR, vp_path or "dictionaries/Vietphrase.txt")
            
        dict_dir = os.path.dirname(vp_path)
        
        # Check for encrypted .bin dictionaries first, then fallback to .txt
        def load_file_content(base_name):
            bin_file = os.path.join(dict_dir, base_name + ".bin")
            txt_file = os.path.join(dict_dir, base_name + ".txt")
            
            if os.path.exists(bin_file):
                # Decrypt XOR
                with open(bin_file, "rb") as f:
                    data = f.read()
                key_bytes = "quick_translator_secret_key_2026".encode("utf-8")
                key_len = len(key_bytes)
                repeated_key = (key_bytes * (len(data) // key_len + 1))[:len(data)]
                decrypted = bytes(a ^ b for a, b in zip(data, repeated_key))
                return decrypted.decode("utf-8")
            elif os.path.exists(txt_file):
                with open(txt_file, "r", encoding="utf-8") as f:
                    return f.read()
            return ""

        print("Loading dictionaries in VietphraseEngine...")
        self.char_dict = self.parse_dict_content(load_file_content("HanViet_CharDict"))
        
        # --- ADD HÁn Nôm FALLBACK ---
        import csv
        han_csv_path = os.path.join(dict_dir, "han_all_readings.csv")
        if os.path.exists(han_csv_path):
            try:
                with open(han_csv_path, 'r', encoding='utf-8') as f:
                    reader = csv.DictReader(f)
                    for row in reader:
                        char = row.get("Ký_tự", "").strip()
                        hv = row.get("Hán_Việt", "").strip()
                        if char and hv and char not in self.char_dict:
                            self.char_dict[char] = hv.replace("~", "")
                print("Loaded han_all_readings.csv as fallback for missing Chinese characters.")
            except Exception as e:
                print("Could not load han_all_readings.csv:", e)

        self.proper_names = self.parse_dict_content(load_file_content("Aligned_HanViet"), convert_to_simplified=True)
        
        vp_content = load_file_content("Vietphrase")
        self.vietphrase = self.parse_vietphrase_content(vp_content)
        print("Dictionaries loaded successfully.")

        # Build Tries for vietphrase and hanviet modes
        from .trie import Trie
        print("Building Tries for fast translation modes...")
        self.vietphrase_trie = Trie()
        # Insert proper names (priority 1)
        for k, v in self.proper_names.items():
            self.vietphrase_trie.insert(k, v, 1)
        # Insert Vietphrase (priority 2 - higher)
        for k, v in self.vietphrase.items():
            self.vietphrase_trie.insert(k, v, 2)
            
        self.hanviet_trie = Trie()
        # Insert proper names (priority 2)
        for k, v in self.proper_names.items():
            self.hanviet_trie.insert(k, v, 2)
        print("Tries built successfully.")

        # Register proper names in Jieba dictionary for fast modes
        import jieba
        for name in self.proper_names:
            jieba.add_word(name)

    def parse_dict_content(self, content, convert_to_simplified=False):
        dictionary = {}
        if content:
            to_simplified = lambda s: s
            if convert_to_simplified:
                try:
                    from hanziconv import HanziConv
                    to_simplified = HanziConv.toSimplified
                except ImportError:
                    pass

            for line in content.splitlines():
                line = line.strip()
                if not line or "=" not in line or line.startswith('#'):
                    continue
                parts = line.split("=", 1)
                key = parts[0].strip()
                val = self.clean_annotation(parts[1].strip())
                dictionary[to_simplified(key)] = val
        return dictionary

    def parse_vietphrase_content(self, content):
        dictionary = {}
        if content:
            for line in content.splitlines():
                line = line.strip()
                if not line or "=" not in line or line.startswith('#'):
                    continue
                parts = line.split("=", 1)
                left = parts[0].strip()
                right = self.clean_annotation(parts[1].strip())
                
                if "," in left and "," in right:
                    keys = [k.strip() for k in left.split(",") if k.strip()]
                    vals = [v.strip() for v in right.split(",") if v.strip()]
                    if len(keys) == len(vals):
                        for k, v in zip(keys, vals):
                            dictionary[k] = v
                        continue
                if left:
                    dictionary[left] = right
        return dictionary

    def is_number(self, word):
        return bool(re.match(r'^[0-9一二三四五六七八九十百千万几数多半两]+$', word))

    def capitalize_phrase(self, phrase):
        chars = 'a-zA-ZàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđĐ'
        pattern = f'[{chars}]+'
        return re.sub(pattern, lambda m: m.group(0).capitalize(), phrase)

    def clean_annotation(self, text, mode='vietphrase'):
        if not text:
            return ""
        # 1. Parse curly braces {meaning:reading}
        def repl_curly(match):
            content = match.group(1)
            if ':' in content:
                parts = content.split(':', 1)
                return parts[0].strip() if mode == 'vietphrase' else parts[1].strip()
            return content.strip()
            
        text = re.sub(r'\{([^{}]+)\}', repl_curly, text)
        
        # 2. Strip (*...) annotations
        text = re.sub(r'\s*\(\*[^)]*\)', '', text)
        
        return text.strip()

    def format_translation(self, raw_value, multi_option, word=None, prefer_hanviet=False):
        if not raw_value:
            return ""
        options = [o for o in raw_value.split("/") if o.strip()]
        
        # Deduplicate options while preserving order
        seen = set()
        deduped = []
        for o in options:
            if o not in seen:
                seen.add(o)
                deduped.append(o)
                
        if not deduped:
            return ""
            
        if multi_option and len(deduped) > 1:
            return f"{deduped[0]}[{'/'.join(deduped[1:])}]"
        
        # If multi-option is False, we have a word of length >= 2, and prefer_hanviet is True, prefer Hán Việt alignment
        if prefer_hanviet and word and len(word) >= 2 and len(deduped) > 1:
            hv_sets = []
            for char in word:
                readings = set()
                if char in self.char_dict:
                    for r in self.char_dict[char].split('/'):
                        r_clean = r.strip().lower()
                        if r_clean:
                            readings.add(r_clean)
                if readings:
                    hv_sets.append(readings)
                    
            best_option = deduped[0]
            best_score = -1
            
            for opt in deduped:
                opt_syllables = [w.strip().lower() for w in opt.split() if w.strip()]
                score = 0
                for r_set in hv_sets:
                    if any(r in opt_syllables for r in r_set):
                        score += 1
                if score > best_score:
                    best_score = score
                    best_option = opt
            if best_score > 0:
                return best_option

        return deduped[0]

    def clean_punctuation_spacing(self, text):
        if not text:
            return text
        
        # 1. Ensure exactly one space after commas, semicolons, colons, periods, question marks, and exclamation marks.
        # Avoid inserting space if the next character is a closing bracket, closing quote, space, or another punctuation.
        text = re.sub(r'([,;.:!?])(?=[^\s)\]}』】”"’])', r'\1 ', text)
        
        # 2. Remove any accidental whitespace before these punctuation marks
        text = re.sub(r'\s+([,;.:!?])', r'\1', text)
        
        # 3. Clean spaces inside parentheses, brackets, and curly/double brackets (including Chinese quote styles)
        text = re.sub(r'([(\[{『【«])\s+', r'\1', text)
        text = re.sub(r'\s+([)\]}』】»])', r'\1', text)
        
        # Ensure a space exists before opening brackets and after closing brackets when they border words/digits
        text = re.sub(r'(?<=[^\s(\[{『【«])([(\[{『【«])', r' \1', text)
        text = re.sub(r'([)\]}』】»])(?=[^\s.,;:!?)\]}』】»])', r'\1 ', text)
        
        # 4. Standardize dashes/hyphens used as separators (e.g. "Artist - Song") to have one space on each side
        text = re.sub(r'\s*-\s*', ' - ', text)
        
        # 5. Clean up any duplicated/trailing whitespaces
        text = re.sub(r'\s+', ' ', text).strip()
        
        return text

    def translate_sentence(self, sentence, multi_option=False, mode=None):
        if not sentence or sentence.isspace():
            return ""
            
        # If the sentence doesn't contain any Chinese characters or symbols, preserve it as-is
        if not re.search(r'[\u3400-\u9fff\U00020000-\U0002a6df\u3000-\u303f\uff00-\uffef]', sentence):
            return sentence
            
        # Segment into Chinese text blocks and non-Chinese text blocks
        # Keep Chinese characters and Chinese specific punctuations in the translation segment
        chinese_pattern = re.compile(r'([\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]+)')
        parts = chinese_pattern.split(sentence)
        
        # Merge simple alphanumeric non-Chinese blocks into adjacent Chinese blocks
        i = 1
        while i < len(parts) - 1:
            non_chinese = parts[i+1]
            if re.match(r'^\s*[a-zA-Z0-9]+\s*$', non_chinese):
                parts[i] = parts[i] + non_chinese + parts[i+2]
                parts.pop(i+1)
                parts.pop(i+1)
            else:
                i += 2
                
        translated_parts = []
        capitalize_next = True
        
        for part in parts:
            if not part:
                continue
            if not re.search(r'[\u3400-\u9fff\U00020000-\U0002a6df\u3000-\u303f\uff00-\uffef]', part):
                # Non-Chinese segment -> preserve exactly
                translated_parts.append(part)
                # Check if it ends with sentence terminator
                if re.search(r'[.!?]\s*$', part):
                    capitalize_next = True
                elif part.strip():
                    capitalize_next = False
            else:
                # Chinese segment -> translate
                trans = self._translate_pure_chinese_sentence(part, multi_option, mode, capitalize_first=capitalize_next)
                translated_parts.append(trans)
                # Check if it ends with sentence terminator
                if re.search(r'[.!?]\s*$', part) or re.search(r'[.!?]\s*$', trans):
                    capitalize_next = True
                else:
                    capitalize_next = False
                    
        return "".join(translated_parts)

    def _translate_pure_chinese_sentence(self, sentence, multi_option=False, mode=None, capitalize_first=True):
        if not sentence or sentence.isspace():
            return ""
            
        active_mode = mode or self.translation_mode
        
        # Tokenization & Tagging depending on mode
        if active_mode in ("advanced", "advanced_hanviet"):
            raw_tokens = [SimpleToken(t.word, t.flag) for t in pseg.cut(sentence)]
        else:
            # "fast", "vietphrase", "hanviet" modes use the fast tokenizer
            words = list(self.jieba_tokenizer.cut(sentence))
            raw_tokens = []
            for w in words:
                if w in PUNCT_SET:
                    tag = 'x'
                elif NUM_RE.match(w):
                    tag = 'm'
                else:
                    tag = self.pseg_dict.get(w, 'n')
                raw_tokens.append(SimpleToken(w, tag))
                
        if not raw_tokens:
            return ""
            
        NUM_KEYWORDS = {"重", "阶", "品", "级", "层", "剑", "星", "转", "天", "色", "关", "重天"}
        HANVIET_NUMBERS = {
            '0': 'Không', '1': 'Nhất', '2': 'Nhị', '3': 'Tam', '4': 'Tứ', '5': 'Ngũ', '6': 'Lục', '7': 'Thất', '8': 'Bát', '9': 'Cửu', '10': 'Thập',
            '一': 'Nhất', '二': 'Nhị', '三': 'Tam', '四': 'Tứ', '五': 'Ngũ', '六': 'Lục', '七': 'Thất', '八': 'Bát', '九': 'Cửu', '十': 'Thập',
            '百': 'Bách', '千': 'Thiên', '万': 'Vạn', '萬': 'Vạn', '几': 'Vài', '数': 'Số', '多': 'Đa', '半': 'Bán', '两': 'Lưỡng', '兩': 'Lưỡng'
        }
        # Helper function to translate a single token
        def translate_single_token(idx, tok, list_of_tokens):
            word = tok.word
            tag = tok.tag
            
            # Punctuation
            is_punct = (tag == 'x' or word in {',', '.', '!', '?', ';', ':', '"', '(', ')', '[', ']', '{', '}'})
            if is_punct:
                has_chinese = False
                for char in word:
                    if char in self.char_dict:
                        has_chinese = True
                        break
                if not has_chinese:
                    punct_map = {
                        '，': ',', '。': '.', '「': '"', '」': '"', '、': ',', '？': '?', '！': '!',
                        '：': ':', '；': ';', '“': '"', '”': '"', '（': '(', '）': ')'
                    }
                    tok.translated = punct_map.get(word, word)
                    return
                
            # Rule for number + 人 (e.g. 几十人, 三人)
            if len(word) > 1 and word.endswith('人') and self.is_number(word[:-1]):
                num_part = word[:-1]
                if num_part in self.vietphrase:
                    num_trans = self.format_translation(self.vietphrase[num_part], multi_option, num_part)
                else:
                    num_trans = " ".join([self.char_dict.get(c, c).split("/")[0] for c in num_part])
                tok.translated = f"{num_trans} người"
                return
                
            # Special rule for 了 (le vs liao)
            if word == 'l' or word == '了':
                is_at_end = True
                for next_tok in list_of_tokens[idx+1:]:
                    if next_tok.word in {'"', '\'', '(', ')', '[', ']', '{', '}', '“', '”', '‘', '’', '（', '）', '【', '】', '《', '》'}:
                        continue
                    if next_tok.word in {',', '.', '!', '?', ';', ':', '，', '。', '！', '？', '；', '：', '、'}:
                        is_at_end = True
                        break
                    is_at_end = False
                    break
                if is_at_end:
                    tok.translated = "rồi"
                else:
                    tok.translated = "được"
                return
                
            # Cultivation Realm (cultivation)
            if tag == 'cultivation':
                result = []
                for char in word:
                    if char in HANVIET_NUMBERS:
                        result.append(HANVIET_NUMBERS[char])
                    else:
                        cap_val = self.char_dict.get(char, char).split("/")[0].capitalize()
                        result.append(cap_val)
                tok.translated = " ".join(result)
                return
                
            # Determine if it's a noun or an adjective
            is_proper = (tag in {'nr', 'ns', 'nt'} if tag else False)
            is_noun = (tag.startswith('n') if tag else False) or tag in {'n', 'nz', 'ng'} if tag else False
            is_adj = tag in {'a', 'b', 'ad', 'an', 'z'} if tag else False
            is_noun_or_adj = is_proper or is_noun or is_adj
            
            # --- Chốt chặn cuối cùng cho Tên riêng (Proper Names Guard) ---
            if is_proper:
                if word in self.proper_names:
                    tok.translated = self.format_translation(self.proper_names[word], multi_option, word, prefer_hanviet=True)
                else:
                    if not re.search(r'[\u3400-\u9fff\U00020000-\U0002a6df]', word):
                        tok.translated = word
                    else:
                        result = []
                        for char in word:
                            val = self.char_dict.get(char, char).split("/")[0]
                            result.append(val)
                        tok.translated = " ".join(result)
                if tok.translated:
                    tok.translated = self.capitalize_phrase(tok.translated)
            
            # --- Translate lookup strategy depending on active_mode (for non-proper names) ---
            else:
                if active_mode == 'hanviet':
                    # Mode 4: Pure Hán Việt (NO Vietphrase)
                    if word in self.proper_names:
                        tok.translated = self.format_translation(self.proper_names[word], multi_option, word, prefer_hanviet=True)
                    else:
                        if not re.search(r'[\u3400-\u9fff\U00020000-\U0002a6df]', word):
                            tok.translated = word
                        else:
                            result = []
                            for char in word:
                                val = self.char_dict.get(char, char).split("/")[0]
                                result.append(val)
                            tok.translated = " ".join(result)

                elif active_mode == 'vietphrase':
                    # Mode 3: Prioritize Vietphrase (Traditional)
                    if word in self.vietphrase:
                        tok.translated = self.format_translation(self.vietphrase[word], multi_option, word, prefer_hanviet=False)
                    elif word in self.proper_names:
                        tok.translated = self.format_translation(self.proper_names[word], multi_option, word, prefer_hanviet=True)
                    else:
                        if not re.search(r'[\u3400-\u9fff\U00020000-\U0002a6df]', word):
                            tok.translated = word
                        else:
                            result = []
                            for char in word:
                                val = self.char_dict.get(char, char).split("/")[0]
                                result.append(val)
                            tok.translated = " ".join(result)

                else:
                    # Modes 1, 2 & 5: 'fast', 'advanced', or 'advanced_hanviet' (POS-based noun/adjective Hán Việt override)
                    if is_noun_or_adj:
                        # Nouns/Adjectives: Bypasses vietphrase
                        if word in self.proper_names:
                            tok.translated = self.format_translation(self.proper_names[word], multi_option, word, prefer_hanviet=True)
                        else:
                            if not re.search(r'[\u3400-\u9fff\U00020000-\U0002a6df]', word):
                                tok.translated = word
                            else:
                                result = []
                                for char in word:
                                    val = self.char_dict.get(char, char).split("/")[0]
                                    result.append(val)
                                tok.translated = " ".join(result)
                    else:
                        # Verbs and other parts of speech
                        if active_mode == 'advanced_hanviet':
                            # Prefer HanViet dictionary (proper_names) over Vietphrase
                            if word in self.proper_names:
                                tok.translated = self.format_translation(self.proper_names[word], multi_option, word, prefer_hanviet=True)
                            elif word in self.vietphrase:
                                tok.translated = self.format_translation(self.vietphrase[word], multi_option, word, prefer_hanviet=False)
                            else:
                                if not re.search(r'[\u3400-\u9fff\U00020000-\U0002a6df]', word):
                                    tok.translated = word
                                else:
                                    result = []
                                    for char in word:
                                        val = self.char_dict.get(char, char).split("/")[0]
                                        result.append(val)
                                    tok.translated = " ".join(result)
                        else:
                            # Standard fast/advanced: vietphrase -> proper_names -> character fallback
                            if word in self.vietphrase:
                                tok.translated = self.format_translation(self.vietphrase[word], multi_option, word, prefer_hanviet=False)
                            elif word in self.proper_names:
                                tok.translated = self.format_translation(self.proper_names[word], multi_option, word, prefer_hanviet=True)
                            else:
                                if not re.search(r'[\u3400-\u9fff\U00020000-\U0002a6df]', word):
                                    tok.translated = word
                                else:
                                    result = []
                                    for char in word:
                                        val = self.char_dict.get(char, char).split("/")[0]
                                        result.append(val)
                                    tok.translated = " ".join(result)
            
            # Strip trailing "đích" / "Đích" from modifier translations
            if tok.translated and word.endswith('的') and len(word) > 1:
                val = tok.translated
                if val.lower().endswith(' đích'):
                    tok.translated = val[:-5]
                elif val.lower().endswith('đích'):
                    tok.translated = val[:-4]

        # Step 1: Group numeral phrases and cultivation terms FIRST
        grouped = []
        i = 0
        while i < len(raw_tokens):
            tok = raw_tokens[i]
            word = tok.word
            tag = tok.tag
            
            if self.is_number(word) and i + 1 < len(raw_tokens) and raw_tokens[i+1].word in NUM_KEYWORDS:
                grouped_word = word + raw_tokens[i+1].word
                i_next = i + 2
                if i_next < len(raw_tokens) and raw_tokens[i_next].tag in {'n', 'nr', 'ns', 'nt', 'nz'}:
                    grouped_word += raw_tokens[i_next].word
                    i_next += 1
                grouped.append(SimpleToken(grouped_word, 'cultivation'))
                i = i_next
            else:
                grouped.append(SimpleToken(word, tag))
                i += 1

        # Step 2: Translate individual tokens on the cultivation-grouped tokens
        for idx, tok in enumerate(grouped):
            translate_single_token(idx, tok, grouped)

        # Step 3: Greedy merge adjacent tokens if their combination exists in dictionaries
        i = 0
        merged = []
        while i < len(grouped):
            matched = False
            for length in range(min(4, len(grouped) - i), 1, -1):
                combined_word = "".join([grouped[i+k].word for k in range(length)])
                
                # Prevent merging across '的' particle to preserve root Hán Việt translation and allow reordering
                should_skip = False
                if 'đích' in combined_word or '的' in combined_word and combined_word.find('的') > 0:
                    should_skip = True
                elif i + length < len(grouped) and grouped[i+length].word == '的':
                    # If next token is 'de' (de/的), don't merge if it would swallow a pronoun/noun/verb
                    last_tok = grouped[i+length-1]
                    if last_tok.flag in {'r', 'n', 'nr', 'ns', 'nt', 'nz', 'ng', 'v'}:
                        should_skip = True
                elif '是' in combined_word and any(p in combined_word for p in {'我', '你', 'he', 'she', 'it', '们', '您', '自己'}):
                    # Prevent merging copula + pronoun phrases (like '这是他', '那是我') to allow proper clause reordering
                    should_skip = True
                    
                # Dict check strategy depends on active_mode
                if active_mode == 'hanviet':
                    in_dicts = (combined_word in self.proper_names)
                else:
                    in_dicts = (combined_word in self.vietphrase or combined_word in self.proper_names)

                if not should_skip and in_dicts:
                    combined_tag = None
                    try:
                        cut_res = list(pseg.cut(combined_word))
                        if cut_res:
                            combined_tag = cut_res[0].flag
                    except Exception:
                        pass
                    if not combined_tag:
                        combined_tag = grouped[i].flag
                        for k in range(length):
                            if grouped[i+k].flag in {'nr', 'ns', 'nt', 'nz'}:
                                combined_tag = grouped[i+k].flag
                                break
                    new_tok = SimpleToken(combined_word, combined_tag)
                    # Translate the new merged token immediately
                    translate_single_token(0, new_tok, [new_tok])
                    merged.append(new_tok)
                    i += length
                    matched = True
                    break
            if not matched:
                merged.append(grouped[i])
                i += 1

        # Step 4: Reordering Grammar Rules
        if active_mode != 'hanviet':
            # Pass 1: Adjective + Noun reordering
            changed = True
            while changed:
                changed = False
                i = 0
            while i < len(merged) - 1:
                t_a = merged[i]
                t_n = merged[i+1]
                
                # Do not swap with prepositions/conjunctions/copulas/particles
                if t_n.word in {'跟', '和', '与', '與', '同', '在', '从', '從', '自', '由', '向', '往', '朝', '对', '對', '给', '給', '比', '是', '叫', '让', '讓', '被', '把', '使', '令', '到', '了', '的', '而', '&', '并', '並', '以', '或', '者'}:
                    i += 1
                    continue
                    
                if (t_a.tag in {'a', 'b'} or (t_a.word.endswith('的') and t_a.word != '的')) and t_n.tag in {'n', 'nr', 'ns', 'nt', 'nz', 'ng', 'v', 'vd', 'vg', 'vi', 'vn'}:
                    combined = t_n.translated + " " + t_a.translated
                    new_tok = SimpleToken(t_a.word + t_n.word, t_n.tag)
                    new_tok.translated = combined
                    merged[i:i+2] = [new_tok]
                    changed = True
                    break
                i += 1
            
        # Pass 2: "的" reordering (with multi-token noun/verb phrase lookahead)
        NOUN_PHRASE_TAGS = {'n', 'nr', 'ns', 'nt', 'nz', 'ng', 'a', 'b', 'm', 'q', 'j', 'i'}
        LOOKAHEAD_TAGS = NOUN_PHRASE_TAGS | {'v', 'vd', 'vg', 'vi', 'vn'}
        i = 1
        while i < len(merged) - 1:
            tok = merged[i]
            if tok.word in {'de', '的'}:
                t_x = merged[i-1]
                # Scan forward to collect all consecutive noun or verb phrase tokens
                k = i + 1
                has_noun = False
                while k < len(merged):
                    tok_k = merged[k]
                    # Stop collecting if we hit a locality word/orientation noun
                    if tok_k.word in {'下', '上', '中', '里', '外', '内', '內', '后', '後', '前', '旁', '侧', '側', '底', '间', '間'}:
                        break
                        
                    # If we already encountered a noun/verb in the phrase,
                    # we cannot have a subsequent adjective modifying that noun from the right.
                    if has_noun and tok_k.tag in {'a', 'b'}:
                        break
                    
                    # Do not collect a verb tag if we already have a noun/verb head
                    is_verb_tag = tok_k.tag in {'v', 'vd', 'vg', 'vi', 'vn'}
                    if has_noun and is_verb_tag:
                        break
                    
                    if tok_k.tag in LOOKAHEAD_TAGS or tok_k.word == '色':
                        if tok_k.tag in {'n', 'nr', 'ns', 'nt', 'nz', 'ng', 'v', 'vd', 'vg', 'vi', 'vn'}:
                            has_noun = True
                        k += 1
                    else:
                        break
                
                is_verb_modifier = t_x.tag in {'v', 'vd', 'vg', 'vi', 'vn'}
                
                # If we collected at least one token AND the modifier is not a verb clause
                if k > i + 1 and not is_verb_modifier:
                    y_tokens = merged[i+1:k]
                    y_translated = " ".join([t.translated for t in y_tokens if t.translated])
                    y_word = "".join([t.word for t in y_tokens])
                    
                    if t_x.tag != 'x':
                        start_idx = i - 1
                        j_back = i - 2
                        while j_back >= 0:
                            tag_back = merged[j_back].tag
                            if tag_back in {'n', 'nr', 'ns', 'nt', 'nz', 'ng', 'a', 'b', 'm', 'q', 'j', 'i', 's', 't'}:
                                start_idx = j_back
                                j_back -= 1
                            else:
                                break
                                
                        modifier_tokens = merged[start_idx:i]
                        modifier_translated = " ".join([t.translated for t in modifier_tokens if t.translated])
                        modifier_word = "".join([t.word for t in modifier_tokens])
                        
                        is_proper_or_pronoun = (
                            t_x.tag in {'nr', 'r'}
                        )
                        is_noun_modifier = is_proper_or_pronoun and not t_x.word.endswith('色')
                        if is_noun_modifier and start_idx == i - 1:
                            combined = y_translated + " của " + modifier_translated
                        else:
                            combined = y_translated + " " + modifier_translated
                        
                        new_tok = SimpleToken(modifier_word + tok.word + y_word, 'n')
                        new_tok.translated = combined
                        merged[start_idx:k] = [new_tok]
                        continue
                else:
                    # If we didn't reorder, set the '的' translation to empty string to avoid translating as 'đấy' / 'đích'
                    tok.translated = ""
            i += 1
            
        # Join words
        translated_text = " ".join([t.translated for t in merged if t.translated])
        
        # Clean spacing and punctuation
        translated_text = self.clean_punctuation_spacing(translated_text)
        
        # Capitalize sentences
        sentences = re.split(r'([.!?]\s*)', translated_text)
        start_idx = 0 if capitalize_first else 1
        for idx in range(start_idx, len(sentences)):
            s = sentences[idx]
            if s and not s.isspace() and not s[0] in {'.', '!', '?'}:
                for c_idx, char in enumerate(s):
                    if char.isalpha():
                        sentences[idx] = s[:c_idx] + char.upper() + s[c_idx+1:]
                        break
        return "".join(sentences).strip()

    def translate_paragraph(self, paragraph, multi_option=False, mode=None):
        if not paragraph or paragraph.isspace():
            return paragraph
            
        active_mode = mode or self.translation_mode
        
        if active_mode in ('vietphrase', 'hanviet'):
            # Ultra-fast Trie-based translation path (50M+ characters/minute)
            trie = self.vietphrase_trie if active_mode == 'vietphrase' else self.hanviet_trie
            prefer_hanviet = (active_mode == 'hanviet')
            
            i = 0
            text_length = len(paragraph)
            result_words = []
            
            while i < text_length:
                length, translation, priority = trie.search_longest_match(paragraph, i)
                if length > 0:
                    word = paragraph[i:i+length]
                    formatted = self.format_translation(translation, multi_option, word, prefer_hanviet=prefer_hanviet)
                    # Capitalize if it is a proper name
                    if priority == 1 or word in self.proper_names:
                        formatted = self.capitalize_phrase(formatted)
                    result_words.append(formatted)
                    i += length
                else:
                    char = paragraph[i]
                    if not re.search(r'[\u3400-\u9fff\U00020000-\U0002a6df]', char):
                        punct_map = {
                            '，': ',', '。': '.', '「': '"', '」': '"', '、': ',', '？': '?', '！': '!',
                            '：': ':', '；': ';', '“': '"', '”': '"', '（': '(', '）': ')',
                            '『': '"', '』': '"', '【': '[', '】': ']'
                        }
                        result_words.append(punct_map.get(char, char))
                    else:
                        val = self.char_dict.get(char, char).split("/")[0]
                        result_words.append(val)
                    i += 1
                    
            translated_text = " ".join(result_words)
            translated_text = self.clean_punctuation_spacing(translated_text)
            
            # Sentence Capitalization
            sentences = re.split(r'([.!?]\s*)', translated_text)
            for idx in range(len(sentences)):
                s = sentences[idx]
                if s and not s.isspace() and not s[0] in {'.', '!', '?'}:
                    for c_idx, char in enumerate(s):
                        if char.isalpha():
                            sentences[idx] = s[:c_idx] + char.upper() + s[c_idx+1:]
                            break
            return "".join(sentences).strip()

        # For advanced & fast modes, use normal sentence splitting & tokenization
        sentence_ends = re.compile(r'([。！？!?]+)')
        parts = sentence_ends.split(paragraph)
        
        translated_parts = []
        for part in parts:
            if not part:
                continue
            if sentence_ends.match(part):
                punct_map = {
                    '。': '.', '！': '!', '？': '?', '，': ','
                }
                translated_parts.append(punct_map.get(part, part))
            else:
                translated_parts.append(self.translate_sentence(part, multi_option, mode=mode))
                
        return self.clean_punctuation_spacing("".join(translated_parts))

    def translate_text_node(self, text, multi_option=False, mode=None):
        """
        Dich mot text node tu DOM.
        BAO TOAN HOAN TOAN cau truc: xuong dong \n, khoang trang dau/cuoi tung dong.
        """
        if not text:
            return text

        # Tach theo \n truoc -> dich tung dong doc lap -> gop lai
        lines = text.split('\n')
        translated_lines = []
        for line in lines:
            leading  = re.match(r'^\s*', line).group(0)
            trailing = re.search(r'\s*$', line).group(0)
            body = line.strip()

            if not body:
                translated_lines.append(line)  # dong rong -> giu nguyen
            elif not re.search(r'[\u3400-\u9fff\U00020000-\U0002a6df]', body):
                translated_lines.append(line)  # khong co chu Han -> giu nguyen
            else:
                translated_body = self.translate_paragraph(body, multi_option, mode=mode)
                translated_lines.append(leading + translated_body + trailing)

        return '\n'.join(translated_lines)

    def translate(self, text, multi_option=False, mode=None):
        return self.translate_text_node(text, multi_option=multi_option, mode=mode)
