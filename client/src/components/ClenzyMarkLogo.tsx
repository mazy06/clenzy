import React, { useId } from 'react';
import { Box, useTheme } from '@mui/material';

/**
 * Logo Clenzy SaaS — option "8 nodes orchestration" + wordmark Space Grotesk.
 *
 * <h3>Concept</h3>
 * 8 nodes disposes en octogone autour d'un node central — visualisation
 * litterale de l'architecture multi-agents Clenzy (OrchestratorAgent +
 * 8 specialistes). Le mark a remplace l'ancien {@code ClenzyAnimatedLogo}
 * (goutte d'eau + script + "PROPRETE & MULTISERVICES") qui evoquait un
 * service de menage, pas un PMS SaaS.
 *
 * <h3>Typo</h3>
 * Wordmark "clenzy" en <b>Space Grotesk 600</b>. Choix dicte par le skill
 * {@code ui-ux-pro-max} (pairing "Tech Startup", optim AI / data-tech).
 * Plus de chasse + terminations distinctives sur "y" qui cassent le cote
 * "Helvetica generique" de Plus Jakarta Sans utilise auparavant.
 *
 * <h3>Animation</h3>
 * Deux phases, conformes aux UX rules (ui-ux-pro-max : pas d'animation
 * infinie decorative, ease-out partout, prefers-reduced-motion respecte) :
 *
 * <ol>
 *   <li><b>Boot sequence</b> au mount, joue UNE FOIS (~1.4s) :
 *     <ul>
 *       <li>0ms : centre fade-in + scale 0→1 (cubic-bezier back-out 400ms)</li>
 *       <li>200ms : 8 lignes radiales se tracent (stroke-dashoffset, ease-out 500ms)</li>
 *       <li>600ms+ : 8 nodes pop-in en stagger horaire (60ms d'ecart, back-out)</li>
 *     </ul>
 *   </li>
 *   <li><b>Hover wave</b> au survol (~700ms) : le centre pulse, puis ripple
 *       horaire vers les 8 nodes (chacun se sur-scale brievement). Suggere
 *       la communication orchestrator → specialistes. Non-distractif car
 *       trigger explicite (pas en boucle).</li>
 * </ol>
 *
 * <h3>API</h3>
 * Compatible avec l'ancienne signature ({@code scale}) pour faciliter le
 * remplacement. Trois variantes :
 * <ul>
 *   <li>{@code variant="full"} (defaut) — mark + wordmark "clenzy" cote a cote</li>
 *   <li>{@code variant="mark"} — mark seul (favicon, sidebar collapsed)</li>
 *   <li>{@code variant="wordmark"} — wordmark seul (zones tres etroites)</li>
 * </ul>
 *
 * <h3>Couleurs</h3>
 * Defaut "auto" : suit le theme MUI (dark mode = teintes plus claires pour
 * contraste WCAG AA sur fond sombre). Override manuel via {@code tone}.
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
  /**
   * Desactive completement les animations (utile pour les screenshots
   * marketing, snapshots de tests visuels, etc). Par defaut animations ON,
   * mais respect natif de {@code prefers-reduced-motion: reduce}.
   */
  disableAnimation?: boolean;
}

// Coordonnees pre-calculees des 8 nodes en octogone parfait (rayon 18 depuis centre 28,28).
// Ordre horaire commencant a 12h pour permettre l'animation stagger clockwise.
const OCTAGON_NODES: ReadonlyArray<{ x: number; y: number }> = [
  { x: 28, y: 10 },     // 0 — 12h N
  { x: 40.7, y: 15.3 }, // 1 — 1h30 NE
  { x: 46, y: 28 },     // 2 — 3h E
  { x: 40.7, y: 40.7 }, // 3 — 4h30 SE
  { x: 28, y: 46 },     // 4 — 6h S
  { x: 15.3, y: 40.7 }, // 5 — 7h30 SW
  { x: 10, y: 28 },     // 6 — 9h W
  { x: 15.3, y: 15.3 }, // 7 — 10h30 NW
];

const CENTER = { x: 28, y: 28 };

