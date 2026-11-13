import { useEffect, useState } from "react";
import { api } from "../api";
import { badgeFor } from "../util";

export default function Leaderboard() {
  const [rows, setRows] = useState(null);
  useEffect(() => { api("/leaderboard", { auth: false }).then(setRows).catch(() => setRows([])); }, []);
  return (
    <div className="container" style={{ maxWidth: 720 }}>
      <h2>🏆 Top donors</h2>
      <p className="muted">Thank you to everyone who turned surplus food into meals.</p>
      <div className="card">
        {!rows ? <div className="center">Loading…</div> : rows.length === 0 ? <div className="muted">No completed donations yet. Be the first!</div> : (
          <table>
            <thead><tr><th>#</th><th>Donor</th><th>Badge</th><th>Donations</th><th>Kg</th></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}><td>{i + 1}</td><td><b>{r.name}</b></td><td>{badgeFor(r.donations).icon} {badgeFor(r.donations).name}</td><td>{r.donations}</td><td>{r.kg}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
