#!/usr/bin/env python
# -*- coding: utf-8 -*-

import os
import sys
import yaml

# Add quick_translator to path
qt_path = "/home/alida/Documents/Tool translate CHinese/quick_translator"
if qt_path not in sys.path:
    sys.path.append(qt_path)

from src.engine import VietphraseEngine

def load_config():
    config_path = os.path.join(qt_path, "config.yaml")
    if os.path.exists(config_path):
        with open(config_path, "r", encoding="utf-8") as f:
            return yaml.safe_load(f)
    return {}

def main():
    config = load_config()
    print("Initializing VietphraseEngine...")
    engine = VietphraseEngine(config=config)
    
    input_file = "/home/alida/Documents/Tool translate CHinese/Test_translate.text"
    output_file = "/home/alida/Documents/Tool translate CHinese/Test_translate_translated.txt"
    
    if not os.path.exists(input_file):
        print(f"Error: Input file {input_file} does not exist.")
        return
        
    print(f"Reading {input_file}...")
    with open(input_file, "r", encoding="utf-8") as f:
        lines = f.readlines()
        
    print(f"Translating {len(lines)} lines...")
    translated_lines = []
    
    for idx, line in enumerate(lines):
        stripped = line.strip()
        if not stripped:
            translated_lines.append("\n")
            continue
            
        # Translate using the engine
        translated = engine.translate(stripped, multi_option=False)
        translated_lines.append(translated + "\n")
        
        # Print a few samples to the console
        if idx < 10:
            print(f"\nLine {idx + 1}:")
            print(f"  Chinese: {stripped}")
            print(f"  Viet:    {translated}")
            
    print(f"\nSaving translation to {output_file}...")
    with open(output_file, "w", encoding="utf-8") as f:
        f.writelines(translated_lines)
        
    print("Translation completed successfully!")

if __name__ == "__main__":
    main()
