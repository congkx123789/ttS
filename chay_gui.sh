#!/bin/bash
# Script to run the Offline Novel Studio Web UI

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
echo -e "\033[94m=== ĐANG KHỞI ĐỘNG HỆ THỐNG GIAO DIỆN WEB DỊCH TRUYỆN & TTS OFFLINE ===\033[0m"
echo -e "\033[92mVui lòng mở trình duyệt và truy cập địa chỉ:\033[0m"
echo -e "\033[93m👉 http://localhost:5000\033[0m"
echo -e "------------------------------------------------------------------"
python3 "$SCRIPT_DIR/gui/app.py"
