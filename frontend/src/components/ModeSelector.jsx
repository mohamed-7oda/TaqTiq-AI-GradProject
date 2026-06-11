// frontend/src/components/ModeSelector.jsx
import React from "react";
import "./ModeSelector.css";

export default function ModeSelector({ mode, onChange }) {
  return (
    <div className="mode-selector">
      <h2 className="mode-title">Choose Analysis Mode</h2>
      <div className="mode-cards">
        <button
          className={`mode-card ${mode === "events" ? "active" : ""}`}
          onClick={() => onChange("events")}
        >
          <div className="mode-icon">⚽</div>
          <h3>Event Detection</h3>
          <p>Detect goals, fouls, cards, corners and 13 other events with timestamps.</p>
          <span className="mode-badge">AI-Powered · Instant Results</span>
        </button>

        <button
          className={`mode-card ${mode === "tracking" ? "active" : ""}`}
          onClick={() => onChange("tracking")}
        >
          <div className="mode-icon">🎯</div>
          <h3>Tactical Tracking</h3>
          <p>Track every player & ball, assign teams, measure speed, distance and possession.</p>
          <span className="mode-badge">Real-Time · Annotated Video</span>
        </button>
      </div>
    </div>
  );
}