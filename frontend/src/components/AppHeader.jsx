import { Bus, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";

const ROLE_LABEL = { admin: "مدير النظام", driver: "سائق", student: "طالب" };

export const AppHeader = ({ subtitle }) => {
  const { user, logout } = useAuth();
  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200" data-testid="app-header">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary text-white grid place-items-center">
            <Bus className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <div className="font-extrabold text-slate-900">Noexis TMS</div>
            <div className="text-xs text-muted-foreground">{subtitle}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-end leading-tight hidden sm:block">
            <div className="font-bold text-sm" data-testid="header-user-name">{user?.name}</div>
            <div className="text-xs text-muted-foreground" dir="ltr">{user?.phone} · {ROLE_LABEL[user?.role]}</div>
          </div>
          <Button variant="outline" size="sm" onClick={logout} data-testid="logout-button" className="gap-2">
            <LogOut className="h-4 w-4" /> خروج
          </Button>
        </div>
      </div>
    </header>
  );
};
