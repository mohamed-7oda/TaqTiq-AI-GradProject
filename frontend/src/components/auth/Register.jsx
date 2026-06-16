import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext";

export default function Register({ onSwitch }) {
  const { register } = useAuth();
  const { t } = useTranslation();
  const [fullName, setFullName] = useState("");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [confirm,  setConfirm]  = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [consent,  setConsent]  = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!fullName.trim() || !email.trim() || !password || !confirm) { setError(t("register.fillFields")); return; }
    if (fullName.trim().length < 2) { setError(t("register.nameTooShort")); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError(t("register.invalidEmail")); return; }
    if (password.length < 6) { setError(t("register.passwordTooShort")); return; }
    if (password !== confirm) { setError(t("register.passwordsNotMatch")); return; }
    if (!consent) { setError(t("register.mustAccept")); return; }
    setLoading(true);
    try {
      await register(fullName.trim(), email.trim().toLowerCase(), password);
    } catch (err) {
      setError(err.response?.data?.error || t("register.failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card auth-card-register">
        <div className="auth-logo">
          <img src="/logo.png" alt="TaqTiq AI" className="auth-logo-img" />
        </div>

        <h2 className="auth-title">{t("register.title")}</h2>
        <p className="auth-subtitle">{t("register.subtitle")}</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label className="form-label">{t("register.fullName")}</label>
            <input type="text" className="form-input" placeholder={t("register.fullNamePlaceholder")}
              value={fullName} onChange={e => setFullName(e.target.value)}
              autoComplete="name" disabled={loading} />
          </div>
          <div className="form-group">
            <label className="form-label">{t("register.email")}</label>
            <input type="email" className="form-input" placeholder={t("register.emailPlaceholder")}
              value={email} onChange={e => setEmail(e.target.value)}
              autoComplete="email" disabled={loading} />
          </div>

          <hr className="form-section-gap" />

          <div className="form-group">
            <label className="form-label">{t("register.password")}</label>
            <input type="password" className="form-input" placeholder={t("register.passwordPlaceholder")}
              value={password} onChange={e => setPassword(e.target.value)}
              autoComplete="new-password" disabled={loading} />
          </div>
          <div className="form-group">
            <label className="form-label">{t("register.confirmPassword")}</label>
            <input
              type="password"
              className={`form-input${confirm && confirm !== password ? " input-error" : ""}`}
              placeholder={t("register.confirmPasswordPlaceholder")}
              value={confirm} onChange={e => setConfirm(e.target.value)}
              autoComplete="new-password" disabled={loading} />
            {confirm && confirm !== password && (
              <p className="auth-input-hint">{t("register.passwordMismatch")}</p>
            )}
          </div>

          <div className="consent-block">
            <label className="consent-label">
              <input
                type="checkbox"
                className="consent-checkbox"
                checked={consent}
                onChange={e => setConsent(e.target.checked)}
                disabled={loading}
              />
              <span>
                {t("register.consentText")} <strong>{t("register.terms")}</strong> {t("register.and")} <strong>{t("register.privacy")}</strong>.
              </span>
            </label>
            <ul className="consent-points">
              <li>{t("register.consent1")}</li>
              <li>{t("register.consent2")}</li>
              <li>{t("register.consent3")}</li>
            </ul>
          </div>

          {error && <div className="auth-error">{error}</div>}

          <button type="submit" className="auth-btn" disabled={loading || !consent}>
            {loading ? <span className="btn-spinner" /> : t("register.createAccount")}
          </button>
        </form>

        <hr className="auth-divider" />
        <p className="auth-switch">
          {t("register.haveAccount")}{" "}
          <button className="auth-link" onClick={onSwitch}>{t("register.signIn")}</button>
        </p>
      </div>
    </div>
  );
}
