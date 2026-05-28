import React from 'react';
import { Box, useTheme } from '@mui/material';

/**
 * Logo Clenzy SaaS — option "8 nodes orchestration" + wordmark.
 *
 * <h3>Concept</h3>
 * 8 nodes disposes en octogone autour d'un node central — visualisation
 * litterale de l'architecture multi-agents Clenzy (OrchestratorAgent +
 * 8 specialistes). Le mark remplace l'ancien {@code ClenzyAnimatedLogo}
 * (goutte d'eau + script "Clenzy" + tagline "PROPRETE & MULTISERVICES")
 * qui evoquait un service de menage, pas un PMS SaaS.
 *
 * <h3>API</h3>
 * Compatible avec l'ancienne signature ({@code scale}) pour faciliter le
 * remplacement. Trois variantes :
 * <ul>
 *   <li>{@code variant="full"} (defaut) — mark + wordmark "clenzy" cote a cote</li>
 *   <li>{@code variant="mark"} — mark seul (favicon, sidebar collapsed)</li>
 *   <li>{@code variant="wordmark"} — wordmark seul (typo only, pour les zones tres etroites)</li>
 * </ul>
 *
 * <h3>Couleurs</h3>
 * Defaut "auto" : suit le theme MUI (dark mode = teintes plus claires pour
 * contraste WCAG AA sur fond sombre). Override manuel via {@code tone}.
 *
 * <h3>Pourquoi pas d'animation</h3>
 * L'ancien composant animait l'apparition lettre par lettre + scintillements
 * sparkles. Sur un mark SaaS B2B, ce niveau d'animation tombe dans le
 * "AI slop decoratif" (cf. regles design Clenzy, Niveau 1). Le mark est
 * statique, sobre, professionnel — laissez la valeur produit faire le wow,
 * pas le logo.
 */
export interface ClenzyMarkLogoProps {
  /**
   * Facteur d'echelle multiplicatif. {@code 1} = taille de reference
   * (icone 56px + wordmark 32px). Compatible avec l'API de l'ancien
   * {@code ClenzyAnimatedLogo}.
   */
  scale?: number;
  /**
   * {@code "full"} = icone + wordmark (defaut)
   * {@code "mark"} = icone seule (favicon, sidebar collapsed)
   * {@code "wordmark"} = wordmark seul (zones tres etroites)
   */
  variant?: 'full' | 'mark' | 'wordmark';
  /**
   * Strategie de couleurs. {@code "auto"} suit le theme MUI mode (light/dark).
   * Force {@code "light"} ou {@code "dark"} pour rendre sur un fond connu
   * independamment du theme global.
   */
  tone?: 'auto' | 'light' | 'dark';
}

// Coordonnees pre-calculees des 8 nodes en octogone parfait (rayon 18 depuis centre 28,28).
// Ordre horaire commencant a 12h pour qu'un animateur futur puisse animer dans le sens horaire.
const OCTAGON_NODES: ReadonlyArray<{ x: number; y: number }> = [
  { x: 28, y: 10 },     // 12h — N
  { x: 40.7, y: 15.3 }, //  1h30 — NE
  { x: 46, y: 28 },     //  3h — E
  { x: 40.7, y: 40.7 }, //  4h30 — SE
  { x: 28, y: 46 },     //  6h — S
  { x: 15.3, y: 40.7 }, //  7h30 — SW
  { x: 10, y: 28 },     //  9h — W
  { x: 15.3, y: 15.3 }, // 10h30 — NW
];

const CENTER = { x: 28, y: 28 };

export default function ClenzyMarkLogo({
  scale = 1,
  variant = 'full',
  tone = 'auto',
}: ClenzyMarkLogoProps) {
  const theme = useTheme();
  const resolvedTone =
    tone === 'auto' ? (theme.palette.mode === 'dark' ? 'dark' : 'light') : tone;

  // ─── Palette ──────────────────────────────────────────────────────────
  // Light : brand primary #6B8A9A + center plus fonce #4A6B7B
  // Dark  : teintes ~20% plus claires pour rester WCAG AA sur fond sombre
  const palette = resolvedTone === 'dark'
    ? {
        nodes: '#89B1C2',
        center: '#FFFFFF',
        lines: '#89B1C2',
        wordmark: '#FFFFFF',
      }
    : {
        nodes: '#6B8A9A',
        center: '#4A6B7B',
        lines: '#6B8A9A',
        wordmark: theme.palette.text.primary,
      };

  // ─── Dimensions ───────────────────────────────────────────────────────
  const iconSize = 56 * scale;
  const fontSize = 32 * scale;
  const gap = 14 * scale;

  // ─── Mark SVG (les 8 nodes + lignes radiales + node central) ──────────
  const mark = (
    <svg
      width={iconSize}
      height={iconSize}
      viewBox="0 0 56 56"
      fill="none"
      role="img"
      aria-label="Clenzy"
      style={{ flexShrink: 0 }}
    >
      {/* Lignes radiales subtiles centre -> nodes : suggere la communication
          orchestrator -> specialistes sans dominer visuellement (opacity 0.35). */}
      <g stroke={palette.lines} strokeWidth="1" opacity="0.35">
        {OCTAGON_NODES.map((n, i) => (
          <line key={`l-${i}`} x1={CENTER.x} y1={CENTER.y} x2={n.x} y2={n.y} />
        ))}
      </g>
      {/* 8 nodes peripheriques (specialistes : ASSISTANT_CHAT, PRICING,
          MESSAGING, ANALYTICS, SENTIMENT, DESIGN, BRIEFINGS, KB_RAG). */}
      <g fill={palette.nodes}>
        {OCTAGON_NODES.map((n, i) => (
          <circle key={`n-${i}`} cx={n.x} cy={n.y} r="2.5" />
        ))}
      </g>
      {/* Node central (orchestrator) plus gros pour hierarchie visuelle. */}
      <circle cx={CENTER.x} cy={CENTER.y} r="4.5" fill={palette.center} />
    </svg>
  );

  // ─── Wordmark (Plus Jakarta Sans 700 lowercase) ───────────────────────
  const wordmark = (
    <span
      style={{
        fontFamily: '"Plus Jakarta Sans", -apple-system, "Segoe UI", sans-serif',
        fontWeight: 700,
        fontSize: `${fontSize}px`,
        letterSpacing: '-0.025em',
        lineHeight: 1,
        color: palette.wordmark,
        // Force LTR : un wordmark de marque ne se mirroir pas en RTL.
        direction: 'ltr',
        whiteSpace: 'nowrap',
      }}
    >
      clenzy
    </span>
  );

  if (variant === 'mark') {
    return <Box sx={{ display: 'inline-flex', alignItems: 'center' }}>{mark}</Box>;
  }
  if (variant === 'wordmark') {
    return <Box sx={{ display: 'inline-flex', alignItems: 'center' }}>{wordmark}</Box>;
  }
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: `${gap}px` }}>
      {mark}
      {wordmark}
    </Box>
  );
}
