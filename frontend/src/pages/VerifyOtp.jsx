import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../api";

function Box({ title, channel, email, dev, onVerified }) {
  const [code, setCode] = useState("");
  const [done, setDone] = useState(false);
  const [msg, setMsg] = useState(null);
  const [devOtp, setDevOtp] = useState(dev);

  async function verify() {
    setMsg(null);
    try {
      const d = await api("/auth/verify-otp", { method: "POST", body: { email, channel, code }, auth: false });
      setDone(true);
      onVerified(d);
    } catch (e) { setMsg({ t: "err", m: e.message }); }
  }
  async function resend() {
    setMsg(null);
    try {
      const d = await api("/auth/resend-otp", { method: "POST", body: { email, channel }, auth: false });
      setDevOtp(d.dev_otp);
      setMsg({ t: "ok", m: "New OTP sent." });
    } catch (e) { setMsg({ t: "err", m: e.message }); }
  }

  return (
    <div className="card">
      <b>{title}</b> {done && <span className="chip green">Verified ✓</span>}
      {!done && (
        <>
          {devOtp && <div className="alert dev">Test mode OTP: <b>{devOtp}</b></div>}
          <div className="row" style={{ marginTop: 8 }}>
            <input style={{ flex: 1, minWidth: 140 }} inputMode="numeric" maxLength={6} placeholder="6-digit OTP" value={code} onChange={(e) => setCode(e.target.value)} />
            <button className="btn" onClick={verify} disabled={code.length < 6}>Verify</button>
            <button className="btn gray" onClick={resend}>Resend</button>
          </div>
          {msg && <div className={`alert ${msg.t}`}>{msg.m}</div>}
        </>
      )}
    </div>
  );
}

export default function VerifyOtp() {
  const { state } = useLocation();
  const nav = useNavigate();
  const [email, setEmail] = useState(state?.email || "");
  const [started, setStarted] = useState(!!state?.email);
  const [flags, setFlags] = useState({ phone_verified: false, email_verified: false });

  function onVerified(d) {
    setFlags(d);
    if (d.phone_verified && d.email_verified) setTimeout(() => nav("/login", { state: { verified: true } }), 900);
  }

  if (!started) {
    return (
      <div className="container" style={{ maxWidth: 440 }}>
        <div className="card">
          <h2>Verify your account</h2>
          <label>Your registered email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <p className="muted small">Then press "Resend" on each box to get a fresh OTP.</p>
          <button className="btn" disabled={!email} onClick={() => setStarted(true)}>Continue</button>
        </div>
      </div>
    );
  }
  return (
    <div className="container" style={{ maxWidth: 520 }}>
      <h2>Verify your account</h2>
      <p className="muted">We sent one OTP to your phone and one to <b>{email}</b>. Both are needed.</p>
      <Box title="📱 Phone OTP" channel="phone" email={email} dev={state?.dev_otps?.phone} onVerified={onVerified} />
      <Box title="✉️ Email OTP" channel="email" email={email} dev={state?.dev_otps?.email} onVerified={onVerified} />
      {flags.phone_verified && flags.email_verified && <div className="alert ok">All verified! Redirecting to login…</div>}
    </div>
  );
}
