import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";

export default function Login({ onSwitch, onForgot }) {
  const { login } = useAuth();
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password) { setError("Please fill in all fields."); return; }
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
    } catch (err) {
      setError(err.response?.data?.error || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <img src="/logo.png" alt="TaqTiq AI" className="auth-logo-img" />
        </div>

        <h2 className="auth-title">Welcome Back</h2>
        <p className="auth-subtitle">Sign in to your TaqTiq AI account to continue.</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label className="form-label">Email address</label>
            <input
              type="email" className="form-input" placeholder="you@example.com"
              value={email} onChange={e => setEmail(e.target.value)}
              autoComplete="email" disabled={loading}
            />
          </div>

          <div className="form-group">
            <div className="form-label-row">
              <label className="form-label">Password</label>
              <button type="button" className="auth-forgot-link" onClick={onForgot}>
                Forgot password?
              </button>
            </div>
            <input
              type="password" className="form-input" placeholder="••••••••"
              value={password} onChange={e => setPassword(e.target.value)}
              autoComplete="current-password" disabled={loading}
            />
          </div>

          {error && <div className="auth-error">{error}</div>}

          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? <span className="btn-spinner" /> : "Sign In"}
          </button>
        </form>

        <hr className="auth-divider" />
        <p className="auth-switch">
          Don't have an account?{" "}
          <button className="auth-link" onClick={onSwitch}>Create one</button>
        </p>
      </div>
    </div>
  );
}
