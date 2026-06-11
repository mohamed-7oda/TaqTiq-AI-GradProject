// frontend/src/components/VideoUpload.jsx
import React, { useState, useRef } from "react";
import axios from "axios";

function VideoUpload({ apiUrl, mode, token, onUploadStart, onUploadSuccess, onUploadError }) {
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
    formData.append("mode", mode || "events"); // ✅ send mode to backend

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

  // ---- Mode-specific UI text ----
  const ctaLabel = isTracking ? "Run Tracking" : "Detect Events";
  const headerSubtitle = isTracking
    ? "We'll track every player & ball, assign teams, and measure speed/distance."
    : "We'll detect goals, fouls, cards, corners and 13 other events with timestamps.";

  // Different feature cards per mode
  const features = isTracking
    ? [
        { icon: "🎯", title: "Full Player Tracking",   text: "Every player identified and tracked across the entire match with unique IDs." },
        { icon: "📏", title: "Speed & Distance Stats", text: "Real-time speed and total distance covered per player throughout the game." },
        { icon: "📊", title: "Possession Analysis",    text: "Automatic ball possession percentages calculated for each team." },
      ]
    : [
        { icon: "⚡", title: "17 Event Types",         text: "Goals, fouls, cards, corners, offsides, shots, free kicks and more — all detected automatically." },
        { icon: "🕐", title: "Precise Timestamps",     text: "Every event pinpointed to the exact second with confidence scores." },
        { icon: "👥", title: "Team Attribution",       text: "Each event automatically assigned to the correct team based on jersey colour analysis." },
      ];

  return (
    <div className="upload-container">
      <div className="mode-hint">{headerSubtitle}</div>

      <div
        className={`drop-zone ${file ? "has-file" : ""} ${isDragging ? "dragging" : ""} ${isTracking ? "tracking-mode" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
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
              <div className="upload-icon-bg"></div>
              <svg className="upload-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
            </div>
            <h3>Drop your video here</h3>
            <p className="muted">or click to browse from your device</p>
            <div className="formats">
              <span className="format-pill">MP4</span>
              <span className="format-pill">MKV</span>
              <span className="format-pill">AVI</span>
              <span className="format-pill">MOV</span>
              <span className="format-pill">WebM</span>
            </div>
            <p className="hint">Maximum file size: 2 GB</p>
          </>
        ) : (
          <>
            <div className="file-card">
              <div className="file-icon">🎬</div>
              <div className="file-info">
                <div className="file-name">{file.name}</div>
                <div className="file-size">{(file.size / (1024 * 1024)).toFixed(1)} MB</div>
              </div>
              <div className="file-check">✓</div>
            </div>
            <p className="hint">Click here to choose a different file</p>
          </>
        )}
      </div>

      {file && !uploading && (
        <div className="actions">
          <button className="btn-primary" onClick={handleUpload}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" />
              </svg>
              {ctaLabel}
            </span>
          </button>
          <button className="btn-secondary" onClick={() => setFile(null)}>
            Cancel
          </button>
        </div>
      )}

      {uploading && (
        <div className="upload-progress">
          <div className="progress-header">
            <span className="progress-label">Uploading</span>
            <span className="progress-percent">{uploadProgress}%</span>
          </div>
          <div className="progress-bar-wrapper">
            <div className="progress-bar-fill" style={{ width: `${uploadProgress}%` }} />
          </div>
        </div>
      )}

      <div className="features-grid">
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
        .upload-container { max-width: 720px; margin: 0 auto; }

        .mode-hint {
          text-align: center;
          color: #94a3b8;
          font-size: 0.95rem;
          margin-bottom: 1.5rem;
          padding: 0 1rem;
        }

        .drop-zone {
          position: relative;
          border: 2px dashed rgba(255, 255, 255, 0.15);
          border-radius: 20px;
          padding: 4rem 2rem;
          text-align: center;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          background: rgba(255, 255, 255, 0.02);
          overflow: hidden;
        }

        .drop-zone::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at center, rgba(59, 130, 246, 0.08), transparent 70%);
          opacity: 0;
          transition: opacity 0.3s;
        }

        .drop-zone.tracking-mode::before {
          background: radial-gradient(circle at center, rgba(236, 72, 153, 0.08), transparent 70%);
        }

        .drop-zone:hover {
          border-color: rgba(59, 130, 246, 0.5);
          background: rgba(59, 130, 246, 0.03);
          transform: translateY(-2px);
        }

        .drop-zone.tracking-mode:hover {
          border-color: rgba(236, 72, 153, 0.5);
          background: rgba(236, 72, 153, 0.03);
        }

        .drop-zone:hover::before { opacity: 1; }

        .drop-zone.dragging {
          border-color: #3b82f6;
          background: rgba(59, 130, 246, 0.08);
          transform: scale(1.01);
        }

        .drop-zone.tracking-mode.dragging {
          border-color: #ec4899;
          background: rgba(236, 72, 153, 0.08);
        }

        .drop-zone.has-file {
          border-color: rgba(34, 197, 94, 0.5);
          background: rgba(34, 197, 94, 0.04);
          border-style: solid;
        }

        .upload-icon-wrapper {
          position: relative;
          width: 88px;
          height: 88px;
          margin: 0 auto 1.5rem;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .upload-icon-bg {
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(139, 92, 246, 0.2));
          border-radius: 50%;
          animation: float 3s ease-in-out infinite;
        }

        .tracking-mode .upload-icon-bg {
          background: linear-gradient(135deg, rgba(236, 72, 153, 0.2), rgba(139, 92, 246, 0.2));
        }

        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }

        .upload-svg {
          width: 44px;
          height: 44px;
          color: #93c5fd;
          position: relative;
          z-index: 1;
        }

        .tracking-mode .upload-svg { color: #f9a8d4; }

        .drop-zone h3 {
          color: #f1f5f9;
          font-size: 1.4rem;
          font-weight: 600;
          margin-bottom: 0.5rem;
          letter-spacing: -0.01em;
        }

        .muted {
          color: #94a3b8;
          font-size: 0.95rem;
          margin-bottom: 1.25rem;
        }

        .formats {
          display: flex;
          gap: 0.5rem;
          justify-content: center;
          flex-wrap: wrap;
          margin-bottom: 1rem;
        }

        .format-pill {
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #cbd5e1;
          padding: 0.25rem 0.7rem;
          border-radius: 6px;
          font-size: 0.7rem;
          font-weight: 600;
          letter-spacing: 0.05em;
        }

        .hint { color: #64748b; font-size: 0.8rem; }

        .file-card {
          display: flex;
          align-items: center;
          gap: 1rem;
          background: rgba(34, 197, 94, 0.08);
          border: 1px solid rgba(34, 197, 94, 0.2);
          padding: 1.25rem 1.5rem;
          border-radius: 14px;
          max-width: 480px;
          margin: 0 auto 1rem;
          text-align: left;
        }

        .file-icon { font-size: 2.2rem; }
        .file-info { flex: 1; min-width: 0; }

        .file-name {
          color: #f1f5f9;
          font-weight: 600;
          font-size: 0.95rem;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .file-size {
          color: #94a3b8;
          font-size: 0.85rem;
          margin-top: 0.2rem;
        }

        .file-check {
          width: 32px;
          height: 32px;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          border-radius: 50%;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 1.1rem;
          box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3);
        }

        .actions {
          display: flex;
          gap: 0.75rem;
          justify-content: center;
          margin-top: 2rem;
        }

        .btn-primary {
          background: linear-gradient(135deg, #3b82f6, #8b5cf6);
          color: white;
          border: none;
          padding: 0.85rem 2rem;
          border-radius: 12px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          box-shadow: 0 4px 14px rgba(59, 130, 246, 0.35);
          transition: all 0.2s;
        }

        .tracking-mode ~ .actions .btn-primary,
        .actions .btn-primary.tracking {
          background: linear-gradient(135deg, #ec4899, #8b5cf6);
          box-shadow: 0 4px 14px rgba(236, 72, 153, 0.35);
        }

        .btn-primary:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(59, 130, 246, 0.5);
        }

        .btn-secondary {
          background: rgba(255, 255, 255, 0.05);
          color: #cbd5e1;
          border: 1px solid rgba(255, 255, 255, 0.1);
          padding: 0.85rem 1.5rem;
          border-radius: 12px;
          font-size: 1rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-secondary:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        .upload-progress { margin-top: 2rem; }

        .progress-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 0.6rem;
          font-size: 0.9rem;
        }

        .progress-label { color: #cbd5e1; font-weight: 500; }

        .progress-percent {
          color: #60a5fa;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
        }

        .progress-bar-wrapper {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 999px;
          height: 6px;
          overflow: hidden;
          position: relative;
        }

        .progress-bar-fill {
          background: linear-gradient(90deg, #3b82f6, #8b5cf6);
          height: 100%;
          transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 0 12px rgba(59, 130, 246, 0.6);
          border-radius: 999px;
        }

        .features-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1rem;
          margin-top: 2.5rem;
          padding-top: 2rem;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
        }

        @media (max-width: 600px) {
          .features-grid { grid-template-columns: 1fr; }
        }

        .feature {
          background: rgba(255, 255, 255, 0.025);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 14px;
          padding: 1.2rem 1.1rem;
          display: flex;
          flex-direction: column;
          gap: 0.65rem;
          transition: background 0.2s, border-color 0.2s;
        }

        .feature:hover {
          background: rgba(255, 255, 255, 0.04);
          border-color: rgba(255, 255, 255, 0.1);
        }

        .feature-icon {
          font-size: 1.6rem;
          width: 44px;
          height: 44px;
          background: rgba(59, 130, 246, 0.1);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .feature-text {
          display: flex;
          flex-direction: column;
          gap: 0.3rem;
        }

        .feature-text strong {
          color: #e2e8f0;
          font-size: 0.88rem;
          font-weight: 600;
        }

        .feature-text span {
          color: #64748b;
          font-size: 0.79rem;
          line-height: 1.5;
        }
      `}</style>
    </div>
  );
}

export default VideoUpload;