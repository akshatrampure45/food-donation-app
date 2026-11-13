import { useEffect, useState } from "react";
import { api, imgUrl } from "../api";
import { useAuth } from "../auth";
import Camera from "../components/Camera";
import LocationPicker from "../components/LocationPicker";
import MapView from "../components/MapView";
import RequestsList from "../components/RequestsList";
import { badgeFor, dirLink, fmtDT, timeLeft, toISO } from "../util";

function Impact() {
  const [i, setI] = useState(null);
  useEffect(() => { api("/me/impact").then(setI).catch(() => {}); }, []);
  if (!i) return null;
  const b = badgeFor(i.donations);
  return (
    <div className="card row spread" style={{ background: "#f0fdf4" }}>
      <div><div style={{ fontSize: 30 }}>{b.icon}</div><b>{b.name}</b>
        {b.next && <div className="muted small">{b.next - i.donations} more donation(s) to reach the next badge</div>}</div>
      <div className="row" style={{ gap: 26 }}>
        <div><b style={{ fontSize: 24 }}>{i.donations}</b><div className="muted small">donations</div></div>
        <div><b style={{ fontSize: 24 }}>{i.kg}</b><div className="muted small">kg shared</div></div>
        <div><b style={{ fontSize: 24 }}>{i.servings}</b><div className="muted small">servings</div></div>
      </div>
    </div>
  );
}

function CreateListing({ onCreated, onCancel }) {
  const { user } = useAuth();
  const p = user.donor_profile;
  const [f, setF] = useState({ food_name: "", description: "", quantity_kg: "", servings: "", is_veg: true, cooked_at: "", expires_at: "" });
  const [loc, setLoc] = useState({ lat: p.latitude, lng: p.longitude, address: p.address || "" });
  const [photo, setPhoto] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setErr("");
    if (!photo) return setErr("Please take a live photo of the food.");
    if (!f.quantity_kg && !f.servings) return setErr("Enter quantity in kg or number of servings.");
    const fd = new FormData();
    fd.append("food_name", f.food_name); fd.append("description", f.description);
    if (f.quantity_kg) fd.append("quantity_kg", f.quantity_kg);
    if (f.servings) fd.append("servings", f.servings);
    fd.append("is_veg", f.is_veg);
    fd.append("cooked_at", toISO(f.cooked_at)); fd.append("expires_at", toISO(f.expires_at));
    fd.append("pickup_address", loc.address || ""); fd.append("latitude", loc.lat); fd.append("longitude", loc.lng);
    fd.append("food_photo", photo, "food.jpg");
    setBusy(true);
    try { await api("/listings", { method: "POST", form: fd }); onCreated(); }
    catch (e2) { setErr(e2.message); }
    setBusy(false);
  }

  return (
    <form className="card" onSubmit={submit}>
      <h3>Post surplus food</h3>
      <div className="form-grid">
        <div><label>Food name</label><input required placeholder="e.g. Veg biryani" value={f.food_name} onChange={set("food_name")} /></div>
        <div><label>Type</label>
          <select value={f.is_veg ? "veg" : "nonveg"} onChange={(e) => setF({ ...f, is_veg: e.target.value === "veg" })}>
            <option value="veg">Vegetarian 🟢</option><option value="nonveg">Non-vegetarian 🔴</option>
          </select></div>
        <div><label>Quantity (kg)</label><input type="number" min="0" step="0.1" value={f.quantity_kg} onChange={set("quantity_kg")} /></div>
        <div><label>Servings (people)</label><input type="number" min="0" value={f.servings} onChange={set("servings")} /></div>
        <div><label>Cooked at</label><input type="datetime-local" required value={f.cooked_at} onChange={set("cooked_at")} /></div>
        <div><label>Best before / expires at</label><input type="datetime-local" required value={f.expires_at} onChange={set("expires_at")} /></div>
      </div>
      <label>Description (optional)</label>
      <textarea rows={2} placeholder="Ingredients, packaging, allergens…" value={f.description} onChange={set("description")} />
      <hr className="hr" />
      <Camera key="food" label="Live photo of the food" facing="environment" onCapture={setPhoto} />
      <hr className="hr" />
      <LocationPicker label="Pickup location" value={loc} onChange={setLoc} />
      <div className="alert warn small">Only post fresh, safe food. Details are checked by the NGO at pickup.</div>
      {err && <div className="alert err">{err}</div>}
      <div className="row"><button className="btn" disabled={busy}>{busy ? "Posting…" : "Post food"}</button>
        <button type="button" className="btn gray" onClick={onCancel}>Cancel</button></div>
    </form>
  );
}

