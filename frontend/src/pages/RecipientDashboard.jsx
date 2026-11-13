import { useEffect, useState } from "react";
import { api, imgUrl } from "../api";
import { useAuth } from "../auth";
import LocationPicker from "../components/LocationPicker";
import MapView from "../components/MapView";
import RequestsList from "../components/RequestsList";
import ScanPanel from "../components/QRScanner";
import { Link } from "react-router-dom";
import { dirLink, fmtDT, timeLeft } from "../util";

function FindFood() {
  const { user } = useAuth();
  const p = user.recipient_profile;
  const [loc, setLoc] = useState({ lat: p.latitude, lng: p.longitude, address: p.address || "" });
  const [radius, setRadius] = useState(25);
  const [rows, setRows] = useState(null);
  const [msg, setMsg] = useState(null);

  const load = () => {
    if (loc.lat == null) return;
    api(`/listings/nearby?lat=${loc.lat}&lng=${loc.lng}&radius_km=${radius}`).then(setRows).catch(() => setRows([]));
  };
  useEffect(load, [loc.lat, loc.lng, radius]);

  async function request(id) {
    setMsg(null);
    try {
      await api("/requests", { method: "POST", body: { listing_id: id } });
      setMsg({ t: "ok", m: "Request sent to the donor. Check the 'My requests' tab." });
      load();
    } catch (e) { setMsg({ t: "err", m: e.message }); }
  }

  return (
    <>
      <div className="card">
        <LocationPicker label="Search around" value={loc} onChange={setLoc} />
        <label>Distance</label>
        <select style={{ maxWidth: 200 }} value={radius} onChange={(e) => setRadius(Number(e.target.value))}>
          {[5, 10, 25, 50, 100].map((r) => <option key={r} value={r}>{r} km</option>)}
        </select>
      </div>
      {msg && <div className={`alert ${msg.t}`}>{msg.m}</div>}
      <MapView center={loc} items={(rows || []).map((l) => ({ id: l.id, lat: l.latitude, lng: l.longitude, title: l.food_name }))} />
      {!rows ? <div className="center">Searching…</div> : rows.length === 0 ? <div className="card muted">No food available nearby right now. Try a bigger distance.</div> : (
        <div className="grid">
          {rows.map((l) => (
            <div className="card" key={l.id}>
              <img className="thumb" src={imgUrl(l.photo)} alt="" />
              <div className="row spread"><b>{l.food_name}</b><span className="chip blue">{l.distance_km} km</span></div>
              <div className="muted small">{l.donor.name} · {l.is_veg ? "🟢 Veg" : "🔴 Non-veg"}</div>
              <div className="muted small">{l.quantity_kg ? `${l.quantity_kg} kg` : ""} {l.servings ? `· ${l.servings} servings` : ""}</div>
              <div className="muted small">Cooked {fmtDT(l.cooked_at)}</div>
              <div className="small" style={{ color: "var(--warn)", fontWeight: 700 }}>Expires {fmtDT(l.expires_at)} ({timeLeft(l.expires_at)})</div>
              {l.description && <div className="small" style={{ marginTop: 4 }}>{l.description}</div>}
              <div className="row" style={{ marginTop: 8 }}>
                {l.my_request_id ? <Link className="btn sec sm" to={`/requests/${l.my_request_id}`}>View my request</Link>
                  : <button className="btn sm" onClick={() => request(l.id)}>Request this food</button>}
                <a className="btn gray sm" href={dirLink(l.latitude, l.longitude)} target="_blank" rel="noreferrer">Directions</a>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export default function RecipientDashboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState("find");
  const rp = user.recipient_profile;

  if (rp.approval_status !== "approved") {
    return (
      <div className="container">
        <h2>{rp.org_name}</h2>
        <div className={`alert ${rp.approval_status === "rejected" ? "err" : "warn"}`}>
          {rp.approval_status === "rejected"
            ? "Your organisation was not approved. Please contact support and check your registration number."
            : "⏳ Your organisation is waiting for approval. You will get a notification as soon as it is approved."}
        </div>
      </div>
    );
  }
  return (
    <div className="container">
      <h2>{rp.org_name}</h2>
      <div className="tabs">
        {[["find", "📍 Find food"], ["requests", "💬 My requests"], ["scan", "📷 Scan QR"]].map(([k, l]) => (
          <button key={k} className={`tab ${tab === k ? "on" : ""}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      {tab === "find" && <FindFood />}
      {tab === "requests" && <RequestsList />}
      {tab === "scan" && (
        <div className="card">
          <h3>Confirm a pickup</h3>
          <p className="muted">When you meet the donor, scan the QR code shown on their phone. Every QR works only once.</p>
          <ScanPanel />
        </div>
      )}
    </div>
  );
}
