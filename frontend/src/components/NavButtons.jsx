import { Navigation, MapPin } from "lucide-react";
import { googleNav, wazeNav } from "@/lib/constants";

export const NavButtons = ({ location, testPrefix, large }) => {
  if (!location) return <span className="text-xs text-muted-foreground">لا يوجد موقع محفوظ</span>;
  const base = large ? "h-12 px-4 text-sm" : "h-8 px-3 text-xs";
  return (
    <div className="flex flex-wrap gap-2">
      <a href={googleNav(location)} target="_blank" rel="noreferrer" data-testid={`${testPrefix}-google-nav`}
        className={`${base} inline-flex items-center gap-1.5 rounded-lg bg-primary text-white font-bold hover:bg-blue-800 transition-colors`}>
        <Navigation className="h-4 w-4" /> Google Maps
      </a>
      <a href={wazeNav(location)} target="_blank" rel="noreferrer" data-testid={`${testPrefix}-waze-nav`}
        className={`${base} inline-flex items-center gap-1.5 rounded-lg bg-sky-100 text-sky-800 font-bold hover:bg-sky-200 transition-colors`}>
        <MapPin className="h-4 w-4" /> Waze
      </a>
    </div>
  );
};
