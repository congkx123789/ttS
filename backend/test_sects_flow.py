import requests, time, sys, os
BASE_URL = "http://localhost:5051"
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(ROOT_DIR)
from backend.database.db_manager import get_user_db_conn

H = {"X-Bypass-Rate-Limit": "tienhiep_bypass_secret_9988"}

def step(msg): print(f"\n{'='*60}\n👉 {msg}\n{'='*60}")
def ok(msg): print(f"  ✅ {msg}")
def info(msg): print(f"  📌 {msg}")

def verify_db(username):
    conn = get_user_db_conn()
    conn.execute("UPDATE users SET email_verified = 1 WHERE username = ?", (username,))
    conn.commit(); conn.close()

class C:
    def __init__(self, u, p):
        self.u, self.p, self.token, self.h, self.uid = u, p, None, dict(H), None
    def register(self):
        r = requests.post(f"{BASE_URL}/api/auth/register", json={"username":self.u,"password":self.p,"email":f"{self.u}@test.com"}, headers=self.h)
        if r.status_code == 200 or "đã tồn tại" in r.text: verify_db(self.u)
    def login(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"username":self.u,"password":self.p}, headers=self.h)
        assert r.status_code == 200, f"Login fail {self.u}: {r.text}"
        d = r.json(); self.token = d.get("access_token") or d.get("token")
        self.h = {"Authorization":f"Bearer {self.token}", **H}; self.uid = d.get("user",{}).get("id")
        ok(f"Login {self.u} (ID:{self.uid})")
    def post(self, ep, data=None): return requests.post(f"{BASE_URL}{ep}", json=data, headers=self.h)
    def get(self, ep, params=None): return requests.get(f"{BASE_URL}{ep}", params=params, headers=self.h)

def cleanup():
    # Use API-based cleanup - leave all sects via HTTP
    for n in ["tst_leader","tst_vice","tst_elder","tst_inner1","tst_inner2","tst_outer"]:
        try:
            # Login
            r = requests.post(f"{BASE_URL}/api/auth/login", json={"username":n,"password":"pw123"}, headers=H)
            if r.status_code != 200: continue
            tok = r.json().get("access_token") or r.json().get("token")
            ah = {"Authorization":f"Bearer {tok}", **H}
            # Check if in sect
            r = requests.get(f"{BASE_URL}/api/sects/my-sect", headers=ah)
            if r.status_code == 200 and r.json().get("in_sect"):
                requests.post(f"{BASE_URL}/api/sects/leave", headers=ah)
        except: pass

