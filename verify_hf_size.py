from huggingface_hub import HfApi

def main():
    api = HfApi()
    repo_id = "Cong123779/crawled_chinese_novels"
    
    print(f"Đang lấy thông tin chi tiết từng file truyện từ HuggingFace...")
    try:
        files_info = api.list_repo_files(repo_id=repo_id, repo_type="dataset")
        # To get size we need dataset_info or iter over files
        info = api.dataset_info(repo_id, files_metadata=True)
        
        total_novel_size = 0
        print("\n=== CHI TIẾT DỮ LIỆU TRUYỆN TRÊN SERVER ===")
        for file in info.siblings:
            f_name = file.rfilename
            size = file.size
            if size is None:
                continue
                
            # Chỉ tính các file dữ liệu truyện (.db, .csv, .json)
            if f_name.endswith(('.db', '.csv', '.json')) and "users_data" not in f_name:
                size_mb = size / (1024 * 1024)
                total_novel_size += size
                print(f" 📖 {f_name}: {size_mb:.2f} MB")
                
        total_gb = total_novel_size / (1024 * 1024 * 1024)
        print(f"\n✅ TỔNG CỘNG DỮ LIỆU TRUYỆN ĐÃ AN TOÀN TRÊN SERVER: {total_gb:.2f} GB")
            
    except Exception as e:
        print(f"Lỗi: {e}")

if __name__ == "__main__":
    main()
