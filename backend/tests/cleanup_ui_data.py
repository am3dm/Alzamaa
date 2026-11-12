# One-off: delete UI-test data (trip, vehicle, accounts) created during iteration 2 UI run, by id
import os, requests
B = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") + "/api"
s = requests.Session()
s.headers["Authorization"] = "Bearer " + requests.post(f"{B}/auth/login", json={"phone": "1234567890", "password": "admin123"}).json()["token"]
vid, tid = open("/tmp/ui_ids.txt").read().split()
print("trip", s.delete(f"{B}/trips/{tid}").status_code)
print("vehicle", s.delete(f"{B}/vehicles/{vid}").status_code)
for a in s.get(f"{B}/accounts").json():
    if a["phone"] in ("0711197155", "0721197155"):
        print("acct", a["name"], s.delete(f"{B}/accounts/{a['id']}").status_code)
print(s.get(f"{B}/stats").json())
