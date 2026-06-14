import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";

export default function Register({ onSwitch }) {
  const { register } = useAuth();
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
    if (!fullName.trim() || !email.trim() || !password || !confirm) { setError("Please fill in all fields."); return; }
    if (fullName.trim().length < 2) { setError("Full name must be at least 2 characters."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError("Please enter a valid email address."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }
    if (!consent) { setError("You must accept the Terms and Conditions to create an account."); return; }
    setLoading(true);
    try {
      await register(fullName.trim(), email.trim().toLowerCase(), password);
    } catch (err) {
      setError(err.response?.data?.error || "Registration failed. Please try again.");
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

        <h2 className="auth-title">Create Your Account</h2>
        <p className="auth-subtitle">Join TaqTiq AI and start analysing matches.</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input type="text" className="form-input" placeholder="Your full name"
              value={fullName} onChange={e => setFullName(e.target.value)}
              autoComplete="name" disabled={loading} />
          </div>
          <div className="form-group">
            <label className="form-label">Email address</label>
            <input type="email" className="form-input" placeholder="you@example.com"
              value={email} onChange={e => setEmail(e.target.value)}
              autoComplete="email" disabled={loading} />
          </div>

          <hr className="form-section-gap" />

          <div className="form-group">
            <label className="form-label">Password</label>
            <input type="password" className="form-input" placeholder="At least 6 characters"
              value={password} onChange={e => setPassword(e.target.value)}
              autoComplete="new-password" disabled={loading} />
          </div>
          <div className="form-group">
            <label className="form-label">Confirm Password</label>
            <input
              type="password"
              className={`form-input${confirm && confirm !== password ? " input-error" : ""}`}
              placeholder="Repeat your password"
              value={confirm} onChange={e => setConfirm(e.target.value)}
              autoComplete="new-password" disabled={loading} />
            {confirm && confirm !== password && (
              <p className="auth-input-hint">Passwords do not match</p>
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
                I agree to the <strong>Terms and Conditions</strong> and <strong>Privacy Policy</strong>.
              </span>
            </label>
            <ul className="consent-points">
              <li>Videos you upload are processed by AI models and analysis results are stored in your account.</li>
              <li>We do not sell or share your data with third parties.</li>
              <li>You are responsible for ensuring you have the legal right to upload and analyse submitted video content.</li>
            </ul>
          </div>

          {error && <div className="auth-error">{error}</div>}

          <button type="submit" className="auth-btn" disabled={loading || !consent}>
            {loading ? <span className="btn-spinner" /> : "Create Account"}
          </button>
        </form>

        <hr className="auth-divider" />
        <p className="auth-switch">
          Already have an account?{" "}
          <button className="auth-link" onClick={onSwitch}>Sign in</button>
        </p>
      </div>
    </div>
  );
}
