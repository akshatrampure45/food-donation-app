import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import Camera from "../components/Camera";
import LocationPicker from "../components/LocationPicker";
import { DONOR_TYPES } from "../util";

const BUSINESS = ["restaurant", "hotel", "hostel", "canteen"];

export default function Signup() {
  const [role, setRole] = useState("donor");
  const [f, setF] = useState({
    name: "", email: "", phone: "", password: "", donor_type: "individual", business_name: "",
    registration_number: "", event_details: "", org_name: "", contact_person: "",
  });
  const [loc, setLoc] = useState({ lat: null, lng: null, address: "" });
  const [photo, setPhoto] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setErr("");
    if (!photo) return setErr(role === "donor" ? "Please take a live selfie." : "Please add your organisation's photo.");
    if (loc.lat == null || loc.lng == null) return setErr("Please set your location (use 'My current location' or the map).");
    const fd = new FormData();
    fd.append("email", f.email); fd.append("phone", f.phone); fd.append("password", f.password);
    fd.append("address", loc.address || ""); fd.append("latitude", loc.lat); fd.append("longitude", loc.lng);
    if (role === "donor") {
      fd.append("name", f.name); fd.append("donor_type", f.donor_type);
      fd.append("business_name", f.business_name); fd.append("registration_number", f.registration_number);
      fd.append("event_details", f.event_details); fd.append("selfie", photo, "selfie.jpg");
    } else {
      fd.append("org_name", f.org_name); fd.append("contact_person", f.contact_person);
      fd.append("registration_number", f.registration_number); fd.append("org_photo", photo, "org.jpg");
    }
    setBusy(true);
    try {
      const d = await api(`/auth/signup/${role}`, { method: "POST", form: fd, auth: false });
      nav("/verify", { state: { email: d.email, dev_otps: d.dev_otps } });
    } catch (e2) { setErr(e2.message); }
    setBusy(false);
  }

  const isBusiness = BUSINESS.includes(f.donor_type);
  return (
    <div className="container" style={{ maxWidth: 700 }}>
      <div className="card">
        <h2>Create account</h2>
        <div className="tabs">
          <button type="button" className={`tab ${role === "donor" ? "on" : ""}`} onClick={() => { setRole("donor"); setPhoto(null); }}>🍽️ I want to donate food</button>
          <button type="button" className={`tab ${role === "recipient" ? "on" : ""}`} onClick={() => { setRole("recipient"); setPhoto(null); }}>🤝 We are an NGO / food bank</button>
        </div>
        <form onSubmit={submit}>
          <div className="form-grid">
            {role === "donor" ? (
              <>
                <div><label>Your full name</label><input required value={f.name} onChange={set("name")} /></div>
                <div>
                  <label>I am donating as</label>
                  <select value={f.donor_type} onChange={set("donor_type")}>{DONOR_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                </div>
                {isBusiness && (
                  <>
                    <div><label>Business name</label><input required value={f.business_name} onChange={set("business_name")} /></div>
                    <div><label>Registration / FSSAI / licence no.</label><input required value={f.registration_number} onChange={set("registration_number")} /></div>
                  </>
                )}
                {f.donor_type === "event" && (
                  <div style={{ gridColumn: "1 / -1" }}><label>Event details (name, date, organiser)</label><textarea required rows={2} value={f.event_details} onChange={set("event_details")} /></div>
                )}
              </>
            ) : (
              <>
                <div><label>Organisation name</label><input required value={f.org_name} onChange={set("org_name")} /></div>
                <div><label>Your name (contact person)</label><input required value={f.contact_person} onChange={set("contact_person")} /></div>
                <div style={{ gridColumn: "1 / -1" }}><label>Organisation registration number</label><input required value={f.registration_number} onChange={set("registration_number")} /></div>
              </>
            )}
            <div><label>Phone (OTP will be sent)</label><input required inputMode="tel" placeholder="10-digit mobile number" value={f.phone} onChange={set("phone")} /></div>
            <div><label>Email (OTP will be sent)</label><input type="email" required value={f.email} onChange={set("email")} /></div>
            <div><label>Password (min 8 characters)</label><input type="password" minLength={8} maxLength={64} required value={f.password} onChange={set("password")} /></div>
          </div>
          <hr className="hr" />
          {role === "donor"
            ? <Camera key="selfie" label="Live selfie (for verification)" facing="user" onCapture={setPhoto} />
            : <Camera key="org" label="Photo of your organisation / building" facing="environment" onCapture={setPhoto} />}
          <hr className="hr" />
          <LocationPicker label={role === "donor" ? "Your usual pickup location" : "Organisation location"} value={loc} onChange={setLoc} />
          {role === "recipient" && <div className="alert warn">NGO accounts are reviewed and approved by our team before you can see donors.</div>}
          {err && <div className="alert err">{err}</div>}
          <div style={{ marginTop: 14 }}><button className="btn big" disabled={busy}>{busy ? "Creating…" : "Sign up & send OTPs"}</button></div>
        </form>
        <p className="muted">Already registered? <Link to="/login">Login</Link></p>
      </div>
    </div>
  );
}
