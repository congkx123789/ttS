import os
import sys
import zipfile
import re
import time
import yaml

# Add root directory to sys.path
root_dir = "/home/alida/Documents/Tool translate CHinese"
if root_dir not in sys.path:
    sys.path.append(root_dir)

from quick_translator.src.engine import VietphraseEngine
from quick_translator.translate_epub import translate_html_content

def log_info(msg): print(f"\033[94m[INFO] {msg}\033[0m")
def log_success(msg): print(f"\033[92m[SUCCESS] {msg}\033[0m")
def log_warning(msg): print(f"\033[93m[WARNING] {msg}\033[0m")
def log_error(msg): print(f"\033[91m[ERROR] {msg}\033[0m")

def translate_epub_demo(src_epub, dest_epub, engine, mode, limit_chapters=5):
    """
    Translates only the first `limit_chapters` HTML files of the EPUB using the specified mode.
    Subsequent HTML files are replaced with a light placeholder to speed up translation.
    """
    start_time = time.time()
    
    with zipfile.ZipFile(src_epub, 'r') as src_zip:
        with zipfile.ZipFile(dest_epub, 'w', compression=zipfile.ZIP_DEFLATED) as dest_zip:
            file_list = src_zip.namelist()
            
            # Write mimetype first uncompressed
            if 'mimetype' in file_list:
                mimetype_data = src_zip.read('mimetype')
                dest_zip.writestr('mimetype', mimetype_data, compress_type=zipfile.ZIP_STORED)
                
            # Filter and sort HTML files to find the first N chapters
            html_files = [f for f in file_list if f.endswith(('.html', '.xhtml', '.htm'))]
            def natural_sort_key(s):
                return [int(text) if text.isdigit() else text.lower() for text in re.split(r'(\d+)', s)]
            html_files.sort(key=natural_sort_key)
            
            target_html_files = set(html_files[:limit_chapters])
            
            for file_name in file_list:
                if file_name == 'mimetype':
                    continue
                    
                raw_data = src_zip.read(file_name)
                
                if file_name in target_html_files:
                    # Translate target chapter
                    try:
                        html_content = raw_data.decode('utf-8', errors='ignore')
                        translated_content = translate_html_content(html_content, engine, multi_option=False, mode=mode)
                        dest_zip.writestr(file_name, translated_content.encode('utf-8'))
                        log_info(f"  -> Đã dịch: {os.path.basename(file_name)}")
                    except Exception as e:
                        log_error(f"  -> Lỗi dịch {file_name}: {e}")
                        dest_zip.writestr(file_name, raw_data)
                elif file_name in html_files:
                    # Replace other chapters with placeholder to keep EPUB light and fast
                    placeholder = '<html><head><meta charset="utf-8"/></head><body><h3>[Chương này được bỏ qua trong bản Demo]</h3></body></html>'
                    dest_zip.writestr(file_name, placeholder.encode('utf-8'))
                elif file_name.endswith(('.ncx', '.opf', '.xml')):
                    # Metadata files
                    try:
                        content = raw_data.decode('utf-8', errors='ignore')
                        translated_content = translate_html_content(content, engine, multi_option=False, mode=mode)
                        dest_zip.writestr(file_name, translated_content.encode('utf-8'))
                    except Exception as e:
                        dest_zip.writestr(file_name, raw_data)
                else:
                    # Non-text resources
                    dest_zip.writestr(file_name, raw_data)
                    
    duration = time.time() - start_time
    log_success(f"✓ Hoàn tất {mode} trong {duration:.2f} giây.")

def main():
    config_path = os.path.join(root_dir, "quick_translator", "config.yaml")
    with open(config_path, "r", encoding="utf-8") as f:
        config = yaml.safe_load(f)

    config["paths"]["dictionaries"]["vietphrase"] = os.path.join(root_dir, "quick_translator", "dictionaries/Vietphrase.txt")

    log_info("Đang nạp từ điển...")
    engine = VietphraseEngine(config=config)
    log_success("Từ điển đã được nạp thành công.")

    epubs = [
        "《完美世界》.epub",
        "《剑动九天》.epub"
    ]
    
    modes = ["fast", "advanced", "advanced_hanviet", "vietphrase", "hanviet"]
    
    for epub_name in epubs:
        src_path = os.path.join(root_dir, epub_name)
        if not os.path.exists(src_path):
            log_error(f"Không tìm thấy file: {src_path}")
            continue
            
        print("\n" + "="*50)
        log_info(f"BẮT ĐẦU DỊCH DEMO CUỐN: {epub_name}")
        print("="*50)
        
        base, ext = os.path.splitext(epub_name)
        
        for mode in modes:
            dest_name = f"{base}_Demo_5Ch_{mode}{ext}"
            dest_path = os.path.join(root_dir, dest_name)
            log_info(f"Đang dịch chế độ [{mode}]...")
            translate_epub_demo(src_path, dest_path, engine, mode, limit_chapters=5)
            
    print("\n" + "="*50)
    log_success("ĐÃ TẠO THÀNH CÔNG TẤT CẢ CÁC BẢN DEMO DỊCH THỬ 5 CHƯƠNG!")
    print("="*50)

if __name__ == "__main__":
    main()
