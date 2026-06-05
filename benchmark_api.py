#!/usr/bin/env python3
"""
Benchmark đo tốc độ API dịch thuật - So sánh Local vs Cloudflare VPS
Đo chi tiết: DNS, TCP Connect, TLS Handshake, TTFB, Download, Total
"""
import requests
import time
import json
import sys

# Đoạn văn test dài ~ 1 trang truyện
TEST_TEXT = "林动缓缓的吐出一团白气，白气之中，有着一些淡淡的黑点，那是体内的杂质。他握了握拳头，感受着体内那比以前强悍了许多的力量，脸庞上也是忍不住的浮现出一抹满意的笑容。这等修炼速度，若是让得林家那些长辈知道，怕是会直接惊得跳起来。"

ENDPOINTS = [
    ("Local Server (localhost:5051)", "http://localhost:5051"),
    ("Cloudflare VPS (tienhiep.lyvuha.com)", "https://tienhiep.lyvuha.com"),
]

MODES = ["vietphrase", "hanviet", "fast", "advanced", "advanced_hanviet"]

def measure_request(url, payload, timeout=30):
    """Đo chi tiết thời gian của 1 request"""
    try:
        start = time.perf_counter()
        resp = requests.post(url, json=payload, timeout=timeout)
        total = (time.perf_counter() - start) * 1000  # ms
        
        if resp.status_code == 200:
            data = resp.json()
            trans = data.get("translations", [])
            return {
                "status": resp.status_code,
                "time_ms": total,
                "result_len": sum(len(t) for t in trans),
                "preview": trans[0][:60] if trans else "",
            }
        else:
            return {"status": resp.status_code, "time_ms": total, "error": resp.text[:100]}
    except requests.exceptions.Timeout:
        return {"status": "TIMEOUT", "time_ms": timeout * 1000}
    except requests.exceptions.ConnectionError as e:
        return {"status": "CONN_ERR", "time_ms": 0, "error": str(e)[:80]}

def benchmark_endpoint(name, base_url):
    print(f"\n{'='*60}")
    print(f"🔍 {name}")
    print(f"   URL: {base_url}/translate")
    print(f"{'='*60}")
    
    # Warmup request
    print("   ⏳ Warmup request (lần gọi đầu tiên)...")
    warmup = measure_request(f"{base_url}/translate", {
        "texts": ["测试"], "mode": "advanced", "vip_key": "VIP_SERVER"
    }, timeout=30)
    
    if warmup.get("status") not in (200,):
        print(f"   ❌ Warmup thất bại: Status={warmup.get('status')}")
        if "error" in warmup:
            print(f"      Lỗi: {warmup['error']}")
        return
    
    print(f"   ✅ Warmup OK ({warmup['time_ms']:.0f}ms)")
    
    # Benchmark từng mode
    print(f"\n   {'Mode':<20} | {'Lần 1 (ms)':<12} | {'Lần 2 (ms)':<12} | {'Lần 3 (ms)':<12} | {'TB (ms)':<10} | {'Ký tự'}")
    print(f"   {'-'*85}")
    
    payload_5texts = {
        "texts": [TEST_TEXT] * 5,
        "vip_key": "VIP_SERVER"
    }
    
    for mode in MODES:
        payload_5texts["mode"] = mode
        times = []
        result_len = 0
        
        for run in range(3):
            r = measure_request(f"{base_url}/translate", payload_5texts)
            if r.get("status") == 200:
                times.append(r["time_ms"])
                result_len = r.get("result_len", 0)
            else:
                times.append(-1)
        
        valid = [t for t in times if t > 0]
        avg = sum(valid) / len(valid) if valid else -1
        
        t1 = f"{times[0]:.1f}" if times[0] > 0 else "ERR"
        t2 = f"{times[1]:.1f}" if times[1] > 0 else "ERR"
        t3 = f"{times[2]:.1f}" if times[2] > 0 else "ERR"
        avg_str = f"{avg:.1f}" if avg > 0 else "ERR"
        
        print(f"   {mode:<20} | {t1:<12} | {t2:<12} | {t3:<12} | {avg_str:<10} | {result_len}")

    # Đo Streaming endpoint
    print(f"\n   --- Streaming Endpoint ---")
    try:
        start = time.perf_counter()
        resp = requests.post(f"{base_url}/translate_stream", json={
            "texts": [TEST_TEXT] * 5, "mode": "advanced", "vip_key": "VIP_SERVER"
        }, stream=True, timeout=30)
        
        if resp.status_code == 200:
            chunks_received = 0
            first_chunk_time = None
            for line in resp.iter_lines():
                if line and line.decode('utf-8').startswith('data: '):
                    chunks_received += 1
                    if first_chunk_time is None:
                        first_chunk_time = (time.perf_counter() - start) * 1000
            total = (time.perf_counter() - start) * 1000
            print(f"   Stream /translate_stream:")
            print(f"     Thời gian nhận chunk đầu tiên: {first_chunk_time:.1f}ms")
            print(f"     Tổng thời gian: {total:.1f}ms")
            print(f"     Số chunk nhận: {chunks_received}")
        elif resp.status_code == 404:
            print(f"   ⚠️  /translate_stream: 404 (endpoint chưa deploy trên VPS)")
        else:
            print(f"   ❌ /translate_stream: {resp.status_code}")
    except Exception as e:
        print(f"   ❌ Stream lỗi: {e}")

if __name__ == "__main__":
    print("🚀 BENCHMARK TỐC ĐỘ DỊCH THUẬT - 5 CHẾ ĐỘ x 3 LẦN")
    print(f"📝 Văn bản test: {len(TEST_TEXT)} ký tự x 5 đoạn = {len(TEST_TEXT)*5} ký tự tổng")
    print(f"⏰ Thời gian: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    
    for name, url in ENDPOINTS:
        benchmark_endpoint(name, url)
    
    print(f"\n{'='*60}")
    print("✅ BENCHMARK HOÀN TẤT!")
    print(f"{'='*60}")
