import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Route, Plus, Play, Flag, Trash2, Phone } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SectionCard, Empty } from "@/components/admin/SectionCard";
import { Field, SimpleSelect } from "@/components/Field";
import { StatusBadge } from "@/components/StatusBadge";
import { LegLinks } from "@/components/NavButtons";
import { useVehicles } from "@/components/admin/VehiclesSection";
import { DIRECTIONS, TRIP_STATUS, seatNumber, SEATS_PER_VEHICLE, formatTime, today, fullRoute } from "@/lib/constants";
import { api, errMsg } from "@/lib/api";

const dirOptions = Object.entries(DIRECTIONS).map(([value, label]) => ({ value, label }));

const TripForm = () => {
  const qc = useQueryClient();
  const { data: vehicles = [] } = useVehicles();
  const [f, setF] = useState({ vehicle_id: "", date: today(), direction: "go", start_time: "07:00" });
  const submit = async (e) => {
    e.preventDefault();
    if (!f.vehicle_id) return toast.error("اختر السيارة");
    try {
      await api.post("/trips", f);
      toast.success("تم إنشاء الرحلة وربط الطلاب الموزعين عليها");
      qc.invalidateQueries();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };
  return (
    <form onSubmit={submit} className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4" data-testid="trip-form">
      <Field label="السيارة" className="lg:col-span-2">
        <SimpleSelect value={f.vehicle_id} onChange={(v) => setF({ ...f, vehicle_id: v })} placeholder="اختر السيارة" testId="trip-vehicle-select"
          options={vehicles.map((v) => ({ value: v.id, label: `${v.plate} - ${v.driver_name}` }))} />
      </Field>
      <Field label="التاريخ"><Input type="date" className="h-11" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} data-testid="trip-date-input" /></Field>
      <Field label="الاتجاه"><SimpleSelect value={f.direction} onChange={(v) => setF({ ...f, direction: v })} options={dirOptions} testId="trip-direction-select" /></Field>
      <Field label="وقت البداية"><Input type="time" className="h-11" value={f.start_time} onChange={(e) => setF({ ...f, start_time: e.target.value })} data-testid="trip-time-input" /></Field>
      <Button type="submit" className="h-11 font-bold gap-2 lg:col-start-5" data-testid="trip-submit-button"><Plus className="h-4 w-4" /> إنشاء الرحلة</Button>
    </form>
  );
};

export const PassengerList = ({ passengers, large }) => (
  <ol className="space-y-2">
    {passengers.map((p, i) => (
      <li key={p.id} className="rounded-xl border border-slate-200 p-3 flex flex-wrap items-center justify-between gap-2" data-testid={`passenger-${p.id}`}>
        <div className="flex items-center gap-3">
          <span className="h-8 w-8 rounded-full bg-primary text-white grid place-items-center font-bold text-sm">{i + 1}</span>
          <div>
            <div className="font-bold">{p.student_name}</div>
            <div className="text-xs text-muted-foreground">{formatTime(p.pickup_time)} · مقعد {seatNumber(p.seat)} · {p.university}</div>
            {p.leg_pickup_address && <div className="text-xs text-primary">التقاط: {p.leg_pickup_address}</div>}
            {p.leg_dropoff_address && <div className="text-xs text-emerald-700">وصول: {p.leg_dropoff_address}</div>}
            {p.notes && <div className="text-xs text-amber-700">{p.notes}</div>}
          </div>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <a href={`tel:${p.phone}`} className={`${large ? "h-12 px-4" : "h-8 px-3"} inline-flex items-center gap-1 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-bold hover:bg-emerald-200 transition-colors`} data-testid={`passenger-call-${p.id}`}><Phone className="h-4 w-4" /> اتصال</a>
          <LegLinks pickup={p.leg_pickup} dropoff={p.leg_dropoff} testPrefix={`passenger-${p.id}`} large={large} />
        </div>
      </li>
    ))}
  </ol>
);

