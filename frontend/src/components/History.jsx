import React, { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import MultiMatchDashboard from "./MultiMatchDashboard";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

// ── tag color helper ──────────────────────────────────────────────────────────
const TAG_PALETTE = ["#3b82f6","#22c55e","#f59e0b","#ec4899","#8b5cf6","#06b6d4","#f97316","#84cc16"];
function tagColor(label) {
  let h = 0;
  for (let i = 0; i < label.length; i++) h = label.charCodeAt(i) + ((h << 5) - h);
  return TAG_PALETTE[Math.abs(h) % TAG_PALETTE.length];
}

// ── helpers ──────────────────────────────────────────────────────────────────
function timeAgo(isoStr) {
  if (!isoStr) return "";
  const diff = Date.now() - new Date(isoStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "Just now";
  if (m < 60) return `${m} minute${m !== 1 ? "s" : ""} ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h !== 1 ? "s" : ""} ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} day${d !== 1 ? "s" : ""} ago`;
  const mo = Math.floor(d / 30);
  return `${mo} month${mo !== 1 ? "s" : ""} ago`;
}

function fmtDate(isoStr) {
  if (!isoStr) return "";
  return new Date(isoStr).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function shortName(name = "") {
  return name.length > 42 ? name.slice(0, 39) + "…" : name;
}

// ── Team stats mini component ─────────────────────────────────────────────────
function TeamStatsMini({ events }) {
  const evList = events || [];
  const hasTeams = evList.some(e => e.team && e.team !== "Unknown");
  if (!hasTeams) return null;

  // Extract team colors from events
  const colorMap = {};
  evList.forEach(e => {
    if (e.team && e.team !== "Unknown" && e.team_color) colorMap[e.team] = e.team_color;
  });
  const c1 = colorMap["Team 1"] || "#3b82f6";
  const c2 = colorMap["Team 2"] || "#f43f5e";

  const teamStat = (teamName) => {
    const te = evList.filter(e => e.team === teamName);
    return {
      goals:   te.filter(e => e.label === "Goal").length,
      shotsOn: te.filter(e => e.label === "Shots on target").length,
      shotsOff:te.filter(e => e.label === "Shots off target").length,
      fouls:   te.filter(e => e.label === "Foul").length,
      corners: te.filter(e => e.label === "Corner").length,
      yellow:  te.filter(e => e.label === "Yellow card").length,
      red:     te.filter(e => ["Red card","Yellow->red card"].includes(e.label)).length,
      total:   te.length,
    };
  };
  const s1 = teamStat("Team 1");
  const s2 = teamStat("Team 2");

  const rows = [
    { label:"Goals",           v1:s1.goals,   v2:s2.goals   },
    { label:"Shots on Target", v1:s1.shotsOn, v2:s2.shotsOn },
    { label:"Shots off Target",v1:s1.shotsOff,v2:s2.shotsOff},
    { label:"Fouls",           v1:s1.fouls,   v2:s2.fouls   },
    { label:"Corners",         v1:s1.corners, v2:s2.corners },
    { label:"Yellow Cards",    v1:s1.yellow,  v2:s2.yellow  },
    { label:"Red Cards",       v1:s1.red,     v2:s2.red     },
  ].filter(r => r.v1 + r.v2 > 0);

  if (!rows.length) return null;

  // Dominance
  const off1 = s1.goals*5 + s1.shotsOn*2 + s1.shotsOff + s1.corners*0.5;
  const off2 = s2.goals*5 + s2.shotsOn*2 + s2.shotsOff + s2.corners*0.5;
  const total = off1 + off2 || 1;
  const dom1  = Math.round((off1/total)*100);
  const dom2  = 100 - dom1;

  return (
    <div className="hc-team-section">
      <div className="hc-breakdown-title" style={{ marginBottom:"0.75rem" }}>Team Comparison</div>

      {/* Team header */}
      <div className="hc-team-header">
        <span style={{ color:c1, display:"flex", alignItems:"center", gap:"0.4rem" }}>
          <span style={{ width:9,height:9,borderRadius:"50%",background:c1,display:"inline-block" }}/>
          Team 1
        </span>
        <span style={{ color:"#475569", fontSize:"0.72rem" }}>vs</span>
        <span style={{ color:c2, display:"flex", alignItems:"center", gap:"0.4rem", justifyContent:"flex-end" }}>
          Team 2
          <span style={{ width:9,height:9,borderRadius:"50%",background:c2,display:"inline-block" }}/>
        </span>
      </div>

      {/* Dominance bar */}
      <div className="hc-dom-row">
        <span style={{ color:c1, fontSize:"0.8rem", fontWeight:700 }}>{dom1}%</span>
        <div className="hc-dom-track">
          <div style={{ width:`${dom1}%`,background:c1,height:"100%",borderRadius:"999px 0 0 999px",transition:"width 0.8s" }}/>
          <div style={{ width:`${dom2}%`,background:c2,height:"100%",borderRadius:"0 999px 999px 0",transition:"width 0.8s" }}/>
        </div>
        <span style={{ color:c2, fontSize:"0.8rem", fontWeight:700 }}>{dom2}%</span>
      </div>

      {/* Duel rows */}
      {rows.map(({ label, v1, v2 }) => {
        const max = Math.max(v1, v2, 1);
        const p1  = (v1/max)*100, p2 = (v2/max)*100;
        const w   = v1>v2?1:v2>v1?2:0;
        return (
          <div key={label} className="hc-duel-row">
            <span style={{ color:w===1?c1:"#64748b", fontWeight:w===1?700:400, fontSize:"0.82rem", minWidth:18, textAlign:"center" }}>{v1}</span>
            <div className="hc-duel-bars">
              <div className="hc-duel-left">
                <div style={{ width:`${p1}%`,background:c1,opacity:w===1?1:0.4,height:"100%",borderRadius:"999px 0 0 999px",transition:"width 0.6s" }}/>
              </div>
              <span className="hc-duel-lbl">{label}</span>
              <div className="hc-duel-right">
                <div style={{ width:`${p2}%`,background:c2,opacity:w===2?1:0.4,height:"100%",borderRadius:"0 999px 999px 0",transition:"width 0.6s" }}/>
              </div>
            </div>
            <span style={{ color:w===2?c2:"#64748b", fontWeight:w===2?700:400, fontSize:"0.82rem", minWidth:18, textAlign:"center" }}>{v2}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── EventsBreakdown sub-component ────────────────────────────────────────────
function EventsBreakdown({ eventCounts, events }) {
  const [filter, setFilter] = useState("All");

  if (!eventCounts || Object.keys(eventCounts).length === 0) return null;
  const sorted    = Object.entries(eventCounts).sort(([, a], [, b]) => b - a);
  const maxCount  = sorted[0][1];
  const typeOptions = ["All", ...sorted.map(([label]) => label)];

  const filtered = (events || []).filter(
    (e) => filter === "All" || e.label === filter
  );

  const hasTeamCol = (events || []).some(e => e.team && e.team !== "Unknown");

  return (
    <div className="hc-breakdown">
      {/* ── Bar chart ── */}
      <div className="hc-breakdown-title">Event Breakdown</div>
      {sorted.map(([label, count]) => (
        <div key={label} className="hc-bar-row">
          <span className="hc-bar-label">{label}</span>
          <div className="hc-bar-track">
            <div
              className="hc-bar-fill"
              style={{ width: `${(count / maxCount) * 100}%` }}
            />
          </div>
          <span className="hc-bar-count">{count}</span>
        </div>
      ))}

      {/* ── Team comparison ── */}
      <TeamStatsMini events={events} />

      {/* ── Timestamp table ── */}
      {events && events.length > 0 && (
        <>
          <div className="hc-ts-header">
            <div className="hc-breakdown-title" style={{ margin: 0 }}>
              Event Timestamps
            </div>
            <select
              className="hc-ts-filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              {typeOptions.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div className="hc-ts-wrap">
            <table className="hc-ts-table">
              <thead>
                <tr>
                  <th className="hc-th">Half</th>
                  <th className="hc-th">Time</th>
                  <th className="hc-th hc-th-event">Event</th>
                  {hasTeamCol && <th className="hc-th">Team</th>}
                  <th className="hc-th hc-th-right">Conf.</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={hasTeamCol ? 5 : 4} className="hc-ts-empty">No events</td>
                  </tr>
                ) : (
                  filtered.map((e, i) => {
                    const timePart = e.gameTime?.split(" - ")[1] ?? e.gameTime ?? "–";
                    const conf     = Math.round((e.confidence ?? 0) * 100);
                    const confColor = conf >= 80 ? "#86efac" : conf >= 50 ? "#fde68a" : "#94a3b8";
                    return (
                      <tr key={i} className="hc-ts-row">
                        <td className="hc-ts-half">H{e.half}</td>
                        <td className="hc-ts-time">{timePart}</td>
                        <td className="hc-ts-event">{e.label}</td>
                        {hasTeamCol && (
                          <td className="hc-ts-team">
                            {e.team && e.team !== "Unknown" ? (
                              <span className="hc-team-pill" style={{
                                background: e.team_color ? `${e.team_color}22` : "rgba(59,130,246,0.15)",
                                borderColor: e.team_color ? `${e.team_color}55` : "rgba(59,130,246,0.3)",
                                color: e.team_color || "#93c5fd",
                              }}>
                                <span style={{ width:5,height:5,borderRadius:"50%",background:e.team_color||"#93c5fd",display:"inline-block",flexShrink:0 }}/>
                                {e.team}
                              </span>
                            ) : (
                              <span style={{ color:"#334155", fontSize:"0.72rem" }}>–</span>
                            )}
                          </td>
                        )}
                        <td className="hc-ts-conf" style={{ color: confColor }}>
                          {conf}%
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ── TrackingBreakdown sub-component ──────────────────────────────────────────
function TrackingBreakdown({ results }) {
  const stats = results?.stats || {};

  const possession = stats.possession || stats.team_possession || null;
  const speeds     = stats.player_speeds     || stats.top_speeds     || [];
  const distances  = stats.player_distances  || stats.top_distances  || [];
  const passers    = stats.top_passers       || [];
  const c1         = stats.team1_color || "#60a5fa";
  const c2         = stats.team2_color || "#f472b6";
  const t1pct      = stats.team1_possession_pct;
  const t2pct      = stats.team2_possession_pct;
  const hasFlatPossession = t1pct != null && t2pct != null;

  const hasPossession = hasFlatPossession || (possession && typeof possession === "object");
  const hasSpeed      = Array.isArray(speeds)    && speeds.length    > 0;
  const hasDistance   = Array.isArray(distances) && distances.length > 0;
  const hasPassers    = Array.isArray(passers)   && passers.length   > 0;

  if (!hasPossession && !hasSpeed && !hasDistance && !hasPassers) {
    return (
      <div className="hc-breakdown">
        <div className="hc-breakdown-title">Tracking Stats</div>
        <p className="hc-no-stats">Stats not available for this analysis.</p>
      </div>
    );
  }

  const possKeys = (!hasFlatPossession && possession) ? Object.keys(possession) : [];
  const total    = possKeys.length > 0
    ? possKeys.reduce((s, k) => s + (possession[k] || 0), 0)
    : 0;

  return (
    <div className="hc-breakdown">
      {hasPossession && (
        <>
          <div className="hc-breakdown-title">Ball Possession</div>
          {hasFlatPossession ? (
            <>
              {[{ label: "Team 1", pct: t1pct, color: c1 },
                { label: "Team 2", pct: t2pct, color: c2 }].map(({ label, pct, color }) => (
                <div key={label} className="hc-bar-row">
                  <span className="hc-bar-label" style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0 }} />
                    {label}
                  </span>
                  <div className="hc-bar-track">
                    <div className="hc-bar-fill" style={{ width: `${pct}%`, background: color }} />
                  </div>
                  <span className="hc-bar-count" style={{ color }}>{pct}%</span>
                </div>
              ))}
            </>
          ) : (
            possKeys.map((team, i) => {
              const pct = total > 0 ? ((possession[team] / total) * 100).toFixed(1) : 0;
              const color = i === 0 ? c1 : c2;
              return (
                <div key={team} className="hc-bar-row">
                  <span className="hc-bar-label">{`Team ${i + 1}`}</span>
                  <div className="hc-bar-track">
                    <div className="hc-bar-fill" style={{ width: `${pct}%`, background: color }} />
                  </div>
                  <span className="hc-bar-count" style={{ color }}>{pct}%</span>
                </div>
              );
            })
          )}
        </>
      )}

      {hasSpeed && (
        <>
          <div className="hc-breakdown-title" style={{ marginTop: "1rem" }}>
            Top Speeds
          </div>
          <table className="hc-table">
            <tbody>
              {speeds.slice(0, 5).map((p, i) => (
                <tr key={i}>
                  <td className="hc-td-rank">#{i + 1}</td>
                  <td className="hc-td-id">
                    Player {p.track_id ?? p.player_id ?? "–"}
                  </td>
                  <td className="hc-td-val">
                    {(p.max_speed_kmh ?? p.max_speed ?? p.speed ?? 0).toFixed(1)} km/h
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {hasDistance && (
        <>
          <div className="hc-breakdown-title" style={{ marginTop: "1rem" }}>
            Top Distances
          </div>
          <table className="hc-table">
            <tbody>
              {distances.slice(0, 5).map((p, i) => (
                <tr key={i}>
                  <td className="hc-td-rank">#{i + 1}</td>
                  <td className="hc-td-id">
                    Player {p.track_id ?? p.player_id ?? "–"}
                  </td>
                  <td className="hc-td-val">
                    {(p.distance_m ?? p.distance ?? 0).toFixed(1)} m
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* ── Team passes summary ── */}
      {(stats.team1_passes != null || stats.team2_passes != null) && (
        <>
          <div className="hc-breakdown-title" style={{ marginTop: "1rem" }}>
            Team Passes
          </div>
          <div className="hc-bar-row">
            <span className="hc-bar-label" style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: c1, display: "inline-block" }} />
              Team 1
            </span>
            <span className="hc-bar-count" style={{ color: c1, minWidth: "auto" }}>
              {stats.team1_passes ?? 0} passes
            </span>
          </div>
          <div className="hc-bar-row">
            <span className="hc-bar-label" style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: c2, display: "inline-block" }} />
              Team 2
            </span>
            <span className="hc-bar-count" style={{ color: c2, minWidth: "auto" }}>
              {stats.team2_passes ?? 0} passes
            </span>
          </div>
        </>
      )}

      {/* ── Team total distances ── */}
      {(stats.team1_total_distance_m != null || stats.team2_total_distance_m != null) && (
        <>
          <div className="hc-breakdown-title" style={{ marginTop: "1rem" }}>
            Team Total Distance
          </div>
          <div className="hc-bar-row">
            <span className="hc-bar-label" style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: c1, display: "inline-block" }} />
              Team 1
            </span>
            <span className="hc-bar-count" style={{ color: c1, minWidth: "auto" }}>
              {(stats.team1_total_distance_m ?? 0).toFixed(1)} m
            </span>
          </div>
          <div className="hc-bar-row">
            <span className="hc-bar-label" style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: c2, display: "inline-block" }} />
              Team 2
            </span>
            <span className="hc-bar-count" style={{ color: c2, minWidth: "auto" }}>
              {(stats.team2_total_distance_m ?? 0).toFixed(1)} m
            </span>
          </div>
        </>
      )}

      {hasPassers && (
        <>
          <div className="hc-breakdown-title" style={{ marginTop: "1rem" }}>
            Top Passers
          </div>
          <table className="hc-table">
            <tbody>
              {passers.slice(0, 5).map((p, i) => (
                <tr key={i}>
                  <td className="hc-td-rank">#{i + 1}</td>
                  <td className="hc-td-id">Player {p.player_id ?? "–"}</td>
                  <td className="hc-td-val" style={{ color: "#a78bfa" }}>
                    {p.passes} passes
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

// ── TagsSection ──────────────────────────────────────────────────────────────
function TagsSection({ historyId, token, initialTags }) {
  const [tags,     setTags]     = useState(initialTags || []);
  const [isAdding, setIsAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [loading,  setLoading]  = useState(false);

  const addTag = async () => {
    const label = newLabel.trim();
    if (!label) return;
    setLoading(true);
    try {
      const res = await axios.post(
        `${API_URL}/api/history/${historyId}/tags`,
        { label },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setTags(prev => [...prev, res.data]);
      setNewLabel("");
      setIsAdding(false);
    } catch (err) {
      if (err.response?.status === 409) alert("Tag already exists.");
      else alert("Failed to add tag.");
    } finally {
      setLoading(false);
    }
  };

  const removeTag = async (tagId) => {
    try {
      await axios.delete(
        `${API_URL}/api/history/${historyId}/tags/${tagId}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setTags(prev => prev.filter(t => t.tagId !== tagId));
    } catch {
      alert("Failed to remove tag.");
    }
  };

  return (
    <div className="hc-tags-row">
      {tags.map(t => {
        const c = tagColor(t.label);
        return (
          <span key={t.tagId} className="hc-tag"
            style={{ background: `${c}22`, borderColor: `${c}55`, color: c }}>
            {t.label}
            <button className="hc-tag-x" onClick={() => removeTag(t.tagId)}>×</button>
          </span>
        );
      })}

      {isAdding ? (
        <div className="hc-tag-input-wrap">
          <input
            className="hc-tag-input"
            autoFocus maxLength={100}
            placeholder="tag name…"
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") addTag();
              if (e.key === "Escape") { setIsAdding(false); setNewLabel(""); }
            }}
          />
          <button className="hc-tag-confirm" onClick={addTag}
            disabled={loading || !newLabel.trim()}>
            {loading ? "…" : "Add"}
          </button>
          <button className="hc-tag-cancel-btn"
            onClick={() => { setIsAdding(false); setNewLabel(""); }}>✕</button>
        </div>
      ) : (
        <button className="hc-tag-plus" onClick={() => setIsAdding(true)}>
          + Tag
        </button>
      )}
    </div>
  );
}

// ── NotesSection ──────────────────────────────────────────────────────────────
function NotesSection({ historyId, token }) {
  const [notes,    setNotes]    = useState([]);
  const [loaded,   setLoaded]   = useState(false);
  const [loading,  setLoading]  = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newText,  setNewText]  = useState("");
  const [editId,   setEditId]   = useState(null);
  const [editText, setEditText] = useState("");
  const [saving,   setSaving]   = useState(false);

  useEffect(() => {
    if (loaded) return;
    axios
      .get(`${API_URL}/api/history/${historyId}/notes`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then(res => setNotes(res.data.notes || []))
      .catch(() => {})
      .finally(() => { setLoading(false); setLoaded(true); });
  }, [historyId, token, loaded]);

  const addNote = async () => {
    const text = newText.trim();
    if (!text) return;
    setSaving(true);
    try {
      const res = await axios.post(
        `${API_URL}/api/history/${historyId}/notes`,
        { noteText: text },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setNotes(prev => [...prev, res.data]);
      setNewText("");
      setIsAdding(false);
    } catch { alert("Failed to add note."); }
    finally { setSaving(false); }
  };

  const saveEdit = async (noteId) => {
    const text = editText.trim();
    if (!text) return;
    setSaving(true);
    try {
      const res = await axios.put(
        `${API_URL}/api/history/${historyId}/notes/${noteId}`,
        { noteText: text },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setNotes(prev => prev.map(n =>
        n.noteId === noteId
          ? { ...n, noteText: res.data.noteText, updatedAt: res.data.updatedAt }
          : n,
      ));
      setEditId(null);
    } catch { alert("Failed to save note."); }
    finally { setSaving(false); }
  };

  const deleteNote = async (noteId) => {
    try {
      await axios.delete(
        `${API_URL}/api/history/${historyId}/notes/${noteId}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setNotes(prev => prev.filter(n => n.noteId !== noteId));
    } catch { alert("Failed to delete note."); }
  };

  return (
    <div className="hc-notes-wrap">
      <div className="hc-notes-header">
        <span className="hc-breakdown-title" style={{ margin: 0 }}>Match Notes</span>
        {!isAdding && (
          <button className="hc-note-add-btn" onClick={() => setIsAdding(true)}>
            + Add Note
          </button>
        )}
      </div>

      {isAdding && (
        <div className="hc-note-form">
          <textarea
            className="hc-note-textarea" autoFocus rows={3}
            placeholder="Write your note…"
            value={newText}
            onChange={e => setNewText(e.target.value)}
          />
          <div className="hc-note-form-btns">
            <button className="hc-note-save-btn" onClick={addNote}
              disabled={saving || !newText.trim()}>
              {saving ? "Saving…" : "Save"}
            </button>
            <button className="hc-note-cancel-btn"
              onClick={() => { setIsAdding(false); setNewText(""); }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading && <p className="hc-notes-hint">Loading…</p>}

      {!loading && notes.length === 0 && !isAdding && (
        <p className="hc-notes-hint">No notes yet.</p>
      )}

      {notes.map(note => (
        <div key={note.noteId} className="hc-note-card">
          {editId === note.noteId ? (
            <>
              <textarea
                className="hc-note-textarea" rows={3} autoFocus
                value={editText}
                onChange={e => setEditText(e.target.value)}
              />
              <div className="hc-note-form-btns">
                <button className="hc-note-save-btn"
                  onClick={() => saveEdit(note.noteId)}
                  disabled={saving || !editText.trim()}>
                  {saving ? "Saving…" : "Save"}
                </button>
                <button className="hc-note-cancel-btn"
                  onClick={() => setEditId(null)}>
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="hc-note-text">{note.noteText}</p>
              <div className="hc-note-meta">
                <span className="hc-note-date">
                  {timeAgo(note.updatedAt || note.createdAt)}
                  {note.updatedAt !== note.createdAt && " (edited)"}
                </span>
                <div className="hc-note-actions">
                  <button className="hc-note-edit-btn"
                    onClick={() => { setEditId(note.noteId); setEditText(note.noteText); }}>
                    Edit
                  </button>
                  <button className="hc-note-del-btn"
                    onClick={() => deleteNote(note.noteId)}>
                    Delete
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

// ── HistoryCard ───────────────────────────────────────────────────────────────
function HistoryCard({ item, token, selected, onToggleSelect, onDelete, onAskAI, onCacheDetails }) {
  const [open,          setOpen]         = useState(false);
  const [deleting,      setDeleting]     = useState(false);
  const [confirmDel,    setConfirmDel]   = useState(false);
  const [detailResults, setDetailResults]= useState(null);
  const [detailLoading, setDetailLoading]= useState(false);
  const isEvents  = item.mode === "events";
  const modeLabel = isEvents ? "Events" : "Tracking";
  const modeClass = isEvents ? "badge-events" : "badge-tracking";

  const loadDetails = async () => {
    if (detailResults !== null || detailLoading) return detailResults;
    setDetailLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/history/${item.historyId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const r = res.data.results ?? null;
      setDetailResults(r);
      onCacheDetails?.(item.historyId, r);
      return r;
    } catch {
      return null;
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDownload = async () => {
    try {
      const loaded = detailResults ?? await loadDetails();
      let exportData = loaded;

      if (item.mode === "tracking") {
        const s = loaded?.stats || {};
        const byTeam = (teamId) => ({
          ball_possession: `${teamId === 1 ? s.team1_possession_pct : s.team2_possession_pct}%`,
          passes: teamId === 1 ? s.team1_passes : s.team2_passes,
          total_distance: `${teamId === 1 ? s.team1_total_distance_m : s.team2_total_distance_m} m`,
          players: (s.top_distances || [])
            .filter(p => {
              const pos = (s.player_avg_positions || []).find(x => x.player_id === p.player_id);
              return !pos || pos.team === teamId;
            })
            .map(p => {
              const spd = (s.top_speeds || []).find(x => x.player_id === p.player_id);
              const pos = (s.player_avg_positions || []).find(x => x.player_id === p.player_id);
              return {
                player: `Player ${p.player_id}`,
                distance_covered: `${p.distance_m} m`,
                max_speed: spd ? `${spd.max_speed_kmh} km/h` : "—",
                average_position: pos ? { x: pos.x, y: pos.y } : null,
              };
            }),
        });
        exportData = {
          match_summary: {
            video: item.videoFileName,
            analyzed_at: item.analyzedAt,
            duration: s.duration_seconds ? `${s.duration_seconds.toFixed(1)} seconds` : "—",
            players_tracked: s.num_players_tracked ?? "—",
          },
          team_1: byTeam(1),
          team_2: byTeam(2),
          top_performers: {
            most_distance: s.top_distances?.[0]
              ? { player: `Player ${s.top_distances[0].player_id}`, distance: `${s.top_distances[0].distance_m} m` }
              : null,
            fastest_player: s.top_speeds?.[0]
              ? { player: `Player ${s.top_speeds[0].player_id}`, speed: `${s.top_speeds[0].max_speed_kmh} km/h` }
              : null,
          },
        };
      }

      const blob = new Blob(
        [JSON.stringify(exportData, null, 2)],
        { type: "application/json" }
      );
      const url = URL.createObjectURL(blob);
      const a   = document.createElement("a");
      a.href     = url;
      a.download = `${item.videoFileName}_results.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Download failed.");
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await axios.delete(`${API_URL}/api/history/${item.historyId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      onDelete(item.historyId);
    } catch {
      alert("Delete failed.");
      setDeleting(false);
      setConfirmDel(false);
    }
  };

  return (
    <div className={`hc-card ${open ? "hc-card-open" : ""} ${selected ? "hc-card-selected" : ""}`}>
      {/* ── header row ── */}
      <div className="hc-header">
        {isEvents && (
          <button
            className={`hc-checkbox ${selected ? "hc-checkbox-checked" : ""}`}
            onClick={() => onToggleSelect(item.historyId)}
            title={selected ? "Deselect" : "Select for comparison"}
            aria-label="Select match"
          >
            {selected && (
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        )}
        <div className="hc-left">
          <div className="hc-file">
            <svg className="hc-file-icon" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V9z" />
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M15.75 9H13.5A2.25 2.25 0 0111.25 6.75V4.5" />
            </svg>
            <span className="hc-filename">{shortName(item.videoFileName)}</span>
          </div>
          <div className="hc-meta">
            <span className={`hc-badge ${modeClass}`}>{modeLabel}</span>
            <span className="hc-time" title={fmtDate(item.analyzedAt)}>
              {timeAgo(item.analyzedAt)}
            </span>
            {isEvents && item.totalEvents != null && (
              <span className="hc-stat">{item.totalEvents} events detected</span>
            )}
          </div>
        </div>
        <div className="hc-actions">
          <button className="hc-btn-dl" onClick={handleDownload} title="Download match data">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Export
          </button>

          {/* ── Ask AI ── */}
          {onAskAI && (
            <button
              className="hc-btn-ai"
              onClick={async () => {
                const r = detailResults ?? await loadDetails();
                if (r) onAskAI(r, item.videoFileName);
              }}
              title="Analyze this match with AI"
            >
              ⚽ Ask AI
            </button>
          )}

          {/* ── Delete ── */}
          {!confirmDel ? (
            <button
              className="hc-btn-del"
              onClick={() => setConfirmDel(true)}
              title="Delete this record"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          ) : (
            <div className="hc-del-confirm">
              <span className="hc-del-confirm-text">Delete?</span>
              <button
                className="hc-del-yes"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? "…" : "Yes"}
              </button>
              <button
                className="hc-del-no"
                onClick={() => setConfirmDel(false)}
                disabled={deleting}
              >
                No
              </button>
            </div>
          )}

          <button
            className={`hc-btn-toggle ${open ? "hc-btn-toggle-open" : ""}`}
            onClick={() => { const next = !open; setOpen(next); if (next && detailResults === null) loadDetails(); }}
          >
            {open ? "Hide" : "Details"}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2"
              style={{ transition: "transform 0.2s",
                       transform: open ? "rotate(180deg)" : "rotate(0deg)" }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── tags row (always visible below header) ── */}
      <TagsSection
        historyId={item.historyId}
        token={token}
        initialTags={item.tags || []}
      />

      {/* ── expanded details ── */}
      {open && (
        <div className="hc-details">
          {detailLoading && (
            <div style={{ display:"flex", justifyContent:"center", padding:"1.5rem 0" }}>
              <span className="btn-spinner" />
            </div>
          )}
          {!detailLoading && (isEvents
            ? <EventsBreakdown
                eventCounts={item.eventCounts}
                events={detailResults?.events}
              />
            : <TrackingBreakdown results={detailResults} />)}
          <NotesSection historyId={item.historyId} token={token} />
          <div className="hc-date-row">
            Analyzed on {fmtDate(item.analyzedAt)}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main History component ────────────────────────────────────────────────────
export default function History({ onAskAI }) {
  const { token } = useAuth();
  const [items,          setItems]         = useState([]);
  const [loading,        setLoading]       = useState(true);
  const [error,          setError]         = useState("");
  const [selectedIds,    setSelectedIds]   = useState(new Set());
  const [showDashboard,  setShowDashboard] = useState(false);
  const [detailsCache,   setDetailsCache]  = useState({});
  const [compareFetching,setCompareFetching] = useState(false);

  useEffect(() => {
    axios
      .get(`${API_URL}/api/history`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setItems(res.data.history || []))
      .catch(() => setError("Failed to load history."))
      .finally(() => setLoading(false));
  }, [token]);

  const cacheDetails = (historyId, results) => {
    setDetailsCache(prev => ({ ...prev, [historyId]: results }));
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDelete = (id) => {
    setItems((prev) => prev.filter((item) => item.historyId !== id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const selectedMatches = items
    .filter((item) => selectedIds.has(item.historyId) && item.mode === "events")
    .map((item) => ({
      id:          item.historyId,
      name:        item.videoFileName,
      date:        item.analyzedAt,
      events:      detailsCache[item.historyId]?.events || [],
      team_colors: detailsCache[item.historyId]?.team_colors || null,
    }));

  const canCompare = selectedMatches.length >= 2;

  const handleCompare = async () => {
    setCompareFetching(true);
    const uncached = [...selectedIds].filter(id => !detailsCache[id]);
    try {
      await Promise.all(uncached.map(async id => {
        const res = await axios.get(`${API_URL}/api/history/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        cacheDetails(id, res.data.results ?? null);
      }));
    } catch {}
    setCompareFetching(false);
    setShowDashboard(true);
  };

  return (
    <>
    {showDashboard && (
      <MultiMatchDashboard
        matches={selectedMatches}
        onClose={() => setShowDashboard(false)}
      />
    )}
    <div className="hist-wrap">
      <div className="hist-header">
        <h2 className="hist-title">Analysis History</h2>
        {!loading && !error && (
          <span className="hist-count">
            {items.length} {items.length === 1 ? "analysis" : "analyses"}
          </span>
        )}
      </div>

      {/* ── Compare bar ── */}
      {selectedIds.size > 0 && (
        <div className="hist-compare-bar">
          <div className="hist-compare-info">
            <span className="hist-compare-count">{selectedIds.size}</span>
            <span className="hist-compare-label">
              match{selectedIds.size !== 1 ? "es" : ""} selected
              {!canCompare && ` — select ${2 - selectedIds.size} more to compare`}
            </span>
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              className="hist-compare-clear"
              onClick={() => setSelectedIds(new Set())}
            >
              Clear
            </button>
            <button
              className={`hist-compare-btn ${canCompare ? "hist-compare-btn-active" : ""}`}
              disabled={!canCompare || compareFetching}
              onClick={handleCompare}
            >
              {compareFetching ? "Loading…" : `Compare ${canCompare ? `${selectedIds.size} Matches` : "Matches"}`}
            </button>
          </div>
        </div>
      )}

      {loading && (
        <div className="hist-center">
          <span className="btn-spinner large-spinner" />
        </div>
      )}

      {error && (
        <div className="hist-empty">
          <div className="hist-empty-icon">⚠️</div>
          <p>{error}</p>
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="hist-empty">
          <div className="hist-empty-icon">📋</div>
          <p className="hist-empty-title">No analyses yet</p>
          <p className="hist-empty-sub">
            Upload a video to run your first analysis — results will appear here.
          </p>
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="hist-list">
          {items.map((item) => (
            <HistoryCard
              key={item.historyId}
              item={item}
              token={token}
              selected={selectedIds.has(item.historyId)}
              onToggleSelect={toggleSelect}
              onDelete={handleDelete}
              onAskAI={onAskAI}
              onCacheDetails={cacheDetails}
            />
          ))}
        </div>
      )}

      <style>{`
        .hist-wrap { max-width: 760px; margin: 0 auto; padding-bottom: 3rem; }

        .hist-header {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 1.5rem;
        }

        .hist-title {
          color: #f1f5f9; font-size: 1.3rem; font-weight: 600;
          letter-spacing: -0.01em; margin: 0;
        }

        .hist-count {
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          color: #94a3b8; padding: 0.3rem 0.8rem;
          border-radius: 999px; font-size: 0.82rem;
        }

        .hist-center {
          display: flex; justify-content: center; padding: 4rem 0;
        }

        .hist-empty {
          text-align: center; padding: 4rem 2rem;
          background: rgba(255,255,255,0.02);
          border: 1px dashed rgba(255,255,255,0.1);
          border-radius: 20px;
        }
        .hist-empty-icon  { font-size: 3rem; margin-bottom: 1rem; }
        .hist-empty-title { color: #cbd5e1; font-size: 1rem; font-weight: 600; margin: 0 0 0.4rem; }
        .hist-empty-sub   { color: #64748b; font-size: 0.88rem; margin: 0; }

        .hist-list { display: flex; flex-direction: column; gap: 0.75rem; }

        /* ── Card ── */
        .hc-card {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 16px; overflow: hidden;
          transition: border-color 0.2s;
        }
        .hc-card:hover { border-color: rgba(255,255,255,0.14); }
        .hc-card-open  { border-color: rgba(59,130,246,0.3); }

        .hc-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 1.1rem 1.25rem; gap: 1rem; flex-wrap: wrap;
        }

        .hc-left { display: flex; flex-direction: column; gap: 0.45rem; min-width: 0; }

        .hc-file {
          display: flex; align-items: center; gap: 0.5rem;
        }
        .hc-file-icon {
          width: 18px; height: 18px; color: #64748b; flex-shrink: 0;
        }
        .hc-filename {
          color: #f1f5f9; font-size: 0.92rem; font-weight: 500;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }

        .hc-meta {
          display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap;
        }

        .hc-badge {
          padding: 0.2rem 0.6rem; border-radius: 6px;
          font-size: 0.7rem; font-weight: 700; letter-spacing: 0.05em;
          text-transform: uppercase;
        }
        .badge-events {
          background: rgba(59,130,246,0.15);
          border: 1px solid rgba(59,130,246,0.3);
          color: #93c5fd;
        }
        .badge-tracking {
          background: rgba(236,72,153,0.15);
          border: 1px solid rgba(236,72,153,0.3);
          color: #f9a8d4;
        }

        .hc-time { color: #64748b; font-size: 0.82rem; }
        .hc-stat { color: #94a3b8; font-size: 0.82rem; }

        .hc-actions { display: flex; gap: 0.5rem; flex-shrink: 0; }

        .hc-btn-ai {
          display: flex; align-items: center; gap: 0.35rem;
          background: rgba(59,130,246,0.12);
          border: 1px solid rgba(59,130,246,0.3);
          color: #93c5fd; padding: 0.45rem 0.8rem;
          border-radius: 8px; font-size: 0.8rem; font-weight: 600;
          cursor: pointer; transition: all 0.2s; white-space: nowrap;
        }
        .hc-btn-ai:hover {
          background: rgba(59,130,246,0.25);
          border-color: rgba(59,130,246,0.55); color: #bfdbfe;
        }

        .hc-btn-dl {
          display: flex; align-items: center; gap: 0.4rem;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          color: #94a3b8; padding: 0.45rem 0.8rem;
          border-radius: 8px; font-size: 0.8rem; cursor: pointer;
          transition: all 0.2s;
        }
        .hc-btn-dl:hover {
          background: rgba(255,255,255,0.1); color: #cbd5e1;
        }

        .hc-btn-del {
          display: flex; align-items: center; justify-content: center;
          width: 32px; height: 32px;
          background: rgba(239,68,68,0.08);
          border: 1px solid rgba(239,68,68,0.18);
          color: #f87171; border-radius: 8px; cursor: pointer;
          transition: all 0.2s; flex-shrink: 0;
        }
        .hc-btn-del:hover {
          background: rgba(239,68,68,0.2);
          border-color: rgba(239,68,68,0.4); color: #fca5a5;
        }

        .hc-del-confirm {
          display: flex; align-items: center; gap: 0.35rem;
          background: rgba(239,68,68,0.1);
          border: 1px solid rgba(239,68,68,0.3);
          border-radius: 8px; padding: 0.3rem 0.6rem;
        }
        .hc-del-confirm-text {
          color: #fca5a5; font-size: 0.78rem; font-weight: 600; white-space: nowrap;
        }
        .hc-del-yes {
          background: #dc2626; border: none; color: #fff;
          padding: 0.2rem 0.55rem; border-radius: 5px;
          font-size: 0.75rem; font-weight: 700; cursor: pointer;
          transition: background 0.15s;
        }
        .hc-del-yes:hover { background: #b91c1c; }
        .hc-del-yes:disabled { opacity: 0.5; cursor: default; }
        .hc-del-no {
          background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.12);
          color: #94a3b8; padding: 0.2rem 0.55rem; border-radius: 5px;
          font-size: 0.75rem; cursor: pointer; transition: background 0.15s;
        }
        .hc-del-no:hover { background: rgba(255,255,255,0.13); }
        .hc-del-no:disabled { opacity: 0.5; cursor: default; }

        .hc-btn-toggle {
          display: flex; align-items: center; gap: 0.35rem;
          background: rgba(59,130,246,0.1);
          border: 1px solid rgba(59,130,246,0.25);
          color: #93c5fd; padding: 0.45rem 0.9rem;
          border-radius: 8px; font-size: 0.8rem; font-weight: 500;
          cursor: pointer; transition: all 0.2s;
        }
        .hc-btn-toggle:hover,
        .hc-btn-toggle-open {
          background: rgba(59,130,246,0.2);
          border-color: rgba(59,130,246,0.45);
        }

        /* ── Details panel ── */
        .hc-details {
          border-top: 1px solid rgba(255,255,255,0.06);
          padding: 1.25rem 1.5rem;
          background: rgba(0,0,0,0.15);
        }

        .hc-date-row {
          color: #475569; font-size: 0.78rem; margin-top: 1rem;
          padding-top: 0.75rem; border-top: 1px solid rgba(255,255,255,0.05);
        }

        /* ── Breakdown shared ── */
        .hc-breakdown { }

        .hc-breakdown-title {
          color: #94a3b8; font-size: 0.72rem; font-weight: 600;
          letter-spacing: 0.07em; text-transform: uppercase;
          margin-bottom: 0.75rem;
        }

        .hc-bar-row {
          display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem;
        }
        .hc-bar-label {
          color: #cbd5e1; font-size: 0.82rem; min-width: 130px;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .hc-bar-track {
          flex: 1; background: rgba(255,255,255,0.06);
          border-radius: 999px; height: 6px; overflow: hidden;
        }
        .hc-bar-fill {
          background: linear-gradient(90deg,#3b82f6,#8b5cf6);
          height: 100%; border-radius: 999px;
          transition: width 0.4s ease;
        }
        .hc-bar-pink {
          background: linear-gradient(90deg,#ec4899,#8b5cf6);
        }
        .hc-bar-count {
          color: #64748b; font-size: 0.82rem;
          font-variant-numeric: tabular-nums; min-width: 36px; text-align: right;
        }

        /* ── Tracking table ── */
        .hc-table { width: 100%; border-collapse: collapse; font-size: 0.84rem; }
        .hc-table td { padding: 0.3rem 0; color: #94a3b8; }
        .hc-td-rank  { color: #475569; width: 30px; }
        .hc-td-id    { color: #cbd5e1; flex: 1; }
        .hc-td-val   { color: #60a5fa; text-align: right; font-variant-numeric: tabular-nums; }

        .hc-no-stats { color: #475569; font-size: 0.85rem; }

        /* ── Timestamp table ── */
        .hc-ts-header {
          display: flex; align-items: center; justify-content: space-between;
          margin-top: 1.5rem; margin-bottom: 0.6rem;
        }

        .hc-ts-filter {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          color: #cbd5e1; padding: 0.3rem 0.6rem;
          border-radius: 7px; font-size: 0.78rem; cursor: pointer; outline: none;
          appearance: none;
        }
        .hc-ts-filter option { background: #1e293b; }

        .hc-ts-wrap {
          max-height: 260px; overflow-y: auto;
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 10px; overflow-x: auto;
        }
        .hc-ts-wrap::-webkit-scrollbar { width: 5px; height: 5px; }
        .hc-ts-wrap::-webkit-scrollbar-track { background: transparent; }
        .hc-ts-wrap::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.1); border-radius: 99px;
        }

        .hc-ts-table {
          width: 100%; border-collapse: collapse; font-size: 0.82rem;
          min-width: 360px;
        }

        .hc-th {
          position: sticky; top: 0;
          background: rgba(15,23,42,0.95);
          color: #64748b; font-weight: 600; font-size: 0.72rem;
          letter-spacing: 0.05em; text-transform: uppercase;
          padding: 0.55rem 0.8rem; text-align: left;
          border-bottom: 1px solid rgba(255,255,255,0.07);
        }
        .hc-th-event { width: 50%; }
        .hc-th-right { text-align: right; }

        .hc-ts-row { border-bottom: 1px solid rgba(255,255,255,0.04); }
        .hc-ts-row:last-child { border-bottom: none; }
        .hc-ts-row:hover { background: rgba(255,255,255,0.03); }

        .hc-ts-half  { color: #475569; padding: 0.45rem 0.8rem; white-space: nowrap; }
        .hc-ts-time  { color: #60a5fa; padding: 0.45rem 0.8rem; white-space: nowrap;
                        font-variant-numeric: tabular-nums; font-weight: 500; }
        .hc-ts-event { color: #e2e8f0; padding: 0.45rem 0.8rem; }
        .hc-ts-conf  { padding: 0.45rem 0.8rem; text-align: right;
                        font-variant-numeric: tabular-nums; font-weight: 600; }
        .hc-ts-empty {
          text-align: center; color: #475569; padding: 1.5rem; font-size: 0.85rem;
        }

        /* ── Spinner ── */
        .btn-spinner {
          width: 20px; height: 20px;
          border: 2px solid rgba(255,255,255,0.2);
          border-top-color: #60a5fa; border-radius: 50%;
          animation: hspin 0.7s linear infinite; display: inline-block;
        }
        .large-spinner { width: 36px; height: 36px; border-width: 3px; }
        @keyframes hspin { to { transform: rotate(360deg); } }

        /* ── Selection & Compare ── */
        .hc-card-selected {
          border-color: rgba(59,130,246,0.45) !important;
          background: rgba(59,130,246,0.04);
        }

        .hc-checkbox {
          width: 22px; height: 22px; border-radius: 6px; flex-shrink: 0;
          border: 2px solid rgba(255,255,255,0.18);
          background: rgba(255,255,255,0.04);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: all 0.18s;
        }
        .hc-checkbox:hover { border-color: rgba(59,130,246,0.6); background: rgba(59,130,246,0.1); }
        .hc-checkbox-checked {
          background: #3b82f6 !important;
          border-color: #3b82f6 !important;
        }

        .hist-compare-bar {
          display: flex; align-items: center; justify-content: space-between;
          gap: 0.75rem; flex-wrap: wrap;
          background: rgba(59,130,246,0.08);
          border: 1px solid rgba(59,130,246,0.25);
          border-radius: 12px; padding: 0.75rem 1.1rem;
          margin-bottom: 1rem;
        }
        .hist-compare-info { display: flex; align-items: center; gap: 0.5rem; }
        .hist-compare-count {
          background: #3b82f6; color: #fff;
          width: 24px; height: 24px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 0.78rem; font-weight: 700; flex-shrink: 0;
        }
        .hist-compare-label { color: #93c5fd; font-size: 0.83rem; }

        .hist-compare-clear {
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          color: #94a3b8; padding: 0.4rem 0.85rem;
          border-radius: 8px; font-size: 0.8rem; cursor: pointer;
          transition: all 0.18s;
        }
        .hist-compare-clear:hover { background: rgba(255,255,255,0.12); color: #cbd5e1; }

        .hist-compare-btn {
          background: rgba(59,130,246,0.15);
          border: 1px solid rgba(59,130,246,0.25);
          color: #64748b; padding: 0.4rem 1.1rem;
          border-radius: 8px; font-size: 0.82rem; font-weight: 600;
          cursor: not-allowed; transition: all 0.18s;
        }
        .hist-compare-btn-active {
          color: #93c5fd; cursor: pointer;
          background: rgba(59,130,246,0.2);
          border-color: rgba(59,130,246,0.45);
        }
        .hist-compare-btn-active:hover {
          background: rgba(59,130,246,0.3);
          border-color: rgba(59,130,246,0.6);
          color: #bfdbfe;
        }

        /* ── Tags ── */
        .hc-tags-row {
          display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap;
          padding: 0 1.25rem 0.75rem;
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }

        .hc-tag {
          display: inline-flex; align-items: center; gap: 0.3rem;
          padding: 0.2rem 0.55rem; border-radius: 999px;
          border: 1px solid; font-size: 0.74rem; font-weight: 500;
          white-space: nowrap; max-width: 180px; overflow: hidden;
          text-overflow: ellipsis;
        }

        .hc-tag-x {
          background: none; border: none; cursor: pointer;
          color: inherit; opacity: 0.6; line-height: 1;
          padding: 0; font-size: 0.9rem; flex-shrink: 0;
          transition: opacity 0.15s;
        }
        .hc-tag-x:hover { opacity: 1; }

        .hc-tag-input-wrap {
          display: flex; align-items: center; gap: 0.3rem;
        }

        .hc-tag-input {
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.15);
          color: #e2e8f0; border-radius: 6px;
          padding: 0.22rem 0.55rem; font-size: 0.78rem;
          outline: none; width: 110px;
          transition: border-color 0.15s;
        }
        .hc-tag-input:focus { border-color: rgba(59,130,246,0.5); }
        .hc-tag-input::placeholder { color: #475569; }

        .hc-tag-confirm {
          background: rgba(59,130,246,0.2);
          border: 1px solid rgba(59,130,246,0.35);
          color: #93c5fd; padding: 0.22rem 0.6rem;
          border-radius: 6px; font-size: 0.75rem; font-weight: 600;
          cursor: pointer; transition: all 0.15s;
        }
        .hc-tag-confirm:hover:not(:disabled) { background: rgba(59,130,246,0.35); }
        .hc-tag-confirm:disabled { opacity: 0.4; cursor: default; }

        .hc-tag-cancel-btn {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          color: #64748b; padding: 0.22rem 0.5rem;
          border-radius: 6px; font-size: 0.75rem; cursor: pointer;
          transition: all 0.15s;
        }
        .hc-tag-cancel-btn:hover { color: #94a3b8; background: rgba(255,255,255,0.1); }

        .hc-tag-plus {
          background: none;
          border: 1px dashed rgba(255,255,255,0.15);
          color: #475569; padding: 0.18rem 0.6rem;
          border-radius: 999px; font-size: 0.73rem; cursor: pointer;
          transition: all 0.15s; white-space: nowrap;
        }
        .hc-tag-plus:hover {
          border-color: rgba(59,130,246,0.4); color: #93c5fd;
          background: rgba(59,130,246,0.06);
        }

        /* ── Notes ── */
        .hc-notes-wrap {
          margin-top: 1.25rem;
          border-top: 1px solid rgba(255,255,255,0.05);
          padding-top: 1rem;
        }

        .hc-notes-header {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 0.75rem;
        }

        .hc-note-add-btn {
          background: rgba(139,92,246,0.12);
          border: 1px solid rgba(139,92,246,0.25);
          color: #a78bfa; padding: 0.25rem 0.7rem;
          border-radius: 7px; font-size: 0.76rem; font-weight: 600;
          cursor: pointer; transition: all 0.15s;
        }
        .hc-note-add-btn:hover {
          background: rgba(139,92,246,0.22);
          border-color: rgba(139,92,246,0.45);
        }

        .hc-note-form { margin-bottom: 0.75rem; }

        .hc-note-textarea {
          width: 100%; box-sizing: border-box;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.12);
          color: #e2e8f0; border-radius: 8px;
          padding: 0.65rem 0.85rem; font-size: 0.84rem;
          resize: vertical; outline: none; font-family: inherit;
          transition: border-color 0.15s;
        }
        .hc-note-textarea:focus { border-color: rgba(139,92,246,0.45); }
        .hc-note-textarea::placeholder { color: #475569; }

        .hc-note-form-btns {
          display: flex; gap: 0.45rem; margin-top: 0.45rem;
        }

        .hc-note-save-btn {
          background: rgba(139,92,246,0.2);
          border: 1px solid rgba(139,92,246,0.35);
          color: #a78bfa; padding: 0.3rem 0.85rem;
          border-radius: 7px; font-size: 0.8rem; font-weight: 600;
          cursor: pointer; transition: all 0.15s;
        }
        .hc-note-save-btn:hover:not(:disabled) {
          background: rgba(139,92,246,0.32);
          border-color: rgba(139,92,246,0.55);
        }
        .hc-note-save-btn:disabled { opacity: 0.4; cursor: default; }

        .hc-note-cancel-btn {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          color: #64748b; padding: 0.3rem 0.75rem;
          border-radius: 7px; font-size: 0.8rem; cursor: pointer;
          transition: all 0.15s;
        }
        .hc-note-cancel-btn:hover { color: #94a3b8; background: rgba(255,255,255,0.1); }

        .hc-note-card {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 10px; padding: 0.75rem 0.9rem;
          margin-bottom: 0.5rem;
        }

        .hc-note-text {
          color: #cbd5e1; font-size: 0.84rem; line-height: 1.5;
          margin: 0 0 0.45rem; white-space: pre-wrap; word-break: break-word;
        }

        .hc-note-meta {
          display: flex; align-items: center; justify-content: space-between;
          gap: 0.5rem;
        }

        .hc-note-date { color: #475569; font-size: 0.74rem; }

        .hc-note-actions { display: flex; gap: 0.35rem; }

        .hc-note-edit-btn, .hc-note-del-btn {
          background: none; border: none; cursor: pointer;
          font-size: 0.74rem; padding: 0.15rem 0.4rem;
          border-radius: 5px; transition: all 0.15s;
        }
        .hc-note-edit-btn { color: #60a5fa; }
        .hc-note-edit-btn:hover { background: rgba(96,165,250,0.12); }
        .hc-note-del-btn { color: #f87171; }
        .hc-note-del-btn:hover { background: rgba(248,113,113,0.12); }

        .hc-notes-hint {
          color: #475569; font-size: 0.82rem; margin: 0.25rem 0 0;
        }

        /* ── Team stats mini ── */
        .hc-team-section {
          margin-top: 1.25rem;
          padding-top: 1rem;
          border-top: 1px solid rgba(255,255,255,0.05);
        }

        .hc-team-header {
          display: grid; grid-template-columns: 1fr auto 1fr;
          align-items: center; margin-bottom: 0.5rem;
          font-size: 0.8rem; font-weight: 700;
        }

        .hc-dom-row {
          display: flex; align-items: center; gap: 0.6rem;
          margin-bottom: 0.75rem;
        }
        .hc-dom-track {
          flex: 1; height: 6px; border-radius: 999px;
          overflow: hidden; display: flex;
          background: rgba(255,255,255,0.05);
        }

        .hc-duel-row {
          display: grid; grid-template-columns: 24px 1fr 24px;
          align-items: center; gap: 0.4rem;
          padding: 0.2rem 0;
        }
        .hc-duel-bars {
          display: grid; grid-template-columns: 1fr auto 1fr;
          align-items: center; gap: 0.3rem;
        }
        .hc-duel-left  { height: 5px; background: rgba(255,255,255,0.05); border-radius: 999px; overflow: hidden; display: flex; justify-content: flex-end; }
        .hc-duel-right { height: 5px; background: rgba(255,255,255,0.05); border-radius: 999px; overflow: hidden; }
        .hc-duel-lbl   { color: #64748b; font-size: 0.7rem; white-space: nowrap; text-align: center; padding: 0 0.25rem; }

        /* Team pill in table */
        .hc-ts-team { padding: 0.35rem 0.8rem; }
        .hc-team-pill {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 0.15rem 0.45rem; border-radius: 999px;
          border: 1px solid; font-size: 0.68rem; font-weight: 700;
          white-space: nowrap;
        }
      `}</style>
    </div>
    </>
  );
}
