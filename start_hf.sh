#!/bin/bash
set -e
echo "=== Tienhiep Backend Startup ==="

APP_DIR="/home/user/app"
cd "$APP_DIR"

# Download DB files from HF Dataset at RUNTIME (token available as env var)
echo "Checking database files..."
python3 - <<'PYEOF'
import os, sys
from huggingface_hub import hf_hub_download

token = os.environ.get("HF_TOKEN", "")
if not token:
    print("WARNING: HF_TOKEN not set - skipping DB download")
    sys.exit(0)

app_dir = "/home/user/app"
db_files = [
    "merged_books.db",
    "merged_books_advanced.db",
    "merged_books_fast.db",
    "merged_books_hanviet.db",
    "users_data.db",
]

for fname in db_files:
    target = os.path.join(app_dir, fname)
    if os.path.exists(target) and os.path.getsize(target) > 1024:
        print(f"  OK (exists): {fname}")
        continue
    print(f"  Downloading {fname}...", flush=True)
    try:
        hf_hub_download(
            repo_id="Cong123779/tienhiep-data",
            filename=fname,
            repo_type="dataset",
            token=token,
            local_dir=app_dir,
            local_dir_use_symlinks=False,
        )
        size = os.path.getsize(os.path.join(app_dir, fname)) // 1024 // 1024
        print(f"  Done: {fname} ({size}MB)", flush=True)
    except Exception as e:
        print(f"  WARN: {fname}: {e}", flush=True)

print("Database check complete!", flush=True)
PYEOF

PORT=${PORT:-7860}
echo "Starting Gunicorn on port $PORT..."
exec gunicorn \
    --bind 0.0.0.0:$PORT \
    --workers 2 \
    --threads 4 \
    --timeout 300 \
    --preload \
    --access-logfile - \
    --error-logfile - \
    viewer_server:app
