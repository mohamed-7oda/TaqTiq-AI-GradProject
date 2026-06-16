import React, { useState } from "react";
import { useTranslation } from "react-i18next";
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

const TAB_ICONS = {
  analyze: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  ),
  history: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
  ),
  profile: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  developers: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
};

const TAB_IDS = ["analyze", "history", "profile", "developers"];

// ── Theme hook ────────────────────────────────────────────────────────────────
function useTheme() {
  const [theme, setTheme] = useState(
    () => localStorage.getItem("taqtiq-theme") || "dark"
  );
  React.useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("taqtiq-theme", theme);
  }, [theme]);
  const toggleTheme = React.useCallback(
    () => setTheme(t => (t === "dark" ? "light" : "dark")),
    []
  );
  return { theme, toggleTheme };
}

// ── Topbar ────────────────────────────────────────────────────────────────────
function Topbar({ user, page, onNav, onLogout, theme, onThemeToggle }) {
  const { t, i18n } = useTranslation();
  const initials = user.fullName.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
  const firstName = user.fullName.split(" ")[0];
  const isDark = theme === "dark";

  const TABS = [
    { id: "analyze",    label: t("nav.analyze"),    icon: TAB_ICONS.analyze },
    { id: "history",    label: t("nav.history"),    icon: TAB_ICONS.history },
    { id: "profile",    label: t("nav.profile"),    icon: TAB_ICONS.profile },
    { id: "developers", label: t("nav.developers"), icon: TAB_ICONS.developers },
  ];

  return (
    <header className="topbar">
      <div className="topbar-brand">
        <img src="/favicon.png" alt="TaqTiq AI" className="topbar-logo" />
        <div className="topbar-brand-text">
          <span className="topbar-name">TaqTiq <span>Ai</span></span>
          <span className="topbar-tagline">{t("footer.tagline")}</span>
        </div>
      </div>

      <nav className="topbar-nav">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`topbar-tab ${page === tab.id ? "active" : ""}`}
            onClick={() => onNav(tab.id)}
            aria-current={page === tab.id ? "page" : undefined}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </nav>

      <div className="topbar-user">
        <span className="status-live"><span className="pulse-dot" />{t("nav.live")}</span>
        <div className="user-avatar" title={user.fullName}>{initials}</div>
        <span className="user-name">{firstName}</span>
        <button
          className="theme-toggle"
          onClick={onThemeToggle}
          aria-label={isDark ? t("nav.switchLight") : t("nav.switchDark")}
          title={isDark ? t("nav.switchLight") : t("nav.switchDark")}
        >
          {isDark ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5"/>
              <line x1="12" y1="1"  x2="12" y2="3"/>
              <line x1="12" y1="21" x2="12" y2="23"/>
              <line x1="4.22" y1="4.22"   x2="5.64" y2="5.64"/>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
              <line x1="1"  y1="12" x2="3"  y2="12"/>
              <line x1="21" y1="12" x2="23" y2="12"/>
              <line x1="4.22" y1="19.78"  x2="5.64" y2="18.36"/>
              <line x1="18.36" y1="5.64"  x2="19.78" y2="4.22"/>
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          )}
        </button>
        <button
          className="lang-toggle"
          onClick={() => i18n.changeLanguage(i18n.language === "ar" ? "en" : "ar")}
          title={t("nav.language")}
        >
          {t("nav.language")}
        </button>
        <button className="logout-btn" onClick={onLogout}>{t("nav.signOut")}</button>
      </div>
    </header>
  );
}

// ── Page hero ─────────────────────────────────────────────────────────────────
function PageHero({ page, mode }) {
  const { t } = useTranslation();
  const titleKey = page === "analyze" ? `page.analyze.${mode}.title` : `page.${page}.title`;
  const subKey   = page === "analyze" ? `page.analyze.${mode}.sub`   : `page.${page}.sub`;
  return (
    <div className="page-hero">
      <h1 className="page-title">{t(titleKey)}</h1>
      <p className="page-subtitle">{t(subKey)}</p>
    </div>
  );
}

// ── Main app (authenticated) ──────────────────────────────────────────────────
function AppContent() {
  const { user, token, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { t } = useTranslation();

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
      <Topbar user={user} page={page} onNav={handleNav} onLogout={logout} theme={theme} onThemeToggle={toggleTheme} />

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
                <h3>{t("error.processingFailed")}</h3>
                <p>{error || statusMessage}</p>
                <button className="btn-secondary" onClick={handleReset}>{t("error.tryAnother")}</button>
              </div>
            )}

            {error && !jobId && (
              <div className="error-box">
                <h3>{t("error.uploadError")}</h3>
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
          <span>TaqTiq AI · {t("footer.tagline")}</span>
        </div>
        <span>{t("footer.features")}</span>
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