export default function ClenzyMarkLogo({
  scale = 1,
  variant = 'full',
  tone = 'auto',
  disableAnimation = false,
}: ClenzyMarkLogoProps) {
  const theme = useTheme();
  // useId garantit un namespace CSS unique par instance => pas de collision
  // entre 2 logos rendus simultanement sur la meme page (ex: header + footer).
  const uid = useId().replace(/:/g, '-');

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

  // ─── Classes scoped par useId (pas de leak global) ────────────────────
  const cls = {
    root: `clenzy-mark-root-${uid}`,
    svg: `clenzy-mark-svg-${uid}`,
    center: `clenzy-mark-center-${uid}`,
    line: `clenzy-mark-line-${uid}`,
    node: `clenzy-mark-node-${uid}`,
  };

  // ─── Mark SVG ─────────────────────────────────────────────────────────
  const mark = (
    <svg
      className={cls.svg}
      width={iconSize}
      height={iconSize}
      viewBox="0 0 56 56"
      fill="none"
      role="img"
      aria-label="Clenzy"
      style={{ flexShrink: 0, overflow: 'visible' }}
    >
      {/* Lignes radiales subtiles centre -> nodes : suggere la communication
          orchestrator -> specialistes sans dominer visuellement (opacity 0.35). */}
      <g stroke={palette.lines} strokeWidth="1" opacity="0.35">
        {OCTAGON_NODES.map((n, i) => (
          <line
            key={`l-${i}`}
            className={cls.line}
            x1={CENTER.x} y1={CENTER.y} x2={n.x} y2={n.y}
          />
        ))}
      </g>
      {/* 8 nodes peripheriques : ASSISTANT_CHAT, PRICING, MESSAGING, ANALYTICS,
          SENTIMENT, DESIGN, BRIEFINGS, KB_RAG. Ordre horaire pour animation. */}
      <g fill={palette.nodes}>
        {OCTAGON_NODES.map((n, i) => (
          <circle
            key={`n-${i}`}
            className={`${cls.node} ${cls.node}-${i}`}
            cx={n.x} cy={n.y} r="2.5"
          />
        ))}
      </g>
      {/* Node central (orchestrator) plus gros pour hierarchie visuelle. */}
      <circle className={cls.center} cx={CENTER.x} cy={CENTER.y} r="4.5" fill={palette.center} />
    </svg>
  );

  // ─── Wordmark — Space Grotesk 600 ─────────────────────────────────────
  const wordmark = (
    <span
      style={{
        fontFamily: '"Space Grotesk", "Plus Jakarta Sans", -apple-system, "Segoe UI", sans-serif',
        fontWeight: 600,
        fontSize: `${fontSize}px`,
        // letter-spacing -0.015em : moins serre que Jakarta (-0.025em) pour
        // donner de l'air et casser le cote "compact" reproche par l'user
        letterSpacing: '-0.015em',
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

  // ─── Animation CSS scoped via useId namespace ─────────────────────────
  // Boot sequence joue au mount (animation-fill-mode: both => garde l'etat
  // final apres la fin). Hover wave joue a chaque survol via :hover (CSS
  // re-trigger l'animation au passage de animation:none → animation:wave).
  // prefers-reduced-motion: snap a l'etat final, zero animation.
  const animationCss = !disableAnimation ? `
    .${cls.center} {
      transform-origin: ${CENTER.x}px ${CENTER.y}px;
      animation: ${cls.center}-boot 400ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
    }
    .${cls.line} {
      stroke-dasharray: 36;
      stroke-dashoffset: 36;
      animation: ${cls.line}-draw 500ms ease-out 200ms both;
    }
    .${cls.node} {
      transform-box: fill-box;
      transform-origin: center;
      opacity: 0;
      animation: ${cls.node}-pop 350ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
    }
    ${OCTAGON_NODES.map((_, i) => `
      .${cls.node}-${i} { animation-delay: ${600 + i * 60}ms; }
    `).join('')}

    /* Hover wave : communication orchestrator -> specialistes (~700ms). */
    .${cls.root}:hover .${cls.center} {
      animation: ${cls.center}-pulse 700ms ease-out;
    }
    ${OCTAGON_NODES.map((_, i) => `
      .${cls.root}:hover .${cls.node}-${i} {
        animation: ${cls.node}-pulse 600ms ease-out ${100 + i * 75}ms;
      }
    `).join('')}

    @keyframes ${cls.center}-boot {
      0%   { transform: scale(0);   opacity: 0; }
      100% { transform: scale(1);   opacity: 1; }
    }
    @keyframes ${cls.line}-draw {
      0%   { stroke-dashoffset: 36; opacity: 0; }
      30%  { opacity: 0.35; }
      100% { stroke-dashoffset: 0;  opacity: 0.35; }
    }
    @keyframes ${cls.node}-pop {
      0%   { transform: scale(0);   opacity: 0; }
      60%  { transform: scale(1.4); opacity: 1; }
      100% { transform: scale(1);   opacity: 1; }
    }
    @keyframes ${cls.center}-pulse {
      0%   { transform: scale(1);    filter: brightness(1); }
      40%  { transform: scale(1.25); filter: brightness(1.3); }
      100% { transform: scale(1);    filter: brightness(1); }
    }
    @keyframes ${cls.node}-pulse {
      0%   { transform: scale(1);    filter: brightness(1); }
      50%  { transform: scale(1.6);  filter: brightness(1.4); }
      100% { transform: scale(1);    filter: brightness(1); }
    }

    @media (prefers-reduced-motion: reduce) {
      .${cls.center},
      .${cls.line},
      .${cls.node},
      .${cls.root}:hover .${cls.center},
      .${cls.root}:hover .${cls.node} {
        animation: none !important;
        opacity: 1 !important;
        transform: none !important;
        stroke-dashoffset: 0 !important;
      }
    }
  ` : '';

  // ─── Render ───────────────────────────────────────────────────────────
  const content =
    variant === 'mark' ? mark :
    variant === 'wordmark' ? wordmark :
    <>{mark}{wordmark}</>;

  return (
    <>
      {!disableAnimation && <style>{animationCss}</style>}
      <Box
        className={cls.root}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: variant === 'full' ? `${gap}px` : 0,
        }}
      >
        {content}
      </Box>
    </>
  );
}
