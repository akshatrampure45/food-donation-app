import { useEffect, useRef, useState } from "react";
import { hasMapsKey, loadMaps } from "../maps";

// value = { lat, lng, address }.  onChange(newValue)
export default function LocationPicker({ value, onChange, label = "Location" }) {
  const mapEl = useRef(null);
  const markerRef = useRef(null);
  const mapRef = useRef(null);
  const geoRef = useRef(null);
  const valueRef = useRef(value);
  const changeRef = useRef(onChange);
  valueRef.current = value;
  changeRef.current = onChange;
  const [msg, setMsg] = useState("");
  const [query, setQuery] = useState("");

  function setPos(lat, lng, address) {
    changeRef.current({ lat, lng, address: address ?? valueRef.current.address ?? "" });
  }
  function reverse(lat, lng) {
    if (!geoRef.current) return setPos(lat, lng);
    geoRef.current.geocode({ location: { lat, lng } }, (r, s) =>
      setPos(lat, lng, s === "OK" && r[0] ? r[0].formatted_address : undefined));
  }

  useEffect(() => {
    if (!hasMapsKey) return;
    loadMaps().then((maps) => {
      if (!mapEl.current) return;
      const v = valueRef.current;
      const center = { lat: v.lat || 20.5937, lng: v.lng || 78.9629 };
      const map = new maps.Map(mapEl.current, { center, zoom: v.lat ? 15 : 5, streetViewControl: false, mapTypeControl: false });
      const marker = new maps.Marker({ map, position: v.lat ? center : null, draggable: true });
      geoRef.current = new maps.Geocoder();
      mapRef.current = map;
      markerRef.current = marker;
      marker.addListener("dragend", (e) => reverse(e.latLng.lat(), e.latLng.lng()));
      map.addListener("click", (e) => { marker.setPosition(e.latLng); reverse(e.latLng.lat(), e.latLng.lng()); });
    }).catch(() => setMsg("Google Maps could not load. Use 'My current location' or type the coordinates."));
  }, []);

  useEffect(() => {
    if (markerRef.current && value.lat != null && value.lng != null) {
      const p = { lat: value.lat, lng: value.lng };
      markerRef.current.setPosition(p);
      mapRef.current.setCenter(p);
      mapRef.current.setZoom(15);
    }
  }, [value.lat, value.lng]);

  function useMine() {
    setMsg("");
    if (!navigator.geolocation) return setMsg("Location is not supported in this browser.");
    navigator.geolocation.getCurrentPosition(
      (p) => reverse(p.coords.latitude, p.coords.longitude),
      () => setMsg("Could not get your location. Allow location access or pick it on the map."),
      { enableHighAccuracy: true, timeout: 12000 }
    );
  }
  function search() {
    if (!geoRef.current || !query.trim()) return;
    geoRef.current.geocode({ address: query }, (r, s) => {
      if (s === "OK" && r[0]) setPos(r[0].geometry.location.lat(), r[0].geometry.location.lng(), r[0].formatted_address);
      else setMsg("Address not found.");
    });
  }

  return (
    <div>
      <label>{label}</label>
      <div className="row" style={{ marginBottom: 8 }}>
        <button type="button" className="btn sec sm" onClick={useMine}>📍 My current location</button>
        {hasMapsKey && (
          <>
            <input style={{ flex: 1, minWidth: 160 }} placeholder="Search address…" value={query}
              onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), search())} />
            <button type="button" className="btn gray sm" onClick={search}>Search</button>
          </>
        )}
      </div>
      {hasMapsKey && <div ref={mapEl} className="map" style={{ height: 240 }} />}
      <input placeholder="Full address" value={value.address || ""} onChange={(e) => onChange({ ...value, address: e.target.value })} />
      {!hasMapsKey && (
        <div className="form-grid">
          <div><label>Latitude</label><input type="number" step="any" value={value.lat ?? ""} onChange={(e) => onChange({ ...value, lat: e.target.value === "" ? null : Number(e.target.value) })} /></div>
          <div><label>Longitude</label><input type="number" step="any" value={value.lng ?? ""} onChange={(e) => onChange({ ...value, lng: e.target.value === "" ? null : Number(e.target.value) })} /></div>
        </div>
      )}
      {value.lat != null && value.lng != null && <div className="muted small" style={{ marginTop: 4 }}>✅ Location set ({Number(value.lat).toFixed(4)}, {Number(value.lng).toFixed(4)})</div>}
      {msg && <div className="alert warn">{msg}</div>}
    </div>
  );
}
