import React, { useState, useEffect, useRef, useMemo } from "react";

// Standard pitch dimensions (metres)
const PM_W = 105;
const PM_H = 68;

// Draw pitch lines into an SVG <g>, with coordinates normalized 0→1 scaled to viewW×viewH
function PitchLines({ viewW, viewH }) {
  const px = (m) => (m / PM_W) * viewW;
  const py = (m) => (m / PM_H) * viewH;
  return (
    <g stroke="rgba(255,255,255,0.55)" strokeWidth="1.5" fill="none" strokeLinecap="round">
      <rect x={2} y={2} width={viewW - 4} height={viewH - 4} />
      <line x1={px(52.5)} y1={2} x2={px(52.5)} y2={viewH - 2} />
      <circle cx={px(52.5)} cy={py(34)} r={py(9.15)} />
      <circle cx={px(52.5)} cy={py(34)} r={3.5} fill="white" stroke="none" />
      {/* Left penalty area */}
      <rect x={2} y={py(13.84)} width={px(16.5)} height={py(40.32)} />
      <rect x={2} y={py(24.84)} width={px(5.5)} height={py(18.32)} />
      {/* Right penalty area */}
      <rect x={viewW - 2 - px(16.5)} y={py(13.84)} width={px(16.5)} height={py(40.32)} />
      <rect x={viewW - 2 - px(5.5)} y={py(24.84)} width={px(5.5)} height={py(18.32)} />
      {/* Penalty spots */}
      <circle cx={px(11)} cy={py(34)} r={3} fill="white" stroke="none" />
      <circle cx={px(94)} cy={py(34)} r={3} fill="white" stroke="none" />
      {/* Goals */}
      <rect x={0} y={py(30.34)} width={3} height={py(7.32)} fill="rgba(255,255,255,0.5)" stroke="none" />
      <rect x={viewW - 3} y={py(30.34)} width={3} height={py(7.32)} fill="rgba(255,255,255,0.5)" stroke="none" />
    </g>
  );
}

// Grass stripes background
function GrassStripes({ viewW, viewH, count = 7 }) {
  return (
    <>
      <rect width={viewW} height={viewH} fill="#1b4d1b" />
      {Array.from({ length: count }).map((_, i) => (
        <rect key={i} x={i * (viewW / count)} y={0}
          width={viewW / (count * 2)} height={viewH}
          fill="rgba(0,0,0,0.04)" />
      ))}
    </>
  );
}

// ── Heatmap ────────────────────────────────────────────────────────────────────
function HeatmapCanvas({ heatmap, color, label }) {
  const canvasRef = useRef(null);
  const VW = 640, VH = 416;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !heatmap?.length) return;
    const ctx = canvas.getContext("2d");
    const ROWS = heatmap.length;
    const COLS = heatmap[0]?.length ?? 0;
    if (!COLS) return;

    const cellW = VW / COLS;
    const cellH = VH / ROWS;
    const hex = color.replace("#", "");
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);

    ctx.fillStyle = "#1b4d1b";
    ctx.fillRect(0, 0, VW, VH);

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const val = heatmap[row][col] ?? 0;
        if (val < 0.02) continue;
        ctx.fillStyle = `rgba(${r},${g},${b},${Math.min(1, val * 0.9)})`;
        ctx.fillRect(col * cellW, row * cellH, cellW + 1, cellH + 1);
      }
    }
  }, [heatmap, color]);

  return (
    <div style={{ position: "relative", borderRadius: 10, overflow: "hidden",
      border: "1px solid rgba(255,255,255,0.1)" }}>
      {/* Blurred heatmap canvas */}
      <canvas ref={canvasRef} width={VW} height={VH}
        style={{ width: "100%", height: "auto", display: "block",
          filter: "blur(10px) contrast(1.35)" }} />
      {/* Crisp pitch lines on top */}
      <svg viewBox={`0 0 ${VW} ${VH}`} style={{
        position: "absolute", inset: 0, width: "100%", height: "100%",
        pointerEvents: "none",
      }}>
        <PitchLines viewW={VW} viewH={VH} />
      </svg>
      {/* Team label */}
      <div style={{
        position: "absolute", top: 10, left: 10, zIndex: 2,
        background: "rgba(0,0,0,0.72)", borderRadius: 6,
        padding: "3px 12px", fontSize: "0.78rem", fontWeight: 700, color,
        border: `1px solid ${color}44`,
      }}>{label}</div>
    </div>
  );
}

