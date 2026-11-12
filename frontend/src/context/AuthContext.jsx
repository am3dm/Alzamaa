import { createContext, useContext, useEffect, useState } from "react";
import { api, TOKEN_KEY, storage } from "@/lib/api";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (!storage.get(TOKEN_KEY)) {
      setUser(false);
      return;
    }
    api.get("/auth/me").then((r) => setUser(r.data)).catch(() => {
      storage.remove(TOKEN_KEY);
      setUser(false);
    });
  }, []);

  const login = async (phone, password) => {
    const { data } = await api.post("/auth/login", { phone, password });
    storage.set(TOKEN_KEY, data.token);
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    storage.remove(TOKEN_KEY);
    setUser(false);
  };

  return <AuthContext.Provider value={{ user, setUser, login, logout }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);

export const homeFor = (role) => ({ admin: "/admin", driver: "/driver", student: "/student" }[role] || "/login");
