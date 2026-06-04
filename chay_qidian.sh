#!/bin/bash
# Script khởi chạy cào Qidian theo dải ID trong nền (không bị delay log)

echo "Đang dừng các tiến trình cào cũ (nếu có)..."
pkill -f qidian_id_crawler.py

echo "Đang khởi chạy cào Qidian..."

# 1. Khởi chạy dải ID 1 đến 10.000.000 (sử dụng python -u để log xuất hiện ngay lập tức)
nohup python -u qidian_id_crawler.py 1 10000000 > qidian_crawler_range1.log 2>&1 &
PID1=$!
echo "-> Đã chạy dải ID 1 đến 10.000.000 (PID: $PID1), log: qidian_crawler_range1.log"

# 2. Khởi chạy dải ID 1.040.000.000 đến 1.050.000.000
nohup python -u qidian_id_crawler.py 1040000000 1050000000 > qidian_crawler_range2.log 2>&1 &
PID2=$!
echo "-> Đã chạy dải ID 1.040.000.000 đến 1.050.000.000 (PID: $PID2), log: qidian_crawler_range2.log"

echo "Hệ thống cào Qidian đang hoạt động trong nền!"
echo "Bạn có thể kiểm tra tiến trình bằng lệnh: tail -f qidian_crawler_range1.log hoặc tail -f qidian_crawler_range2.log"
