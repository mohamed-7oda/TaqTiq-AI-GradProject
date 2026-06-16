import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext";

export default function Login({ onSwitch, onForgot }) {
  const { login } = useAuth();
  const { t } = useTranslation();
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password) { setError(t("login.fillFields")); return; }
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
    } catch (err) {
      setError(err.response?.data?.error || t("login.failed"));
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

        <h2 className="auth-title">{t("login.title")}</h2>
        <p className="auth-subtitle">{t("login.subtitle")}</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label className="form-label">{t("login.email")}</label>
            <input
              type="email" className="form-input" placeholder={t("login.emailPlaceholder")}
              value={email} onChange={e => setEmail(e.target.value)}
              autoComplete="email" disabled={loading}
            />
          </div>

          <div className="form-group">
            <div className="form-label-row">
              <label className="form-label">{t("login.password")}</label>
              <button type="button" className="auth-forgot-link" onClick={onForgot}>
                {t("login.forgotPassword")}
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
            {loading ? <span className="btn-spinner" /> : t("login.signIn")}
          </button>
        </form>

        <hr className="auth-divider" />
        <p className="auth-switch">
          {t("login.noAccount")}{" "}
          <button className="auth-link" onClick={onSwitch}>{t("login.createOne")}</button>
        </p>
      </div>
    </div>
  );
}
