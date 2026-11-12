import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Car, Pencil, Trash2, Phone, Plus } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, SimpleSelect } from "@/components/Field";
import { SectionCard, Empty } from "@/components/admin/SectionCard";
import { useAccounts } from "@/components/admin/AccountsSection";
import { api, errMsg } from "@/lib/api";

const EMPTY = { plate: "", model: "", driver_id: "" };

export const useVehicles = () => useQuery({ queryKey: ["vehicles"], queryFn: () => api.get("/vehicles").then((r) => r.data) });

const VehicleForm = ({ initial, onDone }) => {
  const [f, setF] = useState(initial || EMPTY);
  const qc = useQueryClient();
  const { data: drivers = [] } = useAccounts({ role: "driver", status: "active" });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    if (!f.driver_id) return toast.error("اختر السائق");
    try {
      const body = { plate: f.plate, model: f.model, driver_id: f.driver_id };
      if (initial?.id) await api.put(`/vehicles/${initial.id}`, body);
      else await api.post("/vehicles", body);
      toast.success(initial?.id ? "تم تحديث السيارة" : "تمت إضافة السيارة");
      qc.invalidateQueries();
      setF(EMPTY);
      onDone?.();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };
  return (
    <form onSubmit={submit} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="vehicle-form">
      <Field label="رقم اللوحة"><Input className="h-11" placeholder="بغ 123456" value={f.plate} onChange={set("plate")} required data-testid="vehicle-plate-input" /></Field>
      <Field label="نوع السيارة (اختياري)"><Input className="h-11" placeholder="مثال: ستاركس" value={f.model} onChange={set("model")} data-testid="vehicle-model-input" /></Field>
      <Field label="السائق">
        <SimpleSelect value={f.driver_id} onChange={(v) => setF({ ...f, driver_id: v })} placeholder={drivers.length ? "اختر السائق" : "أنشئ حساب سائق أولاً"} testId="vehicle-driver-select"
          options={drivers.map((d) => ({ value: d.id, label: `${d.name} - ${d.phone}` }))} />
      </Field>
      <div className="flex items-end">
        <Button type="submit" className="h-11 w-full font-bold gap-2" data-testid="vehicle-submit-button">
          <Plus className="h-4 w-4" /> {initial?.id ? "حفظ التعديلات" : "إضافة السيارة"}
        </Button>
      </div>
    </form>
  );
};

const VehicleCard = ({ v, onEdit }) => {
  const qc = useQueryClient();
  const remove = async () => {
    if (!window.confirm(`حذف السيارة ${v.plate}؟ سيتم إلغاء توزيع حجوزاتها.`)) return;
    await api.delete(`/vehicles/${v.id}`);
    toast.success("تم حذف السيارة");
    qc.invalidateQueries();
  };
  return (
    <div className="rounded-2xl border border-slate-200 p-4 hover:border-primary/40 transition-colors" data-testid={`vehicle-card-${v.id}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xl font-extrabold" data-testid="vehicle-plate">{v.plate}</div>
          <div className="text-xs text-muted-foreground">{v.model || "سيارة نقل"}</div>
        </div>
        <div className="flex gap-1">
          <Button size="icon" variant="ghost" onClick={onEdit} data-testid={`vehicle-edit-${v.id}`}><Pencil className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" onClick={remove} className="text-red-600" data-testid={`vehicle-delete-${v.id}`}><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>
      <div className="mt-3 text-sm font-bold">{v.driver_name}</div>
      <a href={`tel:${v.driver_phone}`} className="text-sm text-primary inline-flex items-center gap-1" dir="ltr"><Phone className="h-3.5 w-3.5" />{v.driver_phone}</a>
      <div className="mt-3 flex gap-1.5 text-xs">
        {[1, 3, 3].map((n, i) => (
          <span key={i} className="rounded-md bg-slate-100 px-2 py-1">صف {i + 1}: {n}</span>
        ))}
        <span className="rounded-md bg-blue-50 text-primary px-2 py-1 font-bold">{v.capacity} مقاعد</span>
      </div>
    </div>
  );
};

export const VehiclesSection = () => {
  const { data = [], isLoading } = useVehicles();
  const [edit, setEdit] = useState(null);
  return (
    <div className="space-y-6">
      <SectionCard title="إضافة سيارة" icon={Car} testId="vehicles-add-card"><VehicleForm /></SectionCard>
      <SectionCard title={`السيارات المسجلة (${data.length})`} testId="vehicles-list-card">
        {!isLoading && !data.length ? <Empty text="لا توجد سيارات بعد، أضف أول سيارة من النموذج أعلاه" testId="vehicles-empty" /> : (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {data.map((v) => <VehicleCard key={v.id} v={v} onEdit={() => setEdit({ id: v.id, plate: v.plate, model: v.model || "", driver_id: v.driver_id || "" })} />)}
          </div>
        )}
      </SectionCard>
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-w-3xl bg-white" dir="rtl">
          <DialogHeader><DialogTitle>تعديل السيارة</DialogTitle></DialogHeader>
          {edit && <VehicleForm initial={edit} onDone={() => setEdit(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
};
