# One-off: verify UI-created bookings state then delete UI test data by id
import os, requests
B = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") + "/api"
t = requests.post(f"{B}/auth/login", json={"phone": "1234567890", "password": "admin123"}).json()["token"]
s = requests.Session(); s.headers["Authorization"] = f"Bearer {t}"
vid = open("/tmp/vid.txt").read().strip()
tid = open("/tmp/tid.txt").read().strip()
for d in ("2030-02-20", "2030-02-21"):
    for b in s.get(f"{B}/bookings", params={"date": d}).json():
        if b["student_name"].startswith("TEST_UI_") or b["phone"] == "0775550123":
            print(b["student_name"], b["status"], b["id"])
            print(" delete", s.delete(f"{B}/bookings/{b['id']}").status_code)
print("trip del", s.delete(f"{B}/trips/{tid}").status_code)
print("veh del", s.delete(f"{B}/vehicles/{vid}").status_code)
print(s.get(f"{B}/stats").json())
