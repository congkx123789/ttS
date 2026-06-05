from huggingface_hub import HfApi

def main():
    api = HfApi()
    repo_id = "Cong123779/crawled_chinese_novels"
    try:
        files = api.list_repo_files(repo_id=repo_id, repo_type="dataset")
        print(f"✅ Đã kết nối tới HuggingFace Dataset: {repo_id}")
        print(f"Tổng số file hiện có trên Server: {len(files)}")
        
        # Lọc ra các nhóm file quan trọng để hiển thị
        db_files = [f for f in files if f.endswith('.db')]
        zip_files = [f for f in files if f.endswith('.zip')]
        csv_files = [f for f in files if f.endswith('.csv')]
        
        print("\n--- CÁC DATABASE QUAN TRỌNG ĐÃ LƯU TRỮ ---")
        for f in db_files:
            print(f" - {f}")
            
        print("\n--- CÁC FILE ZIP/CÔNG CỤ ĐÃ LƯU TRỮ ---")
        for f in zip_files:
            print(f" - {f}")
            
        if "users_data.db" in db_files:
            print("\n🌟 ĐÃ TÌM THẤY 'users_data.db' TRÊN SERVER (Tài khoản người dùng an toàn)!")
        else:
            print("\n⚠️ CHƯA TÌM THẤY 'users_data.db'!")
            
        if "dictionaries_backup.zip" in zip_files:
            print("🌟 ĐÃ TÌM THẤY 'dictionaries_backup.zip' TRÊN SERVER (Từ điển an toàn)!")
        else:
            print("⚠️ CHƯA TÌM THẤY Từ điển!")
            
    except Exception as e:
        print(f"Lỗi khi kiểm tra: {e}")

if __name__ == "__main__":
    main()
