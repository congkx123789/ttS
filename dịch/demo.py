#!/usr/bin/env python
# -*- coding: utf-8 -*-

import os
import yaml
from src.utils.logger import log_info, log_success, log_warning, log_error
from src.analyzer.chinese_analyzer import ChineseAnalyzer
from src.analyzer.vietnamese_analyzer import VietnameseAnalyzer
from src.translator.structure_translator import StructureTranslator
from src.translator.llm_connector import LLMConnector

def load_config():
    config_path = "config.yaml"
    if os.path.exists(config_path):
        with open(config_path, "r", encoding="utf-8") as f:
            return yaml.safe_load(f)
    return {}

def run_demo():
    print("="*60)
    log_success("HỆ THỐNG PHÂN TÍCH CẤU TRÚC NGỮ PHÁP & DỊCH THUẬT TRUNG-VIỆT")
    print("="*60)
    
    # 1. Load config
    config = load_config()
    log_info("Đã tải cấu hình dự án.")

    # 2. Khởi tạo các Analyzer
    zh_analyzer = ChineseAnalyzer(config=config)
    vi_analyzer = VietnameseAnalyzer(config=config)
    
    # 3. Mẫu câu test ngữ pháp đặc thù
    # Sentence 1: "虽然中文很难，但是他坚持学习。" (Tuy tiếng Trung rất khó, nhưng anh ấy vẫn kiên trì học tập.)
    # Sentence 2: "因为今天下雨，所以我们没去公园。" (Vì hôm nay trời mưa, nên chúng tôi không đi công viên.)
    test_sentences = [
        "虽然中文很难，但是他坚持学习。",
        "因为今天下雨，所以我们没去公园。"
    ]
    
    # --- DEMO PHÂN TÍCH TỪ VỰNG & GÁN NHÃN TỪ LOẠI (POS TAGGING) ---
    print("\n" + "-"*40)
    log_info("BƯỚC 1: PHÂN TÍCH TỪ VỰNG & POS TAGGING (BẰNG JIEBA)", prefix="[POS]")
    print("-"*40)
    for sent in test_sentences:
        log_info(f"Câu gốc: {sent}")
        tokens = zh_analyzer.analyze(sent)
        token_str = " | ".join([f"{t['word']}({t['pos']})" for t in tokens])
        print(f"   Kết quả POS: {token_str}\n")

    # --- DEMO PHÁT HIỆN CẤU TRÚC NGỮ PHÁP VÀ VẾ CÂU ---
    print("\n" + "-"*40)
    log_info("BƯỚC 2: PHÁT HIỆN CẤU TRÚC NGỮ PHÁP (RULE-BASED PATTERN MATCHING)", prefix="[GRAMMAR]")
    print("-"*40)
    translator = StructureTranslator(config=config, analyzer=zh_analyzer)
    
    for sent in test_sentences:
        log_info(f"Đang xử lý câu: {sent}")
        result = translator.translate(sent)
        if isinstance(result, dict):
            print(f"   ➔ Cấu trúc phát hiện: {result['grammar_detected']}")
            print(f"   ➔ Vế 1 (Zh): '{result['clauses_zh'][0]}' ➔ Dịch (Vi): '{result['clauses_vi'][0]}'")
            print(f"   ➔ Vế 2 (Zh): '{result['clauses_zh'][1]}' ➔ Dịch (Vi): '{result['clauses_vi'][1]}'")
            log_success(f"   ➔ Bản dịch cấu trúc: {result['target']}\n")
        else:
            print(f"   ➔ Kết quả dịch thô: {result}\n")

    # --- DEMO SỬ DỤNG OPEN-WEIGHT LLMs + SFT (MÔ PHỎNG CẤP ĐỘ 3) ---
    print("\n" + "-"*40)
    log_info("BƯỚC 3: MÔ PHỎNG KHAI THÁC LLM SAU KHI SFT (SUPERVISED FINE-TUNING)", prefix="[LLM SFT]")
    print("-"*40)
    llm = LLMConnector(model_name="qwen2.5-3b-translate-sft")
    
    sample_sentence = "虽然中文很难，但是他坚持学习。"
    log_info(f"Đưa câu thô vào mô hình Qwen 2.5 đã Fine-tuned: {sample_sentence}")
    
    # Run simulation
    llm_analysis = llm.analyze_with_llm(sample_sentence, mock=True)
    
    # Print beautiful JSON-like syntax tree returned by the LLM
    print("   [LLM JSON Response]:")
    print(yaml.dump(llm_analysis, allow_unicode=True, default_flow_style=False))
    log_success(f"Bản dịch cuối cùng được LLM tối ưu hóa ngữ pháp: {llm_analysis['vietnamese_translation']}")
    
    print("="*60)

if __name__ == "__main__":
    run_demo()
