import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

export default function ResetPassword({ token, onDone }) {
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  const [confirm,  setConfirm]  = useState("");
  const [showPass, setShowPass] = useState(false);
  const [status,   setStatus]   = useState("idle");
  const [message,  setMessage]  = useState("");

  const strength = (() => {
    if (!password) return null;
    if (password.length < 6) return { label: t("reset.tooShort"), color: "#ef4444", w: "25%" };
    if (password.length < 8) return { label: t("reset.weak"),     color: "#f97316", w: "40%" };
    if (/[A-Z]/.test(password) && /[0-9]/.test(password)) return { label: t("reset.strong"), color: "#22c55e", w: "100%" };
    if (password.length >= 8) return { label: t("reset.medium"),  color: "#eab308", w: "65%" };
    return null;
  })();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password || !confirm)  { setStatus("error"); setMessage(t("reset.fillBoth")); return; }
    if (password.length < 6)    { setStatus("error"); setMessage(t("reset.minLength")); return; }
    if (password !== confirm)   { setStatus("error"); setMessage(t("reset.mismatch")); return; }
    setStatus("loading"); setMessage("");
    try {
      const res = await axios.post(`${API_URL}/api/auth/reset-password`, { token, password });
      setStatus("success"); setMessage(res.data.message);
    } catch (err) {
      setStatus("error");
      setMessage(err.response?.data?.error || t("reset.error"));
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <img src="/logo.png" alt="TaqTiq AI" className="auth-logo-img" />
        </div>

        <h2 className="auth-title">{t("reset.title")}</h2>
        <p className="auth-subtitle">{t("reset.subtitle")}</p>

        {status === "success" ? (
          <div style={{ textAlign: "center", padding: "1rem 0" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>✅</div>
            <div className="auth-success">{message}</div>
            <button className="auth-btn" style={{ marginTop: "1.5rem" }} onClick={onDone}>
              {t("reset.signIn")}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label className="form-label">{t("reset.newPassword")}</label>
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
              <label className="form-label">{t("reset.confirmPassword")}</label>
              <input
                type={showPass ? "text" : "password"} className="form-input"
                placeholder="••••••••" value={confirm}
                onChange={e => setConfirm(e.target.value)}
                autoComplete="new-password" disabled={status === "loading"}
                style={confirm && confirm !== password ? { borderColor: "rgba(244,63,94,0.5)" } : {}}
              />
              {confirm && confirm !== password && (
                <span style={{ fontSize: "0.72rem", color: "#fda4af" }}>{t("reset.mismatch")}</span>
              )}
            </div>

            {status === "error" && <div className="auth-error">{message}</div>}

            <button type="submit" className="auth-btn" disabled={status === "loading"}>
              {status === "loading" ? <span className="btn-spinner" /> : t("reset.resetPassword")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
