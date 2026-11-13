import { useEffect, useRef, useState } from "react";
import { compressImage } from "../util";

// Live camera capture. Falls back to the phone camera / file picker if the browser blocks the camera.
export default function Camera({ label, facing = "user", onCapture }) {
  const [on, setOn] = useState(false);
  const [preview, setPreview] = useState("");
  const [err, setErr] = useState("");
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  async function start() {
    setErr("");
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing } });
      setOn(true);
    } catch {
      setErr("Camera blocked or not available. Use the 'Take photo' button below instead.");
    }
  }
  function stop() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setOn(false);
  }
  useEffect(() => {
    if (on && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [on]);
  useEffect(() => () => streamRef.current?.getTracks().forEach((t) => t.stop()), []);

  function done(blob) {
    setPreview(URL.createObjectURL(blob));
    onCapture(blob);
  }
  function snap() {
    const v = videoRef.current;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d").drawImage(v, 0, 0);
    c.toBlob(async (b) => { done(await compressImage(b)); stop(); }, "image/jpeg", 0.9);
  }
  async function fromFile(e) {
    const f = e.target.files[0];
    if (f) done(await compressImage(f));
  }

  return (
    <div className="camera">
      <label>{label}</label>
      {preview && !on && <img className="snap" src={preview} alt="captured" />}
      {on && <video ref={videoRef} playsInline muted />}
      <div className="row">
        {!on && <button type="button" className="btn sec sm" onClick={start}>{preview ? "Retake with camera" : "Open camera"}</button>}
        {on && <button type="button" className="btn sm" onClick={snap}>📸 Capture</button>}
        {on && <button type="button" className="btn gray sm" onClick={stop}>Cancel</button>}
        {!on && (
          <label className="btn gray sm" style={{ margin: 0 }}>
            Take photo
            <input type="file" accept="image/*" capture={facing === "user" ? "user" : "environment"} onChange={fromFile} hidden />
          </label>
        )}
      </div>
      {err && <div className="alert warn">{err}</div>}
    </div>
  );
}
