#!/usr/bin/env python
# -*- coding: utf-8 -*-

import os
import sys
import yaml

# Add path
sys.path.append("/home/alida/Documents/Tool translate CHinese/quick_translator")
from src.engine import VietphraseEngine

def main():
    source_path = "/home/alida/Documents/Tool translate CHinese/Test_translate.text"
    dest_path = "/home/alida/Documents/Tool translate CHinese/Test_translate_translated.txt"
    
    config_path = "/home/alida/Documents/Tool translate CHinese/quick_translator/config.yaml"
    with open(config_path, "r", encoding="utf-8") as f:
        config = yaml.safe_load(f)
        
    print("Khởi tạo Engine...")
    engine = VietphraseEngine(config=config)
    
    print(f"Đang đọc tệp nguồn: {source_path}")
    with open(source_path, "r", encoding="utf-8") as f:
        lines = f.readlines()
        
    comparison_output = []
    sentence_idx = 1
    
    print("Bắt đầu dịch và so sánh...")
    for line in lines:
        line_strip = line.strip()
        if not line_strip:
            continue
            
        # Dịch 3 bản dùng các mode của engine
        trans1 = engine.translate(line_strip, mode="hanviet")
        trans2 = engine.translate(line_strip, mode="fast")
        trans3 = engine.translate(line_strip, mode="advanced")
        
        comparison_output.append(f"--- CÂU {sentence_idx} ---")
        comparison_output.append(f"[GỐC]: {line_strip}")
        comparison_output.append(f"[BẢN 1 - KHÔNG JIEBA (Hán-Việt)]: {trans1}")
        comparison_output.append(f"[BẢN 2 - FAST MODE (Tốc độ)]:     {trans2}")
        comparison_output.append(f"[BẢN 3 - ADVANCED MODE (Tỉ mỉ)]:   {trans3}")
        comparison_output.append("")
        
        sentence_idx += 1
        
    print(f"Đang ghi kết quả so sánh ra file: {dest_path}")
    with open(dest_path, "w", encoding="utf-8") as f:
        f.write("\n".join(comparison_output))
        
    print("Hoàn thành tạo bản so sánh 3 chế độ dịch!")

if __name__ == "__main__":
    main()
