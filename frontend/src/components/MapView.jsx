import { MapContainer, TileLayer, CircleMarker } from "react-leaflet";

export const MapView = ({ location, testId }) => (
  <div className="aspect-video w-full overflow-hidden rounded-xl border border-slate-200" data-testid={testId}>
    <MapContainer center={[location.lat, location.lng]} zoom={15} className="h-full w-full" dragging={false} scrollWheelZoom={false} doubleClickZoom={false} zoomControl={false}>
      <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <CircleMarker center={[location.lat, location.lng]} radius={10} pathOptions={{ color: "#1D4ED8", fillOpacity: 0.7 }} />
    </MapContainer>
  </div>
);
