import { useEffect, useRef, useState } from "react";
import { api } from "../api";

export default function Chat({ requestId, closed }) {
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const box = useRef(null);

  async function load() {
    try { setMsgs(await api(`/requests/${requestId}/messages`)); } catch { /* ignore */ }
  }
  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [requestId]);
  useEffect(() => { if (box.current) box.current.scrollTop = box.current.scrollHeight; }, [msgs.length]);

  async function send(e) {
    e.preventDefault();
    if (!text.trim()) return;
    setErr("");
    try {
      await api(`/requests/${requestId}/messages`, { method: "POST", body: { body: text } });
      setText("");
      load();
    } catch (e2) { setErr(e2.message); }
  }

  return (
    <div>
      <div className="chat" ref={box}>
        {msgs.length === 0 && <div className="muted">No messages yet. Say hello 👋</div>}
        {msgs.map((m) => <div key={m.id} className={`msg ${m.mine ? "mine" : ""}`}>{m.body}</div>)}
      </div>
      {!closed && (
        <form className="row" onSubmit={send}>
          <input style={{ flex: 1 }} placeholder="Type a message…" value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} />
          <button className="btn">Send</button>
        </form>
      )}
      {err && <div className="alert err">{err}</div>}
    </div>
  );
}
