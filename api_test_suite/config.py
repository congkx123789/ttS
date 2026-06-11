import os
import requests

# Target Backend Server URL
BACKEND_URL = "http://localhost:5051"

# Supabase database connection string for OTP/verification testing
DB_URL = "postgresql://postgres.mrhddtyhuuwpttqlpplv:mogIxPDrSoioS6nOtDo94xgi@aws-1-ap-south-1.pooler.supabase.com:6543/postgres"

# Monkeypatch requests to automatically include bypass header
original_request = requests.request
def custom_request(method, url, **kwargs):
    if "headers" not in kwargs or kwargs["headers"] is None:
        kwargs["headers"] = {}
    kwargs["headers"]["X-Bypass-Rate-Limit"] = "tienhiep_bypass_secret_9988"
    return original_request(method, url, **kwargs)

requests.request = custom_request

# Patch the individual method helpers too
requests.get = lambda url, **kwargs: custom_request("GET", url, **kwargs)
requests.post = lambda url, **kwargs: custom_request("POST", url, **kwargs)
requests.put = lambda url, **kwargs: custom_request("PUT", url, **kwargs)
requests.delete = lambda url, **kwargs: custom_request("DELETE", url, **kwargs)
requests.patch = lambda url, **kwargs: custom_request("PATCH", url, **kwargs)

# Print configuration
print("--- TEST SUITE CONFIGURATION ---")
print(f"Target URL: {BACKEND_URL}")
print("--------------------------------")
