# Hướng Dẫn Sử Dụng Cấu Trúc Tool Phân Tích Cú Pháp & Dịch Thuật Trung-Việt

Tài liệu này hướng dẫn chi tiết về cấu trúc thư mục tiêu chuẩn, cách cài đặt, vận hành thử nghiệm và các phương án nâng cao độ chính xác của mô hình phân tích ngữ pháp Trung-Việt.

---

## I. Cấu Trúc Thư Mục Tiêu Chuẩn

Dự án được tổ chức theo mô hình mô-đun hóa, giúp bạn dễ dàng mở rộng từ các tập luật đơn giản (Rule-based) lên đến các mô hình Học sâu (Deep Learning) và Mô hình ngôn ngữ lớn (LLMs).

```text
dịch/
├── config.yaml                  # Cấu hình hệ thống (paths, default models)
├── requirements.txt             # Danh sách thư viện Python cần thiết
├── demo.py                      # Kịch bản chạy demo quy trình phân tích và dịch
├── config/
│   └── grammar_rules.yaml       # Tập luật định nghĩa cấu trúc ngữ pháp (Pattern Matching)
├── dictionaries/
│   ├── user_dict_jieba.txt      # Từ điển người dùng cho Jieba (Tiếng Trung)
│   └── user_dict_underthesea.txt# Từ điển người dùng cho Underthesea (Tiếng Việt)
├── src/
│   ├── __init__.py
│   ├── analyzer/                # Các bộ phân tích cú pháp nâng cao
│   │   ├── __init__.py
│   │   ├── chinese_analyzer.py  # Xử lý tiếng Trung (Jieba / HanLP)
│   │   ├── vietnamese_analyzer.py # Xử lý tiếng Việt (Underthesea / PhoNLP)
│   │   └── grammar_matcher.py   # Nhận diện cấu trúc ngữ pháp đặc thù
│   ├── translator/              # Bộ biên dịch cấu trúc
│   │   ├── __init__.py
│   │   ├── structure_translator.py # Dịch dựa trên ánh xạ cấu trúc vế câu
│   │   └── llm_connector.py     # Cổng kết nối LLMs để dịch nâng cao (SFT)
│   └── utils/
│       ├── __init__.py
│       └── logger.py            # Hỗ trợ in log màu trực quan trên terminal
└── models/                      # Thư mục lưu trữ model local (VnCoreNLP, PhoNLP, HanLP, v.v.)
```

---

## II. Hướng Dẫn Cài Đặt Môi Trường

### 1. Cài đặt các thư viện cần thiết
Mở Terminal tại thư mục `dịch/` và chạy lệnh sau để cài đặt các thư viện:

```bash
pip install -r requirements.txt
```

*(Lưu ý: Nếu bạn muốn chạy các mô hình học sâu chuyên biệt, hãy bỏ chú thích trong file `requirements.txt` và cài thêm PyTorch / Java JRE tương ứng).*

---

## III. Hướng Dẫn Vận Hành Thử Nghiệm

Chạy file demo để kiểm tra quy trình từ tách từ (Tokenization), gán nhãn từ loại (POS Tagging), đối khớp cú pháp (Grammar Matching) cho tới tái cấu trúc dịch:

```bash
python demo.py
```

### Kết quả mong đợi trên Terminal:
1. **Phân tích từ loại (POS):** Phân rã câu tiếng Trung thành các token kèm theo nhãn từ loại tương ứng (ví dụ: `虽然(c) | 中文(nz) | 很难(a)...`).
2. **Nhận diện cấu trúc ngữ pháp:** Tự động phát hiện cấu trúc `虽然...但是...` hoặc `因为...所以...`, tách các vế câu chính xác và tiến hành dịch ngữ nghĩa cấu trúc.
3. **Mô phỏng LLM SFT:** Minh họa đầu ra dạng cấu trúc cây cú pháp chuẩn JSON thu được từ một mô hình ngôn ngữ lớn sau khi được tinh chỉnh.

---

## IV. Phương Án Nâng Cấp Độ Chính Xác (3 Cấp Độ)

### Cấp độ 1: Thêm Từ Điển Tùy Chỉnh (User Dictionary) — *Dễ & Nhẹ nhất*
Khi gặp các từ ghép mới, tên riêng hoặc thuật ngữ chuyên ngành bị tách sai nghĩa:
* **Tiếng Trung:** Thêm từ vào `dictionaries/user_dict_jieba.txt` theo định dạng: `từ_khóa trọng_số nhãn_từ_loại` (Ví dụ: `人工智能 1000 n`).
* **Tiếng Việt:** Thêm từ vào `dictionaries/user_dict_underthesea.txt` (mỗi dòng một từ/cụm từ).

### Cấp độ 2: Huấn Luyện Lại (Fine-tune) Mô Hình Nhỏ (PhoNLP / HanLP)
Dành cho bài toán phân tích cú pháp phụ thuộc (Dependency Parsing) trên văn bản chuyên sâu:
1. **Chuẩn bị dữ liệu:** Gán nhãn thủ công khoảng 5,000 - 10,000 câu theo chuẩn CoNLL-U.
2. **Huấn luyện:** Đóng băng các tầng Transformer cơ sở (PhoBERT/Electra) và huấn luyện lại các Classifier Head phía trên bằng PyTorch.

### Cấp độ 3: Khai Thác Open-weight LLMs và SFT (LoRA/QLoRA)
Phương pháp mạnh mẽ nhất hiện nay để xử lý cấu trúc câu phức tạp:
1. **Chuẩn bị dataset:** Tạo một file `dataset.json` chứa các cặp:
   ```json
   {
     "instruction": "Phân tích cấu trúc câu và dịch sang tiếng Việt",
     "input": "虽然中文很难，但是他坚持学习。",
     "output": "{\"grammar_structures\": [\"虽然...但是...\"], \"clauses\": [{\"zh\": \"虽然中文很难\", \"vi\": \"tuy tiếng Trung rất khó\"}, {\"zh\": \"但是他坚持学习\", \"vi\": \"nhưng anh ấy vẫn kiên trì học tập\"}], \"vietnamese_translation\": \"Tuy tiếng Trung rất khó, nhưng anh ấy vẫn kiên trì học tập.\"}"
   }
   ```
2. **Fine-tune:** Sử dụng công cụ **LLaMA-Factory** để huấn luyện mô hình **Qwen 2.5 (1.5B hoặc 3B)** với kỹ thuật LoRA.
3. **Triển khai:** Chạy local model qua Ollama hoặc vLLM và tích hợp vào hệ thống thông qua `LLMConnector`.
