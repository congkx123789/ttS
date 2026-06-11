import os
import sys
import logging
from logging.handlers import RotatingFileHandler

# Project root directory detection
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
LOG_DIR = os.path.join(PROJECT_ROOT, "logs")
LOG_FILE = os.path.join(LOG_DIR, "app.log")

def setup_logger(name="app", log_level=logging.INFO):
    """Sets up a central rolling logger that outputs to both stdout and a file."""
    # Ensure logs directory exists
    try:
        os.makedirs(LOG_DIR, exist_ok=True)
    except Exception as e:
        sys.stderr.write(f"[WARNING] Failed to create log directory '{LOG_DIR}': {e}\n")

    logger = logging.getLogger(name)
    logger.setLevel(log_level)
    
    # Avoid duplicate handlers if setup_logger is called multiple times
    if logger.handlers:
        return logger

    # Log format: time | level | name | message
    formatter = logging.Formatter(
        "[%(asctime)s] %(levelname)s [%(name)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )

    # Console stream handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)

    # Rolling file handler
    try:
        file_handler = RotatingFileHandler(
            LOG_FILE,
            maxBytes=10 * 1024 * 1024,  # 10 MB
            backupCount=5,
            encoding="utf-8"
        )
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)
    except Exception as e:
        sys.stderr.write(f"[WARNING] Failed to configure file logger for '{LOG_FILE}': {e}\n")

    return logger

# Pre-initialize central logger
logger = setup_logger()
