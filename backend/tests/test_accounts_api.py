# Noexis TMS - Admin account management (/api/accounts) tests: create/edit/status/delete, driver-vehicle sync, register requests, RBAC
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
SUF = uuid.uuid4().hex[:6]


def num():
    return f"07{uuid.uuid4().int % 10**9:09d}"


def login(phone, pw):
    return requests.post(f"{API}/auth/login", json={"phone": phone, "password": pw})


def sess(token):
    s = requests.Session()
    s.headers["Authorization"] = f"Bearer {token}"
    return s


@pytest.fixture(scope="module")
def admin():
    r = login("1234567890", "admin123")
    assert r.status_code == 200, r.text
    return sess(r.json()["token"])


@pytest.fixture(scope="module")
def ctx(admin):
    c = {"users": [], "vehicles": [], "trips": []}
    yield c
    for t in c["trips"]:
        admin.delete(f"{API}/trips/{t}")
    for v in c["vehicles"]:
        admin.delete(f"{API}/vehicles/{v}")
    for u in c["users"]:
        admin.delete(f"{API}/accounts/{u}")


def create(admin, ctx, **kw):
    r = admin.post(f"{API}/accounts", json=kw)
    if r.status_code == 200:
        ctx["users"].append(r.json()["id"])
    return r


# Student account creation + login
def test_create_student_and_login(admin, ctx):
    phone = num()
    r = create(admin, ctx, role="student", name=f"TEST_Stu{SUF}", phone=phone, password="stu1234",
               gender="male", university="جامعة بغداد")
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["role"] == "student" and d["status"] == "active" and "password_hash" not in d and "_id" not in d
    lst = admin.get(f"{API}/accounts", params={"role": "student", "status": "active"}).json()
    assert any(a["id"] == d["id"] for a in lst)
    lr = login(phone, "stu1234")
    assert lr.status_code == 200 and lr.json()["user"]["role"] == "student"
    assert sess(lr.json()["token"]).get(f"{API}/my/bookings").status_code == 200
    ctx["stu"] = {"id": d["id"], "phone": phone}


def test_student_requires_gender_university(admin, ctx):
    r = create(admin, ctx, role="student", name="TEST_NoG", phone=num(), password="abcd")
    assert r.status_code == 400


def test_create_requires_password(admin, ctx):
    r = create(admin, ctx, role="driver", name="TEST_NoPw", phone=num())
    assert r.status_code == 400


def test_duplicate_phone_rejected(admin, ctx):
    r = create(admin, ctx, role="driver", name="TEST_Dup", phone=ctx["stu"]["phone"], password="abcd")
    assert r.status_code == 400
    # admin phone also
    r = create(admin, ctx, role="driver", name="TEST_Dup", phone="1234567890", password="abcd")
    assert r.status_code == 400


# Driver account
def test_create_driver_and_login(admin, ctx):
    phone = num()
    r = create(admin, ctx, role="driver", name=f"TEST_Drv{SUF}", phone=phone, password="drv1234")
    assert r.status_code == 200, r.text
    did = r.json()["id"]
    drivers = admin.get(f"{API}/accounts", params={"role": "driver"}).json()
    me = next(a for a in drivers if a["id"] == did)
    assert me["vehicles"] == []
    lr = login(phone, "drv1234")
    assert lr.status_code == 200 and lr.json()["user"]["role"] == "driver"
    assert sess(lr.json()["token"]).get(f"{API}/driver/trips").json() == []
    ctx["drv"] = {"id": did, "phone": phone, "pw": "drv1234"}


# Edit: password empty keeps old; new password works
def test_edit_student_keep_and_change_password(admin, ctx):
    s = ctx["stu"]
    new_phone = num()
    body = {"role": "student", "name": f"TEST_StuEd{SUF}", "phone": new_phone, "password": None,
            "gender": "male", "university": "جامعة بغداد", "status": "active"}
    r = admin.put(f"{API}/accounts/{s['id']}", json=body)
    assert r.status_code == 200, r.text
    assert r.json()["name"] == f"TEST_StuEd{SUF}" and r.json()["phone"] == new_phone
    assert login(new_phone, "stu1234").status_code == 200
    assert login(s["phone"], "stu1234").status_code == 401
    body["password"] = "newpw99"
    assert admin.put(f"{API}/accounts/{s['id']}", json=body).status_code == 200
    assert login(new_phone, "newpw99").status_code == 200
    assert login(new_phone, "stu1234").status_code == 401
    s["phone"], s["pw"] = new_phone, "newpw99"


def test_edit_cannot_change_role(admin, ctx):
    s = ctx["stu"]
    r = admin.put(f"{API}/accounts/{s['id']}", json={"role": "driver", "name": "TEST_x", "phone": s["phone"]})
    assert r.status_code == 400


def test_edit_to_existing_phone_rejected(admin, ctx):
    r = admin.put(f"{API}/accounts/{ctx['drv']['id']}", json={"role": "driver", "name": "TEST_x", "phone": ctx["stu"]["phone"]})
    assert r.status_code == 400


