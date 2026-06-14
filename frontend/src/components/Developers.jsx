import React from "react";

const TEAM = [
  {
    name:     "Mohamed Mahmoud Emam",
    role:     "AI & Backend Engineer",
    email:    "mohamedmahmoudemam23@gmail.com",
    linkedin: "https://www.linkedin.com/in/mohamed-mahmoud-emam/",
    gradient: "135deg, #3b82f6, #8b5cf6",
  },
  {
    name:     "Mohamed Ahmed Bekheet",
    role:     "Auth & Team Attribution",
    email:    "mohammedahmed1234qwe@gmail.com",
    linkedin: "https://www.linkedin.com/in/mohamed-bekheet-b00b51264",
    gradient: "135deg, #06b6d4, #3b82f6",
  },
  {
    name:     "Mostafa Mahmoud Mohamed",
    role:     "Highlights & Deployment",
    email:    "mostafamadam33@gmail.com",
    linkedin: "https://www.linkedin.com/in/mostafa-adam-1187682b3/",
    gradient: "135deg, #8b5cf6, #ec4899",
  },
  {
    name:     "Saif Aboshanab",
    role:     "Tracking & Analytics",
    email:    "saifabushanab.sa@gmail.com",
    linkedin: "https://www.linkedin.com/in/saif-abushanab-258854283/",
    gradient: "135deg, #10b981, #3b82f6",
  },
];

function initials(name) {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

function DevCard({ dev }) {
  return (
    <div className="dev-card">
      <div className="dev-avatar" style={{ background: `linear-gradient(${dev.gradient})` }}>
        {initials(dev.name)}
      </div>

      <div className="dev-info">
        <h3 className="dev-name">{dev.name}</h3>
      </div>

      <div className="dev-links">
        <a
          href={`https://mail.google.com/mail/?view=cm&to=${dev.email}`}
          target="_blank"
          rel="noopener noreferrer"
          className="dev-btn dev-btn-email"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2"/>
            <path d="M2 7l10 7 10-7"/>
          </svg>
          Email
        </a>
        <a href={dev.linkedin} target="_blank" rel="noopener noreferrer"
          className="dev-btn dev-btn-linkedin">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/>
            <rect x="2" y="9" width="4" height="12"/>
            <circle cx="4" cy="4" r="2"/>
          </svg>
          LinkedIn
        </a>
      </div>
    </div>
  );
}

export default function Developers() {
  return (
    <div className="dev-wrap">
      <div className="dev-grid">
        {TEAM.map((dev) => (
          <DevCard key={dev.email} dev={dev} />
        ))}
      </div>

      <style>{`
        .dev-wrap {
          max-width: 840px;
          margin: 0 auto;
          padding-bottom: 3rem;
        }

        .dev-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 1rem;
        }

        @media (max-width: 480px) {
          .dev-grid { grid-template-columns: 1fr; gap: 0.85rem; }
          .dev-wrap { padding-bottom: 2rem; }
        }

        .dev-card {
          background: rgba(255,255,255,0.025);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 20px;
          padding: 1.75rem 1.75rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          transition: border-color 0.2s, transform 0.2s, background 0.2s, box-shadow 0.2s;
          position: relative;
          overflow: hidden;
        }

        .dev-card::after {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(99,102,241,0.45), transparent);
          opacity: 0;
          transition: opacity 0.2s;
        }

        .dev-card:hover {
          border-color: rgba(99,102,241,0.28);
          background: rgba(99,102,241,0.035);
          transform: translateY(-2px);
          box-shadow: 0 8px 30px rgba(99,102,241,0.09);
        }
        .dev-card:hover::after { opacity: 1; }

        .dev-avatar {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          border: 2px solid rgba(255,255,255,0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.55rem;
          font-weight: 700;
          color: #fff;
          letter-spacing: -0.02em;
          box-shadow: 0 4px 20px rgba(0,0,0,0.4);
          flex-shrink: 0;
          margin-bottom: 1rem;
        }

        .dev-info { display: flex; flex-direction: column; }

        .dev-name {
          color: #f1f5f9;
          font-size: 1rem;
          font-weight: 600;
          margin: 0;
          line-height: 1.35;
          letter-spacing: -0.01em;
          font-family: 'Space Grotesk', sans-serif;
          overflow-wrap: break-word;
          word-break: break-word;
        }

        .dev-links {
          display: flex;
          gap: 0.5rem;
          width: 100%;
          margin-top: 1.1rem;
        }

        .dev-btn {
          flex: 1;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.38rem;
          padding: 0.56rem 0.75rem;
          border-radius: 9px;
          font-size: 0.8rem;
          font-weight: 500;
          text-decoration: none;
          transition: background 0.18s, border-color 0.18s, color 0.18s, transform 0.15s;
          min-height: 36px;
        }

        .dev-btn:hover { transform: translateY(-1px); }

        .dev-btn:focus-visible {
          outline: 2px solid rgba(99,102,241,0.65);
          outline-offset: 2px;
          border-radius: 9px;
        }

        .dev-btn-email {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          color: #94a3b8;
        }
        .dev-btn-email:hover {
          background: rgba(255,255,255,0.08);
          border-color: rgba(255,255,255,0.16);
          color: #cbd5e1;
        }

        .dev-btn-linkedin {
          background: rgba(10,102,194,0.12);
          border: 1px solid rgba(59,130,246,0.24);
          color: #7eb8f7;
        }
        .dev-btn-linkedin:hover {
          background: rgba(10,102,194,0.22);
          border-color: rgba(59,130,246,0.38);
          color: #93c5fd;
        }
      `}</style>
    </div>
  );
}
