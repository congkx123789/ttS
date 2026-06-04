import sys

# Simple color formatting fallback
class Colors:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'

try:
    from colorama import init, Fore, Style
    init(autoreset=True)
    HAS_COLORAMA = True
except ImportError:
    HAS_COLORAMA = False

def log_info(message, prefix="[INFO]"):
    if HAS_COLORAMA:
        print(f"{Fore.BLUE}{prefix} {message}{Style.RESET_ALL}")
    else:
        print(f"{Colors.BLUE}{prefix} {message}{Colors.ENDC}")

def log_success(message, prefix="[SUCCESS]"):
    if HAS_COLORAMA:
        print(f"{Fore.GREEN}{Style.BRIGHT}{prefix} {message}{Style.RESET_ALL}")
    else:
        print(f"{Colors.GREEN}{Colors.BOLD}{prefix} {message}{Colors.ENDC}")

def log_warning(message, prefix="[WARNING]"):
    if HAS_COLORAMA:
        print(f"{Fore.YELLOW}{prefix} {message}{Style.RESET_ALL}")
    else:
        print(f"{Colors.WARNING}{prefix} {message}{Colors.ENDC}")

def log_error(message, prefix="[ERROR]"):
    if HAS_COLORAMA:
        print(f"{Fore.RED}{Style.BRIGHT}{prefix} {message}{Style.RESET_ALL}")
    else:
        print(f"{Colors.FAIL}{Colors.BOLD}{prefix} {message}{Colors.ENDC}")

def log_structure(grammar_name, detail):
    if HAS_COLORAMA:
        print(f"{Fore.MAGENTA}{Style.BRIGHT}➔ {grammar_name}: {Fore.CYAN}{detail}{Style.RESET_ALL}")
    else:
        print(f"{Colors.HEADER}{Colors.BOLD}➔ {grammar_name}: {Colors.CYAN}{detail}{Colors.ENDC}")
