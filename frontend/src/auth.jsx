import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "./api";

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!localStorage.getItem("token")) { setUser(null); setLoading(false); return; }
    try { setUser(await api("/auth/me")); } catch { setUser(null); }
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const login = (token, u) => { localStorage.setItem("token", token); setUser(u); };
  const logout = () => { localStorage.removeItem("token"); setUser(null); };

  return <Ctx.Provider value={{ user, loading, login, logout, refresh }}>{children}</Ctx.Provider>;
}
