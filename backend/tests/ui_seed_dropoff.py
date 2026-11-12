# Seed / cleanup TEST_ data for UI checks of pickup/dropoff feature. Usage: python ui_seed_dropoff.py seed|clean
import os, sys, json, requests
API = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") + "/api"
F = "/tmp/ui_seed_dropoff.json"
s = requests.Session()
s.headers["Authorization"] = "Bearer " + requests.post(f"{API}/auth/login", json={"phone": "1234567890", "password": "admin123"}).json()["token"]
DATE = "2030-03-10"
P = {"lat": 34.0164, "lng": 44.145}
D = {"lat": 33.3152, "lng": 44.3661}
if sys.argv[1] == "seed":
    c = {"users": [], "vehicles": [], "bookings": [], "trips": []}
    d = s.post(f"{API}/accounts", json={"role": "driver", "name": "TEST_سائق_وصول", "phone": "0790000911", "password": "drv123"}).json()
    c["users"].append(d["id"])
    st = s.post(f"{API}/accounts", json={"role": "student", "name": "TEST_طالبة_وصول", "phone": "0770000911", "password": "stu123",
                                         "gender": "female", "university": "جامعة بغداد", "status": "active"}).json()
    c["users"].append(st["id"])
    v = s.post(f"{API}/vehicles", json={"plate": "TEST وصول 1", "driver_id": d["id"], "model": "Starex"}).json()
    c["vehicles"].append(v["id"])
    b = s.post(f"{API}/bookings", json={"student_name": "TEST_طالبة_وصول", "phone": "0770000911", "gender": "female", "university": "جامعة بغداد",
                                        "date": DATE, "pickup_time": "07:00", "trip_type": "round", "location": P, "address": "TEST_بلد",
                                        "dropoff_location": D, "dropoff_address": "TEST_بغداد", "notes": ""}).json()
    c["bookings"].append(b["id"])
    print(s.post(f"{API}/dispatch", json={"booking_id": b["id"], "vehicle_id": v["id"], "row": 3, "seat": 1}).status_code)
    b2 = s.post(f"{API}/bookings", json={"student_name": "TEST_معلق_وصول", "phone": "0770000912", "gender": "male", "university": "جامعة بغداد",
                                         "date": DATE, "pickup_time": "07:00", "trip_type": "go", "location": P, "address": "x",
                                         "dropoff_location": D, "dropoff_address": "y", "notes": ""}).json()
    c["bookings"].append(b2["id"])
    for dr in ["go", "return"]:
        c["trips"].append(s.post(f"{API}/trips", json={"vehicle_id": v["id"], "date": DATE, "direction": dr, "start_time": "07:00"}).json()["id"])
    c.update({"round_bid": b["id"], "pending_bid": b2["id"], "vid": v["id"]})
    json.dump(c, open(F, "w"))
    print(json.dumps(c))
else:
    c = json.load(open(F))
    extra = sys.argv[2:]  # extra booking ids created via UI
    for t in c["trips"]:
        print("trip", s.delete(f"{API}/trips/{t}").status_code)
    for b in c["bookings"] + extra:
        print("booking", s.delete(f"{API}/bookings/{b}").status_code)
    for v in c["vehicles"]:
        print("veh", s.delete(f"{API}/vehicles/{v}").status_code)
    for u in c["users"]:
        print("user", s.delete(f"{API}/accounts/{u}").status_code)
