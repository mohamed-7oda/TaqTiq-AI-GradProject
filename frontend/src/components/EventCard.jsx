import React from "react";

const EVENT_CONFIG = {
  Goal: { icon: "⚽", color: "#22c55e", gradient: "linear-gradient(135deg, #22c55e, #16a34a)" },
  Penalty: { icon: "🎯", color: "#f43f5e", gradient: "linear-gradient(135deg, #f43f5e, #be123c)" },
  "Kick-off": { icon: "🏁", color: "#3b82f6", gradient: "linear-gradient(135deg, #3b82f6, #1e40af)" },
  Substitution: { icon: "🔄", color: "#8b5cf6", gradient: "linear-gradient(135deg, #8b5cf6, #6d28d9)" },
  Offside: { icon: "🚩", color: "#f59e0b", gradient: "linear-gradient(135deg, #f59e0b, #d97706)" },
  "Shots on target": { icon: "🎯", color: "#06b6d4", gradient: "linear-gradient(135deg, #06b6d4, #0891b2)" },
  "Shots off target": { icon: "❌", color: "#94a3b8", gradient: "linear-gradient(135deg, #94a3b8, #64748b)" },
  Clearance: { icon: "🦵", color: "#a855f7", gradient: "linear-gradient(135deg, #a855f7, #7e22ce)" },
  "Ball out of play": { icon: "⏸️", color: "#64748b", gradient: "linear-gradient(135deg, #64748b, #475569)" },
  "Throw-in": { icon: "👐", color: "#0ea5e9", gradient: "linear-gradient(135deg, #0ea5e9, #0284c7)" },
  Foul: { icon: "⚠️", color: "#f97316", gradient: "linear-gradient(135deg, #f97316, #c2410c)" },
  "Indirect free-kick": { icon: "🦶", color: "#84cc16", gradient: "linear-gradient(135deg, #84cc16, #65a30d)" },
  "Direct free-kick": { icon: "🦶", color: "#10b981", gradient: "linear-gradient(135deg, #10b981, #059669)" },
  Corner: { icon: "🚩", color: "#ec4899", gradient: "linear-gradient(135deg, #ec4899, #be185d)" },
  "Yellow card": { icon: "🟨", color: "#eab308", gradient: "linear-gradient(135deg, #eab308, #ca8a04)" },
  "Red card": { icon: "🟥", color: "#dc2626", gradient: "linear-gradient(135deg, #dc2626, #991b1b)" },
  "Yellow->red card": { icon: "🟨🟥", color: "#dc2626", gradient: "linear-gradient(135deg, #eab308, #dc2626)" },
};

