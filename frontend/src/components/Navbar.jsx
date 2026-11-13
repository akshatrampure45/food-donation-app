import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { api } from "../api";

export default function Navbar() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user) return;
    const load = () => api("/notifications").then((d) => setUnread(d.unread)).catch(() => {});
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [user]);

  const home = user ? (user.role === "donor" ? "/donor" : user.role === "recipient" ? "/recipient" : "/admin") : "/";
  return (
    <div className="nav">
      <div className="nav-in">
        <Link to="/" className="brand">🍲 FoodShare</Link>
        <div className="nav-links">
          <Link to="/leaderboard">🏅 Top donors</Link>
          {user ? (
            <>
              <Link to={home}>Dashboard</Link>
              <Link to="/notifications" className="bell">🔔{unread > 0 && <b>{unread}</b>}</Link>
              <span className="muted small">{user.name}</span>
              <button className="btn gray sm" onClick={() => { logout(); nav("/"); }}>Logout</button>
            </>
          ) : (
            <>
              <Link to="/login">Login</Link>
              <Link to="/signup" className="btn sm">Sign up</Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