function Listings() {
  const [rows, setRows] = useState(null);
  const [creating, setCreating] = useState(false);
  const load = () => api("/listings/mine").then(setRows).catch(() => setRows([]));
  useEffect(() => { load(); }, []);

  async function cancel(id) {
    if (!confirm("Cancel this listing?")) return;
    try { await api(`/listings/${id}/cancel`, { method: "POST" }); load(); } catch (e) { alert(e.message); }
  }
  const color = { available: "green", reserved: "blue", donated: "green", cancelled: "red", expired: "red" };

  if (creating) return <CreateListing onCancel={() => setCreating(false)} onCreated={() => { setCreating(false); load(); }} />;
  return (
    <>
      <button className="btn" onClick={() => setCreating(true)}>➕ Post surplus food</button>
      <div style={{ height: 14 }} />
      {!rows ? <div className="center">Loading…</div> : rows.length === 0 ? <div className="card muted">You haven't posted any food yet.</div> : (
        <div className="grid">
          {rows.map((l) => (
            <div className="card" key={l.id}>
              <img className="thumb" src={imgUrl(l.photo)} alt="" />
              <div className="row spread"><b>{l.food_name}</b><span className={`chip ${color[l.status]}`}>{l.status}</span></div>
              <div className="muted small">{l.is_veg ? "🟢 Veg" : "🔴 Non-veg"} · {l.quantity_kg ? `${l.quantity_kg} kg` : ""} {l.servings ? `· ${l.servings} servings` : ""}</div>
              <div className="muted small">Cooked {fmtDT(l.cooked_at)} · Expires {fmtDT(l.expires_at)}{l.status === "available" && ` (${timeLeft(l.expires_at)})`}</div>
              {l.status === "available" && <button className="btn danger sm" style={{ marginTop: 8 }} onClick={() => cancel(l.id)}>Cancel listing</button>}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function FindNGOs() {
  const { user } = useAuth();
  const p = user.donor_profile;
  const [loc, setLoc] = useState({ lat: p.latitude, lng: p.longitude, address: p.address || "" });
  const [radius, setRadius] = useState(25);
  const [ngos, setNgos] = useState(null);
  const [mine, setMine] = useState([]);
  const [offer, setOffer] = useState(null);
  const [listingId, setListingId] = useState("");
  const [msg, setMsg] = useState(null);

  useEffect(() => { api("/listings/mine").then((r) => setMine(r.filter((l) => l.status === "available"))).catch(() => {}); }, []);
  useEffect(() => {
    if (loc.lat == null) return;
    api(`/recipients/nearby?lat=${loc.lat}&lng=${loc.lng}&radius_km=${radius}`).then(setNgos).catch(() => setNgos([]));
  }, [loc.lat, loc.lng, radius]);

  async function sendOffer() {
    setMsg(null);
    try {
      await api("/requests", { method: "POST", body: { listing_id: Number(listingId), recipient_id: offer.id } });
      setMsg({ t: "ok", m: "Offer sent! Open the 'Requests' tab to chat once they accept." });
      setOffer(null);
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
      <MapView center={loc} items={(ngos || []).map((n) => ({ id: n.id, lat: n.latitude, lng: n.longitude, title: n.org_name }))} />
      {!ngos ? <div className="center">Searching…</div> : ngos.length === 0 ? <div className="card muted">No approved NGOs found in this area. Try a bigger distance.</div> : (
        <div className="grid">
          {ngos.map((n) => (
            <div className="card" key={n.id}>
              <img className="thumb" src={imgUrl(n.photo)} alt="" style={{ height: 120 }} />
              <div className="row spread"><b>{n.org_name}</b><span className="chip blue">{n.distance_km} km</span></div>
              <div className="muted small">{n.address}</div>
              <div className="row" style={{ marginTop: 8 }}>
                <button className="btn sm" onClick={() => { setOffer(n); setListingId(mine[0]?.id || ""); }}>Offer food</button>
                <a className="btn sec sm" href={dirLink(n.latitude, n.longitude)} target="_blank" rel="noreferrer">Directions</a>
              </div>
            </div>
          ))}
        </div>
      )}
      {offer && (
        <div className="card" style={{ position: "fixed", left: 12, right: 12, bottom: 12, maxWidth: 520, margin: "0 auto", boxShadow: "0 8px 30px rgba(0,0,0,.25)", zIndex: 30 }}>
          <b>Offer food to {offer.org_name}</b>
          {mine.length === 0 ? <p className="muted">Post surplus food first (Listings tab), then offer it here.</p> : (
            <>
              <label>Choose your food listing</label>
              <select value={listingId} onChange={(e) => setListingId(e.target.value)}>
                {mine.map((l) => <option key={l.id} value={l.id}>{l.food_name} ({timeLeft(l.expires_at)})</option>)}
              </select>
            </>
          )}
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn" disabled={!listingId} onClick={sendOffer}>Send offer</button>
            <button className="btn gray" onClick={() => setOffer(null)}>Close</button>
          </div>
        </div>
      )}
    </>
  );
}

export default function DonorDashboard() {
  const [tab, setTab] = useState("listings");
  return (
    <div className="container">
      <h2>Donor dashboard</h2>
      <Impact />
      <div className="tabs">
        {[["listings", "🍲 My food"], ["ngos", "📍 Find NGOs"], ["requests", "💬 Requests"]].map(([k, l]) => (
          <button key={k} className={`tab ${tab === k ? "on" : ""}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      {tab === "listings" && <Listings />}
      {tab === "ngos" && <FindNGOs />}
      {tab === "requests" && <RequestsList />}
    </div>
  );
}
