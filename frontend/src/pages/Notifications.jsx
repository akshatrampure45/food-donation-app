import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { fmtDT } from "../util";

export default function Notifications() {
  const [d, setD] = useState(null);
  useEffect(() => {
    api("/notifications").then((x) => { setD(x); if (x.unread) api("/notifications/read-all", { method: "POST" }).catch(() => {}); }).catch(() => setD({ items: [] }));
  }, []);
  if (!d) return <div className="center">Loading…</div>;
  return (
    <div className="container" style={{ maxWidth: 720 }}>
      <h2>🔔 Notifications</h2>
      {d.items.length === 0 && <div className="card muted">Nothing yet.</div>}
      {d.items.map((n) => {
        const inner = (
          <div className={`card notif ${n.is_read ? "" : "unread"}`}>
            <b>{n.title}</b>
            {n.body && <div className="small">{n.body}</div>}
            <div className="muted small">{fmtDT(n.created_at)}</div>
          </div>
        );
        return n.link ? <Link key={n.id} to={n.link} style={{ color: "inherit" }}>{inner}</Link> : <div key={n.id}>{inner}</div>;
      })}
    </div>
  );
}
