const BASE = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, "");

export const imgUrl = (p) => (!p ? "" : p.startsWith("http") ? p : BASE + p);

export async function api(path, { method = "GET", body, form, auth = true } = {}) {
  const headers = {};
  const token = localStorage.getItem("token");
  if (auth && token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form;
  else if (body) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(BASE + "/api" + path, { method, headers, body: payload });
  } catch {
    throw new Error("Cannot reach the server. Please check your internet / backend URL.");
  }
  let data = null;
  try { data = await res.json(); } catch { /* no body */ }
  if (!res.ok) {
    let msg = "Something went wrong";
    if (typeof data?.detail === "string") msg = data.detail;
    else if (Array.isArray(data?.detail)) msg = data.detail.map((d) => d.msg).join(", ");
    const err = new Error(msg);
    err.status = res.status;
    err.code = data?.code;
    if (res.status === 401 && auth) { localStorage.removeItem("token"); }
    throw err;
  }
  return data;
}
