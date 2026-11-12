import { useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Field, SimpleSelect } from "@/components/Field";
import { UniversityPicker } from "@/components/UniversityPicker";
import { AuthShell } from "@/pages/Login";
import { GENDERS } from "@/lib/constants";
import { api, errMsg } from "@/lib/api";

const EMPTY = { name: "", phone: "", password: "", gender: "", university: "", notes: "" };

const Done = () => (
  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center" data-testid="register-success">
    <CheckCircle2 className="h-10 w-10 text-emerald-600 mx-auto" />
    <div className="font-bold mt-3 text-lg">تم إرسال طلب الحساب</div>
    <p className="text-sm text-slate-600 mt-1">ستقوم الإدارة بمراجعة الطلب وتفعيل حسابك، بعدها يمكنك الدخول ومتابعة رحلاتك.</p>
    <Link to="/login" className="inline-block mt-4 font-bold text-primary" data-testid="register-back-login">العودة لتسجيل الدخول</Link>
  </div>
);

export default function Register() {
  const [f, setF] = useState(EMPTY);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const set = (patch) => setF({ ...f, ...patch });

  const submit = async (e) => {
    e.preventDefault();
    if (!f.gender || !f.university) return toast.error("اختر الجنس والجامعة");
    setLoading(true);
    try {
      await api.post("/auth/register", { ...f, phone: f.phone.trim() });
      setDone(true);
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="طلب فتح حساب طالب" subtitle="املأ بياناتك وسيتم تفعيل الحساب من قبل الإدارة">
      {done ? <Done /> : (
        <form onSubmit={submit} className="space-y-4" data-testid="register-form">
          <Field label="الاسم الكامل">
            <Input className="h-11" value={f.name} onChange={(e) => set({ name: e.target.value })} required data-testid="register-name-input" />
          </Field>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="رقم الهاتف">
              <Input dir="ltr" className="h-11" value={f.phone} onChange={(e) => set({ phone: e.target.value })} required data-testid="register-phone-input" />
            </Field>
            <Field label="كلمة المرور (6 أحرف على الأقل)">
              <Input type="password" dir="ltr" className="h-11" minLength={6} value={f.password} onChange={(e) => set({ password: e.target.value })} required data-testid="register-password-input" />
            </Field>
          </div>
          <Field label="الجنس">
            <SimpleSelect value={f.gender} onChange={(v) => set({ gender: v })} options={Object.entries(GENDERS).map(([value, label]) => ({ value, label }))} testId="register-gender-select" />
          </Field>
          <Field label="الجامعة">
            <UniversityPicker value={f.university} onChange={(v) => set({ university: v })} />
          </Field>
          <Field label="ملاحظات (اختياري)">
            <Textarea value={f.notes} onChange={(e) => set({ notes: e.target.value })} data-testid="register-notes-input" />
          </Field>
          <Button type="submit" disabled={loading} className="w-full h-12 font-bold" data-testid="register-submit-button">
            {loading ? "جارِ الإرسال..." : "إرسال الطلب"}
          </Button>
          <div className="text-sm text-center">
            لديك حساب؟ <Link to="/login" className="font-bold text-primary" data-testid="go-login-link">تسجيل الدخول</Link>
          </div>
        </form>
      )}
    </AuthShell>
  );
}
