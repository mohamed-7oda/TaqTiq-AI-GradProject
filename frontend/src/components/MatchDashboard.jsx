import React, { useState, useMemo } from "react";

const MIN_CONF = 0.50;

const EVENT_COLORS = {
  "Goal": "#22c55e", "Penalty": "#f43f5e", "Kick-off": "#3b82f6",
  "Substitution": "#8b5cf6", "Offside": "#f59e0b",
  "Shots on target": "#06b6d4", "Shots off target": "#94a3b8",
  "Clearance": "#a855f7", "Ball out of play": "#64748b",
  "Throw-in": "#0ea5e9", "Foul": "#f97316",
  "Indirect free-kick": "#84cc16", "Direct free-kick": "#10b981",
  "Corner": "#ec4899", "Yellow card": "#eab308",
  "Red card": "#dc2626", "Yellow->red card": "#dc2626",
};
const EVENT_ICONS = {
  "Goal": "⚽", "Penalty": "🎯", "Kick-off": "🏁", "Substitution": "🔄",
  "Offside": "🚩", "Shots on target": "🎯", "Shots off target": "❌",
  "Clearance": "🦵", "Ball out of play": "⏸️", "Throw-in": "👐",
  "Foul": "⚠️", "Indirect free-kick": "🦶", "Direct free-kick": "🦶",
  "Corner": "🚩", "Yellow card": "🟨", "Red card": "🟥", "Yellow->red card": "🟨🟥",
};

