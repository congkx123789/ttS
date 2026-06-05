import os
import sys
import glob
from huggingface_hub import HfApi

def main():
    api = HfApi()
    username = api.whoami()["name"]
    repo_id = f"{username}/crawled_chinese_novels"
    
    print(f"Bắt đầu upload dữ liệu lên repository: {repo_id}...")
    
    # Create repo if it doesn't exist
    try:
        api.create_repo(repo_id=repo_id, repo_type="dataset", private=True, exist_ok=True)
        print("Đã tạo/kiểm tra repository thành công.")
    except Exception as e:
        print(f"Lỗi khi tạo repository: {e}")
        return

    files_to_upload = glob.glob("*_books.csv") + glob.glob("*_books.json") + glob.glob("merged_*.db")
    # Also add chinese_novels_filtered
    if os.path.exists("chinese_novels_filtered.db"):
        files_to_upload.append("chinese_novels_filtered.db")
    if os.path.exists("chinese_novels_filtered.json"):
        files_to_upload.append("chinese_novels_filtered.json")

    # Upload files
    uploaded_count = 0
    for file in files_to_upload:
        if os.path.exists(file):
            print(f"Đang upload file: {file} ({os.path.getsize(file) / 1024 / 1024:.2f} MB)...")
            try:
                api.upload_file(
                    path_or_fileobj=file,
                    path_in_repo=file,
                    repo_id=repo_id,
                    repo_type="dataset"
                )
                print(f"✅ Upload thành công: {file}")
                uploaded_count += 1
            except Exception as e:
                print(f"❌ Upload thất bại {file}: {e}")
                
    print(f"Hoàn thành upload {uploaded_count}/{len(files_to_upload)} file.")
    print(f"Đường dẫn dataset: https://huggingface.co/datasets/{repo_id}")

if __name__ == "__main__":
    main()
