import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import axios from "axios";

export default function ProgressBar({ apiUrl, jobId, mode, jobStartedAt, onStatusUpdate, onComplete, onFailed }) {
  const { t } = useTranslation();

  const EVENT_STAGES = [
    { key: "queued",           icon: "📋", title: t("progress.stage.queued.title"),           desc: t("progress.stage.queued.desc") },
    { key: "extracting",       icon: "🎬", title: t("progress.stage.extracting.title"),       desc: t("progress.stage.extracting.desc") },
    { key: "inferring",        icon: "🧠", title: t("progress.stage.inferring.title"),        desc: t("progress.stage.inferring.desc") },
    { key: "team_colors",      icon: "🎨", title: t("progress.stage.team_colors.title"),      desc: t("progress.stage.team_colors.desc") },
    { key: "team_attribution", icon: "👥", title: t("progress.stage.team_attribution.title"), desc: t("progress.stage.team_attribution.desc") },
    { key: "completed",        icon: "✅", title: t("progress.stage.completed.title"),        desc: t("progress.stage.completed.desc") },
  ];

  const EVENT_STEPPER = [
    { keys: ["queued"],                         label: t("progress.stepper.queued")    },
    { keys: ["extracting"],                     label: t("progress.stepper.analysing") },
    { keys: ["inferring"],                      label: t("progress.stepper.detecting") },
    { keys: ["team_colors","team_attribution"], label: t("progress.stepper.teams")     },
    { keys: ["completed"],                      label: t("progress.stepper.complete")  },
  ];

  const TRACKING_STAGES = [
    { key: "queued",     icon: "📋", title: t("progress.tracking.queued.title"),      desc: t("progress.tracking.queued.desc") },
    { key: "detecting",  icon: "🎯", title: t("progress.tracking.detecting.title"),   desc: t("progress.tracking.detecting.desc") },
    { key: "processing", icon: "⚙️", title: t("progress.tracking.processing.title"),  desc: t("progress.tracking.processing.desc") },
    { key: "rendering",  icon: "🎬", title: t("progress.tracking.rendering.title"),   desc: t("progress.tracking.rendering.desc") },
    { key: "encoding",   icon: "💾", title: t("progress.tracking.encoding.title"),    desc: t("progress.tracking.encoding.desc") },
    { key: "done",       icon: "✅", title: t("progress.tracking.done.title"),        desc: t("progress.tracking.done.desc") },
    { key: "completed",  icon: "✅", title: t("progress.tracking.done.title"),        desc: t("progress.tracking.done.desc") },
  ];

  const TRACKING_STEPPER = [
    { keys: ["queued"],               label: t("progress.stepper.queued")     },
    { keys: ["detecting"],            label: t("progress.stepper.detecting")  },
    { keys: ["processing"],           label: t("progress.stepper.processing") },
    { keys: ["rendering","encoding"], label: t("progress.stepper.rendering")  },
    { keys: ["done","completed"],     label: t("progress.stepper.complete")   },
  ];

  const STAGES  = mode === "tracking" ? TRACKING_STAGES  : EVENT_STAGES;
  const STEPPER = mode === "tracking" ? TRACKING_STEPPER : EVENT_STEPPER;
  const [stage,      setStage]      = useState("queued");
  const [message,    setMessage]    = useState("");
  const [elapsedSec, setElapsedSec] = useState(
    jobStartedAt ? Math.floor((Date.now() - jobStartedAt) / 1000) : 0
  );

  useEffect(() => {
    const iv = setInterval(async () => {
      try {
        const res = await axios.get(`${apiUrl}/api/status/${jobId}`);
        const { status, message: msg } = res.data;
        setStage(status);
        setMessage(msg || "");
        onStatusUpdate(status, msg);
        if (status === "completed") {
          const full = await axios.get(`${apiUrl}/api/results/${jobId}`);
          clearInterval(iv);
          onComplete(full.data);
        } else if (status === "failed") {
          clearInterval(iv);
          onFailed(msg);
        }
      } catch (err) {
        console.error("Status poll error:", err);
      }
    }, 2000);
    return () => clearInterval(iv);
  }, [apiUrl, jobId, onStatusUpdate, onComplete, onFailed]);

  useEffect(() => {
    const t = setInterval(() => {
      setElapsedSec(jobStartedAt
        ? Math.floor((Date.now() - jobStartedAt) / 1000)
        : s => s + 1
      );
    }, 1000);
    return () => clearInterval(t);
  }, [jobStartedAt]);

  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const currentStage = STAGES.find(s => s.key === stage) || STAGES[0];

  // Stepper: which step is active/done
  const stepperIdx = STEPPER.findIndex(s => s.keys.includes(stage));
  const currentStepIdx = stepperIdx === -1 ? 0 : stepperIdx;

  return (
    <div className="pb-wrap">
      {/* Orb */}
      <div className="pb-orb-wrap">
        <div className="pb-orb">
          <span className="pb-orb-icon">{currentStage.icon}</span>
          <div className="pb-ring pb-ring-1" />
          <div className="pb-ring pb-ring-2" />
          <div className="pb-ring pb-ring-3" />
        </div>
      </div>

      {/* Title & description */}
      <h2 className="pb-title">{currentStage.title}</h2>
      <p className="pb-desc">{message && message !== currentStage.title ? message : currentStage.desc}</p>

      {/* Elapsed time */}
      <div className="pb-timer">
        <div className="pb-timer-row">
          <span className="pb-timer-label">{t("progress.elapsedTime")}</span>
          <span className="pb-timer-val">{fmt(elapsedSec)}</span>
        </div>
        <div className="pb-timer-bar">
          <div className="pb-timer-shine" />
        </div>
      </div>

      {/* Stepper */}
      <div className="pb-stepper">
        {STEPPER.map((step, i) => {
          const isDone   = i < currentStepIdx;
          const isActive = i === currentStepIdx;
          return (
            <React.Fragment key={step.label}>
              <div className={`pb-step ${isActive ? "pb-step-active" : ""} ${isDone ? "pb-step-done" : ""}`}>
                <div className="pb-step-circle">
                  {isDone ? (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M3 8l3.5 3.5L13 5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  ) : (
                    <span className="pb-step-num">{i + 1}</span>
                  )}
                </div>
                <span className="pb-step-label">{step.label}</span>
              </div>
              {i < STEPPER.length - 1 && (
                <div className={`pb-connector ${isDone ? "pb-connector-done" : ""}`}>
                  <div className="pb-connector-fill" />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Job ID */}
      <div className="pb-jobid">
        <span className="pb-jobid-label">{t("progress.jobId")}</span>
        <code className="pb-jobid-val">{jobId}</code>
      </div>

      <style>{`
        .pb-wrap {
          text-align: center;
          padding: 3rem 1rem 2rem;
          animation: pbFadeIn 0.5s ease;
        }

        @keyframes pbFadeIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }

        /* ── Orb ── */
        .pb-orb-wrap {
          width: 148px;
          height: 148px;
          margin: 0 auto 2.5rem;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .pb-orb {
          position: relative;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .pb-orb-icon {
          font-size: 2.8rem;
          width: 88px;
          height: 88px;
          background: linear-gradient(135deg, rgba(59,130,246,0.18), rgba(139,92,246,0.18));
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          backdrop-filter: blur(10px);
          box-shadow: 0 8px 32px rgba(59,130,246,0.25), inset 0 1px 0 rgba(255,255,255,0.08);
          animation: orbPulse 2.5s ease-in-out infinite;
          position: relative;
          z-index: 3;
          line-height: 1;
        }

        @keyframes orbPulse {
          0%, 100% { transform: scale(1); box-shadow: 0 8px 32px rgba(59,130,246,0.25); }
          50%       { transform: scale(1.04); box-shadow: 0 12px 40px rgba(59,130,246,0.38); }
        }

        .pb-ring {
          position: absolute;
          border-radius: 50%;
          border: 1px solid rgba(59, 130, 246, 0.22);
          animation: ringPulse 3s ease-in-out infinite;
        }

        .pb-ring-1 { inset: -12px; animation-delay: 0s; }
        .pb-ring-2 { inset: -26px; animation-delay: 0.6s; }
        .pb-ring-3 { inset: -40px; animation-delay: 1.2s; border-color: rgba(139,92,246,0.12); }

        @keyframes ringPulse {
          0%, 100% { opacity: 0.2; transform: scale(0.97); }
          50%       { opacity: 0.55; transform: scale(1.03); }
        }

        /* ── Text ── */
        .pb-title {
          font-family: 'Space Grotesk', sans-serif;
          font-size: 1.85rem;
          font-weight: 700;
          color: #f1f5f9;
          margin-bottom: 0.5rem;
          letter-spacing: -0.02em;
        }

        .pb-desc {
          color: #64748b;
          font-size: 0.95rem;
          margin-bottom: 2rem;
          max-width: 380px;
          margin-left: auto;
          margin-right: auto;
          line-height: 1.55;
        }

        /* ── Timer ── */
        .pb-timer {
          display: inline-block;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 14px;
          padding: 1rem 2rem;
          margin-bottom: 2.75rem;
          min-width: 200px;
          position: relative;
          overflow: hidden;
        }

        .pb-timer-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1.5rem;
        }

        .pb-timer-label {
          color: #64748b;
          font-size: 0.72rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }

        .pb-timer-val {
          font-family: 'Space Grotesk', monospace;
          font-size: 1.65rem;
          font-weight: 700;
          color: #60a5fa;
          font-variant-numeric: tabular-nums;
          letter-spacing: -0.01em;
        }

        .pb-timer-bar {
          height: 2px;
          background: rgba(59,130,246,0.15);
          border-radius: 999px;
          margin-top: 0.75rem;
          overflow: hidden;
          position: relative;
        }

        .pb-timer-shine {
          position: absolute;
          left: -60%;
          top: 0;
          width: 60%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(96,165,250,0.8), transparent);
          animation: timerShine 2s ease-in-out infinite;
        }

        @keyframes timerShine {
          from { left: -60%; }
          to   { left: 120%; }
        }

        /* ── Stepper ── */
        .pb-stepper {
          display: flex;
          align-items: flex-start;
          justify-content: center;
          gap: 0;
          margin: 0 auto 2.5rem;
          max-width: 680px;
          padding: 0 1rem;
          flex-wrap: nowrap;
        }

        .pb-step {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
          flex-shrink: 0;
          opacity: 0.35;
          transition: opacity 0.3s;
        }

        .pb-step-done, .pb-step-active { opacity: 1; }

        .pb-step-circle {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: rgba(255,255,255,0.05);
          border: 2px solid rgba(255,255,255,0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.85rem;
          color: #64748b;
          transition: all 0.3s;
          position: relative;
        }

        .pb-step-num { font-size: 0.82rem; font-weight: 600; }

        .pb-step-done .pb-step-circle {
          background: linear-gradient(135deg, #22c55e, #16a34a);
          border-color: #22c55e;
          box-shadow: 0 4px 12px rgba(34,197,94,0.35);
        }

        .pb-step-active .pb-step-circle {
          background: linear-gradient(135deg, #3b82f6, #6366f1);
          border-color: #60a5fa;
          color: white;
          box-shadow: 0 0 0 4px rgba(59,130,246,0.18), 0 4px 14px rgba(59,130,246,0.4);
          animation: stepPulse 2s ease-in-out infinite;
        }

        @keyframes stepPulse {
          0%, 100% { box-shadow: 0 0 0 4px rgba(59,130,246,0.18), 0 4px 14px rgba(59,130,246,0.4); }
          50%       { box-shadow: 0 0 0 8px rgba(59,130,246,0.08), 0 4px 14px rgba(59,130,246,0.4); }
        }

        .pb-step-label {
          font-size: 0.72rem;
          color: #64748b;
          font-weight: 500;
          text-align: center;
          white-space: nowrap;
        }

        .pb-step-done .pb-step-label,
        .pb-step-active .pb-step-label { color: #e2e8f0; }

        /* ── Connector ── */
        .pb-connector {
          flex: 1;
          height: 2px;
          background: rgba(255,255,255,0.07);
          margin: 19px 4px 0;
          border-radius: 999px;
          overflow: hidden;
          max-width: 80px;
          min-width: 20px;
        }

        .pb-connector-fill {
          height: 100%;
          width: 0%;
          background: linear-gradient(90deg, #22c55e, #3b82f6);
          border-radius: 999px;
          transition: width 0.7s ease;
        }

        .pb-connector-done .pb-connector-fill { width: 100%; }

        /* ── Job ID ── */
        .pb-jobid {
          display: inline-flex;
          align-items: center;
          gap: 0.75rem;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          padding: 0.5rem 1.1rem;
          border-radius: 8px;
        }

        .pb-jobid-label {
          color: #475569;
          font-size: 0.7rem;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          font-weight: 600;
        }

        .pb-jobid-val {
          font-family: 'JetBrains Mono', 'Courier New', monospace;
          color: #60a5fa;
          font-size: 0.82rem;
          font-weight: 500;
        }
      `}</style>
    </div>
  );
}
