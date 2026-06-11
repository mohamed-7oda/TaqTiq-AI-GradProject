import React, { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";

const AuthContext = createContext(null);
const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [token,   setToken]   = useState(null);
  const [loading, setLoading] = useState(true);

  // Auto-set Authorization header whenever token changes
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common["Authorization"];
    }
  }, [token]);

  // Global 401 interceptor — expired/invalid token → force logout
  useEffect(() => {
    const id = axios.interceptors.response.use(
      (res) => res,
      (err) => {
        if (err.response?.status === 401) {
          localStorage.removeItem("auth_token");
          localStorage.removeItem("auth_user");
          setToken(null);
          setUser(null);
        }
        return Promise.reject(err);
      }
    );
    return () => axios.interceptors.response.eject(id);
  }, []);

  useEffect(() => {
    const savedToken = localStorage.getItem("auth_token");
    const savedUser  = localStorage.getItem("auth_user");
    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem("auth_token");
        localStorage.removeItem("auth_user");
      }
    }
    setLoading(false);
  }, []);

  const _persist = (t, u) => {
    setToken(t); setUser(u);
    localStorage.setItem("auth_token", t);
    localStorage.setItem("auth_user", JSON.stringify(u));
  };

  const login = async (email, password) => {
    const res = await axios.post(`${API_URL}/api/auth/login`, { email, password });
    _persist(res.data.token, res.data.user);
    return res.data.user;
  };

  const register = async (fullName, email, password) => {
    const res = await axios.post(`${API_URL}/api/auth/register`, { fullName, email, password });
    _persist(res.data.token, res.data.user);
    return res.data.user;
  };

  const logout = async () => {
    try {
      if (token)
        await axios.post(`${API_URL}/api/auth/logout`, {},
          { headers: { Authorization: `Bearer ${token}` } });
    } catch (_) {}
    setToken(null); setUser(null);
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
  };

  // Call after profile save to keep the displayed name in sync.
  const refreshUser = async () => {
    if (!token) return;
    try {
      const res = await axios.get(`${API_URL}/api/auth/me`,
        { headers: { Authorization: `Bearer ${token}` } });
      const updated = res.data;
      setUser(updated);
      localStorage.setItem("auth_user", JSON.stringify(updated));
    } catch (_) {}
  };

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, refreshUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
