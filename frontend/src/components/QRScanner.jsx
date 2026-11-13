import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { api } from "../api";

function Scanner({ onResult, onClose }) {
  const [err, setErr] = useState("");
  const scanner = useRef(null);

  useEffect(() => {
    let finished = false;
    const s = new Html5Qrcode("qr-reader");
    scanner.current = s;
    s.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 240, height: 240 } },
      (text) => {
        if (finished) return;
        finished = true;
        s.stop().catch(() => {}).finally(() => onResult(text));
      },
      () => {}
    ).catch(() => setErr("Camera permission is needed to scan the QR code."));
    return () => { try { if (s.isScanning) s.stop().catch(() => {}); } catch { /* ignore */ } };
  }, []);

  return (
    <div style={{ textAlign: "center" }}>
      <div id="qr-reader" />
      {err && <div className="alert err">{err}</div>}
      <button className="btn gray sm" onClick={onClose}>Cancel</button>
    </div>
  );
}

// Recipient scans the donor's QR. On success -> onDone()
export default function ScanPanel({ onDone }) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState(null);

  async function handle(text) {
    setOpen(false);
    if (!text.startsWith("FDP:")) return setMsg({ t: "err", m: "This is not a donation QR code." });
    try {
      await api("/requests/scan", { method: "POST", body: { token: text.slice(4) } });
      setMsg({ t: "ok", m: "✅ Donation confirmed! The donor has been notified. Thank you!" });
      onDone && onDone();
    } catch (e) {
      setMsg({ t: "err", m: e.message });
    }
  }

  return (
    <div>
      {!open && <button className="btn big" onClick={() => { setMsg(null); setOpen(true); }}>📷 Scan donor's QR code</button>}
      {open && <Scanner onResult={handle} onClose={() => setOpen(false)} />}
      {msg && <div className={`alert ${msg.t}`}>{msg.m}</div>}
    </div>
  );
}
