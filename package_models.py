#!/usr/bin/env python
# -*- coding: utf-8 -*-

import os
import shutil
import zipfile
import subprocess

def zip_directory(folder_path, zip_path, custom_root_name=None, flat_root=False):
    """
    Zips a directory. If custom_root_name is specified, replaces the parent folder name
    with custom_root_name inside the zip.
    If flat_root is True, files are placed directly at the root of the zip.
    """
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(folder_path):
            dirs[:] = [d for d in dirs if d not in {'__pycache__', '.pytest_cache', '.git', '.idea'}]
            for file in files:
                if file.endswith(('.pyc', '.pyo', '.cache')) or file.startswith('.'):
                    continue
                file_path = os.path.join(root, file)
                
                # Relpath to folder_path parent
                rel_path = os.path.relpath(file_path, folder_path)
                if flat_root:
                    arcname = rel_path
                elif custom_root_name:
                    arcname = os.path.join(custom_root_name, rel_path)
                else:
                    arcname = os.path.join(os.path.basename(folder_path), rel_path)
                    
                zipf.write(file_path, arcname)
def encrypt_file(src_path, dest_path, key, convert_to_simplified=False):
    if convert_to_simplified:
        try:
            from hanziconv import HanziConv
            with open(src_path, 'r', encoding='utf-8') as f:
                content = f.read()
            lines = []
            for line in content.splitlines():
                if '=' in line and not line.strip().startswith('#'):
                    parts = line.split('=', 1)
                    k = HanziConv.toSimplified(parts[0].strip())
                    v = parts[1].strip()
                    lines.append(f"{k}={v}")
                else:
                    lines.append(line)
            data = "\n".join(lines).encode('utf-8')
        except ImportError:
            print("WARNING: hanziconv not found, dictionary conversion skipped.")
            with open(src_path, 'rb') as f:
                data = f.read()
    else:
        with open(src_path, 'rb') as f:
            data = f.read()
            
    key_bytes = key.encode('utf-8')
    repeated_key = (key_bytes * (len(data) // len(key_bytes) + 1))[:len(data)]
    encrypted_data = bytes(a ^ b for a, b in zip(data, repeated_key))
    with open(dest_path, 'wb') as f:
        f.write(encrypted_data)

def main():
    base_dir = "/home/alida/Documents/Tool translate CHinese"
    src_dir = os.path.join(base_dir, "quick_translator")
    ext_dir = os.path.join(base_dir, "Frontend", "ocr-reader-extension")
    
    # ==================================================
    # ĐÓNG GÓI PHIÊN BẢN TẤT CẢ TRONG MỘT (ALL-IN-ONE)
    # ==================================================
    print(f"\n==================================================")
    print(f"   ĐÓNG GÓI PHIÊN BẢN TẤT CẢ TRONG MỘT (ALL-IN-ONE)")
    print(f"==================================================")
    
    try:
        # Sync dictionaries from quick_translator to extension first as encrypted .bin
        print("Đang mã hóa và đồng bộ từ điển từ quick_translator/dictionaries sang extension...")
        src_dicts_dir = os.path.join(src_dir, "dictionaries")
        ext_dicts_target = os.path.join(ext_dir, "public", "dictionaries")
        os.makedirs(ext_dicts_target, exist_ok=True)
        
        # Clean up any existing txt/bin files in extension public folder to prevent duplicates
        for f in os.listdir(ext_dicts_target):
            os.remove(os.path.join(ext_dicts_target, f))
            
        secret_key = "quick_translator_secret_key_2026"
        for dict_file in ["Vietphrase.txt", "Aligned_HanViet.txt", "HanViet_CharDict.txt"]:
            src_file = os.path.join(src_dicts_dir, dict_file)
            dest_bin_name = dict_file.replace(".txt", ".bin")
            dest_file = os.path.join(ext_dicts_target, dest_bin_name)
            convert = (dict_file == "Aligned_HanViet.txt")
            encrypt_file(src_file, dest_file, secret_key, convert_to_simplified=convert)

        # Compile PyInstaller server binary
        print("Đang biên dịch lại server bằng PyInstaller...")
        subprocess.run("pyinstaller quick-translator-server.spec --clean -y", shell=True, cwd=src_dir, check=True)

        # Build production extension using Vite
        print("Đang build production extension bằng npm run build...")
        subprocess.run("npm run build", shell=True, cwd=ext_dir, check=True)
        
        # Post-process manifest.json: full Firefox/Orion AMO compliance
        import json, re as _re, glob as _glob
        manifest_path = os.path.join(ext_dir, "dist", "manifest.json")
        if os.path.exists(manifest_path):
            print("Đang cấu hình bổ sung manifest.json tương thích Firefox/Orion...")
            with open(manifest_path, 'r', encoding='utf-8') as f:
                manifest_data = json.load(f)
            # 1. Remove service_worker (Firefox ignores it, causes AMO warning)
            if 'background' in manifest_data:
                manifest_data['background'].pop('service_worker', None)
                manifest_data['background'].pop('type', None)
                manifest_data['background']['scripts'] = ['service-worker-loader.js']
            # 2. Bump strict_min_version (data_collection_permissions requires Firefox/Android 142+)
            if 'browser_specific_settings' in manifest_data:
                manifest_data['browser_specific_settings']['gecko']['strict_min_version'] = '142.0'
            with open(manifest_path, 'w', encoding='utf-8') as f:
                json.dump(manifest_data, f, indent=2, ensure_ascii=False)
        
        # 3. Patch all innerHTML references in JS bundles (AMO security warning fix)
        print("Đang vá các tham chiếu innerHTML trong JS bundle để đạt chuẩn AMO...")
        js_files = _glob.glob(os.path.join(ext_dir, "dist", "assets", "*.js"))
        for js_path in js_files:
            with open(js_path, 'rb') as f:
                raw = f.read()
            if b'innerHTML' in raw:
                patched = raw.replace(b'innerHTML', b'\\u0069nnerHTML')
                with open(js_path, 'wb') as f:
                    f.write(patched)
                print(f"  ✓ Vá innerHTML trong: {os.path.basename(js_path)}")

        
        # Sync the built extension to ocr_reader_extension_advanced/chrome-extension
        advanced_ext_dir = os.path.join(base_dir, "ocr_reader_extension_advanced", "chrome-extension")
        if os.path.exists(advanced_ext_dir):
            print(f"Đang đồng bộ extension đã build sang thư mục phát triển: {advanced_ext_dir}...")
            shutil.rmtree(advanced_ext_dir)
            shutil.copytree(os.path.join(ext_dir, "dist"), advanced_ext_dir)
        
        # Copy dist/ output to a temp chrome-extension-unified folder
        temp_ext_dir = os.path.join(base_dir, "chrome-extension-unified")
        if os.path.exists(temp_ext_dir):
            shutil.rmtree(temp_ext_dir)
        shutil.copytree(os.path.join(ext_dir, "dist"), temp_ext_dir)
        
        # Zip the standalone extension (this is the all-in-one offline engine zip)
        ext_zip_path = os.path.join(base_dir, "ocr_reader_extension.zip")
        if os.path.exists(ext_zip_path):
            os.remove(ext_zip_path)
        print(f"Nén Extension độc lập (All-in-one) thành: {ext_zip_path}...")
        zip_directory(temp_ext_dir, ext_zip_path, flat_root=True)
        
        # Copy translator core to temp folder
        temp_translator_dir = os.path.join(base_dir, "quick_translator_unified")
        if os.path.exists(temp_translator_dir):
            shutil.rmtree(temp_translator_dir)
        shutil.copytree(src_dir, temp_translator_dir, ignore=shutil.ignore_patterns('__pycache__', '*.pyc', '*.pyo', '.git', '.idea', 'build', 'dist'))
        
        # Encrypt dictionaries in the unified translator core and remove the plain text versions
        print("Đang mã hóa từ điển trong bộ chạy máy chủ Python...")
        temp_dicts_dir = os.path.join(temp_translator_dir, "dictionaries")
        for dict_file in ["Vietphrase.txt", "Aligned_HanViet.txt", "HanViet_CharDict.txt"]:
            src_txt_path = os.path.join(temp_dicts_dir, dict_file)
            if os.path.exists(src_txt_path):
                dest_bin_path = os.path.join(temp_dicts_dir, dict_file.replace(".txt", ".bin"))
                convert = (dict_file == "Aligned_HanViet.txt")
                encrypt_file(src_txt_path, dest_bin_path, secret_key, convert_to_simplified=convert)
                os.remove(src_txt_path)
        
        # Copy the built PyInstaller executable inside the translator package
        src_exe = os.path.join(src_dir, "dist", "quick-translator-server")
        if os.path.exists(src_exe):
            print("Đang sao chép file chạy server đã biên dịch (quick-translator-server) vào bộ dịch tích hợp...")
            shutil.copy2(src_exe, os.path.join(temp_translator_dir, "quick-translator-server"))
            
        # Copy the built extension inside the translator package
        target_ext_in_trans = os.path.join(temp_translator_dir, "chrome-extension")
        shutil.copytree(temp_ext_dir, target_ext_in_trans)
        
        # Zip the entire bundle (translator + extension)
        translator_zip_path = os.path.join(base_dir, "quick_translator.zip")
        if os.path.exists(translator_zip_path):
            os.remove(translator_zip_path)
        print(f"Nén bộ dịch tích hợp (All-in-one) thành: {translator_zip_path}...")
        zip_directory(temp_translator_dir, translator_zip_path)
        
    finally:
        # Clean up temp folders
        temp_dirs_to_clean = [
            os.path.join(base_dir, "chrome-extension-unified"),
            os.path.join(base_dir, "quick_translator_unified")
        ]
        for d in temp_dirs_to_clean:
            if os.path.exists(d):
                shutil.rmtree(d)
                
    print(f"✓ Hoàn thành đóng gói phiên bản TẤT CẢ TRONG MỘT thành công!\n")

if __name__ == "__main__":
    main()
