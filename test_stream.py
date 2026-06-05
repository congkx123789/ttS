import requests
import time
import json
import sys

def test_stream(url):
    print(f"\n🚀 Đang test Streaming tại URL: {url}")
    print("-" * 50)
    
    payload = {
        "texts": [
            "林动缓缓的吐出一团白气，",
            "白气之中，有着一些淡淡的黑点，",
            "那是体内的杂质。",
            "他握了握拳头，",
            "感受着体内那比以前强悍了许多的力量，",
            "脸庞上也是忍不住的浮现出一抹满意的笑容。"
        ],
        "mode": "advanced",
        "vip_key": "VIP_SERVER"
    }
    
    start_time = time.perf_counter()
    
    try:
        response = requests.post(url, json=payload, stream=True, timeout=5)
        
        if response.status_code == 404:
            print(f"❌ Lỗi 404: API {url} chưa tồn tại!")
            print("👉 Nếu đây là Server Cloudflare (VPS), bạn cần gõ 'git pull origin main' và Restart Server trước khi test.")
            return
            
        if response.status_code != 200:
            print(f"❌ Lỗi {response.status_code}: {response.text}")
            return
            
        print("✅ Kết nối thành công! Đang hứng dữ liệu Streaming từng cục (Chunk):")
        
        for line in response.iter_lines():
            if line:
                line_str = line.decode('utf-8')
                if line_str.startswith('data: '):
                    data = json.loads(line_str[6:])
                    chunk_time = (time.perf_counter() - start_time) * 1000
                    print(f"[{chunk_time:>6.1f} ms] Đã nhận đoạn {data['index']}: {data['text']}")
                    
        total_time = (time.perf_counter() - start_time) * 1000
        print("-" * 50)
        print(f"🎉 Hoàn tất Stream trong {total_time:.1f} ms!")
        
    except requests.exceptions.RequestException as e:
        print(f"❌ Lỗi kết nối: {e}")

if __name__ == "__main__":
    # Test Local Server trước
    test_stream("http://localhost:5051/translate_stream")
    
    # Test Cloudflare Server (VPS)
    test_stream("https://tienhiep.lyvuha.com/translate_stream")
