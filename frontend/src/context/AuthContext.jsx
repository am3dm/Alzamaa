import { createContext, useContext, useEffect, useState } from "react";
import { api, TOKEN_KEY } from "@/lib/api";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) {
      setUser(false);
      return;
    }
    api.get("/auth/me").then((r) => setUser(r.data)).catch(() => {
      localStorage.removeItem(TOKEN_KEY);
      setUser(false);
    });
  }, []);

  const login = async (phone, password) => {
    const { data } = await api.post("/auth/login", { phone, password });
    localStorage.setItem(TOKEN_KEY, data.token);
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(false);
  };

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);

export const homeFor = (role) => ({ admin: "/admin", driver: "/driver", student: "/student" }[role] || "/login");
