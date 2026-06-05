#!/usr/bin/env python3
"""
Chi tiết đo lường tốc độ Streaming từng Chunk từ VPS
Đo chính xác mili-giây nhận từng chữ
"""
import requests
import time
import json

VPS_URL = "https://tienhiep.lyvuha.com/translate_stream"
TEXT = "林动缓缓的吐出一团白气，白气之中，有着一些淡淡的黑点，那是体内的杂质。他握了握拳头，感受着体内那比以前强悍了许多的力量，脸庞上也是忍不住的浮现出一抹满意的笑容。这等修炼速度，若是让得林家 those 长辈 biết, sợ là sẽ trực tiếp kinh sợ nhảy dựng lên."

payload = {
    "texts": [TEXT] * 5, # Dịch 5 đoạn cùng lúc (~550 chữ Hán)
    "mode": "advanced",
    "vip_key": "VIP_SERVER"
}

print("🚀 BẮT ĐẦU ĐO CHI TIẾT TỪNG CHUNK TỪ VPS...")
print(f"Gửi đi: {len(TEXT)*5} ký tự tiếng Trung.")
print("-" * 75)

start_time = time.perf_counter()

try:
    response = requests.post(VPS_URL, json=payload, stream=True, timeout=10)
    conn_time = (time.perf_counter() - start_time) * 1000
    print(f"⏱️  Kết nối thành công (TTFB / Lấy Header): {conn_time:.2f} ms")
    print("-" * 75)
    print(f"{'STT Chunk':<12} | {'Thời gian nhận (ms)':<22} | {'Khoảng cách (ms)':<18} | Nội dung chunk nhận được")
    print("-" * 75)
    
    last_chunk_time = start_time
    chunk_index = 0
    total_chars = 0
    
    for line in response.iter_lines():
        if line:
            decoded_line = line.decode('utf-8')
            if decoded_line.startswith('data: '):
                chunk_index += 1
                current_time = time.perf_counter()
                
                # Tính thời gian từ lúc bắt đầu request
                elapsed_from_start = (current_time - start_time) * 1000
                # Tính khoảng cách giữa các chunk
                delta_chunk = (current_time - last_chunk_time) * 1000
                
                # Parse JSON để lấy độ dài chữ dịch
                try:
                    data = json.loads(decoded_line[6:])
                    chunk_text = data.get("text", "")
                    total_chars += len(chunk_text)
                    preview = chunk_text.replace("\n", "\\n")[:40]
                except Exception:
                    preview = decoded_line[6:46]
                
                print(f"Chunk #{chunk_index:<6} | {elapsed_from_start:<18.2f} ms | {delta_chunk:<14.2f} ms | {preview}...")
                
                last_chunk_time = current_time

    total_time = (time.perf_counter() - start_time) * 1000
    print("-" * 75)
    print(f"📊 TỔNG KẾT:")
    print(f"  - Tổng số chunk nhận: {chunk_index}")
    print(f"  - Tổng số ký tự dịch nhận về: {total_chars} ký tự tiếng Việt")
    print(f"  - Tổng thời gian nhận toàn bộ: {total_time:.2f} ms")
    print(f"  - Tốc độ truyền tải chữ: {total_chars / (total_time / 1000):.2f} ký tự/giây")

except Exception as e:
    print(f"❌ Lỗi trong quá trình nhận stream: {e}")
