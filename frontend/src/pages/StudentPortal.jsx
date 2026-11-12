import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Phone, Armchair, Car, Ban } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AppHeader } from "@/components/AppHeader";
import { BookingFields } from "@/components/BookingFields";
import { StatusBadge } from "@/components/StatusBadge";
import { Empty } from "@/components/admin/SectionCard";
import { useAuth } from "@/context/AuthContext";
import { BOOKING_STATUS, TRIP_STATUS, TRIP_TYPES, DIRECTIONS, ROW_NAMES, formatTime, today } from "@/lib/constants";
import { api, errMsg } from "@/lib/api";

const EMPTY = { date: today(), pickup_time: "07:00", trip_type: "go", location: null, address: "", notes: "" };

const NewBooking = ({ open, onClose }) => {
  const [f, setF] = useState(EMPTY);
  const qc = useQueryClient();
  const save = async () => {
    try {
      await api.post("/my/bookings", f);
      toast.success("تم إرسال طلب الحجز، بانتظار تأكيد الإدارة");
      qc.invalidateQueries();
      setF(EMPTY);
      onClose();
    } catch (err) { toast.error(errMsg(err)); }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl bg-white max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader><DialogTitle>حجز رحلة جديدة</DialogTitle></DialogHeader>
        <BookingFields value={f} onChange={setF} />
        <Button onClick={save} className="h-12 font-bold" data-testid="student-booking-submit">إرسال طلب الحجز</Button>
      </DialogContent>
    </Dialog>
  );
};

const BookingCard = ({ b }) => {
  const qc = useQueryClient();
  const cancel = async () => {
    if (!window.confirm("إلغاء هذا الحجز؟")) return;
    try { await api.post(`/my/bookings/${b.id}/cancel`); toast.success("تم إلغاء الحجز"); qc.invalidateQueries(); } catch (err) { toast.error(errMsg(err)); }
  };
  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm space-y-3 fade-up" data-testid={`my-booking-${b.id}`}>
      <div className="flex justify-between items-start gap-2">
        <div>
          <div className="font-extrabold text-lg">{TRIP_TYPES[b.trip_type]}</div>
          <div className="text-sm text-muted-foreground">{b.date} · الالتقاط {formatTime(b.pickup_time)}</div>
        </div>
        <StatusBadge map={BOOKING_STATUS} status={b.status} testId={`my-booking-status-${b.id}`} />
      </div>
      {b.vehicle ? (
        <div className="grid sm:grid-cols-3 gap-2 text-sm">
          <div className="rounded-xl bg-blue-50 p-3 flex items-center gap-2"><Car className="h-4 w-4 text-primary" /> {b.vehicle.plate}</div>
          <div className="rounded-xl bg-blue-50 p-3 flex items-center gap-2"><Armchair className="h-4 w-4 text-primary" /> {ROW_NAMES[b.seat?.row]} · مقعد {b.seat?.seat}</div>
          <a href={`tel:${b.vehicle.driver_phone}`} className="rounded-xl bg-emerald-50 p-3 flex items-center gap-2 text-emerald-800 font-bold" data-testid={`my-booking-call-driver-${b.id}`}><Phone className="h-4 w-4" /> {b.vehicle.driver_name}</a>
        </div>
      ) : b.status === "pending" && <div className="text-sm text-amber-700">بانتظار توزيعك على سيارة ومقعد.</div>}
      {!!b.trips?.length && (
        <div className="flex flex-wrap gap-2">
          {b.trips.map((t) => (
            <span key={t.direction} className="text-xs rounded-lg border px-2 py-1 flex items-center gap-1">
              {DIRECTIONS[t.direction]} · {formatTime(t.start_time)} <StatusBadge map={TRIP_STATUS} status={t.status} />
            </span>
          ))}
        </div>
      )}
      {["pending", "confirmed"].includes(b.status) && (
        <Button variant="ghost" size="sm" className="text-red-600 gap-1" onClick={cancel} data-testid={`my-booking-cancel-${b.id}`}><Ban className="h-4 w-4" /> إلغاء الحجز</Button>
      )}
    </div>
  );
};

export default function StudentPortal() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const { data = [], isLoading } = useQuery({ queryKey: ["my-bookings"], queryFn: () => api.get("/my/bookings").then((r) => r.data), refetchInterval: 15000 });
  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader subtitle="بوابة الطالب" />
      <main className="mx-auto max-w-3xl px-4 py-8 space-y-6">
        <div className="rounded-3xl bg-primary text-white p-6 sm:p-8 grain">
          <div className="text-sm text-blue-100">أهلاً</div>
          <h1 className="text-3xl sm:text-4xl font-extrabold mt-1" data-testid="student-welcome">{user.name}</h1>
          <p className="text-blue-100 mt-2">{user.university}</p>
          <Button onClick={() => setOpen(true)} className="mt-5 h-12 bg-white text-primary hover:bg-blue-50 font-bold gap-2" data-testid="student-new-booking-button">
            <Plus className="h-5 w-5" /> حجز رحلة جديدة
          </Button>
        </div>
        <h2 className="text-lg font-extrabold">رحلاتي وحجوزاتي</h2>
        {!isLoading && !data.length ? <Empty text="لا توجد حجوزات بعد" testId="student-bookings-empty" /> : <div className="space-y-4">{data.map((b) => <BookingCard key={b.id} b={b} />)}</div>}
      </main>
      <NewBooking open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
