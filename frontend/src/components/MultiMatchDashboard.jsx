import React, { useState, useMemo } from "react";

// ─── Constants ──────────────────────────────────────────────────────────────
const MATCH_COLORS = [
  "#3b82f6", "#f43f5e", "#22c55e", "#f59e0b",
  "#a855f7", "#06b6d4", "#ec4899", "#84cc16",
];
const MIN_CONF = 0.50;
const KEY_STATS = [
  { key: "Goal",             label: "Goals" },
  { key: "Shots on target",  label: "Shots On" },
  { key: "Shots off target", label: "Shots Off" },
  { key: "Foul",             label: "Fouls" },
  { key: "Corner",           label: "Corners" },
  { key: "Yellow card",      label: "Yellows" },
  { key: "Red card",         label: "Reds" },
  { key: "Offside",          label: "Offsides" },
];
const RADAR_AXES = [
  { key: "Goal",             label: "Goals" },
  { key: "Shots on target",  label: "Shots On" },
  { key: "Foul",             label: "Fouls" },
  { key: "Corner",           label: "Corners" },
  { key: "Yellow card",      label: "Yellows" },
  { key: "Direct free-kick", label: "Free Kicks" },
];
const STACKED_CATS = [
  { key: "Goal",             label: "Goals",        color: "#22c55e" },
  { key: "Shots on target",  label: "Shots On",     color: "#06b6d4" },
  { key: "Shots off target", label: "Shots Off",    color: "#94a3b8" },
  { key: "Foul",             label: "Fouls",        color: "#f97316" },
  { key: "Corner",           label: "Corners",      color: "#ec4899" },
  { key: "Yellow card",      label: "Yellows",      color: "#eab308" },
  { key: "Red card",         label: "Reds",         color: "#dc2626" },
  { key: "Ball out of play", label: "Out of play",  color: "#64748b" },
  { key: "Throw-in",         label: "Throw-in",     color: "#0ea5e9" },
  { key: "Clearance",        label: "Clearance",    color: "#a855f7" },
];
const TABS = ["Overview", "Events", "Timeline", "Quality", "Teams", "Insights"];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function shortName(str, maxLen = 28) {
  if (!str) return "";
  return str.length > maxLen ? str.slice(0, maxLen - 1) + "…" : str;
}

function polarToCart(cx, cy, r, angleDeg) {
  const rad = (angleDeg - 90) * (Math.PI / 180);
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

// ─── Data processing ─────────────────────────────────────────────────────────
function processMatches(rawMatches) {
  return rawMatches.map((m, i) => {
    const events = (m.events || []).filter(e => e.confidence > MIN_CONF);
    const counts = {};
    events.forEach(e => { counts[e.label] = (counts[e.label] || 0) + 1; });
    const maxSec = events.length ? Math.max(...events.map(e => e.position_seconds)) : 0;
    const avgConf = events.length
      ? events.reduce((s, e) => s + e.confidence, 0) / events.length
      : 0;
    return {
      ...m,
      events,
      counts,
      maxSec,
      avgConf,
      color: MATCH_COLORS[i % MATCH_COLORS.length],
      shortName: shortName(m.name),
    };
  });
}

// ─── Insights generator ───────────────────────────────────────────────────────
function generateMultiInsights(matches) {
  const insights = [];
  if (!matches.length) return insights;

  const totalEvCounts = matches.map(m => m.events.length);
  const maxEvIdx = totalEvCounts.indexOf(Math.max(...totalEvCounts));
  const minEvIdx = totalEvCounts.indexOf(Math.min(...totalEvCounts));
  const avgEv = Math.round(totalEvCounts.reduce((a, b) => a + b, 0) / matches.length);
  insights.push({
    title: "Event Volume",
    icon: "📊",
    color: "#3b82f6",
    text: `"${shortName(matches[maxEvIdx].name, 22)}" had the most events (${totalEvCounts[maxEvIdx]}), while "${shortName(matches[minEvIdx].name, 22)}" had the fewest (${totalEvCounts[minEvIdx]}). Average across matches: ${avgEv} events.`,
  });

  const goalCounts = matches.map(m => m.counts["Goal"] || 0);
  const totalGoals = goalCounts.reduce((a, b) => a + b, 0);
  const avgGoals = (totalGoals / matches.length).toFixed(1);
  const topGoalIdx = goalCounts.indexOf(Math.max(...goalCounts));
  insights.push({
    title: "Goal Scoring",
    icon: "⚽",
    color: "#22c55e",
    text: `${totalGoals} total goals detected across all matches (avg ${avgGoals}/match). Highest-scoring match: "${shortName(matches[topGoalIdx].name, 22)}" with ${goalCounts[topGoalIdx]} goal(s).`,
  });

  const aggrScores = matches.map(m =>
    (m.counts["Foul"] || 0) * 1 +
    (m.counts["Yellow card"] || 0) * 2 +
    (m.counts["Red card"] || 0) * 5
  );
  const topAggrIdx = aggrScores.indexOf(Math.max(...aggrScores));
  insights.push({
    title: "Match Aggression",
    icon: "⚠️",
    color: "#f97316",
    text: `"${shortName(matches[topAggrIdx].name, 22)}" showed the highest aggression index (${aggrScores[topAggrIdx]}) based on fouls, yellow cards, and red cards.`,
  });

  const shotsOn = matches.map(m => m.counts["Shots on target"] || 0);
  const shotsOff = matches.map(m => m.counts["Shots off target"] || 0);
  const totalShots = shotsOn.reduce((a, b) => a + b, 0) + shotsOff.reduce((a, b) => a + b, 0);
  const accuracy = totalShots > 0 ? Math.round((shotsOn.reduce((a, b) => a + b, 0) / totalShots) * 100) : 0;
  insights.push({
    title: "Shooting",
    icon: "🎯",
    color: "#06b6d4",
    text: `${totalShots} total shots across all matches. Shot accuracy (on target): ${accuracy}%. On target: ${shotsOn.reduce((a, b) => a + b, 0)}, Off target: ${shotsOff.reduce((a, b) => a + b, 0)}.`,
  });

  const avgConfs = matches.map(m => m.avgConf);
  const overallAvgConf = avgConfs.reduce((a, b) => a + b, 0) / matches.length;
  const bestConfIdx = avgConfs.indexOf(Math.max(...avgConfs));
  insights.push({
    title: "Detection Quality",
    icon: "🔍",
    color: "#a855f7",
    text: `Average detection confidence across all matches: ${(overallAvgConf * 100).toFixed(1)}%. Best quality match: "${shortName(matches[bestConfIdx].name, 22)}" at ${(avgConfs[bestConfIdx] * 100).toFixed(1)}%.`,
  });

  const eventFreq = {};
  matches.forEach(m => {
    Object.entries(m.counts).forEach(([k, v]) => {
      eventFreq[k] = (eventFreq[k] || 0) + v;
    });
  });
  const topEvent = Object.entries(eventFreq).sort((a, b) => b[1] - a[1])[0];
  if (topEvent) {
    insights.push({
      title: "Most Frequent Event",
      icon: "📋",
      color: "#f59e0b",
      text: `"${topEvent[0]}" was the most detected event across all matches with ${topEvent[1]} occurrences total.`,
    });
  }

  const corners = matches.map(m => m.counts["Corner"] || 0);
  const freeKicks = matches.map(m => (m.counts["Direct free-kick"] || 0) + (m.counts["Indirect free-kick"] || 0));
  const totalSet = corners.reduce((a, b) => a + b, 0) + freeKicks.reduce((a, b) => a + b, 0);
  const avgSet = (totalSet / matches.length).toFixed(1);
  insights.push({
    title: "Set Pieces",
    icon: "🚩",
    color: "#ec4899",
    text: `${totalSet} set pieces total (corners + free kicks) across all matches, averaging ${avgSet} per match.`,
  });

  // Phase analysis (Early / Mid / Late thirds) — always valid regardless of half count
  const phaseData = matches.map(m => {
    const maxSec = m.maxSec || 1;
    const third  = maxSec / 3;
    return {
      early: m.events.filter(e => e.position_seconds < third).length,
      mid:   m.events.filter(e => e.position_seconds >= third && e.position_seconds < third * 2).length,
      late:  m.events.filter(e => e.position_seconds >= third * 2).length,
    };
  });
  const totalEarly = phaseData.reduce((s, d) => s + d.early, 0);
  const totalMid   = phaseData.reduce((s, d) => s + d.mid,   0);
  const totalLate  = phaseData.reduce((s, d) => s + d.late,  0);
  const busiestPhase = totalEarly >= totalMid && totalEarly >= totalLate ? "early"
    : totalMid >= totalLate ? "middle" : "late";
  const phaseLabels = { early: "early (opening third)", middle: "middle third", late: "late (final third)" };
  insights.push({
    title: "Match Phase Analysis",
    icon: "⏱️",
    color: "#84cc16",
    text: `Across all matches, the ${phaseLabels[busiestPhase]} was the most active phase. Distribution: Early ${totalEarly} · Mid ${totalMid} · Late ${totalLate} events.`,
  });

  return insights;
}

// ─── SVG Chart Components ─────────────────────────────────────────────────────

function GroupedBarChart({ matches, getValue, label, unit = "" }) {
  const W = 520, H = 220, PL = 40, PR = 16, PT = 20, PB = 60;
  const cW = W - PL - PR;
  const cH = H - PT - PB;
  const n = matches.length;
  const vals = matches.map(m => getValue(m));
  const maxV = Math.max(1, ...vals);
  const barW = Math.min(44, (cW / n) * 0.6);
  const gap = cW / n;
  const gridLines = 4;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
      {/* grid lines */}
      {Array.from({ length: gridLines + 1 }, (_, i) => {
        const y = PT + cH - (i / gridLines) * cH;
        const val = ((i / gridLines) * maxV).toFixed(i === 0 ? 0 : 1);
        return (
          <g key={i}>
            <line x1={PL} y1={y} x2={W - PR} y2={y} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
            <text x={PL - 4} y={y + 4} textAnchor="end" fontSize="10" fill="rgba(255,255,255,0.35)">{val}</text>
          </g>
        );
      })}
      {/* bars */}
      {matches.map((m, i) => {
        const cx = PL + gap * i + gap / 2;
        const v = vals[i];
        const bH = (v / maxV) * cH;
        const x = cx - barW / 2;
        const y = PT + cH - bH;
        return (
          <g key={m.id}>
            <rect x={x} y={y} width={barW} height={Math.max(bH, 2)} rx="3" fill={m.color} opacity="0.85" />
            <text x={cx} y={y - 5} textAnchor="middle" fontSize="11" fill={m.color} fontWeight="600">
              {v}{unit}
            </text>
            <text x={cx} y={H - PB + 14} textAnchor="middle" fontSize="9.5" fill="rgba(255,255,255,0.5)">
              {shortName(m.shortName, 10)}
            </text>
          </g>
        );
      })}
      {/* axis */}
      <line x1={PL} y1={PT} x2={PL} y2={PT + cH} stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
      <line x1={PL} y1={PT + cH} x2={W - PR} y2={PT + cH} stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
      {label && (
        <text x={W / 2} y={H - 4} textAnchor="middle" fontSize="11" fill="rgba(255,255,255,0.45)">{label}</text>
      )}
    </svg>
  );
}

