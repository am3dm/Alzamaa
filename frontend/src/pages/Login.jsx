import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Bus, Phone, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/Field";
import { useAuth, homeFor } from "@/context/AuthContext";
import { errMsg } from "@/lib/api";

const HERO = "https://images.unsplash.com/photo-1647702504702-6b3dc40eafe5?crop=entropy&cs=srgb&fm=jpg&q=80&w=1400";

export const AuthShell = ({ title, subtitle, children }) => (
  <div className="min-h-screen grid lg:grid-cols-[1fr_1.1fr] bg-white">
    <div className="flex flex-col justify-center px-6 sm:px-14 py-10 fade-up">
      <div className="flex items-center gap-3 mb-10">
        <div className="h-11 w-11 rounded-xl bg-primary text-white grid place-items-center"><Bus className="h-6 w-6" /></div>
        <div>
          <div className="font-extrabold text-lg">Noexis TMS</div>
          <div className="text-xs text-muted-foreground">نقل الطلاب بين بلد وبغداد</div>
        </div>
      </div>
      <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900">{title}</h1>
      <p className="text-muted-foreground mt-2 mb-8 text-base">{subtitle}</p>
      <div className="max-w-md w-full">{children}</div>
    </div>
    <div className="hidden lg:block relative">
      <img src={HERO} alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-blue-900/55" />
      <div className="absolute bottom-12 start-12 end-12 text-white">
        <div className="text-4xl font-extrabold leading-relaxed">كل مقعد في مكانه،<br />وكل طالب في موعده.</div>
        <div className="mt-3 text-blue-100">حجوزات، توزيع ذكي للمقاعد، ورحلات يومية بين بلد وبغداد.</div>
      </div>
    </div>
  </div>
);

export default function Login() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to={homeFor(user.role)} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const u = await login(phone.trim(), password);
      nav(homeFor(u.role));
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="تسجيل الدخول" subtitle="للإدارة والسائقين والطلاب برقم الهاتف وكلمة المرور">
      <form onSubmit={submit} className="space-y-5" data-testid="login-form">
        <Field label="رقم الهاتف">
          <div className="relative">
            <Phone className="absolute start-3 top-3.5 h-4 w-4 text-slate-400" />
            <Input dir="ltr" className="h-12 ps-9 text-start" value={phone} onChange={(e) => setPhone(e.target.value)} required data-testid="login-phone-input" />
          </div>
        </Field>
        <Field label="كلمة المرور">
          <div className="relative">
            <KeyRound className="absolute start-3 top-3.5 h-4 w-4 text-slate-400" />
            <Input type="password" dir="ltr" className="h-12 ps-9" value={password} onChange={(e) => setPassword(e.target.value)} required data-testid="login-password-input" />
          </div>
        </Field>
        <Button type="submit" disabled={loading} className="w-full h-12 text-base font-bold" data-testid="login-submit-button">
          {loading ? "جارِ الدخول..." : "دخول"}
        </Button>
      </form>
      <div className="mt-8 rounded-xl bg-blue-50 p-4 text-sm">
        طالب جديد؟{" "}
        <Link to="/register" className="font-bold text-primary hover:underline" data-testid="go-register-link">أرسل طلب فتح حساب</Link>
      </div>
    </AuthShell>
  );
}
