# Noexis TMS: separate return pickup time for round bookings + saved student places (home/uni) + accounts lookup
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
DATE = "2030-04-15"
SUF = uuid.uuid4().hex[:6]
NUM = str(uuid.uuid4().int)[:7]
HOME = {"lat": 34.0101, "lng": 44.1401}
UNI = {"lat": 33.3101, "lng": 44.3701}
HOME2 = {"lat": 34.0202, "lng": 44.1502}
UNI2 = {"lat": 33.3202, "lng": 44.3802}


def login(phone, pw):
    return requests.post(f"{API}/auth/login", json={"phone": phone, "password": pw})


@pytest.fixture(scope="module")
def admin():
    r = login("1234567890", "admin123")
    assert r.status_code == 200, r.text
    s = requests.Session()
    s.headers["Authorization"] = f"Bearer {r.json()['token']}"
    return s


@pytest.fixture(scope="module")
def ctx(admin):
    c = {"vehicles": [], "bookings": [], "trips": [], "users": []}
    yield c
    for t in c["trips"]:
        admin.delete(f"{API}/trips/{t}")
    for b in c["bookings"]:
        admin.delete(f"{API}/bookings/{b}")
    for v in c["vehicles"]:
        admin.delete(f"{API}/vehicles/{v}")
    for u in c["users"]:
        admin.delete(f"{API}/accounts/{u}")


@pytest.fixture(scope="module")
def student(admin, ctx):
    phone = f"077{NUM}"
    r = admin.post(f"{API}/accounts", json={"role": "student", "name": f"TEST_StuPl{SUF}", "phone": phone, "password": "stu123",
                                           "gender": "female", "university": "جامعة بغداد", "status": "active",
                                           "home_location": HOME, "home_address": "TEST_home", "uni_location": UNI, "uni_address": "TEST_uni"})
    assert r.status_code == 200, r.text
    u = r.json()
    ctx["users"].append(u["id"])
    assert u["home_location"] == HOME and u["uni_address"] == "TEST_uni"
    tok = login(phone, "stu123").json()["token"]
    return {"id": u["id"], "phone": phone, "h": {"Authorization": f"Bearer {tok}"}}


def body(trip_type, **kw):
    b = {"student_name": f"TEST_B{SUF}", "phone": f"07{uuid.uuid4().int % 10**9:09d}", "gender": "male",
         "university": "جامعة بغداد", "date": DATE, "pickup_time": "07:00", "trip_type": trip_type,
         "location": HOME, "address": "a", "dropoff_location": UNI, "dropoff_address": "b", "notes": ""}
    b.update(kw)
    return b


def me(h):
    return requests.get(f"{API}/auth/me", headers=h).json()


# --- return pickup time
def test_round_without_return_time_400(admin):
    r = admin.post(f"{API}/bookings", json=body("round"))
    assert r.status_code == 400
    assert r.json()["detail"] == "حدد وقت التقاط رحلة الإياب"


def test_round_with_return_time_persists(admin, ctx):
    r = admin.post(f"{API}/bookings", json=body("round", return_pickup_time="16:30"))
    assert r.status_code == 200, r.text
    ctx["bookings"].append(r.json()["id"])
    got = next(x for x in admin.get(f"{API}/bookings").json() if x["id"] == r.json()["id"])
    assert got["return_pickup_time"] == "16:30"


def test_go_return_store_null_return_time(admin, ctx):
    for tt in ("go", "return"):
        r = admin.post(f"{API}/bookings", json=body(tt, return_pickup_time="16:30"))
        assert r.status_code == 200, r.text
        ctx["bookings"].append(r.json()["id"])
        assert r.json()["return_pickup_time"] is None


def test_invalid_return_time_422(admin):
    r = admin.post(f"{API}/bookings", json=body("round", return_pickup_time="23:00"))
    assert r.status_code == 422


def test_update_round_to_go_clears_return_time(admin, ctx):
    r = admin.post(f"{API}/bookings", json=body("round", return_pickup_time="15:00"))
    bid = r.json()["id"]
    ctx["bookings"].append(bid)
    r = admin.put(f"{API}/bookings/{bid}", json=body("go", return_pickup_time="15:00"))
    assert r.status_code == 200, r.text
    assert r.json()["return_pickup_time"] is None
    r = admin.put(f"{API}/bookings/{bid}", json=body("round"))
    assert r.status_code == 400


def test_student_round_requires_return_time(student):
    r = requests.post(f"{API}/my/bookings", headers=student["h"], json={"date": DATE, "pickup_time": "07:00", "trip_type": "round"})
    assert r.status_code == 400


