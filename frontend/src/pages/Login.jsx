import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [notVerified, setNotVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const { login } = useAuth();
  const nav = useNavigate();
  const { state } = useLocation();

  async function submit(e) {
    e.preventDefault();
    setErr(""); setNotVerified(false); setBusy(true);
    try {
      const d = await api("/auth/login", { method: "POST", body: { email, password }, auth: false });
      login(d.token, d.user);
      nav(d.user.role === "donor" ? "/donor" : d.user.role === "recipient" ? "/recipient" : "/admin");
    } catch (e2) {
      setErr(e2.message);
      if (e2.code === "NOT_VERIFIED") setNotVerified(true);
    }
    setBusy(false);
  }

  return (
    <div className="container" style={{ maxWidth: 440 }}>
      <div className="card">
        <h2>Login</h2>
        {state?.verified && <div className="alert ok">✅ Verified! You can log in now.</div>}
        <form onSubmit={submit}>
          <label>Email</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <label>Password</label>
          <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          {err && <div className="alert err">{err}</div>}
          {notVerified && <Link to="/verify" state={{ email }}>Verify my phone and email →</Link>}
          <div style={{ marginTop: 14 }}><button className="btn" disabled={busy}>{busy ? "Please wait…" : "Login"}</button></div>
        </form>
        <p className="muted">New here? <Link to="/signup">Create an account</Link></p>
      </div>
    </div>
  );
}
