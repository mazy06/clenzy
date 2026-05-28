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
 * "Helvetica generique" de Plus Jakarta Sans.
 *
 * <h3>Animation — 3 phases coordonnees</h3>
 *
 * <ol>
 *   <li><b>Boot sequence</b> au mount, joue UNE FOIS (~1.4s) :
 *     <ul>
 *       <li>0ms : centre fade-in + scale 0→1 (back-out 400ms)</li>
 *       <li>200ms : 8 lignes radiales se tracent (stroke-dashoffset 500ms ease-out)</li>
 *       <li>600ms+ : 8 nodes pop-in en stagger horaire (60ms d'ecart, back-out 350ms)</li>
 *     </ul>
 *   </li>
 *   <li><b>Idle constant</b> apres le boot, infini mais sub-perceptible :
 *     <ul>
 *       <li>Centre <i>breathing</i> : scale 1 ↔ 0.94, opacity 1 ↔ 0.88, cycle 4s
 *           ease-in-out — suggere "orchestrator alive"</li>
 *       <li>8 nodes <i>active scan</i> : un node a la fois s'illumine
 *           brievement (scale 1.18, brightness 1.25) puis revient idle. Le
 *           "spotlight" tourne clockwise sur 6.4s (0.8s par node). Donne la
 *           sensation que l'orchestrator interroge ses specialistes en
 *           rotation.</li>
 *     </ul>
 *   </li>
 *   <li><b>Hover wave</b> au survol (~900ms) : centre pulse (delay 0,
 *       suggere "thinking"), puis ripple horaire vers les 8 nodes (chacun
 *       sur-scale + brightness), lines pulse synchrone. Override l'idle
 *       le temps du survol pour donner un focus clair.</li>
 * </ol>
 *
 * Conformite UX :
 * - {@code prefers-reduced-motion: reduce} kill TOUTES les animations (idle
 *   inclus) et snap a l'etat final visuel.
 * - Easing : cubic-bezier back-out (rebond doux) ou ease-in-out, jamais
 *   linear (ui-ux-pro-max rule).
 *
 * <h3>API</h3>
 * <ul>
 *   <li>{@code variant="full"} (defaut) — mark + wordmark cote a cote</li>
 *   <li>{@code variant="mark"} — mark seul (favicon, sidebar collapsed)</li>
 *   <li>{@code variant="wordmark"} — wordmark seul (zones tres etroites)</li>
 * </ul>
 */
export interface ClenzyMarkLogoProps {
  /** Facteur d'echelle multiplicatif. {@code 1} = icone 56px + wordmark 32px. */
  scale?: number;
  /** {@code "full"} (defaut) / {@code "mark"} (icone) / {@code "wordmark"} (typo). */
  variant?: 'full' | 'mark' | 'wordmark';
  /** {@code "auto"} suit le theme MUI. {@code "light"} / {@code "dark"} force. */
  tone?: 'auto' | 'light' | 'dark';
  /** Desactive TOUTES les animations (utile pour screenshots / tests visuels). */
  disableAnimation?: boolean;
}

// Coordonnees pre-calculees des 8 nodes en octogone parfait (rayon 18, centre 28,28).
// Ordre horaire commencant a 12h => permet l'animation scan clockwise.
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

// Duree d'un cycle de scan idle (un tour complet du spotlight). 6.4s pour
// 8 nodes => 0.8s par node. Suffisamment lent pour rester sub-perceptible.
const SCAN_CYCLE_MS = 6400;
const SCAN_NODE_SLICE_PCT = 100 / OCTAGON_NODES.length; // = 12.5% (= 800ms / 6400ms)

export default function ClenzyMarkLogo({
  scale = 1,
  variant = 'full',
  tone = 'auto',
  disableAnimation = false,
}: ClenzyMarkLogoProps) {
  const theme = useTheme();
  // useId garantit un namespace CSS unique par instance => pas de collision
  // entre 2 logos rendus simultanement sur la meme page.
  const uid = useId().replace(/:/g, '-');

  const resolvedTone =
    tone === 'auto' ? (theme.palette.mode === 'dark' ? 'dark' : 'light') : tone;

  // ─── Palette ──────────────────────────────────────────────────────────
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

  // ─── Classes scoped par useId ─────────────────────────────────────────
  const cls = {
    root: `clenzy-mark-root-${uid}`,
    svg: `clenzy-mark-svg-${uid}`,
    center: `clenzy-mark-center-${uid}`,
    line: `clenzy-mark-line-${uid}`,
    node: `clenzy-mark-node-${uid}`,
  };

  // ─── SVG ──────────────────────────────────────────────────────────────
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
      <g stroke={palette.lines} strokeWidth="1" opacity="0.35">
        {OCTAGON_NODES.map((n, i) => (
          <line
            key={`l-${i}`}
            className={cls.line}
            x1={CENTER.x} y1={CENTER.y} x2={n.x} y2={n.y}
          />
        ))}
      </g>
      <g fill={palette.nodes}>
        {OCTAGON_NODES.map((n, i) => (
          <circle
            key={`n-${i}`}
            className={`${cls.node} ${cls.node}-${i}`}
            cx={n.x} cy={n.y} r="2.5"
          />
        ))}
      </g>
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
        letterSpacing: '-0.015em',
        lineHeight: 1,
        color: palette.wordmark,
        direction: 'ltr',
        whiteSpace: 'nowrap',
      }}
    >
      clenzy
    </span>
  );

  // ─── Animation CSS scoped ─────────────────────────────────────────────
  // Strategy : multiple animations comma-separated. Boot joue avec fill:both
  // pour rester sur l'etat final, idle prend le relais via animation-delay.
  // Hover override animation-name pour donner le focus au wave.

  // Active scan keyframes : chaque node a sa propre @keyframes avec un peak
  // a un moment different du cycle (stagger via la position du peak dans le
  // 0-100%). Plus elegant qu'animation-delay car pas de "saut" au restart.
  const buildScanKeyframes = (i: number): string => {
    const peakPct = i * SCAN_NODE_SLICE_PCT + SCAN_NODE_SLICE_PCT / 2;
    const startPct = Math.max(0, peakPct - SCAN_NODE_SLICE_PCT / 2);
    const endPct = Math.min(100, peakPct + SCAN_NODE_SLICE_PCT / 2);
    return `
      @keyframes ${cls.node}-scan-${i} {
        0%, ${startPct.toFixed(2)}% { transform: scale(1); filter: brightness(1); }
        ${peakPct.toFixed(2)}%       { transform: scale(1.18); filter: brightness(1.25); }
        ${endPct.toFixed(2)}%, 100%  { transform: scale(1); filter: brightness(1); }
      }
    `;
  };

  const animationCss = !disableAnimation ? `
    /* ─── Boot sequence (joue 1 fois, ~1.4s) ─────────────────────────── */
    .${cls.center} {
      transform-origin: ${CENTER.x}px ${CENTER.y}px;
      animation:
        ${cls.center}-boot 400ms cubic-bezier(0.34, 1.56, 0.64, 1) both,
        ${cls.center}-breathe 4s ease-in-out 1500ms infinite;
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
    }
    ${OCTAGON_NODES.map((_, i) => `
      .${cls.node}-${i} {
        animation:
          ${cls.node}-pop 350ms cubic-bezier(0.34, 1.56, 0.64, 1) ${600 + i * 60}ms both,
          ${cls.node}-scan-${i} ${SCAN_CYCLE_MS}ms ease-in-out ${1400 + i * 80}ms infinite;
      }
    `).join('')}

    /* ─── Hover wave (~900ms, override l'idle) ───────────────────────── */
    .${cls.root}:hover .${cls.center} {
      animation: ${cls.center}-pulse 800ms cubic-bezier(0.4, 0, 0.2, 1);
    }
    .${cls.root}:hover .${cls.line} {
      stroke-dasharray: none;
      stroke-dashoffset: 0;
      animation: ${cls.line}-pulse 700ms cubic-bezier(0.4, 0, 0.2, 1) 100ms;
    }
    ${OCTAGON_NODES.map((_, i) => `
      .${cls.root}:hover .${cls.node}-${i} {
        animation: ${cls.node}-wave-pulse 650ms cubic-bezier(0.34, 1.56, 0.64, 1) ${180 + i * 75}ms;
      }
    `).join('')}

    /* ─── Keyframes : boot ───────────────────────────────────────────── */
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

    /* ─── Keyframes : idle constant ──────────────────────────────────── */
    @keyframes ${cls.center}-breathe {
      0%, 100% { transform: scale(1);    opacity: 1; }
      50%      { transform: scale(0.94); opacity: 0.88; }
    }
    ${OCTAGON_NODES.map((_, i) => buildScanKeyframes(i)).join('')}

    /* ─── Keyframes : hover wave (polish v3) ─────────────────────────── */
    @keyframes ${cls.center}-pulse {
      0%   { transform: scale(1);    filter: brightness(1)   drop-shadow(0 0 0 transparent); }
      35%  { transform: scale(1.3);  filter: brightness(1.4) drop-shadow(0 0 4px currentColor); }
      100% { transform: scale(1);    filter: brightness(1)   drop-shadow(0 0 0 transparent); }
    }
    @keyframes ${cls.line}-pulse {
      0%   { opacity: 0.35; stroke-width: 1; }
      40%  { opacity: 0.75; stroke-width: 1.3; }
      100% { opacity: 0.35; stroke-width: 1; }
    }
    @keyframes ${cls.node}-wave-pulse {
      0%   { transform: scale(1);    filter: brightness(1); }
      50%  { transform: scale(1.7);  filter: brightness(1.5); }
      100% { transform: scale(1);    filter: brightness(1); }
    }

    /* ─── prefers-reduced-motion : tout kill ─────────────────────────── */
    @media (prefers-reduced-motion: reduce) {
      .${cls.center},
      .${cls.line},
      .${cls.node},
      .${cls.root}:hover .${cls.center},
      .${cls.root}:hover .${cls.line},
      .${cls.root}:hover .${cls.node} {
        animation: none !important;
        opacity: 1 !important;
        transform: none !important;
        stroke-dashoffset: 0 !important;
        stroke-dasharray: none !important;
        filter: none !important;
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
