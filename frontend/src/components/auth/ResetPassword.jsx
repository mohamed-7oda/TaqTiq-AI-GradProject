import React, { useState } from "react";
import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

export default function ResetPassword({ token, onDone }) {
  const [password, setPassword] = useState("");
  const [confirm,  setConfirm]  = useState("");
  const [showPass, setShowPass] = useState(false);
  const [status,   setStatus]   = useState("idle");
  const [message,  setMessage]  = useState("");

  const strength = (() => {
    if (!password) return null;
    if (password.length < 6) return { label: "Too short", color: "#ef4444", w: "25%" };
    if (password.length < 8) return { label: "Weak",      color: "#f97316", w: "40%" };
    if (/[A-Z]/.test(password) && /[0-9]/.test(password)) return { label: "Strong", color: "#22c55e", w: "100%" };
    if (password.length >= 8) return { label: "Medium",   color: "#eab308", w: "65%" };
    return null;
  })();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password || !confirm)  { setStatus("error"); setMessage("Please fill in both fields."); return; }
    if (password.length < 6)    { setStatus("error"); setMessage("Password must be at least 6 characters."); return; }
    if (password !== confirm)   { setStatus("error"); setMessage("Passwords do not match."); return; }
    setStatus("loading"); setMessage("");
    try {
      const res = await axios.post(`${API_URL}/api/auth/reset-password`, { token, password });
      setStatus("success"); setMessage(res.data.message);
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

        <h2 className="auth-title">Set new password</h2>
        <p className="auth-subtitle">Choose a strong password for your account.</p>

        {status === "success" ? (
          <div style={{ textAlign: "center", padding: "1rem 0" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>✅</div>
            <div className="auth-success">{message}</div>
            <button className="auth-btn" style={{ marginTop: "1.5rem" }} onClick={onDone}>
              Sign In
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label className="form-label">New Password</label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPass ? "text" : "password"} className="form-input"
                  placeholder="••••••••" value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="new-password" disabled={status === "loading"}
                  style={{ paddingRight: "3rem" }}
                />
                <button type="button" onClick={() => setShowPass(p => !p)}
                  style={{ position:"absolute", right:"0.75rem", top:"50%", transform:"translateY(-50%)", background:"none", border:"none", color:"var(--text-dim)", cursor:"pointer", fontSize:"0.9rem", padding:"0.25rem" }}>
                  {showPass ? "🙈" : "👁"}
                </button>
              </div>
              {strength && (
                <div style={{ marginTop: "0.4rem" }}>
                  <div style={{ height: 3, background: "var(--border)", borderRadius: 999, overflow: "hidden" }}>
                    <div style={{ width: strength.w, background: strength.color, height: "100%", borderRadius: 999, transition: "width 0.3s" }} />
                  </div>
                  <span style={{ fontSize: "0.72rem", color: strength.color, display: "block", marginTop: "0.2rem" }}>{strength.label}</span>
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Confirm Password</label>
              <input
                type={showPass ? "text" : "password"} className="form-input"
                placeholder="••••••••" value={confirm}
                onChange={e => setConfirm(e.target.value)}
                autoComplete="new-password" disabled={status === "loading"}
                style={confirm && confirm !== password ? { borderColor: "rgba(244,63,94,0.5)" } : {}}
              />
              {confirm && confirm !== password && (
                <span style={{ fontSize: "0.72rem", color: "#fda4af" }}>Passwords do not match</span>
              )}
            </div>

            {status === "error" && <div className="auth-error">{message}</div>}

            <button type="submit" className="auth-btn" disabled={status === "loading"}>
              {status === "loading" ? <span className="btn-spinner" /> : "Reset Password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
