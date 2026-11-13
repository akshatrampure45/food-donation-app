import { useEffect, useRef } from "react";
import { hasMapsKey, loadMaps } from "../maps";

// items = [{ id, lat, lng, title }]
export default function MapView({ center, items, onSelect }) {
  const el = useRef(null);
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;

  useEffect(() => {
    if (!hasMapsKey || !center?.lat) return;
    loadMaps().then((maps) => {
      if (!el.current) return;
      const map = new maps.Map(el.current, { center, zoom: 13, streetViewControl: false, mapTypeControl: false });
      new maps.Marker({
        map, position: center, title: "You",
        icon: { path: maps.SymbolPath.CIRCLE, scale: 8, fillColor: "#2563eb", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2 },
      });
      const bounds = new maps.LatLngBounds();
      bounds.extend(center);
      items.forEach((it) => {
        if (it.lat == null) return;
        const m = new maps.Marker({ map, position: { lat: it.lat, lng: it.lng }, title: it.title });
        m.addListener("click", () => selectRef.current && selectRef.current(it));
        bounds.extend({ lat: it.lat, lng: it.lng });
      });
      if (items.length > 1) map.fitBounds(bounds);
    }).catch(() => {});
  }, [JSON.stringify(items), center?.lat, center?.lng]);

  if (!hasMapsKey) return null;
  return <div ref={el} className="map" />;
}