function fmt(sec) {
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function getTeamStats(events, teamName) {
  const te = events.filter(e => e.team === teamName);
  return {
    goals: te.filter(e => e.label === "Goal").length,
    shotsOn: te.filter(e => e.label === "Shots on target").length,
    shotsOff: te.filter(e => e.label === "Shots off target").length,
    fouls: te.filter(e => e.label === "Foul").length,
    corners: te.filter(e => e.label === "Corner").length,
    yellow: te.filter(e => e.label === "Yellow card").length,
    red: te.filter(e => ["Red card", "Yellow->red card"].includes(e.label)).length,
    freekicks: te.filter(e => e.label.includes("free-kick")).length,
    offsides: te.filter(e => e.label === "Offside").length,
    penalty: te.filter(e => e.label === "Penalty").length,
    clearances: te.filter(e => e.label === "Clearance").length,
    total: te.length,
    events: te,
  };
}

// ─── DonutChart ───────────────────────────────────────────────────────────────
function DonutChart({ data }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const filtered = data.filter(d => d.value > 0);
  const size = 160, cx = 80, cy = 80, R = 66, r = 42;
  let cum = -Math.PI / 2;
  const slices = filtered.map(d => {
    const sweep = (d.value / total) * 2 * Math.PI;
    const s = cum; cum += sweep;
    return { ...d, s, e: cum };
  });
  const arc = (sa, ea) => {
    if (ea - sa >= 2 * Math.PI) ea = sa + 2 * Math.PI - 0.001;
    const lg = ea - sa > Math.PI ? 1 : 0;
    return [
      `M${(cx + R * Math.cos(sa)).toFixed(2)},${(cy + R * Math.sin(sa)).toFixed(2)}`,
      `A${R},${R} 0 ${lg} 1 ${(cx + R * Math.cos(ea)).toFixed(2)},${(cy + R * Math.sin(ea)).toFixed(2)}`,
      `L${(cx + r * Math.cos(ea)).toFixed(2)},${(cy + r * Math.sin(ea)).toFixed(2)}`,
      `A${r},${r} 0 ${lg} 0 ${(cx + r * Math.cos(sa)).toFixed(2)},${(cy + r * Math.sin(sa)).toFixed(2)}Z`,
    ].join(" ");
  };
  return (
    <div style={{ display: "flex", gap: "1.5rem", alignItems: "center", flexWrap: "wrap" }}>
      <svg viewBox={`0 0 ${size} ${size}`} style={{ width: "100%", maxWidth: 160, flexShrink: 0 }}>
        {slices.map((sl, i) => <path key={i} d={arc(sl.s, sl.e)} fill={sl.color} opacity={0.9} />)}
        <text x={cx} y={cy - 7} textAnchor="middle" fontSize={20} fontWeight="800" fill="#f1f5f9">{total}</text>
        <text x={cx} y={cy + 12} textAnchor="middle" fontSize={10} fill="#64748b">events</text>
      </svg>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.38rem", minWidth: 130 }}>
        {filtered.slice(0, 12).map(d => (
          <div key={d.label} style={{ display: "flex", alignItems: "center", gap: "0.45rem", fontSize: "0.73rem" }}>
            <span style={{ width: 9, height: 9, borderRadius: "50%", background: d.color, flexShrink: 0 }} />
            <span style={{ color: "#cbd5e1", flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.label}</span>
            <span style={{ color: d.color, fontWeight: 700 }}>{d.value}</span>
            <span style={{ color: "#475569", fontSize: "0.68rem", minWidth: 28, textAlign: "right" }}>{((d.value / total) * 100).toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Vertical Bar Chart (Event Frequency) ────────────────────────────────────
function VerticalBarChart({ data }) {
  const maxV = Math.max(1, ...data.map(d => d.value));
  const W = 700, H = 210, P = { t: 24, r: 16, b: 68, l: 36 };
  const cW = W - P.l - P.r, cH = H - P.t - P.b;
  const sp = cW / data.length, bW = sp * 0.62;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
      <defs>
        {data.map((d, i) => (
          <linearGradient key={i} id={`vb${i}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={d.color} stopOpacity="0.95" />
            <stop offset="100%" stopColor={d.color} stopOpacity="0.35" />
          </linearGradient>
        ))}
      </defs>
      {[0.25, 0.5, 0.75, 1].map(f => {
        const y = P.t + cH * (1 - f);
        return (
          <g key={f}>
            <line x1={P.l} y1={y} x2={W - P.r} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
            <text x={P.l - 5} y={y + 4} textAnchor="end" fontSize={9} fill="#475569">{Math.round(f * maxV)}</text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const bH = (d.value / maxV) * cH;
        const x = P.l + i * sp + (sp - bW) / 2;
        const lx = x + bW / 2, ly = P.t + cH + 12;
        return (
          <g key={d.label}>
            {bH > 0 && <rect x={x} y={P.t + cH - bH} width={bW} height={bH} fill={`url(#vb${i})`} rx="3" />}
            <text x={x + bW / 2} y={P.t + cH - (bH || 0) - 4} textAnchor="middle" fontSize={9} fill={d.color} fontWeight="700">{d.value}</text>
            <text x={lx} y={ly} textAnchor="end" fontSize={7.5} fill="#64748b"
              transform={`rotate(-42,${lx},${ly})`}>{d.label}</text>
          </g>
        );
      })}
      <line x1={P.l} y1={P.t} x2={P.l} y2={P.t + cH} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      <line x1={P.l} y1={P.t + cH} x2={W - P.r} y2={P.t + cH} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
    </svg>
  );
}

// ─── Area / Multi-Line Chart ──────────────────────────────────────────────────
function AreaLineChart({ windows, lines, height = 150 }) {
  // windows: [{minute, ...keys}], lines: [{key, color, label, uid}]
  if (!windows.length) return null;
  const maxV = Math.max(1, ...windows.flatMap(w => lines.map(l => w[l.key] || 0)));
  const W = 740, H = height, P = { t: 18, r: 16, b: 28, l: 34 };
  const cW = W - P.l - P.r, cH = H - P.t - P.b;
  const n = windows.length;
  const xAt = i => P.l + (n > 1 ? i / (n - 1) : 0.5) * cW;
  const yAt = v => P.t + cH - (v / maxV) * cH;
  const makeLine = key => windows.map((w, i) => `${i === 0 ? "M" : "L"}${xAt(i).toFixed(1)},${yAt(w[key] || 0).toFixed(1)}`).join(" ");
  const makeArea = key => {
    const base = (P.t + cH).toFixed(1);
    return makeLine(key) + ` L${xAt(n - 1).toFixed(1)},${base} L${xAt(0).toFixed(1)},${base} Z`;
  };
  const totalMin = windows[windows.length - 1]?.minute || 1;
  const tickStep = totalMin <= 30 ? 5 : totalMin <= 60 ? 10 : 15;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
      <defs>
        {lines.map(l => (
          <linearGradient key={l.uid} id={l.uid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={l.color} stopOpacity="0.45" />
            <stop offset="100%" stopColor={l.color} stopOpacity="0.03" />
          </linearGradient>
        ))}
      </defs>
      {[0.5, 1].map(f => {
        const y = P.t + cH * (1 - f);
        return (
          <g key={f}>
            <line x1={P.l} y1={y} x2={W - P.r} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
            <text x={P.l - 4} y={y + 4} textAnchor="end" fontSize={9} fill="#475569">{Math.round(f * maxV)}</text>
          </g>
        );
      })}
      {lines.map(l => (
        <g key={l.key}>
          <path d={makeArea(l.key)} fill={`url(#${l.uid})`} />
          <path d={makeLine(l.key)} fill="none" stroke={l.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        </g>
      ))}
      {windows.filter(w => w.minute % tickStep === 0).map((w, ti) => {
        const i = windows.indexOf(w);
        return <text key={ti} x={xAt(i)} y={H - P.b + 14} textAnchor="middle" fontSize={9} fill="#475569">{w.minute}'</text>;
      })}
      {lines.length > 1 && lines.map((l, i) => (
        <g key={l.uid}>
          <rect x={W - P.r - 130 + i * 68} y={P.t} width={9} height={9} fill={l.color} rx="2" />
          <text x={W - P.r - 117 + i * 68} y={P.t + 8} fontSize={10} fill="#94a3b8">{l.label}</text>
        </g>
      ))}
      <line x1={P.l} y1={P.t + cH} x2={W - P.r} y2={P.t + cH} stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
    </svg>
  );
}

// ─── Confidence Histogram ─────────────────────────────────────────────────────
function ConfidenceHistogram({ events }) {
  const buckets = [
    { label: "50–60%", min: 0.50, max: 0.60, color: "#f97316" },
    { label: "60–70%", min: 0.60, max: 0.70, color: "#f59e0b" },
    { label: "70–80%", min: 0.70, max: 0.80, color: "#06b6d4" },
    { label: "80–90%", min: 0.80, max: 0.90, color: "#3b82f6" },
    { label: "90–100%", min: 0.90, max: 1.01, color: "#22c55e" },
  ];
  const data = buckets.map(b => ({ ...b, count: events.filter(e => e.confidence >= b.min && e.confidence < b.max).length }));
  const maxC = Math.max(1, ...data.map(d => d.count));
  const avgConf = (events.reduce((s, e) => s + e.confidence, 0) / events.length * 100).toFixed(1);
  const W = 340, H = 165, P = { t: 20, r: 12, b: 36, l: 34 };
  const cW = W - P.l - P.r, cH = H - P.t - P.b;
  const sp = cW / data.length, bW = sp * 0.68;
  return (
    <div>
      <div style={{ color: "#94a3b8", fontSize: "0.82rem", marginBottom: "0.6rem" }}>
        Average Confidence: <strong style={{ color: "#60a5fa" }}>{avgConf}%</strong>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
        <defs>
          {data.map((d, i) => (
            <linearGradient key={i} id={`ch${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={d.color} stopOpacity="0.92" />
              <stop offset="100%" stopColor={d.color} stopOpacity="0.38" />
            </linearGradient>
          ))}
        </defs>
        {[0.5, 1].map(f => {
          const y = P.t + cH * (1 - f);
          return (
            <g key={f}>
              <line x1={P.l} y1={y} x2={W - P.r} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
              <text x={P.l - 4} y={y + 4} textAnchor="end" fontSize={9} fill="#475569">{Math.round(f * maxC)}</text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const bH = (d.count / maxC) * cH;
          const x = P.l + i * sp + (sp - bW) / 2;
          return (
            <g key={d.label}>
              {bH > 0 && <rect x={x} y={P.t + cH - bH} width={bW} height={bH} fill={`url(#ch${i})`} rx="3" />}
              <text x={x + bW / 2} y={P.t + cH - (bH || 0) - 4} textAnchor="middle" fontSize={9} fill={d.color} fontWeight="700">{d.count}</text>
              <text x={x + bW / 2} y={P.t + cH + 14} textAnchor="middle" fontSize={8} fill="#64748b">{d.label}</text>
            </g>
          );
        })}
        <line x1={P.l} y1={P.t + cH} x2={W - P.r} y2={P.t + cH} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      </svg>
    </div>
  );
}

// ─── Activity Heat Bars ───────────────────────────────────────────────────────
function ActivityHeatBars({ windows }) {
  const maxC = Math.max(1, ...windows.map(w => w.count));
  const W = 340, H = 165, P = { t: 20, r: 12, b: 28, l: 34 };
  const cW = W - P.l - P.r, cH = H - P.t - P.b;
  const sp = cW / windows.length, bW = Math.max(sp * 0.75, 2);
  const heatColor = ratio => {
    if (ratio < 0.33) return "#1d4ed8";
    if (ratio < 0.66) return "#0ea5e9";
    if (ratio < 0.85) return "#f97316";
    return "#dc2626";
  };
  const totalMin = windows[windows.length - 1]?.minute || 1;
  const tickStep = totalMin <= 30 ? 5 : 10;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
      {[0.5, 1].map(f => {
        const y = P.t + cH * (1 - f);
        return (
          <g key={f}>
            <line x1={P.l} y1={y} x2={W - P.r} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
            <text x={P.l - 4} y={y + 4} textAnchor="end" fontSize={9} fill="#475569">{Math.round(f * maxC)}</text>
          </g>
        );
      })}
      {windows.map((w, i) => {
        const ratio = w.count / maxC;
        const bH = ratio * cH;
        const x = P.l + i * sp;
        const color = heatColor(ratio);
        return (
          <rect key={i} x={x} y={P.t + cH - bH} width={Math.max(bW - 1, 1)} height={bH} fill={color} opacity={0.82} rx="1" />
        );
      })}
      {windows.filter(w => w.minute % tickStep === 0).map((w, ti) => {
        const i = windows.indexOf(w);
        return <text key={ti} x={P.l + i * sp + bW / 2} y={H - P.b + 14} textAnchor="middle" fontSize={9} fill="#475569">{w.minute}'</text>;
      })}
      <line x1={P.l} y1={P.t + cH} x2={W - P.r} y2={P.t + cH} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      <text x={W - P.r} y={P.t - 4} textAnchor="end" fontSize={8.5} fill="#475569">intensity: blue→red</text>
    </svg>
  );
}

// ─── Grouped Bar Chart (Team Stats) ──────────────────────────────────────────
function GroupedBarChart({ cats, c1, c2 }) {
  const maxV = Math.max(1, ...cats.flatMap(c => [c.v1, c.v2]));
  const W = 720, H = 200, P = { t: 24, r: 90, b: 44, l: 36 };
  const cW = W - P.l - P.r, cH = H - P.t - P.b;
  const gW = cW / cats.length, bW = gW * 0.32, gap = gW * 0.04;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
      {[0.25, 0.5, 0.75, 1].map(f => {
        const y = P.t + cH * (1 - f);
        return (
          <g key={f}>
            <line x1={P.l} y1={y} x2={W - P.r} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
            <text x={P.l - 5} y={y + 4} textAnchor="end" fontSize={9} fill="#475569">{Math.round(f * maxV)}</text>
          </g>
        );
      })}
      {cats.map((cat, i) => {
        const gx = P.l + i * gW + (gW - bW * 2 - gap) / 2;
        const bH1 = (cat.v1 / maxV) * cH, bH2 = (cat.v2 / maxV) * cH;
        const x1 = gx, x2 = gx + bW + gap, cx2 = gx + bW + gap / 2;
        return (
          <g key={cat.label}>
            {bH1 > 0 && <rect x={x1} y={P.t + cH - bH1} width={bW} height={bH1} fill={c1} opacity={0.85} rx="3" />}
            <text x={x1 + bW / 2} y={P.t + cH - (bH1 || 0) - 4} textAnchor="middle" fontSize={9} fill={c1} fontWeight="700">{cat.v1}</text>
            {bH2 > 0 && <rect x={x2} y={P.t + cH - bH2} width={bW} height={bH2} fill={c2} opacity={0.85} rx="3" />}
            <text x={x2 + bW / 2} y={P.t + cH - (bH2 || 0) - 4} textAnchor="middle" fontSize={9} fill={c2} fontWeight="700">{cat.v2}</text>
            <text x={cx2} y={P.t + cH + 15} textAnchor="middle" fontSize={8.5} fill="#64748b">{cat.label}</text>
          </g>
        );
      })}
      <line x1={P.l} y1={P.t + cH} x2={W - P.r} y2={P.t + cH} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      <rect x={W - P.r + 8} y={P.t} width={9} height={9} fill={c1} rx="2" />
      <text x={W - P.r + 21} y={P.t + 8} fontSize={10} fill="#94a3b8">Team 1</text>
      <rect x={W - P.r + 8} y={P.t + 18} width={9} height={9} fill={c2} rx="2" />
      <text x={W - P.r + 21} y={P.t + 26} fontSize={10} fill="#94a3b8">Team 2</text>
    </svg>
  );
}

// ─── Stacked Bar Chart (Event Distribution Per Team) ─────────────────────────
function StackedBarChart({ data, c1, c2 }) {
  if (!data.length) return <p style={{ color: "#475569", fontSize: "0.82rem", textAlign: "center", margin: "1rem 0" }}>No team attribution data.</p>;
  const maxV = Math.max(1, ...data.map(d => d.t1 + d.t2));
  const W = 720, H = 210, P = { t: 24, r: 90, b: 68, l: 36 };
  const cW = W - P.l - P.r, cH = H - P.t - P.b;
  const sp = cW / data.length, bW = sp * 0.62;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
      {[0.25, 0.5, 0.75, 1].map(f => {
        const y = P.t + cH * (1 - f);
        return (
          <g key={f}>
            <line x1={P.l} y1={y} x2={W - P.r} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
            <text x={P.l - 5} y={y + 4} textAnchor="end" fontSize={9} fill="#475569">{Math.round(f * maxV)}</text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const x = P.l + i * sp + (sp - bW) / 2;
        const h1 = (d.t1 / maxV) * cH, h2 = (d.t2 / maxV) * cH;
        const lx = x + bW / 2, ly = P.t + cH + 12;
        return (
          <g key={d.label}>
            {h2 > 0 && <rect x={x} y={P.t + cH - h1 - h2} width={bW} height={h2} fill={c2} opacity={0.82} rx="2" />}
            {h1 > 0 && <rect x={x} y={P.t + cH - h1} width={bW} height={h1} fill={c1} opacity={0.82} rx="2" />}
            <text x={lx} y={ly} textAnchor="end" fontSize={7.5} fill="#64748b"
              transform={`rotate(-42,${lx},${ly})`}>{d.label}</text>
          </g>
        );
      })}
      <line x1={P.l} y1={P.t + cH} x2={W - P.r} y2={P.t + cH} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      <rect x={W - P.r + 8} y={P.t} width={9} height={9} fill={c1} rx="2" />
      <text x={W - P.r + 21} y={P.t + 8} fontSize={10} fill="#94a3b8">Team 1</text>
      <rect x={W - P.r + 8} y={P.t + 18} width={9} height={9} fill={c2} rx="2" />
      <text x={W - P.r + 21} y={P.t + 26} fontSize={10} fill="#94a3b8">Team 2</text>
    </svg>
  );
}

// ─── Cards Bar Chart ──────────────────────────────────────────────────────────
function CardsBarChart({ s1, s2, c1, c2 }) {
  const cats = [
    { label: "Yellow Cards", v1: s1.yellow, v2: s2.yellow, accent: "#eab308" },
    { label: "Red Cards", v1: s1.red, v2: s2.red, accent: "#dc2626" },
    { label: "Fouls", v1: s1.fouls, v2: s2.fouls, accent: "#f97316" },
  ];
  const maxV = Math.max(1, ...cats.flatMap(c => [c.v1, c.v2]));
  const W = 380, H = 180, P = { t: 24, r: 12, b: 40, l: 36 };
  const cW = W - P.l - P.r, cH = H - P.t - P.b;
  const gW = cW / cats.length, bW = gW * 0.33, gap = gW * 0.05;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block", maxWidth: 420 }}>
      {[0.5, 1].map(f => {
        const y = P.t + cH * (1 - f);
        return (
          <g key={f}>
            <line x1={P.l} y1={y} x2={W - P.r} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
            <text x={P.l - 5} y={y + 4} textAnchor="end" fontSize={9} fill="#475569">{Math.round(f * maxV)}</text>
          </g>
        );
      })}
      {cats.map((cat, i) => {
        const gx = P.l + i * gW + (gW - bW * 2 - gap) / 2;
        const bH1 = (cat.v1 / maxV) * cH, bH2 = (cat.v2 / maxV) * cH;
        const x2 = gx + bW + gap, cx2 = gx + bW + gap / 2;
        return (
          <g key={cat.label}>
            {bH1 > 0 ? <rect x={gx} y={P.t + cH - bH1} width={bW} height={bH1} fill={c1} opacity={0.85} rx="3" /> : null}
            <text x={gx + bW / 2} y={P.t + cH - (bH1 || 0) - 4} textAnchor="middle" fontSize={10} fill={c1} fontWeight="800">{cat.v1}</text>
            {bH2 > 0 ? <rect x={x2} y={P.t + cH - bH2} width={bW} height={bH2} fill={c2} opacity={0.85} rx="3" /> : null}
            <text x={x2 + bW / 2} y={P.t + cH - (bH2 || 0) - 4} textAnchor="middle" fontSize={10} fill={c2} fontWeight="800">{cat.v2}</text>
            <text x={cx2} y={P.t + cH + 16} textAnchor="middle" fontSize={9} fill={cat.accent} fontWeight="600">{cat.label}</text>
          </g>
        );
      })}
      <line x1={P.l} y1={P.t + cH} x2={W - P.r} y2={P.t + cH} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
    </svg>
  );
}

// ─── Team Contribution Donut ──────────────────────────────────────────────────
function TeamContributionPie({ s1, s2, c1, c2, total }) {
  const unknown = Math.max(0, total - s1.total - s2.total);
  const data = [
    { label: "Team 1", value: s1.total, color: c1 },
    { label: "Team 2", value: s2.total, color: c2 },
    ...(unknown > 0 ? [{ label: "Unattributed", value: unknown, color: "#475569" }] : []),
  ].filter(d => d.value > 0);
  const totalV = data.reduce((s, d) => s + d.value, 0) || 1;
  const size = 130, cx = 65, cy = 65, R = 55, r = 34;
  let cum = -Math.PI / 2;
  const slices = data.map(d => {
    const sweep = (d.value / totalV) * 2 * Math.PI;
    const s = cum; cum += sweep;
    return { ...d, s, e: cum };
  });
  const arc = (sa, ea) => {
    if (ea - sa >= 2 * Math.PI) ea = sa + 2 * Math.PI - 0.001;
    const lg = ea - sa > Math.PI ? 1 : 0;
    return [
      `M${(cx + R * Math.cos(sa)).toFixed(2)},${(cy + R * Math.sin(sa)).toFixed(2)}`,
      `A${R},${R} 0 ${lg} 1 ${(cx + R * Math.cos(ea)).toFixed(2)},${(cy + R * Math.sin(ea)).toFixed(2)}`,
      `L${(cx + r * Math.cos(ea)).toFixed(2)},${(cy + r * Math.sin(ea)).toFixed(2)}`,
      `A${r},${r} 0 ${lg} 0 ${(cx + r * Math.cos(sa)).toFixed(2)},${(cy + r * Math.sin(sa)).toFixed(2)}Z`,
    ].join(" ");
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem" }}>
      <svg viewBox={`0 0 ${size} ${size}`} style={{ width: "100%", maxWidth: 130 }}>
        {slices.map((sl, i) => <path key={i} d={arc(sl.s, sl.e)} fill={sl.color} opacity={0.9} />)}
        <text x={cx} y={cy + 5} textAnchor="middle" fontSize={11} fontWeight="800" fill="#f1f5f9">
          {total}
        </text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", width: "100%" }}>
        {data.map(d => (
          <div key={d.label} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.78rem" }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: d.color, flexShrink: 0 }} />
            <span style={{ color: "#cbd5e1", flex: 1 }}>{d.label}</span>
            <span style={{ color: d.color, fontWeight: 700 }}>{d.value}</span>
            <span style={{ color: "#475569", fontSize: "0.7rem" }}>{((d.value / totalV) * 100).toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Radar Chart ──────────────────────────────────────────────────────────────
function RadarChart({ axes, v1, v2, c1, c2 }) {
  const maxes = axes.map((_, i) => Math.max(v1[i], v2[i], 1));
  const N = axes.length, CX = 110, CY = 110, R = 80;
  const angle = i => (2 * Math.PI * i / N) - Math.PI / 2;
  const pt = (i, r) => [CX + r * Math.cos(angle(i)), CY + r * Math.sin(angle(i))];
  const pathFor = vals => vals.map((v, i) => {
    const [x, y] = pt(i, (v / maxes[i]) * R);
    return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ") + " Z";
  return (
    <svg viewBox="0 0 220 220" style={{ width: "100%", maxWidth: 240, display: "block", margin: "0 auto" }}>
      {[0.2, 0.4, 0.6, 0.8, 1].map(f => (
        <polygon key={f}
          points={Array.from({ length: N }, (_, i) => { const [x, y] = pt(i, f * R); return `${x.toFixed(1)},${y.toFixed(1)}`; }).join(" ")}
          fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="0.8" />
      ))}
      {axes.map((_, i) => { const [x, y] = pt(i, R); return <line key={i} x1={CX} y1={CY} x2={x.toFixed(1)} y2={y.toFixed(1)} stroke="rgba(255,255,255,0.08)" strokeWidth="0.8" />; })}
      <path d={pathFor(v1)} fill={`${c1}30`} stroke={c1} strokeWidth="1.8" />
      <path d={pathFor(v2)} fill={`${c2}28`} stroke={c2} strokeWidth="1.8" />
      {axes.map((label, i) => { const [x, y] = pt(i, R + 18); return <text key={i} x={x.toFixed(1)} y={y.toFixed(1)} textAnchor="middle" dominantBaseline="middle" fontSize={8.5} fill="#64748b">{label}</text>; })}
    </svg>
  );
}

// ─── ScoreBoard ───────────────────────────────────────────────────────────────
function ScoreBoard({ s1, s2, c1, c2, n1, n2 }) {
  return (
    <div className="scoreboard">
      <div className="sb-team">
        <span className="sb-dot" style={{ background: c1 }} />
        <span style={{ color: c1 }}>Team 1</span>
        <span className="sb-name">{n1}</span>
      </div>
      <div className="sb-score">
        <span style={{ color: c1 }}>{s1.goals}</span>
        <span className="sb-dash">—</span>
        <span style={{ color: c2 }}>{s2.goals}</span>
      </div>
      <div className="sb-team sb-team-right">
        <span className="sb-name">{n2}</span>
        <span style={{ color: c2 }}>Team 2</span>
        <span className="sb-dot" style={{ background: c2 }} />
      </div>
    </div>
  );
}

// ─── Summary Cards ────────────────────────────────────────────────────────────
function SummaryCards({ counts, s1, s2, c1, c2 }) {
  const hasTeams = s1 && (s1.total > 0 || s2.total > 0);
  const cards = [
    { label: "Goals", value: counts["Goal"] || 0, icon: "⚽", color: "#22c55e", t1: s1?.goals, t2: s2?.goals },
    { label: "Shots On Target", value: counts["Shots on target"] || 0, icon: "🎯", color: "#06b6d4", t1: s1?.shotsOn, t2: s2?.shotsOn },
    { label: "Shots off Target", value: counts["Shots off target"] || 0, icon: "❌", color: "#94a3b8", t1: s1?.shotsOff, t2: s2?.shotsOff },
    { label: "Fouls", value: counts["Foul"] || 0, icon: "⚠️", color: "#f97316", t1: s1?.fouls, t2: s2?.fouls },
    { label: "Corners", value: counts["Corner"] || 0, icon: "🚩", color: "#ec4899", t1: s1?.corners, t2: s2?.corners },
    { label: "Yellow Cards", value: counts["Yellow card"] || 0, icon: "🟨", color: "#eab308", t1: s1?.yellow, t2: s2?.yellow },
    { label: "Red Cards", value: (counts["Red card"] || 0) + (counts["Yellow->red card"] || 0), icon: "🟥", color: "#dc2626", t1: s1?.red, t2: s2?.red },
    { label: "Penalties", value: counts["Penalty"] || 0, icon: "🎯", color: "#f43f5e", t1: s1?.penalty, t2: s2?.penalty },
    { label: "Offsides", value: counts["Offside"] || 0, icon: "🚩", color: "#f59e0b", t1: s1?.offsides, t2: s2?.offsides },
  ];
  return (
    <div className="md-stat-grid">
      {cards.map(({ label, value, icon, color, t1, t2 }) => {
        const total = (t1 || 0) + (t2 || 0) || 1;
        const p1 = hasTeams ? Math.round(((t1 || 0) / total) * 100) : 0;
        return (
          <div key={label} className="md-stat-card">
            <div className="md-stat-top">
              <span className="md-stat-icon">{icon}</span>
              <span className="md-stat-value" style={{ color }}>{value}</span>
            </div>
            <div className="md-stat-label">{label}</div>
            {hasTeams && value > 0 ? (
              <div className="md-stat-team-bar">
                <div style={{ width: `${p1}%`, background: c1, height: "100%", borderRadius: "999px 0 0 999px", transition: "width 0.8s" }} />
                <div style={{ width: `${100 - p1}%`, background: c2, height: "100%", borderRadius: "0 999px 999px 0", transition: "width 0.8s" }} />
              </div>
            ) : (
              <div className="md-stat-bar-bg">
                <div className="md-stat-bar-fill" style={{ background: color, width: value > 0 ? "100%" : "0%" }} />
              </div>
            )}
            {hasTeams && value > 0 && (
              <div className="md-stat-team-nums">
                <span style={{ color: c1 }}>{t1 || 0}</span>
                <span style={{ color: c2 }}>{t2 || 0}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Event Timeline (dot) ─────────────────────────────────────────────────────
function EventTimeline({ events, c1, c2 }) {
  const hasTeams = events.some(e => e.team && e.team !== "Unknown");
  const maxSec = Math.max(...events.map(e => e.position_seconds), 1);
  const totalMin = maxSec / 60;
  const W = 800, DOT_R = 5, TRACK_Y = hasTeams ? 80 : 60;
  const LOWER_ZONE = hasTeams ? 105 : 0;
  const placed = [];
  const sorted = [...events].sort((a, b) => a.position_seconds - b.position_seconds);
  sorted.forEach(e => {
    const x = (e.position_seconds / maxSec) * (W - 40) + 20;
    if (hasTeams) {
      const bucket = e.team === "Team 1" ? "t1" : e.team === "Team 2" ? "t2" : "unk";
      const sameTeam = placed.filter(p => p._bucket === bucket && Math.abs(p.x - x) < 12);
      placed.push({ ...e, x, lane: sameTeam.length, _bucket: bucket });
    } else {
      placed.push({ ...e, x, lane: placed.filter(p => Math.abs(p.x - x) < 12).length });
    }
  });
  const maxLane = Math.max(0, ...placed.map(p => p.lane));
  const svgH = hasTeams ? LOWER_ZONE + (maxLane + 1) * 20 + 30 : TRACK_Y + (maxLane + 1) * 22 + 30;
  const ticks = [];
  for (let m = 0; m <= totalMin; m += 5) ticks.push(m);
  return (
    <div>
      <p className="md-chart-hint">{hasTeams ? "Team 1 events above · Team 2 events below" : "Each dot = one detected event (confidence >50%)"}</p>
      {hasTeams && (
        <div className="tl-team-legend">
          <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: c1, marginRight: 5 }} /> Team 1 (above)</span>
          <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: c2, marginRight: 5 }} /> Team 2 (below)</span>
        </div>
      )}
      <svg viewBox={`0 0 ${W} ${svgH}`} style={{ width: "100%", height: "auto", display: "block", overflow: "visible" }}>
        <rect x={20} y={TRACK_Y - 2} width={W - 40} height={4} fill="rgba(255,255,255,0.08)" rx="2" />
        {ticks.map(m => {
          const x = (m / totalMin) * (W - 40) + 20;
          const isMajor = m % 15 === 0;
          return (
            <g key={m}>
              <line x1={x} y1={TRACK_Y - 8} x2={x} y2={TRACK_Y + 8} stroke={isMajor ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.08)"} strokeWidth={isMajor ? 1.5 : 1} />
              {isMajor && <text x={x} y={TRACK_Y - 13} textAnchor="middle" fontSize={10} fill="#475569">{m}'</text>}
            </g>
          );
        })}
        {placed.map((e, i) => {
          const color = EVENT_COLORS[e.label] || "#94a3b8";
          let y;
          if (hasTeams) {
            if (e.team === "Team 1") y = TRACK_Y - DOT_R - 8 - e.lane * 20;
            else if (e.team === "Team 2") y = TRACK_Y + DOT_R + 12 + e.lane * 20;
            else y = TRACK_Y;
          } else { y = TRACK_Y + (e.lane + 1) * 22; }
          const tc = e.team === "Team 1" ? c1 : e.team === "Team 2" ? c2 : null;
          return (
            <g key={i}>
              <line x1={e.x} y1={TRACK_Y} x2={e.x} y2={y < TRACK_Y ? y + DOT_R : y - DOT_R} stroke={`${color}44`} strokeWidth="1" />
              {tc && <circle cx={e.x} cy={y} r={DOT_R + 5} fill={`${tc}20`} />}
              <circle cx={e.x} cy={y} r={DOT_R + 3} fill={`${color}20`} />
              <circle cx={e.x} cy={y} r={DOT_R} fill={color} opacity={0.9} />
            </g>
          );
        })}
      </svg>
      <div className="md-timeline-legend">
        {Object.entries(EVENT_COLORS).filter(([label]) => events.some(e => e.label === label)).map(([label, color]) => (
          <span key={label} className="md-legend-item">
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0 }} />{label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Momentum Chart ───────────────────────────────────────────────────────────
function MomentumChart({ events, c1, c2 }) {
  const WINDOW = 5;
  const hasTeams = events.some(e => e.team && e.team !== "Unknown");
  const maxSec = Math.max(...events.map(e => e.position_seconds), 1);
  const totalMin = Math.ceil(maxSec / 60);
  const h1EndSec = Math.max(...events.filter(e => e.half === 1).map(e => e.position_seconds), 0);
  const hasH2 = events.some(e => e.half === 2);
  const windows = [];
  for (let s = 0; s < totalMin; s += WINDOW) {
    const slice = events.filter(e => { const m = e.position_seconds / 60; return m >= s && m < s + WINDOW; });
    windows.push({ start: s, count: slice.length, t1: slice.filter(e => e.team === "Team 1").length, t2: slice.filter(e => e.team === "Team 2").length, isH1: s * 60 < h1EndSec || !hasH2 });
  }
  const maxCount = Math.max(1, ...windows.map(w => w.count));
  const W = 800, H = 160, P = { t: 20, r: 20, b: 38, l: 36 };
  const cW = W - P.l - P.r, cH = H - P.t - P.b;
  const bW = cW / Math.max(1, windows.length);
  return (
    <div>
      <p className="md-chart-hint">Events per 5-minute window.{hasTeams ? " Team 1 (bottom) · Team 2 (top) stacked." : ""}</p>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
        {[0.5, 1].map(f => { const y = P.t + cH - f * cH; return (<g key={f}><line x1={P.l} y1={y} x2={W - P.r} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" /><text x={P.l - 5} y={y + 4} textAnchor="end" fontSize={10} fill="#475569">{Math.round(f * maxCount)}</text></g>); })}
        {windows.map((w, i) => {
          const x = P.l + i * bW;
          if (hasTeams) {
            const h1 = (w.t1 / maxCount) * cH, h2 = (w.t2 / maxCount) * cH;
            const hU = ((w.count - w.t1 - w.t2) / maxCount) * cH;
            return (<g key={i}>{hU > 0 && <rect x={x + 1} y={P.t + cH - h1 - h2 - hU} width={bW - 2} height={hU} fill="rgba(148,163,184,0.4)" rx="1" />}{h2 > 0 && <rect x={x + 1} y={P.t + cH - h1 - h2} width={bW - 2} height={h2} fill={`${c2}cc`} rx="1" />}{h1 > 0 && <rect x={x + 1} y={P.t + cH - h1} width={bW - 2} height={h1} fill={`${c1}cc`} rx="1" />}</g>);
          }
          const bH = (w.count / maxCount) * cH;
          return <rect key={i} x={x + 1} y={P.t + cH - bH} width={bW - 2} height={bH} fill={w.isH1 ? "rgba(59,130,246,0.8)" : "rgba(139,92,246,0.8)"} rx="2" />;
        })}
        {windows.filter(w => w.start % 15 === 0).map((w, i) => { const x = P.l + windows.indexOf(w) * bW + bW / 2; return <text key={i} x={x} y={H - P.b + 14} textAnchor="middle" fontSize={10} fill="#64748b">{w.start}'</text>; })}
        {hasH2 && h1EndSec > 0 && (() => { const htX = P.l + (h1EndSec / (totalMin * 60)) * cW; return (<><line x1={htX} y1={P.t} x2={htX} y2={P.t + cH} stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeDasharray="5 4" /><text x={htX + 4} y={P.t + 11} fontSize={9} fill="rgba(255,255,255,0.35)">HT</text></>); })()}
        {hasTeams ? (<><rect x={W - P.r - 120} y={P.t} width={9} height={9} fill={`${c1}cc`} rx="2" /><text x={W - P.r - 107} y={P.t + 8.5} fontSize={10} fill="#64748b">Team 1</text><rect x={W - P.r - 60} y={P.t} width={9} height={9} fill={`${c2}cc`} rx="2" /><text x={W - P.r - 47} y={P.t + 8.5} fontSize={10} fill="#64748b">Team 2</text></>) : hasH2 && (<><rect x={W - P.r - 115} y={P.t} width={9} height={9} fill="rgba(59,130,246,0.8)" rx="2" /><text x={W - P.r - 102} y={P.t + 8.5} fontSize={10} fill="#64748b">1st Half</text><rect x={W - P.r - 50} y={P.t} width={9} height={9} fill="rgba(139,92,246,0.8)" rx="2" /><text x={W - P.r - 37} y={P.t + 8.5} fontSize={10} fill="#64748b">2nd Half</text></>)}
      </svg>
    </div>
  );
}

// ─── Half Comparison ──────────────────────────────────────────────────────────
function HalfComparison({ events }) {
  const h1 = events.filter(e => e.half === 1), h2 = events.filter(e => e.half === 2);
  const rows = [
    { label: "Total Events", h1v: h1.length, h2v: h2.length },
    { label: "Goals", h1v: h1.filter(e => e.label === "Goal").length, h2v: h2.filter(e => e.label === "Goal").length },
    { label: "Shots on Target", h1v: h1.filter(e => e.label === "Shots on target").length, h2v: h2.filter(e => e.label === "Shots on target").length },
    { label: "Fouls", h1v: h1.filter(e => e.label === "Foul").length, h2v: h2.filter(e => e.label === "Foul").length },
    { label: "Corners", h1v: h1.filter(e => e.label === "Corner").length, h2v: h2.filter(e => e.label === "Corner").length },
    { label: "Yellow Cards", h1v: h1.filter(e => e.label === "Yellow card").length, h2v: h2.filter(e => e.label === "Yellow card").length },
    { label: "Offsides", h1v: h1.filter(e => e.label === "Offside").length, h2v: h2.filter(e => e.label === "Offside").length },
  ];
  return (
    <div className="md-half-table">
      <div className="md-half-header"><span /><span style={{ color: "#60a5fa" }}>1st Half</span><span style={{ color: "#a78bfa" }}>2nd Half</span></div>
      {rows.map(({ label, h1v, h2v }, i) => (
        <div key={label} className={`md-half-row ${i % 2 === 0 ? "md-half-row-alt" : ""}`}>
          <span className="md-half-stat">{label}</span>
          <span className="md-half-val" style={{ color: h1v > h2v ? "#60a5fa" : h1v < h2v ? "#475569" : "#94a3b8" }}>{h1v}</span>
          <span className="md-half-val" style={{ color: h2v > h1v ? "#a78bfa" : h2v < h1v ? "#475569" : "#94a3b8" }}>{h2v}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Duel Row ─────────────────────────────────────────────────────────────────
function DuelRow({ label, v1, v2, c1, c2 }) {
  const max = Math.max(v1, v2, 1);
  const w = v1 > v2 ? 1 : v2 > v1 ? 2 : 0;
  return (
    <div className="duel-row">
      <span className="duel-val" style={{ color: w === 1 ? c1 : "#64748b", fontWeight: w === 1 ? 800 : 500 }}>{v1}</span>
      <div className="duel-center">
        <div className="duel-bar-left"><div style={{ width: `${(v1 / max) * 100}%`, background: c1, opacity: w === 1 ? 1 : 0.45, height: "100%", borderRadius: "999px 0 0 999px", transition: "width 0.7s" }} /></div>
        <span className="duel-label">{label}</span>
        <div className="duel-bar-right"><div style={{ width: `${(v2 / max) * 100}%`, background: c2, opacity: w === 2 ? 1 : 0.45, height: "100%", borderRadius: "0 999px 999px 0", transition: "width 0.7s" }} /></div>
      </div>
      <span className="duel-val" style={{ color: w === 2 ? c2 : "#64748b", fontWeight: w === 2 ? 800 : 500 }}>{v2}</span>
    </div>
  );
}

// ─── Insights generator ───────────────────────────────────────────────────────
function generateInsights(events, counts, s1, s2, c1, c2, n1, n2) {
  if (!events.length) return [];
  const total = events.length;
  const maxSec = Math.max(...events.map(e => e.position_seconds));
  const totalMin = maxSec / 60;
  const h1 = events.filter(e => e.half === 1), h2 = events.filter(e => e.half === 2);
  const hasTeams = s1 && (s1.total > 0 || s2.total > 0);
  const goals = counts["Goal"] || 0, fouls = counts["Foul"] || 0, corners = counts["Corner"] || 0;
  const yellow = counts["Yellow card"] || 0, red = (counts["Red card"] || 0) + (counts["Yellow->red card"] || 0);
  const shotsOn = counts["Shots on target"] || 0, shotsOff = counts["Shots off target"] || 0;
  const ins = [];

  // ── Overview insights ──
  ins.push({ type: "overview", icon: "📋", color: "#3b82f6", title: "Match Summary", text: `${total} qualifying events detected over ${Math.floor(totalMin)} minutes. The match featured ${goals} goal(s), ${shotsOn + shotsOff} shots, ${fouls} foul(s), and ${corners} corner(s).` });

  let busiest = { start: 0, count: 0 };
  for (let s = 0; s < totalMin; s += 5) {
    const c = events.filter(e => e.position_seconds / 60 >= s && e.position_seconds / 60 < s + 5).length;
    if (c > busiest.count) busiest = { start: s, count: c };
  }
  if (busiest.count > 0) ins.push({ type: "overview", icon: "🔥", color: "#f43f5e", title: "Most Active Period", text: `Minutes ${Math.floor(busiest.start)}–${Math.floor(busiest.start) + 5} were the busiest with ${busiest.count} events in 5 minutes.` });

  if (h2.length > 0 && h1.length > 0) {
    const more = h1.length >= h2.length ? "first" : "second";
    ins.push({ type: "overview", icon: "📊", color: "#8b5cf6", title: "Half Comparison", text: `The ${more} half was more eventful — ${Math.max(h1.length, h2.length)} events vs ${Math.min(h1.length, h2.length)}.` });
  }

  const keyEvents = events.filter(e => ["Goal", "Penalty", "Red card", "Yellow->red card"].includes(e.label)).sort((a, b) => a.position_seconds - b.position_seconds);
  if (keyEvents.length > 0) {
    const list = keyEvents.slice(0, 5).map(e => `${e.label} at ${fmt(e.position_seconds)}${e.team && e.team !== "Unknown" ? " (" + e.team + ")" : ""}`).join(", ");
    ins.push({ type: "overview", icon: "⭐", color: "#eab308", title: "Key Moments", text: `${keyEvents.length} major event(s): ${list}${keyEvents.length > 5 ? ` and ${keyEvents.length - 5} more.` : "."}` });
  }

  const avgConf = (events.reduce((s, e) => s + e.confidence, 0) / total * 100).toFixed(1);
  const highConf = events.filter(e => e.confidence >= 0.9).length;
  ins.push({ type: "overview", icon: "✅", color: "#22c55e", title: "Detection Quality", text: `Average confidence: ${avgConf}%. ${highConf}/${total} events (${Math.round(highConf / total * 100)}%) detected at ≥90% confidence.` });

  const freekicks = (counts["Direct free-kick"] || 0) + (counts["Indirect free-kick"] || 0);
  if (freekicks + corners > 0) ins.push({ type: "overview", icon: "🚩", color: "#ec4899", title: "Set Pieces", text: `${freekicks + corners} set piece(s): ${freekicks} free kick(s) and ${corners} corner(s).` });

  // ── Team insights ──
  if (hasTeams) {
    const off1 = s1.goals * 5 + s1.shotsOn * 2 + s1.shotsOff + s1.corners * 0.5;
    const off2 = s2.goals * 5 + s2.shotsOn * 2 + s2.shotsOff + s2.corners * 0.5;
    const dom = off1 > off2 ? "Team 1" : off2 > off1 ? "Team 2" : null;
    const dc = off1 > off2 ? c1 : c2;
    if (dom) {
      const domPct = Math.round((Math.max(off1, off2) / (off1 + off2 || 1)) * 100);
      const ds = dom === "Team 1" ? s1 : s2;
      ins.push({ type: "team", icon: "🏆", color: dc, title: "Match Dominance", text: `${dom} controlled the attacking play with ${domPct}% dominance — ${ds.goals} goal(s), ${ds.shotsOn} shots on target, ${ds.corners} corner(s).` });
    }

    if (s1.shotsOn + s1.shotsOff + s2.shotsOn + s2.shotsOff > 0) {
      const atk1 = s1.shotsOn * 2 + s1.shotsOff + s1.corners;
      const atk2 = s2.shotsOn * 2 + s2.shotsOff + s2.corners;
      const moreAtk = atk1 > atk2 ? "Team 1" : atk2 > atk1 ? "Team 2" : null;
      if (moreAtk) {
        const ts = moreAtk === "Team 1" ? s1 : s2;
        const acc = ts.shotsOn + ts.shotsOff > 0 ? Math.round((ts.shotsOn / (ts.shotsOn + ts.shotsOff)) * 100) : 0;
        ins.push({ type: "team", icon: "🎯", color: moreAtk === "Team 1" ? c1 : c2, title: "Most Attacking", text: `${moreAtk} was more attacking: ${ts.shotsOn} shots on target, ${ts.shotsOff} off target, ${ts.corners} corner(s). Shot accuracy: ${acc}%.` });
      }
    }

    if (s1.fouls + s1.yellow + s1.red + s2.fouls + s2.yellow + s2.red > 0) {
      const agg1 = s1.fouls + s1.yellow * 1.5 + s1.red * 3;
      const agg2 = s2.fouls + s2.yellow * 1.5 + s2.red * 3;
      const moreAgg = agg1 > agg2 ? "Team 1" : agg2 > agg1 ? "Team 2" : null;
      if (moreAgg) {
        const ag = moreAgg === "Team 1" ? s1 : s2;
        const opp = moreAgg === "Team 1" ? s2 : s1;
        ins.push({ type: "team", icon: "⚠️", color: moreAgg === "Team 1" ? c1 : c2, title: "Discipline", text: `${moreAgg} was more aggressive: ${ag.fouls} foul(s), ${ag.yellow} yellow(s), ${ag.red} red(s) — vs ${opp.fouls} foul(s) for the opposition.` });
      }
    }

    if (s1.goals !== s2.goals) {
      const winner = s1.goals > s2.goals ? "Team 1" : "Team 2";
      ins.push({ type: "team", icon: "🥅", color: s1.goals > s2.goals ? c1 : c2, title: "Match Result", text: `${winner} leads ${Math.max(s1.goals, s2.goals)}–${Math.min(s1.goals, s2.goals)} in goals scored from the detected events.` });
    }

    const unknown = events.filter(e => !e.team || e.team === "Unknown").length;
    if (unknown > 0) ins.push({ type: "team", icon: "🔍", color: "#64748b", title: "Unattributed Events", text: `${unknown} event(s) could not be attributed to a specific team — typically ball-out-of-play and kick-off moments.` });
  }

  return ins;
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
const TABS = [
  { id: "overview", label: "📊 Overview" },
  { id: "teams", label: "👥 Teams" },
  { id: "timeline", label: "⏱ Timeline" },
  { id: "insights", label: "💡 Insights" },
];

export default function MatchDashboard({ results }) {
  const [tab, setTab] = useState("overview");

  const { events: rawEvents = [], total_events = 0 } = results;
  const teamColors = results.team_colors || null;

  const events = useMemo(() => rawEvents.filter(e => e.confidence > MIN_CONF), [rawEvents]);
  const counts = useMemo(() => { const c = {}; events.forEach(e => { c[e.label] = (c[e.label] || 0) + 1; }); return c; }, [events]);
  const s1 = useMemo(() => getTeamStats(events, "Team 1"), [events]);
  const s2 = useMemo(() => getTeamStats(events, "Team 2"), [events]);

  const JERSEY_HEX = { red:"#cc2200",blue:"#1144cc",green:"#15803d",white:"#e2e8f0",black:"#334155",yellow:"#eab308",orange:"#f97316",purple:"#8b5cf6",pink:"#ec4899",gray:"#6b7280",grey:"#6b7280",navy:"#1e3a8a",maroon:"#991b1b",cyan:"#06b6d4",teal:"#0d9488" };
  const cleanColor = (name) => name?.toLowerCase().replace(/[^a-z]/g, "") || "";
  const c1 = teamColors?.team1?.hex || JERSEY_HEX[cleanColor(teamColors?.team1?.name)] || "#ef4444";
  const c2 = teamColors?.team2?.hex || JERSEY_HEX[cleanColor(teamColors?.team2?.name)] || "#3b82f6";
  const cleanName = (name) => name ? name.replace(/[^a-zA-Z\s]/g, "").trim() : "unknown";
  const n1 = cleanName(teamColors?.team1?.name);
  const n2 = cleanName(teamColors?.team2?.name);

  const hasH2 = events.some(e => e.half === 2);
  const hasTeams = s1.total > 0 || s2.total > 0;
  const insights = useMemo(() => generateInsights(events, counts, s1, s2, c1, c2, n1, n2), [events, counts, s1, s2, c1, c2, n1, n2]);

  // Computed chart data
  const pieData = useMemo(() => Object.entries(counts).map(([label, value]) => ({ label, value, color: EVENT_COLORS[label] || "#94a3b8" })).sort((a, b) => b.value - a.value), [counts]);

  const timelineWindows = useMemo(() => {
    if (!events.length) return [];
    const maxSec = Math.max(...events.map(e => e.position_seconds), 1);
    const totalMin = Math.ceil(maxSec / 60);
    const W = 2;
    const result = [];
    for (let m = 0; m < totalMin; m += W) {
      const sl = events.filter(e => { const mn = e.position_seconds / 60; return mn >= m && mn < m + W; });
      result.push({ minute: m, total: sl.length, t1: sl.filter(e => e.team === "Team 1").length, t2: sl.filter(e => e.team === "Team 2").length });
    }
    return result;
  }, [events]);

  const activityWindows = useMemo(() => {
    if (!events.length) return [];
    const maxSec = Math.max(...events.map(e => e.position_seconds), 1);
    const totalMin = Math.ceil(maxSec / 60);
    const result = [];
    for (let m = 0; m < totalMin; m += 3) {
      result.push({ minute: m, count: events.filter(e => { const mn = e.position_seconds / 60; return mn >= m && mn < m + 3; }).length });
    }
    return result;
  }, [events]);

  const stackedData = useMemo(() => Object.keys(EVENT_COLORS).map(label => ({
    label, t1: s1.events.filter(e => e.label === label).length, t2: s2.events.filter(e => e.label === label).length,
  })).filter(d => d.t1 + d.t2 > 0).sort((a, b) => (b.t1 + b.t2) - (a.t1 + a.t2)), [s1, s2]);

  const offDefData = useMemo(() => ({
    axes: ["Goals", "Shots On", "Shots Off", "Corners", "Fouls", "Clearances"],
    v1: [s1.goals, s1.shotsOn, s1.shotsOff, s1.corners, s1.fouls, s1.clearances],
    v2: [s2.goals, s2.shotsOn, s2.shotsOff, s2.corners, s2.fouls, s2.clearances],
  }), [s1, s2]);

  const overviewInsights = insights.filter(i => i.type === "overview");
  const teamInsights = insights.filter(i => i.type === "team");

  if (!events.length) return null;

  return (
    <div className="md-wrap">
      <div className="md-header">
        <div>
          <h3 className="md-title">⚽ Match Analytics Dashboard</h3>
          <p className="md-subtitle">
            {events.length} events · confidence &gt;50%
            {events.length < total_events ? ` (${total_events - events.length} low-confidence excluded)` : ""}
            {hasTeams ? " · team attribution active" : ""}
          </p>
        </div>
        <div className="md-tabs">
          {TABS.map(t => (
            <button key={t.id} className={`md-tab ${tab === t.id ? "md-tab-active" : ""}`} onClick={() => setTab(t.id)}>
              {t.label}
              {t.id === "teams" && !hasTeams && <span className="md-tab-badge">!</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="md-body">

        {/* ══ OVERVIEW TAB ══════════════════════════════════════════════════════ */}
        {tab === "overview" && (
          <div className="md-stack">
            {hasTeams && <ScoreBoard s1={s1} s2={s2} c1={c1} c2={c2} n1={n1} n2={n2} />}
            <SummaryCards counts={counts} s1={s1} s2={s2} c1={c1} c2={c2} />

            <div className="md-section-label">Event Analysis</div>
            <div className="md-two-col">
              <div className="md-panel">
                <h4 className="md-panel-title">Total Events Distribution</h4>
                <DonutChart data={pieData} />
              </div>
              <div className="md-panel">
                <h4 className="md-panel-title">Event Frequency</h4>
                <VerticalBarChart data={pieData} />
              </div>
            </div>

            <div className="md-panel">
              <h4 className="md-panel-title">Events Over Time</h4>
              <p className="md-chart-hint">Event count per 2-minute window throughout the match</p>
              <AreaLineChart
                windows={timelineWindows}
                lines={hasTeams
                  ? [{ key: "t1", color: c1, label: "Team 1", uid: "ot1" }, { key: "t2", color: c2, label: "Team 2", uid: "ot2" }]
                  : [{ key: "total", color: "#3b82f6", label: "Events", uid: "ototal" }]}
                height={155}
              />
            </div>

            <div className="md-two-col">
              <div className="md-panel">
                <h4 className="md-panel-title">Confidence Distribution</h4>
                <ConfidenceHistogram events={events} />
              </div>
              <div className="md-panel">
                <h4 className="md-panel-title">Match Activity Heat</h4>
                <p className="md-chart-hint">Intensity per 3-minute window — blue (low) → red (peak)</p>
                <ActivityHeatBars windows={activityWindows} />
              </div>
            </div>

            {hasH2 && (
              <div className="md-panel">
                <h4 className="md-panel-title">1st Half vs 2nd Half</h4>
                <HalfComparison events={events} />
              </div>
            )}
          </div>
        )}

        {/* ══ TEAMS TAB ═════════════════════════════════════════════════════════ */}
        {tab === "teams" && (
          hasTeams ? (
            <div className="md-stack">
              {/* Team headers */}
              <div className="team-header-grid">
                <div className="team-hdr" style={{ borderColor: `${c1}55`, background: `${c1}0d` }}>
                  <span className="team-dot-lg" style={{ background: c1 }} />
                  <div style={{ flex: 1 }}>
                    <div className="team-hdr-name">Team 1</div>
                    <div className="team-hdr-jersey">{n1} jersey</div>
                  </div>
                  <div className="team-hdr-total" style={{ color: c1 }}>{s1.total}<span>events</span></div>
                </div>
                <div className="team-vs">VS</div>
                <div className="team-hdr" style={{ borderColor: `${c2}55`, background: `${c2}0d` }}>
                  <span className="team-dot-lg" style={{ background: c2 }} />
                  <div style={{ flex: 1 }}>
                    <div className="team-hdr-name">Team 2</div>
                    <div className="team-hdr-jersey">{n2} jersey</div>
                  </div>
                  <div className="team-hdr-total" style={{ color: c2 }}>{s2.total}<span>events</span></div>
                </div>
              </div>

              {/* Dominance */}
              <div className="md-panel">
                <h4 className="md-panel-title">Attacking Dominance</h4>
                {(() => {
                  const off1 = s1.goals * 5 + s1.shotsOn * 2 + s1.shotsOff + s1.corners * 0.5 + s1.freekicks * 0.3;
                  const off2 = s2.goals * 5 + s2.shotsOn * 2 + s2.shotsOff + s2.corners * 0.5 + s2.freekicks * 0.3;
                  const total = off1 + off2 || 1;
                  const d1 = Math.round((off1 / total) * 100), d2 = 100 - d1;
                  return (
                    <>
                      <div className="dom-row">
                        <span className="dom-pct" style={{ color: c1 }}>{d1}%</span>
                        <div className="dom-track">
                          <div style={{ width: `${d1}%`, background: c1, height: "100%", borderRadius: "999px 0 0 999px", transition: "width 0.8s" }} />
                          <div style={{ width: `${d2}%`, background: c2, height: "100%", borderRadius: "0 999px 999px 0", transition: "width 0.8s" }} />
                        </div>
                        <span className="dom-pct" style={{ color: c2 }}>{d2}%</span>
                      </div>
                      <div className="dom-labels">
                        <span style={{ color: c1, fontSize: "0.78rem" }}>Team 1</span>
                        <span style={{ color: "#475569", fontSize: "0.72rem" }}>based on goals · shots · set pieces</span>
                        <span style={{ color: c2, fontSize: "0.78rem" }}>Team 2</span>
                      </div>
                    </>
                  );
                })()}
              </div>

              <div className="md-section-label">Stats Comparison</div>

              {/* Grouped Bar */}
              <div className="md-panel">
                <h4 className="md-panel-title">Key Stats Comparison</h4>
                <GroupedBarChart c1={c1} c2={c2} cats={[
                  { label: "Goals", v1: s1.goals, v2: s2.goals },
                  { label: "Shots On", v1: s1.shotsOn, v2: s2.shotsOn },
                  { label: "Shots Off", v1: s1.shotsOff, v2: s2.shotsOff },
                  { label: "Corners", v1: s1.corners, v2: s2.corners },
                  { label: "Fouls", v1: s1.fouls, v2: s2.fouls },
                  { label: "Free Kicks", v1: s1.freekicks, v2: s2.freekicks },
                  { label: "Offsides", v1: s1.offsides, v2: s2.offsides },
                  { label: "Penalties", v1: s1.penalty, v2: s2.penalty },
                ]} />
              </div>

              {/* Stacked Bar */}
              <div className="md-panel">
                <h4 className="md-panel-title">Event Distribution Per Team</h4>
                <p className="md-chart-hint">Team 1 (bottom) + Team 2 (top) per event type</p>
                <StackedBarChart data={stackedData} c1={c1} c2={c2} />
              </div>

              {/* Team Activity Timeline */}
              <div className="md-panel">
                <h4 className="md-panel-title">Team Activity Timeline</h4>
                <p className="md-chart-hint">Events per 2-minute window by team</p>
                <AreaLineChart
                  windows={timelineWindows}
                  lines={[{ key: "t1", color: c1, label: "Team 1", uid: "tat1" }, { key: "t2", color: c2, label: "Team 2", uid: "tat2" }]}
                  height={160}
                />
              </div>

              <div className="md-section-label">Discipline & Contribution</div>

              <div className="md-two-col">
                <div className="md-panel">
                  <h4 className="md-panel-title">Discipline Comparison</h4>
                  <CardsBarChart s1={s1} s2={s2} c1={c1} c2={c2} />
                  <div style={{ display: "flex", justifyContent: "center", gap: "1.5rem", marginTop: "0.75rem", fontSize: "0.78rem" }}>
                    <span><span style={{ display: "inline-block", width: 9, height: 9, borderRadius: "50%", background: c1, marginRight: 5 }} />Team 1</span>
                    <span><span style={{ display: "inline-block", width: 9, height: 9, borderRadius: "50%", background: c2, marginRight: 5 }} />Team 2</span>
                  </div>
                </div>
                <div className="md-panel">
                  <h4 className="md-panel-title">Team Contribution</h4>
                  <p className="md-chart-hint">Share of total attributed events</p>
                  <TeamContributionPie s1={s1} s2={s2} c1={c1} c2={c2} total={events.length} />
                </div>
              </div>

              <div className="md-section-label">Performance Analysis</div>

              <div className="md-two-col">
                <div className="md-panel">
                  <h4 className="md-panel-title">Head-to-Head</h4>
                  <div className="duel-header">
                    <span style={{ color: c1 }}>Team 1</span><span /><span style={{ color: c2 }}>Team 2</span>
                  </div>
                  <div className="duel-list">
                    <DuelRow label="Goals" v1={s1.goals} v2={s2.goals} c1={c1} c2={c2} />
                    <DuelRow label="Shots on Target" v1={s1.shotsOn} v2={s2.shotsOn} c1={c1} c2={c2} />
                    <DuelRow label="Shots off Target" v1={s1.shotsOff} v2={s2.shotsOff} c1={c1} c2={c2} />
                    <DuelRow label="Corners" v1={s1.corners} v2={s2.corners} c1={c1} c2={c2} />
                    <DuelRow label="Free Kicks" v1={s1.freekicks} v2={s2.freekicks} c1={c1} c2={c2} />
                    <DuelRow label="Fouls" v1={s1.fouls} v2={s2.fouls} c1={c1} c2={c2} />
                    <DuelRow label="Yellow Cards" v1={s1.yellow} v2={s2.yellow} c1={c1} c2={c2} />
                    <DuelRow label="Red Cards" v1={s1.red} v2={s2.red} c1={c1} c2={c2} />
                    <DuelRow label="Clearances" v1={s1.clearances} v2={s2.clearances} c1={c1} c2={c2} />
                  </div>
                </div>
                <div className="md-panel">
                  <h4 className="md-panel-title">Offensive vs Defensive Radar</h4>
                  <RadarChart axes={offDefData.axes} v1={offDefData.v1} v2={offDefData.v2} c1={c1} c2={c2} />
                  <div className="radar-legend">
                    <span><span className="radar-dot" style={{ background: c1 }} /> Team 1 – {n1}</span>
                    <span><span className="radar-dot" style={{ background: c2 }} /> Team 2 – {n2}</span>
                  </div>
                </div>
              </div>

              {/* Key Moments */}
              <div className="md-section-label">Key Moments</div>
              <div className="md-two-col">
                {[{ stats: s1, color: c1, name: "Team 1" }, { stats: s2, color: c2, name: "Team 2" }].map(({ stats, color, name }) => {
                  const keyLabels = ["Goal", "Penalty", "Red card", "Yellow->red card", "Shots on target"];
                  const keyEvts = [...stats.events].filter(e => keyLabels.includes(e.label)).sort((a, b) => a.position_seconds - b.position_seconds);
                  return (
                    <div key={name} className="md-panel">
                      <h4 className="md-panel-title" style={{ color }}>{name} Key Moments</h4>
                      {keyEvts.length === 0
                        ? <p style={{ color: "#475569", fontSize: "0.82rem", margin: 0 }}>No key events attributed.</p>
                        : <div className="team-moments">{keyEvts.map((e, i) => (
                          <div key={i} className="team-moment-row">
                            <span className="tm-icon">{EVENT_ICONS[e.label] || "⚪"}</span>
                            <span className="tm-time">{fmt(e.position_seconds)}</span>
                            <span className="tm-label">{e.label}</span>
                            <span className="tm-conf">{(e.confidence * 100).toFixed(0)}%</span>
                          </div>
                        ))}</div>
                      }
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="md-panel" style={{ textAlign: "center", padding: "3rem 2rem" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>🔍</div>
              <p style={{ color: "#64748b", fontSize: "0.9rem", margin: 0 }}>
                No team attribution data found for this analysis.<br />
                Re-analyze the video to enable team-based stats.
              </p>
            </div>
          )
        )}

        {/* ══ TIMELINE TAB ══════════════════════════════════════════════════════ */}
        {tab === "timeline" && (
          <div className="md-stack">
            <div className="md-panel">
              <h4 className="md-panel-title">Event Timeline</h4>
              <EventTimeline events={events} c1={c1} c2={c2} />
            </div>
            <div className="md-panel">
              <h4 className="md-panel-title">Match Momentum</h4>
              <MomentumChart events={events} c1={c1} c2={c2} />
            </div>
          </div>
        )}

        {/* ══ INSIGHTS TAB ══════════════════════════════════════════════════════ */}
        {tab === "insights" && (
          <div className="md-stack">
            <p className="md-panel-sub">Auto-generated from {events.length} qualifying events (confidence &gt;50%).{hasTeams ? " Includes team-based analysis." : ""}</p>

            <div className="md-section-label">Match Overview</div>
            <div className="md-insights-grid">
              {overviewInsights.map((ins, i) => (
                <div key={i} className="md-insight-card" style={{ borderLeftColor: ins.color }}>
                  <div className="md-insight-header">
                    <span className="md-insight-icon">{ins.icon}</span>
                    <span className="md-insight-title" style={{ color: ins.color }}>{ins.title}</span>
                  </div>
                  <p className="md-insight-text">{ins.text}</p>
                </div>
              ))}
            </div>

            {teamInsights.length > 0 && (
              <>
                <div className="md-section-label">Team Analysis</div>
                <div className="md-insights-grid">
                  {teamInsights.map((ins, i) => (
                    <div key={i} className="md-insight-card" style={{ borderLeftColor: ins.color }}>
                      <div className="md-insight-header">
                        <span className="md-insight-icon">{ins.icon}</span>
                        <span className="md-insight-title" style={{ color: ins.color }}>{ins.title}</span>
                      </div>
                      <p className="md-insight-text">{ins.text}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <style>{`
        .md-wrap { background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.08); border-radius:20px; overflow:hidden; margin-bottom:2rem; }
        .md-header { display:flex; align-items:center; justify-content:space-between; padding:1.25rem 1.5rem; flex-wrap:wrap; gap:0.85rem; border-bottom:1px solid rgba(255,255,255,0.06); background:rgba(255,255,255,0.02); }
        .md-title { color:#f1f5f9; font-size:1.05rem; font-weight:700; margin:0 0 0.15rem; letter-spacing:-0.01em; }
        .md-subtitle { color:#64748b; font-size:0.8rem; margin:0; }
        .md-tabs { display:flex; gap:0.4rem; flex-wrap:wrap; }
        .md-tab { position:relative; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); color:#94a3b8; padding:0.45rem 1.1rem; border-radius:8px; font-size:0.82rem; font-weight:600; cursor:pointer; transition:all 0.2s; }
        .md-tab:hover { background:rgba(255,255,255,0.08); color:#cbd5e1; }
        .md-tab-active { background:rgba(59,130,246,0.14)!important; border-color:rgba(59,130,246,0.4)!important; color:#93c5fd!important; }
        .md-tab-badge { position:absolute; top:-4px; right:-4px; background:#f43f5e; color:#fff; width:14px; height:14px; border-radius:50%; font-size:0.6rem; display:flex; align-items:center; justify-content:center; }
        .md-body { padding:1.5rem; }
        .md-stack { display:flex; flex-direction:column; gap:1.25rem; }
        .md-panel { background:rgba(255,255,255,0.025); border:1px solid rgba(255,255,255,0.07); border-radius:14px; padding:1.25rem; }
        .md-panel-title { color:#e2e8f0; font-size:0.88rem; font-weight:700; margin:0 0 1rem; letter-spacing:-0.01em; }
        .md-panel-sub { color:#64748b; font-size:0.82rem; margin:0 0 0.5rem; }
        .md-chart-hint { color:#475569; font-size:0.78rem; margin:0 0 0.75rem; }
        .md-two-col { display:grid; grid-template-columns:1fr 1fr; gap:1rem; }
        @media(max-width:700px){ .md-two-col{grid-template-columns:1fr;} }
        .md-section-label { color:#475569; font-size:0.7rem; font-weight:700; text-transform:uppercase; letter-spacing:0.1em; padding:0 0.25rem; border-left:3px solid rgba(59,130,246,0.4); padding-left:0.6rem; }

        /* Scoreboard */
        .scoreboard { display:flex; align-items:center; justify-content:center; gap:1.5rem; background:rgba(255,255,255,0.025); border:1px solid rgba(255,255,255,0.07); border-radius:14px; padding:1rem 1.5rem; flex-wrap:wrap; }
        .sb-team { display:flex; align-items:center; gap:0.5rem; }
        .sb-team-right { flex-direction:row-reverse; }
        .sb-dot { width:12px; height:12px; border-radius:50%; flex-shrink:0; }
        .sb-name { color:#64748b; font-size:0.78rem; }
        .sb-score { display:flex; align-items:center; gap:0.75rem; font-size:2.2rem; font-weight:800; letter-spacing:-0.02em; }
        .sb-dash { color:#334155; font-weight:300; }

        /* Stat grid */
        .md-stat-grid { display:grid; grid-template-columns:repeat(9,1fr); gap:0.65rem; }
        @media(max-width:1100px){ .md-stat-grid{grid-template-columns:repeat(5,1fr);} }
        @media(max-width:700px) { .md-stat-grid{grid-template-columns:repeat(3,1fr);} }
        .md-stat-card { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); border-radius:12px; padding:0.85rem 0.9rem; transition:transform 0.2s,background 0.2s; }
        .md-stat-card:hover { transform:translateY(-2px); background:rgba(255,255,255,0.05); }
        .md-stat-top { display:flex; align-items:center; justify-content:space-between; margin-bottom:0.3rem; }
        .md-stat-icon { font-size:1.15rem; }
        .md-stat-value { font-size:1.7rem; font-weight:800; line-height:1; letter-spacing:-0.03em; }
        .md-stat-label { color:#64748b; font-size:0.65rem; font-weight:600; text-transform:uppercase; letter-spacing:0.06em; margin-bottom:0.55rem; }
        .md-stat-bar-bg { height:3px; background:rgba(255,255,255,0.06); border-radius:999px; overflow:hidden; }
        .md-stat-bar-fill { height:100%; border-radius:999px; transition:width 0.8s ease; }
        .md-stat-team-bar { height:4px; background:rgba(255,255,255,0.06); border-radius:999px; overflow:hidden; display:flex; }
        .md-stat-team-nums { display:flex; justify-content:space-between; font-size:0.62rem; font-weight:700; margin-top:0.3rem; }

        /* Half table */
        .md-half-table { border-radius:10px; overflow:hidden; }
        .md-half-header { display:grid; grid-template-columns:1fr 70px 70px; padding:0.5rem 0.75rem; border-bottom:1px solid rgba(34,197,94,0.1); font-size:0.7rem; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; text-align:center; }
        .md-half-header span:first-child { text-align:left; color:#475569; }
        .md-half-row { display:grid; grid-template-columns:1fr 70px 70px; padding:0.5rem 0.75rem; border-bottom:1px solid rgba(255,255,255,0.04); }
        .md-half-row-alt { background:rgba(255,255,255,0.015); }
        .md-half-stat { color:#94a3b8; font-size:0.8rem; }
        .md-half-val { font-size:0.88rem; font-weight:700; text-align:center; }

        /* Timeline legend */
        .md-timeline-legend { display:flex; flex-wrap:wrap; gap:0.5rem 1rem; margin-top:1rem; padding-top:0.75rem; border-top:1px solid rgba(255,255,255,0.05); }
        .md-legend-item { display:flex; align-items:center; gap:0.35rem; color:#64748b; font-size:0.75rem; }
        .tl-team-legend { display:flex; gap:1.5rem; justify-content:center; margin-bottom:0.5rem; font-size:0.78rem; color:#64748b; }

        /* Insights */
        .md-insights-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:0.85rem; }
        .md-insight-card { background:rgba(255,255,255,0.025); border:1px solid rgba(255,255,255,0.07); border-left:3px solid; border-radius:12px; padding:1rem 1.1rem; transition:transform 0.2s,background 0.2s; }
        .md-insight-card:hover { transform:translateY(-2px); background:rgba(255,255,255,0.04); }
        .md-insight-header { display:flex; align-items:center; gap:0.5rem; margin-bottom:0.5rem; }
        .md-insight-icon { font-size:1.1rem; flex-shrink:0; }
        .md-insight-title { font-size:0.82rem; font-weight:700; letter-spacing:-0.01em; }
        .md-insight-text { color:#94a3b8; font-size:0.82rem; line-height:1.6; margin:0; }

        /* Team comparison */
        .team-header-grid { display:grid; grid-template-columns:1fr auto 1fr; align-items:center; gap:1rem; }
        @media(max-width:600px){ .team-header-grid{grid-template-columns:1fr;gap:0.5rem;} }
        .team-hdr { display:flex; align-items:center; gap:0.75rem; padding:1rem 1.25rem; border:1px solid; border-radius:14px; }
        .team-dot-lg { width:18px; height:18px; border-radius:50%; flex-shrink:0; }
        .team-hdr-name { color:#f1f5f9; font-size:0.95rem; font-weight:700; }
        .team-hdr-jersey { color:#64748b; font-size:0.75rem; margin-top:0.1rem; }
        .team-hdr-total { font-size:1.6rem; font-weight:800; letter-spacing:-0.03em; line-height:1; margin-left:auto; }
        .team-hdr-total span { display:block; font-size:0.65rem; color:#64748b; font-weight:600; text-transform:uppercase; letter-spacing:0.06em; }
        .team-vs { color:#334155; font-size:1.1rem; font-weight:800; text-align:center; }

        /* Dominance */
        .dom-row { display:flex; align-items:center; gap:0.75rem; margin-bottom:0.5rem; }
        .dom-pct { font-size:1.4rem; font-weight:800; letter-spacing:-0.02em; min-width:48px; text-align:center; }
        .dom-track { flex:1; height:10px; border-radius:999px; overflow:hidden; display:flex; background:rgba(255,255,255,0.05); }
        .dom-labels { display:flex; justify-content:space-between; align-items:center; }

        /* Duel */
        .duel-header { display:grid; grid-template-columns:48px 1fr 48px; text-align:center; font-size:0.72rem; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; margin-bottom:0.5rem; padding-bottom:0.5rem; border-bottom:1px solid rgba(255,255,255,0.06); }
        .duel-list { display:flex; flex-direction:column; gap:0.3rem; }
        .duel-row { display:grid; grid-template-columns:36px 1fr 36px; align-items:center; gap:0.5rem; padding:0.25rem 0; }
        .duel-val { font-size:1rem; font-weight:700; text-align:center; font-variant-numeric:tabular-nums; }
        .duel-center { display:grid; grid-template-columns:1fr auto 1fr; align-items:center; gap:0.4rem; }
        .duel-bar-left { height:5px; background:rgba(255,255,255,0.05); border-radius:999px; overflow:hidden; display:flex; justify-content:flex-end; }
        .duel-bar-right { height:5px; background:rgba(255,255,255,0.05); border-radius:999px; overflow:hidden; }
        .duel-label { color:#64748b; font-size:0.72rem; font-weight:600; white-space:nowrap; text-align:center; padding:0 0.3rem; }

        /* Radar */
        .radar-legend { display:flex; justify-content:center; gap:1.5rem; margin-top:0.75rem; font-size:0.78rem; color:#64748b; }
        .radar-dot { display:inline-block; width:9px; height:9px; border-radius:50%; margin-right:5px; vertical-align:middle; }

        /* Key moments */
        .team-moments { display:flex; flex-direction:column; gap:0.3rem; }
        .team-moment-row { display:grid; grid-template-columns:22px 46px 1fr 38px; align-items:center; gap:0.4rem; padding:0.35rem 0.5rem; border-radius:7px; background:rgba(255,255,255,0.025); }
        .tm-icon { font-size:0.85rem; text-align:center; }
        .tm-time { color:#60a5fa; font-size:0.78rem; font-weight:600; font-variant-numeric:tabular-nums; }
        .tm-label { color:#cbd5e1; font-size:0.8rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .tm-conf { color:#475569; font-size:0.72rem; text-align:right; }
      `}</style>
    </div>
  );
}
