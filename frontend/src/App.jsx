import React, { useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Login          from "./components/auth/Login";
import Register       from "./components/auth/Register";
import ForgotPassword from "./components/auth/ForgotPassword";
import ResetPassword  from "./components/auth/ResetPassword";
import Profile        from "./components/Profile";
import History        from "./components/History";
import VideoUpload    from "./components/VideoUpload";
import ProgressBar    from "./components/ProgressBar";
import EventsList     from "./components/EventsList";
import TrackingResult from "./components/TrackingResult";
import ModeSelector   from "./components/ModeSelector";
import HighlightsPlayer from "./components/HighlightsPlayer";
import MatchDashboard   from "./components/MatchDashboard";
import ChatBot          from "./components/ChatBot";
import Developers       from "./components/Developers";
import "./App.css";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const TABS = [
  { id: "analyze",    label: "Analyze",    icon: "⚡" },
  { id: "history",    label: "History",    icon: "📋" },
  { id: "profile",    label: "Profile",    icon: "👤" },
  { id: "developers", label: "Developers", icon: "👥" },
];

const PAGE_META = {
  analyze: {
    events:   { title: "Event Detection",   sub: "Upload a match video and detect goals, fouls, cards, corners and 13 other events with precise timestamps." },
    tracking: { title: "Player Tracking",   sub: "Upload a clip and track every player — teams auto-assigned, with speed, distance and possession analytics." },
  },
  history:    { title: "Analysis History",  sub: "Browse and revisit all your previously analysed videos and results." },
  profile:    { title: "Your Profile",      sub: "Manage your account information and professional details." },
  developers: { title: "Meet the Team",     sub: "The people behind TaqTiq AI — reach out to us anytime." },
};

// ── Topbar ────────────────────────────────────────────────────────────────────
function Topbar({ user, page, onNav, onLogout }) {
  const initials = user.fullName.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
  const firstName = user.fullName.split(" ")[0];
  return (
    <header className="topbar">
      <div className="topbar-brand">
        <img src="/favicon.png" alt="TaqTiq AI" className="topbar-logo" />
        <div className="topbar-brand-text">
          <span className="topbar-name">TaqTiq <span>Ai</span></span>
          <span className="topbar-tagline">AI-Driven Soccer Analytics</span>
        </div>
      </div>

      <nav className="topbar-nav">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`topbar-tab ${page === t.id ? "active" : ""}`}
            onClick={() => onNav(t.id)}
          >
            <span className="tab-icon">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>

      <div className="topbar-user">
        <span className="status-live"><span className="pulse-dot" />Live</span>
        <div className="user-avatar" title={user.fullName}>{initials}</div>
        <span className="user-name">{firstName}</span>
        <button className="logout-btn" onClick={onLogout}>Sign Out</button>
      </div>
    </header>
  );
}

// ── Page hero ─────────────────────────────────────────────────────────────────
function PageHero({ page, mode }) {
  const meta = page === "analyze" ? PAGE_META.analyze[mode] : PAGE_META[page];
  return (
    <div className="page-hero">
      <h1 className="page-title">{meta?.title}</h1>
      <p className="page-subtitle">{meta?.sub}</p>
    </div>
  );
}

// ── Main app (authenticated) ──────────────────────────────────────────────────
function AppContent() {
  const { user, token, logout } = useAuth();

  const resetToken = new URLSearchParams(window.location.search).get("reset_token");
  const [authView, setAuthView] = useState(resetToken ? "reset" : "login");
  const [page,     setPage]     = useState("analyze");
  const [mode,     setMode]     = useState("events");

  const [jobId,         setJobId]         = useState(null);
  const [jobStartedAt,  setJobStartedAt]  = useState(null);
  const [status,        setStatus]        = useState(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [results,       setResults]       = useState(null);
  const [error,         setError]         = useState(null);
  const [chatContext,   setChatContext]    = useState(null);

  const handleReset = () => {
    setJobId(null); setJobStartedAt(null); setStatus(null);
    setStatusMessage(""); setResults(null); setError(null);
  };

  const handleNav = (p) => {
    // Only reset analyze state when already on the analyze page (start new analysis).
    // Returning from History/Profile should restore the previous state.
    if (p === "analyze" && page === "analyze") handleReset();
    setPage(p);
  };

  // ── Not logged in ──
  if (!user) {
    if (authView === "register") return <Register onSwitch={() => setAuthView("login")} />;
    if (authView === "forgot")   return <ForgotPassword onBack={() => setAuthView("login")} />;
    if (authView === "reset")
      return (
        <ResetPassword
          token={resetToken || ""}
          onDone={() => {
            window.history.replaceState({}, "", window.location.pathname);
            setAuthView("login");
          }}
        />
      );
    return <Login onSwitch={() => setAuthView("register")} onForgot={() => setAuthView("forgot")} />;
  }

  return (
    <div className="app">
      <Topbar user={user} page={page} onNav={handleNav} onLogout={logout} />

      <PageHero page={page} mode={mode} />

      <main className="main">
        {/* ── Analyze ── */}
        {page === "analyze" && (
          <>
            {!jobId && <ModeSelector mode={mode} onChange={setMode} />}

            {!jobId && (
              <VideoUpload
                apiUrl={API_URL} mode={mode} token={token}
                onUploadStart={() => setError(null)}
                onUploadSuccess={(id) => {
                  setJobId(id); setJobStartedAt(Date.now()); setStatus("queued");
                  setStatusMessage("Video uploaded. Starting processing…");
                }}
                onUploadError={(err) => setError(err)}
              />
            )}

            {jobId && status !== "completed" && status !== "failed" && (
              <ProgressBar
                apiUrl={API_URL} jobId={jobId} mode={mode}
                jobStartedAt={jobStartedAt}
                onStatusUpdate={(s, m) => { setStatus(s); setStatusMessage(m); }}
                onComplete={(data) => { setStatus("completed"); setResults(data); }}
                onFailed={(err) => { setStatus("failed"); setError(err); }}
              />
            )}

            {status === "completed" && results && mode === "events" && (
              <>
                <HighlightsPlayer jobId={jobId} token={token} />
                <MatchDashboard results={results} />
                <EventsList results={results} onReset={handleReset} />
              </>
            )}

            {status === "completed" && results && mode === "tracking" && (
              <TrackingResult apiUrl={API_URL} results={results} onReset={handleReset} />
            )}

            {status === "failed" && (
              <div className="error-box">
                <h3>Processing Failed</h3>
                <p>{error || statusMessage}</p>
                <button className="btn-secondary" onClick={handleReset}>Try Another Video</button>
              </div>
            )}

            {error && !jobId && (
              <div className="error-box">
                <h3>Upload Error</h3>
                <p>{error}</p>
              </div>
            )}
          </>
        )}

        {/* ── History ── */}
        {page === "history" && (
          <History onAskAI={(data, name) => setChatContext({ data, name })} />
        )}

        {/* ── Profile ── */}
        {page === "profile" && <Profile />}

        {/* ── Developers ── */}
        {page === "developers" && <Developers />}
      </main>

      <footer className="footer">
        <div className="footer-brand">
          <img src="/logo.png" alt="TaqTiq AI" className="footer-logo" />
          <span>TaqTiq AI · AI-Driven Soccer Analytics</span>
        </div>
        <span>AI-powered event detection · player tracking · team analytics</span>
      </footer>

      <ChatBot apiUrl={API_URL} token={token} results={results} historyContext={chatContext} />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
