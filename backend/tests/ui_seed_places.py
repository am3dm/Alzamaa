# Seed / cleanup TEST_ data for UI checks of return-time + saved-places. Usage: python ui_seed_places.py seed|clean [extra booking ids]
import os, sys, json, requests
API = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") + "/api"
F = "/tmp/ui_seed_places.json"
s = requests.Session()
s.headers["Authorization"] = "Bearer " + requests.post(f"{API}/auth/login", json={"phone": "1234567890", "password": "admin123"}).json()["token"]
DATE = "2030-05-12"
HOME = {"lat": 34.0101, "lng": 44.1401}
UNI = {"lat": 33.3101, "lng": 44.3701}
if sys.argv[1] == "seed":
    c = {"users": [], "vehicles": [], "bookings": [], "trips": []}
    d = s.post(f"{API}/accounts", json={"role": "driver", "name": "TEST_سائق_إياب", "phone": "0790000921", "password": "drv123"}).json()
    c["users"].append(d["id"])
    st = s.post(f"{API}/accounts", json={"role": "student", "name": "TEST_طالبة_نقاط", "phone": "0770000921", "password": "stu123",
                                         "gender": "female", "university": "جامعة بغداد", "status": "active",
                                         "home_location": HOME, "home_address": "TEST_سكن", "uni_location": UNI, "uni_address": "TEST_جامعة"}).json()
    c["users"].append(st["id"])
    st2 = s.post(f"{API}/accounts", json={"role": "student", "name": "TEST_طالب_فارغ", "phone": "0770000922", "password": "stu123",
                                          "gender": "male", "university": "جامعة بغداد", "status": "active"}).json()
    c["users"].append(st2["id"])
    v = s.post(f"{API}/vehicles", json={"plate": "TEST إياب 1", "driver_id": d["id"], "model": "Starex"}).json()
    c["vehicles"].append(v["id"])
    specs = [("TEST_ذهاب_إياب_أ", "round", "07:00", "17:00", 1), ("TEST_ذهاب_إياب_ب", "round", "08:00", "14:00", 2)]
    for name, tt, pt, rt, seat in specs:
        b = s.post(f"{API}/bookings", json={"student_name": name, "phone": f"07700009{30+seat}", "gender": "female", "university": "جامعة بغداد",
                                            "date": DATE, "pickup_time": pt, "return_pickup_time": rt, "trip_type": tt, "location": HOME,
                                            "address": "x", "dropoff_location": UNI, "dropoff_address": "y", "notes": ""}).json()
        c["bookings"].append(b["id"])
        print(s.post(f"{API}/dispatch", json={"booking_id": b["id"], "vehicle_id": v["id"], "row": 2, "seat": seat}).status_code)
    b3 = s.post(f"{API}/bookings", json={"student_name": "TEST_معلق_إياب", "phone": "0770000939", "gender": "male", "university": "جامعة بغداد",
                                         "date": DATE, "pickup_time": "07:00", "return_pickup_time": "16:00", "trip_type": "round", "location": HOME,
                                         "address": "x", "dropoff_location": UNI, "dropoff_address": "y", "notes": ""}).json()
    c["bookings"].append(b3["id"])
    for dr in ["go", "return"]:
        c["trips"].append(s.post(f"{API}/trips", json={"vehicle_id": v["id"], "date": DATE, "direction": dr, "start_time": "07:00"}).json()["id"])
    c.update({"pending_bid": b3["id"], "vid": v["id"], "student_id": st["id"], "student2_id": st2["id"]})
    json.dump(c, open(F, "w"))
    print(json.dumps(c))
else:
    c = json.load(open(F))
    extra = sys.argv[2:]
    for t in c["trips"]:
        print("trip", s.delete(f"{API}/trips/{t}").status_code)
    # also delete any bookings by seeded student phones created through UI
    for b in s.get(f"{API}/bookings").json():
        if b["phone"] in ("0770000921", "0770000922") and b["id"] not in c["bookings"]:
            extra.append(b["id"])
    for b in c["bookings"] + extra:
        print("booking", s.delete(f"{API}/bookings/{b}").status_code)
    for v in c["vehicles"]:
        print("veh", s.delete(f"{API}/vehicles/{v}").status_code)
    for u in c["users"]:
        print("user", s.delete(f"{API}/accounts/{u}").status_code)
