import { MapContainer, TileLayer, CircleMarker, useMapEvents, useMap } from "react-leaflet";
import { useEffect } from "react";
import { Crosshair, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BALAD_CENTER } from "@/lib/constants";
import { toast } from "sonner";

const ClickHandler = ({ onPick }) => {
  useMapEvents({ click: (e) => onPick({ lat: +e.latlng.lat.toFixed(6), lng: +e.latlng.lng.toFixed(6) }) });
  return null;
};

const Recenter = ({ value }) => {
  const map = useMap();
  useEffect(() => {
    if (value) map.setView([value.lat, value.lng], Math.max(map.getZoom(), 14));
  }, [value, map]);
  return null;
};

export const MapPicker = ({ value, onChange }) => {
  const locate = () => {
    if (!navigator.geolocation) return toast.error("المتصفح لا يدعم تحديد الموقع");
    navigator.geolocation.getCurrentPosition(
      (p) => onChange({ lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6) }),
      () => toast.error("تعذر تحديد موقعك الحالي"),
    );
  };
  return (
    <div className="space-y-2" data-testid="map-picker">
      <div className="aspect-video w-full overflow-hidden rounded-xl border border-slate-200">
        <MapContainer center={value ? [value.lat, value.lng] : BALAD_CENTER} zoom={13} className="h-full w-full">
          <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <ClickHandler onPick={onChange} />
          <Recenter value={value} />
          {value && <CircleMarker center={[value.lat, value.lng]} radius={10} pathOptions={{ color: "#1D4ED8", fillOpacity: 0.7 }} />}
        </MapContainer>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Button type="button" variant="secondary" size="sm" onClick={locate} className="gap-1" data-testid="map-locate-me">
          <Crosshair className="h-4 w-4" /> موقعي الحالي
        </Button>
        {value ? (
          <>
            <span className="text-slate-600" dir="ltr" data-testid="map-coords">{value.lat}, {value.lng}</span>
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)} data-testid="map-clear">
              <X className="h-4 w-4" /> مسح
            </Button>
          </>
        ) : (
          <span className="text-muted-foreground">اضغط على الخريطة لتحديد نقطة الالتقاط</span>
        )}
      </div>
    </div>
  );
};