# Status rejected blocks login + invalidates existing token; reactivate
def test_status_reject_and_reactivate(admin, ctx):
    s = ctx["stu"]
    tok = login(s["phone"], s["pw"]).json()["token"]
    base = {"role": "student", "name": f"TEST_StuEd{SUF}", "phone": s["phone"], "gender": "male", "university": "جامعة بغداد"}
    assert admin.put(f"{API}/accounts/{s['id']}", json={**base, "status": "rejected"}).status_code == 200
    assert login(s["phone"], s["pw"]).status_code == 403
    assert sess(tok).get(f"{API}/auth/me").status_code == 401
    rej = admin.get(f"{API}/accounts", params={"status": "rejected"}).json()
    assert any(a["id"] == s["id"] for a in rej)
    assert admin.put(f"{API}/accounts/{s['id']}", json={**base, "status": "active"}).status_code == 200
    assert login(s["phone"], s["pw"]).status_code == 200


# Public register -> pending request -> approve / reject
def test_register_request_approve_reject(admin, ctx):
    p1, p2 = num(), num()
    for p in (p1, p2):
        r = requests.post(f"{API}/auth/register", json={"name": "TEST_Req", "phone": p, "password": "req1234",
                                                         "gender": "female", "university": "جامعة بغداد"})
        assert r.status_code == 200
    pend = admin.get(f"{API}/accounts", params={"role": "student", "status": "pending"}).json()
    ids = {a["phone"]: a for a in pend}
    assert p1 in ids and p2 in ids
    for p in (p1, p2):
        ctx["users"].append(ids[p]["id"])
    a1, a2 = ids[p1], ids[p2]
    assert admin.put(f"{API}/accounts/{a1['id']}", json={**a1, "password": None, "status": "active"}).status_code == 200
    assert login(p1, "req1234").status_code == 200
    assert admin.put(f"{API}/accounts/{a2['id']}", json={**a2, "password": None, "status": "rejected"}).status_code == 200
    assert login(p2, "req1234").status_code == 403


# Vehicle linked to driver account; driver edit syncs to vehicle; driver sees trips; delete linked driver blocked
def test_vehicle_driver_link_sync_and_delete_guard(admin, ctx):
    d = ctx["drv"]
    r = admin.post(f"{API}/vehicles", json={"plate": f"TEST_V{SUF}", "driver_id": d["id"], "model": "Starex"})
    assert r.status_code == 200, r.text
    vid = r.json()["id"]
    ctx["vehicles"].append(vid)
    me = next(a for a in admin.get(f"{API}/accounts", params={"role": "driver"}).json() if a["id"] == d["id"])
    assert me["vehicles"] == [f"TEST_V{SUF}"]
    t = admin.post(f"{API}/trips", json={"vehicle_id": vid, "date": "2030-03-03", "direction": "go", "start_time": "07:00"})
    assert t.status_code == 200
    ctx["trips"].append(t.json()["id"])
    new_phone = num()
    r = admin.put(f"{API}/accounts/{d['id']}", json={"role": "driver", "name": f"TEST_DrvEd{SUF}", "phone": new_phone, "status": "active"})
    assert r.status_code == 200
    v = next(x for x in admin.get(f"{API}/vehicles").json() if x["id"] == vid)
    assert v["driver_name"] == f"TEST_DrvEd{SUF}" and v["driver_phone"] == new_phone
    lr = login(new_phone, d["pw"])
    assert lr.status_code == 200
    trips = sess(lr.json()["token"]).get(f"{API}/driver/trips").json()
    assert any(x["id"] == t.json()["id"] for x in trips)
    assert admin.delete(f"{API}/accounts/{d['id']}").status_code == 400
    d["phone"] = new_phone


# Delete account
def test_delete_account(admin, ctx):
    r = create(admin, ctx, role="driver", name="TEST_Del", phone=num(), password="abcd")
    uid = r.json()["id"]
    assert admin.delete(f"{API}/accounts/{uid}").status_code == 200
    assert all(a["id"] != uid for a in admin.get(f"{API}/accounts").json())
    assert admin.delete(f"{API}/accounts/{uid}").status_code == 404
    ctx["users"].remove(uid)


def test_cannot_touch_admin_via_accounts(admin):
    me = admin.get(f"{API}/auth/me").json()
    assert admin.delete(f"{API}/accounts/{me['id']}").status_code == 404
    assert all(a["role"] != "admin" for a in admin.get(f"{API}/accounts").json())


# RBAC
def test_non_admin_forbidden(ctx):
    s = ctx["stu"]
    st = sess(login(s["phone"], s["pw"]).json()["token"])
    assert st.get(f"{API}/accounts").status_code == 403
    assert st.post(f"{API}/accounts", json={"role": "driver", "name": "TEST_h", "phone": num(), "password": "abcd"}).status_code == 403
    dv = sess(login(ctx["drv"]["phone"], ctx["drv"]["pw"]).json()["token"])
    assert dv.get(f"{API}/accounts").status_code == 403
    assert requests.get(f"{API}/accounts").status_code == 401
