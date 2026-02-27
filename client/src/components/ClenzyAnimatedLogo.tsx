import React, { useEffect, useState } from 'react';

interface ClenzyAnimatedLogoProps {
  scale?: number;
}

const ClenzyAnimatedLogo: React.FC<ClenzyAnimatedLogoProps> = ({ scale = 1 }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const m = mounted ? 'mounted' : '';

  return (
    <>
      <style>{`
        .clenzy-anim .drop-icon {
          opacity: 0;
          transform: translateY(-30px);
          transition: opacity 0.6s ease-out, transform 0.6s ease-out;
        }
        .clenzy-anim.mounted .drop-icon {
          opacity: 1;
          transform: translateY(0);
        }

        .clenzy-anim .sparkle {
          opacity: 0;
          transform: scale(0) rotate(0deg);
          transition: opacity 0.5s ease-out, transform 0.5s ease-out;
        }
        .clenzy-anim.mounted .sparkle-1 {
          opacity: 1; transform: scale(1) rotate(180deg);
          transition-delay: 0.7s;
          animation: clenzySparkle 1.5s ease-in-out 1.2s infinite;
        }
        .clenzy-anim.mounted .sparkle-2 {
          opacity: 1; transform: scale(1) rotate(180deg);
          transition-delay: 0.9s;
          animation: clenzySparkle 1.8s ease-in-out 1.4s infinite;
        }
        .clenzy-anim.mounted .sparkle-3 {
          opacity: 1; transform: scale(1) rotate(180deg);
          transition-delay: 1.1s;
          animation: clenzySparkle 2s ease-in-out 1.6s infinite;
        }
        @keyframes clenzySparkle {
          0%, 100% { opacity: 1; transform: scale(1) rotate(180deg); }
          50% { opacity: 0.4; transform: scale(0.5) rotate(270deg); }
        }

        .clenzy-anim .letter {
          opacity: 0;
          transform: translateY(20px) scaleY(0.4);
          filter: blur(6px);
          display: inline-block;
          background: linear-gradient(90deg, #3D6B7A, #5B8FA0, #89BCC9);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          transition: opacity 0.45s cubic-bezier(0.22, 1, 0.36, 1),
                      transform 0.45s cubic-bezier(0.22, 1, 0.36, 1),
                      filter 0.45s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .clenzy-anim.mounted .letter {
          opacity: 1; transform: translateY(0) scaleY(1); filter: blur(0px);
        }
        .clenzy-anim.mounted .letter-0 { transition-delay: 0.3s; }
        .clenzy-anim.mounted .letter-1 { transition-delay: 0.38s; }
        .clenzy-anim.mounted .letter-2 { transition-delay: 0.46s; }
        .clenzy-anim.mounted .letter-3 { transition-delay: 0.54s; }
        .clenzy-anim.mounted .letter-4 { transition-delay: 0.62s; }
        .clenzy-anim.mounted .letter-5 { transition-delay: 0.70s; }

        .clenzy-anim .golden-line {
          width: 0;
          height: 2px;
          border-radius: 2px;
          background: linear-gradient(90deg, #C8924A, #D4A65A, transparent);
          box-shadow: 0 0 6px rgba(200, 146, 74, 0.25);
          transition: width 0.6s ease-out;
        }
        .clenzy-anim.mounted .golden-line {
          width: 100%;
          transition-delay: 0.9s;
        }

        .clenzy-anim .subtitle-text {
          opacity: 0;
          transform: translateY(6px);
          transition: opacity 0.5s ease-out, transform 0.5s ease-out;
        }
        .clenzy-anim.mounted .subtitle-text {
          opacity: 1; transform: translateY(0);
          transition-delay: 1.2s;
        }

        .clenzy-anim .shine-overlay { opacity: 0; }
        .clenzy-anim.mounted .shine-overlay {
          opacity: 1;
          transition: opacity 0.1s ease 1.5s;
        }
        .clenzy-anim .shine-overlay::after {
          content: '';
          position: absolute;
          top: 0; left: -80%;
          width: 50%; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent);
          transform: skewX(-20deg);
          animation: clenzyShine 2.8s ease-in-out 1.5s infinite;
        }
        @keyframes clenzyShine {
          0% { left: -80%; }
          100% { left: 180%; }
        }

        .clenzy-anim .dot {
          opacity: 0; transform: scale(0);
          transition: opacity 0.3s ease-out, transform 0.3s ease-out;
        }
        .clenzy-anim.mounted .dot-0 { opacity: 0.6; transform: scale(1); transition-delay: 1.4s; }
        .clenzy-anim.mounted .dot-1 { opacity: 0.6; transform: scale(1); transition-delay: 1.5s; }
        .clenzy-anim.mounted .dot-2 { opacity: 0.6; transform: scale(1); transition-delay: 1.6s; }
      `}</style>

      <div
        className={`clenzy-anim ${m}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12 * scale,
          userSelect: 'none',
          justifyContent: 'center',
        }}
      >
        {/* Goutte + étincelles */}
        <div style={{ position: 'relative', flexShrink: 0, width: 28 * scale, height: 38 * scale }}>
          <svg
            className="drop-icon"
            viewBox="0 0 70 95"
            style={{ width: '100%', height: '100%', filter: 'drop-shadow(0 2px 6px rgba(74,124,142,0.25))' }}
          >
            <defs>
              <linearGradient id="clenzyDropGrad" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#3D6B7A" />
                <stop offset="100%" stopColor="#6DA3B4" />
              </linearGradient>
            </defs>
            <path
              d="M35 3 C35 3, 5 45, 5 62 C5 80, 18 92, 35 92 C52 92, 65 80, 65 62 C65 45, 35 3, 35 3 Z"
              fill="url(#clenzyDropGrad)"
            />
            <path
              d="M24 48 C24 48, 16 64, 19 73 C20 77, 24 79, 27 76 C30 71, 24 48, 24 48 Z"
              fill="white"
              opacity="0.3"
            />
          </svg>

          <svg className="sparkle sparkle-1" style={{ position: 'absolute', top: -3 * scale, right: -6 * scale, width: 10 * scale, height: 10 * scale }} viewBox="0 0 24 24">
            <path d="M12 2 L14 9 L21 12 L14 15 L12 22 L10 15 L3 12 L10 9 Z" fill="#C8924A" />
          </svg>
          <svg className="sparkle sparkle-2" style={{ position: 'absolute', bottom: 3 * scale, right: -7 * scale, width: 7 * scale, height: 7 * scale }} viewBox="0 0 24 24">
            <path d="M12 2 L14 9 L21 12 L14 15 L12 22 L10 15 L3 12 L10 9 Z" fill="#D4A65A" />
          </svg>
          <svg className="sparkle sparkle-3" style={{ position: 'absolute', top: -5 * scale, left: 1 * scale, width: 5 * scale, height: 5 * scale }} viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="6" fill="#C8924A" />
          </svg>
        </div>

        {/* Texte + ligne + sous-titre */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ position: 'relative', lineHeight: 1 }}>
            <span style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 700, letterSpacing: '0.05em', fontSize: 38 * scale }}>
              {'Clenzy'.split('').map((char, i) => (
                <span key={i} className={`letter letter-${i}`}>{char}</span>
              ))}
            </span>
            <div className="shine-overlay" style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }} />
          </div>

          <div className="golden-line" style={{ marginTop: 2 * scale }} />

          <span
            className="subtitle-text"
            style={{
              fontSize: 8 * scale,
              fontWeight: 600,
              letterSpacing: 3 * scale,
              marginTop: 4 * scale,
              color: '#4A7C8E',
            }}
          >
            PROPRETÉ & MULTISERVICES
          </span>

          <div style={{ display: 'flex', gap: 6 * scale, marginTop: 4 * scale }}>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className={`dot dot-${i}`}
                style={{
                  display: 'block',
                  width: 4 * scale,
                  height: 4 * scale,
                  borderRadius: '50%',
                  backgroundColor: '#C8924A',
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default ClenzyAnimatedLogo;
