import React, { useState, useMemo, useRef } from "react";
import EventCard from "./EventCard";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

function EventsList({ results, onReset }) {
  const [filterClass, setFilterClass] = useState("all");
  const [minConfidence, setMinConfidence] = useState(0.0);
  const [sortBy, setSortBy] = useState("time");
  const [searchQuery, setSearchQuery] = useState("");
  const [videoError, setVideoError] = useState(false);
  const [seekFlash, setSeekFlash] = useState(false);
  const [isAnnotated, setIsAnnotated] = useState(true);
  const videoRef = useRef(null);


  const annotatedSrc = `${API_URL}/api/annotated_video/${results.id}`;
  const originalSrc  = `${API_URL}/api/original_video/${results.id}`;
  const videoSrc     = isAnnotated ? annotatedSrc : originalSrc;

  const handleVideoError = () => {
    if (isAnnotated) {
      setIsAnnotated(false); // silently fall back to original
    } else {
      setVideoError(true);
    }
  };

  const seekTo = (seconds) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = seconds;
    v.play().catch(() => {});
    v.scrollIntoView({ behavior: "smooth", block: "center" });
    setSeekFlash(true);
    setTimeout(() => setSeekFlash(false), 600);
  };

  const filteredEvents = useMemo(() => {
    let evts = results.events || [];
    if (filterClass !== "all") evts = evts.filter((e) => e.label === filterClass);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      evts = evts.filter((e) => e.label.toLowerCase().includes(q));
    }
    evts = evts.filter((e) => e.confidence >= minConfidence);
    if (sortBy === "time") evts = [...evts].sort((a, b) => a.position_ms - b.position_ms);
    else if (sortBy === "confidence") evts = [...evts].sort((a, b) => b.confidence - a.confidence);
    return evts;
  }, [results, filterClass, minConfidence, sortBy, searchQuery]);

  const eventTypes = Object.keys(results.event_counts || {}).sort(
    (a, b) => results.event_counts[b] - results.event_counts[a]
  );

  const downloadJSON = () => {
    const blob = new Blob([JSON.stringify(results, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `predictions_${results.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="results-container">
      <div className="results-header">
        <div className="header-info">
          <div className="success-badge">
            <span className="check-icon">✓</span>
            Analysis Complete
          </div>
          <h2>
            <span className="big-number">{results.total_events}</span>
            <span className="title-text">Events Detected</span>
          </h2>
          <p className="filename">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            {results.video_filename}
          </p>
        </div>
        <div className="header-actions">
          <button className="btn-secondary" onClick={downloadJSON}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Download JSON
          </button>
          <button className="btn-primary" onClick={onReset}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            New Video
          </button>
        </div>
      </div>

      {/* ── Seekable match video ── */}
      {!videoError && (
        <div className={`match-video-wrap ${seekFlash ? "mv-flash" : ""}`}>
          <div className="mv-header">
            <span className="mv-title">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
              Match Video
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              {isAnnotated && (
                <span className="mv-annotated-badge">✦ Annotated</span>
              )}
              <span className="mv-hint">Click any event below to jump to that moment</span>
            </div>
          </div>
          <video
            ref={videoRef}
            className="match-video"
            src={videoSrc}
            controls
            playsInline
            preload="metadata"
            onError={handleVideoError}
          />
        </div>
      )}

      <div className="stats-grid">
        {eventTypes.slice(0, 6).map((type, idx) => (
          <div key={type} className="stat-card" style={{ animationDelay: `${idx * 0.05}s` }}>
            <div className="stat-count">{results.event_counts[type]}</div>
            <div className="stat-label">{type}</div>
            <div className="stat-bar">
              <div
                className="stat-bar-fill"
                style={{ width: `${(results.event_counts[type] / results.total_events) * 100}%` }}
              ></div>
            </div>
          </div>
        ))}
      </div>

      <div className="filters">
        <div className="filter-group search-group">
          <label>Search</label>
          <div className="search-wrapper">
            <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              placeholder="Search events..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="filter-group">
          <label>Event Type</label>
          <select value={filterClass} onChange={(e) => setFilterClass(e.target.value)}>
            <option value="all">All ({results.total_events})</option>
            {eventTypes.map((type) => (
              <option key={type} value={type}>{type} ({results.event_counts[type]})</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Min Confidence: <strong>{(minConfidence * 100).toFixed(0)}%</strong></label>
          <input
            type="range" min="0" max="1" step="0.05"
            value={minConfidence}
            onChange={(e) => setMinConfidence(parseFloat(e.target.value))}
          />
        </div>

        <div className="filter-group">
          <label>Sort By</label>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="time">⏱️ Time</option>
            <option value="confidence">📊 Confidence</option>
          </select>
        </div>
      </div>

      <div className="results-meta">
        <span>Showing <strong>{filteredEvents.length}</strong> of {results.total_events} events</span>
      </div>

      <div className="events-grid">
        {filteredEvents.map((event, i) => (
          <EventCard
            key={i}
            event={event}
            index={i}
            onClick={!videoError ? () => seekTo(event.position_seconds) : undefined}
          />
        ))}
      </div>

      {filteredEvents.length === 0 && (
        <div className="empty">
          <div className="empty-icon">🔍</div>
          <h3>No events match your filters</h3>
          <p>Try lowering the minimum confidence or changing the event type</p>
        </div>
      )}

      <style>{`
        .results-container { width: 100%; animation: fadeIn 0.5s ease; }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes mvFlash {
          0%   { box-shadow: 0 0 0 0 rgba(59,130,246,0); border-color: rgba(255,255,255,0.06); }
          30%  { box-shadow: 0 0 0 6px rgba(59,130,246,0.25); border-color: rgba(59,130,246,0.5); }
          100% { box-shadow: 0 0 0 0 rgba(59,130,246,0); border-color: rgba(255,255,255,0.06); }
        }

        .results-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          flex-wrap: wrap;
          gap: 2rem;
          margin-bottom: 2rem;
          padding-bottom: 2rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .success-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          background: rgba(34, 197, 94, 0.1);
          border: 1px solid rgba(34, 197, 94, 0.25);
          color: #4ade80;
          padding: 0.35rem 0.9rem;
          border-radius: 999px;
          font-size: 0.75rem;
          font-weight: 600;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          margin-bottom: 1rem;
        }

        .check-icon {
          width: 16px; height: 16px;
          background: #22c55e; color: white;
          border-radius: 50%;
          display: inline-flex; align-items: center; justify-content: center;
          font-size: 0.7rem; font-weight: 800;
        }

        .results-header h2 {
          display: flex; align-items: baseline; gap: 0.75rem;
          flex-wrap: wrap; margin-bottom: 0.5rem;
        }

        .big-number {
          font-family: 'Space Grotesk', sans-serif;
          font-size: 3.5rem; font-weight: 800;
          background: linear-gradient(135deg, #60a5fa, #a78bfa, #34d399);
          -webkit-background-clip: text; background-clip: text;
          -webkit-text-fill-color: transparent;
          letter-spacing: -0.04em; line-height: 1;
        }

        .title-text { font-size: 1.5rem; color: #cbd5e1; font-weight: 600; }

        .filename {
          display: inline-flex; align-items: center; gap: 0.5rem;
          color: #64748b; font-size: 0.9rem;
          font-family: 'JetBrains Mono', monospace;
        }

        .header-actions { display: flex; gap: 0.75rem; flex-wrap: wrap; }
        .header-actions button {
          display: inline-flex; align-items: center; gap: 0.5rem;
        }

        /* ── Match Video Player ── */
        .match-video-wrap {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 16px;
          overflow: hidden;
          margin-bottom: 2rem;
          transition: border-color 0.3s, box-shadow 0.3s;
        }

        .mv-flash {
          animation: mvFlash 0.6s ease;
        }

        .mv-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 18px;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          flex-wrap: wrap;
          gap: 8px;
        }

        .mv-title {
          display: flex; align-items: center; gap: 6px;
          color: #e2e8f0; font-size: 0.85rem; font-weight: 600;
        }

        .mv-hint {
          color: #475569; font-size: 0.78rem;
        }

        .mv-annotated-badge {
          display: inline-flex; align-items: center; gap: 4px;
          background: rgba(139, 92, 246, 0.15);
          border: 1px solid rgba(139, 92, 246, 0.35);
          color: #a78bfa;
          font-size: 0.7rem; font-weight: 700;
          letter-spacing: 0.06em; text-transform: uppercase;
          padding: 3px 9px; border-radius: 999px;
        }

        .match-video {
          width: 100%;
          max-height: 520px;
          display: block;
          background: #000;
        }

        /* ── Stats grid ── */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 1rem;
          margin-bottom: 2rem;
        }

        .stat-card {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          padding: 1.25rem; border-radius: 14px;
          transition: all 0.3s; position: relative; overflow: hidden;
          animation: slideUp 0.5s ease backwards;
        }

        .stat-card::before {
          content: ''; position: absolute;
          top: 0; left: 0; right: 0; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(96,165,250,0.4), transparent);
          opacity: 0; transition: opacity 0.3s;
        }

        .stat-card:hover {
          transform: translateY(-3px);
          background: rgba(255,255,255,0.05);
          border-color: rgba(96,165,250,0.2);
        }
        .stat-card:hover::before { opacity: 1; }

        .stat-count {
          font-family: 'Space Grotesk', sans-serif;
          font-size: 2.4rem; font-weight: 800;
          color: #f1f5f9; line-height: 1;
          margin-bottom: 0.4rem; letter-spacing: -0.03em;
        }

        .stat-label {
          font-size: 0.78rem; color: #94a3b8; font-weight: 500;
          margin-bottom: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em;
        }

        .stat-bar {
          height: 4px; background: rgba(255,255,255,0.05);
          border-radius: 999px; overflow: hidden;
        }

        .stat-bar-fill {
          height: 100%;
          background: linear-gradient(90deg, #3b82f6, #8b5cf6);
          border-radius: 999px; transition: width 0.6s ease;
        }

        /* ── Filters ── */
        .filters {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr 1fr;
          gap: 1.25rem;
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.05);
          padding: 1.5rem; border-radius: 14px; margin-bottom: 1.5rem;
        }

        @media (max-width: 900px) { .filters { grid-template-columns: 1fr 1fr; } }
        @media (max-width: 500px) { .filters { grid-template-columns: 1fr; } }

        .filter-group { display: flex; flex-direction: column; gap: 0.5rem; }

        .filter-group label {
          font-size: 0.75rem; color: #94a3b8; font-weight: 600;
          text-transform: uppercase; letter-spacing: 0.08em;
        }

        .filter-group label strong { color: #60a5fa; font-weight: 700; }

        .filter-group select,
        .filter-group input[type="text"] {
          padding: 0.65rem 0.85rem;
          background: rgba(15,23,41,0.6);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px; color: #e2e8f0;
          font-size: 0.9rem; font-family: inherit;
          outline: none; transition: all 0.2s; width: 100%;
        }

        .filter-group select:hover,
        .filter-group select:focus,
        .filter-group input[type="text"]:focus {
          border-color: rgba(96,165,250,0.4);
          background: rgba(15,23,41,0.9);
        }

        .filter-group select option { background: #0f1729; color: #e2e8f0; }

        .search-wrapper { position: relative; }

        .search-icon {
          position: absolute; left: 0.85rem; top: 50%;
          transform: translateY(-50%); color: #64748b; pointer-events: none;
        }

        .search-wrapper input { padding-left: 2.4rem !important; }

        .filter-group input[type="range"] {
          width: 100%; appearance: none; height: 6px;
          background: rgba(255,255,255,0.08);
          border-radius: 999px; outline: none; cursor: pointer;
        }

        .filter-group input[type="range"]::-webkit-slider-thumb {
          appearance: none; width: 18px; height: 18px;
          background: linear-gradient(135deg, #3b82f6, #8b5cf6);
          border-radius: 50%; cursor: pointer;
          box-shadow: 0 2px 8px rgba(59,130,246,0.5);
          transition: transform 0.2s;
        }

        .filter-group input[type="range"]::-webkit-slider-thumb:hover { transform: scale(1.15); }

        .filter-group input[type="range"]::-moz-range-thumb {
          width: 18px; height: 18px;
          background: linear-gradient(135deg, #3b82f6, #8b5cf6);
          border: none; border-radius: 50%; cursor: pointer;
          box-shadow: 0 2px 8px rgba(59,130,246,0.5);
        }

        .results-meta {
          color: #94a3b8; font-size: 0.9rem;
          margin-bottom: 1.25rem; padding-left: 0.25rem;
        }
        .results-meta strong { color: #60a5fa; font-weight: 700; }

        .events-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 0.85rem;
        }

        .empty {
          text-align: center; padding: 4rem 2rem;
          background: rgba(255,255,255,0.02);
          border: 1px dashed rgba(255,255,255,0.1);
          border-radius: 16px;
        }

        .empty-icon { font-size: 3.5rem; margin-bottom: 1rem; opacity: 0.6; }
        .empty h3 { color: #cbd5e1; font-size: 1.2rem; font-weight: 600; margin-bottom: 0.4rem; }
        .empty p { color: #64748b; font-size: 0.9rem; }

      `}</style>
    </div>
  );
}

export default EventsList;
