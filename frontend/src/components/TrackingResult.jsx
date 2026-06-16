// frontend/src/components/TrackingResult.jsx
import React from "react";
import "./TrackingResult.css";

export default function TrackingResult({ apiUrl, results, onReset }) {
  const { stats = {}, video_url, id, video_filename, report_url } = results || {};
  const videoSrc = `${apiUrl}${video_url}`;

  const c1 = "#3b82f6";
  const c2 = "#ef4444";

  return (
    <div className="tracking-result">
      {/* Header */}
      <div className="tracking-header">
        <div>
          <div className="status-badge">
            <span className="dot"></span> ANALYSIS COMPLETE
          </div>
          <h2 className="tracking-title">Tactical Tracking Result</h2>
          {video_filename && <div className="tracking-subtitle">📄 {video_filename}</div>}
        </div>
        <div className="tracking-actions">
          <a className="btn" href={videoSrc} download={`tracked_${id}.mp4`}>
            ⬇ Download Video
          </a>
          {report_url && (
            <a className="btn" href={`${apiUrl}${report_url}`} download={`report_${id}.html`}>
              📄 Download Report
            </a>
          )}
          <button className="btn primary" onClick={onReset}>
            + New Video
          </button>
        </div>
      </div>

      {/* Video player */}
      <video
        className="tracking-video"
        src={videoSrc}
        controls
        playsInline
        preload="metadata"
      />

      {/* Quick stats */}
      <div className="stats-grid">
        <Stat label="Duration"
          value={stats.duration_seconds ? `${stats.duration_seconds.toFixed(1)}s` : "—"} />
        <Stat label="Players Tracked" value={stats.num_players_tracked ?? "—"} />
      </div>

      {/* Team comparison table */}
      {stats.team1_possession_pct != null && (
        <div className="team-comparison">
          <table className="team-table">
            <thead>
              <tr>
                <th className="team-th-stat" />
                <th className="team-th">
                  <span className="team-dot" style={{ background: c1 }} /> Team 1
                </th>
                <th className="team-th">
                  <span className="team-dot" style={{ background: c2 }} /> Team 2
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="team-td-label">Possession</td>
                <td className="team-td" style={{ color: c1 }}>{stats.team1_possession_pct}%</td>
                <td className="team-td" style={{ color: c2 }}>{stats.team2_possession_pct}%</td>
              </tr>
              <tr>
                <td className="team-td-label">Passes</td>
                <td className="team-td" style={{ color: c1 }}>{stats.team1_passes ?? "—"}</td>
                <td className="team-td" style={{ color: c2 }}>{stats.team2_passes ?? "—"}</td>
              </tr>
              <tr>
                <td className="team-td-label">Total Distance</td>
                <td className="team-td" style={{ color: c1 }}>
                  {stats.team1_total_distance_m != null ? `${stats.team1_total_distance_m} m` : "—"}
                </td>
                <td className="team-td" style={{ color: c2 }}>
                  {stats.team2_total_distance_m != null ? `${stats.team2_total_distance_m} m` : "—"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Possession bar */}
      {stats.team1_possession_pct != null && (
        <>
          <div className="possession-labels">
            <TeamLabel color={c1} label="Team 1" pct={stats.team1_possession_pct} />
            <TeamLabel color={c2} label="Team 2" pct={stats.team2_possession_pct} align="right" />
          </div>
          <div className="possession-bar">
            <div
              className="possession-bar-seg"
              style={{ width: `${stats.team1_possession_pct}%`, background: c1 }}
            />
            <div
              className="possession-bar-seg"
              style={{ width: `${stats.team2_possession_pct}%`, background: c2 }}
            />
          </div>
        </>
      )}

      {/* Match analysis report */}
      {report_url && (
        <div className="report-section">
          <h3 className="report-title">📊 Match Analysis Report</h3>
          <iframe
            src={`${apiUrl}${report_url}`}
            className="report-frame"
            title="Match Analysis Report"
          />
        </div>
      )}

    </div>
  );
}

const TeamLabel = ({ color, label, pct, align }) => (
  <div style={{
    display: "flex", alignItems: "center", gap: "0.4rem",
    justifyContent: align === "right" ? "flex-end" : "flex-start",
  }}>
    <span style={{
      width: 10, height: 10, borderRadius: "50%",
      background: color, display: "inline-block", flexShrink: 0,
    }} />
    <span style={{ color: color, fontSize: "0.82rem", fontWeight: 600 }}>
      {label}
    </span>
    <span style={{ color: "#64748b", fontSize: "0.82rem" }}>{pct}%</span>
  </div>
);

const Stat = ({ label, value, color, teamColor }) => (
  <div className="stat-card">
    <div className="stat-value" style={color ? { color } : undefined}>
      {teamColor && (
        <span style={{
          display: "inline-block", width: 10, height: 10,
          borderRadius: "50%", background: teamColor,
          marginRight: "0.4rem", verticalAlign: "middle",
          boxShadow: `0 0 6px ${teamColor}88`,
        }} />
      )}
      {value}
    </div>
    <div className="stat-label">{label}</div>
  </div>
);

