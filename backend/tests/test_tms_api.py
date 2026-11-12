# Noexis TMS backend regression tests: auth, vehicles, bookings, dispatch (gender lock), trips, driver, student, roles, stats
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
DATE = "2030-01-15"
SUF = uuid.uuid4().hex[:6]
NUM = str(uuid.uuid4().int)[:7]


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


def mk_driver(admin, ctx, name, phone, pw="drv123"):
    r = admin.post(f"{API}/accounts", json={"role": "driver", "name": name, "phone": phone, "password": pw})
    assert r.status_code == 200, r.text
    ctx["users"].append(r.json()["id"])
    return r.json()["id"]


def mk_booking(admin, ctx, name, gender, trip_type="go", phone=None, date=DATE):
    r = admin.post(f"{API}/bookings", json={
        "student_name": f"TEST_{name}", "phone": phone or f"07{uuid.uuid4().int % 10**9:09d}", "gender": gender,
        "university": "جامعة بغداد", "date": date, "pickup_time": "07:00", "trip_type": trip_type,
        "location": {"lat": 33.7, "lng": 44.25}, "address": "x", "notes": ""})
    assert r.status_code == 200, r.text
    ctx["bookings"].append(r.json()["id"])
    return r.json()


# --- Auth
def test_admin_login_and_me(admin):
    r = admin.get(f"{API}/auth/me")
    assert r.status_code == 200 and r.json()["role"] == "admin"
    assert "password_hash" not in r.json() and "_id" not in r.json()


def test_bad_login_401():
    r = login("1234567890", "wrong_" + SUF)
    assert r.status_code == 401


def test_unauth_401():
    assert requests.get(f"{API}/vehicles").status_code == 401


# --- Vehicles
def test_vehicle_crud_and_driver(admin, ctx):
    dphone = f"079{NUM}"
    did = mk_driver(admin, ctx, "TEST_Driver", dphone)
    ctx["did"] = did
    r = admin.post(f"{API}/vehicles", json={"plate": f"TEST_P{SUF}", "driver_id": did, "model": "Starex"})
    assert r.status_code == 200, r.text
    vid = r.json()["id"]
    ctx["vehicles"].append(vid)
    ctx["vid"], ctx["dphone"] = vid, dphone
    # duplicate plate
    assert admin.post(f"{API}/vehicles", json={"plate": f"TEST_P{SUF}", "driver_id": did}).status_code == 400
    # invalid driver id
    assert admin.post(f"{API}/vehicles", json={"plate": f"TEST_Z{SUF}", "driver_id": "000000000000000000000000"}).status_code == 400
    # edit
    r = admin.put(f"{API}/vehicles/{vid}", json={"plate": f"TEST_P{SUF}", "driver_id": did, "model": "H1"})
    assert r.status_code == 200 and r.json()["model"] == "H1"
    lst = admin.get(f"{API}/vehicles").json()
    v = next(x for x in lst if x["id"] == vid)
    assert v["capacity"] == 7 and v["driver_name"] == "TEST_Driver" and v["driver_phone"] == dphone and v["driver_id"] == did
    # driver login still works with old password
    assert login(dphone, "drv123").status_code == 200


def test_vehicle_edit_to_duplicate_plate(admin, ctx):
    d2 = mk_driver(admin, ctx, "TEST_D2", f"078{NUM}")
    r = admin.post(f"{API}/vehicles", json={"plate": f"TEST_Q{SUF}", "driver_id": d2})
    assert r.status_code == 200
    v2 = r.json()["id"]
    ctx["vehicles"].append(v2)
    ctx["vid2"] = v2
    r = admin.put(f"{API}/vehicles/{v2}", json={"plate": f"TEST_P{SUF}", "driver_id": d2})
    assert r.status_code == 400, f"expected 400 got {r.status_code}"


