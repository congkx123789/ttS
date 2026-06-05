import os
import glob
from huggingface_hub import HfApi

def main():
    api = HfApi()
    username = api.whoami()["name"]
    repo_id = f"{username}/crawled_chinese_novels"
    
    print(f"Uploading remaining .db files to {repo_id}...")
    
    # Get all .db files
    all_dbs = glob.glob("*.db")
    
    # Files we already uploaded in the previous script
    already_uploaded = glob.glob("merged_*.db") + ["chinese_novels_filtered.db"]
    
    # Files to upload now
    files_to_upload = [f for f in all_dbs if f not in already_uploaded]
    
    if not files_to_upload:
        print("Không có file nào cần tải thêm!")
        return

    uploaded_count = 0
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
                uploaded_count += 1
            except Exception as e:
                print(f"❌ Upload thất bại {file}: {e}")
                
    print(f"Hoàn thành upload thêm {uploaded_count}/{len(files_to_upload)} file database.")

if __name__ == "__main__":
    main()
