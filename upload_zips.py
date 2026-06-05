import os
import glob
from huggingface_hub import HfApi

def main():
    api = HfApi()
    username = api.whoami()["name"]
    repo_id = f"{username}/crawled_chinese_novels"
    
    files_to_upload = ["quick_translator.zip", "ocr_reader_extension.zip", "ocr-reader-extension.zip", "han_characters_only.csv", "duplicate_report.csv"]
    
    for file in files_to_upload:
        if os.path.exists(file):
            size_mb = os.path.getsize(file) / 1024 / 1024
            print(f"Đang upload file: {file} ({size_mb:.2f} MB)...")
            try:
                api.upload_file(
                    path_or_fileobj=file,
                    path_in_repo=file,
                    repo_id=repo_id,
                    repo_type="dataset"
                )
                print(f"✅ Upload thành công: {file}")
            except Exception as e:
                print(f"❌ Upload thất bại {file}: {e}")

if __name__ == "__main__":
    main()