# --- Dispatch + gender lock
def test_dispatch_gender_lock_and_conflicts(admin, ctx):
    vid = ctx["vid"]
    m = mk_booking(admin, ctx, "Male", "male")
    f = mk_booking(admin, ctx, "Female", "female")
    m2 = mk_booking(admin, ctx, "Male2", "male")
    r = admin.post(f"{API}/dispatch", json={"booking_id": m["id"], "vehicle_id": vid, "row": 1, "seat": 1})
    assert r.status_code == 200 and r.json()["status"] == "confirmed"
    seats = admin.get(f"{API}/dispatch/seats", params={"vehicle_id": vid, "booking_id": f["id"]}).json()
    assert seats["rows"][0]["gender"] == "male"
    r = admin.post(f"{API}/dispatch", json={"booking_id": f["id"], "vehicle_id": vid, "row": 1, "seat": 2})
    assert r.status_code == 400  # row 1 has only 1 seat in 7-seat layout
    r = admin.post(f"{API}/dispatch", json={"booking_id": m2["id"], "vehicle_id": vid, "row": 1, "seat": 1})
    assert r.status_code == 400  # occupied
    assert admin.post(f"{API}/dispatch", json={"booking_id": m2["id"], "vehicle_id": vid, "row": 1, "seat": 3}).status_code == 400
    assert admin.post(f"{API}/dispatch", json={"booking_id": f["id"], "vehicle_id": vid, "row": 2, "seat": 1}).status_code == 200
    # gender lock row 2 (female) -> male refused
    r = admin.post(f"{API}/dispatch", json={"booking_id": m2["id"], "vehicle_id": vid, "row": 2, "seat": 3})
    assert r.status_code == 400 and "قفل" in r.json()["detail"]
    for bad in ((2, 4), (3, 4), (4, 1), (0, 1), (2, 0)):
        assert admin.post(f"{API}/dispatch", json={"booking_id": m2["id"], "vehicle_id": vid, "row": bad[0], "seat": bad[1]}).status_code == 400
    ctx["m"], ctx["f"], ctx["m2"] = m, f, m2


def test_seat_layout_numbers(admin, ctx):
    rows = admin.get(f"{API}/dispatch/seats", params={"vehicle_id": ctx["vid"], "date": DATE, "direction": "go"}).json()["rows"]
    assert [len(r["seats"]) for r in rows] == [1, 3, 3]
    assert [[s["number"] for s in r["seats"]] for r in rows] == [[1], [2, 3, 4], [5, 6, 7]]
    assert rows[0]["seats"][0]["occupant"]["id"] == ctx["m"]["id"]
    assert rows[1]["seats"][0]["occupant"]["id"] == ctx["f"]["id"] and rows[1]["gender"] == "female"


def test_round_trip_occupies_both(admin, ctx):
    vid = ctx["vid"]
    rb = mk_booking(admin, ctx, "Round", "male", "round")
    assert admin.post(f"{API}/dispatch", json={"booking_id": rb["id"], "vehicle_id": vid, "row": 3, "seat": 1}).status_code == 200
    for d in ("go", "return"):
        rows = admin.get(f"{API}/dispatch/seats", params={"vehicle_id": vid, "date": DATE, "direction": d}).json()["rows"]
        assert rows[2]["seats"][0]["occupant"]["id"] == rb["id"]
    ret = mk_booking(admin, ctx, "RetF", "female", "return")
    assert admin.post(f"{API}/dispatch", json={"booking_id": ret["id"], "vehicle_id": vid, "row": 3, "seat": 1}).status_code == 400
    assert admin.post(f"{API}/dispatch", json={"booking_id": ret["id"], "vehicle_id": vid, "row": 3, "seat": 2}).status_code == 400
    ctx["rb"] = rb


def test_unassign(admin, ctx):
    m2 = ctx["m2"]
    assert admin.post(f"{API}/dispatch", json={"booking_id": m2["id"], "vehicle_id": ctx["vid"], "row": 3, "seat": 3}).status_code == 200
    assert admin.post(f"{API}/dispatch/{m2['id']}/unassign").status_code == 200
    b = next(x for x in admin.get(f"{API}/bookings", params={"date": DATE}).json() if x["id"] == m2["id"])
    assert b["status"] == "pending" and b["vehicle_id"] is None


# --- Trips
def test_trips_lifecycle(admin, ctx):
    vid = ctx["vid"]
    r = admin.post(f"{API}/trips", json={"vehicle_id": vid, "date": DATE, "direction": "go", "start_time": "07:00"})
    assert r.status_code == 200, r.text
    go = r.json()
    ctx["trips"].append(go["id"])
    assert go["occupancy"] == 3  # male, female, round
    assert admin.post(f"{API}/trips", json={"vehicle_id": vid, "date": DATE, "direction": "go", "start_time": "08:00"}).status_code == 400
    r = admin.post(f"{API}/trips", json={"vehicle_id": vid, "date": DATE, "direction": "return", "start_time": "15:00"})
    ret = r.json()
    ctx["trips"].append(ret["id"])
    assert ret["occupancy"] == 1
    assert admin.patch(f"{API}/trips/{go['id']}/status", json={"status": "in_progress"}).status_code == 200
    assert admin.patch(f"{API}/trips/{go['id']}/status", json={"status": "completed"}).status_code == 200
    bk = {x["id"]: x for x in admin.get(f"{API}/bookings", params={"date": DATE}).json()}
    assert bk[ctx["m"]["id"]]["status"] == "completed"
    assert bk[ctx["rb"]["id"]]["status"] == "confirmed"  # round waits for return
    ctx["ret_trip"] = ret["id"]


