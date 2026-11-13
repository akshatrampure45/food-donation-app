import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, imgUrl } from "../api";
import { fmtDT } from "../util";

export const STATUS = {
  pending: ["Waiting for reply", "orange"], negotiating: ["Chatting", "blue"],
  approved: ["Pickup confirmed", "green"], completed: ["Completed ✅", "green"], cancelled: ["Cancelled", "red"],
};

export default function RequestsList() {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    const load = () => api("/requests").then(setRows).catch(() => setRows([]));
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, []);

  if (!rows) return <div className="center">Loading…</div>;
  if (rows.length === 0) return <div className="card muted">No requests yet.</div>;
  return (
    <div className="grid">
      {rows.map((r) => {
        const [label, color] = STATUS[r.status];
        return (
          <Link to={`/requests/${r.id}`} key={r.id} className="card" style={{ color: "inherit" }}>
            <img className="thumb" src={imgUrl(r.listing.photo)} alt="" style={{ height: 110 }} />
            <div className="row spread"><b>{r.listing.food_name}</b><span className={`chip ${color}`}>{label}</span></div>
            <div className="muted small">
              {r.my_role === "donor" ? `NGO: ${r.recipient.org_name}` : `Donor: ${r.listing.donor.name}`}
            </div>
            <div className="muted small">Requested {fmtDT(r.created_at)}</div>
            {r.status === "pending" && !r.initiated_by_me && <div className="chip orange" style={{ marginTop: 6 }}>Needs your reply</div>}
          </Link>
        );
      })}
    </div>
  );
}
