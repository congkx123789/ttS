#!/bin/bash
# deploy_to_cloud.sh
set -e

echo "=== Stopping local Cloudflare Tunnel to prevent collision ==="
docker stop cloudflared_tunnel_tienhiep || true

echo "=== Stopping local Docker Compose services ==="
docker-compose down || true

echo "=== Copying updated files to GCP VM ==="
/home/alida/google-cloud-sdk/bin/gcloud compute scp "/home/alida/Documents/Tool translate CHinese/viewer_server.py" novel-backend-prod:/home/alida/novel_chinese/viewer_server.py --zone=us-central1-f

echo "=== Connecting to GCP VM to start services ==="
/home/alida/google-cloud-sdk/bin/gcloud compute ssh novel-backend-prod --zone=us-central1-f --command="
    cd /home/alida/novel_chinese
    
    echo '=== Building and starting backend, nginx, and email-worker via Docker Compose ==='
    docker-compose down || true
    docker-compose up -d --build
    
    echo '=== Starting remote Cloudflare Tunnel ==='
    docker stop cloudflared_tunnel_tienhiep || true
    docker rm cloudflared_tunnel_tienhiep || true
    docker run -d --name cloudflared_tunnel_tienhiep --restart unless-stopped --net=host cloudflare/cloudflared:latest --no-autoupdate tunnel run --token eyJhIjoiY2IxNzY3MDQyM2VmNGYwNmEwOGIyOTM2NTFkODkxZTciLCJ0IjoiNjdkOGEwZWUtMDM4Zi00OTNhLTg3NTMtNGJmOTk1MjQxOWQ3IiwicyI6IlNlZGtKM3dhTml3cnNWR3ByTmdGR0VFREEwUWZUVExCMjEzRGJQMFhhSmtmUXVRSXpoaVdicWpNaXZTVHZTbVRzd1pOMjVuS3BncHJPUUhCZHFaZWFBPT0ifQ==
"

echo "=== Deployment to Cloud Completed successfully! ==="