# --- Driver
def test_driver_portal(admin, ctx):
    r = login(ctx["dphone"], "drv123")
    assert r.status_code == 200 and r.json()["user"]["role"] == "driver"
    d = requests.Session()
    d.headers["Authorization"] = f"Bearer {r.json()['token']}"
    trips = d.get(f"{API}/driver/trips").json()
    ids = [t["id"] for t in trips]
    assert ctx["ret_trip"] in ids
    assert d.get(f"{API}/vehicles").status_code == 403
    assert d.get(f"{API}/stats").status_code == 403
    assert d.patch(f"{API}/driver/trips/{ctx['ret_trip']}/status", json={"status": "in_progress"}).status_code == 200
    assert d.patch(f"{API}/driver/trips/{ctx['ret_trip']}/status", json={"status": "completed"}).status_code == 200
    bk = {x["id"]: x for x in admin.get(f"{API}/bookings", params={"date": DATE}).json()}
    assert bk[ctx["rb"]["id"]]["status"] == "completed"


# --- Student flow
def test_student_flow(admin, ctx):
    phone = f"077{NUM}"
    r = requests.post(f"{API}/auth/register", json={"name": "TEST_Student", "phone": phone, "password": "stu123",
                                                     "gender": "female", "university": "جامعة بغداد"})
    assert r.status_code == 200
    assert requests.post(f"{API}/auth/register", json={"name": "TEST_Student", "phone": phone, "password": "stu123",
                                                        "gender": "female", "university": "x"}).status_code == 400
    assert login(phone, "stu123").status_code == 403
    st = next(s for s in admin.get(f"{API}/students", params={"status": "pending"}).json() if s["phone"] == phone)
    ctx["student_id"] = st["id"]
    ctx["users"].append(st["id"])
    assert admin.patch(f"{API}/students/{st['id']}/status", json={"status": "active"}).status_code == 200
    r = login(phone, "stu123")
    assert r.status_code == 200
    s = requests.Session()
    s.headers["Authorization"] = f"Bearer {r.json()['token']}"
    assert s.get(f"{API}/bookings").status_code == 403
    assert s.post(f"{API}/dispatch", json={"booking_id": "x", "vehicle_id": "y", "row": 1, "seat": 1}).status_code == 403
    r = s.post(f"{API}/my/bookings", json={"date": DATE, "pickup_time": "08:00", "trip_type": "go",
                                           "location": {"lat": 33.3, "lng": 44.4}})
    assert r.status_code == 200 and r.json()["gender"] == "female" and r.json()["status"] == "pending"
    bid = r.json()["id"]
    ctx["bookings"].append(bid)
    assert admin.post(f"{API}/dispatch", json={"booking_id": bid, "vehicle_id": ctx["vid2"], "row": 2, "seat": 1}).status_code == 200
    mine = s.get(f"{API}/my/bookings").json()
    b = next(x for x in mine if x["id"] == bid)
    assert b["vehicle"]["id"] == ctx["vid2"] and b["seat"] == {"row": 2, "seat": 1}
    # seat_rows: own seat flagged, other occupants anonymised
    other = mk_booking(admin, ctx, "OtherF", "female")
    assert admin.post(f"{API}/dispatch", json={"booking_id": other["id"], "vehicle_id": ctx["vid2"], "row": 3, "seat": 3}).status_code == 200
    b = next(x for x in s.get(f"{API}/my/bookings").json() if x["id"] == bid)
    sr = b["seat_rows"]
    assert [[x["number"] for x in r["seats"]] for r in sr] == [[1], [2, 3, 4], [5, 6, 7]]
    flat = {x["number"]: x for r in sr for x in r["seats"]}
    assert flat[2]["mine"] is True and flat[2]["taken"] is False
    assert flat[7]["taken"] is True and flat[7]["mine"] is False
    raw = str(sr)
    assert "TEST_OtherF" not in raw and other["id"] not in raw and "occupant" not in raw
    assert all("gender" not in r for r in sr)
    assert s.post(f"{API}/my/bookings/{bid}/cancel").status_code == 200
    b = next(x for x in s.get(f"{API}/my/bookings").json() if x["id"] == bid)
    assert b["status"] == "cancelled" and b["vehicle_id"] is None


# --- Stats
def test_stats(admin):
    r = admin.get(f"{API}/stats")
    assert r.status_code == 200
    d = r.json()
    for k in ("vehicles", "capacity", "bookings_total", "trips_total", "occupancy_rate", "students_pending"):
        assert k in d
    assert d["capacity"] == d["vehicles"] * 7
