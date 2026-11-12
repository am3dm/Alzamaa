export const BOOKING_STATUS = {
  pending: { label: "قيد الانتظار", cls: "bg-amber-100 text-amber-700" },
  confirmed: { label: "مؤكد", cls: "bg-emerald-100 text-emerald-700" },
  completed: { label: "مكتمل", cls: "bg-teal-50 text-teal-600" },
  cancelled: { label: "ملغى", cls: "bg-red-100 text-red-600" },
};

export const TRIP_STATUS = {
  pending: { label: "قيد الانتظار", cls: "bg-amber-100 text-amber-700" },
  in_progress: { label: "قيد التنفيذ", cls: "bg-blue-100 text-blue-700" },
  completed: { label: "مكتملة", cls: "bg-emerald-100 text-emerald-700" },
};

export const STUDENT_STATUS = {
  pending: { label: "بانتظار الموافقة", cls: "bg-amber-100 text-amber-700" },
  active: { label: "مفعل", cls: "bg-emerald-100 text-emerald-700" },
  rejected: { label: "موقوف / مرفوض", cls: "bg-red-100 text-red-600" },
};

export const TRIP_TYPES = {
  go: "ذهاب (بلد ← بغداد)",
  return: "إياب (بغداد ← بلد)",
  round: "ذهاب وإياب",
};

export const DIRECTIONS = {
  go: "ذهاب: بلد ← بغداد",
  return: "إياب: بغداد ← بلد",
};

export const GENDERS = { male: "ذكر", female: "أنثى" };

export const ROW_NAMES = { 1: "الصف الأمامي", 2: "الصف الأوسط", 3: "الصف الخلفي" };

export const SEATS_PER_VEHICLE = 7;
const ROW_OFFSET = { 1: 0, 2: 1, 3: 4 };
export const seatNumber = (seat) => (seat ? ROW_OFFSET[seat.row] + seat.seat : null);
export const PREMIUM_SEAT = 1;

export const PICKUP_TIMES = Array.from({ length: 27 }, (_, i) => {
  const h = 6 + Math.floor(i / 2);
  const m = i % 2 ? "30" : "00";
  return `${String(h).padStart(2, "0")}:${m}`;
});

export const formatTime = (t) => {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const suffix = h < 12 ? "ص" : "م";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m).padStart(2, "0")} ${suffix}`;
};

export const BALAD_CENTER = [34.0164, 44.145];
export const BAGHDAD_CENTER = [33.3152, 44.3661];

export const LEG_LABELS = {
  go: { pickup: "مكان الالتقاط (بلد)", dropoff: "مكان الوصول (بغداد)", pc: BALAD_CENTER, dc: BAGHDAD_CENTER },
  return: { pickup: "مكان الالتقاط (بغداد)", dropoff: "مكان الوصول (بلد)", pc: BAGHDAD_CENTER, dc: BALAD_CENTER },
  round: { pickup: "مكان الالتقاط في الذهاب (بلد) — وهو مكان الوصول في الإياب", dropoff: "مكان الوصول في الذهاب (بغداد) — وهو مكان الالتقاط في الإياب", pc: BALAD_CENTER, dc: BAGHDAD_CENTER },
};

export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const googleNav = (loc) => `https://www.google.com/maps/dir/?api=1&destination=${loc.lat},${loc.lng}`;
export const wazeNav = (loc) => `https://waze.com/ul?ll=${loc.lat},${loc.lng}&navigate=yes`;

export const fullRoute = (locs) => {
  if (!locs.length) return null;
  const dest = locs[locs.length - 1];
  const waypoints = locs.slice(0, -1).map((l) => `${l.lat},${l.lng}`).join("|");
  return `https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lng}${waypoints ? `&waypoints=${encodeURIComponent(waypoints)}` : ""}&travelmode=driving`;
};
