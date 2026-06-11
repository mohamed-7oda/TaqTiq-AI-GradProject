import React, { useState, useEffect, useRef } from "react";
import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

export default function HighlightsPlayer({ jobId, token }) {
  // ── Standard highlights ──────────────────────────────────────────────────
  const [hlStatus,    setHlStatus]    = useState("generating");
  const [eventCount,  setEventCount]  = useState(null);
  const [clipCount,   setClipCount]   = useState(null);
  const [downloading, setDownloading] = useState(false);

  // ── HD highlights ────────────────────────────────────────────────────────
  const [hdStatus,       setHdStatus]       = useState("none"); // none | generating | ready | unavailable
  const [hdDownloading,  setHdDownloading]  = useState(false);
  const [hdElapsed,      setHdElapsed]      = useState(0);
  const [hdStartedAt,    setHdStartedAt]    = useState(null);

  const stdTimerRef = useRef(null);
  const hdTimerRef  = useRef(null);
  const hdClockRef  = useRef(null);

  // ── Poll standard highlights ─────────────────────────────────────────────
  useEffect(() => {
    let active = true;
    const poll = () => {
      axios.get(`${API_URL}/api/highlights/status/${jobId}`)
        .then(res => {
          if (!active) return;
          const { status, eventCount: ec, clipCount: cc } = res.data;
          setHlStatus(status);
          if (ec != null) setEventCount(ec);
          if (cc != null) setClipCount(cc);
          if (status === "generating") stdTimerRef.current = setTimeout(poll, 4000);
        })
        .catch(() => { if (active) setHlStatus("unavailable"); });
    };
    poll();
    return () => { active = false; clearTimeout(stdTimerRef.current); };
  }, [jobId]);

  // ── Poll HD status when generating ───────────────────────────────────────
  useEffect(() => {
    if (hdStatus !== "generating") return;
    let active = true;
    const poll = () => {
      axios.get(`${API_URL}/api/highlights/hd/status/${jobId}`)
        .then(res => {
          if (!active) return;
          setHdStatus(res.data.status);
          if (res.data.status === "generating") hdTimerRef.current = setTimeout(poll, 5000);
        })
        .catch(() => { if (active) setHdStatus("unavailable"); });
    };
    hdTimerRef.current = setTimeout(poll, 5000);
    return () => { active = false; clearTimeout(hdTimerRef.current); };
  }, [hdStatus, jobId]);

  // ── HD elapsed clock ─────────────────────────────────────────────────────
  useEffect(() => {
    if (hdStatus === "generating" && hdStartedAt) {
      hdClockRef.current = setInterval(() => {
        setHdElapsed(Math.floor((Date.now() - hdStartedAt) / 1000));
      }, 1000);
    } else {
      clearInterval(hdClockRef.current);
    }
    return () => clearInterval(hdClockRef.current);
  }, [hdStatus, hdStartedAt]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleDownloadStd = async () => {
    setDownloading(true);
    try {
      const res = await axios.get(`${API_URL}/api/highlights/${jobId}?download=1`, { responseType: "blob" });
      triggerDownload(res.data, "highlights.mp4");
    } catch { alert("Download failed — please try again."); }
    finally { setDownloading(false); }
  };

  const handleGenerateHD = async () => {
    setHdStartedAt(Date.now());
    setHdElapsed(0);
    setHdStatus("generating");
    try {
      await axios.post(`${API_URL}/api/highlights/hd/${jobId}`);
    } catch (err) {
      setHdStatus(err.response?.data?.status || "unavailable");
    }
  };

  const handleDownloadHD = async () => {
    setHdDownloading(true);
    try {
      const res = await axios.get(`${API_URL}/api/highlights/hd/serve/${jobId}?download=1`, { responseType: "blob" });
      triggerDownload(res.data, "highlights_hd.mp4");
    } catch { alert("Download failed — please try again."); }
    finally { setHdDownloading(false); }
  };

  const triggerDownload = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const fmtTime = s => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const stdVideoUrl = `${API_URL}/api/highlights/${jobId}`;
  const hdVideoUrl  = `${API_URL}/api/highlights/hd/serve/${jobId}`;

  return (
    <div className="hl-wrap">

      {/* ══ Standard Highlights ══════════════════════════════════════════════ */}
      <div className="hl-card">
        <div className="hl-header">
          <div className="hl-title-row">
            <span className="hl-icon">🎬</span>
            <div>
              <h2 className="hl-title">Match Highlights</h2>
              {hlStatus === "ready" && eventCount != null && (
                <p className="hl-subtitle">{eventCount} key event{eventCount !== 1 ? "s" : ""} · {clipCount} clip{clipCount !== 1 ? "s" : ""} · Standard quality</p>
              )}
              {hlStatus === "generating" && <p className="hl-subtitle">Processing clips…</p>}
              {hlStatus === "unavailable" && <p className="hl-subtitle" style={{ color: "#ef4444" }}>Unavailable</p>}
            </div>
          </div>

          {hlStatus === "ready" && (
            <button className="hl-download-btn" onClick={handleDownloadStd} disabled={downloading}>
              {downloading ? <span className="hl-spinner" /> : <DownloadIcon />}
              {downloading ? "Downloading…" : "Download MP4"}
            </button>
          )}
        </div>

        {hlStatus === "generating" && (
          <div className="hl-generating">
            <div className="hl-gen-inner">
              <div className="hl-progress-bar"><div className="hl-progress-fill" /></div>
              <p className="hl-gen-msg">Extracting clips and merging highlights video…</p>
              <p className="hl-gen-hint">This runs in the background — you can browse your results below.</p>
            </div>
          </div>
        )}

        {hlStatus === "unavailable" && (
          <div className="hl-generating">
            <div className="hl-gen-inner">
              <p className="hl-gen-msg" style={{ color: "#64748b" }}>Highlights could not be generated for this video.</p>
              <p className="hl-gen-hint">This can happen when no high-confidence events were detected, or when ffmpeg is not available on the server.</p>
            </div>
          </div>
        )}

        {hlStatus === "ready" && (
          <div className="hl-video-wrap">
            <video className="hl-video" src={stdVideoUrl} controls preload="metadata" />
          </div>
        )}
      </div>

      {/* ══ HD Highlights ════════════════════════════════════════════════════ */}
      {hlStatus === "ready" && hdStatus !== "unavailable" && (
        <div className={`hl-card hl-hd-card ${hdStatus === "ready" ? "hl-hd-ready" : ""}`}>

          {/* HD prompt — before generation starts */}
          {hdStatus === "none" && (
            <div className="hl-hd-prompt">
              <div className="hl-hd-prompt-left">
                <span className="hl-hd-badge">HD</span>
                <div>
                  <p className="hl-hd-prompt-title">Want higher-quality video?</p>
                  <p className="hl-hd-prompt-sub">Sharper image, higher bitrate (6 Mbps) and better audio (256k). Takes 3–8 min.</p>
                </div>
              </div>
              <button className="hl-hd-btn" onClick={handleGenerateHD}>
                ✨ Generate HD Highlights
              </button>
            </div>
          )}

          {/* HD generating */}
          {hdStatus === "generating" && (
            <div className="hl-header" style={{ borderBottom: "none" }}>
              <div className="hl-title-row">
                <span className="hl-icon">⚙️</span>
                <div>
                  <h2 className="hl-title">Encoding HD Highlights</h2>
                  <p className="hl-subtitle">Higher quality encoding in progress — this may take several minutes.</p>
                </div>
              </div>
              <div className="hl-hd-timer">
                <span className="hl-hd-timer-label">Elapsed</span>
                <span className="hl-hd-timer-val">{fmtTime(hdElapsed)}</span>
              </div>
            </div>
          )}

          {hdStatus === "generating" && (
            <div className="hl-generating" style={{ paddingTop: "0.5rem" }}>
              <div className="hl-gen-inner">
                <div className="hl-progress-bar">
                  <div className="hl-progress-fill hl-progress-hd" />
                </div>
                <p className="hl-gen-hint">Using high-quality encoding settings — your standard highlights are still available above.</p>
              </div>
            </div>
          )}

          {/* HD ready */}
          {hdStatus === "ready" && (
            <>
              <div className="hl-header">
                <div className="hl-title-row">
                  <span className="hl-icon">🏆</span>
                  <div>
                    <h2 className="hl-title">
                      HD Highlights
                      <span className="hl-hd-badge" style={{ marginLeft: "0.6rem", fontSize: "0.7rem" }}>HD</span>
                    </h2>
                    <p className="hl-subtitle">Sharpened · 6 Mbps bitrate · 256k audio · Better overall quality</p>
                  </div>
                </div>
                <button className="hl-download-btn hl-download-hd" onClick={handleDownloadHD} disabled={hdDownloading}>
                  {hdDownloading ? <span className="hl-spinner" /> : <DownloadIcon />}
                  {hdDownloading ? "Downloading…" : "Download HD"}
                </button>
              </div>
              <div className="hl-video-wrap">
                <video className="hl-video" src={hdVideoUrl} controls preload="metadata" />
              </div>
            </>
          )}

        </div>
      )}

      <style>{`
        .hl-wrap { max-width: 900px; margin: 0 auto 2rem; display: flex; flex-direction: column; gap: 1rem; }

        .hl-card {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.09);
          border-radius: 20px; overflow: hidden;
        }

        .hl-hd-card { border-color: rgba(234,179,8,0.15); }
        .hl-hd-ready { border-color: rgba(234,179,8,0.25); }

        /* ── Header ── */
        .hl-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 1.25rem 1.5rem; gap: 1rem; flex-wrap: wrap;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          background: rgba(59,130,246,0.04);
        }

        .hl-title-row { display: flex; align-items: center; gap: 0.85rem; }
        .hl-icon { font-size: 1.8rem; }
        .hl-title { color: #f1f5f9; font-size: 1.15rem; font-weight: 600; letter-spacing: -0.01em; margin: 0 0 0.15rem; display: flex; align-items: center; gap: 0.4rem; }
        .hl-subtitle { color: #64748b; font-size: 0.82rem; margin: 0; }

        /* ── Buttons ── */
        .hl-download-btn {
          display: flex; align-items: center; gap: 0.5rem;
          background: linear-gradient(135deg,#3b82f6,#8b5cf6);
          color: #fff; border: none; padding: 0.6rem 1.2rem;
          border-radius: 10px; font-size: 0.88rem; font-weight: 600;
          cursor: pointer; transition: opacity 0.2s, transform 0.2s;
          box-shadow: 0 3px 10px rgba(59,130,246,0.3);
          min-width: 140px; justify-content: center; font-family: inherit;
        }
        .hl-download-btn:hover:not(:disabled) { opacity: 0.88; transform: translateY(-1px); }
        .hl-download-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .hl-download-hd { background: linear-gradient(135deg,#ca8a04,#eab308); box-shadow: 0 3px 10px rgba(234,179,8,0.25); }

        /* ── HD prompt banner ── */
        .hl-hd-prompt {
          display: flex; align-items: center; justify-content: space-between;
          padding: 1.1rem 1.5rem; gap: 1rem; flex-wrap: wrap;
          background: rgba(234,179,8,0.05);
        }
        .hl-hd-prompt-left { display: flex; align-items: center; gap: 0.85rem; }
        .hl-hd-badge {
          background: linear-gradient(135deg,#ca8a04,#eab308);
          color: #000; font-size: 0.65rem; font-weight: 800;
          padding: 0.2rem 0.55rem; border-radius: 5px;
          letter-spacing: 0.08em; flex-shrink: 0;
        }
        .hl-hd-prompt-title { color: #f1f5f9; font-size: 0.95rem; font-weight: 600; margin: 0 0 0.2rem; }
        .hl-hd-prompt-sub   { color: #64748b; font-size: 0.8rem; margin: 0; }

        .hl-hd-btn {
          background: linear-gradient(135deg,#ca8a04,#eab308);
          color: #000; border: none; padding: 0.6rem 1.3rem;
          border-radius: 10px; font-size: 0.88rem; font-weight: 700;
          cursor: pointer; white-space: nowrap; flex-shrink: 0;
          transition: opacity 0.2s, transform 0.15s;
          box-shadow: 0 3px 12px rgba(234,179,8,0.3);
          font-family: inherit;
        }
        .hl-hd-btn:hover { opacity: 0.9; transform: translateY(-1px); }

        /* ── HD timer ── */
        .hl-hd-timer { text-align: right; flex-shrink: 0; }
        .hl-hd-timer-label { display: block; color: #64748b; font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 0.1rem; }
        .hl-hd-timer-val { color: #eab308; font-family: 'Space Grotesk', monospace; font-size: 1.35rem; font-weight: 700; font-variant-numeric: tabular-nums; }

        /* ── Generating state ── */
        .hl-generating { padding: 2rem 1.5rem; display: flex; justify-content: center; }
        .hl-gen-inner { max-width: 460px; width: 100%; text-align: center; }

        .hl-progress-bar { height: 4px; background: rgba(255,255,255,0.07); border-radius: 999px; overflow: hidden; margin-bottom: 1.25rem; }
        .hl-progress-fill { height: 100%; width: 40%; background: linear-gradient(90deg,#3b82f6,#8b5cf6); border-radius: 999px; animation: hl-slide 1.8s ease-in-out infinite; }
        .hl-progress-hd { background: linear-gradient(90deg,#ca8a04,#eab308); }

        @keyframes hl-slide {
          0%   { transform: translateX(-100%); width: 40%; }
          50%  { width: 60%; }
          100% { transform: translateX(260%); width: 40%; }
        }

        .hl-gen-msg  { color: #cbd5e1; font-size: 0.9rem; margin: 0 0 0.4rem; }
        .hl-gen-hint { color: #475569; font-size: 0.8rem; margin: 0; }

        /* ── Video ── */
        .hl-video-wrap { background: #000; }
        .hl-video { width: 100%; display: block; max-height: 520px; object-fit: contain; }

        /* ── Spinner ── */
        .hl-spinner { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: hl-spin 0.7s linear infinite; display: inline-block; }
        @keyframes hl-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  );
}
