// frontend/src/components/ModeSelector.jsx
import React from "react";
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
  return (
    <div className="mode-selector">
      <h2 className="mode-title">Choose Analysis Mode</h2>
      <div className="mode-cards">
        <button
          className={`mode-card ${mode === "events" ? "active" : ""}`}
          onClick={() => onChange("events")}
        >
          <div className="mode-icon"><EventsIcon /></div>
          <h3>Event Detection</h3>
          <p>Detect goals, fouls, cards, corners and 13 other events with timestamps.</p>
          <span className="mode-badge">AI-Powered · Instant Results</span>
        </button>

        <button
          className={`mode-card tracking ${mode === "tracking" ? "active" : ""}`}
          onClick={() => onChange("tracking")}
        >
          <div className="mode-icon"><TrackingIcon /></div>
          <h3>Tactical Tracking</h3>
          <p>Track every player & ball, assign teams, measure speed, distance and possession.</p>
          <span className="mode-badge">Real-Time · Annotated Video</span>
        </button>
      </div>
    </div>
  );
}
