import React from 'react';

/**
 * Vignettes de marque pour les fournisseurs de signature electronique.
 *
 * <h2>Choix de design</h2>
 * Plutot que d'embarquer les logos officiels (questions de licence + fragilite
 * en cas de refonte de marque), on rend des "marks" typographiques originaux
 * utilisant les couleurs identitaires de chaque fournisseur (information
 * factuelle, non protegee). Chaque tile est un carre arrondi de 48px avec :
 *   - background : couleur primaire de la marque
 *   - foreground : initiale(s) en typographie soignee
 *   - accent : forme geometrique discrete (point, barre) en couleur secondaire
 *
 * Avantages :
 *   - Zero dependance reseau (pas de Clearbit / CDN externe)
 *   - Fonctionne hors-ligne / CSP stricte
 *   - Consistance visuelle (toutes les marks suivent la meme grille)
 *   - Pas d'imitation pixel-perfect de logo (zero risque de marque)
 */

export type ProviderId =
  | 'YOUSIGN'
  | 'UNIVERSIGN'
  | 'DOCAPOSTE'
  | 'DOCUSIGN'
  | 'PENNYLANE'
  | 'ODOO'
  | 'PRICELABS'
  | 'BEYOND'
  | 'QUICKBOOKS';

interface ProviderLogoProps {
  provider: ProviderId;
  /** Taille en px (largeur = hauteur). Defaut 48. */
  size?: number;
  /** Si true, applique un opacity reduit (provider desactive). */
  muted?: boolean;
}

interface BrandPalette {
  bg: string;
  fg: string;
  accent: string;
}

const PALETTE: Record<ProviderId, BrandPalette> = {
  // Yousign : ardoise + vert signature
  YOUSIGN:    { bg: '#1F2A37', fg: '#FFFFFF', accent: '#20C997' },
  // Universign : bleu profond
  UNIVERSIGN: { bg: '#0046AD', fg: '#FFFFFF', accent: '#7FB3FF' },
  // DocaPoste : jaune La Poste + bleu marine
  DOCAPOSTE:  { bg: '#FFCC00', fg: '#1B2A4A', accent: '#003366' },
  // DocuSign : jaune signature + ardoise
  DOCUSIGN:   { bg: '#FFCC22', fg: '#2D353F', accent: '#1F2A37' },
  // Pennylane : indigo profond
  PENNYLANE:  { bg: '#1B2A4A', fg: '#FFFFFF', accent: '#6C7FE0' },
  // Odoo : prune
  ODOO:       { bg: '#714B67', fg: '#FFFFFF', accent: '#E8B546' },
  // PriceLabs : rouge/orange (revenue management)
  PRICELABS:  { bg: '#E94F37', fg: '#FFFFFF', accent: '#FFC857' },
  // Beyond : bleu nuit + teal
  BEYOND:     { bg: '#0F2E3F', fg: '#FFFFFF', accent: '#2ED9C3' },
  // QuickBooks : vert Intuit
  QUICKBOOKS: { bg: '#2CA01C', fg: '#FFFFFF', accent: '#FFFFFF' },
};

export default function ProviderLogo({ provider, size = 48, muted = false }: ProviderLogoProps) {
  const palette = PALETTE[provider];

  return (
    <div
      role="img"
      aria-label={`Marque ${provider.toLowerCase()}`}
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        opacity: muted ? 0.45 : 1,
        filter: muted ? 'grayscale(0.6)' : 'none',
        transition: 'opacity 180ms cubic-bezier(0.22, 1, 0.36, 1), filter 180ms cubic-bezier(0.22, 1, 0.36, 1)',
      }}
    >
      <svg
        viewBox="0 0 48 48"
        width={size}
        height={size}
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {renderMark(provider, palette)}
      </svg>
    </div>
  );
}

