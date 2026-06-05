#!/bin/bash
# Script to run the Tool Translate Chinese Backend in Production Mode

echo "🚀 Installing dependencies..."
pip install -r requirements.txt

echo "🌟 Starting Production Gunicorn Server with Gevent..."
# 4 workers with gevent for async I/O handles hundreds of simultaneous users
gunicorn -w 4 -k gevent -b 0.0.0.0:5050 viewer_server:app --access-logfile - --error-logfile -
