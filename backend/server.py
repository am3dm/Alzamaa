from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).parent / ".env")

import os
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Literal

import bcrypt
import jwt
from bson import ObjectId
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from starlette.middleware.cors import CORSMiddleware

client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALG = "HS256"

app = FastAPI()
api = APIRouter(prefix="/api")
bearer = HTTPBearer(auto_error=False)
logger = logging.getLogger("tms")

ROWS = {1: 1, 2: 3, 3: 3}
CAPACITY = sum(ROWS.values())
ROW_OFFSET = {1: 0, 2: 1, 3: 4}


def seat_number(row: int, seat: int) -> int:
    return ROW_OFFSET[row] + seat
DIRECTIONS = {"go": ["go"], "return": ["return"], "round": ["go", "return"]}
DEFAULT_UNIS = ["جامعة بغداد", "الجامعة التكنولوجية", "جامعة النهرين", "الجامعة الستينية", "جامعة الكرخ"]


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def ser(doc):
    if not doc:
        return doc
    doc = dict(doc)
    doc["id"] = str(doc.pop("_id"))
    doc.pop("password_hash", None)
    return doc


def oid(v: str):
    if not ObjectId.is_valid(v):
        raise HTTPException(404, "غير موجود")
    return ObjectId(v)


def hash_pw(p: str) -> str:
    return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()


def check_pw(p: str, h: str) -> bool:
    return bcrypt.checkpw(p.encode(), h.encode())


