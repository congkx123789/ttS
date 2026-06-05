#!/usr/bin/env bash

# deploy_all.sh - Tự động hóa Deploy Frontend sử dụng Service Account JSON

set -e

PROJECT_ROOT="/home/alida/Documents/Tool translate CHinese"
KEY_FILE="${PROJECT_ROOT}/gcp-key.json"

echo "========================================================="
echo "   HỆ THỐNG DEPLOY TỰ ĐỘNG LÊN GOOGLE CLOUD (FIREBASE)   "
echo "========================================================="

# 1. Kiểm tra sự tồn tại của file gcp-key.json
if [ -f "$KEY_FILE" ]; then
    echo "✔ Tìm thấy tệp gcp-key.json. Sử dụng Service Account để xác thực."
    export GOOGLE_APPLICATION_CREDENTIALS="$KEY_FILE"
    PROJECT_ID="learned-acronym-498316-h9"
else
    echo "ℹ Không tìm thấy gcp-key.json. Sử dụng phiên đăng nhập trực tiếp (OAuth) của bạn."
    echo "👉 Hãy đảm bảo bạn đã chạy lệnh 'firebase login' thành công trước đó."
    PROJECT_ID="learned-acronym-498316-h9"
fi

if [ -z "$PROJECT_ID" ]; then
    echo "❌ Lỗi: Không thể xác định PROJECT_ID."
    exit 1
fi

echo "🚀 Dự án đích phát hiện được: $PROJECT_ID"

# 3. Tiến hành deploy lên Firebase Hosting
echo "📦 Đang nén và tải giao diện tĩnh lên Google Firebase Hosting..."

# Kiểm tra xem đã khởi tạo firebase chưa, nếu chưa thì tự cấu hình
if [ ! -f "${PROJECT_ROOT}/firebase.json" ]; then
    echo "📝 Đang khởi tạo tệp cấu hình firebase.json tự động..."
    cat <<EOF > "${PROJECT_ROOT}/firebase.json"
{
  "hosting": {
    "public": "Frontend/web-reader",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
EOF
fi

if [ ! -f "${PROJECT_ROOT}/.firebaserc" ]; then
    echo "📝 Đang khởi tạo tệp .firebaserc tự động..."
    cat <<EOF > "${PROJECT_ROOT}/.firebaserc"
{
  "projects": {
    "default": "$PROJECT_ID"
  }
}
EOF
fi

# Chạy deploy sử dụng Service Account credentials
firebase deploy --only hosting --project "$PROJECT_ID"

echo "========================================================="
echo "🎉 DEPLOY FRONTEND THÀNH CÔNG!"
echo "👉 Truy cập Firebase Console để cấu hình domain 'tienhiep.lyvuha.com' của bạn."
echo "========================================================="
