# Noexis TMS: pickup/dropoff locations on bookings + trip leg_pickup/leg_dropoff reversal for round trips
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
DATE = "2030-02-20"
SUF = uuid.uuid4().hex[:6]
NUM = str(uuid.uuid4().int)[:7]
P = {"lat": 34.0164, "lng": 44.145}
D = {"lat": 33.3152, "lng": 44.3661}


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


def booking_body(name, trip_type, gender="male", **kw):
    b = {"student_name": f"TEST_{name}", "phone": f"07{uuid.uuid4().int % 10**9:09d}", "gender": gender,
         "university": "جامعة بغداد", "date": DATE, "pickup_time": "07:00", "trip_type": trip_type,
         "location": P, "address": "TEST_pick", "dropoff_location": D, "dropoff_address": "TEST_drop", "notes": "",
         "return_pickup_time": "15:00" if trip_type == "round" else None}
    b.update(kw)
    return b


@pytest.fixture(scope="module")
def setup(admin, ctx):
    dphone = f"078{NUM}"
    r = admin.post(f"{API}/accounts", json={"role": "driver", "name": f"TEST_DrvLeg{SUF}", "phone": dphone, "password": "drv123"})
    assert r.status_code == 200, r.text
    ctx["users"].append(r.json()["id"])
    r = admin.post(f"{API}/vehicles", json={"plate": f"TEST_L{SUF}", "driver_id": r.json()["id"], "model": "Starex"})
    assert r.status_code == 200, r.text
    vid = r.json()["id"]
    ctx["vehicles"].append(vid)
    ids = {}
    for i, tt in enumerate(["go", "return", "round"]):
        r = admin.post(f"{API}/bookings", json=booking_body(f"leg_{tt}", tt))
        assert r.status_code == 200, r.text
        bid = r.json()["id"]
        ctx["bookings"].append(bid)
        ids[tt] = bid
        rr = admin.post(f"{API}/dispatch", json={"booking_id": bid, "vehicle_id": vid, "row": 2, "seat": i + 1})
        assert rr.status_code == 200, rr.text
    trips = {}
    for d in ["go", "return"]:
        r = admin.post(f"{API}/trips", json={"vehicle_id": vid, "date": DATE, "direction": d, "start_time": "07:00"})
        assert r.status_code == 200, r.text
        ctx["trips"].append(r.json()["id"])
        trips[d] = r.json()["id"]
    return {"vid": vid, "ids": ids, "trips": trips, "dphone": dphone}


def test_create_booking_persists_dropoff(admin, ctx):
    r = admin.post(f"{API}/bookings", json=booking_body("persist", "go"))
    assert r.status_code == 200, r.text
    b = r.json()
    ctx["bookings"].append(b["id"])
    assert b["location"] == P and b["dropoff_location"] == D and b["dropoff_address"] == "TEST_drop"
    got = next(x for x in admin.get(f"{API}/bookings").json() if x["id"] == b["id"])
    assert got["dropoff_location"] == D and got["location"] == P


def test_update_booking_dropoff(admin, ctx):
    r = admin.post(f"{API}/bookings", json=booking_body("upd", "return"))
    bid = r.json()["id"]
    ctx["bookings"].append(bid)
    nd = {"lat": 33.5, "lng": 44.2}
    r = admin.put(f"{API}/bookings/{bid}", json=booking_body("upd", "return", dropoff_location=nd, dropoff_address="TEST_new"))
    assert r.status_code == 200, r.text
    assert r.json()["dropoff_location"] == nd and r.json()["dropoff_address"] == "TEST_new"
    assert r.json()["location"] == P


def test_booking_without_dropoff_ok(admin, ctx):
    r = admin.post(f"{API}/bookings", json=booking_body("nodrop", "go", dropoff_location=None, dropoff_address=""))
    assert r.status_code == 200, r.text
    ctx["bookings"].append(r.json()["id"])
    assert r.json()["dropoff_location"] is None


def test_invalid_dropoff_422(admin):
    r = admin.post(f"{API}/bookings", json=booking_body("bad", "go", dropoff_location={"lat": "abc"}))
    assert r.status_code == 422


def trip(admin, tid):
    return next(t for t in admin.get(f"{API}/trips", params={"date": DATE}).json() if t["id"] == tid)


def test_go_trip_legs(admin, setup):
    t = trip(admin, setup["trips"]["go"])
    pmap = {p["id"]: p for p in t["passengers"]}
    assert set(pmap) == {setup["ids"]["go"], setup["ids"]["round"]}
    for k in ("go", "round"):
        p = pmap[setup["ids"][k]]
        assert p["leg_pickup"] == P and p["leg_dropoff"] == D
        assert p["leg_pickup_address"] == "TEST_pick" and p["leg_dropoff_address"] == "TEST_drop"


def test_return_trip_legs_round_reversed(admin, setup):
    t = trip(admin, setup["trips"]["return"])
    pmap = {p["id"]: p for p in t["passengers"]}
    assert set(pmap) == {setup["ids"]["return"], setup["ids"]["round"]}
    ret = pmap[setup["ids"]["return"]]
    assert ret["leg_pickup"] == P and ret["leg_dropoff"] == D
    rnd = pmap[setup["ids"]["round"]]
    assert rnd["leg_pickup"] == D and rnd["leg_dropoff"] == P
    assert rnd["leg_pickup_address"] == "TEST_drop" and rnd["leg_dropoff_address"] == "TEST_pick"


def test_driver_trips_have_legs(setup):
    r = login(setup["dphone"], "drv123")
    assert r.status_code == 200, r.text
    h = {"Authorization": f"Bearer {r.json()['token']}"}
    trips = requests.get(f"{API}/driver/trips", headers=h).json()
    rt = next(t for t in trips if t["id"] == setup["trips"]["return"])
    rnd = next(p for p in rt["passengers"] if p["id"] == setup["ids"]["round"])
    assert rnd["leg_pickup"] == D and rnd["leg_dropoff"] == P


def test_student_booking_dropoff(admin, ctx):
    sphone = f"077{NUM}"
    r = admin.post(f"{API}/accounts", json={"role": "student", "name": f"TEST_StuLeg{SUF}", "phone": sphone, "password": "stu123",
                                           "gender": "female", "university": "جامعة بغداد", "status": "active"})
    assert r.status_code == 200, r.text
    ctx["users"].append(r.json()["id"])
    tok = login(sphone, "stu123").json()["token"]
    h = {"Authorization": f"Bearer {tok}"}
    r = requests.post(f"{API}/my/bookings", headers=h, json={"date": DATE, "pickup_time": "08:00", "trip_type": "round",
                                                            "location": P, "address": "a", "dropoff_location": D, "dropoff_address": "TEST_uni",
                                                            "return_pickup_time": "15:00"})
    assert r.status_code == 200, r.text
    ctx["bookings"].append(r.json()["id"])
    mine = requests.get(f"{API}/my/bookings", headers=h).json()
    b = next(x for x in mine if x["id"] == r.json()["id"])
    assert b["dropoff_location"] == D and b["dropoff_address"] == "TEST_uni" and b["location"] == P
