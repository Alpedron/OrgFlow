import { createContext, useContext, useState, useEffect } from "react";
import { getMe } from "../services/api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);       // null = not loaded yet
  const [loading, setLoading] = useState(true);  // true while checking token

  // On mount, try to restore session from localStorage token
  useEffect(() => {
    const token = localStorage.getItem("orgflow_token");
    if (!token) {
      setLoading(false);
      return;
    }
    getMe()
      .then((u) => setUser(u))
      .catch(() => {
        // Token invalid/expired — clear it
        localStorage.removeItem("orgflow_token");
      })
      .finally(() => setLoading(false));
  }, []);

  function signIn(token, userData) {
    localStorage.setItem("orgflow_token", token);
    setUser(userData);
  }

  function signOut() {
    localStorage.removeItem("orgflow_token");
    setUser(null);
  }

  function updateUser(updates) {
    setUser((u) => ({ ...u, ...updates }));
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
