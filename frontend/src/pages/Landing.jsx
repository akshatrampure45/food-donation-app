import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";

export default function Landing() {
  const [s, setS] = useState(null);
  const { user } = useAuth();
  useEffect(() => { api("/stats", { auth: false }).then(setS).catch(() => {}); }, []);
  const home = user ? (user.role === "donor" ? "/donor" : user.role === "recipient" ? "/recipient" : "/admin") : "/signup";

  return (
    <>
      <div className="hero">
        <h1>Don't waste food. Share it with someone who needs it.</h1>
        <p>Hotels, restaurants, canteens, hostels and event hosts can instantly find nearby NGOs and food banks. NGOs can find nearby surplus food. Every donation is verified and tracked.</p>
        <div className="row" style={{ justifyContent: "center" }}>
          <Link to={home} className="btn sec big">{user ? "Go to dashboard" : "Get started"}</Link>
          {!user && <Link to="/login" className="btn big" style={{ background: "#14532d" }}>Login</Link>}
        </div>
      </div>
      {s && (
        <div className="stats">
          <div className="stat"><b>{s.donations}</b>Donations completed</div>
          <div className="stat"><b>{s.kg_saved}</b>Kg food saved</div>
          <div className="stat"><b>{s.servings}</b>Servings shared</div>
          <div className="stat"><b>{s.donors}</b>Donors</div>
          <div className="stat"><b>{s.organisations}</b>Verified NGOs</div>
        </div>
      )}
      <div className="container">
        <h2>How it works</h2>
        <div className="steps">
          <div className="card"><div className="step-n">1</div><b>Sign up & verify</b><p className="muted">Donors and NGOs verify phone, email and photos. NGOs are approved by our team using their registration number.</p></div>
          <div className="card"><div className="step-n">2</div><b>Post or find food</b><p className="muted">Donors post food with a live photo, cooking time and expiry time. NGOs see nearby food on the map.</p></div>
          <div className="card"><div className="step-n">3</div><b>Chat & agree on pickup</b><p className="muted">Both sides chat, choose a pickup place and time, and both approve.</p></div>
          <div className="card"><div className="step-n">4</div><b>Scan the QR</b><p className="muted">The donor shows a one-time QR. The NGO scans it. The donation is confirmed and the QR can never be reused.</p></div>
        </div>
        <h2 style={{ marginTop: 24 }}>Why donors love it</h2>
        <div className="card">🏅 Earn badges (First Giver, Food Hero, Hunger Fighter, Champion) · 🏆 Appear on the public leaderboard · 📊 See your personal impact: kg of food and servings shared.</div>
      </div>
    </>
  );
}
