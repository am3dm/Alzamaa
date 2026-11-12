import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardList, Plus, Pencil, Trash2, Ban, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SectionCard, Empty } from "@/components/admin/SectionCard";
import { BookingFields } from "@/components/BookingFields";
import { StatusBadge } from "@/components/StatusBadge";
import { LegLinks } from "@/components/NavButtons";
import { SimpleSelect } from "@/components/Field";
import { BOOKING_STATUS, TRIP_TYPES, GENDERS, seatNumber, formatTime, today } from "@/lib/constants";
import { api, errMsg } from "@/lib/api";

export const EMPTY_BOOKING = { student_name: "", phone: "", gender: "", university: "", date: today(), pickup_time: "07:00", trip_type: "go", location: null, address: "", dropoff_location: null, dropoff_address: "", notes: "" };

const BookingDialog = ({ initial, open, onClose }) => {
  const [f, setF] = useState(initial);
  const qc = useQueryClient();
  const save = async () => {
    if (!f.gender || !f.university || !f.student_name || !f.phone) return toast.error("أكمل بيانات الطالب");
    try {
      const body = { ...f };
      if (initial.id) await api.put(`/bookings/${initial.id}`, body);
      else await api.post("/bookings", body);
      toast.success(initial.id ? "تم تحديث الحجز" : "تم إنشاء الحجز");
      qc.invalidateQueries();
      onClose();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl bg-white max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader><DialogTitle>{initial.id ? "تعديل الحجز" : "إنشاء حجز جديد"}</DialogTitle></DialogHeader>
        <BookingFields value={f} onChange={setF} withStudent />
        <Button onClick={save} className="h-11 font-bold" data-testid="booking-submit-button">{initial.id ? "حفظ التعديلات" : "إنشاء الحجز"}</Button>
      </DialogContent>
    </Dialog>
  );
};

const BookingRow = ({ b, onEdit }) => {
  const qc = useQueryClient();
  const act = async (fn, msg) => {
    try { await fn(); toast.success(msg); qc.invalidateQueries(); } catch (err) { toast.error(errMsg(err)); }
  };
  return (
    <tr className="border-b border-slate-100 even:bg-slate-50/60 align-top" data-testid={`booking-row-${b.id}`}>
      <td className="p-3">
        <div className="font-bold">{b.student_name}</div>
        <div className="text-xs text-muted-foreground" dir="ltr">{b.phone}</div>
        <div className="text-xs text-muted-foreground">{GENDERS[b.gender]} · {b.university}</div>
      </td>
      <td className="p-3 text-sm">
        <div>{TRIP_TYPES[b.trip_type]}</div>
        <div className="text-xs text-muted-foreground">{b.date} · {formatTime(b.pickup_time)}</div>
        {b.notes && <div className="text-xs text-amber-700 mt-1">{b.notes}</div>}
      </td>
      <td className="p-3 text-sm">
        {b.vehicle ? <><div className="font-bold">{b.vehicle.plate}</div><div className="text-xs">مقعد رقم {seatNumber(b.seat)}</div></> : <span className="text-xs text-muted-foreground">غير موزع</span>}
      </td>
      <td className="p-3"><StatusBadge map={BOOKING_STATUS} status={b.status} testId={`booking-status-${b.id}`} /></td>
      <td className="p-3"><LegLinks pickup={b.location} dropoff={b.dropoff_location} testPrefix={`booking-${b.id}`} /></td>
      <td className="p-3">
        <div className="flex gap-1">
          <Button size="icon" variant="ghost" onClick={onEdit} title="تعديل" data-testid={`booking-edit-${b.id}`}><Pencil className="h-4 w-4" /></Button>
          {b.status === "confirmed" && <Button size="icon" variant="ghost" title="مكتمل" className="text-emerald-600" onClick={() => act(() => api.patch(`/bookings/${b.id}/status`, { status: "completed" }), "تم تعليم الحجز كمكتمل")} data-testid={`booking-complete-${b.id}`}><CheckCheck className="h-4 w-4" /></Button>}
          {b.status !== "cancelled" && <Button size="icon" variant="ghost" title="إلغاء" className="text-amber-600" onClick={() => act(() => api.patch(`/bookings/${b.id}/status`, { status: "cancelled" }), "تم إلغاء الحجز")} data-testid={`booking-cancel-${b.id}`}><Ban className="h-4 w-4" /></Button>}
          <Button size="icon" variant="ghost" title="حذف" className="text-red-600" onClick={() => window.confirm("حذف الحجز نهائياً؟") && act(() => api.delete(`/bookings/${b.id}`), "تم حذف الحجز")} data-testid={`booking-delete-${b.id}`}><Trash2 className="h-4 w-4" /></Button>
        </div>
      </td>
    </tr>
  );
};

const STATUS_OPTIONS = [{ value: "all", label: "كل الحالات" }, ...Object.entries(BOOKING_STATUS).map(([value, s]) => ({ value, label: s.label }))];

export const BookingsSection = () => {
  const [status, setStatus] = useState("all");
  const [date, setDate] = useState("");
  const [dialog, setDialog] = useState(null);
  const params = { ...(status !== "all" && { status }), ...(date && { date }) };
  const { data = [], isLoading } = useQuery({ queryKey: ["bookings", params], queryFn: () => api.get("/bookings", { params }).then((r) => r.data) });
  return (
    <SectionCard title="الحجوزات" icon={ClipboardList} testId="bookings-card"
      action={<Button onClick={() => setDialog({ ...EMPTY_BOOKING })} className="gap-2 font-bold" data-testid="new-booking-button"><Plus className="h-4 w-4" /> حجز جديد</Button>}>
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="w-44"><SimpleSelect value={status} onChange={setStatus} options={STATUS_OPTIONS} testId="bookings-status-filter" /></div>
        <Input type="date" className="h-11 w-44" value={date} onChange={(e) => setDate(e.target.value)} data-testid="bookings-date-filter" />
        {date && <Button variant="ghost" onClick={() => setDate("")} data-testid="bookings-clear-date">كل التواريخ</Button>}
      </div>
      {!isLoading && !data.length ? <Empty text="لا توجد حجوزات" testId="bookings-empty" /> : (
        <div className="overflow-x-auto">
          <table className="w-full text-start min-w-[860px]" data-testid="bookings-table">
            <thead className="text-xs text-muted-foreground border-b">
              <tr><th className="p-3 text-start">الطالب</th><th className="p-3 text-start">الرحلة</th><th className="p-3 text-start">السيارة والمقعد</th><th className="p-3 text-start">الحالة</th><th className="p-3 text-start">التقاط / وصول</th><th className="p-3 text-start">إجراءات</th></tr>
            </thead>
            <tbody>{data.map((b) => <BookingRow key={b.id} b={b} onEdit={() => setDialog(b)} />)}</tbody>
          </table>
        </div>
      )}
      {dialog && <BookingDialog key={dialog.id || "new"} initial={dialog} open onClose={() => setDialog(null)} />}
    </SectionCard>
  );
};
