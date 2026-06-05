#!/bin/bash
# Script to run the Tool Translate Chinese Backend in Production Mode
# OPTIMIZED: Single worker + threading to avoid 4x RAM duplication of dictionary engine

echo "🚀 Installing dependencies..."
pip install -r requirements.txt

echo "🌟 Starting Production Gunicorn Server..."
# CRITICAL: Use only 1 worker because VietphraseEngine loads ~500MB into RAM.
# Multiple workers = multiple copies = OOM crash on VPS with limited RAM.
# Use gthread (threaded) instead of gevent to handle concurrent requests within 1 process.
# --threads 8 handles 8 simultaneous translation requests sharing the SAME engine in RAM.
# --timeout 120 prevents Gunicorn from killing the worker during the 10s Eager-Loading phase.
# --preload loads the app ONCE in the master process, then forks workers (shares memory via COW).
gunicorn \
    --worker-class gthread \
    --workers 1 \
    --threads 8 \
    --timeout 120 \
    --keep-alive 5 \
    --bind 0.0.0.0:5051 \
    --preload \
    --access-logfile - \
    --error-logfile - \
    viewer_server:app
