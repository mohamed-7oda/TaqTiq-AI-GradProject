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
    name:     "Mostafa Mohamed Mahmoud",
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

export default function Developers() {
  return (
    <div className="dev-wrap">
      <div className="dev-grid">
        {TEAM.map((dev) => (
          <div key={dev.email} className="dev-card">
            <div className="dev-avatar" style={{ background: `linear-gradient(${dev.gradient})` }}>
              {initials(dev.name)}
            </div>

            <div className="dev-info">
              <h3 className="dev-name">{dev.name}</h3>
              <p  className="dev-role">{dev.role}</p>
            </div>

            <div className="dev-links">
              <a href={`mailto:${dev.email}`} className="dev-btn dev-btn-email" title={dev.email}>
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
        ))}
      </div>

      <style>{`
        .dev-wrap {
          max-width: 900px;
          margin: 0 auto;
          padding-bottom: 3rem;
        }

        .dev-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 1.25rem;
        }

        .dev-card {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 20px;
          padding: 2rem 1.75rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 1rem;
          transition: border-color 0.2s, transform 0.2s, background 0.2s;
        }
        .dev-card:hover {
          border-color: rgba(59,130,246,0.35);
          background: rgba(59,130,246,0.04);
          transform: translateY(-3px);
        }

        .dev-avatar {
          width: 72px;
          height: 72px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.5rem;
          font-weight: 700;
          color: #fff;
          letter-spacing: -0.02em;
          box-shadow: 0 4px 20px rgba(0,0,0,0.3);
          flex-shrink: 0;
        }

        .dev-info { display: flex; flex-direction: column; gap: 0.3rem; }

        .dev-name {
          color: #f1f5f9;
          font-size: 1rem;
          font-weight: 600;
          margin: 0;
          line-height: 1.3;
        }

        .dev-role {
          color: #64748b;
          font-size: 0.82rem;
          margin: 0;
        }

        .dev-links {
          display: flex;
          gap: 0.6rem;
          flex-wrap: wrap;
          justify-content: center;
          margin-top: 0.25rem;
        }

        .dev-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.5rem 1rem;
          border-radius: 8px;
          font-size: 0.82rem;
          font-weight: 500;
          text-decoration: none;
          transition: opacity 0.2s, transform 0.15s;
        }
        .dev-btn:hover { opacity: 0.85; transform: translateY(-1px); }

        .dev-btn-email {
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          color: #cbd5e1;
        }

        .dev-btn-linkedin {
          background: rgba(10,102,194,0.15);
          border: 1px solid rgba(10,102,194,0.3);
          color: #60a5fa;
        }
      `}</style>
    </div>
  );
}