def run():
    step("1. TẠO 6 TÀI KHOẢN")
    names = ["tst_leader","tst_vice","tst_elder","tst_inner1","tst_inner2","tst_outer"]
    us = {n: C(n,"pw123") for n in names}
    for c in us.values(): c.register(); c.login()

    step("2. DỌN DẸP DB CŨ")
    cleanup()

    step("3. SÁNG LẬP TÔNG MÔN")
    sn = f"TestTong{int(time.time())}"
    r = us["tst_leader"].post("/api/sects/create", {"name":sn,"slogan":"Kiếm khí tung hoành","badge":"gold"})
    assert r.status_code == 200, f"Create fail: {r.text}"
    sid = r.json()["sect_id"]; ok(f"Tông '{sn}' ID={sid}")

    step("4. TÌM KIẾM TÔNG MÔN")
    r = us["tst_leader"].get("/api/sects/search", {"q":"TestTong"})
    assert r.status_code == 200 and r.json()["total"] >= 1
    ok(f"Tìm thấy {r.json()['total']} tông môn, trang {r.json()['page']}/{r.json()['total_pages']}")

    step("5. XEM TÔNG MÔN THEO ID")
    r = us["tst_leader"].get(f"/api/sects/{sid}")
    assert r.status_code == 200 and r.json()["sect"]["name"] == sn
    ok(f"Xem tông ID={sid}: {r.json()['member_count']} thành viên")

    step("6. GIA NHẬP 5 ĐỆ TỬ")
    for n in names[1:]:
        r = us[n].post("/api/sects/join", {"sect_id":sid})
        assert r.status_code == 200, f"{n} join fail: {r.text}"
    ok("5 đệ tử gửi đơn bái kiến")

    r = us["tst_leader"].get("/api/sects/requests/list")
    reqs = r.json()["requests"]; ok(f"{len(reqs)} yêu cầu chờ duyệt")
    for rq in reqs:
        r = us["tst_leader"].post("/api/sects/requests/respond", {"request_id":rq["id"],"action":"approve"})
        assert r.status_code == 200
    ok("Duyệt toàn bộ")

    step("7. HỆ THỐNG 5 CHỨC DANH")
    promotions = [
        ("tst_vice", "vice_leader", "Phó Tông chủ"),
        ("tst_elder", "elder", "Trưởng lão"),
        ("tst_inner1", "inner_disciple", "Nội môn đệ tử"),
        ("tst_inner2", "inner_disciple", "Nội môn đệ tử"),
    ]
    for uname, role, label in promotions:
        r = us["tst_leader"].post("/api/sects/promote/rank", {"user_id":us[uname].uid,"role":role})
        assert r.status_code == 200, f"Promote {uname} fail: {r.text}"
        ok(f"{uname} → {label}")

    step("8. KIỂM TRA QUYỀN PHÂN CẤP")
    # Vice leader thăng elder cho outer
    r = us["tst_vice"].post("/api/sects/promote/rank", {"user_id":us["tst_outer"].uid,"role":"elder"})
    assert r.status_code == 200; ok("Phó Tông chủ thăng Trưởng lão cho tst_outer ✓")
    # Hạ lại về member
    r = us["tst_vice"].post("/api/sects/promote/rank", {"user_id":us["tst_outer"].uid,"role":"member"})
    assert r.status_code == 200; ok("Phó Tông chủ hạ tst_outer về Ngoại môn đệ tử ✓")
    # Elder KHÔNG THỂ thăng vice_leader
    r = us["tst_elder"].post("/api/sects/promote/rank", {"user_id":us["tst_outer"].uid,"role":"vice_leader"})
    assert r.status_code == 403; ok("Trưởng lão bị chặn thăng Phó Tông chủ ✓ (403)")

    step("9. XEM THÀNH VIÊN & LỌC THEO CHỨC DANH")
    r = us["tst_leader"].get("/api/sects/members")
    assert r.status_code == 200
    for m in r.json()["members"]: info(f"{m['username']} = {m['role_label']} (cống hiến: {m['contribution']})")
    r = us["tst_leader"].get("/api/sects/members", {"role":"inner_disciple"})
    ok(f"Lọc Nội môn: {len(r.json()['members'])} người")

    step("10. CHAT CHUNG TỔNG TÔNG MÔN")
    msgs = [
        ("tst_leader", "Toàn tông nghe lệnh, ngày mai xuất chinh!"),
        ("tst_vice", "Phó Tông chủ đã sắp xếp đội hình chiến đấu."),
        ("tst_elder", "Trưởng lão báo cáo: đan dược đã đủ cung ứng."),
        ("tst_inner1", "Nội môn đệ tử xin tuân lệnh!"),
        ("tst_outer", "Ngoại môn đệ tử sẵn sàng!"),
    ]
    for u, msg in msgs:
        r = us[u].post("/api/sects/chat/send", {"message":msg,"chat_type":"general"})
        assert r.status_code == 200
    r = us["tst_outer"].get("/api/sects/chat/history", {"chat_type":"general"})
    ok(f"Chat chung: {len(r.json()['messages'])} tin nhắn")
    for m in r.json()["messages"]: info(f"[{m['sender_name']}]: {m['message']}")

    step("11. CHAT RIÊNG 1-1 TRONG TÔNG MÔN")
    pairs = [
        ("tst_leader","tst_vice","Phó Tông chủ, ngày mai phân công thế nào?"),
        ("tst_vice","tst_leader","Dạ, đệ tử đã chuẩn bị 3 đội tiên phong."),
        ("tst_inner1","tst_inner2","Đồng môn ơi, cùng luyện công tối nay không?"),
        ("tst_inner2","tst_inner1","Được chứ, 8 giờ tại Luyện Công Đường nhé!"),
        ("tst_elder","tst_outer","Ngoại môn đệ tử, tu vi gần đây tiến bộ ra sao?"),
        ("tst_outer","tst_elder","Dạ bẩm Trưởng lão, đệ tử đang ở Luyện Khí tầng 3."),
    ]
    for s, t, msg in pairs:
        r = us[s].post("/api/sects/chat/send", {"message":msg,"chat_type":"direct","target_id":us[t].uid})
        assert r.status_code == 200
    # Verify
    r = us["tst_leader"].get("/api/sects/chat/history", {"chat_type":"direct","target_id":us["tst_vice"].uid})
    ok(f"Chat riêng Leader↔Vice: {len(r.json()['messages'])} tin")
    r = us["tst_inner1"].get("/api/sects/chat/history", {"chat_type":"direct","target_id":us["tst_inner2"].uid})
    ok(f"Chat riêng Inner1↔Inner2: {len(r.json()['messages'])} tin")
    r = us["tst_elder"].get("/api/sects/chat/history", {"chat_type":"direct","target_id":us["tst_outer"].uid})
    ok(f"Chat riêng Elder↔Outer: {len(r.json()['messages'])} tin")

    step("12. TẠO NHÓM CHAT NHỎ #1 (Ban lãnh đạo)")
    r = us["tst_leader"].post("/api/sects/chat/groups/create", {
        "name":"Ban lãnh đạo","members":[us["tst_leader"].uid, us["tst_vice"].uid, us["tst_elder"].uid]
    })
    assert r.status_code == 200; g1 = r.json()["group_id"]; ok(f"Nhóm 'Ban lãnh đạo' ID={g1}")

    step("13. TẠO NHÓM CHAT NHỎ #2 (Đội tu luyện)")
    r = us["tst_inner1"].post("/api/sects/chat/groups/create", {
        "name":"Đội tu luyện","members":[us["tst_inner1"].uid, us["tst_inner2"].uid, us["tst_outer"].uid]
    })
    assert r.status_code == 200; g2 = r.json()["group_id"]; ok(f"Nhóm 'Đội tu luyện' ID={g2}")

    step("14. CHAT TRONG NHÓM NHỎ")
    for u, msg in [("tst_leader","Hội nghị mật: chiến lược đánh Ma Giáo"),("tst_vice","Đề xuất tấn công từ hướng Đông"),("tst_elder","Đồng ý, trưởng lão sẽ dẫn đội hỗ trợ")]:
        r = us[u].post("/api/sects/chat/send", {"message":msg,"chat_type":"group","group_id":g1})
        assert r.status_code == 200
    for u, msg in [("tst_inner1","Tối nay luyện kiếm pháp mới!"),("tst_inner2","OK sư huynh!"),("tst_outer","Đệ tử cũng xin tham gia!")]:
        r = us[u].post("/api/sects/chat/send", {"message":msg,"chat_type":"group","group_id":g2})
        assert r.status_code == 200
    r = us["tst_leader"].get("/api/sects/chat/history", {"chat_type":"group","group_id":g1})
    ok(f"Nhóm BLĐ: {len(r.json()['messages'])} tin")
    r = us["tst_inner1"].get("/api/sects/chat/history", {"chat_type":"group","group_id":g2})
    ok(f"Nhóm tu luyện: {len(r.json()['messages'])} tin")

    step("15. BẢO MẬT: NGƯỜI NGOÀI KHÔNG CHAT ĐƯỢC NHÓM")
    r = us["tst_outer"].post("/api/sects/chat/send", {"message":"hack","chat_type":"group","group_id":g1})
    assert r.status_code == 403; ok(f"Outer bị chặn chat nhóm BLĐ (403) ✓")
    r = us["tst_outer"].get("/api/sects/chat/history", {"chat_type":"group","group_id":g1})
    assert r.status_code == 403; ok(f"Outer bị chặn xem lịch sử BLĐ (403) ✓")

    step("16. THÊM/XÓA THÀNH VIÊN NHÓM CHAT")
    r = us["tst_leader"].post(f"/api/sects/chat/groups/{g1}/members/add", {"user_ids":[us["tst_inner1"].uid]})
    assert r.status_code == 200; ok(f"Thêm Inner1 vào BLĐ, members={r.json()['members']}")
    r = us["tst_leader"].post(f"/api/sects/chat/groups/{g1}/members/remove", {"user_id":us["tst_inner1"].uid})
    assert r.status_code == 200; ok(f"Xóa Inner1 khỏi BLĐ, members={r.json()['members']}")

    step("17. XEM THÔNG TIN NHÓM CHAT")
    r = us["tst_leader"].get(f"/api/sects/chat/groups/{g1}")
    assert r.status_code == 200
    ginfo = r.json(); ok(f"Nhóm: {ginfo['group']['name']}, {ginfo['member_count']} thành viên")
    for m in ginfo["members"]: info(f"  {m['username']} ({m['role_label']})")

    step("18. DANH SÁCH TẤT CẢ NHÓM CHAT CỦA TÔI")
    r = us["tst_leader"].get("/api/sects/chat/groups")
    assert r.status_code == 200; ok(f"Leader thấy {len(r.json()['groups'])} nhóm")
    r = us["tst_inner1"].get("/api/sects/chat/groups")
    ok(f"Inner1 thấy {len(r.json()['groups'])} nhóm")

    step("19. KẾT BẠN & CHAT BẠN BÈ")
    conn = get_user_db_conn()
    conn.execute("DELETE FROM friendships WHERE user_id IN (?,?) OR friend_id IN (?,?)",
                 (us["tst_inner1"].uid, us["tst_outer"].uid, us["tst_inner1"].uid, us["tst_outer"].uid))
    conn.commit(); conn.close()
    r = us["tst_inner1"].post("/api/friends/request", {"friend_username":"tst_outer"})
    assert r.status_code == 200; ok("Inner1 gửi kết bạn Outer")
    r = us["tst_outer"].post("/api/friends/respond", {"sender_id":us["tst_inner1"].uid,"action":"accept"})
    assert r.status_code == 200; ok("Outer chấp nhận")
    r = us["tst_inner1"].get("/api/friends/list")
    ok(f"Bạn bè Inner1: {[f['username'] for f in r.json()['friends']]}")
    r = us["tst_inner1"].post("/api/messages/send", {"receiver_id":us["tst_outer"].uid,"message":"Chào bạn, tối nay đi phụ bản không?"})
    assert r.status_code == 200
    r = us["tst_outer"].post("/api/messages/send", {"receiver_id":us["tst_inner1"].uid,"message":"Đi chứ! 9h tối nhé!"})
    assert r.status_code == 200
    r = us["tst_inner1"].get(f"/api/messages/chat/{us['tst_outer'].uid}")
    ok(f"Chat bạn bè: {len(r.json()['messages'])} tin nhắn")
    for m in r.json()["messages"]:
        sn = "tst_inner1" if m["sender_id"]==us["tst_inner1"].uid else "tst_outer"
        info(f"[{sn}]: {m['message']}")

    step("20. CỐNG HIẾN & XEM TÔNG MÔN QUA ID")
    us["tst_inner1"].post("/api/sects/contribute", {"amount":300})
    us["tst_outer"].post("/api/sects/contribute", {"amount":200})
    r = us["tst_leader"].get(f"/api/sects/{sid}")
    d = r.json()
    ok(f"Tông '{d['sect']['name']}' cấp {d['sect']['level']}, cống hiến tổng: {d['sect']['contribution']}")
    ok(f"Phân bố chức danh: {d['role_counts']}")

    step("🎉 TOÀN BỘ 20 BƯỚC TEST THÀNH CÔNG!")

if __name__ == "__main__": run()