function EventCard({ event, index, onClick }) {
  const config = EVENT_CONFIG[event.label] || { icon: "⚪", color: "#94a3b8", gradient: "linear-gradient(135deg, #94a3b8, #64748b)" };
  const totalSec = event.position_seconds;
  const min = Math.floor(totalSec / 60);
  const sec = Math.floor(totalSec % 60);

  // Confidence styling
  let confColor = "#22c55e";
  let confLabel = "High";
  if (event.confidence < 0.7) { confColor = "#f59e0b"; confLabel = "Med"; }
  if (event.confidence < 0.4) { confColor = "#ef4444"; confLabel = "Low"; }

  const animDelay = Math.min(index * 0.03, 1.5);

  return (
    <div
      className="event-card"
      style={{ animationDelay: `${animDelay}s`, cursor: onClick ? "pointer" : undefined }}
      onClick={onClick}
    >
      <div className="event-accent" style={{ background: config.gradient }}></div>

      <div className="event-content">
        <div className="event-icon-wrapper" style={{ background: `${config.color}15`, border: `1px solid ${config.color}30` }}>
          <span className="event-icon">{config.icon}</span>
        </div>

        <div className="event-info">
          <div className="event-label" style={{ color: '#f1f5f9' }}>{event.label}</div>
          <div className="event-meta">
            <span className="event-half">H{event.half}</span>
            <span className="dot">·</span>
            <span className="event-time">
              {min}:{String(sec).padStart(2, "0")}
            </span>
            {event.team && event.team !== "Unknown" && (
              <>
                <span className="dot">·</span>
                <span
                  className="event-team"
                  style={{
                    background: event.team === "Team 1" ? "#3b82f6" : "#ef4444",
                    borderColor: event.team === "Team 1" ? "#3b82f6" : "#ef4444",
                    color: "#fff",
                    boxShadow: event.team === "Team 1" ? "0 2px 8px rgba(59,130,246,0.35)" : "0 2px 8px rgba(239,68,68,0.35)",
                  }}
                >
                  <span
                    className="team-dot"
                    style={{ background: "rgba(255,255,255,0.7)" }}
                  />
                  {event.team}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="event-conf-wrapper">
          <div className="conf-circle" style={{ background: `${confColor}20`, border: `2px solid ${confColor}` }}>
            <span style={{ color: confColor }}>{(event.confidence * 100).toFixed(0)}</span>
          </div>
          <div className="conf-label" style={{ color: confColor }}>{confLabel}</div>
        </div>
      </div>

      {onClick && <div className="event-seek-badge">▶ Jump</div>}

      <style>{`
        .event-card {
          position: relative;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          overflow: hidden;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          animation: cardIn 0.5s ease backwards;
        }

        @keyframes cardIn {
          from { opacity: 0; transform: translateY(15px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .event-card:hover {
          transform: translateY(-3px) scale(1.01);
          background: rgba(255, 255, 255, 0.05);
          border-color: rgba(255, 255, 255, 0.12);
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.3);
        }

        .event-accent {
          height: 3px;
          width: 100%;
          opacity: 0.8;
        }

        .event-content {
          display: flex;
          align-items: center;
          gap: 0.85rem;
          padding: 0.95rem 1rem;
        }

        .event-icon-wrapper {
          width: 42px;
          height: 42px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: transform 0.3s;
        }

        .event-card:hover .event-icon-wrapper {
          transform: scale(1.08) rotate(-3deg);
        }

        .event-icon {
          font-size: 1.4rem;
          line-height: 1;
        }

        .event-info {
          flex: 1;
          min-width: 0;
          overflow: hidden;
        }

        .event-label {
          font-weight: 600;
          font-size: 0.92rem;
          margin-bottom: 0.25rem;
          letter-spacing: -0.01em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .event-meta {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          color: #64748b;
          font-size: 0.8rem;
        }

        .event-half {
          background: rgba(255, 255, 255, 0.05);
          padding: 0.1rem 0.45rem;
          border-radius: 4px;
          font-weight: 600;
          font-size: 0.7rem;
          color: #94a3b8;
          letter-spacing: 0.05em;
        }

        .dot { opacity: 0.4; }

        .event-team {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 0.15rem 0.5rem;
          border-radius: 999px;
          border: 1px solid transparent;
          font-size: 0.68rem;
          font-weight: 700;
          letter-spacing: 0.03em;
          white-space: nowrap;
          transition: transform 0.15s;
        }

        .event-card:hover .event-team {
          transform: scale(1.05);
        }

        .team-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          flex-shrink: 0;
          opacity: 0.8;
        }

        .event-time {
          font-family: 'JetBrains Mono', 'Space Grotesk', monospace;
          font-weight: 600;
          font-size: 0.85rem;
          color: #cbd5e1;
          font-variant-numeric: tabular-nums;
        }

        .event-conf-wrapper {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.2rem;
          flex-shrink: 0;
        }

        .conf-circle {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Space Grotesk', sans-serif;
          font-weight: 700;
          font-size: 0.8rem;
        }

        .conf-label {
          font-size: 0.65rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .event-seek-badge {
          position: absolute;
          bottom: 8px; right: 10px;
          font-size: 0.62rem;
          font-weight: 700;
          letter-spacing: 0.06em;
          color: #3b82f6;
          opacity: 0;
          transition: opacity 0.2s;
          text-transform: uppercase;
          pointer-events: none;
        }

        .event-card:hover .event-seek-badge { opacity: 1; }
      `}</style>
    </div>
  );
}

export default EventCard;