const routeStops = (trip) => [...trip.passengers.map((p) => p.leg_pickup), ...trip.passengers.map((p) => p.leg_dropoff)]
  .filter(Boolean)
  .filter((l, i, arr) => arr.findIndex((x) => x.lat === l.lat && x.lng === l.lng) === i);

export const TripActions = ({ trip, onStatus }) => {
  const route = fullRoute(routeStops(trip));
  return (
  <div className="flex flex-wrap gap-2">
    {trip.status === "pending" && <Button onClick={() => onStatus("in_progress")} className="gap-2 font-bold" data-testid={`trip-start-${trip.id}`}><Play className="h-4 w-4" /> بدء الرحلة</Button>}
    {trip.status === "in_progress" && <Button onClick={() => onStatus("completed")} className="gap-2 font-bold bg-emerald-600 hover:bg-emerald-700" data-testid={`trip-complete-${trip.id}`}><Flag className="h-4 w-4" /> إنهاء الرحلة</Button>}
    {route && (
      <a href={route} target="_blank" rel="noreferrer" data-testid={`trip-full-route-${trip.id}`}
        className="h-10 px-4 inline-flex items-center rounded-md border border-primary text-primary font-bold text-sm hover:bg-blue-50 transition-colors">فتح المسار كاملاً (التقاط ثم وصول)</a>
    )}
  </div>
  );
};

const TripCard = ({ t }) => {
  const qc = useQueryClient();
  const setStatus = async (status) => {
    try { await api.patch(`/trips/${t.id}/status`, { status }); toast.success("تم تحديث حالة الرحلة"); qc.invalidateQueries(); } catch (err) { toast.error(errMsg(err)); }
  };
  const remove = async () => {
    if (!window.confirm("حذف الرحلة؟")) return;
    await api.delete(`/trips/${t.id}`); toast.success("تم حذف الرحلة"); qc.invalidateQueries();
  };
  return (
    <div className="rounded-2xl border border-slate-200 p-4 space-y-3" data-testid={`trip-card-${t.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-extrabold">{DIRECTIONS[t.direction]}</div>
          <div className="text-sm text-muted-foreground">{t.date} · انطلاق {formatTime(t.start_time)}</div>
          <div className="text-sm">{t.vehicle?.plate} · {t.vehicle?.driver_name} <span dir="ltr">({t.vehicle?.driver_phone})</span></div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-primary" data-testid={`trip-occupancy-${t.id}`}>{t.occupancy}/{SEATS_PER_VEHICLE}</span>
          <StatusBadge map={TRIP_STATUS} status={t.status} testId={`trip-status-${t.id}`} />
          <Button size="icon" variant="ghost" className="text-red-600" onClick={remove} data-testid={`trip-delete-${t.id}`}><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>
      {t.passengers.length ? <PassengerList passengers={t.passengers} /> : <div className="text-sm text-muted-foreground">لا يوجد طلاب موزعون على هذه السيارة لهذا التاريخ والاتجاه بعد.</div>}
      <TripActions trip={t} onStatus={setStatus} />
    </div>
  );
};

export const TripsSection = () => {
  const [date, setDate] = useState("");
  const params = date ? { date } : {};
  const { data = [], isLoading } = useQuery({ queryKey: ["trips", params], queryFn: () => api.get("/trips", { params }).then((r) => r.data), refetchInterval: 10000 });
  return (
    <div className="space-y-6">
      <SectionCard title="إنشاء رحلة" icon={Route} testId="trip-create-card"><TripForm /></SectionCard>
      <SectionCard title={`الرحلات (${data.length})`} testId="trips-list-card"
        action={<Input type="date" className="h-10 w-44" value={date} onChange={(e) => setDate(e.target.value)} data-testid="trips-date-filter" />}>
        {!isLoading && !data.length ? <Empty text="لا توجد رحلات" testId="trips-empty" /> : <div className="space-y-4">{data.map((t) => <TripCard key={t.id} t={t} />)}</div>}
      </SectionCard>
    </div>
  );
};
