/**
 * Mini-maquettes (schémas line-art) par funnel — style « aperçu » à la Claude Design, bien plus
 * explicites que des icônes génériques. Couleur = `currentColor` (l'accent indigo via `.fan__vig`),
 * opacités pour la hiérarchie. Aucune dépendance externe (SVG inline, sur-mesure, on-brand).
 *
 * viewBox 168×104 (paysage, marge interne ~14px). Rendu en `width/height: 100%` dans la vignette.
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

/** Recherche catalogue : barre de recherche + grille de logements (2×2). */
function CatalogueArt() {
  const cells: Array<[number, number]> = [[16, 38], [90, 38], [16, 70], [90, 70]];
  return (
    <svg {...SVG}>
      <rect x="16" y="12" width="136" height="16" rx="8" />
      <circle cx="138" cy="20" r="3.2" />
      <line x1="140.4" y1="22.4" x2="143.6" y2="25.6" />
      {cells.map(([x, y], i) => (
        <g key={i}>
          <rect x={x} y={y} width="62" height="26" rx="4" />
          <rect x={x + 5} y={y + 5} width="34" height="9" rx="2" fill="currentColor" stroke="none" opacity="0.35" />
          <line x1={x + 5} y1={y + 20} x2={x + 42} y2={y + 20} opacity="0.5" />
        </g>
      ))}
    </svg>
  );
}

/** Logement unique : grande photo + titre + texte + bouton (une seule fiche détaillée). */
function SingleArt() {
  return (
    <svg {...SVG}>
      <rect x="16" y="12" width="136" height="46" rx="6" fill="currentColor" stroke="none" opacity="0.22" />
      <rect x="16" y="12" width="136" height="46" rx="6" />
      <rect x="16" y="66" width="92" height="7" rx="3.5" fill="currentColor" stroke="none" opacity="0.6" />
      <line x1="16" y1="80" x2="128" y2="80" opacity="0.4" />
      <rect x="16" y="86" width="48" height="12" rx="6" fill="currentColor" stroke="none" opacity="0.85" />
    </svg>
  );
}

/** Demande de devis : formulaire (lignes) + avion en papier (envoi), sans paiement. */
function InquiryArt() {
  return (
    <svg {...SVG}>
      <rect x="22" y="12" width="84" height="80" rx="6" />
      {[26, 40, 54].map((y) => (
        <rect key={y} x="32" y={y} width="64" height="8" rx="3" fill="currentColor" stroke="none" opacity="0.35" />
      ))}
      <rect x="32" y="70" width="40" height="10" rx="5" fill="currentColor" stroke="none" opacity="0.85" />
      <path d="M118 76 L150 60 L138 92 L132 78 Z" fill="currentColor" stroke="none" opacity="0.9" />
      <line x1="118" y1="76" x2="138" y2="78" opacity="0.5" />
    </svg>
  );
}

/** Séjour + extras : items du panier + options « + » (upsell). */
function ExtrasArt() {
  return (
    <svg {...SVG}>
      {[18, 46].map((y) => (
        <g key={y}>
          <rect x="16" y={y} width="92" height="22" rx="4" />
          <rect x="22" y={y + 6} width="14" height="10" rx="2" fill="currentColor" stroke="none" opacity="0.4" />
          <line x1="44" y1={y + 11} x2="98" y2={y + 11} opacity="0.5" />
        </g>
      ))}
      {[18, 46].map((y) => (
        <g key={`a${y}`}>
          <rect x="120" y={y} width="32" height="22" rx="6" fill="currentColor" stroke="none" opacity="0.16" />
          <rect x="120" y={y} width="32" height="22" rx="6" />
          <line x1="136" y1={y + 6} x2="136" y2={y + 16} />
          <line x1="131" y1={y + 11} x2="141" y2={y + 11} />
        </g>
      ))}
      <line x1="16" y1="82" x2="152" y2="82" opacity="0.4" />
    </svg>
  );
}

/** Réservation express : un seul écran compact (2 champs + bouton) + éclair (rapide). */
function ExpressArt() {
  return (
    <svg {...SVG}>
      <rect x="44" y="10" width="80" height="84" rx="8" />
      {[24, 42].map((y) => (
        <rect key={y} x="54" y={y} width="60" height="11" rx="3" fill="currentColor" stroke="none" opacity="0.3" />
      ))}
      <rect x="54" y="64" width="60" height="14" rx="7" fill="currentColor" stroke="none" opacity="0.85" />
      <path d="M120 6 L110 26 L119 26 L112 44 L132 20 L122 20 Z" fill="currentColor" stroke="none" opacity="0.95" />
    </svg>
  );
}

/** Panier multi-séjours : plusieurs réservations empilées + total. */
function CartArt() {
  return (
    <svg {...SVG}>
      {[12, 38, 64].map((y) => (
        <g key={y}>
          <rect x="16" y={y} width="104" height="20" rx="4" />
          <rect x="21" y={y + 5} width="14" height="10" rx="2" fill="currentColor" stroke="none" opacity="0.4" />
          <line x1="43" y1={y + 10} x2="110" y2={y + 10} opacity="0.5" />
        </g>
      ))}
      <rect x="128" y="64" width="24" height="20" rx="4" fill="currentColor" stroke="none" opacity="0.9" />
      <line x1="16" y1="94" x2="152" y2="94" opacity="0.35" />
    </svg>
  );
}

/** Page de confirmation : pastille validée + récapitulatif. */
function ConfirmArt() {
  return (
    <svg {...SVG}>
      <circle cx="84" cy="34" r="18" />
      <path d="M76 34 L82 40 L93 27" />
      <rect x="44" y="62" width="80" height="8" rx="4" fill="currentColor" stroke="none" opacity="0.5" />
      <rect x="58" y="78" width="52" height="7" rx="3.5" fill="currentColor" stroke="none" opacity="0.3" />
    </svg>
  );
}

/** Schéma du funnel par identifiant (repli sur « catalogue »). */
export function FunnelArt({ id }: { id: string }) {
  switch (id) {
    case 'single': return <SingleArt />;
    case 'inquiry': return <InquiryArt />;
    case 'extras': return <ExtrasArt />;
    case 'cart': return <CartArt />;
    case 'express': return <ExpressArt />;
    case 'confirmation': return <ConfirmArt />;
    default: return <CatalogueArt />;
  }
}
