#!/bin/bash
# Script khởi chạy bộ cào Fanqie trong nền

echo "Đang dừng các tiến trình cào Fanqie cũ nếu có..."
pkill -f fanqie_discover.py
pkill -f fanqie_parse.py
pkill -f fanqie_crawler.py

echo "Khởi chạy cào Fanqie Novel..."
nohup python -u fanqie_crawler.py > fanqie_crawler.log 2>&1 &

echo "Đã chạy tiến trình cào Fanqie trong nền!"
echo "Sử dụng lệnh ./xem_tien_do.sh để kiểm tra."
