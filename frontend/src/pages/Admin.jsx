import { useEffect, useState } from "react";
import { api, imgUrl } from "../api";

export default function Admin() {
  const [status, setStatus] = useState("pending");
  const [rows, setRows] = useState(null);
  const load = () => api(`/admin/recipients?status=${status}`).then(setRows).catch(() => setRows([]));
  useEffect(() => { setRows(null); load(); }, [status]);

  async function decide(profileId, action) {
    try { await api(`/admin/recipients/${profileId}/${action}`, { method: "POST" }); load(); } catch (e) { alert(e.message); }
  }

  return (
    <div className="container">
      <h2>Admin: NGO verification</h2>
      <div className="tabs">
        {["pending", "approved", "rejected"].map((s) => (
          <button key={s} className={`tab ${status === s ? "on" : ""}`} onClick={() => setStatus(s)}>{s}</button>
        ))}
      </div>
      {!rows ? <div className="center">Loading…</div> : rows.length === 0 ? <div className="card muted">Nothing here.</div> : (
        <div className="grid">
          {rows.map((u) => {
            const p = u.recipient_profile;
            return (
              <div className="card" key={u.id}>
                <a href={imgUrl(p.org_photo)} target="_blank" rel="noreferrer"><img className="thumb" src={imgUrl(p.org_photo)} alt="" /></a>
                <b>{p.org_name}</b>
                <div className="small">Reg. no: <b>{p.registration_number}</b></div>
                <div className="small">Contact: {p.contact_person} · +{u.phone} · {u.email}</div>
                <div className="muted small">{p.address}</div>
                <div className="row" style={{ marginTop: 8 }}>
                  {status !== "approved" && <button className="btn sm" onClick={() => decide(p.id, "approve")}>Approve</button>}
                  {status !== "rejected" && <button className="btn danger sm" onClick={() => decide(p.id, "reject")}>Reject</button>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
