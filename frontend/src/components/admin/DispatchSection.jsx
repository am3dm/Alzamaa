import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MapPinned, Clock, Info } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { SectionCard, Empty } from "@/components/admin/SectionCard";
import { SeatMap } from "@/components/SeatMap";
import { Field, SimpleSelect } from "@/components/Field";
import { useVehicles } from "@/components/admin/VehiclesSection";
import { TRIP_TYPES, GENDERS, DIRECTIONS, ROW_NAMES, formatTime } from "@/lib/constants";
import { api, errMsg } from "@/lib/api";

const PendingList = ({ items, selected, onSelect }) => (
  <div className="space-y-2 max-h-[560px] overflow-y-auto" data-testid="dispatch-pending-list">
    {!items.length && <Empty text="لا توجد حجوزات معلقة" testId="dispatch-pending-empty" />}
    {items.map((b) => (
      <button key={b.id} onClick={() => onSelect(b)} data-testid={`dispatch-booking-${b.id}`}
        className={`w-full text-start rounded-xl border-2 p-3 transition-colors ${selected?.id === b.id ? "border-primary bg-blue-50" : "border-slate-200 hover:border-blue-300 bg-white"}`}>
        <div className="flex justify-between items-center">
          <span className="font-bold">{b.student_name}</span>
          <span className={`text-xs rounded-full px-2 font-bold ${b.gender === "female" ? "bg-pink-100 text-pink-700" : "bg-blue-100 text-blue-700"}`}>{GENDERS[b.gender]}</span>
        </div>
        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Clock className="h-3 w-3" /> {b.date} · {formatTime(b.pickup_time)}</div>
        <div className="text-xs text-slate-600">{TRIP_TYPES[b.trip_type]} · {b.university}</div>
      </button>
    ))}
  </div>
);

const Legend = () => (
  <div className="flex flex-wrap gap-3 text-xs text-slate-600">
    <span className="flex items-center gap-1"><i className="h-3 w-3 rounded bg-blue-100 border border-blue-500" /> ذكر</span>
    <span className="flex items-center gap-1"><i className="h-3 w-3 rounded bg-pink-100 border border-pink-400" /> أنثى</span>
    <span className="flex items-center gap-1"><i className="h-3 w-3 rounded bg-white border border-slate-300" /> متاح</span>
    <span className="flex items-center gap-1"><i className="h-3 w-3 rounded bg-red-50 border border-red-300" /> مقفل للجنس الآخر</span>
  </div>
);

export const DispatchSection = () => {
  const qc = useQueryClient();
  const { data: vehicles = [] } = useVehicles();
  const [booking, setBooking] = useState(null);
  const [vehicleId, setVehicleId] = useState("");
  const [viewDate, setViewDate] = useState("");
  const [viewDir, setViewDir] = useState("go");
  const { data: pending = [] } = useQuery({ queryKey: ["bookings", { status: "pending" }], queryFn: () => api.get("/bookings", { params: { status: "pending" } }).then((r) => r.data), refetchInterval: 10000 });
  const seatParams = booking ? { vehicle_id: vehicleId, booking_id: booking.id } : { vehicle_id: vehicleId, date: viewDate, direction: viewDir };
  const canLoad = vehicleId && (booking || viewDate);
  const { data: seats } = useQuery({ queryKey: ["seats", seatParams], queryFn: () => api.get("/dispatch/seats", { params: seatParams }).then((r) => r.data), enabled: !!canLoad, refetchInterval: 8000, staleTime: 0 });

  const assign = async (seat) => {
    try {
      await api.post("/dispatch", { booking_id: booking.id, vehicle_id: vehicleId, row: seat.row, seat: seat.seat });
      toast.success(`تم تعيين ${booking.student_name} في ${ROW_NAMES[seat.row]} - مقعد ${seat.seat}`);
      setViewDate(booking.date);
      setViewDir(booking.directions[0]);
      setBooking(null);
      qc.invalidateQueries();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };
  const unassign = async (seat) => {
    if (!window.confirm(`إلغاء توزيع ${seat.occupant.student_name} وإرجاعه للانتظار؟`)) return;
    await api.post(`/dispatch/${seat.occupant.id}/unassign`);
    toast.success("تم إلغاء التوزيع");
    qc.invalidateQueries();
  };

  return (
    <div className="grid xl:grid-cols-[340px_1fr] gap-6">
      <SectionCard title={`حجوزات معلقة (${pending.length})`} icon={MapPinned} testId="dispatch-pending-card">
        <PendingList items={pending} selected={booking} onSelect={(b) => setBooking(booking?.id === b.id ? null : b)} />
      </SectionCard>
      <SectionCard title="اختيار السيارة والمقعد" testId="dispatch-seat-card">
        <div className="grid sm:grid-cols-3 gap-4 mb-5">
          <Field label="السيارة" className="sm:col-span-1">
            <SimpleSelect value={vehicleId} onChange={setVehicleId} placeholder="اختر السيارة" testId="dispatch-vehicle-select"
              options={vehicles.map((v) => ({ value: v.id, label: `${v.plate} - ${v.driver_name}` }))} />
          </Field>
          {!booking && (
            <>
              <Field label="عرض تاريخ"><Input type="date" className="h-11" value={viewDate} onChange={(e) => setViewDate(e.target.value)} data-testid="dispatch-view-date" /></Field>
              <Field label="الاتجاه"><SimpleSelect value={viewDir} onChange={setViewDir} testId="dispatch-view-direction" options={Object.entries(DIRECTIONS).map(([value, label]) => ({ value, label }))} /></Field>
            </>
          )}
        </div>
        {booking ? (
          <div className="mb-4 rounded-xl bg-blue-50 p-3 text-sm flex items-start gap-2" data-testid="dispatch-selected-info">
            <Info className="h-4 w-4 text-primary mt-1" />
            <span>تعيين <b>{booking.student_name}</b> ({GENDERS[booking.gender]}) — {TRIP_TYPES[booking.trip_type]} بتاريخ {booking.date}. اختر مقعداً متاحاً.</span>
          </div>
        ) : (
          <div className="mb-4 text-sm text-muted-foreground">اختر حجزاً من القائمة لتعيينه، أو اعرض مقاعد سيارة بتاريخ معين. اضغط على مقعد مشغول لإلغاء توزيعه.</div>
        )}
        {!vehicles.length ? <Empty text="أضف سيارة أولاً من قسم السيارات" testId="dispatch-no-vehicles" /> :
          !canLoad ? <Empty text="اختر السيارة لعرض المقاعد" testId="dispatch-choose-vehicle" /> :
          seats && (
            <div className="max-w-md space-y-3">
              <SeatMap rows={seats.rows} gender={booking?.gender} onSeat={assign} onOccupant={unassign} />
              <Legend />
            </div>
          )}
      </SectionCard>
    </div>
  );
};
