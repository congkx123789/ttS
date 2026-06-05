import os
from huggingface_hub import HfApi

def main():
    api = HfApi()
    username = api.whoami()["name"]
    repo_id = f"{username}/crawled_chinese_novels"
    file = "dictionaries_backup.zip"
    
    if os.path.exists(file):
        size_mb = os.path.getsize(file) / 1024 / 1024
        print(f"Đang upload file Từ Điển: {file} ({size_mb:.2f} MB) lên {repo_id}...")
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
    else:
        print(f"Không tìm thấy file {file}!")

if __name__ == "__main__":
    main()
