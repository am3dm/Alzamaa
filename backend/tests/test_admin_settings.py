# Noexis TMS - Default admin account + PUT /api/auth/me (admin settings) tests. Restores admin at teardown.
import os
import uuid
import pytest
import requests
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN_PHONE, ADMIN_PW = "1234567890", "admin123"
ADMIN_NAME, ADMIN_EMAIL = "مدير النظام", "altayyd889@gmail.com"
NEW_PHONE = f"09{uuid.uuid4().int % 10**8:08d}"
NEW_PW = "TEST_newpass1"


def num():
    return f"07{uuid.uuid4().int % 10**9:09d}"


def login(phone, pw):
    return requests.post(f"{API}/auth/login", json={"phone": phone, "password": pw})


def sess(token):
    s = requests.Session()
    s.headers["Authorization"] = f"Bearer {token}"
    return s


def mdb():
    return MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


@pytest.fixture(scope="class")
def state():
    db = mdb()
    db.login_attempts.delete_many({"identifier": {"$in": [f"phone:{ADMIN_PHONE}", f"phone:{NEW_PHONE}"]}})
    r = login(ADMIN_PHONE, ADMIN_PW)
    assert r.status_code == 200, r.text
    st = {"token": r.json()["token"], "user": r.json()["user"], "created": []}
    yield st
    # restore admin
    a = sess(st["token"])
    for pw in (NEW_PW, ADMIN_PW):
        rr = a.put(f"{API}/auth/me", json={"name": ADMIN_NAME, "phone": ADMIN_PHONE, "email": ADMIN_EMAIL,
                                            "current_password": pw, "new_password": ADMIN_PW})
        if rr.status_code == 200:
            break
    db.users.update_one({"role": "admin"}, {"$set": {"default_password": True}})
    for uid in st["created"]:
        a.delete(f"{API}/accounts/{uid}")
    db.login_attempts.delete_many({"identifier": {"$in": [f"phone:{ADMIN_PHONE}", f"phone:{NEW_PHONE}"]}})


class TestAdminSettings:
    def test_me_default_password(self, state):
        r = sess(state["token"]).get(f"{API}/auth/me")
        assert r.status_code == 200
        d = r.json()
        assert d["role"] == "admin" and d["default_password"] is True
        assert "password_hash" not in d and "_id" not in d

    def test_bcrypt_hash_format(self, state):
        a = mdb().users.find_one({"role": "admin"})
        assert a["password_hash"].startswith("$2b$")
        assert mdb().users.count_documents({"role": "admin"}) == 1

    def test_wrong_current_password(self, state):
        r = sess(state["token"]).put(f"{API}/auth/me", json={"name": ADMIN_NAME, "phone": ADMIN_PHONE,
                                     "email": ADMIN_EMAIL, "current_password": "wrongpw"})
        assert r.status_code == 400 and "الحالية" in r.json()["detail"]

    def test_short_new_password(self, state):
        r = sess(state["token"]).put(f"{API}/auth/me", json={"name": ADMIN_NAME, "phone": ADMIN_PHONE,
                                     "email": ADMIN_EMAIL, "current_password": ADMIN_PW, "new_password": "123"})
        assert r.status_code == 400
        assert mdb().users.find_one({"role": "admin"})["default_password"] is True

    def test_non_admin_forbidden(self, state):
        a = sess(state["token"])
        out = {}
        for role in ("student", "driver"):
            phone = num()
            body = {"name": f"TEST_{role}", "phone": phone, "password": "pass123", "role": role}
            if role == "student":
                body.update({"gender": "male", "university": "جامعة بغداد"})
            c = a.post(f"{API}/accounts", json=body)
            assert c.status_code == 200, c.text
            state["created"].append(c.json()["id"])
            t = login(phone, "pass123").json()["token"]
            r = sess(t).put(f"{API}/auth/me", json={"name": "X hacked", "phone": phone, "current_password": "pass123"})
            out[role] = r.status_code
            state.setdefault("other_phone", phone)
        assert out == {"student": 403, "driver": 403}

    def test_phone_conflict(self, state):
        r = sess(state["token"]).put(f"{API}/auth/me", json={"name": ADMIN_NAME, "phone": state["other_phone"],
                                     "email": ADMIN_EMAIL, "current_password": ADMIN_PW})
        assert r.status_code == 400 and "مستخدم" in r.json()["detail"]

    def test_change_name_password(self, state):
        r = sess(state["token"]).put(f"{API}/auth/me", json={"name": "TEST_Admin", "phone": ADMIN_PHONE,
                                     "email": ADMIN_EMAIL, "current_password": ADMIN_PW, "new_password": NEW_PW})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["name"] == "TEST_Admin" and d["default_password"] is False
        me = sess(state["token"]).get(f"{API}/auth/me").json()
        assert me["name"] == "TEST_Admin" and me["default_password"] is False
        assert login(ADMIN_PHONE, ADMIN_PW).status_code == 401
        assert login(ADMIN_PHONE, NEW_PW).status_code == 200

    def test_change_phone(self, state):
        r = sess(state["token"]).put(f"{API}/auth/me", json={"name": "TEST_Admin", "phone": NEW_PHONE,
                                     "email": ADMIN_EMAIL, "current_password": NEW_PW})
        assert r.status_code == 200 and r.json()["phone"] == NEW_PHONE
        assert login(NEW_PHONE, NEW_PW).status_code == 200
        assert login(ADMIN_PHONE, NEW_PW).status_code == 401
        # restore phone and password back for remaining suites
        r = sess(state["token"]).put(f"{API}/auth/me", json={"name": ADMIN_NAME, "phone": ADMIN_PHONE,
                                     "email": ADMIN_EMAIL, "current_password": NEW_PW, "new_password": ADMIN_PW})
        assert r.status_code == 200
        assert login(ADMIN_PHONE, ADMIN_PW).status_code == 200
