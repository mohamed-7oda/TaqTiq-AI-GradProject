// frontend/src/components/VideoUpload.jsx
import React, { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import axios from "axios";

// ── SVG icon constants ────────────────────────────────────────────────────────
const Icons = {
  lightning: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  ),
  clock: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
  ),
  users: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  target: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <circle cx="12" cy="12" r="6"/>
      <circle cx="12" cy="12" r="2"/>
    </svg>
  ),
  activity: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  ),
  barChart: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/>
      <line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6"  y1="20" x2="6"  y2="14"/>
    </svg>
  ),
};

function VideoUpload({ apiUrl, mode, token, onUploadStart, onUploadSuccess, onUploadError }) {
  const { t } = useTranslation();
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const isTracking = mode === "tracking";

  const handleFileSelect = (e) => {
    const selected = e.target.files[0];
    if (selected) setFile(selected);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) setFile(dropped);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setUploadProgress(0);
    onUploadStart();

    const formData = new FormData();
    formData.append("video", file);
    formData.append("mode", mode || "events");

    try {
      const response = await axios.post(`${apiUrl}/api/upload`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        onUploadProgress: (e) => {
          if (e.total) setUploadProgress(Math.round((e.loaded * 100) / e.total));
        },
      });
      onUploadSuccess(response.data.job_id);
    } catch (err) {
      const msg = err.response?.data?.error || err.message || "Upload failed";
      onUploadError(msg);
      setUploading(false);
    }
  };

  // ---- Mode-specific UI ----
  const ctaLabel = isTracking ? t("upload.runTracking") : t("upload.detectEvents");

  const modeGuidance = isTracking
    ? t("upload.guidance.tracking")
    : t("upload.guidance.events");

  const features = isTracking
    ? [
        { icon: Icons.target,   title: t("upload.feature.tracking.1.title"), text: t("upload.feature.tracking.1.text") },
        { icon: Icons.activity, title: t("upload.feature.tracking.2.title"), text: t("upload.feature.tracking.2.text") },
        { icon: Icons.barChart, title: t("upload.feature.tracking.3.title"), text: t("upload.feature.tracking.3.text") },
      ]
    : [
        { icon: Icons.lightning, title: t("upload.feature.events.1.title"), text: t("upload.feature.events.1.text") },
        { icon: Icons.clock,     title: t("upload.feature.events.2.title"), text: t("upload.feature.events.2.text") },
        { icon: Icons.users,     title: t("upload.feature.events.3.title"), text: t("upload.feature.events.3.text") },
      ];

  return (
    <div className="upload-container">

      {/* ── Mode guidance ── */}
      <p className="vu-mode-hint">{modeGuidance}</p>

      {/* ── Info alerts ── */}
      <div className="vu-notes">
        <div className="vu-note">
          <span className="vu-note-icon">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
          </span>
          <span>{t("upload.keepOpen")}</span>
        </div>
        {isTracking ? (
          <div className="vu-note">
            <span className="vu-note-icon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
              </svg>
            </span>
            <span dangerouslySetInnerHTML={{ __html: t("upload.clipHint") }} />
          </div>
        ) : (
          <div className="vu-note">
            <span className="vu-note-icon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="15" rx="2" ry="2"/>
                <polyline points="17 2 12 7 7 2"/>
              </svg>
            </span>
            <span dangerouslySetInnerHTML={{ __html: t("upload.matchHint") }} />
          </div>
        )}
      </div>

      {/* ── Drop zone ── */}
      <div
        className={`drop-zone ${file ? "has-file" : ""} ${isDragging ? "dragging" : ""} ${isTracking ? "tracking-mode" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
        tabIndex={0}
        role="button"
        aria-label="Upload video file — click or drag and drop"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          onChange={handleFileSelect}
          style={{ display: "none" }}
        />

        {!file ? (
          <>
            <div className="upload-icon-wrapper">
              <div className="upload-icon-bg" />
              <svg className="upload-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
            </div>
            <h3>{t("upload.dropHere")}</h3>
            <p className="muted">{t("upload.orBrowse")}</p>
            <div className="formats">
              <span className="format-pill">MP4</span>
              <span className="format-pill">MKV</span>
              <span className="format-pill">AVI</span>
              <span className="format-pill">MOV</span>
              <span className="format-pill">WebM</span>
            </div>
          </>
        ) : (
          <>
            <div className="file-card">
              <div className="file-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.889L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/>
                </svg>
              </div>
              <div className="file-info">
                <div className="file-name">{file.name}</div>
                <div className="file-size">{(file.size / (1024 * 1024)).toFixed(1)} MB</div>
              </div>
              <div className="file-check">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
            </div>
            <p className="hint">{t("upload.clickDifferent")}</p>
          </>
        )}
      </div>

      {/* ── Action buttons ── */}
      {file && !uploading && (
        <div className="vu-actions">
          <button
            className={`vu-btn-run ${isTracking ? "vu-btn-run-tracking" : ""}`}
            onClick={handleUpload}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
            {ctaLabel}
          </button>
          <button className="vu-btn-cancel" onClick={() => setFile(null)}>
            {t("upload.cancel")}
          </button>
        </div>
      )}

      {/* ── Upload progress ── */}
      {uploading && (
        <div className="upload-progress">
          <div className="progress-header">
            <span className="progress-label">{t("upload.uploading")}</span>
            <span className={`progress-percent ${isTracking ? "progress-tracking" : ""}`}>
              {uploadProgress}%
            </span>
          </div>
          <div className="progress-bar-wrapper">
            <div
              className={`progress-bar-fill ${isTracking ? "progress-bar-tracking" : ""}`}
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* ── Feature highlights ── */}
      <div className={`features-grid ${isTracking ? "features-tracking" : ""}`}>
        {features.map((f) => (
          <div className="feature" key={f.title}>
            <div className="feature-icon">{f.icon}</div>
            <div className="feature-text">
              <strong>{f.title}</strong>
              <span>{f.text}</span>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        /* ── Wrapper ── */
        .upload-container { max-width: 720px; margin: 0 auto; }

        /* ── Mode guidance (complements PageHero, adds spec info) ── */
        .vu-mode-hint {
          text-align: center;
          color: #64748b;
          font-size: 0.84rem;
          margin-bottom: 1.25rem;
          padding: 0 1rem;
          line-height: 1.5;
        }

        /* ── Info alerts ── */
        .vu-notes {
          display: flex;
          flex-direction: column;
          gap: 0.45rem;
          margin-bottom: 1.5rem;
        }

        .vu-note {
          display: flex;
          align-items: flex-start;
          gap: 0.65rem;
          background: rgba(251,191,36,0.06);
          border: 1px solid rgba(251,191,36,0.17);
          border-radius: 10px;
          padding: 0.65rem 1rem;
          color: #fcd34d;
          font-size: 0.82rem;
          line-height: 1.5;
        }
        .vu-note strong { color: #fef08a; }

        .vu-note-icon {
          display: flex;
          align-items: center;
          flex-shrink: 0;
          margin-top: 2px;
          opacity: 0.8;
        }

        /* ── Drop zone ── */
        .drop-zone {
          position: relative;
          border: 2px dashed rgba(255,255,255,0.2);
          border-radius: 20px;
          padding: 3.5rem 2rem;
          text-align: center;
          cursor: pointer;
          transition: border-color 0.25s, background 0.25s, transform 0.25s, box-shadow 0.25s;
          background: rgba(255,255,255,0.02);
          overflow: hidden;
          outline: none;
        }

        .drop-zone::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at center, rgba(99,102,241,0.09), transparent 70%);
          opacity: 0;
          transition: opacity 0.25s;
          pointer-events: none;
        }
        .drop-zone.tracking-mode::before {
          background: radial-gradient(circle at center, rgba(16,185,129,0.09), transparent 70%);
        }

        .drop-zone:hover {
          border-color: rgba(99,102,241,0.55);
          background: rgba(99,102,241,0.03);
          transform: translateY(-2px);
          box-shadow: 0 8px 32px rgba(99,102,241,0.09);
        }
        .drop-zone.tracking-mode:hover {
          border-color: rgba(16,185,129,0.55);
          background: rgba(16,185,129,0.03);
          box-shadow: 0 8px 32px rgba(16,185,129,0.08);
        }
        .drop-zone:hover::before { opacity: 1; }

        .drop-zone:focus-visible {
          border-color: rgba(99,102,241,0.75);
          box-shadow: 0 0 0 3px rgba(99,102,241,0.2);
          background: rgba(99,102,241,0.03);
        }
        .drop-zone.tracking-mode:focus-visible {
          border-color: rgba(16,185,129,0.75);
          box-shadow: 0 0 0 3px rgba(16,185,129,0.18);
          background: rgba(16,185,129,0.03);
        }

        .drop-zone.dragging {
          border-color: #6366f1;
          border-style: solid;
          background: rgba(99,102,241,0.08);
          transform: scale(1.01);
          box-shadow: 0 12px 40px rgba(99,102,241,0.14);
        }
        .drop-zone.tracking-mode.dragging {
          border-color: #10b981;
          background: rgba(16,185,129,0.08);
          box-shadow: 0 12px 40px rgba(16,185,129,0.12);
        }

        .drop-zone.has-file {
          border-color: rgba(34,197,94,0.45);
          border-style: solid;
          background: rgba(34,197,94,0.03);
        }

        /* ── Upload icon ── */
        .upload-icon-wrapper {
          position: relative;
          width: 80px;
          height: 80px;
          margin: 0 auto 1.5rem;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .upload-icon-bg {
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.2));
          border-radius: 50%;
          animation: vu-float 3s ease-in-out infinite;
        }
        .tracking-mode .upload-icon-bg {
          background: linear-gradient(135deg, rgba(16,185,129,0.2), rgba(6,182,212,0.2));
        }

        @keyframes vu-float {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(-6px); }
        }

        .upload-svg {
          width: 40px;
          height: 40px;
          color: #a5b4fc;
          position: relative;
          z-index: 1;
        }
        .tracking-mode .upload-svg { color: #6ee7b7; }

        /* ── Drop zone text ── */
        .drop-zone h3 {
          color: #f1f5f9;
          font-size: 1.3rem;
          font-weight: 600;
          margin-bottom: 0.45rem;
          letter-spacing: -0.01em;
        }
        .muted {
          color: #94a3b8;
          font-size: 0.9rem;
          margin-bottom: 1.25rem;
        }

        /* ── Format pills ── */
        .formats {
          display: flex;
          gap: 0.45rem;
          justify-content: center;
          flex-wrap: wrap;
        }
        .format-pill {
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          color: #94a3b8;
          padding: 0.2rem 0.6rem;
          border-radius: 5px;
          font-size: 0.68rem;
          font-weight: 600;
          letter-spacing: 0.06em;
        }

        .hint { color: #64748b; font-size: 0.8rem; margin-top: 0.75rem; }

        /* ── File card (file selected state) ── */
        .file-card {
          display: flex;
          align-items: center;
          gap: 1rem;
          background: rgba(34,197,94,0.07);
          border: 1px solid rgba(34,197,94,0.18);
          padding: 1.1rem 1.4rem;
          border-radius: 14px;
          max-width: 460px;
          margin: 0 auto 0.5rem;
          text-align: left;
        }
        .file-icon {
          color: #4ade80;
          flex-shrink: 0;
          display: flex;
          align-items: center;
        }
        .file-info { flex: 1; min-width: 0; }
        .file-name {
          color: #f1f5f9;
          font-weight: 600;
          font-size: 0.92rem;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .file-size {
          color: #94a3b8;
          font-size: 0.82rem;
          margin-top: 0.18rem;
        }
        .file-check {
          width: 28px;
          height: 28px;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          border-radius: 50%;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          box-shadow: 0 3px 10px rgba(34,197,94,0.28);
        }

        /* ── Action buttons ── */
        .vu-actions {
          display: flex;
          gap: 0.75rem;
          justify-content: center;
          margin-top: 1.75rem;
        }

        .vu-btn-run {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          background: linear-gradient(135deg, #6366f1, #4f46e5);
          color: white;
          border: none;
          padding: 0.87rem 2rem;
          border-radius: 12px;
          font-size: 1rem;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          box-shadow: 0 4px 16px rgba(99,102,241,0.4);
          transition: opacity 0.18s, transform 0.15s, box-shadow 0.18s;
          letter-spacing: 0.01em;
        }
        .vu-btn-run:hover {
          opacity: 0.9;
          transform: translateY(-1px);
          box-shadow: 0 6px 24px rgba(99,102,241,0.52);
        }
        .vu-btn-run:focus-visible {
          outline: 2px solid rgba(165,180,252,0.85);
          outline-offset: 3px;
        }
        .vu-btn-run:active {
          transform: translateY(0);
          box-shadow: 0 3px 10px rgba(99,102,241,0.35);
        }

        .vu-btn-run-tracking {
          background: linear-gradient(135deg, #10b981, #059669);
          box-shadow: 0 4px 16px rgba(16,185,129,0.38);
        }
        .vu-btn-run-tracking:hover {
          box-shadow: 0 6px 24px rgba(16,185,129,0.5);
        }
        .vu-btn-run-tracking:focus-visible {
          outline-color: rgba(110,231,183,0.85);
        }
        .vu-btn-run-tracking:active {
          box-shadow: 0 3px 10px rgba(16,185,129,0.32);
        }

        .vu-btn-cancel {
          display: inline-flex;
          align-items: center;
          background: rgba(255,255,255,0.05);
          color: #94a3b8;
          border: 1px solid rgba(255,255,255,0.1);
          padding: 0.87rem 1.5rem;
          border-radius: 12px;
          font-size: 1rem;
          font-weight: 500;
          font-family: inherit;
          cursor: pointer;
          transition: background 0.18s, border-color 0.18s, color 0.18s;
        }
        .vu-btn-cancel:hover {
          background: rgba(255,255,255,0.09);
          border-color: rgba(255,255,255,0.16);
          color: #e2e8f0;
        }
        .vu-btn-cancel:focus-visible {
          outline: 2px solid rgba(99,102,241,0.6);
          outline-offset: 2px;
        }

        /* ── Upload progress ── */
        .upload-progress { margin-top: 1.75rem; }
        .progress-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 0.6rem;
          font-size: 0.9rem;
        }
        .progress-label { color: #cbd5e1; font-weight: 500; }
        .progress-percent {
          color: #a5b4fc;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
        }
        .progress-tracking { color: #6ee7b7; }

        .progress-bar-wrapper {
          background: rgba(255,255,255,0.05);
          border-radius: 999px;
          height: 6px;
          overflow: hidden;
        }
        .progress-bar-fill {
          background: linear-gradient(90deg, #6366f1, #8b5cf6);
          height: 100%;
          transition: width 0.3s ease;
          box-shadow: 0 0 10px rgba(99,102,241,0.5);
          border-radius: 999px;
        }
        .progress-bar-tracking {
          background: linear-gradient(90deg, #10b981, #06b6d4);
          box-shadow: 0 0 10px rgba(16,185,129,0.45);
        }

        /* ── Features grid ── */
        .features-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1rem;
          margin-top: 2.5rem;
          padding-top: 1.75rem;
          border-top: 1px solid rgba(255,255,255,0.06);
        }

        @media (max-width: 680px) {
          .features-grid { grid-template-columns: 1fr; gap: 0.75rem; }
        }

        .feature {
          background: rgba(255,255,255,0.025);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 14px;
          padding: 1.2rem 1.1rem;
          display: flex;
          flex-direction: column;
          gap: 0.65rem;
          transition: background 0.2s, border-color 0.2s;
        }
        .feature:hover {
          background: rgba(255,255,255,0.04);
          border-color: rgba(255,255,255,0.11);
        }

        .feature-icon {
          width: 40px;
          height: 40px;
          background: rgba(99,102,241,0.1);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          color: #a5b4fc;
          transition: background 0.2s;
        }
        .features-tracking .feature-icon {
          background: rgba(16,185,129,0.1);
          color: #6ee7b7;
        }
        .feature:hover .feature-icon {
          background: rgba(99,102,241,0.17);
        }
        .features-tracking .feature:hover .feature-icon {
          background: rgba(16,185,129,0.17);
        }

        .feature-text {
          display: flex;
          flex-direction: column;
          gap: 0.3rem;
        }
        .feature-text strong {
          color: #e2e8f0;
          font-size: 0.875rem;
          font-weight: 600;
        }
        .feature-text span {
          color: #64748b;
          font-size: 0.79rem;
          line-height: 1.55;
        }

        /* ── Responsive ── */
        @media (max-width: 540px) {
          .drop-zone        { padding: 2.75rem 1.25rem; }
          .drop-zone h3     { font-size: 1.15rem; }
          .upload-icon-wrapper { width: 68px; height: 68px; }
          .upload-svg       { width: 34px; height: 34px; }
          .vu-actions       { flex-direction: column; align-items: stretch; }
          .vu-btn-run, .vu-btn-cancel { justify-content: center; }
          .file-card        { padding: 0.9rem 1rem; }
          .vu-mode-hint     { font-size: 0.8rem; }
        }
      `}</style>
    </div>
  );
}

export default VideoUpload;
