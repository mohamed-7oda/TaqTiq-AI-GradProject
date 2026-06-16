import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

export default function ForgotPassword({ onBack }) {
  const { t } = useTranslation();
  const [email,   setEmail]   = useState("");
  const [status,  setStatus]  = useState("idle");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) { setStatus("error"); setMessage(t("forgot.emailRequired")); return; }
    setStatus("loading");
    setMessage("");
    try {
      const res = await axios.post(`${API_URL}/api/auth/forgot-password`, { email: email.trim().toLowerCase() });
      setStatus("success");
      setMessage(res.data.message);
    } catch (err) {
      setStatus("error");
      setMessage(err.response?.data?.error || t("forgot.error"));
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <img src="/logo.png" alt="TaqTiq AI" className="auth-logo-img" />
        </div>

        <h2 className="auth-title">{t("forgot.title")}</h2>
        <p className="auth-subtitle">{t("forgot.subtitle")}</p>

        {status === "success" ? (
          <div style={{ textAlign: "center", padding: "1.5rem 0" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>✉️</div>
            <div className="auth-success" style={{ marginBottom: "0.5rem" }}>{message}</div>
            <p style={{ color: "var(--text-dim)", fontSize: "0.82rem", marginTop: "0.5rem" }}>
              {t("forgot.checkInbox")}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label className="form-label">{t("login.email")}</label>
              <input
                type="email" className="form-input" placeholder={t("login.emailPlaceholder")}
                value={email} onChange={e => setEmail(e.target.value)}
                autoComplete="email" disabled={status === "loading"}
              />
            </div>
            {status === "error" && <div className="auth-error">{message}</div>}
            <button type="submit" className="auth-btn" disabled={status === "loading"}>
              {status === "loading" ? <span className="btn-spinner" /> : t("forgot.sendLink")}
            </button>
          </form>
        )}

        <p className="auth-switch" style={{ marginTop: "1.5rem" }}>
          <button className="auth-link" onClick={onBack}>{t("forgot.backToSignIn")}</button>
        </p>
      </div>
    </div>
  );
}
