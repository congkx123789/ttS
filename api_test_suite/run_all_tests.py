import sys
import time

# Import tests
from test_auth_flow import test_auth_features
from test_otp_flow import test_otp_and_recovery
from test_developer_console import test_developer_console
from test_tts_inference import test_tts_endpoints
from test_translation_api import test_translation_endpoints
from test_payment_flow import test_payment_flow
from test_books_api import test_books_endpoints
from test_user_features import test_user_features
from test_epub_api import test_epub_endpoints

def run_master_test_suite():
    print("======================================================================")
    print("🚀 STARTING TIENHIEP BACKEND API MASTER TEST SUITE")
    print("======================================================================")
    
    start_time = time.time()
    tests = [
        ("Authentication & Profile Flow", test_auth_features),
        ("OTP Email & Password Recovery Flow", test_otp_and_recovery),
        ("Developer API Key Management", test_developer_console),
        ("Text-to-Speech (TTS) Inference Engine", test_tts_endpoints),
        ("Vietphrase Chinese-Vietnamese Translation", test_translation_endpoints),
        ("Payment Gateway & VIP Billing Upgrades", test_payment_flow),
        ("Books & Shelf Management API", test_books_endpoints),
        ("User Settings, Vocabulary & History API", test_user_features),
        ("EPUB Generation & Optimization API (VIP Only)", test_epub_endpoints)
    ]
    
    passed_count = 0
    results = []
    
    for name, test_func in tests:
        print(f"\n▶️ Running test: {name}...")
        try:
            test_start = time.time()
            test_func()
            elapsed = time.time() - test_start
            print(f"✨ PASSED: {name} ({elapsed:.2f}s)")
            results.append((name, "PASSED", elapsed))
            passed_count += 1
        except Exception as e:
            elapsed = time.time() - test_start
            print(f"❌ FAILED: {name} ({elapsed:.2f}s)")
            print(f"   Error detail: {e}")
            results.append((name, "FAILED", elapsed))
            
    total_elapsed = time.time() - start_time
    
    print("\n" + "="*70)
    print("📊 MASTER TEST SUITE REPORT SUMMARY")
    print("="*70)
    for name, status, elapsed in results:
        status_icon = "🟢" if status == "PASSED" else "🔴"
        print(f" {status_icon} {name:<45} | {status:<8} | {elapsed:.2f}s")
    print("-"*70)
    print(f"Total Tests run: {len(tests)}")
    print(f"Tests Passed:    {passed_count} / {len(tests)}")
    print(f"Execution time:  {total_elapsed:.2f}s")
    print("="*70)
    
    if passed_count == len(tests):
        print("🎉 ALL SYSTEMS FUNCTIONING CORRECTLY!")
        sys.exit(0)
    else:
        print("⚠️ SOME TESTS FAILED. PLEASE CHECK THE ERRORS ABOVE.")
        sys.exit(1)

if __name__ == "__main__":
    run_master_test_suite()
