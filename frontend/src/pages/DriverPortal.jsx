import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Empty } from "@/components/admin/SectionCard";
import { PassengerList, TripActions } from "@/components/admin/TripsSection";
import { DIRECTIONS, TRIP_STATUS, formatTime, today } from "@/lib/constants";
import { api, errMsg } from "@/lib/api";

const DriverTrip = ({ t }) => {
  const qc = useQueryClient();
  const setStatus = async (status) => {
    try { await api.patch(`/driver/trips/${t.id}/status`, { status }); toast.success("تم تحديث حالة الرحلة"); qc.invalidateQueries(); } catch (err) { toast.error(errMsg(err)); }
  };
  return (
    <div className={`rounded-2xl bg-white border-2 p-5 space-y-4 fade-up ${t.date === today() ? "border-primary" : "border-slate-200"}`} data-testid={`driver-trip-${t.id}`}>
      <div className="flex justify-between items-start gap-2">
        <div>
          <div className="text-xl font-extrabold">{DIRECTIONS[t.direction]}</div>
          <div className="text-muted-foreground">{t.date === today() ? "اليوم" : t.date} · انطلاق {formatTime(t.start_time)}</div>
          <div className="text-sm">{t.vehicle?.plate} · {t.occupancy} طلاب</div>
        </div>
        <StatusBadge map={TRIP_STATUS} status={t.status} testId={`driver-trip-status-${t.id}`} />
      </div>
      <TripActions trip={t} onStatus={setStatus} />
      {t.passengers.length ? <PassengerList passengers={t.passengers} large /> : <div className="text-muted-foreground text-sm">لا يوجد طلاب في هذه الرحلة.</div>}
    </div>
  );
};

export default function DriverPortal() {
  const { data = [], isLoading } = useQuery({ queryKey: ["driver-trips"], queryFn: () => api.get("/driver/trips").then((r) => r.data), refetchInterval: 15000 });
  const t0 = today();
  const active = data.filter((t) => t.status !== "completed" && t.date >= t0).sort((a, b) => (a.date + a.start_time).localeCompare(b.date + b.start_time));
  const past = data.filter((t) => !active.includes(t));
  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader subtitle="شاشة السائق" />
      <main className="mx-auto max-w-2xl px-4 py-6 space-y-5">
        <h1 className="text-2xl font-extrabold">رحلاتي القادمة</h1>
        {!isLoading && !active.length && <Empty text="لا توجد رحلات قادمة" testId="driver-no-trips" />}
        {active.map((t) => <DriverTrip key={t.id} t={t} />)}
        {!!past.length && (
          <>
            <h2 className="text-lg font-extrabold text-slate-600 pt-4">رحلات سابقة</h2>
            {past.map((t) => <DriverTrip key={t.id} t={t} />)}
          </>
        )}
      </main>
    </div>
  );
}
