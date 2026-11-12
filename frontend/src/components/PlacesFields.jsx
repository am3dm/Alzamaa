import { Home, GraduationCap } from "lucide-react";
import { Input } from "@/components/ui/input";
import { MapPicker } from "@/components/MapPicker";
import { BALAD_CENTER, BAGHDAD_CENTER } from "@/lib/constants";

const Place = ({ icon: Icon, title, color, cls, value, address, onLoc, onAddr, center, testPrefix }) => (
  <div className={`rounded-2xl border p-4 space-y-3 ${cls}`} data-testid={`${testPrefix}-section`}>
    <div className={`flex items-center gap-2 font-bold ${color}`}><Icon className="h-4 w-4" /> {title}</div>
    <Input className="h-11 bg-white" placeholder="العنوان / أقرب نقطة دالة" value={address || ""} onChange={(e) => onAddr(e.target.value)} data-testid={`${testPrefix}-address-input`} />
    <MapPicker value={value} onChange={onLoc} center={center} testPrefix={`${testPrefix}-map`} color={color.includes("emerald") ? "#059669" : "#1D4ED8"} />
  </div>
);

export const PlacesFields = ({ value, onChange }) => {
  const set = (patch) => onChange({ ...value, ...patch });
  return (
    <div className="grid gap-4">
      <Place icon={Home} title="عنوان السكن (بلد)" color="text-primary" cls="border-blue-100 bg-blue-50/40" center={BALAD_CENTER}
        value={value.home_location} address={value.home_address} onLoc={(l) => set({ home_location: l })} onAddr={(a) => set({ home_address: a })} testPrefix="home" />
      <Place icon={GraduationCap} title="الجامعة (بغداد)" color="text-emerald-700" cls="border-emerald-100 bg-emerald-50/40" center={BAGHDAD_CENTER}
        value={value.uni_location} address={value.uni_address} onLoc={(l) => set({ uni_location: l })} onAddr={(a) => set({ uni_address: a })} testPrefix="uni" />
    </div>
  );
};
