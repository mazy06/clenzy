import React, { useId } from 'react';

interface SmartLockAnimationProps {
  /** Taille en pixels (hauteur du SVG) */
  size?: number;
  /** Active les animations (poignee, WiFi, LED) */
  animated?: boolean;
}

const SmartLockAnimation: React.FC<SmartLockAnimationProps> = ({
  size = 120,
  animated = true,
}) => {
  // IDs uniques pour eviter les conflits quand plusieurs instances coexistent
  const uid = useId().replace(/:/g, '');
  const leverGradId = `leverGrad-${uid}`;
  const knobGradId = `knobGrad-${uid}`;
  const rosetteGradId = `rosetteGrad-${uid}`;
  const animClass = `smart-lock-${uid}`;

  // Ratio width/height du viewBox (260/420)
  const width = Math.round(size * (260 / 420));

  return (
    <>
      <style>{`
        .${animClass} .handle-group {
          transform-origin: 100px 230px;
          ${animated ? 'animation: slHandleUnlock 3.5s cubic-bezier(0.34, 1.56, 0.64, 1) infinite;' : ''}
        }
        .${animClass} .led {
          ${animated ? 'animation: slLedShift 3.5s ease-in-out infinite;' : 'fill: #4CAF50; filter: drop-shadow(0 0 4px rgba(76, 175, 80, 0.7));'}
        }
        .${animClass} .wifi-arc-1 {
          ${animated ? 'animation: slWifiPulse 2s ease-in-out infinite; animation-delay: 0s;' : ''}
        }
        .${animClass} .wifi-arc-2 {
          ${animated ? 'animation: slWifiPulse 2s ease-in-out infinite; animation-delay: 0.3s;' : ''}
        }
        .${animClass} .wifi-arc-3 {
          ${animated ? 'animation: slWifiPulse 2s ease-in-out infinite; animation-delay: 0.6s;' : ''}
        }
        ${animated ? `.${animClass} { animation: slBodyGlow 3.5s ease-in-out infinite; }` : ''}

        @keyframes slHandleUnlock {
          0%, 100% { transform: rotate(0deg); }
          35%, 65% { transform: rotate(35deg); }
        }
        @keyframes slWifiPulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
        @keyframes slLedShift {
          0%, 25% { fill: #4CAF50; filter: drop-shadow(0 0 4px rgba(76, 175, 80, 0.7)); }
          35%, 65% { fill: #FF9800; filter: drop-shadow(0 0 6px rgba(255, 152, 0, 0.8)); }
          75%, 100% { fill: #4CAF50; filter: drop-shadow(0 0 4px rgba(76, 175, 80, 0.7)); }
        }
        @keyframes slBodyGlow {
          0%, 25% { filter: drop-shadow(0 4px 12px rgba(84, 115, 130, 0.2)); }
          35%, 65% { filter: drop-shadow(0 4px 20px rgba(212, 165, 84, 0.35)); }
          75%, 100% { filter: drop-shadow(0 4px 12px rgba(84, 115, 130, 0.2)); }
        }
      `}</style>

      <svg
        className={animClass}
        width={width}
        height={size}
        viewBox="0 0 260 420"
        style={{ display: 'block' }}
      >
        <defs>
          <linearGradient id={leverGradId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#E8C06A" />
            <stop offset="35%" stopColor="#D4A554" />
            <stop offset="70%" stopColor="#B8923E" />
            <stop offset="100%" stopColor="#9A7A32" />
          </linearGradient>
          <radialGradient id={knobGradId} cx="40%" cy="35%">
            <stop offset="0%" stopColor="#EDCC7A" />
            <stop offset="50%" stopColor="#D4A554" />
            <stop offset="100%" stopColor="#9A7A32" />
          </radialGradient>
          <radialGradient id={rosetteGradId} cx="45%" cy="40%">
            <stop offset="0%" stopColor="#6A8D9B" />
            <stop offset="100%" stopColor="#3D5A66" />
          </radialGradient>
        </defs>

        {/* Corps principal */}
        <rect x="25" y="30" width="150" height="370" rx="16" ry="16" fill="#547382" />
        <rect x="30" y="35" width="140" height="360" rx="13" ry="13" fill="#5f8190" />

        {/* Facade doree */}
        <rect x="40" y="50" width="120" height="320" rx="10" ry="10" fill="#D4A554" />
        <rect x="45" y="55" width="50" height="100" rx="8" ry="8" fill="rgba(255,255,255,0.12)" />

        {/* 4 Vis */}
        <circle cx="50" cy="60" r="5" fill="#496673" stroke="#3d5a66" strokeWidth="1" />
        <line x1="47" y1="60" x2="53" y2="60" stroke="#3d5a66" strokeWidth="1.2" />
        <circle cx="150" cy="60" r="5" fill="#496673" stroke="#3d5a66" strokeWidth="1" />
        <line x1="147" y1="60" x2="153" y2="60" stroke="#3d5a66" strokeWidth="1.2" />
        <circle cx="50" cy="360" r="5" fill="#496673" stroke="#3d5a66" strokeWidth="1" />
        <line x1="47" y1="360" x2="53" y2="360" stroke="#3d5a66" strokeWidth="1.2" />
        <circle cx="150" cy="360" r="5" fill="#496673" stroke="#3d5a66" strokeWidth="1" />
        <line x1="147" y1="360" x2="153" y2="360" stroke="#3d5a66" strokeWidth="1.2" />

        {/* Ecran */}
        <rect x="58" y="95" width="84" height="55" rx="6" ry="6" fill="rgba(255,255,255,0.2)" />
        <rect x="62" y="99" width="76" height="47" rx="4" ry="4" fill="#3d5a66" />

        {/* WiFi */}
        <g transform="translate(100, 132)">
          <circle cx="0" cy="0" r="3" fill="#D4A554" />
          <path className="wifi-arc-1" d="M-8,-7 a11,11 0 0,1 16,0" fill="none" stroke="#D4A554" strokeWidth="2" strokeLinecap="round" />
          <path className="wifi-arc-2" d="M-14,-12 a19,19 0 0,1 28,0" fill="none" stroke="#D4A554" strokeWidth="2" strokeLinecap="round" />
          <path className="wifi-arc-3" d="M-20,-17 a27,27 0 0,1 40,0" fill="none" stroke="#D4A554" strokeWidth="2" strokeLinecap="round" />
        </g>

        {/* LED */}
        <circle className="led" cx="100" cy="170" r="5" />

        {/* Trou de serrure */}
        <g>
          <circle cx="100" cy="305" r="10" fill="rgba(0,0,0,0.15)" />
          <path d="M96,310 L92,325 Q100,328 108,325 L104,310 Z" fill="rgba(0,0,0,0.15)" />
          <circle cx="100" cy="305" r="8" fill="#3D5A66" />
          <path d="M96,309 L93,323 Q100,326 107,323 L104,309 Z" fill="#3D5A66" />
          <circle cx="100" cy="305" r="5" fill="#2A4A55" />
          <path d="M97,308 L95,320 Q100,322 105,320 L103,308 Z" fill="#2A4A55" />
          <path d="M97,302 a4,4 0 0,1 6,0" fill="rgba(255,255,255,0.15)" />
        </g>

        {/* Poignee animee */}
        <g className="handle-group">
          <ellipse cx="170" cy="248" rx="75" ry="9" fill="rgba(0,0,0,0.18)" />

          <circle cx="100" cy="230" r="30" fill="#3D5A66" />
          <circle cx="100" cy="230" r="26" fill={`url(#${rosetteGradId})`} stroke="#3D5A66" strokeWidth="2" />
          <circle cx="100" cy="230" r="20" fill="#5f8190" />
          <circle cx="100" cy="230" r="20" fill="none" stroke="#D4A554" strokeWidth="2" opacity="0.6" />

          <rect x="94" y="213" width="140" height="34" rx="17" fill="#9A7A32" />
          <rect x="94" y="213" width="140" height="32" rx="16" fill={`url(#${leverGradId})`} />
          <rect x="116" y="216" width="96" height="8" rx="4" fill="rgba(255,255,255,0.3)" />
          <rect x="116" y="239" width="96" height="4" rx="2" fill="rgba(0,0,0,0.12)" />

          <circle cx="230" cy="230" r="22" fill="#9A7A32" />
          <circle cx="230" cy="230" r="20" fill={`url(#${knobGradId})`} />
          <circle cx="230" cy="230" r="12" fill="#D4A554" />
          <circle cx="230" cy="230" r="5" fill="rgba(255,255,255,0.28)" />

          <circle cx="100" cy="230" r="12" fill="#D4A554" stroke="#9A7A32" strokeWidth="2" />
          <circle cx="100" cy="230" r="6" fill="#E8C06A" />
          <circle cx="100" cy="230" r="2.5" fill="rgba(255,255,255,0.35)" />
        </g>
      </svg>
    </>
  );
};

export default SmartLockAnimation;