def test_trip_leg_time_and_sort(admin, ctx):
    dr = admin.post(f"{API}/accounts", json={"role": "driver", "name": f"TEST_DrvRT{SUF}", "phone": f"078{NUM}", "password": "drv123"})
    assert dr.status_code == 200, dr.text
    ctx["users"].append(dr.json()["id"])
    v = admin.post(f"{API}/vehicles", json={"plate": f"TEST_RT{SUF}", "driver_id": dr.json()["id"], "model": "x"})
    vid = v.json()["id"]
    ctx["vehicles"].append(vid)
    # round A: go 07:00 return 17:00 ; round B: go 08:00 return 14:00 ; return C: 15:00
    specs = [("round", "07:00", "17:00", 1), ("round", "08:00", "14:00", 2), ("return", "15:00", None, 3)]
    ids = []
    for tt, pt, rt, seat in specs:
        r = admin.post(f"{API}/bookings", json=body(tt, pickup_time=pt, return_pickup_time=rt))
        assert r.status_code == 200, r.text
        ids.append(r.json()["id"])
        ctx["bookings"].append(r.json()["id"])
        assert admin.post(f"{API}/dispatch", json={"booking_id": ids[-1], "vehicle_id": vid, "row": 2, "seat": seat}).status_code == 200
    tids = {}
    for d in ("go", "return"):
        r = admin.post(f"{API}/trips", json={"vehicle_id": vid, "date": DATE, "direction": d, "start_time": "07:00"})
        assert r.status_code == 200, r.text
        tids[d] = r.json()["id"]
        ctx["trips"].append(tids[d])
    trips = {t["id"]: t for t in admin.get(f"{API}/trips", params={"date": DATE}).json()}
    go = trips[tids["go"]]["passengers"]
    assert [p["id"] for p in go] == [ids[0], ids[1]]
    assert [p["leg_time"] for p in go] == ["07:00", "08:00"]
    ret = trips[tids["return"]]["passengers"]
    assert [p["id"] for p in ret] == [ids[1], ids[2], ids[0]]
    assert [p["leg_time"] for p in ret] == ["14:00", "15:00", "17:00"]


# --- saved places
def test_my_places_put(student):
    r = requests.put(f"{API}/my/places", headers=student["h"], json={"home_location": HOME2, "home_address": "TEST_h2",
                                                                     "uni_location": UNI2, "uni_address": "TEST_u2"})
    assert r.status_code == 200, r.text
    assert "password_hash" not in r.json()
    u = me(student["h"])
    assert u["home_location"] == HOME2 and u["uni_location"] == UNI2 and u["home_address"] == "TEST_h2"


def test_my_places_admin_forbidden(admin):
    assert admin.put(f"{API}/my/places", json={}).status_code == 403


def test_student_booking_save_places_go(student, ctx):
    r = requests.post(f"{API}/my/bookings", headers=student["h"], json={
        "date": DATE, "pickup_time": "07:00", "trip_type": "go", "location": HOME, "address": "TEST_g_home",
        "dropoff_location": UNI, "dropoff_address": "TEST_g_uni", "save_places": True})
    assert r.status_code == 200, r.text
    ctx["bookings"].append(r.json()["id"])
    assert "save_places" not in r.json()
    u = me(student["h"])
    assert u["home_location"] == HOME and u["home_address"] == "TEST_g_home"
    assert u["uni_location"] == UNI and u["uni_address"] == "TEST_g_uni"


def test_student_booking_save_places_return_mapping(student, ctx):
    r = requests.post(f"{API}/my/bookings", headers=student["h"], json={
        "date": DATE, "pickup_time": "15:00", "trip_type": "return", "location": UNI2, "address": "TEST_r_uni",
        "dropoff_location": HOME2, "dropoff_address": "TEST_r_home", "save_places": True})
    assert r.status_code == 200, r.text
    ctx["bookings"].append(r.json()["id"])
    u = me(student["h"])
    assert u["home_location"] == HOME2 and u["home_address"] == "TEST_r_home"
    assert u["uni_location"] == UNI2 and u["uni_address"] == "TEST_r_uni"


def test_student_booking_unchecked_keeps_places(student, ctx):
    r = requests.post(f"{API}/my/bookings", headers=student["h"], json={
        "date": DATE, "pickup_time": "07:00", "trip_type": "round", "return_pickup_time": "15:00",
        "location": HOME, "address": "z", "dropoff_location": UNI, "dropoff_address": "z", "save_places": False})
    assert r.status_code == 200, r.text
    ctx["bookings"].append(r.json()["id"])
    assert r.json()["return_pickup_time"] == "15:00"
    u = me(student["h"])
    assert u["home_location"] == HOME2 and u["uni_location"] == UNI2


def test_admin_booking_save_places_updates_student(admin, student, ctx):
    r = admin.post(f"{API}/bookings", json=body("round", phone=student["phone"], return_pickup_time="16:00",
                                                 location=HOME, address="TEST_adm_home", dropoff_location=UNI,
                                                 dropoff_address="TEST_adm_uni", save_places=True))
    assert r.status_code == 200, r.text
    ctx["bookings"].append(r.json()["id"])
    assert r.json()["student_id"] == student["id"]
    u = me(student["h"])
    assert u["home_address"] == "TEST_adm_home" and u["uni_location"] == UNI


def test_lookup_admin_and_forbidden(admin, student):
    r = admin.get(f"{API}/accounts/lookup", params={"phone": student["phone"]})
    assert r.status_code == 200
    d = r.json()
    assert d["id"] == student["id"] and d["gender"] == "female" and "password_hash" not in d
    assert d["home_location"] == HOME
    r = admin.get(f"{API}/accounts/lookup", params={"phone": "0700000000999"})
    assert r.status_code == 200 and r.json() is None
    assert requests.get(f"{API}/accounts/lookup", headers=student["h"], params={"phone": student["phone"]}).status_code == 403


def test_account_put_places(admin, student):
    r = admin.put(f"{API}/accounts/{student['id']}", json={"role": "student", "name": f"TEST_StuPl{SUF}", "phone": student["phone"],
                                                         "gender": "female", "university": "جامعة بغداد", "status": "active",
                                                         "home_location": HOME2, "home_address": "TEST_acc_h", "uni_location": None, "uni_address": ""})
    assert r.status_code == 200, r.text
    u = me(student["h"])
    assert u["home_location"] == HOME2 and u["home_address"] == "TEST_acc_h" and u["uni_location"] is None
