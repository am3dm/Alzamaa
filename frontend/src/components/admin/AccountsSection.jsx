import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { UserCog, Check, X, Pencil, Trash2, Plus, Search, Car, Ban } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SectionCard, Empty } from "@/components/admin/SectionCard";
import { StatusBadge } from "@/components/StatusBadge";
import { Field, SimpleSelect } from "@/components/Field";
import { UniversityPicker } from "@/components/UniversityPicker";
import { STUDENT_STATUS, GENDERS } from "@/lib/constants";
import { api, errMsg } from "@/lib/api";

const ROLE_OPTIONS = [{ value: "student", label: "طالب" }, { value: "driver", label: "سائق" }];
const STATUS_OPTIONS = Object.entries(STUDENT_STATUS).map(([value, s]) => ({ value, label: s.label }));
const GENDER_OPTIONS = Object.entries(GENDERS).map(([value, label]) => ({ value, label }));
const EMPTY = { role: "student", name: "", phone: "", password: "", gender: "", university: "", notes: "", status: "active" };

export const useAccounts = (params) =>
  useQuery({ queryKey: ["accounts", params], queryFn: () => api.get("/accounts", { params }).then((r) => r.data) });

const AccountForm = ({ initial, onDone }) => {
  const [f, setF] = useState(initial);
  const qc = useQueryClient();
  const set = (patch) => setF({ ...f, ...patch });
  const editing = !!initial.id;
  const submit = async (e) => {
    e.preventDefault();
    try {
      const body = { ...f, password: f.password || null, gender: f.gender || null };
      if (editing) await api.put(`/accounts/${initial.id}`, body);
      else await api.post("/accounts", body);
      toast.success(editing ? "تم تحديث الحساب" : "تم إنشاء الحساب");
      qc.invalidateQueries();
      onDone();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };
  return (
    <form onSubmit={submit} className="grid sm:grid-cols-2 gap-4" data-testid="account-form">
      <Field label="نوع الحساب">
        {editing ? <div className="h-11 px-3 rounded-md border bg-slate-50 flex items-center font-bold">{f.role === "driver" ? "سائق" : "طالب"}</div> :
          <SimpleSelect value={f.role} onChange={(v) => set({ role: v })} options={ROLE_OPTIONS} testId="account-role-select" />}
      </Field>
      <Field label="الحالة"><SimpleSelect value={f.status} onChange={(v) => set({ status: v })} options={STATUS_OPTIONS} testId="account-status-select" /></Field>
      <Field label="الاسم الكامل"><Input className="h-11" value={f.name} onChange={(e) => set({ name: e.target.value })} required data-testid="account-name-input" /></Field>
      <Field label="رقم الهاتف (للدخول)"><Input dir="ltr" className="h-11" value={f.phone} onChange={(e) => set({ phone: e.target.value })} required data-testid="account-phone-input" /></Field>
      <Field label={editing ? "كلمة مرور جديدة (اتركها فارغة للإبقاء)" : "كلمة المرور"} className="sm:col-span-2">
        <Input type="text" dir="ltr" className="h-11" value={f.password} onChange={(e) => set({ password: e.target.value })} required={!editing} minLength={6} data-testid="account-password-input" />
      </Field>
      {f.role === "student" && (
        <>
          <Field label="الجنس"><SimpleSelect value={f.gender} onChange={(v) => set({ gender: v })} options={GENDER_OPTIONS} testId="account-gender-select" /></Field>
          <Field label="الجامعة"><UniversityPicker value={f.university} onChange={(v) => set({ university: v })} /></Field>
        </>
      )}
      <Field label="ملاحظات" className="sm:col-span-2"><Textarea value={f.notes || ""} onChange={(e) => set({ notes: e.target.value })} data-testid="account-notes-input" /></Field>
      <Button type="submit" className="h-11 font-bold sm:col-span-2" data-testid="account-submit-button">{editing ? "حفظ التعديلات" : "إنشاء الحساب"}</Button>
    </form>
  );
};

const AccountRow = ({ a, onEdit }) => {
  const qc = useQueryClient();
  const act = async (fn, msg) => {
    try { await fn(); toast.success(msg); qc.invalidateQueries(); } catch (err) { toast.error(errMsg(err)); }
  };
  const setStatus = (status) => act(() => api.put(`/accounts/${a.id}`, { ...a, password: null, status }), status === "active" ? "تم تفعيل الحساب" : "تم تحديث الحالة");
  return (
    <div className="rounded-xl border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3" data-testid={`account-row-${a.id}`}>
      <div>
        <div className="font-bold">{a.name} <span className="text-xs text-muted-foreground">({a.role === "driver" ? "سائق" : GENDERS[a.gender] || "طالب"})</span></div>
        <div className="text-sm text-muted-foreground"><span dir="ltr">{a.phone}</span>{a.university && ` · ${a.university}`}</div>
        {a.role === "driver" && <div className="text-xs text-primary flex items-center gap-1"><Car className="h-3 w-3" /> {a.vehicles?.length ? a.vehicles.join("، ") : "غير مرتبط بسيارة"}</div>}
        {a.notes && <div className="text-xs text-amber-700">{a.notes}</div>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge map={STUDENT_STATUS} status={a.status} testId={`account-status-${a.id}`} />
        {a.status !== "active" && <Button size="sm" className="gap-1" onClick={() => setStatus("active")} data-testid={`account-approve-${a.id}`}><Check className="h-4 w-4" /> تفعيل</Button>}
        {a.status === "pending" && <Button size="sm" variant="outline" className="gap-1 text-red-600" onClick={() => setStatus("rejected")} data-testid={`account-reject-${a.id}`}><X className="h-4 w-4" /> رفض</Button>}
        {a.status === "active" && <Button size="sm" variant="outline" className="gap-1" onClick={() => setStatus("rejected")} data-testid={`account-suspend-${a.id}`}><Ban className="h-4 w-4" /> إيقاف</Button>}
        <Button size="icon" variant="ghost" onClick={onEdit} data-testid={`account-edit-${a.id}`}><Pencil className="h-4 w-4" /></Button>
        <Button size="icon" variant="ghost" className="text-red-600" onClick={() => window.confirm(`حذف حساب ${a.name}؟`) && act(() => api.delete(`/accounts/${a.id}`), "تم حذف الحساب")} data-testid={`account-delete-${a.id}`}><Trash2 className="h-4 w-4" /></Button>
      </div>
    </div>
  );
};

const TABS = {
  students: { role: "student", status: "active" },
  drivers: { role: "driver" },
  requests: { role: "student", status: "pending" },
  inactive: { status: "rejected" },
};

export const AccountsSection = () => {
  const [tab, setTab] = useState("students");
  const [q, setQ] = useState("");
  const [dialog, setDialog] = useState(null);
  const { data = [], isLoading } = useAccounts(TABS[tab]);
  const { data: requests = [] } = useAccounts(TABS.requests);
  const { data: allDrivers = [] } = useAccounts(TABS.drivers);
  const pool = tab === "requests" ? [...data, ...allDrivers.filter((d) => d.status === "pending")] : data;
  const list = pool.filter((a) => !q || a.name.includes(q) || a.phone.includes(q));
  return (
    <SectionCard title="إدارة الحسابات" icon={UserCog} testId="accounts-card"
      action={<Button onClick={() => setDialog({ ...EMPTY, role: tab === "drivers" ? "driver" : "student" })} className="gap-2 font-bold" data-testid="new-account-button"><Plus className="h-4 w-4" /> إنشاء حساب</Button>}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <Tabs value={tab} onValueChange={setTab} dir="rtl">
          <TabsList>
            <TabsTrigger value="students" data-testid="accounts-tab-students">الطلاب</TabsTrigger>
            <TabsTrigger value="drivers" data-testid="accounts-tab-drivers">السائقون</TabsTrigger>
            <TabsTrigger value="requests" data-testid="accounts-tab-requests">طلبات جديدة {requests.length ? `(${requests.length})` : ""}</TabsTrigger>
            <TabsTrigger value="inactive" data-testid="accounts-tab-inactive">موقوفة</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative w-56">
          <Search className="absolute start-3 top-3 h-4 w-4 text-slate-400" />
          <Input className="h-10 ps-9" placeholder="بحث بالاسم أو الهاتف" value={q} onChange={(e) => setQ(e.target.value)} data-testid="accounts-search-input" />
        </div>
      </div>
      {!isLoading && !list.length ? <Empty text="لا توجد حسابات في هذا القسم" testId="accounts-empty" /> : <div className="space-y-3">{list.map((a) => <AccountRow key={a.id} a={a} onEdit={() => setDialog({ ...EMPTY, ...a, password: "" })} />)}</div>}
      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-w-2xl bg-white max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader><DialogTitle>{dialog?.id ? "تعديل الحساب" : "إنشاء حساب جديد"}</DialogTitle></DialogHeader>
          {dialog && <AccountForm key={dialog.id || "new"} initial={dialog} onDone={() => setDialog(null)} />}
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
};
