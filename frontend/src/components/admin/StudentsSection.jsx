import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Users, Check, X, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SectionCard, Empty } from "@/components/admin/SectionCard";
import { StatusBadge } from "@/components/StatusBadge";
import { STUDENT_STATUS, GENDERS } from "@/lib/constants";
import { api, errMsg } from "@/lib/api";

const StudentRow = ({ s }) => {
  const qc = useQueryClient();
  const setStatus = async (status) => {
    try { await api.patch(`/students/${s.id}/status`, { status }); toast.success(status === "active" ? "تم تفعيل الحساب" : "تم تحديث الحالة"); qc.invalidateQueries(); } catch (err) { toast.error(errMsg(err)); }
  };
  return (
    <div className="rounded-xl border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3" data-testid={`student-row-${s.id}`}>
      <div>
        <div className="font-bold">{s.name} <span className="text-xs text-muted-foreground">({GENDERS[s.gender]})</span></div>
        <div className="text-sm text-muted-foreground"><span dir="ltr">{s.phone}</span> · {s.university}</div>
        {s.notes && <div className="text-xs text-amber-700">{s.notes}</div>}
      </div>
      <div className="flex items-center gap-2">
        <StatusBadge map={STUDENT_STATUS} status={s.status} testId={`student-status-${s.id}`} />
        {s.status !== "active" && <Button size="sm" className="gap-1" onClick={() => setStatus("active")} data-testid={`student-approve-${s.id}`}><Check className="h-4 w-4" /> تفعيل</Button>}
        {s.status === "pending" && <Button size="sm" variant="outline" className="gap-1 text-red-600" onClick={() => setStatus("rejected")} data-testid={`student-reject-${s.id}`}><X className="h-4 w-4" /> رفض</Button>}
        {s.status === "active" && <Button size="sm" variant="outline" className="gap-1" onClick={() => setStatus("pending")} data-testid={`student-suspend-${s.id}`}><RotateCcw className="h-4 w-4" /> إيقاف</Button>}
      </div>
    </div>
  );
};

export const StudentsSection = () => {
  const [tab, setTab] = useState("pending");
  const { data = [], isLoading } = useQuery({ queryKey: ["students", tab], queryFn: () => api.get("/students", { params: { status: tab } }).then((r) => r.data) });
  return (
    <SectionCard title="حسابات الطلاب" icon={Users} testId="students-card">
      <Tabs value={tab} onValueChange={setTab} dir="rtl" className="mb-4">
        <TabsList>
          <TabsTrigger value="pending" data-testid="students-tab-pending">طلبات جديدة</TabsTrigger>
          <TabsTrigger value="active" data-testid="students-tab-active">مفعلة</TabsTrigger>
          <TabsTrigger value="rejected" data-testid="students-tab-rejected">مرفوضة</TabsTrigger>
        </TabsList>
      </Tabs>
      {!isLoading && !data.length ? <Empty text="لا توجد حسابات في هذا القسم" testId="students-empty" /> : <div className="space-y-3">{data.map((s) => <StudentRow key={s.id} s={s} />)}</div>}
    </SectionCard>
  );
};