function renderMark(provider: ProviderId, p: BrandPalette): React.ReactNode {
  switch (provider) {
    case 'YOUSIGN':
      // Tile ardoise, "y" lowercase avec point d'accent vert
      return (
        <>
          <rect width="48" height="48" rx="12" fill={p.bg} />
          <text
            x="14"
            y="34"
            fontFamily="'Inter', 'Helvetica Neue', sans-serif"
            fontSize="26"
            fontWeight="700"
            fill={p.fg}
            letterSpacing="-0.04em"
          >
            y
          </text>
          <circle cx="32" cy="30" r="3" fill={p.accent} />
        </>
      );

    case 'UNIVERSIGN':
      // Tile bleu, "U" avec barre chevron sous
      return (
        <>
          <rect width="48" height="48" rx="12" fill={p.bg} />
          <text
            x="24"
            y="31"
            textAnchor="middle"
            fontFamily="'Inter', 'Helvetica Neue', sans-serif"
            fontSize="22"
            fontWeight="700"
            fill={p.fg}
            letterSpacing="-0.02em"
          >
            U
          </text>
          <path
            d="M14 37 L24 41 L34 37"
            stroke={p.accent}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </>
      );

    case 'DOCAPOSTE':
      // Tile jaune, "dp" en bleu marine
      return (
        <>
          <rect width="48" height="48" rx="12" fill={p.bg} />
          <text
            x="24"
            y="32"
            textAnchor="middle"
            fontFamily="'Inter', 'Helvetica Neue', sans-serif"
            fontSize="18"
            fontWeight="800"
            fill={p.fg}
            letterSpacing="-0.04em"
          >
            dp
          </text>
          <rect x="10" y="38" width="28" height="2" rx="1" fill={p.accent} />
        </>
      );

    case 'DOCUSIGN':
      // Tile jaune, "D" ardoise avec courbe de signature
      return (
        <>
          <rect width="48" height="48" rx="12" fill={p.bg} />
          <text
            x="14"
            y="34"
            fontFamily="'Inter', 'Helvetica Neue', sans-serif"
            fontSize="26"
            fontWeight="800"
            fill={p.fg}
            letterSpacing="-0.04em"
          >
            D
          </text>
          <path
            d="M30 24 Q34 20 38 24 T38 32"
            stroke={p.accent}
            strokeWidth="2.2"
            strokeLinecap="round"
            fill="none"
          />
        </>
      );

    case 'PENNYLANE':
      // Tile indigo, "P" blanc avec accent en pointille
      return (
        <>
          <rect width="48" height="48" rx="12" fill={p.bg} />
          <text
            x="14"
            y="34"
            fontFamily="'Inter', 'Helvetica Neue', sans-serif"
            fontSize="26"
            fontWeight="700"
            fill={p.fg}
            letterSpacing="-0.04em"
          >
            P
          </text>
          <circle cx="32" cy="16" r="2" fill={p.accent} />
          <circle cx="36" cy="20" r="1.5" fill={p.accent} opacity="0.7" />
          <circle cx="38" cy="25" r="1" fill={p.accent} opacity="0.45" />
        </>
      );

    case 'ODOO':
      // Tile prune, "o" blanc avec barres verticales caracteristiques
      return (
        <>
          <rect width="48" height="48" rx="12" fill={p.bg} />
          <rect x="11" y="20" width="2.5" height="14" rx="1.25" fill={p.fg} opacity="0.55" />
          <circle cx="24" cy="27" r="7" fill="none" stroke={p.fg} strokeWidth="2.5" />
          <rect x="34.5" y="20" width="2.5" height="14" rx="1.25" fill={p.accent} />
        </>
      );

    case 'PRICELABS':
      // Tile rouge/orange, "PL" + petit indicateur de courbe (data viz)
      return (
        <>
          <rect width="48" height="48" rx="12" fill={p.bg} />
          <text
            x="24"
            y="29"
            textAnchor="middle"
            fontFamily="'Inter', 'Helvetica Neue', sans-serif"
            fontSize="16"
            fontWeight="800"
            fill={p.fg}
            letterSpacing="-0.04em"
          >
            PL
          </text>
          <path
            d="M10 38 L17 33 L24 35 L31 28 L38 30"
            stroke={p.accent}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </>
      );

    case 'BEYOND':
      // Tile bleu nuit, "B" avec arc (au-dela)
      return (
        <>
          <rect width="48" height="48" rx="12" fill={p.bg} />
          <text
            x="24"
            y="32"
            textAnchor="middle"
            fontFamily="'Inter', 'Helvetica Neue', sans-serif"
            fontSize="22"
            fontWeight="700"
            fill={p.fg}
            letterSpacing="-0.02em"
          >
            B
          </text>
          <path
            d="M10 39 Q24 31 38 39"
            stroke={p.accent}
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
          />
        </>
      );

    case 'QUICKBOOKS':
      // Tile vert, "qb" minuscule entoure d'un cercle (motif Intuit)
      return (
        <>
          <rect width="48" height="48" rx="12" fill={p.bg} />
          <circle cx="24" cy="24" r="14" fill="none" stroke={p.fg} strokeWidth="2" opacity="0.4" />
          <text
            x="24"
            y="30"
            textAnchor="middle"
            fontFamily="'Inter', 'Helvetica Neue', sans-serif"
            fontSize="14"
            fontWeight="800"
            fill={p.fg}
            letterSpacing="-0.04em"
          >
            qb
          </text>
        </>
      );

    default:
      return <rect width="48" height="48" rx="12" fill={p.bg} />;
  }
}
