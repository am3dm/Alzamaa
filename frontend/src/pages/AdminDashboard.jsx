import { useState } from "react";
import { Car, ClipboardList, MapPinned, Route, UserCog } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { StatsBar } from "@/components/admin/StatsBar";
import { VehiclesSection } from "@/components/admin/VehiclesSection";
import { BookingsSection } from "@/components/admin/BookingsSection";
import { DispatchSection } from "@/components/admin/DispatchSection";
import { TripsSection } from "@/components/admin/TripsSection";
import { AccountsSection } from "@/components/admin/AccountsSection";

const TABS = [
  { key: "vehicles", label: "السيارات", icon: Car, C: VehiclesSection },
  { key: "bookings", label: "الحجوزات", icon: ClipboardList, C: BookingsSection },
  { key: "dispatch", label: "التوزيع", icon: MapPinned, C: DispatchSection },
  { key: "trips", label: "الرحلات", icon: Route, C: TripsSection },
  { key: "accounts", label: "إدارة الحسابات", icon: UserCog, C: AccountsSection },
];

export default function AdminDashboard() {
  const [tab, setTab] = useState("vehicles");
  const Active = TABS.find((t) => t.key === tab).C;
  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader subtitle="لوحة الإدارة" />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 lg:grid lg:grid-cols-[220px_1fr] lg:gap-8">
        <nav className="flex lg:flex-col gap-2 overflow-x-auto pb-3 lg:pb-0 lg:sticky lg:top-24 lg:self-start" data-testid="admin-nav">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key)} data-testid={`nav-${key}`}
              className={`shrink-0 flex items-center gap-3 rounded-xl px-4 h-12 font-bold transition-colors ${tab === key ? "bg-primary text-white shadow-sm" : "bg-white text-slate-600 hover:bg-blue-50 border border-slate-200"}`}>
              <Icon className="h-5 w-5" /> {label}
            </button>
          ))}
        </nav>
        <main className="space-y-6 min-w-0">
          <StatsBar />
          <div key={tab} className="fade-up"><Active /></div>
        </main>
      </div>
    </div>
  );
}
