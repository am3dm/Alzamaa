import { useQuery } from "@tanstack/react-query";
import { Car, ClipboardList, Route, Gauge, Armchair } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { api } from "@/lib/api";

const Stat = ({ icon: Icon, label, value, sub, testId, accent = "text-primary bg-blue-50" }) => (
  <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-sm hover:-translate-y-0.5 transition-transform" data-testid={testId}>
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground font-medium">{label}</span>
      <span className={`h-9 w-9 rounded-lg grid place-items-center ${accent}`}><Icon className="h-5 w-5" /></span>
    </div>
    <div className="text-3xl font-extrabold mt-2" data-testid={`${testId}-value`}>{value}</div>
    {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
  </div>
);

export const StatsBar = () => {
  const { data: s } = useQuery({ queryKey: ["stats"], queryFn: () => api.get("/stats").then((r) => r.data), refetchInterval: 10000, staleTime: 0 });
  if (!s) return <div className="h-32 rounded-2xl bg-white border animate-pulse" />;
  return (
    <section className="grid grid-cols-2 lg:grid-cols-5 gap-3" data-testid="stats-bar">
      <Stat icon={Car} label="السيارات" value={s.vehicles} testId="stat-vehicles" />
      <Stat icon={ClipboardList} label="الحجوزات" value={s.bookings_total}
        sub={`قيد الانتظار ${s.bookings_pending} · مؤكد ${s.bookings_confirmed}`} testId="stat-bookings" accent="text-amber-600 bg-amber-50" />
      <Stat icon={Route} label="الرحلات" value={s.trips_total} sub={`قيد التنفيذ ${s.trips_in_progress}`} testId="stat-trips" accent="text-emerald-600 bg-emerald-50" />
      <Stat icon={Armchair} label="السعة الكلية" value={s.capacity} sub="مقعد (8 لكل سيارة)" testId="stat-capacity" accent="text-sky-600 bg-sky-50" />
      <div className="col-span-2 lg:col-span-1">
        <Stat icon={Gauge} label="معدل الإشغال" value={`${s.occupancy_rate}%`} sub={<Progress value={s.occupancy_rate} className="h-2 mt-1" />} testId="stat-occupancy" />
      </div>
    </section>
  );
};