function HeatmapTab({ hm1, hm2, c1, c2 }) {
  return (
    <div>
      <p style={{ color: "#64748b", fontSize: "0.82rem", marginBottom: "1rem", textAlign: "center" }}>
        Brighter areas show where each team spent more time during the match.
      </p>
      <div className="ta-heatmap-grid">
        <HeatmapCanvas heatmap={hm1} color={c1} label="Team 1" />
        <HeatmapCanvas heatmap={hm2} color={c2} label="Team 2" />
      </div>
    </div>
  );
}

// ── Passing Network ────────────────────────────────────────────────────────────
function NetworkTab({ passNetwork, avgPositions, c1, c2 }) {
  const VW = 820, VH = 533;

  const posMap = useMemo(() => {
    const m = {};
    (avgPositions || []).forEach(p => { m[p.player_id] = p; });
    return m;
  }, [avgPositions]);

  const maxCount = useMemo(() =>
    Math.max(1, ...(passNetwork || []).map(p => p.count)),
    [passNetwork]);

  const topConnections = useMemo(() =>
    [...(passNetwork || [])].sort((a, b) => b.count - a.count).slice(0, 30),
    [passNetwork]);

  if (!passNetwork?.length) {
    return <EmptyState msg="Not enough passing data was captured for this match." />;
  }

  return (
    <div>
      <p style={{ color: "#64748b", fontSize: "0.82rem", marginBottom: "1rem", textAlign: "center" }}>
        Lines show ball transfers between players — thicker means more passes.
        Numbers are tracking IDs.
      </p>
      <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)" }}>
        <svg viewBox={`0 0 ${VW} ${VH}`} style={{ width: "100%", height: "auto", display: "block" }}>
          <GrassStripes viewW={VW} viewH={VH} />
          <PitchLines viewW={VW} viewH={VH} />

          {/* Pass lines */}
          {topConnections.map(({ from, to, team, count }, i) => {
            const fp = posMap[from], tp = posMap[to];
            if (!fp || !tp) return null;
            const ratio = count / maxCount;
            const color = team === 1 ? c1 : c2;
            return (
              <line key={i}
                x1={fp.x * VW} y1={fp.y * VH}
                x2={tp.x * VW} y2={tp.y * VH}
                stroke={color}
                strokeWidth={Math.max(1.5, ratio * 9)}
                strokeOpacity={0.25 + ratio * 0.65}
                strokeLinecap="round"
              />
            );
          })}

          {/* Player dots */}
          {(avgPositions || []).map(p => {
            const color = p.team === 1 ? c1 : c2;
            const x = p.x * VW;
            const y = p.y * VH;
            return (
              <g key={p.player_id}>
                <circle cx={x} cy={y} r={16} fill={color} opacity={0.18} />
                <circle cx={x} cy={y} r={11} fill={color} opacity={0.92}
                  stroke="rgba(255,255,255,0.75)" strokeWidth={1.5} />
                <text x={x} y={y + 4.5} textAnchor="middle"
                  fontSize={10} fill="white" fontWeight="700" fontFamily="monospace">
                  {p.player_id}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

// ── Average Positions ──────────────────────────────────────────────────────────
function PositionsTab({ avgPositions, c1, c2 }) {
  const VW = 820, VH = 533;

  if (!avgPositions?.length) {
    return <EmptyState msg="No position data was captured for this match." />;
  }

  return (
    <div>
      <p style={{ color: "#64748b", fontSize: "0.82rem", marginBottom: "1rem", textAlign: "center" }}>
        Each dot shows a player's average pitch position over the full match.
      </p>
      <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)" }}>
        <svg viewBox={`0 0 ${VW} ${VH}`} style={{ width: "100%", height: "auto", display: "block" }}>
          <GrassStripes viewW={VW} viewH={VH} />
          <PitchLines viewW={VW} viewH={VH} />

          {(avgPositions || []).map(p => {
            const color = p.team === 1 ? c1 : c2;
            const x = p.x * VW;
            const y = p.y * VH;
            return (
              <g key={p.player_id}>
                {/* Outer glow */}
                <circle cx={x} cy={y} r={22} fill={color} opacity={0.1} />
                <circle cx={x} cy={y} r={14} fill={color} opacity={0.22} />
                {/* Main dot */}
                <circle cx={x} cy={y} r={12} fill={color} opacity={0.93}
                  stroke="rgba(255,255,255,0.8)" strokeWidth={1.8} />
                <text x={x} y={y + 4.5} textAnchor="middle"
                  fontSize={10} fill="white" fontWeight="700" fontFamily="monospace">
                  {p.player_id}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Team legend */}
      <div style={{ display: "flex", justifyContent: "center", gap: "1.5rem", marginTop: "0.85rem" }}>
        {[{ color: c1, label: "Team 1" }, { color: c2, label: "Team 2" }].map(({ color, label }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
            <span style={{ width: 12, height: 12, borderRadius: "50%",
              background: color, display: "inline-block",
              boxShadow: `0 0 6px ${color}88` }} />
            <span style={{ color: "#94a3b8", fontSize: "0.82rem", fontWeight: 600 }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyState({ msg }) {
  return (
    <div style={{ textAlign: "center", padding: "2.5rem 1rem", color: "#475569", fontSize: "0.88rem" }}>
      {msg}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
const TABS = [
  { id: "heatmap",   label: "🔥 Heatmap",      key: "hm1" },
  { id: "network",   label: "🔗 Pass Network",  key: "network" },
  { id: "positions", label: "📍 Avg Positions", key: "positions" },
];

export default function TrackingAnalytics({ stats, c1, c2 }) {
  const hm1      = stats.team1_heatmap        || [];
  const hm2      = stats.team2_heatmap        || [];
  const network  = stats.pass_network         || [];
  const positions = stats.player_avg_positions || [];

  const available = {
    heatmap:   hm1.length > 0,
    network:   network.length > 0,
    positions: positions.length > 0,
  };

  const firstAvailable = TABS.find(t => available[t.id])?.id;
  const [tab, setTab] = useState(firstAvailable || "heatmap");

  if (!firstAvailable) return null;

  return (
    <div className="ta-wrap">
      {/* Header */}
      <div className="ta-header">
        <h3 className="ta-title">⚽ Tactical Analytics</h3>
        <div className="ta-tabs">
          {TABS.filter(t => available[t.id]).map(t => (
            <button key={t.id}
              className={`ta-tab ${tab === t.id ? "ta-tab-active" : ""}`}
              onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="ta-content">
        {tab === "heatmap"   && <HeatmapTab hm1={hm1} hm2={hm2} c1={c1} c2={c2} />}
        {tab === "network"   && <NetworkTab passNetwork={network} avgPositions={positions} c1={c1} c2={c2} />}
        {tab === "positions" && <PositionsTab avgPositions={positions} c1={c1} c2={c2} />}
      </div>

      <style>{`
        .ta-wrap {
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 20px; overflow: hidden;
          margin-top: 2rem;
        }

        .ta-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 1.1rem 1.5rem; flex-wrap: wrap; gap: 0.75rem;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          background: rgba(255,255,255,0.02);
        }

        .ta-title {
          color: #f1f5f9; font-size: 1rem; font-weight: 700; margin: 0;
          letter-spacing: -0.01em;
        }

        .ta-tabs {
          display: flex; gap: 0.4rem; flex-wrap: wrap;
        }

        .ta-tab {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.08);
          color: #94a3b8; padding: 0.45rem 1rem;
          border-radius: 8px; font-size: 0.82rem; font-weight: 600;
          cursor: pointer; transition: all 0.2s;
        }
        .ta-tab:hover {
          background: rgba(255,255,255,0.1); color: #cbd5e1;
        }
        .ta-tab-active {
          background: rgba(59,130,246,0.15) !important;
          border-color: rgba(59,130,246,0.4) !important;
          color: #93c5fd !important;
        }

        .ta-content {
          padding: 1.5rem;
        }

        .ta-heatmap-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }

        @media (max-width: 640px) {
          .ta-heatmap-grid { grid-template-columns: 1fr; }
          .ta-header { flex-direction: column; align-items: flex-start; }
        }
      `}</style>
    </div>
  );
}