function RadarChart({ matches, axes }) {
  const cx = 160, cy = 155, R = 110, levels = 4;
  const n = axes.length;
  const angleStep = 360 / n;

  const allVals = axes.map(a => Math.max(1, ...matches.map(m => m.counts[a.key] || 0)));

  const pts = (m) =>
    axes.map((a, i) => {
      const maxV = allVals[i];
      const v = (m.counts[a.key] || 0) / maxV;
      const [x, y] = polarToCart(cx, cy, R * v, angleStep * i);
      return [x, y];
    });

  return (
    <svg viewBox="0 0 320 310" style={{ width: "100%", maxWidth: 320, height: "auto", display: "block" }}>
      {/* grid levels */}
      {Array.from({ length: levels }, (_, li) => {
        const r = R * ((li + 1) / levels);
        const poly = axes.map((_, i) => polarToCart(cx, cy, r, angleStep * i).join(",")).join(" ");
        return <polygon key={li} points={poly} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />;
      })}
      {/* axis lines and labels */}
      {axes.map((a, i) => {
        const [lx, ly] = polarToCart(cx, cy, R + 18, angleStep * i);
        const [ax, ay] = polarToCart(cx, cy, R, angleStep * i);
        return (
          <g key={a.key}>
            <line x1={cx} y1={cy} x2={ax} y2={ay} stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
            <text x={lx} y={ly + 4} textAnchor="middle" fontSize="9.5" fill="rgba(255,255,255,0.5)">{a.label}</text>
          </g>
        );
      })}
      {/* match polygons */}
      {matches.map((m, mi) => {
        const p = pts(m);
        const poly = p.map(([x, y]) => `${x},${y}`).join(" ");
        return (
          <g key={m.id}>
            <polygon points={poly} fill={m.color} fillOpacity="0.15" stroke={m.color} strokeWidth="1.5" strokeOpacity="0.9" />
            {p.map(([x, y], pi) => (
              <circle key={pi} cx={x} cy={y} r="3" fill={m.color} opacity="0.9" />
            ))}
          </g>
        );
      })}
      {/* legend */}
      {matches.map((m, i) => (
        <g key={m.id} transform={`translate(4, ${270 + i * 16})`}>
          <rect x="0" y="0" width="10" height="10" rx="2" fill={m.color} />
          <text x="14" y="9" fontSize="9" fill="rgba(255,255,255,0.6)">{shortName(m.shortName, 22)}</text>
        </g>
      ))}
    </svg>
  );
}

function StackedHBar({ matches, categories }) {
  const rowH = 32, PL = 110, PR = 20, PT = 8, barH = 18;
  const W = 520;
  const H = PT + matches.length * rowH + 20;

  const rowTotals = matches.map(m =>
    categories.reduce((s, c) => s + (m.counts[c.key] || 0), 0)
  );
  const maxT = Math.max(1, ...rowTotals);
  const barW = W - PL - PR;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
      {matches.map((m, ri) => {
        const y = PT + ri * rowH;
        let xOff = 0;
        const total = rowTotals[ri] || 1;
        return (
          <g key={m.id}>
            <text x={PL - 8} y={y + barH / 2 + 4} textAnchor="end" fontSize="10" fill="rgba(255,255,255,0.55)">
              {shortName(m.shortName, 14)}
            </text>
            {categories.map(c => {
              const v = m.counts[c.key] || 0;
              const w = (v / maxT) * barW;
              const seg = (
                <g key={c.key}>
                  <rect x={PL + xOff} y={y} width={w} height={barH} fill={c.color} opacity="0.85" />
                  {w > 18 && (
                    <text x={PL + xOff + w / 2} y={y + barH / 2 + 4} textAnchor="middle" fontSize="8" fill="#fff" opacity="0.9">
                      {v}
                    </text>
                  )}
                </g>
              );
              xOff += w;
              return seg;
            })}
            <text x={PL + xOff + 4} y={y + barH / 2 + 4} fontSize="10" fill="rgba(255,255,255,0.45)">
              {rowTotals[ri]}
            </text>
          </g>
        );
      })}
      {/* legend */}
      {categories.map((c, i) => (
        <g key={c.key} transform={`translate(${PL + i * 52}, ${H - 14})`}>
          <rect x="0" y="0" width="8" height="8" rx="1" fill={c.color} opacity="0.85" />
          <text x="11" y="8" fontSize="7.5" fill="rgba(255,255,255,0.4)">{c.label}</text>
        </g>
      ))}
    </svg>
  );
}

