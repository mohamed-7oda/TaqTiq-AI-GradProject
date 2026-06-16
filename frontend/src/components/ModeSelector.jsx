// frontend/src/components/ModeSelector.jsx
import React from "react";
import { useTranslation } from "react-i18next";
import "./ModeSelector.css";

const EventsIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  </svg>
);

const TrackingIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <circle cx="12" cy="12" r="6"/>
    <circle cx="12" cy="12" r="2"/>
  </svg>
);

export default function ModeSelector({ mode, onChange }) {
  const { t } = useTranslation();
  return (
    <div className="mode-selector">
      <h2 className="mode-title">{t("mode.title")}</h2>
      <div className="mode-cards">
        <button
          className={`mode-card ${mode === "events" ? "active" : ""}`}
          onClick={() => onChange("events")}
        >
          <div className="mode-icon"><EventsIcon /></div>
          <h3>{t("mode.events.title")}</h3>
          <p>{t("mode.events.desc")}</p>
          <span className="mode-badge">{t("mode.events.badge")}</span>
        </button>

        <button
          className={`mode-card tracking ${mode === "tracking" ? "active" : ""}`}
          onClick={() => onChange("tracking")}
        >
          <div className="mode-icon"><TrackingIcon /></div>
          <h3>{t("mode.tracking.title")}</h3>
          <p>{t("mode.tracking.desc")}</p>
          <span className="mode-badge">{t("mode.tracking.badge")}</span>
        </button>
      </div>
    </div>
  );
}
