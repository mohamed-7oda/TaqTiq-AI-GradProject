import React, { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const ROLE_OPTIONS = [
  "", "Analyst", "Coach", "Scout", "Researcher", "Student", "Fan", "Other",
];

function Field({ label, children }) {
  return (
    <div className="pf-field">
      <label className="pf-label">{label}</label>
      {children}
    </div>
  );
}

export default function Profile() {
  const { user, token, refreshUser } = useAuth();

  const [form, setForm] = useState({
    fullName: "", phoneNumber: "", dateOfBirth: "",
    country: "", city: "", organization: "", role: "", bio: "",
  });
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [success,  setSuccess]  = useState("");
  const [error,    setError]    = useState("");

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

  const handleSave = async (e) => {
    e.preventDefault();
    setSuccess(""); setError("");
    if (!form.fullName.trim()) { setError("Full name is required."); return; }
    setSaving(true);
    try {
      await axios.put(`${API_URL}/api/profile`, form, {
        headers: { Authorization: `Bearer ${token}` },
      });
      await refreshUser();
      setSuccess("Profile saved successfully.");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to save profile.");
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
      {/* Avatar + name banner */}
      <div className="pf-banner">
        <div className="pf-avatar">{initials}</div>
        <div>
          <div className="pf-banner-name">{form.fullName || user?.fullName}</div>
          <div className="pf-banner-email">{user?.email}</div>
        </div>
      </div>

      <form onSubmit={handleSave} className="pf-form">
        {/* ── Account ── */}
        <section className="pf-section">
          <h3 className="pf-section-title">Account</h3>
          <div className="pf-grid-2">
            <Field label="Full Name">
              <input className="pf-input" value={form.fullName}
                onChange={set("fullName")} placeholder="Your full name" />
            </Field>
            <Field label="Email">
              <input className="pf-input pf-readonly" value={user?.email || ""}
                readOnly tabIndex={-1} />
            </Field>
          </div>
        </section>

        {/* ── Personal ── */}
        <section className="pf-section">
          <h3 className="pf-section-title">Personal Information</h3>
          <div className="pf-grid-2">
            <Field label="Phone Number">
              <input className="pf-input" value={form.phoneNumber}
                onChange={set("phoneNumber")} placeholder="+20 123 456 7890"
                type="tel" />
            </Field>
            <Field label="Date of Birth">
              <input className="pf-input" value={form.dateOfBirth}
                onChange={set("dateOfBirth")} type="date" />
            </Field>
            <Field label="Country">
              <input className="pf-input" value={form.country}
                onChange={set("country")} placeholder="Egypt" />
            </Field>
            <Field label="City">
              <input className="pf-input" value={form.city}
                onChange={set("city")} placeholder="Cairo" />
            </Field>
          </div>
        </section>

        {/* ── Professional ── */}
        <section className="pf-section">
          <h3 className="pf-section-title">Professional</h3>
          <div className="pf-grid-2">
            <Field label="Organization">
              <input className="pf-input" value={form.organization}
                onChange={set("organization")}
                placeholder="Club / University / Company" />
            </Field>
            <Field label="Role">
              <select className="pf-input pf-select" value={form.role}
                onChange={set("role")}>
                {ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r}>{r || "Select role…"}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Bio">
            <textarea className="pf-input pf-textarea" value={form.bio}
              onChange={set("bio")}
              placeholder="A short description about yourself…"
              rows={3} />
          </Field>
        </section>

        {error   && <div className="pf-msg pf-msg-error">{error}</div>}
        {success && <div className="pf-msg pf-msg-success">{success}</div>}

        <button type="submit" className="pf-save-btn" disabled={saving}>
          {saving ? <span className="btn-spinner" /> : "Save Changes"}
        </button>
      </form>

      <style>{`
        .pf-loading {
          display: flex; align-items: center; justify-content: center;
          min-height: 300px;
        }

        .pf-wrap { max-width: 760px; margin: 0 auto; padding-bottom: 3rem; }

        .pf-banner {
          display: flex; align-items: center; gap: 1.5rem;
          background: rgba(59,130,246,0.06);
          border: 1px solid rgba(59,130,246,0.15);
          border-radius: 20px; padding: 1.75rem 2rem;
          margin-bottom: 2rem;
        }

        .pf-avatar {
          width: 72px; height: 72px; border-radius: 50%; flex-shrink: 0;
          background: linear-gradient(135deg,#3b82f6,#8b5cf6);
          color: #fff; font-size: 1.6rem; font-weight: 700;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 4px 16px rgba(59,130,246,0.35);
          letter-spacing: -0.02em;
        }

        .pf-banner-name {
          color: #f1f5f9; font-size: 1.25rem; font-weight: 600;
          letter-spacing: -0.01em;
        }
        .pf-banner-email { color: #64748b; font-size: 0.9rem; margin-top: 0.2rem; }

        .pf-form { display: flex; flex-direction: column; gap: 0; }

        .pf-section {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 16px; padding: 1.5rem 1.75rem;
          margin-bottom: 1.25rem;
        }

        .pf-section-title {
          color: #94a3b8; font-size: 0.75rem; font-weight: 600;
          letter-spacing: 0.08em; text-transform: uppercase;
          margin: 0 0 1.25rem;
        }

        .pf-grid-2 {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px,1fr));
          gap: 1rem;
        }

        .pf-field {
          display: flex; flex-direction: column; gap: 0.4rem;
        }

        .pf-label {
          color: #cbd5e1; font-size: 0.82rem; font-weight: 500;
        }

        .pf-input {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 10px; padding: 0.7rem 0.9rem;
          color: #f1f5f9; font-size: 0.9rem;
          outline: none; width: 100%; box-sizing: border-box;
          transition: border-color 0.2s, background 0.2s;
          font-family: inherit;
        }
        .pf-input::placeholder { color: #475569; }
        .pf-input:focus {
          border-color: rgba(59,130,246,0.6);
          background: rgba(59,130,246,0.05);
        }
        .pf-readonly {
          opacity: 0.5; cursor: default;
          background: rgba(255,255,255,0.02) !important;
        }
        .pf-select {
          appearance: none; cursor: pointer;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
          background-repeat: no-repeat; background-position: right 0.8rem center;
          padding-right: 2rem;
        }
        .pf-select option { background: #1e293b; color: #f1f5f9; }
        .pf-textarea { resize: vertical; min-height: 80px; margin-top: 0; }

        .pf-msg {
          padding: 0.75rem 1rem; border-radius: 10px;
          font-size: 0.88rem; margin-bottom: 1rem;
        }
        .pf-msg-error {
          background: rgba(239,68,68,0.1);
          border: 1px solid rgba(239,68,68,0.3);
          color: #fca5a5;
        }
        .pf-msg-success {
          background: rgba(34,197,94,0.1);
          border: 1px solid rgba(34,197,94,0.3);
          color: #86efac;
        }

        .pf-save-btn {
          align-self: flex-start;
          background: linear-gradient(135deg,#3b82f6,#8b5cf6);
          color: #fff; border: none; padding: 0.85rem 2.5rem;
          border-radius: 12px; font-size: 1rem; font-weight: 600;
          cursor: pointer; transition: opacity 0.2s, transform 0.2s;
          min-width: 160px; min-height: 48px;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 4px 14px rgba(59,130,246,0.3);
        }
        .pf-save-btn:hover:not(:disabled) {
          opacity: 0.9; transform: translateY(-1px);
        }
        .pf-save-btn:disabled { opacity: 0.6; cursor: not-allowed; }

        .btn-spinner {
          width: 20px; height: 20px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff; border-radius: 50%;
          animation: spin 0.7s linear infinite; display: inline-block;
        }
        .large-spinner { width: 36px; height: 36px; border-width: 3px; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
