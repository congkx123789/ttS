import time
import requests

modes = ["vietphrase", "hanviet", "fast", "advanced", "advanced_hanviet"]
text = "林动缓缓的吐出一团白气，白气之中，有着一些淡淡的黑点，那是体内的杂质。他握了握拳头，感受着体内那比以前强悍了许多的力量，脸庞上也是忍不住的浮现出一抹满意的笑容。这等修炼速度，若是让得林家那些长辈知道，怕是会直接惊得跳起来。"
url = "http://localhost:5051/translate"

print(f"{'Mode':<20} | {'Time (ms)':<10} | {'Length (chars)'}")
print("-" * 50)

for mode in modes:
    payload = {
        "texts": [text, text, text, text, text], # 5 times the text to increase workload
        "mode": mode,
        "vip_key": "VIP_SERVER"
    }
    
    # warmup
    requests.post(url, json=payload)
    
    start_time = time.perf_counter()
    response = requests.post(url, json=payload)
    end_time = time.perf_counter()
    
    if response.status_code == 200:
        data = response.json()
        translations = data.get("translations", [])
        total_len = sum(len(t) for t in translations)
        duration_ms = (end_time - start_time) * 1000
        print(f"{mode:<20} | {duration_ms:<10.2f} | {total_len}")
    else:
        print(f"{mode:<20} | ERROR: {response.status_code}")
