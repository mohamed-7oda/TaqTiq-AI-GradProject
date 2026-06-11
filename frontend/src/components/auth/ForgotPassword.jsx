import React, { useState } from "react";
import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

export default function ForgotPassword({ onBack }) {
  const [email,   setEmail]   = useState("");
  const [status,  setStatus]  = useState("idle");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) { setStatus("error"); setMessage("Please enter your email address."); return; }
    setStatus("loading");
    setMessage("");
    try {
      const res = await axios.post(`${API_URL}/api/auth/forgot-password`, { email: email.trim().toLowerCase() });
      setStatus("success");
      setMessage(res.data.message);
    } catch (err) {
      setStatus("error");
      setMessage(err.response?.data?.error || "Something went wrong. Please try again.");
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <img src="/logo.png" alt="TaqTiq AI" className="auth-logo-img" />
        </div>

        <h2 className="auth-title">Forgot password?</h2>
        <p className="auth-subtitle">Enter your email and we'll send you a reset link.</p>

        {status === "success" ? (
          <div style={{ textAlign: "center", padding: "1.5rem 0" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>✉️</div>
            <div className="auth-success" style={{ marginBottom: "0.5rem" }}>{message}</div>
            <p style={{ color: "var(--text-dim)", fontSize: "0.82rem", marginTop: "0.5rem" }}>
              Check your inbox (and spam folder) for the reset link.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label className="form-label">Email address</label>
              <input
                type="email" className="form-input" placeholder="you@example.com"
                value={email} onChange={e => setEmail(e.target.value)}
                autoComplete="email" disabled={status === "loading"}
              />
            </div>
            {status === "error" && <div className="auth-error">{message}</div>}
            <button type="submit" className="auth-btn" disabled={status === "loading"}>
              {status === "loading" ? <span className="btn-spinner" /> : "Send Reset Link"}
            </button>
          </form>
        )}

        <p className="auth-switch" style={{ marginTop: "1.5rem" }}>
          <button className="auth-link" onClick={onBack}>← Back to Sign In</button>
        </p>
      </div>
    </div>
  );
}
