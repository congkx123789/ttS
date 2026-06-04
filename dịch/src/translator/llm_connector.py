import json
import requests
from src.utils.logger import log_info, log_warning, log_success

class LLMConnector:
    def __init__(self, api_url="http://localhost:11434/api/generate", model_name="qwen2.5-sft-grammar"):
        self.api_url = api_url
        self.model_name = model_name

    def build_sft_prompt(self, sentence):
        """Constructs the instruction template used during SFT training."""
        return f"""Bạn là một hệ thống phân tích ngữ pháp tiếng Trung chuyên sâu.
Hãy phân tích cấu trúc cú pháp của câu tiếng Trung sau và trả về kết quả dưới định dạng JSON với các trường:
- "sentence": câu gốc
- "grammar_structures": danh sách các cấu trúc ngữ pháp được phát hiện (ví dụ: "虽然...但是...")
- "clauses": danh sách các vế câu tương ứng
- "vi_structure_template": cấu trúc dịch tiếng Việt tương ứng
- "vietnamese_translation": bản dịch tiếng Việt chuẩn ngữ pháp

Câu cần phân tích: "{sentence}"
JSON Output:"""

    def analyze_with_llm(self, sentence, mock=True):
        """
        Sends request to the fine-tuned LLM.
        If mock=True, simulates a correct SFT JSON response for demo purposes.
        """
        prompt = self.build_sft_prompt(sentence)
        
        if mock:
            log_info(f"Đang mô phỏng cuộc gọi đến LLM SFT ({self.model_name})...")
            # Simulate a fine-tuned model returning perfect JSON format
            if "虽然" in sentence and "但是" in sentence:
                mock_response = {
                    "sentence": sentence,
                    "grammar_structures": ["虽然...但是..."],
                    "clauses": [
                        {"zh": "虽然中文很难", "vi": "tuy tiếng Trung rất khó"},
                        {"zh": "但是他坚持学习", "vi": "nhưng anh ấy vẫn kiên trì học tập"}
                    ],
                    "vi_structure_template": "Tuy {clause_1}, nhưng {clause_2}",
                    "vietnamese_translation": "Tuy tiếng Trung rất khó, nhưng anh ấy vẫn kiên trì học tập."
                }
                log_success("Nhận kết quả phân tích cấu trúc từ LLM (Simulated).")
                return mock_response
            else:
                mock_response = {
                    "sentence": sentence,
                    "grammar_structures": ["Thường"],
                    "clauses": [{"zh": sentence, "vi": "dịch thô tự động"}],
                    "vi_structure_template": "{clause_1}",
                    "vietnamese_translation": f"[LLM Dịch: {sentence}]"
                }
                return mock_response

        # Real API call to Ollama or local LLaMA-Factory web server
        log_info(f"Đang gửi yêu cầu tới LLM local tại {self.api_url}...")
        payload = {
            "model": self.model_name,
            "prompt": prompt,
            "stream": False,
            "format": "json"
        }
        
        try:
            response = requests.post(self.api_url, json=payload, timeout=10)
            if response.status_code == 200:
                result = response.json()
                response_text = result.get("response", "{}")
                parsed_json = json.loads(response_text)
                log_success("Nhận phản hồi từ LLM thành công.")
                return parsed_json
            else:
                log_warning(f"Lỗi API từ local LLM (Status: {response.status_code})")
                return None
        except Exception as e:
            log_warning(f"Không thể kết nối đến local LLM: {e}. Vui lòng kiểm tra dịch vụ Ollama.")
            return None
