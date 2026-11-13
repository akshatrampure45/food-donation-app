import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, imgUrl } from "../api";
import Chat from "../components/Chat";
import ScanPanel from "../components/QRScanner";
import { STATUS } from "../components/RequestsList";
import { fmtDT, fmtPhone, timeLeft, toISO } from "../util";

function QRBlock({ id }) {
  const [qr, setQr] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => { api(`/requests/${id}/qr`).then(setQr).catch((e) => setErr(e.message)); }, [id]);
  if (err) return <div className="alert err">{err}</div>;
  if (!qr) return <div className="center">Loading QR…</div>;
  return (
    <div className="qr-box">
      <img src={`data:image/png;base64,${qr.qr_png_base64}`} alt="Donation QR" />
      <p className="muted">Show this QR to the recipient at pickup. It works <b>only once</b>.</p>
    </div>
  );
}

export default function RequestDetail() {
  const { id } = useParams();
  const [r, setR] = useState(null);
  const [err, setErr] = useState("");
  const [loc, setLoc] = useState("");
  const [when, setWhen] = useState("");

  const load = () => api(`/requests/${id}`).then(setR).catch((e) => setErr(e.message));
  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [id]);

  async function act(path, body) {
    setErr("");
    try { setR(await api(`/requests/${id}/${path}`, { method: "POST", body })); }
    catch (e) { setErr(e.message); }
  }

  if (!r) return <div className="container">{err ? <div className="alert err">{err}</div> : <div className="center">Loading…</div>}</div>;

  const [label, color] = STATUS[r.status];
  const me = r.my_role;
  const iApproved = me === "donor" ? r.donor_approved : r.recipient_approved;
  const otherApproved = me === "donor" ? r.recipient_approved : r.donor_approved;
  const l = r.listing;
  const contact = me === "donor" ? r.recipient_contact : r.donor_contact;

  return (
    <div className="container" style={{ maxWidth: 760 }}>
      <Link to={me === "donor" ? "/donor" : "/recipient"}>← Back</Link>
      <div className="card" style={{ marginTop: 10 }}>
        <div className="row spread"><h2 style={{ margin: 0 }}>{l.food_name}</h2><span className={`chip ${color}`}>{label}</span></div>
        <div className="row" style={{ alignItems: "flex-start", marginTop: 10 }}>
          <img src={imgUrl(l.photo)} alt="" style={{ width: 130, height: 110, objectFit: "cover", borderRadius: 8 }} />
          <div className="small">
            <div>{l.is_veg ? "🟢 Veg" : "🔴 Non-veg"} · {l.quantity_kg ? `${l.quantity_kg} kg` : ""} {l.servings ? `· ${l.servings} servings` : ""}</div>
            <div>Cooked: {fmtDT(l.cooked_at)}</div>
            <div style={{ color: "var(--warn)", fontWeight: 700 }}>Expires: {fmtDT(l.expires_at)} ({timeLeft(l.expires_at)})</div>
            <div>Donor: <b>{l.donor.name}</b> · NGO: <b>{r.recipient.org_name}</b></div>
            <div className="muted">Pickup: {l.pickup_address}</div>
          </div>
        </div>
        {r.note && <div className="alert dev small">Note: {r.note}</div>}
      </div>

      {err && <div className="alert err">{err}</div>}

      {r.status === "pending" && (
        <div className="card">
          {r.initiated_by_me ? <p>⏳ Waiting for the other side to accept…</p> : (
            <>
              <p>{r.initiated_by_role === "recipient" ? "This organisation wants your food." : "This donor is offering you food."} Accept to start chatting and see contact details.</p>
              <button className="btn" onClick={() => act("accept")}>Accept</button>{" "}
            </>
          )}
          <button className="btn danger" onClick={() => act("decline")}>{r.initiated_by_me ? "Cancel request" : "Decline"}</button>
        </div>
      )}

      {["negotiating", "approved", "completed"].includes(r.status) && contact && (
        <div className="card">
          <b>{me === "donor" ? "NGO contact" : "Donor contact"}</b>
          <div>{contact.name} · <a href={`tel:${fmtPhone(contact.phone)}`}>{fmtPhone(contact.phone)}</a> · {contact.email}</div>
        </div>
      )}

      {r.status === "negotiating" && (
        <div className="card">
          <h3>Agree on pickup</h3>
          {r.meeting_location ? (
            <div className="alert ok">
              📍 <b>{r.meeting_location}</b><br />🕒 {fmtDT(r.meeting_time)}<br />
              You: {iApproved ? "approved ✅" : "not yet"} · Other side: {otherApproved ? "approved ✅" : "not yet"}
            </div>
          ) : <p className="muted">Either side can propose a pickup place and time. Then both sides approve.</p>}
          {r.meeting_location && !iApproved && <button className="btn" onClick={() => act("approve")}>✅ Approve this pickup</button>}
          <details style={{ marginTop: 10 }} open={!r.meeting_location}>
            <summary style={{ cursor: "pointer", fontWeight: 600 }}>{r.meeting_location ? "Propose a different place/time" : "Propose place & time"}</summary>
            <label>Meeting / pickup location</label>
            <input value={loc} onChange={(e) => setLoc(e.target.value)} placeholder="e.g. Hotel main gate, Sitabuldi" />
            <label>Date & time</label>
            <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
            <div style={{ marginTop: 10 }}>
              <button className="btn sec" disabled={!loc || !when} onClick={() => act("propose", { meeting_location: loc, meeting_time: toISO(when) })}>Send proposal</button>
            </div>
          </details>
          <button className="btn danger sm" style={{ marginTop: 12 }} onClick={() => act("decline")}>Cancel this donation</button>
        </div>
      )}

      {r.status === "approved" && (
        <div className="card">
          <h3>✅ Pickup confirmed</h3>
          <div className="alert ok">📍 {r.meeting_location}<br />🕒 {fmtDT(r.meeting_time)}</div>
          {me === "donor" ? <QRBlock id={r.id} /> : (
            <>
              <p className="muted">At pickup, ask the donor to show their QR code and scan it here.</p>
              <ScanPanel onDone={load} />
            </>
          )}
          <button className="btn danger sm" style={{ marginTop: 12 }} onClick={() => act("decline")}>Cancel this donation</button>
        </div>
      )}

      {r.status === "completed" && (
        <div className="alert ok">🎉 Donation completed on {fmtDT(r.completed_at)}. The QR code is now permanently used. Thank you!</div>
      )}
      {r.status === "cancelled" && <div className="alert err">This request was cancelled.</div>}

      <div className="card">
        <h3>💬 Chat</h3>
        <Chat requestId={r.id} closed={!["pending", "negotiating", "approved"].includes(r.status)} />
      </div>
    </div>
  );
}
