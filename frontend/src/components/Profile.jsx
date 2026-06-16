import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import axios from "axios";
import { useAuth } from "../context/AuthContext";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const ROLE_OPTIONS = [
  "", "Analyst", "Coach", "Scout", "Researcher", "Student", "Fan", "Other",
];

function Field({ label, children, className = "" }) {
  return (
    <div className={`pf-field ${className}`}>
      <label className="pf-label">{label}</label>
      {children}
    </div>
  );
}

export default function Profile() {
  const { user, token, refreshUser } = useAuth();
  const { t } = useTranslation();

  const [form, setForm] = useState({
    fullName: "", phoneNumber: "", dateOfBirth: "",
    country: "", city: "", organization: "", role: "", bio: "",
  });
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [success,  setSuccess]  = useState("");
  const [error,    setError]    = useState("");

  const [pwForm,    setPwForm]    = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [pwSaving,  setPwSaving]  = useState(false);
  const [pwSuccess, setPwSuccess] = useState("");
  const [pwError,   setPwError]   = useState("");

  useEffect(() => {
    axios
      .get(`${API_URL}/api/profile`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        const d = res.data;
        setForm({
          fullName:     d.fullName     || "",
          phoneNumber:  d.phoneNumber  || "",
          dateOfBirth:  d.dateOfBirth  || "",
          country:      d.country      || "",
          city:         d.city         || "",
          organization: d.organization || "",
          role:         d.role         || "",
          bio:          d.bio          || "",
        });
      })
      .catch(() => {
        setForm((f) => ({ ...f, fullName: user?.fullName || "" }));
      })
      .finally(() => setLoading(false));
  }, [token, user]);

  const set = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const setPw = (key) => (e) =>
    setPwForm((f) => ({ ...f, [key]: e.target.value }));

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwSuccess(""); setPwError("");
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setPwError(t("profile.passwordsNotMatch")); return;
    }
    if (pwForm.newPassword.length < 6) {
      setPwError(t("profile.passwordTooShort")); return;
    }
    setPwSaving(true);
    try {
      await axios.post(`${API_URL}/api/auth/change-password`,
        { currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setPwSuccess(t("profile.passwordChanged"));
      setPwForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      setPwError(err.response?.data?.error || t("profile.passwordFailed"));
    } finally {
      setPwSaving(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSuccess(""); setError("");
    if (!form.fullName.trim()) { setError(t("profile.fullNameRequired")); return; }
    setSaving(true);
    try {
      await axios.put(`${API_URL}/api/profile`, form, {
        headers: { Authorization: `Bearer ${token}` },
      });
      await refreshUser();
      setSuccess(t("profile.savedSuccess"));
    } catch (err) {
      setError(err.response?.data?.error || t("profile.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const initials = (form.fullName || user?.fullName || "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  if (loading) {
    return (
      <div className="pf-loading">
        <span className="btn-spinner large-spinner" />
      </div>
    );
  }

  return (
    <div className="pf-wrap">

      {/* ── Profile banner ── */}
      <div className="pf-banner">
        <div className="pf-avatar">{initials}</div>
        <div className="pf-banner-text">
          <div className="pf-banner-name">{form.fullName || user?.fullName}</div>
          <div className="pf-banner-email">{user?.email}</div>
        </div>
      </div>

      {/* ── Profile info form ── */}
      <form onSubmit={handleSave} className="pf-form">

        <section className="pf-section pf-section-account">
          <h3 className="pf-section-title">{t("profile.account")}</h3>
          <div className="pf-grid-2">
            <Field label={t("profile.fullName")}>
              <input className="pf-input" value={form.fullName}
                onChange={set("fullName")} placeholder={t("profile.fullNamePlaceholder")} />
            </Field>
            <Field label={t("profile.email")}>
              <input className="pf-input pf-readonly" value={user?.email || ""}
                readOnly tabIndex={-1} />
            </Field>
          </div>
        </section>

        <section className="pf-section pf-section-personal">
          <h3 className="pf-section-title">{t("profile.personalInfo")}</h3>
          <div className="pf-grid-2">
            <Field label={t("profile.phoneNumber")}>
              <input className="pf-input" value={form.phoneNumber}
                onChange={set("phoneNumber")} placeholder={t("profile.phonePlaceholder")}
                type="tel" />
            </Field>
            <Field label={t("profile.dateOfBirth")}>
              <input className="pf-input" value={form.dateOfBirth}
                onChange={set("dateOfBirth")} type="date" />
            </Field>
            <Field label={t("profile.country")}>
              <input className="pf-input" value={form.country}
                onChange={set("country")} placeholder={t("profile.countryPlaceholder")} />
            </Field>
            <Field label={t("profile.city")}>
              <input className="pf-input" value={form.city}
                onChange={set("city")} placeholder={t("profile.cityPlaceholder")} />
            </Field>
          </div>
        </section>

        <section className="pf-section pf-section-professional">
          <h3 className="pf-section-title">{t("profile.professional")}</h3>
          <div className="pf-grid-2">
            <Field label={t("profile.organization")}>
              <input className="pf-input" value={form.organization}
                onChange={set("organization")}
                placeholder={t("profile.orgPlaceholder")} />
            </Field>
            <Field label={t("profile.role")}>
              <select className="pf-input pf-select" value={form.role}
                onChange={set("role")}>
                {ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r}>{r || t("profile.selectRole")}</option>
                ))}
              </select>
            </Field>
            <Field label={t("profile.bio")} className="pf-field-full">
              <textarea className="pf-input pf-textarea" value={form.bio}
                onChange={set("bio")}
                placeholder={t("profile.bioPlaceholder")}
                rows={3} />
            </Field>
          </div>
        </section>

        {error   && <div className="pf-msg pf-msg-error">{error}</div>}
        {success && <div className="pf-msg pf-msg-success">{success}</div>}

        <button type="submit" className="pf-save-btn" disabled={saving}>
          {saving ? <span className="btn-spinner" /> : t("profile.saveChanges")}
        </button>
      </form>

      {/* ── Security / Change password form ── */}
      <form onSubmit={handleChangePassword} className="pf-form pf-pw-form">
        <section className="pf-section pf-section-security">
          <h3 className="pf-section-title">{t("profile.security")}</h3>

          <Field label={t("profile.currentPassword")} className="pf-field-current-pw">
            <input className="pf-input" type="password" value={pwForm.currentPassword}
              onChange={setPw("currentPassword")} placeholder={t("profile.currentPasswordPlaceholder")}
              autoComplete="current-password" />
          </Field>

          <div className="pf-grid-2 pf-grid-pw">
            <Field label={t("profile.newPassword")}>
              <input className="pf-input" type="password" value={pwForm.newPassword}
                onChange={setPw("newPassword")} placeholder={t("profile.newPasswordPlaceholder")}
                autoComplete="new-password" />
            </Field>
            <Field label={t("profile.confirmNewPassword")}>
              <input className="pf-input" type="password" value={pwForm.confirmPassword}
                onChange={setPw("confirmPassword")} placeholder={t("profile.confirmNewPasswordPlaceholder")}
                autoComplete="new-password" />
            </Field>
          </div>

          {pwError   && <div className="pf-msg pf-msg-error pf-msg-top">{pwError}</div>}
          {pwSuccess && <div className="pf-msg pf-msg-success pf-msg-top">{pwSuccess}</div>}
        </section>

        <button type="submit" className="pf-save-btn" disabled={pwSaving}>
          {pwSaving ? <span className="btn-spinner" /> : t("profile.changePassword")}
        </button>
      </form>

      <style>{`
        /* ── Loading ── */
        .pf-loading {
          display: flex; align-items: center; justify-content: center;
          min-height: 300px;
        }

        /* ── Wrapper ── */
        .pf-wrap {
          max-width: 760px;
          margin: 0 auto;
          padding-bottom: 3rem;
        }

        /* ── Banner ── */
        .pf-banner {
          display: flex;
          align-items: center;
          gap: 1.25rem;
          background: rgba(99,102,241,0.05);
          border: 1px solid rgba(99,102,241,0.14);
          border-radius: 18px;
          padding: 1.25rem 1.5rem;
          margin-bottom: 1.5rem;
        }

        .pf-avatar {
          width: 64px; height: 64px; border-radius: 50%; flex-shrink: 0;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          color: #fff; font-size: 1.4rem; font-weight: 700;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 4px 16px rgba(99,102,241,0.38);
          letter-spacing: -0.02em;
          border: 2px solid rgba(255,255,255,0.1);
        }

        .pf-banner-text { display: flex; flex-direction: column; gap: 0.2rem; min-width: 0; }

        .pf-banner-name {
          color: #f1f5f9; font-size: 1.1rem; font-weight: 600;
          letter-spacing: -0.01em;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .pf-banner-email {
          color: #4e6280; font-size: 0.84rem;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }

        /* ── Forms ── */
        .pf-form { display: flex; flex-direction: column; gap: 0; }
        .pf-pw-form { margin-top: 1.25rem; }

        /* ── Sections ── */
        .pf-section {
          background: rgba(255,255,255,0.025);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 16px;
          padding: 1.25rem 1.5rem;
          margin-bottom: 1rem;
        }

        .pf-section-title {
          font-size: 0.7rem; font-weight: 700;
          letter-spacing: 0.09em; text-transform: uppercase;
          margin: 0 0 1rem;
          display: flex; align-items: center; gap: 0.45rem;
        }

        .pf-section-title::before {
          content: '';
          display: inline-block;
          width: 5px; height: 5px; border-radius: 50%;
          flex-shrink: 0;
        }

        /* Section accent colors */
        .pf-section-account   .pf-section-title { color: #818cf8; }
        .pf-section-account   .pf-section-title::before { background: #818cf8; }

        .pf-section-personal  .pf-section-title { color: #67e8f9; }
        .pf-section-personal  .pf-section-title::before { background: #67e8f9; }

        .pf-section-professional .pf-section-title { color: #a78bfa; }
        .pf-section-professional .pf-section-title::before { background: #a78bfa; }

        .pf-section-security  .pf-section-title { color: #fbbf24; }
        .pf-section-security  .pf-section-title::before { background: #fbbf24; }

        /* ── Grid ── */
        .pf-grid-2 {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 0.9rem;
        }

        /* Security section new+confirm grid */
        .pf-grid-pw { margin-top: 0.9rem; }

        /* Full-width field inside a grid */
        .pf-field-full { grid-column: 1 / -1; }

        /* Current password — fixed half-width so it doesn't stretch oddly */
        .pf-field-current-pw { max-width: calc(50% - 0.45rem); margin-bottom: 0; }

        /* ── Fields ── */
        .pf-field { display: flex; flex-direction: column; gap: 0.38rem; }

        .pf-label {
          color: #b0bfd4; font-size: 0.8rem; font-weight: 500;
          letter-spacing: 0.01em;
        }

        /* ── Inputs ── */
        .pf-input {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 10px;
          padding: 0.72rem 0.9rem;
          color: #f1f5f9; font-size: 0.9rem;
          outline: none; width: 100%; box-sizing: border-box;
          transition: border-color 0.18s, background 0.18s, box-shadow 0.18s;
          font-family: inherit;
        }
        .pf-input::placeholder { color: #3d5166; }

        .pf-input:hover:not([readonly]):not(:disabled) {
          border-color: rgba(255,255,255,0.16);
          background: rgba(255,255,255,0.07);
        }

        .pf-input:focus,
        .pf-input:focus-visible {
          border-color: rgba(99,102,241,0.65);
          background: rgba(99,102,241,0.05);
          box-shadow: 0 0 0 3px rgba(99,102,241,0.12);
          outline: none;
        }

        .pf-input[readonly] {
          opacity: 0.45; cursor: default;
          background: rgba(255,255,255,0.02);
        }

        .pf-select {
          appearance: none; cursor: pointer;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
          background-repeat: no-repeat; background-position: right 0.8rem center;
          padding-right: 2rem;
        }
        .pf-select option { background: #1e293b; color: #f1f5f9; }

        .pf-textarea { resize: vertical; min-height: 76px; }

        /* ── Messages ── */
        .pf-msg {
          padding: 0.7rem 1rem;
          border-radius: 10px;
          font-size: 0.86rem;
          line-height: 1.45;
          margin-bottom: 1rem;
        }
        .pf-msg-top { margin-top: 1rem; margin-bottom: 0; }
        .pf-msg-error {
          background: rgba(239,68,68,0.08);
          border: 1px solid rgba(239,68,68,0.25);
          color: #fca5a5;
        }
        .pf-msg-success {
          background: rgba(34,197,94,0.08);
          border: 1px solid rgba(34,197,94,0.25);
          color: #86efac;
        }

        /* ── Save button ── */
        .pf-save-btn {
          align-self: flex-start;
          background: linear-gradient(135deg, #6366f1, #4f46e5);
          color: #fff; border: none;
          padding: 0.78rem 2.25rem;
          border-radius: 11px; font-size: 0.93rem; font-weight: 600;
          cursor: pointer;
          transition: opacity 0.18s, transform 0.15s, box-shadow 0.18s;
          min-width: 150px; min-height: 44px;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 4px 14px rgba(99,102,241,0.35);
          letter-spacing: 0.01em;
        }
        .pf-save-btn:hover:not(:disabled) {
          opacity: 0.9; transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(99,102,241,0.45);
        }
        .pf-save-btn:focus-visible {
          outline: 2px solid rgba(165,180,252,0.8);
          outline-offset: 3px;
        }
        .pf-save-btn:active:not(:disabled) {
          transform: translateY(0);
        }
        .pf-save-btn:disabled { opacity: 0.45; cursor: not-allowed; }

        /* ── Spinner ── */
        .btn-spinner {
          width: 18px; height: 18px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff; border-radius: 50%;
          animation: spin 0.7s linear infinite; display: inline-block;
        }
        .large-spinner { width: 36px; height: 36px; border-width: 3px; }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* ── Responsive ── */
        @media (max-width: 540px) {
          .pf-grid-2 { grid-template-columns: 1fr; }
          .pf-field-current-pw { max-width: 100%; }
          .pf-section { padding: 1rem 1.1rem; }
          .pf-banner { padding: 1rem 1.1rem; gap: 1rem; }
          .pf-avatar { width: 52px; height: 52px; font-size: 1.15rem; }
          .pf-banner-name { font-size: 1rem; }
          .pf-save-btn { width: 100%; }
        }
      `}</style>
    </div>
  );
}
