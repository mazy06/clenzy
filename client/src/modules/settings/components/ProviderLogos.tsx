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
  | 'DOCUSEAL'
  | 'PENNYLANE'
  | 'ODOO'
  | 'PRICELABS'
  | 'BEYOND'
  | 'WHEELHOUSE'
  | 'QUICKBOOKS'
  | 'XERO'
  | 'SAGE'
  | 'CHEKIN'
  | 'POLICE_MA'
  | 'ABSHER_KSA'
  | 'SUMSUB'
  | 'VERIFF'
  | 'ONFIDO'
  | 'SITEMINDER'
  | 'HOSTAWAY'
  | 'RENTALS_UNITED'
  | 'CHANNEX'
  | 'TUYA'
  | 'MINUT'
  | 'NETATMO';

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
  // DocuSeal : ardoise sombre + ambre (open source self-hosted)
  DOCUSEAL:   { bg: '#1C2536', fg: '#FFFFFF', accent: '#F59E0B' },
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
  // Wheelhouse : navy + jaune (data driven)
  WHEELHOUSE: { bg: '#1A2B4A', fg: '#FFFFFF', accent: '#FFC857' },
  // Xero : cyan + bleu signature
  XERO:       { bg: '#13B5EA', fg: '#FFFFFF', accent: '#0078A3' },
  // Sage : vert sapin
  SAGE:       { bg: '#00DC00', fg: '#0D2818', accent: '#0D2818' },
  // Chekin : bleu profond (compliance, identite officielle)
  CHEKIN:     { bg: '#1E40AF', fg: '#FFFFFF', accent: '#60A5FA' },
  // Police MA : rouge profond (couleur drapeau MA)
  POLICE_MA:  { bg: '#C1272D', fg: '#FFFFFF', accent: '#006233' },
  // Absher KSA : vert profond (couleur drapeau KSA)
  ABSHER_KSA: { bg: '#006C35', fg: '#FFFFFF', accent: '#D4A574' },
  // Sumsub : teal/turquoise
  SUMSUB:     { bg: '#0F766E', fg: '#FFFFFF', accent: '#5EEAD4' },
  // Veriff : vert frais (KYC)
  VERIFF:     { bg: '#16A34A', fg: '#FFFFFF', accent: '#FFFFFF' },
  // Onfido : violet/indigo
  ONFIDO:     { bg: '#4F46E5', fg: '#FFFFFF', accent: '#A5B4FC' },
  // SiteMinder : bleu corporate
  SITEMINDER: { bg: '#1E40AF', fg: '#FFFFFF', accent: '#93C5FD' },
  // Hostaway : navy + orange (brand)
  HOSTAWAY:   { bg: '#0A2540', fg: '#FFFFFF', accent: '#F97316' },
  // Rentals United : bleu marine + accent rouge
  RENTALS_UNITED: { bg: '#0F172A', fg: '#FFFFFF', accent: '#EF4444' },
  // Channex : teal (couleur brand officielle channex.io)
  CHANNEX: { bg: '#0F766E', fg: '#FFFFFF', accent: '#5EEAD4' },
  // Tuya : orange brand (cloud IoT)
  TUYA:    { bg: '#FF5A28', fg: '#FFFFFF', accent: '#FFD0A8' },
  // Minut : nuit + vert capteur
  MINUT:   { bg: '#1B2030', fg: '#FFFFFF', accent: '#4ADE80' },
  // Netatmo : ardoise + teal capteur
  NETATMO: { bg: '#2D3A45', fg: '#FFFFFF', accent: '#00B0B9' },
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

    case 'DOCUSEAL':
      // Tile ardoise, document blanc coin plie + paraphe ambre (scellement)
      return (
        <>
          <rect width="48" height="48" rx="12" fill={p.bg} />
          <path d="M16 12 h12 l6 6 v18 h-18 z" fill={p.fg} opacity="0.92" />
          <path d="M28 12 v6 h6 z" fill={p.bg} opacity="0.35" />
          <path d="M19.5 30.5 c 2.5 -3 4 -1 5.5 0.5 c 1.5 1.5 3 0.5 4.5 -1.5" fill="none" stroke={p.accent} strokeWidth="2.2" strokeLinecap="round" />
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

    case 'WHEELHOUSE':
      // Tile navy, "W" + petits rayons (motif de roue / tableau de bord)
      return (
        <>
          <rect width="48" height="48" rx="12" fill={p.bg} />
          <text
            x="24"
            y="30"
            textAnchor="middle"
            fontFamily="'Inter', 'Helvetica Neue', sans-serif"
            fontSize="20"
            fontWeight="800"
            fill={p.fg}
            letterSpacing="-0.04em"
          >
            W
          </text>
          <circle cx="24" cy="38" r="2.5" fill={p.accent} />
          <line x1="19" y1="38" x2="14" y2="38" stroke={p.accent} strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
          <line x1="29" y1="38" x2="34" y2="38" stroke={p.accent} strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
        </>
      );

    case 'XERO':
      // Tile cyan, "X" trace en 2 lignes croisees
      return (
        <>
          <rect width="48" height="48" rx="12" fill={p.bg} />
          <path
            d="M14 16 L34 32 M34 16 L14 32"
            stroke={p.fg}
            strokeWidth="3.5"
            strokeLinecap="round"
            fill="none"
          />
          <circle cx="24" cy="24" r="14" fill="none" stroke={p.accent} strokeWidth="1.5" opacity="0.5" />
        </>
      );

    case 'SAGE':
      // Tile vert, "s" minuscule avec barre/courbe inferieure
      return (
        <>
          <rect width="48" height="48" rx="12" fill={p.bg} />
          <text
            x="24"
            y="33"
            textAnchor="middle"
            fontFamily="'Inter', 'Helvetica Neue', sans-serif"
            fontSize="26"
            fontWeight="800"
            fill={p.fg}
            letterSpacing="-0.04em"
          >
            s
          </text>
          <path
            d="M12 39 Q24 35 36 39"
            stroke={p.accent}
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
          />
        </>
      );

    case 'CHEKIN':
      // Tile bleu profond, "ck" avec un check (validation conformite)
      return (
        <>
          <rect width="48" height="48" rx="12" fill={p.bg} />
          <text
            x="14"
            y="30"
            fontFamily="'Inter', 'Helvetica Neue', sans-serif"
            fontSize="14"
            fontWeight="800"
            fill={p.fg}
            letterSpacing="-0.04em"
          >
            ch
          </text>
          <path
            d="M28 24 L31 27 L37 19"
            stroke={p.accent}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </>
      );

    case 'POLICE_MA':
      // Tile rouge, etoile pentagonale (motif drapeau MA), "MA" en bas
      return (
        <>
          <rect width="48" height="48" rx="12" fill={p.bg} />
          {/* Etoile pentagonale stylisee (5 branches) */}
          <path
            d="M24 11 L26.5 19 L34.5 19 L28 24 L30.5 32 L24 27 L17.5 32 L20 24 L13.5 19 L21.5 19 Z"
            fill="none"
            stroke={p.accent}
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <text
            x="24"
            y="42"
            textAnchor="middle"
            fontFamily="'Inter', 'Helvetica Neue', sans-serif"
            fontSize="7"
            fontWeight="700"
            fill={p.fg}
            letterSpacing="0.1em"
          >
            MA
          </text>
        </>
      );

    case 'ABSHER_KSA':
      // Tile vert, motif palmier + epees stylise (clin d'oeil emblem KSA)
      return (
        <>
          <rect width="48" height="48" rx="12" fill={p.bg} />
          {/* Tronc */}
          <rect x="23" y="22" width="2" height="14" rx="1" fill={p.fg} opacity="0.85" />
          {/* Feuilles palmier (4 arcs) */}
          <path d="M24 22 Q14 18 12 28" stroke={p.fg} strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.85" />
          <path d="M24 22 Q34 18 36 28" stroke={p.fg} strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.85" />
          <path d="M24 22 Q17 12 14 18" stroke={p.fg} strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.65" />
          <path d="M24 22 Q31 12 34 18" stroke={p.fg} strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.65" />
          {/* Petit cartouche dore en bas */}
          <line x1="13" y1="40" x2="35" y2="40" stroke={p.accent} strokeWidth="1.5" strokeLinecap="round" />
        </>
      );

    case 'SUMSUB':
      // Tile teal, "S" + cercle scan (verification d'identite)
      return (
        <>
          <rect width="48" height="48" rx="12" fill={p.bg} />
          <text
            x="14"
            y="33"
            fontFamily="'Inter', 'Helvetica Neue', sans-serif"
            fontSize="22"
            fontWeight="800"
            fill={p.fg}
            letterSpacing="-0.04em"
          >
            S
          </text>
          <circle cx="32" cy="22" r="6" fill="none" stroke={p.accent} strokeWidth="2" />
          <line x1="36" y1="26" x2="40" y2="30" stroke={p.accent} strokeWidth="2" strokeLinecap="round" />
        </>
      );

    case 'VERIFF':
      // Tile vert, "v" minuscule + tick coche (verification)
      return (
        <>
          <rect width="48" height="48" rx="12" fill={p.bg} />
          <text
            x="14"
            y="34"
            fontFamily="'Inter', 'Helvetica Neue', sans-serif"
            fontSize="24"
            fontWeight="800"
            fill={p.fg}
            letterSpacing="-0.04em"
          >
            v
          </text>
          <path
            d="M28 24 L32 28 L40 18"
            stroke={p.fg}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </>
      );

    case 'ONFIDO':
      // Tile violet, "O" stylise avec point central (scan iris)
      return (
        <>
          <rect width="48" height="48" rx="12" fill={p.bg} />
          <circle cx="24" cy="24" r="11" fill="none" stroke={p.fg} strokeWidth="3" />
          <circle cx="24" cy="24" r="4" fill={p.accent} />
        </>
      );

    case 'SITEMINDER':
      // Tile bleu, "SM" + connecteurs (network nodes)
      return (
        <>
          <rect width="48" height="48" rx="12" fill={p.bg} />
          <text
            x="24"
            y="28"
            textAnchor="middle"
            fontFamily="'Inter', 'Helvetica Neue', sans-serif"
            fontSize="14"
            fontWeight="800"
            fill={p.fg}
            letterSpacing="-0.04em"
          >
            SM
          </text>
          {/* Petits nodes connectes (motif channel manager) */}
          <circle cx="12" cy="38" r="2" fill={p.accent} />
          <circle cx="24" cy="40" r="2" fill={p.accent} />
          <circle cx="36" cy="38" r="2" fill={p.accent} />
          <line x1="14" y1="38" x2="22" y2="40" stroke={p.accent} strokeWidth="1.2" opacity="0.6" />
          <line x1="26" y1="40" x2="34" y2="38" stroke={p.accent} strokeWidth="1.2" opacity="0.6" />
        </>
      );

    case 'HOSTAWAY':
      // Tile navy + accent orange, "H" + barre horizontale (way / chemin)
      return (
        <>
          <rect width="48" height="48" rx="12" fill={p.bg} />
          <text
            x="24"
            y="30"
            textAnchor="middle"
            fontFamily="'Inter', 'Helvetica Neue', sans-serif"
            fontSize="20"
            fontWeight="800"
            fill={p.fg}
            letterSpacing="-0.04em"
          >
            H
          </text>
          <line x1="11" y1="38" x2="37" y2="38" stroke={p.accent} strokeWidth="2.5" strokeLinecap="round" />
        </>
      );

    case 'RENTALS_UNITED':
      // Tile navy + accent rouge, "RU" + symbole d'union (cercles concentrique)
      return (
        <>
          <rect width="48" height="48" rx="12" fill={p.bg} />
          <text
            x="24"
            y="28"
            textAnchor="middle"
            fontFamily="'Inter', 'Helvetica Neue', sans-serif"
            fontSize="13"
            fontWeight="800"
            fill={p.fg}
            letterSpacing="-0.04em"
          >
            RU
          </text>
          {/* Trois cercles : symbole de "union" */}
          <circle cx="18" cy="38" r="3" fill="none" stroke={p.accent} strokeWidth="1.5" />
          <circle cx="24" cy="38" r="3" fill="none" stroke={p.accent} strokeWidth="1.5" />
          <circle cx="30" cy="38" r="3" fill="none" stroke={p.accent} strokeWidth="1.5" />
        </>
      );

    case 'CHANNEX':
      // Tile teal + "Cx" stylise + 4 noeuds connectes (representation des channels distribues)
      return (
        <>
          <rect width="48" height="48" rx="12" fill={p.bg} />
          <text
            x="24"
            y="28"
            textAnchor="middle"
            fontFamily="'Inter', 'Helvetica Neue', sans-serif"
            fontSize="16"
            fontWeight="800"
            fill={p.fg}
            letterSpacing="-0.05em"
          >
            Cx
          </text>
          {/* 4 noeuds connectes : evoque le multi-OTA */}
          <circle cx="13" cy="38" r="1.6" fill={p.accent} />
          <circle cx="20" cy="38" r="1.6" fill={p.accent} />
          <circle cx="28" cy="38" r="1.6" fill={p.accent} />
          <circle cx="35" cy="38" r="1.6" fill={p.accent} />
          <line x1="13" y1="38" x2="35" y2="38" stroke={p.accent} strokeWidth="1" strokeLinecap="round" opacity="0.6" />
        </>
      );

    case 'TUYA':
      // Tile orange, "T" + noeud cloud
      return (
        <>
          <rect width="48" height="48" rx="12" fill={p.bg} />
          <text x="24" y="33" textAnchor="middle" fontFamily="'Inter', sans-serif" fontSize="24" fontWeight="700" fill={p.fg} letterSpacing="-0.04em">T</text>
          <circle cx="35" cy="14" r="3" fill={p.accent} />
        </>
      );

    case 'MINUT':
      // Tile nuit, "M" + point capteur vert
      return (
        <>
          <rect width="48" height="48" rx="12" fill={p.bg} />
          <text x="24" y="33" textAnchor="middle" fontFamily="'Inter', sans-serif" fontSize="24" fontWeight="700" fill={p.fg} letterSpacing="-0.04em">M</text>
          <circle cx="35" cy="14" r="3" fill={p.accent} />
        </>
      );

    case 'NETATMO':
      // Tile ardoise, "N" + point capteur teal
      return (
        <>
          <rect width="48" height="48" rx="12" fill={p.bg} />
          <text x="24" y="33" textAnchor="middle" fontFamily="'Inter', sans-serif" fontSize="24" fontWeight="700" fill={p.fg} letterSpacing="-0.04em">N</text>
          <circle cx="35" cy="14" r="3" fill={p.accent} />
        </>
      );

    default:
      return <rect width="48" height="48" rx="12" fill={p.bg} />;
  }
}
