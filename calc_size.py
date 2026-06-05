import os
import glob

def main():
    total_size = 0
    
    db_files = glob.glob("*.db")
    csv_files = glob.glob("*_books.csv")
    json_files = glob.glob("*_books.json")
    json_filtered = glob.glob("chinese_novels_filtered.json")
    dict_zip = ["dictionaries_backup.zip"]
    
    all_files = db_files + csv_files + json_files + json_filtered + dict_zip
    all_files = list(set(all_files)) # deduplicate
    
    for f in all_files:
        if os.path.exists(f):
            size = os.path.getsize(f)
            total_size += size
            # print(f"{f}: {size / (1024**3):.2f} GB")
            
    print(f"Tổng dung lượng đã nén và tải lên HuggingFace: {total_size / (1024**3):.2f} GB")

if __name__ == "__main__":
    main()