def make_token(uid: str, role: str) -> str:
    payload = {"sub": uid, "role": role, "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "access"}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


async def current_user(cred: HTTPAuthorizationCredentials = Depends(bearer)):
    if not cred:
        raise HTTPException(401, "غير مسجل الدخول")
    try:
        payload = jwt.decode(cred.credentials, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.InvalidTokenError:
        raise HTTPException(401, "جلسة غير صالحة")
    user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
    if not user or user.get("status") != "active":
        raise HTTPException(401, "الحساب غير مفعل")
    return ser(user)


def role(*roles):
    async def dep(user=Depends(current_user)):
        if user["role"] not in roles:
            raise HTTPException(403, "غير مصرح")
        return user
    return dep


admin_only = role("admin")

# ---------- Models ----------


class Location(BaseModel):
    lat: float
    lng: float


class LoginIn(BaseModel):
    phone: str
    password: str


class RegisterIn(BaseModel):
    name: str = Field(min_length=2)
    phone: str = Field(min_length=6)
    password: str = Field(min_length=6)
    gender: Literal["male", "female"]
    university: str
    notes: Optional[str] = ""


class VehicleIn(BaseModel):
    plate: str = Field(min_length=1)
    driver_id: str
    model: Optional[str] = ""


class UniversityIn(BaseModel):
    name: str = Field(min_length=2)


DATE_RE = r"^\d{4}-\d{2}-\d{2}$"
TIME_RE = r"^(0[6-9]|1[0-8]):[0-5]\d$|^19:00$"


class BookingIn(BaseModel):
    student_name: str = Field(min_length=2)
    phone: str = Field(min_length=6)
    gender: Literal["male", "female"]
    university: str = Field(min_length=2)
    date: str = Field(pattern=DATE_RE)
    pickup_time: str = Field(pattern=TIME_RE)
    trip_type: Literal["go", "return", "round"]
    location: Optional[Location] = None
    address: Optional[str] = ""
    notes: Optional[str] = ""


class StudentBookingIn(BaseModel):
    date: str = Field(pattern=DATE_RE)
    pickup_time: str = Field(pattern=TIME_RE)
    trip_type: Literal["go", "return", "round"]
    location: Optional[Location] = None
    address: Optional[str] = ""
    notes: Optional[str] = ""


class BookingStatusIn(BaseModel):
    status: Literal["pending", "confirmed", "completed", "cancelled"]


class DispatchIn(BaseModel):
    booking_id: str
    vehicle_id: str
    row: int
    seat: int


class TripIn(BaseModel):
    vehicle_id: str
    date: str = Field(pattern=DATE_RE)
    direction: Literal["go", "return"]
    start_time: str


class TripStatusIn(BaseModel):
    status: Literal["pending", "in_progress", "completed"]


class StudentStatusIn(BaseModel):
    status: Literal["active", "rejected", "pending"]


class ProfileIn(BaseModel):
    name: str = Field(min_length=2)
    phone: str = Field(min_length=6)
    email: Optional[str] = ""
    current_password: str
    new_password: Optional[str] = None


class AccountIn(BaseModel):
    name: str = Field(min_length=2)
    phone: str = Field(min_length=6)
    password: Optional[str] = None
    role: Literal["driver", "student"]
    gender: Optional[Literal["male", "female"]] = None
    university: Optional[str] = ""
    notes: Optional[str] = ""
    status: Literal["active", "pending", "rejected"] = "active"


# ---------- Auth ----------


@api.post("/auth/login")
async def login(body: LoginIn, request: Request):
    phone = body.phone.strip()
    ident = f"phone:{phone}"
    att = await db.login_attempts.find_one({"identifier": ident})
    if att and att.get("until", "") <= now_iso():
        await db.login_attempts.delete_one({"identifier": ident})
        att = None
    if att and att.get("count", 0) >= 5:
        raise HTTPException(429, "محاولات كثيرة، حاول بعد 15 دقيقة")
    user = await db.users.find_one({"phone": phone})
    if not user or not check_pw(body.password, user["password_hash"]):
        count = (att or {}).get("count", 0) + 1
        until = att["until"] if att else (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()
        await db.login_attempts.update_one({"identifier": ident}, {"$set": {"count": count, "until": until}}, upsert=True)
        raise HTTPException(401, "رقم الهاتف أو كلمة المرور غير صحيحة")
    await db.login_attempts.delete_one({"identifier": ident})
    if user.get("status") == "pending":
        raise HTTPException(403, "حسابك قيد المراجعة من قبل الإدارة")
    if user.get("status") == "rejected":
        raise HTTPException(403, "تم رفض طلب الحساب، تواصل مع الإدارة")
    u = ser(user)
    return {"token": make_token(u["id"], u["role"]), "user": u}


@api.get("/auth/me")
async def me(user=Depends(current_user)):
    return user


@api.put("/auth/me")
async def update_me(body: ProfileIn, user=Depends(admin_only)):
    doc = await db.users.find_one({"_id": ObjectId(user["id"])})
    if not check_pw(body.current_password, doc["password_hash"]):
        raise HTTPException(400, "كلمة المرور الحالية غير صحيحة")
    phone = body.phone.strip()
    if await db.users.find_one({"phone": phone, "_id": {"$ne": doc["_id"]}}):
        raise HTTPException(400, "رقم الهاتف مستخدم لحساب آخر")
    upd = {"name": body.name.strip(), "phone": phone, "email": (body.email or "").strip()}
    if body.new_password:
        if len(body.new_password) < 6:
            raise HTTPException(400, "كلمة المرور الجديدة قصيرة (6 أحرف على الأقل)")
        upd.update({"password_hash": hash_pw(body.new_password),
                    "default_password": body.new_password == os.environ["ADMIN_PASSWORD"]})
    if upd["email"] and "@" not in upd["email"]:
        raise HTTPException(400, "البريد الإلكتروني غير صالح")
    await db.users.update_one({"_id": doc["_id"]}, {"$set": upd})
    return ser(await db.users.find_one({"_id": doc["_id"]}))


@api.post("/auth/register")
async def register(body: RegisterIn):
    phone = body.phone.strip()
    if await db.users.find_one({"phone": phone}):
        raise HTTPException(400, "رقم الهاتف مسجل مسبقاً")
    await db.users.insert_one({
        "name": body.name.strip(), "phone": phone, "password_hash": hash_pw(body.password),
        "role": "student", "status": "pending", "gender": body.gender, "university": body.university,
        "notes": body.notes, "created_at": now_iso(),
    })
    return {"ok": True, "message": "تم إرسال طلب الحساب، سيتم تفعيله من قبل الإدارة"}


# ---------- Universities ----------


async def ensure_university(name: str):
    name = name.strip()
    if name and not await db.universities.find_one({"name": name}):
        await db.universities.insert_one({"name": name, "created_at": now_iso()})


@api.get("/universities")
async def list_universities():
    return [ser(u) for u in await db.universities.find().sort("created_at", 1).to_list(500)]


@api.post("/universities")
async def add_university(body: UniversityIn, _=Depends(admin_only)):
    await ensure_university(body.name)
    return await list_universities()


# ---------- Vehicles ----------


async def driver_fields(driver_id: str):
    d = await db.users.find_one({"_id": oid(driver_id), "role": "driver", "status": "active"})
    if not d:
        raise HTTPException(400, "اختر سائقاً مفعلاً من الحسابات (أنشئه من إدارة الحسابات)")
    return {"driver_id": driver_id, "driver_name": d["name"], "driver_phone": d["phone"]}


@api.get("/vehicles")
async def list_vehicles(_=Depends(admin_only)):
    vs = [ser(v) for v in await db.vehicles.find().sort("created_at", -1).to_list(500)]
    for v in vs:
        v["capacity"] = CAPACITY
    return vs


@api.post("/vehicles")
async def add_vehicle(body: VehicleIn, _=Depends(admin_only)):
    plate = body.plate.strip()
    if await db.vehicles.find_one({"plate": plate}):
        raise HTTPException(400, "رقم اللوحة مسجل مسبقاً")
    doc = {"plate": plate, **await driver_fields(body.driver_id), "model": body.model, "created_at": now_iso()}
    res = await db.vehicles.insert_one(doc)
    doc["_id"] = res.inserted_id
    return ser(doc)


@api.put("/vehicles/{vid}")
async def update_vehicle(vid: str, body: VehicleIn, _=Depends(admin_only)):
    v = await db.vehicles.find_one({"_id": oid(vid)})
    if not v:
        raise HTTPException(404, "السيارة غير موجودة")
    if await db.vehicles.find_one({"plate": body.plate.strip(), "_id": {"$ne": v["_id"]}}):
        raise HTTPException(400, "رقم اللوحة مسجل مسبقاً")
    upd = {"plate": body.plate.strip(), **await driver_fields(body.driver_id), "model": body.model}
    await db.vehicles.update_one({"_id": v["_id"]}, {"$set": upd})
    return ser(await db.vehicles.find_one({"_id": v["_id"]}))


@api.delete("/vehicles/{vid}")
async def delete_vehicle(vid: str, _=Depends(admin_only)):
    v = await db.vehicles.find_one({"_id": oid(vid)})
    if not v:
        raise HTTPException(404, "السيارة غير موجودة")
    await db.vehicles.delete_one({"_id": v["_id"]})
    await db.bookings.update_many({"vehicle_id": vid, "status": "confirmed"},
                                  {"$set": {"status": "pending", "vehicle_id": None, "seat": None}})
    await db.trips.delete_many({"vehicle_id": vid, "status": {"$ne": "completed"}})
    return {"ok": True}


# ---------- Bookings ----------


def booking_doc(data: dict, source: str, student_id: Optional[str] = None):
    return {
        **data, "directions": DIRECTIONS[data["trip_type"]], "status": "pending",
        "vehicle_id": None, "seat": None, "source": source, "student_id": student_id, "created_at": now_iso(),
    }


async def enrich(bookings: List[dict]):
    vids = {b["vehicle_id"] for b in bookings if b.get("vehicle_id")}
    vmap = {}
    if vids:
        for v in await db.vehicles.find({"_id": {"$in": [ObjectId(x) for x in vids]}}).to_list(500):
            vmap[str(v["_id"])] = ser(v)
    for b in bookings:
        b["vehicle"] = vmap.get(b.get("vehicle_id"))
    return bookings


@api.get("/bookings")
async def list_bookings(status: Optional[str] = None, date: Optional[str] = None, _=Depends(admin_only)):
    q = {}
    if status:
        q["status"] = status
    if date:
        q["date"] = date
    items = [ser(b) for b in await db.bookings.find(q).sort([("date", 1), ("pickup_time", 1)]).to_list(2000)]
    return await enrich(items)


@api.post("/bookings")
async def create_booking(body: BookingIn, _=Depends(admin_only)):
    data = body.model_dump()
    await ensure_university(body.university)
    student = await db.users.find_one({"phone": body.phone.strip(), "role": "student"})
    doc = booking_doc(data, "admin", str(student["_id"]) if student else None)
    res = await db.bookings.insert_one(doc)
    doc["_id"] = res.inserted_id
    return ser(doc)


@api.put("/bookings/{bid}")
async def update_booking(bid: str, body: BookingIn, _=Depends(admin_only)):
    b = await db.bookings.find_one({"_id": oid(bid)})
    if not b:
        raise HTTPException(404, "الحجز غير موجود")
    data = body.model_dump()
    data["directions"] = DIRECTIONS[data["trip_type"]]
    if b.get("vehicle_id") and (data["date"] != b["date"] or data["directions"] != b["directions"]
                                or data["gender"] != b["gender"]):
        data.update({"vehicle_id": None, "seat": None, "status": "pending"})
    await ensure_university(body.university)
    await db.bookings.update_one({"_id": b["_id"]}, {"$set": data})
    return ser(await db.bookings.find_one({"_id": b["_id"]}))


@api.patch("/bookings/{bid}/status")
async def set_booking_status(bid: str, body: BookingStatusIn, _=Depends(admin_only)):
    b = await db.bookings.find_one({"_id": oid(bid)})
    if not b:
        raise HTTPException(404, "الحجز غير موجود")
    upd = {"status": body.status}
    if body.status in ("pending", "cancelled"):
        upd.update({"vehicle_id": None, "seat": None})
    if body.status == "confirmed" and not b.get("vehicle_id"):
        raise HTTPException(400, "يجب توزيع الحجز على سيارة ومقعد أولاً")
    await db.bookings.update_one({"_id": b["_id"]}, {"$set": upd})
    return {"ok": True}


@api.delete("/bookings/{bid}")
async def delete_booking(bid: str, _=Depends(admin_only)):
    await db.bookings.delete_one({"_id": oid(bid)})
    return {"ok": True}


# ---------- Student portal ----------


@api.get("/my/bookings")
async def my_bookings(user=Depends(role("student"))):
    q = {"$or": [{"student_id": user["id"]}, {"phone": user["phone"]}]}
    items = [ser(b) for b in await db.bookings.find(q).sort([("date", -1), ("pickup_time", 1)]).to_list(500)]
    items = await enrich(items)
    for b in items:
        b["seat_rows"] = None
        if b.get("vehicle_id") and b.get("seat") and b["status"] in ("confirmed", "completed"):
            rows = await seat_map(b["vehicle_id"], b["date"], b["directions"])
            for row in rows:
                row.pop("gender", None)
                for s in row["seats"]:
                    occ = s.pop("occupant")
                    s["mine"] = bool(occ and occ["id"] == b["id"])
                    s["taken"] = bool(occ) and not s["mine"]
            b["seat_rows"] = rows
        trips = await db.trips.find({"vehicle_id": b.get("vehicle_id"), "date": b["date"],
                                     "direction": {"$in": b["directions"]}}).to_list(10) if b.get("vehicle_id") else []
        b["trips"] = [{"direction": t["direction"], "start_time": t["start_time"], "status": t["status"]} for t in trips]
    return items


@api.post("/my/bookings")
async def my_create_booking(body: StudentBookingIn, user=Depends(role("student"))):
    data = body.model_dump()
    data.update({"student_name": user["name"], "phone": user["phone"], "gender": user.get("gender", "male"),
                 "university": user.get("university", "")})
    doc = booking_doc(data, "student", user["id"])
    res = await db.bookings.insert_one(doc)
    doc["_id"] = res.inserted_id
    return ser(doc)


@api.post("/my/bookings/{bid}/cancel")
async def my_cancel_booking(bid: str, user=Depends(role("student"))):
    b = await db.bookings.find_one({"_id": oid(bid), "$or": [{"student_id": user["id"]}, {"phone": user["phone"]}]})
    if not b:
        raise HTTPException(404, "الحجز غير موجود")
    if b["status"] == "completed":
        raise HTTPException(400, "لا يمكن إلغاء حجز مكتمل")
    await db.bookings.update_one({"_id": b["_id"]}, {"$set": {"status": "cancelled", "vehicle_id": None, "seat": None}})
    return {"ok": True}


# ---------- Students (admin) ----------


@api.get("/students")
async def list_students(status: Optional[str] = None, _=Depends(admin_only)):
    q = {"role": "student"}
    if status:
        q["status"] = status
    return [ser(u) for u in await db.users.find(q).sort("created_at", -1).to_list(2000)]


@api.patch("/students/{sid}/status")
async def set_student_status(sid: str, body: StudentStatusIn, _=Depends(admin_only)):
    res = await db.users.update_one({"_id": oid(sid), "role": "student"}, {"$set": {"status": body.status}})
    if not res.matched_count:
        raise HTTPException(404, "الطالب غير موجود")
    return {"ok": True}


# ---------- Accounts (admin) ----------


def account_fields(body: AccountIn):
    data = {"name": body.name.strip(), "phone": body.phone.strip(), "role": body.role, "status": body.status,
            "notes": body.notes}
    if body.role == "student":
        if not body.gender or not body.university:
            raise HTTPException(400, "حدد جنس الطالب وجامعته")
        data.update({"gender": body.gender, "university": body.university.strip()})
    if body.password:
        if len(body.password) < 6:
            raise HTTPException(400, "كلمة المرور قصيرة (6 أحرف على الأقل)")
        data["password_hash"] = hash_pw(body.password)
    return data


@api.get("/accounts")
async def list_accounts(role: Optional[str] = None, status: Optional[str] = None, _=Depends(admin_only)):
    q = {"role": role if role in ("driver", "student") else {"$in": ["driver", "student"]}}
    if status:
        q["status"] = status
    users = [ser(u) for u in await db.users.find(q).sort("created_at", -1).to_list(3000)]
    plates = {}
    for v in await db.vehicles.find().to_list(500):
        plates.setdefault(v["driver_phone"], []).append(v["plate"])
    for u in users:
        if u["role"] == "driver":
            u["vehicles"] = plates.get(u["phone"], [])
    return users


@api.post("/accounts")
async def create_account(body: AccountIn, _=Depends(admin_only)):
    if not body.password:
        raise HTTPException(400, "حدد كلمة المرور")
    data = account_fields(body)
    if await db.users.find_one({"phone": data["phone"]}):
        raise HTTPException(400, "رقم الهاتف مسجل مسبقاً")
    if body.role == "student":
        await ensure_university(data["university"])
    data.update({"created_at": now_iso(), "created_by": "admin"})
    res = await db.users.insert_one(data)
    data["_id"] = res.inserted_id
    return ser(data)


@api.put("/accounts/{uid}")
async def update_account(uid: str, body: AccountIn, _=Depends(admin_only)):
    u = await db.users.find_one({"_id": oid(uid), "role": {"$in": ["driver", "student"]}})
    if not u:
        raise HTTPException(404, "الحساب غير موجود")
    if body.role != u["role"]:
        raise HTTPException(400, "لا يمكن تغيير نوع الحساب")
    data = account_fields(body)
    if await db.users.find_one({"phone": data["phone"], "_id": {"$ne": u["_id"]}}):
        raise HTTPException(400, "رقم الهاتف مسجل لحساب آخر")
    if body.role == "student":
        await ensure_university(data["university"])
    await db.users.update_one({"_id": u["_id"]}, {"$set": data})
    if u["role"] == "driver":
        await db.vehicles.update_many({"driver_phone": u["phone"]},
                                      {"$set": {"driver_phone": data["phone"], "driver_name": data["name"]}})
    return ser(await db.users.find_one({"_id": u["_id"]}))


@api.delete("/accounts/{uid}")
async def delete_account(uid: str, _=Depends(admin_only)):
    u = await db.users.find_one({"_id": oid(uid), "role": {"$in": ["driver", "student"]}})
    if not u:
        raise HTTPException(404, "الحساب غير موجود")
    if u["role"] == "driver" and await db.vehicles.find_one({"driver_phone": u["phone"]}):
        raise HTTPException(400, "السائق مرتبط بسيارة، غيّر سائق السيارة أو احذفها أولاً")
    await db.users.delete_one({"_id": u["_id"]})
    return {"ok": True}


# ---------- Dispatch ----------


async def seat_map(vehicle_id: str, date: str, directions: List[str], exclude_id: Optional[str] = None):
    q = {"vehicle_id": vehicle_id, "date": date, "directions": {"$in": directions},
         "status": {"$in": ["confirmed", "completed"]}}
    occupants = [ser(b) for b in await db.bookings.find(q).to_list(100)]
    occupants = [o for o in occupants if o["id"] != exclude_id]
    rows = []
    for r, n in ROWS.items():
        in_row = [o for o in occupants if o["seat"] and o["seat"]["row"] == r]
        genders = {o["gender"] for o in in_row}
        seats = []
        for s in range(1, n + 1):
            occ = next((o for o in in_row if o["seat"]["seat"] == s), None)
            seats.append({"row": r, "seat": s, "number": seat_number(r, s), "occupant": {
                "id": occ["id"], "student_name": occ["student_name"], "gender": occ["gender"],
                "trip_type": occ["trip_type"]} if occ else None})
        rows.append({"row": r, "gender": next(iter(genders)) if len(genders) == 1 else (None if not genders else "mixed"),
                     "seats": seats})
    return rows


@api.get("/dispatch/seats")
async def dispatch_seats(vehicle_id: str, booking_id: Optional[str] = None, date: Optional[str] = None,
                         direction: Optional[str] = None, _=Depends(admin_only)):
    if booking_id:
        b = await db.bookings.find_one({"_id": oid(booking_id)})
        if not b:
            raise HTTPException(404, "الحجز غير موجود")
        return {"rows": await seat_map(vehicle_id, b["date"], b["directions"], booking_id)}
    if not date:
        raise HTTPException(400, "حدد التاريخ")
    dirs = [direction] if direction else ["go", "return"]
    return {"rows": await seat_map(vehicle_id, date, dirs)}


@api.post("/dispatch")
async def dispatch(body: DispatchIn, _=Depends(admin_only)):
    b = await db.bookings.find_one({"_id": oid(body.booking_id)})
    if not b:
        raise HTTPException(404, "الحجز غير موجود")
    if b["status"] in ("cancelled", "completed"):
        raise HTTPException(400, "لا يمكن توزيع حجز ملغى أو مكتمل")
    if not await db.vehicles.find_one({"_id": oid(body.vehicle_id)}):
        raise HTTPException(404, "السيارة غير موجودة")
    if body.row not in ROWS or not 1 <= body.seat <= ROWS[body.row]:
        raise HTTPException(400, "مقعد غير صالح")
    rows = await seat_map(body.vehicle_id, b["date"], b["directions"], body.booking_id)
    row = rows[body.row - 1]
    if row["seats"][body.seat - 1]["occupant"]:
        raise HTTPException(400, "المقعد محجوز")
    if row["gender"] and row["gender"] != b["gender"]:
        raise HTTPException(400, "قفل الجنس: لا يمكن الجمع بين الذكور والإناث في نفس الصف")
    await db.bookings.update_one({"_id": b["_id"]}, {"$set": {
        "vehicle_id": body.vehicle_id, "seat": {"row": body.row, "seat": body.seat}, "status": "confirmed",
        "dispatched_at": now_iso()}})
    return ser(await db.bookings.find_one({"_id": b["_id"]}))


@api.post("/dispatch/{bid}/unassign")
async def unassign(bid: str, _=Depends(admin_only)):
    res = await db.bookings.update_one({"_id": oid(bid)}, {"$set": {"vehicle_id": None, "seat": None, "status": "pending"}})
    if not res.matched_count:
        raise HTTPException(404, "الحجز غير موجود")
    return {"ok": True}


# ---------- Trips ----------


async def trip_full(t: dict):
    t = ser(t)
    v = await db.vehicles.find_one({"_id": ObjectId(t["vehicle_id"])}) if ObjectId.is_valid(t["vehicle_id"]) else None
    t["vehicle"] = ser(v) if v else None
    q = {"vehicle_id": t["vehicle_id"], "date": t["date"], "directions": t["direction"],
         "status": {"$in": ["confirmed", "completed"]}}
    passengers = [ser(b) for b in await db.bookings.find(q).sort("pickup_time", 1).to_list(50)]
    t["passengers"] = passengers
    t["occupancy"] = len(passengers)
    return t


@api.get("/trips")
async def list_trips(date: Optional[str] = None, _=Depends(admin_only)):
    q = {"date": date} if date else {}
    trips = await db.trips.find(q).sort([("date", -1), ("start_time", 1)]).to_list(500)
    return [await trip_full(t) for t in trips]


@api.post("/trips")
async def create_trip(body: TripIn, _=Depends(admin_only)):
    if not await db.vehicles.find_one({"_id": oid(body.vehicle_id)}):
        raise HTTPException(404, "السيارة غير موجودة")
    if await db.trips.find_one({"vehicle_id": body.vehicle_id, "date": body.date, "direction": body.direction}):
        raise HTTPException(400, "توجد رحلة لهذه السيارة بنفس التاريخ والاتجاه")
    doc = {**body.model_dump(), "status": "pending", "created_at": now_iso()}
    res = await db.trips.insert_one(doc)
    doc["_id"] = res.inserted_id
    return await trip_full(doc)


async def apply_trip_status(t: dict, status: str):
    upd = {"status": status}
    if status == "in_progress":
        upd["started_at"] = now_iso()
    if status == "completed":
        upd["completed_at"] = now_iso()
    await db.trips.update_one({"_id": t["_id"]}, {"$set": upd})
    if status == "completed":
        q = {"vehicle_id": t["vehicle_id"], "date": t["date"], "directions": t["direction"], "status": "confirmed"}
        for b in await db.bookings.find(q).to_list(50):
            done = await db.trips.count_documents({"vehicle_id": t["vehicle_id"], "date": t["date"],
                                                   "direction": {"$in": b["directions"]}, "status": "completed"})
            if done >= len(b["directions"]):
                await db.bookings.update_one({"_id": b["_id"]}, {"$set": {"status": "completed"}})


@api.patch("/trips/{tid}/status")
async def set_trip_status(tid: str, body: TripStatusIn, _=Depends(admin_only)):
    t = await db.trips.find_one({"_id": oid(tid)})
    if not t:
        raise HTTPException(404, "الرحلة غير موجودة")
    await apply_trip_status(t, body.status)
    return {"ok": True}


@api.delete("/trips/{tid}")
async def delete_trip(tid: str, _=Depends(admin_only)):
    await db.trips.delete_one({"_id": oid(tid)})
    return {"ok": True}


# ---------- Driver ----------


async def driver_vehicle_ids(user):
    return [str(v["_id"]) for v in await db.vehicles.find({"driver_phone": user["phone"]}).to_list(50)]


@api.get("/driver/trips")
async def driver_trips(user=Depends(role("driver"))):
    vids = await driver_vehicle_ids(user)
    trips = await db.trips.find({"vehicle_id": {"$in": vids}}).sort([("date", -1), ("start_time", 1)]).to_list(100)
    return [await trip_full(t) for t in trips]


@api.patch("/driver/trips/{tid}/status")
async def driver_trip_status(tid: str, body: TripStatusIn, user=Depends(role("driver"))):
    vids = await driver_vehicle_ids(user)
    t = await db.trips.find_one({"_id": oid(tid), "vehicle_id": {"$in": vids}})
    if not t:
        raise HTTPException(404, "الرحلة غير موجودة")
    if (t["status"], body.status) not in (("pending", "in_progress"), ("in_progress", "completed")):
        raise HTTPException(400, "لا يمكن تغيير حالة الرحلة بهذا الشكل")
    await apply_trip_status(t, body.status)
    return {"ok": True}


# ---------- Stats ----------


@api.get("/stats")
async def stats(_=Depends(admin_only)):
    vehicles = await db.vehicles.count_documents({})
    capacity = vehicles * CAPACITY
    b = db.bookings
    confirmed = await b.count_documents({"status": "confirmed"})
    today = datetime.now(timezone.utc).date().isoformat()
    upcoming_seats = await b.count_documents({"status": "confirmed", "date": {"$gte": today}})
    upcoming_dates = await b.distinct("date", {"status": "confirmed", "date": {"$gte": today}})
    denom = capacity * max(len(upcoming_dates), 1)
    return {
        "vehicles": vehicles,
        "capacity": capacity,
        "bookings_total": await b.count_documents({}),
        "bookings_pending": await b.count_documents({"status": "pending"}),
        "bookings_confirmed": confirmed,
        "bookings_completed": await b.count_documents({"status": "completed"}),
        "trips_total": await db.trips.count_documents({}),
        "trips_in_progress": await db.trips.count_documents({"status": "in_progress"}),
        "students_pending": await db.users.count_documents({"role": "student", "status": "pending"}),
        "occupancy_rate": round(min(upcoming_seats / denom * 100, 100), 1) if capacity else 0,
    }


@api.get("/")
async def root():
    return {"message": "Noexis TMS API"}


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=False,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await db.users.create_index("phone", unique=True)
    await db.login_attempts.create_index("identifier")
    await db.vehicles.create_index("plate", unique=True)
    await db.universities.create_index("name", unique=True)
    phone = os.environ["ADMIN_PHONE"]
    if not await db.users.find_one({"role": "admin"}):
        await db.users.insert_one({
            "name": "مدير النظام", "phone": phone, "email": os.environ.get("ADMIN_EMAIL"),
            "password_hash": hash_pw(os.environ["ADMIN_PASSWORD"]), "role": "admin", "status": "active",
            "default_password": True, "created_at": now_iso()})
    for a in await db.users.find({"role": "admin", "default_password": {"$exists": False}}).to_list(10):
        await db.users.update_one({"_id": a["_id"]}, {"$set": {
            "default_password": check_pw(os.environ["ADMIN_PASSWORD"], a["password_hash"])}})
    if await db.universities.count_documents({}) == 0:
        for u in DEFAULT_UNIS:
            await ensure_university(u)


@app.on_event("shutdown")
async def shutdown():
    client.close()
