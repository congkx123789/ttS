import os
from huggingface_hub import HfApi

def main():
    api = HfApi()
    repo_id = "Cong123779/crawled_chinese_novels"
    file = "qidian_books.csv"
    
    if os.path.exists(file):
        print(f"Đang upload file nhỏ: {file}...")
        try:
            api.upload_file(
                path_or_fileobj=file,
                path_in_repo=file,
                repo_id=repo_id,
                repo_type="dataset"
            )
            print(f"✅ Upload thành công: {file}")
        except Exception as e:
            print(f"❌ Upload thất bại: {e}")

if __name__ == "__main__":
    main()
