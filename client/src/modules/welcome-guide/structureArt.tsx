/**
 * Mini-schémas line-art par structure de livret — même style que `FunnelArt` du Booking Engine (SVG inline,
 * `currentColor` = accent, opacités pour la hiérarchie). Bien plus explicites que des icônes génériques.
 *
 * viewBox 168×104. Rendu en `width/height: 100%` dans la vignette (`.fan__vig` / `.chip__art`).
 */

const SVG = {
  viewBox: '0 0 168 104',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  width: '100%',
  height: '100%',
  'aria-hidden': true,
};

/** L'Essentiel : wifi + 2 infos clés (arrivée / départ). */
function EssentielArt() {
  return (
    <svg {...SVG}>
      <path d="M74 66 Q84 56 94 66" />
      <path d="M66 58 Q84 40 102 58" />
      <path d="M58 50 Q84 28 110 50" />
      <circle cx="84" cy="71" r="2.6" fill="currentColor" stroke="none" />
      <rect x="40" y="84" width="38" height="10" rx="3" fill="currentColor" stroke="none" opacity="0.32" />
      <rect x="90" y="84" width="38" height="10" rx="3" fill="currentColor" stroke="none" opacity="0.32" />
    </svg>
  );
}

/** Complet : toutes les sections pré-remplies (liste dense). */
function CompletArt() {
  return (
    <svg {...SVG}>
      {[16, 38, 60, 82].map((y) => (
        <g key={y}>
          <rect x="20" y={y} width="10" height="10" rx="2" fill="currentColor" stroke="none" opacity="0.4" />
          <rect x="38" y={y} width="62" height="5" rx="2.5" fill="currentColor" stroke="none" opacity="0.7" />
          <rect x="38" y={y + 8} width="100" height="4" rx="2" fill="currentColor" stroke="none" opacity="0.28" />
        </g>
      ))}
    </svg>
  );
}

/** City Guide : carte du quartier + points d'intérêt. */
function CityGuideArt() {
  return (
    <svg {...SVG}>
      <rect x="16" y="12" width="136" height="62" rx="6" />
      <path d="M30 58 Q70 30 100 48 T142 30" opacity="0.4" />
      <path d="M58 28 a7 7 0 1 1 14 0 c0 6 -7 15 -7 15 c0 0 -7 -9 -7 -15 z" fill="currentColor" stroke="none" opacity="0.85" />
      <path d="M104 42 a6 6 0 1 1 12 0 c0 5 -6 13 -6 13 c0 0 -6 -8 -6 -13 z" fill="currentColor" stroke="none" opacity="0.5" />
      <rect x="40" y="85" width="88" height="8" rx="3" fill="currentColor" stroke="none" opacity="0.3" />
    </svg>
  );
}

/** Longue durée : calendrier + infos pratiques étendues. */
function LongueArt() {
  return (
    <svg {...SVG}>
      <rect x="20" y="18" width="64" height="56" rx="6" />
      <line x1="20" y1="32" x2="84" y2="32" />
      <line x1="34" y1="13" x2="34" y2="23" />
      <line x1="70" y1="13" x2="70" y2="23" />
      {[40, 52, 64].flatMap((y) => [30, 42, 54, 66].map((x) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="2.2" fill="currentColor" stroke="none" opacity="0.4" />
      )))}
      <rect x="100" y="26" width="50" height="6" rx="3" fill="currentColor" stroke="none" opacity="0.5" />
      <rect x="100" y="40" width="50" height="5" rx="2.5" fill="currentColor" stroke="none" opacity="0.3" />
      <rect x="100" y="52" width="38" height="5" rx="2.5" fill="currentColor" stroke="none" opacity="0.3" />
      <rect x="20" y="84" width="130" height="6" rx="3" fill="currentColor" stroke="none" opacity="0.24" />
    </svg>
  );
}

/** Conciergerie : cartes de services + prix (expériences payantes). */
function ConciergerieArt() {
  return (
    <svg {...SVG}>
      {[16, 44, 72].map((y) => (
        <g key={y}>
          <circle cx="30" cy={y + 9} r="7" opacity="0.7" />
          <rect x="44" y={y + 3} width="56" height="6" rx="3" fill="currentColor" stroke="none" opacity="0.6" />
          <rect x="44" y={y + 14} width="40" height="4" rx="2" fill="currentColor" stroke="none" opacity="0.3" />
          <rect x="120" y={y + 4} width="30" height="14" rx="7" fill="currentColor" stroke="none" opacity="0.85" />
        </g>
      ))}
    </svg>
  );
}

/** Schéma de structure par identifiant (repli sur « complet »). */
export function StructureArt({ id }: { id: string }) {
  switch (id) {
    case 'essentiel': return <EssentielArt />;
    case 'cityguide': return <CityGuideArt />;
    case 'longue': return <LongueArt />;
    case 'conciergerie': return <ConciergerieArt />;
    default: return <CompletArt />;
  }
}