function MatrixHeatmap({ matches }) {
  const allLabels = useMemo(() => {
    const s = new Set();
    matches.forEach(m => Object.keys(m.counts).forEach(k => s.add(k)));
    return Array.from(s).sort();
  }, [matches]);

  const maxCount = useMemo(() => {
    let mx = 1;
    allLabels.forEach(lbl => {
      matches.forEach(m => {
        mx = Math.max(mx, m.counts[lbl] || 0);
      });
    });
    return mx;
  }, [allLabels, matches]);

  return (
    <div style={{ overflowX: "auto", width: "100%" }}>
      <table style={{ borderCollapse: "collapse", fontSize: 11, width: "100%", minWidth: 340 }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: "4px 8px", color: "rgba(255,255,255,0.4)", fontWeight: 500, fontSize: 10, background: "transparent", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
              Event
            </th>
            {matches.map(m => (
              <th key={m.id} style={{ padding: "4px 6px", color: m.color, fontWeight: 600, fontSize: 10, textAlign: "center", maxWidth: 64, borderBottom: "1px solid rgba(255,255,255,0.07)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {shortName(m.shortName, 10)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {allLabels.map((lbl, ri) => (
            <tr key={lbl} style={{ background: ri % 2 === 0 ? "rgba(255,255,255,0.015)" : "transparent" }}>
              <td style={{ padding: "3px 8px", color: "rgba(255,255,255,0.6)", whiteSpace: "nowrap", fontSize: 10 }}>{lbl}</td>
              {matches.map(m => {
                const v = m.counts[lbl] || 0;
                const intensity = v / maxCount;
                return (
                  <td key={m.id} style={{
                    padding: "3px 6px",
                    textAlign: "center",
                    background: v > 0 ? `rgba(59,130,246,${0.08 + intensity * 0.75})` : "transparent",
                    color: v > 0 ? "#fff" : "rgba(255,255,255,0.18)",
                    fontWeight: v > 0 ? 600 : 400,
                    fontSize: 10,
                    borderRadius: 3,
                    transition: "background 0.2s",
                  }}>
                    {v > 0 ? v : "·"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MomentumMultiChart({ matches }) {
  const W = 540, H = 200, PL = 32, PR = 16, PT = 16, PB = 36;
  const cW = W - PL - PR, cH = H - PT - PB;
  const WIN = 300; // 5-min windows in seconds

  const maxSec = Math.max(1, ...matches.map(m => m.maxSec || 0));
  const numBins = Math.ceil(maxSec / WIN) || 1;

  const getBins = (m) => Array.from({ length: numBins }, (_, bi) =>
    m.events.filter(e => e.position_seconds >= bi * WIN && e.position_seconds < (bi + 1) * WIN).length
  );

  const allBins = matches.map(getBins);
  const maxBin = Math.max(1, ...allBins.flat());

  const xOf = (bi) => PL + (bi / (numBins - 1 || 1)) * cW;
  const yOf = (v) => PT + cH - (v / maxBin) * cH;

  const xTicks = [];
  for (let s = 0; s <= maxSec; s += 900) xTicks.push(s);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
      {/* grid */}
      {[0, 0.25, 0.5, 0.75, 1].map((f, i) => {
        const y = PT + cH * (1 - f);
        return <line key={i} x1={PL} y1={y} x2={W - PR} y2={y} stroke="rgba(255,255,255,0.07)" strokeWidth="1" />;
      })}
      {/* area + line per match */}
      {matches.map((m, mi) => {
        const bins = allBins[mi];
        if (bins.length < 2) return null;
        const linePoints = bins.map((v, bi) => [xOf(bi), yOf(v)]);
        const areaPath = [
          `M ${xOf(0)} ${PT + cH}`,
          ...linePoints.map(([x, y]) => `L ${x} ${y}`),
          `L ${xOf(numBins - 1)} ${PT + cH}`,
          "Z",
        ].join(" ");
        const linePath = linePoints.map(([x, y], i) => (i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`)).join(" ");
        return (
          <g key={m.id}>
            <path d={areaPath} fill={m.color} fillOpacity="0.12" />
            <path d={linePath} fill="none" stroke={m.color} strokeWidth="2" strokeOpacity="0.85" strokeLinejoin="round" />
            {linePoints.map(([x, y], pi) => (
              <circle key={pi} cx={x} cy={y} r="2.5" fill={m.color} opacity="0.8" />
            ))}
          </g>
        );
      })}
      {/* x ticks */}
      {xTicks.map(s => {
        const bi = s / WIN;
        if (bi > numBins - 1) return null;
        const x = PL + (bi / (numBins - 1 || 1)) * cW;
        const min = Math.floor(s / 60);
        return (
          <g key={s}>
            <line x1={x} y1={PT + cH} x2={x} y2={PT + cH + 4} stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
            <text x={x} y={PT + cH + 14} textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.35)">{min}'</text>
          </g>
        );
      })}
      {/* axes */}
      <line x1={PL} y1={PT} x2={PL} y2={PT + cH} stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
      <line x1={PL} y1={PT + cH} x2={W - PR} y2={PT + cH} stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
      {/* legend */}
      {matches.map((m, i) => (
        <g key={m.id} transform={`translate(${PL + i * 100}, ${H - 8})`}>
          <rect x="0" y="-6" width="8" height="3" rx="1" fill={m.color} opacity="0.85" />
          <text x="11" y="0" fontSize="8" fill="rgba(255,255,255,0.45)">{shortName(m.shortName, 10)}</text>
        </g>
      ))}
    </svg>
  );
}

// Divides each match into 3 equal time thirds (Early / Mid / Late)
function MatchPhaseChart({ matches }) {
  const PHASES = [
    { label: "Early",  opacity: 0.95 },
    { label: "Mid",    opacity: 0.60 },
    { label: "Late",   opacity: 0.30 },
  ];

  // For each match compute event counts in each third
  const matchData = matches.map(m => {
    const maxSec = m.maxSec || 1;
    const third  = maxSec / 3;
    return {
      ...m,
      phases: [
        m.events.filter(e => e.position_seconds <  third).length,
        m.events.filter(e => e.position_seconds >= third && e.position_seconds < third * 2).length,
        m.events.filter(e => e.position_seconds >= third * 2).length,
      ],
    };
  });

  const maxV = Math.max(1, ...matchData.flatMap(m => m.phases));

  const W = 560, H = 210, PL = 40, PR = 16, PT = 20, PB = 50;
  const cW = W - PL - PR, cH = H - PT - PB;
  const n = matchData.length;
  const grpW = cW / n;
  const barW = Math.min(18, grpW * 0.27);
  const gap  = 3;
  const gridLines = 4;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
      {/* Grid lines */}
      {Array.from({ length: gridLines + 1 }, (_, i) => {
        const y = PT + cH - (i / gridLines) * cH;
        return (
          <g key={i}>
            <line x1={PL} y1={y} x2={W - PR} y2={y} stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
            <text x={PL - 4} y={y + 4} textAnchor="end" fontSize="9" fill="rgba(255,255,255,0.3)">
              {Math.round((i / gridLines) * maxV)}
            </text>
          </g>
        );
      })}

      {/* Bars */}
      {matchData.map((m, mi) => {
        const groupCX = PL + grpW * mi + grpW / 2;
        const totalBarW = (barW + gap) * 3 - gap;
        const startX = groupCX - totalBarW / 2;
        return (
          <g key={m.id}>
            {m.phases.map((v, pi) => {
              const bH = (v / maxV) * cH;
              const x  = startX + pi * (barW + gap);
              const y  = PT + cH - bH;
              return (
                <g key={pi}>
                  <rect x={x} y={y} width={barW} height={Math.max(bH, 2)}
                    rx="3" fill={m.color} opacity={PHASES[pi].opacity} />
                  {v > 0 && (
                    <text x={x + barW / 2} y={y - 4} textAnchor="middle"
                      fontSize="9" fill={m.color} opacity={PHASES[pi].opacity}>{v}</text>
                  )}
                </g>
              );
            })}
            <text x={groupCX} y={H - PB + 14} textAnchor="middle"
              fontSize="9" fill="rgba(255,255,255,0.45)">
              {shortName(m.shortName, 10)}
            </text>
          </g>
        );
      })}

      {/* Axes */}
      <line x1={PL} y1={PT} x2={PL} y2={PT + cH} stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
      <line x1={PL} y1={PT + cH} x2={W - PR} y2={PT + cH} stroke="rgba(255,255,255,0.15)" strokeWidth="1" />

      {/* Legend */}
      {PHASES.map((p, i) => (
        <g key={p.label} transform={`translate(${W - PR - 150 + i * 50}, ${PT})`}>
          <rect x="0" y="0" width="9" height="9" rx="2" fill="#94a3b8" opacity={p.opacity} />
          <text x="13" y="8.5" fontSize="9" fill="rgba(255,255,255,0.45)">{p.label}</text>
        </g>
      ))}
    </svg>
  );
}

function ConfidenceBarChart({ matches }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {matches.map(m => {
        const pct = (m.avgConf * 100).toFixed(1);
        return (
          <div key={m.id}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.65)" }}>{shortName(m.shortName, 26)}</span>
              <span style={{ fontSize: 12, color: m.color, fontWeight: 700 }}>{pct}%</span>
            </div>
            <div style={{ height: 8, background: "rgba(255,255,255,0.07)", borderRadius: 8, overflow: "hidden" }}>
              <div style={{
                height: "100%",
                width: `${pct}%`,
                background: `linear-gradient(90deg, ${m.color}cc, ${m.color})`,
                borderRadius: 8,
                transition: "width 0.5s ease",
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DonutChart({ matches, getVal, title }) {
  const cx = 80, cy = 80, R = 60, iR = 36;
  const vals = matches.map(m => getVal(m));
  const total = vals.reduce((a, b) => a + b, 0) || 1;
  let startAngle = -90;

  const slices = matches.map((m, i) => {
    const fraction = vals[i] / total;
    const sweep = fraction * 360;
    const endAngle = startAngle + sweep;
    const large = sweep > 180 ? 1 : 0;

    const toRad = (deg) => (deg * Math.PI) / 180;
    const ox1 = cx + R * Math.cos(toRad(startAngle));
    const oy1 = cy + R * Math.sin(toRad(startAngle));
    const ox2 = cx + R * Math.cos(toRad(endAngle));
    const oy2 = cy + R * Math.sin(toRad(endAngle));
    const ix1 = cx + iR * Math.cos(toRad(startAngle));
    const iy1 = cy + iR * Math.sin(toRad(startAngle));
    const ix2 = cx + iR * Math.cos(toRad(endAngle));
    const iy2 = cy + iR * Math.sin(toRad(endAngle));

    const d = sweep < 0.01 ? "" :
      `M ${ox1} ${oy1} A ${R} ${R} 0 ${large} 1 ${ox2} ${oy2} L ${ix2} ${iy2} A ${iR} ${iR} 0 ${large} 0 ${ix1} ${iy1} Z`;

    const slice = { d, color: m.color, val: vals[i], m };
    startAngle = endAngle;
    return slice;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <svg viewBox="0 0 160 160" style={{ width: 130, height: 130 }}>
        {slices.map((s, i) => s.d && (
          <path key={i} d={s.d} fill={s.color} opacity="0.85" stroke="#0f172a" strokeWidth="1.5" />
        ))}
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="13" fontWeight="700" fill="rgba(255,255,255,0.9)">{total}</text>
        <text x={cx} y={cy + 11} textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.4)">total</text>
      </svg>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", textAlign: "center", marginBottom: 2 }}>{title}</div>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "4px 10px" }}>
        {matches.map((m, i) => (
          <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: m.color }} />
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>{vals[i]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniTimeline({ match }) {
  const W = 380, H = 56, PL = 8, PR = 8, PY = 10;
  const tW = W - PL - PR;
  const maxSec = match.maxSec || 1;

  // lane stacking: events within 10px get pushed to next lane
  const lanes = [];
  const getX = (s) => PL + (s / maxSec) * tW;
  const sorted = [...match.events].sort((a, b) => a.position_seconds - b.position_seconds);

  const laneAssignments = sorted.map(e => {
    const x = getX(e.position_seconds);
    let lane = 0;
    while (lanes[lane] !== undefined && x - lanes[lane] < 10) lane++;
    lanes[lane] = x;
    return { e, x, lane };
  });

  const maxLane = Math.max(0, ...laneAssignments.map(a => a.lane));
  const svgH = Math.max(H, PY * 2 + (maxLane + 1) * 10 + 12);

  return (
    <svg viewBox={`0 0 ${W} ${svgH}`} style={{ width: "100%", height: "auto", display: "block" }}>
      <line x1={PL} y1={svgH / 2} x2={W - PR} y2={svgH / 2} stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />
      {[0, 0.25, 0.5, 0.75, 1].map(f => {
        const x = PL + f * tW;
        const min = Math.round(f * (maxSec / 60));
        return (
          <g key={f}>
            <line x1={x} y1={svgH / 2 - 5} x2={x} y2={svgH / 2 + 5} stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
            <text x={x} y={svgH - 2} textAnchor="middle" fontSize="8" fill="rgba(255,255,255,0.25)">{min}'</text>
          </g>
        );
      })}
      {laneAssignments.map(({ e, x, lane }, i) => {
        const y = svgH / 2 - 6 - lane * 10;
        return (
          <circle key={i} cx={x} cy={y} r="3.5" fill={match.color} opacity="0.7">
            <title>{e.label} {e.gameTime || ""}</title>
          </circle>
        );
      })}
    </svg>
  );
}

// ─── Tab Panels ───────────────────────────────────────────────────────────────

function OverviewTab({ matches }) {
  const allLabels = useMemo(() => {
    const s = new Set();
    matches.forEach(m => Object.keys(m.counts).forEach(k => s.add(k)));
    return Array.from(s);
  }, [matches]);

  return (
    <div className="mmd-tab-content">
      {/* Match summary cards */}
      <div className="mmd-section-title">Match Summaries</div>
      <div className="mmd-cards-grid">
        {matches.map(m => (
          <div key={m.id} className="mmd-match-card" style={{ borderLeft: `3px solid ${m.color}` }}>
            <div className="mmd-match-card-name" style={{ color: m.color }}>{shortName(m.shortName, 24)}</div>
            <div className="mmd-match-card-date">{m.date ? new Date(m.date).toLocaleDateString() : "—"}</div>
            <div className="mmd-match-card-stats">
              <span><b>{m.events.length}</b> events</span>
              <span><b>{m.counts["Goal"] || 0}</b> goals</span>
              <span><b>{(m.avgConf * 100).toFixed(0)}%</b> conf</span>
            </div>
          </div>
        ))}
      </div>

      {/* Key stats comparison table */}
      <div className="mmd-section-title" style={{ marginTop: 24 }}>Key Stats Comparison</div>
      <div style={{ overflowX: "auto" }}>
        <table className="mmd-stats-table">
          <thead>
            <tr>
              <th>Stat</th>
              {matches.map(m => (
                <th key={m.id} style={{ color: m.color }}>{shortName(m.shortName, 12)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {KEY_STATS.map(({ key, label }, ri) => (
              <tr key={key} style={{ background: ri % 2 === 0 ? "rgba(255,255,255,0.018)" : "transparent" }}>
                <td className="mmd-stats-table-label">{label}</td>
                {matches.map(m => {
                  const v = m.counts[key] || 0;
                  const allV = matches.map(mm => mm.counts[key] || 0);
                  const maxV = Math.max(1, ...allV);
                  const isMax = v === Math.max(...allV) && v > 0;
                  return (
                    <td key={m.id} className="mmd-stats-table-val" style={{
                      color: isMax ? m.color : "rgba(255,255,255,0.65)",
                      fontWeight: isMax ? 700 : 400,
                    }}>
                      {v}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Donut charts row */}
      <div className="mmd-section-title" style={{ marginTop: 24 }}>Distribution Overview</div>
      <div className="mmd-donuts-row">
        <DonutChart matches={matches} getVal={m => m.events.length} title="Total Events" />
        <DonutChart matches={matches} getVal={m => m.counts["Goal"] || 0} title="Goals" />
        <DonutChart matches={matches} getVal={m => (m.counts["Shots on target"] || 0) + (m.counts["Shots off target"] || 0)} title="Total Shots" />
        <DonutChart matches={matches} getVal={m => m.counts["Foul"] || 0} title="Fouls" />
      </div>
    </div>
  );
}

function EventsTab({ matches }) {
  const allLabels = useMemo(() => {
    const freq = {};
    matches.forEach(m => Object.entries(m.counts).forEach(([k, v]) => { freq[k] = (freq[k] || 0) + v; }));
    return Object.entries(freq).sort((a, b) => b[1] - a[1]).map(([k]) => k);
  }, [matches]);

  return (
    <div className="mmd-tab-content">
      <div className="mmd-section-title">Total Events per Match</div>
      <div className="mmd-chart-box">
        <GroupedBarChart matches={matches} getValue={m => m.events.length} label="Events" />
      </div>

      <div className="mmd-two-col">
        <div>
          <div className="mmd-section-title">Radar Comparison</div>
          <div className="mmd-chart-box" style={{ display: "flex", justifyContent: "center" }}>
            <RadarChart matches={matches} axes={RADAR_AXES} />
          </div>
        </div>
        <div>
          <div className="mmd-section-title">Stacked Event Breakdown</div>
          <div className="mmd-chart-box">
            <StackedHBar matches={matches} categories={STACKED_CATS} />
          </div>
        </div>
      </div>

      <div className="mmd-section-title" style={{ marginTop: 20 }}>Event Frequency Heatmap</div>
      <div className="mmd-chart-box">
        <MatrixHeatmap matches={matches} />
      </div>

      <div className="mmd-section-title" style={{ marginTop: 20 }}>Most Common Events (All Matches)</div>
      <div className="mmd-chart-box">
        <GroupedBarChart
          matches={[{
            id: "total",
            shortName: "All",
            color: "#3b82f6",
            counts: (() => {
              const c = {};
              matches.forEach(m => Object.entries(m.counts).forEach(([k, v]) => { c[k] = (c[k] || 0) + v; }));
              return c;
            })(),
          }]}
          getValue={m => {
            const top = Object.entries(m.counts).sort((a, b) => b[1] - a[1])[0];
            return top ? top[1] : 0;
          }}
          label="Top Event Count"
        />
      </div>

      <div className="mmd-section-title" style={{ marginTop: 20 }}>Individual Stats by Match</div>
      <div className="mmd-2col-grid">
        {[
          { key: "Goal", label: "Goals per Match" },
          { key: "Shots on target", label: "Shots on Target" },
          { key: "Foul", label: "Fouls per Match" },
          { key: "Corner", label: "Corners per Match" },
        ].map(({ key, label }) => (
          <div key={key} className="mmd-chart-box">
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginBottom: 6 }}>{label}</div>
            <GroupedBarChart matches={matches} getValue={m => m.counts[key] || 0} label={label} />
          </div>
        ))}
      </div>
    </div>
  );
}

function TimelineTab({ matches }) {
  return (
    <div className="mmd-tab-content">
      <div className="mmd-section-title">Momentum Chart (5-min Windows)</div>
      <div className="mmd-chart-box">
        <MomentumMultiChart matches={matches} />
      </div>

      <div className="mmd-section-title" style={{ marginTop: 20 }}>Match Phase Analysis — Early / Mid / Late</div>
      <div className="mmd-chart-box">
        <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, margin: "0 0 10px" }}>
          Each match is split into three equal time segments. Darker bar = earlier in the match.
        </p>
        <MatchPhaseChart matches={matches} />
      </div>

      <div className="mmd-section-title" style={{ marginTop: 20 }}>Match Timelines</div>
      {matches.map(m => (
        <div key={m.id} className="mmd-mini-timeline">
          <div className="mmd-mini-timeline-label" style={{ color: m.color }}>{shortName(m.shortName, 30)}</div>
          <MiniTimeline match={m} />
        </div>
      ))}
    </div>
  );
}

function QualityTab({ matches }) {
  const buckets = [
    { label: "50–65%", min: 0.50, max: 0.65 },
    { label: "65–75%", min: 0.65, max: 0.75 },
    { label: "75–85%", min: 0.75, max: 0.85 },
    { label: "85–95%", min: 0.85, max: 0.95 },
    { label: "95–100%", min: 0.95, max: 1.01 },
  ];

  const highConfMatches = useMemo(() =>
    matches.map(m => ({
      ...m,
      counts: { "High-conf events": m.events.filter(e => e.confidence >= 0.9).length },
    })),
    [matches]
  );

  return (
    <div className="mmd-tab-content">
      <div className="mmd-section-title">Average Confidence per Match</div>
      <div className="mmd-chart-box">
        <ConfidenceBarChart matches={matches} />
      </div>

      <div className="mmd-section-title" style={{ marginTop: 20 }}>Confidence Distribution</div>
      <div style={{ overflowX: "auto" }}>
        <table className="mmd-stats-table">
          <thead>
            <tr>
              <th>Bucket</th>
              {matches.map(m => (
                <th key={m.id} style={{ color: m.color }}>{shortName(m.shortName, 12)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {buckets.map(({ label, min, max }, ri) => (
              <tr key={label} style={{ background: ri % 2 === 0 ? "rgba(255,255,255,0.018)" : "transparent" }}>
                <td className="mmd-stats-table-label">{label}</td>
                {matches.map(m => {
                  const cnt = m.events.filter(e => e.confidence >= min && e.confidence < max).length;
                  return (
                    <td key={m.id} className="mmd-stats-table-val" style={{ color: cnt > 0 ? m.color : "rgba(255,255,255,0.3)" }}>
                      {cnt}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mmd-section-title" style={{ marginTop: 20 }}>High-Confidence Events (≥90%)</div>
      <div className="mmd-chart-box">
        <GroupedBarChart
          matches={highConfMatches}
          getValue={m => m.counts["High-conf events"]}
          label="Events ≥ 90% confidence"
        />
      </div>
    </div>
  );
}

// ─── Team helpers ─────────────────────────────────────────────────────────────
function getTeamStatsForMatch(events, teamName) {
  const te = events.filter(e => e.team === teamName);
  const color = te.find(e => e.team_color)?.team_color
    || (teamName === "Team 1" ? "#3b82f6" : "#f43f5e");
  return {
    color,
    goals:     te.filter(e => e.label === "Goal").length,
    shotsOn:   te.filter(e => e.label === "Shots on target").length,
    shotsOff:  te.filter(e => e.label === "Shots off target").length,
    fouls:     te.filter(e => e.label === "Foul").length,
    corners:   te.filter(e => e.label === "Corner").length,
    yellow:    te.filter(e => e.label === "Yellow card").length,
    red:       te.filter(e => ["Red card","Yellow->red card"].includes(e.label)).length,
    freekicks: te.filter(e => e.label.includes("free-kick")).length,
    offsides:  te.filter(e => e.label === "Offside").length,
    penalty:   te.filter(e => e.label === "Penalty").length,
    total:     te.length,
  };
}

// SVG grouped bar chart for Team 1 vs Team 2 across matches
function TeamGroupedBar({ matchTeamStats, getV1, getV2, label }) {
  const W=520, H=200, PL=40, PR=16, PT=20, PB=56;
  const cW=W-PL-PR, cH=H-PT-PB;
  const n = matchTeamStats.length;
  const allVals = matchTeamStats.flatMap(m => [getV1(m), getV2(m)]);
  const maxV = Math.max(1, ...allVals);
  const grpW = cW / n;
  const bW = Math.min(18, grpW * 0.3);
  const gap = 4;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width:"100%", height:"auto", display:"block" }}>
      {[0.25,0.5,0.75,1].map((f,i) => {
        const y = PT + cH - f*cH;
        return (
          <g key={i}>
            <line x1={PL} y1={y} x2={W-PR} y2={y} stroke="rgba(255,255,255,0.07)" strokeWidth="1"/>
            <text x={PL-4} y={y+4} textAnchor="end" fontSize={9} fill="rgba(255,255,255,0.3)">{Math.round(f*maxV)}</text>
          </g>
        );
      })}
      {matchTeamStats.map((m, i) => {
        const cx = PL + grpW*i + grpW/2;
        const v1 = getV1(m), v2 = getV2(m);
        const h1 = (v1/maxV)*cH, h2 = (v2/maxV)*cH;
        const x1 = cx - bW - gap/2;
        const x2 = cx + gap/2;
        return (
          <g key={m.id}>
            {h1>0 && <>
              <rect x={x1} y={PT+cH-h1} width={bW} height={h1} rx="3" fill={m.s1.color} opacity="0.85"/>
              <text x={x1+bW/2} y={PT+cH-h1-4} textAnchor="middle" fontSize={10} fill={m.s1.color} fontWeight="600">{v1}</text>
            </>}
            {h2>0 && <>
              <rect x={x2} y={PT+cH-h2} width={bW} height={h2} rx="3" fill={m.s2.color} opacity="0.85"/>
              <text x={x2+bW/2} y={PT+cH-h2-4} textAnchor="middle" fontSize={10} fill={m.s2.color} fontWeight="600">{v2}</text>
            </>}
            <text x={cx} y={H-PB+14} textAnchor="middle" fontSize={9} fill="rgba(255,255,255,0.45)">{shortName(m.shortName,10)}</text>
          </g>
        );
      })}
      <line x1={PL} y1={PT} x2={PL} y2={PT+cH} stroke="rgba(255,255,255,0.15)" strokeWidth="1"/>
      <line x1={PL} y1={PT+cH} x2={W-PR} y2={PT+cH} stroke="rgba(255,255,255,0.15)" strokeWidth="1"/>
      {/* Legend */}
      {matchTeamStats.length > 0 && (
        <>
          <rect x={PL} y={H-14} width={9} height={9} rx="2" fill={matchTeamStats[0].s1.color} opacity="0.85"/>
          <text x={PL+13} y={H-6} fontSize={9} fill="rgba(255,255,255,0.45)">Team 1</text>
          <rect x={PL+62} y={H-14} width={9} height={9} rx="2" fill={matchTeamStats[0].s2.color} opacity="0.85"/>
          <text x={PL+75} y={H-6} fontSize={9} fill="rgba(255,255,255,0.45)">Team 2</text>
        </>
      )}
      {label && <text x={W/2} y={H-4} textAnchor="middle" fontSize={10} fill="rgba(255,255,255,0.3)">{label}</text>}
    </svg>
  );
}

const TEAM_STAT_ROWS = [
  { key:"goals",     label:"Goals" },
  { key:"shotsOn",   label:"Shots on Target" },
  { key:"shotsOff",  label:"Shots off Target" },
  { key:"fouls",     label:"Fouls" },
  { key:"corners",   label:"Corners" },
  { key:"yellow",    label:"Yellow Cards" },
  { key:"red",       label:"Red Cards" },
  { key:"freekicks", label:"Free Kicks" },
  { key:"offsides",  label:"Offsides" },
  { key:"penalty",   label:"Penalties" },
];

function TeamsTab({ matches }) {
  const matchTeamStats = useMemo(() => matches.map(m => {
    const s1 = getTeamStatsForMatch(m.events, "Team 1");
    const s2 = getTeamStatsForMatch(m.events, "Team 2");
    const off1 = s1.goals*5 + s1.shotsOn*2 + s1.shotsOff + s1.corners*0.5;
    const off2 = s2.goals*5 + s2.shotsOn*2 + s2.shotsOff + s2.corners*0.5;
    const tot  = off1 + off2 || 1;
    const JERSEY_HEX = { red:"#cc2200",blue:"#1144cc",green:"#15803d",white:"#e2e8f0",black:"#334155",yellow:"#eab308",orange:"#f97316",purple:"#8b5cf6",pink:"#ec4899",gray:"#6b7280",grey:"#6b7280",navy:"#1e3a8a",maroon:"#991b1b",cyan:"#06b6d4",teal:"#0d9488" };
    const tc = m.team_colors;
    s1.color = tc?.team1?.hex || JERSEY_HEX[tc?.team1?.name?.toLowerCase()] || s1.color;
    s2.color = tc?.team2?.hex || JERSEY_HEX[tc?.team2?.name?.toLowerCase()] || s2.color;
    return { ...m, s1, s2, dom1: Math.round(off1/tot*100), dom2: Math.round(off2/tot*100) };
  }), [matches]);

  const hasTeamData = matchTeamStats.some(m => m.s1.total > 0 || m.s2.total > 0);

  if (!hasTeamData) {
    return (
      <div className="mmd-tab-content" style={{ textAlign:"center", padding:"4rem 2rem" }}>
        <div style={{ fontSize:"2.5rem", marginBottom:"1rem" }}>🔍</div>
        <p style={{ color:"rgba(255,255,255,0.35)", fontSize:"0.9rem", margin:0 }}>
          No team attribution data found in these matches.<br/>
          Re-analyze videos to get team-based stats.
        </p>
      </div>
    );
  }

  return (
    <div className="mmd-tab-content">

      {/* ── Per-match scorecards ── */}
      <div className="mmd-section-title">Team Performance Per Match</div>
      <div className="mmd-cards-grid">
        {matchTeamStats.map(m => (
          <div key={m.id} className="mmd-team-scorecard">
            <div className="mmd-sc-match-name" style={{ color:m.color }}>{shortName(m.shortName,20)}</div>

            {/* Score */}
            <div className="mmd-sc-score">
              <span className="mmd-sc-team" style={{ color:m.s1.color }}>
                <span className="mmd-sc-dot" style={{ background:m.s1.color }}/>T1
              </span>
              <span className="mmd-sc-num" style={{ color:m.s1.color }}>{m.s1.goals}</span>
              <span className="mmd-sc-dash">—</span>
              <span className="mmd-sc-num" style={{ color:m.s2.color }}>{m.s2.goals}</span>
              <span className="mmd-sc-team mmd-sc-team-r" style={{ color:m.s2.color }}>
                T2<span className="mmd-sc-dot" style={{ background:m.s2.color }}/>
              </span>
            </div>

            {/* Dominance bar */}
            <div className="mmd-sc-dom-row">
              <span style={{ color:m.s1.color, fontSize:"0.7rem", fontWeight:700 }}>{m.dom1}%</span>
              <div className="mmd-sc-dom-track">
                <div style={{ width:`${m.dom1}%`, background:m.s1.color, height:"100%", borderRadius:"999px 0 0 999px", transition:"width 0.8s" }}/>
                <div style={{ width:`${m.dom2}%`, background:m.s2.color, height:"100%", borderRadius:"0 999px 999px 0", transition:"width 0.8s" }}/>
              </div>
              <span style={{ color:m.s2.color, fontSize:"0.7rem", fontWeight:700 }}>{m.dom2}%</span>
            </div>

            {/* Mini key stats */}
            <div className="mmd-sc-stats">
              {[
                { label:"Shots on", v1:m.s1.shotsOn,  v2:m.s2.shotsOn  },
                { label:"Fouls",    v1:m.s1.fouls,     v2:m.s2.fouls    },
                { label:"Corners",  v1:m.s1.corners,   v2:m.s2.corners  },
                { label:"Yellows",  v1:m.s1.yellow,    v2:m.s2.yellow   },
              ].map(row => (
                <div key={row.label} className="mmd-sc-stat-row">
                  <span style={{ color:row.v1>row.v2?m.s1.color:"rgba(255,255,255,0.5)", fontWeight:row.v1>row.v2?700:400 }}>{row.v1}</span>
                  <span className="mmd-sc-stat-lbl">{row.label}</span>
                  <span style={{ color:row.v2>row.v1?m.s2.color:"rgba(255,255,255,0.5)", fontWeight:row.v2>row.v1?700:400 }}>{row.v2}</span>
                </div>
              ))}
            </div>

            {/* Dominant team badge */}
            <div className="mmd-sc-verdict" style={{
              color: m.dom1>m.dom2?m.s1.color:m.dom2>m.dom1?m.s2.color:"rgba(255,255,255,0.35)",
              borderColor: m.dom1>m.dom2?`${m.s1.color}40`:m.dom2>m.dom1?`${m.s2.color}40`:"rgba(255,255,255,0.1)",
              background: m.dom1>m.dom2?`${m.s1.color}10`:m.dom2>m.dom1?`${m.s2.color}10`:"transparent",
            }}>
              {m.dom1>m.dom2 ? "Team 1 dominant" : m.dom2>m.dom1 ? "Team 2 dominant" : "Balanced"}
            </div>
          </div>
        ))}
      </div>

      {/* ── Goals chart ── */}
      <div className="mmd-section-title" style={{ marginTop:24 }}>Goals: Team 1 vs Team 2</div>
      <div className="mmd-chart-box">
        <TeamGroupedBar matchTeamStats={matchTeamStats} getV1={m=>m.s1.goals} getV2={m=>m.s2.goals} label="Goals per team per match" />
      </div>

      {/* ── Shots chart ── */}
      <div className="mmd-two-col" style={{ marginTop:16 }}>
        <div>
          <div className="mmd-section-title">Shots on Target</div>
          <div className="mmd-chart-box">
            <TeamGroupedBar matchTeamStats={matchTeamStats} getV1={m=>m.s1.shotsOn} getV2={m=>m.s2.shotsOn} label="Shots on target" />
          </div>
        </div>
        <div>
          <div className="mmd-section-title">Fouls Committed</div>
          <div className="mmd-chart-box">
            <TeamGroupedBar matchTeamStats={matchTeamStats} getV1={m=>m.s1.fouls} getV2={m=>m.s2.fouls} label="Fouls" />
          </div>
        </div>
      </div>

      {/* ── Detailed stats table ── */}
      <div className="mmd-section-title" style={{ marginTop:24 }}>Detailed Stats by Match & Team</div>
      <div style={{ overflowX:"auto" }}>
        <table className="mmd-stats-table">
          <thead>
            <tr>
              <th style={{ textAlign:"left" }}>Stat</th>
              {matchTeamStats.map(m => (
                <React.Fragment key={m.id}>
                  <th style={{ color:m.s1.color }}>{shortName(m.shortName,9)} T1</th>
                  <th style={{ color:m.s2.color }}>{shortName(m.shortName,9)} T2</th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {TEAM_STAT_ROWS.map(({ key, label }, ri) => (
              <tr key={key} style={{ background: ri%2===0?"rgba(255,255,255,0.018)":"transparent" }}>
                <td className="mmd-stats-table-label">{label}</td>
                {matchTeamStats.map(m => {
                  const v1 = m.s1[key]||0, v2 = m.s2[key]||0;
                  return (
                    <React.Fragment key={m.id}>
                      <td className="mmd-stats-table-val" style={{ color:v1>v2?m.s1.color:"rgba(255,255,255,0.5)", fontWeight:v1>v2?700:400 }}>{v1}</td>
                      <td className="mmd-stats-table-val" style={{ color:v2>v1?m.s2.color:"rgba(255,255,255,0.5)", fontWeight:v2>v1?700:400 }}>{v2}</td>
                    </React.Fragment>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Cross-match dominance summary ── */}
      <div className="mmd-section-title" style={{ marginTop:24 }}>Dominance Across Matches</div>
      <div style={{ display:"flex", flexDirection:"column", gap:"0.65rem" }}>
        {matchTeamStats.map(m => (
          <div key={m.id} className="mmd-chart-box" style={{ padding:"0.9rem 1rem" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"0.45rem" }}>
              <span style={{ color:m.color, fontSize:"0.85rem", fontWeight:600 }}>{shortName(m.shortName,22)}</span>
              <span style={{
                fontSize:"0.72rem", fontWeight:700, padding:"0.15rem 0.6rem",
                borderRadius:"999px", border:"1px solid",
                color:m.dom1>m.dom2?m.s1.color:m.dom2>m.dom1?m.s2.color:"rgba(255,255,255,0.4)",
                borderColor:m.dom1>m.dom2?`${m.s1.color}50`:m.dom2>m.dom1?`${m.s2.color}50`:"rgba(255,255,255,0.1)",
              }}>
                {m.dom1>m.dom2?"Team 1 dominant":m.dom2>m.dom1?"Team 2 dominant":"Balanced"}
              </span>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:"0.6rem" }}>
              <span style={{ color:m.s1.color, fontSize:"0.8rem", fontWeight:700, minWidth:38 }}>{m.dom1}%</span>
              <div style={{ flex:1, height:8, background:"rgba(255,255,255,0.05)", borderRadius:999, overflow:"hidden", display:"flex" }}>
                <div style={{ width:`${m.dom1}%`, background:m.s1.color, height:"100%", borderRadius:"999px 0 0 999px", transition:"width 0.8s" }}/>
                <div style={{ width:`${m.dom2}%`, background:m.s2.color, height:"100%", borderRadius:"0 999px 999px 0", transition:"width 0.8s" }}/>
              </div>
              <span style={{ color:m.s2.color, fontSize:"0.8rem", fontWeight:700, minWidth:38, textAlign:"right" }}>{m.dom2}%</span>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", marginTop:"0.3rem", fontSize:"0.7rem", color:"rgba(255,255,255,0.3)" }}>
              <span style={{ color:m.s1.color }}>T1: {m.s1.goals}G {m.s1.shotsOn}S {m.s1.corners}C</span>
              <span style={{ color:m.s2.color }}>T2: {m.s2.goals}G {m.s2.shotsOn}S {m.s2.corners}C</span>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}

function InsightsTab({ matches }) {
  const insights = useMemo(() => generateMultiInsights(matches), [matches]);

  return (
    <div className="mmd-tab-content">
      <div className="mmd-section-title">Auto-Generated Insights</div>
      <div className="mmd-insights-grid">
        {insights.map((ins, i) => (
          <div key={i} className="mmd-insight-card" style={{ borderLeft: `3px solid ${ins.color}` }}>
            <div className="mmd-insight-header">
              <span className="mmd-insight-icon">{ins.icon}</span>
              <span className="mmd-insight-title" style={{ color: ins.color }}>{ins.title}</span>
            </div>
            <p className="mmd-insight-text">{ins.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function MultiMatchDashboard({ matches: rawMatches, onClose }) {
  const [activeTab, setActiveTab] = useState(0);

  const matches = useMemo(() => processMatches(rawMatches || []), [rawMatches]);

  const tabContent = useMemo(() => {
    switch (activeTab) {
      case 0: return <OverviewTab matches={matches} />;
      case 1: return <EventsTab matches={matches} />;
      case 2: return <TimelineTab matches={matches} />;
      case 3: return <QualityTab matches={matches} />;
      case 4: return <TeamsTab matches={matches} />;
      case 5: return <InsightsTab matches={matches} />;
      default: return null;
    }
  }, [activeTab, matches]);

  return (
    <div className="mmd-overlay">
      <div className="mmd-wrap">
        {/* Header */}
        <div className="mmd-header">
          <div className="mmd-header-left">
            <div className="mmd-header-title">Multi-Match Analytics</div>
            <div className="mmd-chips">
              {matches.map(m => (
                <div key={m.id} className="mmd-chip">
                  <span className="mmd-chip-dot" style={{ background: m.color }} />
                  <span className="mmd-chip-name">{shortName(m.shortName, 18)}</span>
                </div>
              ))}
            </div>
          </div>
          <button className="mmd-close-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* Tab bar */}
        <div className="mmd-tabbar">
          {TABS.map((tab, i) => (
            <button
              key={tab}
              className={`mmd-tab-btn${activeTab === i ? " mmd-tab-active" : ""}`}
              onClick={() => setActiveTab(i)}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tabContent}
      </div>

      <style>{`
        .mmd-overlay {
          position: fixed;
          inset: 0;
          z-index: 1000;
          background: rgba(0, 0, 0, 0.75);
          overflow-y: auto;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding: 24px 16px 40px;
        }
        .mmd-wrap {
          width: 100%;
          max-width: 1100px;
          background: #0f172a;
          border-radius: 20px;
          border: 1px solid rgba(255,255,255,0.07);
          overflow: hidden;
          box-shadow: 0 24px 80px rgba(0,0,0,0.6);
        }
        .mmd-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          padding: 22px 24px 16px;
          border-bottom: 1px solid rgba(255,255,255,0.07);
          background: rgba(255,255,255,0.018);
          gap: 12px;
        }
        .mmd-header-left {
          display: flex;
          flex-direction: column;
          gap: 10px;
          flex: 1;
          min-width: 0;
        }
        .mmd-header-title {
          font-size: 20px;
          font-weight: 700;
          color: #fff;
          letter-spacing: -0.3px;
        }
        .mmd-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .mmd-chip {
          display: flex;
          align-items: center;
          gap: 5px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 20px;
          padding: 3px 10px;
          font-size: 11.5px;
          color: rgba(255,255,255,0.7);
          transition: background 0.18s;
        }
        .mmd-chip:hover {
          background: rgba(255,255,255,0.09);
        }
        .mmd-chip-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .mmd-chip-name {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 140px;
        }
        .mmd-close-btn {
          background: rgba(255,255,255,0.07);
          border: 1px solid rgba(255,255,255,0.1);
          color: rgba(255,255,255,0.65);
          border-radius: 8px;
          width: 34px;
          height: 34px;
          font-size: 15px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: background 0.18s, color 0.18s;
          margin-top: 2px;
        }
        .mmd-close-btn:hover {
          background: rgba(255,255,255,0.13);
          color: #fff;
        }
        .mmd-tabbar {
          display: flex;
          border-bottom: 1px solid rgba(255,255,255,0.07);
          padding: 0 12px;
          gap: 2px;
          overflow-x: auto;
          scrollbar-width: none;
        }
        .mmd-tabbar::-webkit-scrollbar { display: none; }
        .mmd-tab-btn {
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          color: rgba(255,255,255,0.45);
          font-size: 13px;
          font-weight: 500;
          padding: 12px 16px;
          cursor: pointer;
          white-space: nowrap;
          transition: color 0.18s, border-color 0.18s;
          margin-bottom: -1px;
        }
        .mmd-tab-btn:hover {
          color: rgba(255,255,255,0.8);
        }
        .mmd-tab-active {
          color: #fff !important;
          border-bottom-color: #3b82f6 !important;
        }
        .mmd-tab-content {
          padding: 20px 20px 28px;
        }
        .mmd-section-title {
          font-size: 13px;
          font-weight: 600;
          color: rgba(255,255,255,0.45);
          text-transform: uppercase;
          letter-spacing: 0.6px;
          margin-bottom: 12px;
        }
        .mmd-chart-box {
          background: rgba(255,255,255,0.025);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 12px;
          padding: 16px;
          overflow: hidden;
        }
        .mmd-cards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 12px;
        }
        .mmd-match-card {
          background: rgba(255,255,255,0.025);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 10px;
          padding: 14px 16px;
          transition: transform 0.18s, background 0.18s;
        }
        .mmd-match-card:hover {
          transform: translateY(-2px);
          background: rgba(255,255,255,0.045);
        }
        .mmd-match-card-name {
          font-size: 13px;
          font-weight: 700;
          margin-bottom: 3px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .mmd-match-card-date {
          font-size: 11px;
          color: rgba(255,255,255,0.35);
          margin-bottom: 10px;
        }
        .mmd-match-card-stats {
          display: flex;
          gap: 12px;
          font-size: 12px;
          color: rgba(255,255,255,0.55);
        }
        .mmd-match-card-stats b {
          color: rgba(255,255,255,0.88);
          font-weight: 700;
        }
        .mmd-stats-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12.5px;
          min-width: 380px;
        }
        .mmd-stats-table thead tr {
          border-bottom: 1px solid rgba(255,255,255,0.08);
        }
        .mmd-stats-table th {
          padding: 8px 12px;
          text-align: center;
          font-size: 11px;
          font-weight: 600;
          color: rgba(255,255,255,0.45);
          text-transform: uppercase;
          letter-spacing: 0.4px;
          background: rgba(255,255,255,0.018);
          white-space: nowrap;
        }
        .mmd-stats-table th:first-child {
          text-align: left;
        }
        .mmd-stats-table-label {
          padding: 7px 12px;
          color: rgba(255,255,255,0.6);
          font-weight: 500;
          white-space: nowrap;
        }
        .mmd-stats-table-val {
          padding: 7px 12px;
          text-align: center;
          font-size: 13px;
        }
        .mmd-donuts-row {
          display: flex;
          flex-wrap: wrap;
          gap: 16px;
          justify-content: space-around;
          background: rgba(255,255,255,0.025);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 12px;
          padding: 20px;
        }
        .mmd-two-col {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-top: 20px;
        }
        .mmd-2col-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
          margin-top: 12px;
        }
        .mmd-mini-timeline {
          background: rgba(255,255,255,0.025);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 10px;
          padding: 12px 14px;
          margin-bottom: 10px;
        }
        .mmd-mini-timeline-label {
          font-size: 12px;
          font-weight: 600;
          margin-bottom: 6px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .mmd-insights-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }
        .mmd-insight-card {
          background: rgba(255,255,255,0.025);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 10px;
          padding: 14px 16px;
          transition: transform 0.18s, background 0.18s;
        }
        .mmd-insight-card:hover {
          transform: translateY(-2px);
          background: rgba(255,255,255,0.04);
        }
        .mmd-insight-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }
        .mmd-insight-icon {
          font-size: 16px;
          line-height: 1;
        }
        .mmd-insight-title {
          font-size: 13px;
          font-weight: 700;
        }
        .mmd-insight-text {
          font-size: 12px;
          color: rgba(255,255,255,0.55);
          line-height: 1.6;
          margin: 0;
        }
        /* ── Team scorecard ── */
        .mmd-team-scorecard {
          background: rgba(255,255,255,0.025);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 12px;
          padding: 14px 16px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          transition: transform 0.18s, background 0.18s;
        }
        .mmd-team-scorecard:hover {
          transform: translateY(-2px);
          background: rgba(255,255,255,0.04);
        }
        .mmd-sc-match-name {
          font-size: 12px;
          font-weight: 700;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .mmd-sc-score {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 6px 0;
        }
        .mmd-sc-team {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          font-weight: 700;
        }
        .mmd-sc-team-r { flex-direction: row-reverse; }
        .mmd-sc-dot {
          width: 7px; height: 7px;
          border-radius: 50%; flex-shrink: 0;
        }
        .mmd-sc-num {
          font-size: 1.6rem;
          font-weight: 800;
          letter-spacing: -0.03em;
          line-height: 1;
        }
        .mmd-sc-dash { color: #334155; font-size: 1.2rem; font-weight: 300; }
        .mmd-sc-dom-row {
          display: flex; align-items: center; gap: 6px;
        }
        .mmd-sc-dom-track {
          flex: 1; height: 5px; border-radius: 999px;
          overflow: hidden; display: flex;
          background: rgba(255,255,255,0.05);
        }
        .mmd-sc-stats {
          display: flex; flex-direction: column; gap: 4px;
        }
        .mmd-sc-stat-row {
          display: grid; grid-template-columns: 24px 1fr 24px;
          align-items: center; gap: 4px;
          font-size: 11px;
          font-variant-numeric: tabular-nums;
        }
        .mmd-sc-stat-lbl {
          color: rgba(255,255,255,0.35);
          font-size: 10px;
          text-align: center;
          white-space: nowrap;
        }
        .mmd-sc-verdict {
          text-align: center;
          font-size: 10px;
          font-weight: 700;
          padding: 4px 8px;
          border-radius: 6px;
          border: 1px solid;
          letter-spacing: 0.03em;
        }

        @media (max-width: 700px) {
          .mmd-two-col,
          .mmd-2col-grid,
          .mmd-insights-grid {
            grid-template-columns: 1fr;
          }
          .mmd-cards-grid {
            grid-template-columns: 1fr 1fr;
          }
          .mmd-header-title {
            font-size: 16px;
          }
          .mmd-tab-btn {
            font-size: 12px;
            padding: 10px 12px;
          }
          .mmd-donuts-row {
            gap: 10px;
          }
          .mmd-wrap {
            border-radius: 14px;
          }
        }
      `}</style>
    </div>
  );
}
