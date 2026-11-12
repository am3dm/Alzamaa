import { useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/Field";
import { useAuth } from "@/context/AuthContext";
import { api, errMsg } from "@/lib/api";

const SettingsForm = ({ onDone }) => {
  const { user, setUser } = useAuth();
  const [f, setF] = useState({ name: user.name, phone: user.phone, email: user.email || "", current_password: "", new_password: "", confirm: "" });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    if (f.new_password && f.new_password !== f.confirm) return toast.error("تأكيد كلمة المرور غير مطابق");
    try {
      const { confirm, ...body } = f;
      const { data } = await api.put("/auth/me", { ...body, new_password: body.new_password || null });
      setUser(data);
      toast.success("تم حفظ بيانات الحساب");
      onDone();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };
  return (
    <form onSubmit={submit} className="grid sm:grid-cols-2 gap-4" data-testid="admin-settings-form">
      <Field label="الاسم"><Input className="h-11" value={f.name} onChange={set("name")} required data-testid="settings-name-input" /></Field>
      <Field label="رقم الهاتف (للدخول)"><Input dir="ltr" className="h-11" value={f.phone} onChange={set("phone")} required data-testid="settings-phone-input" /></Field>
      <Field label="البريد الإلكتروني (اختياري)" className="sm:col-span-2"><Input dir="ltr" type="email" className="h-11" value={f.email} onChange={set("email")} data-testid="settings-email-input" /></Field>
      <Field label="كلمة المرور الجديدة (اختياري)"><Input dir="ltr" type="password" minLength={6} className="h-11" value={f.new_password} onChange={set("new_password")} data-testid="settings-new-password-input" /></Field>
      <Field label="تأكيد كلمة المرور الجديدة"><Input dir="ltr" type="password" className="h-11" value={f.confirm} onChange={set("confirm")} data-testid="settings-confirm-password-input" /></Field>
      <Field label="كلمة المرور الحالية (مطلوبة للحفظ)" className="sm:col-span-2"><Input dir="ltr" type="password" className="h-11" value={f.current_password} onChange={set("current_password")} required data-testid="settings-current-password-input" /></Field>
      <Button type="submit" className="h-11 font-bold sm:col-span-2" data-testid="settings-submit-button">حفظ</Button>
    </form>
  );
};

export const AdminSettingsDialog = ({ open, onClose }) => (
  <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
    <DialogContent className="max-w-xl bg-white" dir="rtl">
      <DialogHeader><DialogTitle>إعدادات حساب الأدمن</DialogTitle></DialogHeader>
      {open && <SettingsForm onDone={onClose} />}
    </DialogContent>
  </Dialog>
);
