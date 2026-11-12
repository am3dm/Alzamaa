# Noexis TMS — PRD

## Original problem statement
نظام إدارة نقل الطلاب المتقدم المصمم خصيصاً لنقل الطلاب بين بلد وبغداد. قاعدة البيانات postgre الواجهة react والباكند بايثون. كل شيء مترابط الادمن والتوزيع واختيار المقعد وشاشة الحجز، وتحديد الموقع على الخريطة وتوجيه السائق عبر تطبيقات خارجية (الخريطة فقط لحفظ النقط). الميزات: إدارة السيارات، الحجوزات (اسم، هاتف، جامعة من قائمة أو جديدة، وقت التقاط 6ص-7م، ملاحظات، حالات)، التوزيع (صف ومقعد، قفل الجنس لكل صف)، الرحلات (وقت بداية، حالات)، لوحة إحصائيات. سيارة 8 مقاعد (2/3/3). دخول افتراضي 1234567890 / admin123. الجامعات: جامعة بغداد، الجامعة التكنولوجية، جامعة النهرين، الجامعة الستينية، جامعة الكرخ.
User choices: built-in DB (MongoDB) instead of Postgres; gender chosen manually by admin; pickup point on small map; driver has own login screen; admin + public student registration. Extra: student sends account request, admin opens account, student sees trips; trip types: go (Balad→Baghdad), return (Baghdad→Balad), round.

## Architecture
FastAPI (/app/backend/server.py) + MongoDB, JWT Bearer (phone+password, bcrypt). React RTL (Tajawal, blue), react-query, Leaflet/OSM map picker, Google Maps/Waze external links.

## Implemented (2026-11-12)
- Pickup + arrival (dropoff) points on map for all trip types; round trip reverses points on return leg; driver/admin/student see both with Google Maps/Waze; full route = pickups then dropoffs
- 7-seat layout matching user's design (driver + seat 1 premium front, 2-4 middle, 5-7 back, "اتجاه السير"), select-then-confirm dispatch bar; student sees own seat on read-only seat map + pickup location map with Google Maps/Waze
- Default admin account (1234567890/admin123) for initial setup, editable from "إعدادات الحساب" (name, phone, email, password; requires current password); warning banner while default password is in use; seed never overwrites an edited admin
- Admin "إدارة الحسابات": admin creates/edits/suspends/deletes driver & student accounts (tabs: students, drivers, new requests, suspended); vehicles now pick a driver from active driver accounts
- Roles admin/driver/student; admin seeded; driver account created with vehicle; student register → admin approve
- Vehicles CRUD, bookings CRUD + status, dispatch with visual seat map + gender lock + round-trip both directions, unassign
- Trips per vehicle/date/direction auto-list dispatched passengers, start/complete, booking completion
- Driver portal (call, Google Maps/Waze, full route), student portal (request booking, view seat/driver/trip status, cancel)
- Stats bar auto-refresh

## Backlog
- P1: shadcn Arabic date picker instead of native inputs; WhatsApp/SMS notifications to students
- P2: reports/export, payments tracking, delete student accounts
