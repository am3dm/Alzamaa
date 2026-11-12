import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Database, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api, errMsg } from "@/lib/api";

export const DemoDataBar = () => {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["demo"], queryFn: () => api.get("/demo").then((r) => r.data) });
  const run = async (fn, msg) => {
    try { const r = await fn(); toast.success(typeof msg === "function" ? msg(r.data) : msg); qc.invalidateQueries(); } catch (err) { toast.error(errMsg(err)); }
  };
  if (!data) return null;
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-4 flex flex-wrap items-center justify-between gap-3" data-testid="demo-data-bar">
      <div className="flex items-center gap-2 text-sm text-slate-600">
        <Database className="h-4 w-4 text-primary" />
        {data.exists ? "البيانات التجريبية مضافة (سيارتان، سائقان، 5 طلاب، حجوزات ورحلتان ليوم غد)." : "أضف بيانات تجريبية لتجربة النظام: سيارتان، سائقان، 5 طلاب، حجوزات موزعة ورحلتان."}
      </div>
      {data.exists ? (
        <Button variant="outline" size="sm" className="gap-1 text-red-600" data-testid="demo-delete-button"
          onClick={() => window.confirm("حذف كل البيانات التجريبية؟") && run(() => api.delete("/demo"), "تم حذف البيانات التجريبية")}>
          <Trash2 className="h-4 w-4" /> حذف البيانات التجريبية
        </Button>
      ) : (
        <Button size="sm" className="gap-1" data-testid="demo-seed-button" onClick={() => run(() => api.post("/demo/seed"), (d) => `تمت إضافة البيانات التجريبية ليوم ${d.date}`)}>
          <Database className="h-4 w-4" /> إضافة بيانات تجريبية
        </Button>
      )}
    </div>
  );
};
