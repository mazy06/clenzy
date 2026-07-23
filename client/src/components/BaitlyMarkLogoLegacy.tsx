import React, { useId } from 'react';
import { Box, useTheme } from '@mui/material';

/**
 * ⚠️ ANCIEN LOGO — CONSERVÉ POUR RÉFÉRENCE, NE PLUS UTILISER.
 *
 * Ce fichier préserve l'implémentation « 8 nodes orchestration » qui était
 * le logo Baitly jusqu'à la refonte design. Il a été remplacé par le nouveau
 * mark animé (maison + packets request/response) dans {@link BaitlyMarkLogo}.
 * Aucun import ne pointe ici ; le fichier reste le temps de valider le nouveau
 * logo avant suppression définitive.
 *
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Logo Baitly SaaS — option "8 nodes orchestration" + wordmark Space Grotesk.
 *
 * <h3>Concept</h3>
 * 8 nodes disposes en octogone autour d'un node central — visualisation
 * litterale de l'architecture multi-agents Baitly (OrchestratorAgent +
 * 8 specialistes). Le mark a remplace l'ancien {@code ClenzyAnimatedLogo}
 * (goutte d'eau + script + "PROPRETE & MULTISERVICES") qui evoquait un
 * service de menage, pas un PMS SaaS.
 *
 * <h3>Typo</h3>
 * Wordmark "clenzy" en <b>Space Grotesk 600</b>. Choix dicte par le skill
 * {@code ui-ux-pro-max} (pairing "Tech Startup", optim AI / data-tech).
 *
 * <h3>Animation — 3 phases coordonnees, jamais statique</h3>
 *
 * <ol>
 *   <li><b>Boot sequence</b> au mount, joue UNE FOIS (~1.4s) :
 *     <ul>
 *       <li>0ms : centre fade-in + scale 0→1 (back-out 400ms)</li>
 *       <li>200ms : groupe "lignes" fade-in (opacity 0→0.35, 500ms ease-out)</li>
 *       <li>600ms+ : 8 nodes pop-in en stagger horaire (60ms d'ecart, back-out 350ms)</li>
 *     </ul>
 *   </li>
 *   <li><b>Idle constant</b> apres le boot, infini mais sub-perceptible :
 *     <ul>
 *       <li>Centre <i>breathing</i> : scale 1 ↔ 0.94, opacity 1 ↔ 0.88, cycle 4s</li>
 *       <li>8 nodes <i>active scan</i> : un node a la fois s'illumine et se
 *           decale radialement vers l'exterieur (~2.5 unites SVG). Rotation
 *           horaire complete en 6.4s.</li>
 *     </ul>
 *   </li>
 *   <li><b>Hover wave</b> au survol (~900ms) :
 *     <ul>
 *       <li>Centre pulse + drop-shadow glow ("thinking")</li>
 *       <li><b>Lignes absorbees vers le centre</b> via transition
 *           stroke-dashoffset 0→18 — le trait se retracte de l'exterieur
 *           vers l'interieur et disparait dans le node central. Reversible
 *           naturellement au hover-out (transition handle les deux sens).</li>
 *       <li>Ripple horaire vers les 8 nodes (radial translate + scale 1.5)</li>
 *     </ul>
 *   </li>
 * </ol>
 *
 * <h3>Architecture animation : pourquoi transition pour les lignes</h3>
 * <p>L'absorb des lignes utilise {@code transition} et non {@code animation}
 * parce qu'au hover-out on veut un retour symetrique smooth (line s'emerge
 * depuis le centre). Avec une animation, le hover-out aurait declenche un
 * snap brutal a l'etat de base (line visible instantanement). La transition
 * gere les deux sens automatiquement avec le meme easing.</p>
 *
 * <p>Le boot des lignes est deplace sur le groupe parent ({@code <g>}) via
 * une animation opacity 0→0.35 pour eviter le conflit animation/transition
 * sur le meme element (sinon le hover-out ferait potentiellement rejouer
 * le boot draw — bug visible).</p>
 */
export interface BaitlyMarkLogoLegacyProps {
  /** Facteur d'echelle multiplicatif. {@code 1} = icone 56px + wordmark 32px. */
  scale?: number;
  /**
   * Taille explicite en pixels pour l'icone (et le wordmark proportionnel).
   * Override scale s'il est defini. Utile quand un parent (ex: Sidebar) injecte
   * une size via {@code React.cloneElement} a la maniere des icones lucide.
   */
  size?: number;
  /** {@code "full"} (defaut) / {@code "mark"} (icone) / {@code "wordmark"} (typo). */
  variant?: 'full' | 'mark' | 'wordmark';
  /** {@code "auto"} suit le theme MUI. {@code "light"} / {@code "dark"} force. */
  tone?: 'auto' | 'light' | 'dark';
  /**
   * Etat "actif" pilote par le code : declenche la meme animation que :hover
   * (lines absorb, centre pulse-loop, nodes orbit). Utile pour signaler "l'IA
   * est en train de travailler" sans necessiter le survol souris. Hover manuel
   * et active prop coexistent (les deux declenchent l'animation).
   */
  active?: boolean;
  /**
   * Si false, desactive les animations idle (boot pop, scan node, centre
   * breathe). L'animation hover/active continue de fonctionner. Defaut true.
   * A mettre false quand le mark est rendu en grande quantite (ex: avatar
   * sur chaque message de chat) ou dans une sidebar toujours visible : le
   * scan en boucle creerait du visual noise constant.
   */
  idleAnimation?: boolean;
  /**
   * Desactive TOUTES les animations (idle + hover + active). Utile pour
   * screenshots, tests visuels, ou contextes ou tout mouvement est interdit.
   */
  disableAnimation?: boolean;
  /**
   * Source de couleur du mark :
   *   - {@code "accent"} (defaut) : suit la teinte selectionnee
   *     ({@code var(--accent)}) — le logo se reteinte quand l'utilisateur change
   *     d'accent. Pour les usages « brand » sur surface neutre/soft (sidebar,
   *     header badge, FAB).
   *   - {@code "inherit"} : suit la couleur du parent ({@code currentColor}).
   *     A utiliser quand le mark est pose sur un fond colore qui impose sa
   *     couleur de texte (ex : item de menu ACTIF a fond accent → mark blanc).
   */
  colorMode?: 'accent' | 'inherit';
}

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
const LINE_LENGTH = 18; // distance centre -> chaque node (rayon octogone)

const SCAN_CYCLE_MS = 6400;
const SCAN_NODE_SLICE_PCT = 100 / OCTAGON_NODES.length;

const RADIAL_DELTA_SCAN_IDLE = 2.5;

function radialTranslate(node: { x: number; y: number }, delta: number): { tx: string; ty: string } {
  const dx = node.x - CENTER.x;
  const dy = node.y - CENTER.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  return {
    tx: ((dx / len) * delta).toFixed(2),
    ty: ((dy / len) * delta).toFixed(2),
  };
}

export default function BaitlyMarkLogoLegacy({
  scale = 1,
  size,
  variant = 'full',
  tone = 'auto',
  active = false,
  idleAnimation = true,
  disableAnimation = false,
  colorMode = 'accent',
}: BaitlyMarkLogoLegacyProps) {
  const theme = useTheme();
  const uid = useId().replace(/:/g, '-');

  const resolvedTone =
    tone === 'auto' ? (theme.palette.mode === 'dark' ? 'dark' : 'light') : tone;

  // Couleur du mark :
  //  - colorMode 'inherit' → currentColor (suit la couleur du parent : utile sur
  //    fond coloré, ex item de menu actif accent → mark blanc).
  //  - sinon, tone 'auto' → suit l'accent sélectionné (var(--accent)/-deep) →
  //    le logo se reteinte en direct au changement de teinte.
  //  - tone FORCÉ (login photo-hero sombre) → palette fixe à fort contraste.
  // NB : les var()/currentColor passent par `style` inline (cf. SVG plus bas) ;
  // elles ne résolvent pas de façon fiable dans les attributs fill/stroke.
  const inherit = colorMode === 'inherit';
  const followAccent = tone === 'auto';
  const fixedDark = resolvedTone === 'dark';
  const markColor = inherit
    ? 'currentColor'
    : followAccent ? 'var(--accent)' : (fixedDark ? '#89B1C2' : '#6B8A9A');
  const centerColor = inherit
    ? 'currentColor'
    : followAccent ? 'var(--accent-deep)' : (fixedDark ? '#FFFFFF' : '#4A6B7B');
  const palette = {
    nodes: markColor,
    lines: markColor,
    center: centerColor,
    wordmark: inherit ? 'currentColor' : (fixedDark ? '#FFFFFF' : theme.palette.text.primary),
    linesOpacity: fixedDark ? 0.4 : 0.35,
  };

  // size override scale s'il est defini (pour matcher l'API icone-style ou
  // l'injection via React.cloneElement de la Sidebar).
  const iconSize = size ?? (56 * scale);
  const effectiveScale = iconSize / 56;
  const fontSize = 32 * effectiveScale;
  const gap = 14 * effectiveScale;

  const cls = {
    root: `clenzy-mark-root-${uid}`,
    svg: `clenzy-mark-svg-${uid}`,
    center: `clenzy-mark-center-${uid}`,
    linesGroup: `clenzy-mark-lines-group-${uid}`,
    line: `clenzy-mark-line-${uid}`,
    nodesGroup: `clenzy-mark-nodes-group-${uid}`,
    node: `clenzy-mark-node-${uid}`,
    // Modificateurs sur le root pour piloter le comportement via className
    active: `clenzy-mark-active-${uid}`,
    idleOff: `clenzy-mark-idle-off-${uid}`,
  };

  const mark = (
    <svg
      className={cls.svg}
      width={iconSize}
      height={iconSize}
      viewBox="0 0 56 56"
      fill="none"
      role="img"
      aria-label="Baitly"
      style={{ flexShrink: 0, overflow: 'visible' }}
    >
      {/* Group lines : boot animation deportee ici (fade-in opacity) pour
          eviter le conflit animation/transition sur <line>. */}
      <g className={cls.linesGroup} strokeWidth="1" style={{ stroke: palette.lines }}>
        {OCTAGON_NODES.map((n, i) => (
          <line
            key={`l-${i}`}
            className={`${cls.line} ${cls.line}-${i}`}
            x1={CENTER.x} y1={CENTER.y} x2={n.x} y2={n.y}
          />
        ))}
      </g>
      {/* Group nodes : permet le orbit rotation au hover via transform sur
          le <g> (transform-origin: 28px 28px = centre du mark). Sans ce
          wrapper il aurait fallu animer chaque node individuellement avec
          des keyframes calcules en coordonnees polaires. */}
      <g className={cls.nodesGroup} style={{ fill: palette.nodes }}>
        {OCTAGON_NODES.map((n, i) => (
          <circle
            key={`n-${i}`}
            className={`${cls.node} ${cls.node}-${i}`}
            cx={n.x} cy={n.y} r="2.5"
          />
        ))}
      </g>
      <circle className={cls.center} cx={CENTER.x} cy={CENTER.y} r="4.5" style={{ fill: palette.center }} />
    </svg>
  );

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
      baitly
    </span>
  );

  const buildScanKeyframes = (i: number, node: typeof OCTAGON_NODES[number]): string => {
    const peakPct = i * SCAN_NODE_SLICE_PCT + SCAN_NODE_SLICE_PCT / 2;
    const startPct = Math.max(0, peakPct - SCAN_NODE_SLICE_PCT / 2);
    const endPct = Math.min(100, peakPct + SCAN_NODE_SLICE_PCT / 2);
    const { tx, ty } = radialTranslate(node, RADIAL_DELTA_SCAN_IDLE);
    return `
      @keyframes ${cls.node}-scan-${i} {
        0%, ${startPct.toFixed(2)}% { transform: translate(0, 0) scale(1); filter: brightness(1); }
        ${peakPct.toFixed(2)}%       { transform: translate(${tx}px, ${ty}px) scale(1.12); filter: brightness(1.3); }
        ${endPct.toFixed(2)}%, 100%  { transform: translate(0, 0) scale(1); filter: brightness(1); }
      }
    `;
  };

  const animationCss = !disableAnimation ? `
    /* ─── Boot : centre + groupe lines + nodes ──────────────────────── */
    .${cls.center} {
      transform-origin: ${CENTER.x}px ${CENTER.y}px;
      animation:
        ${cls.center}-boot 400ms cubic-bezier(0.34, 1.56, 0.64, 1) both,
        ${cls.center}-breathe 4s ease-in-out 1500ms infinite;
    }
    .${cls.linesGroup} {
      opacity: 0;
      animation: ${cls.linesGroup}-fade 500ms ease-out 200ms forwards;
    }
    .${cls.nodesGroup} {
      transform-origin: ${CENTER.x}px ${CENTER.y}px;
    }
    .${cls.node} {
      transform-box: fill-box;
      transform-origin: center;
      opacity: 0;
    }
    ${OCTAGON_NODES.map((_, i) => `
      .${cls.node}-${i} {
        animation:
          ${cls.node}-pop 350ms cubic-bezier(0.34, 1.56, 0.64, 1) ${300 + i * 60}ms both,
          ${cls.node}-scan-${i} ${SCAN_CYCLE_MS}ms ease-in-out ${1400 + i * 80}ms infinite;
      }
    `).join('')}

    /* ─── Lines : etat de base + transition pour hover absorb ────────── */
    .${cls.line} {
      stroke-dasharray: ${LINE_LENGTH};
      stroke-dashoffset: 0;
      transition: stroke-dashoffset 450ms cubic-bezier(0.4, 0, 0.2, 1);
    }
    /* Per-line transition-delay : cree le cascade au hover-out, SYNCHRONISE
       avec le node pop replay (meme formule ${300}+i*60ms). Quand l'user
       sort du hover, chaque pair (line + node) re-emerge ensemble dans
       l'ordre horaire. Le 300ms initial donne le temps au hover-out de
       lire visuellement avant que le cascade commence. */
    ${OCTAGON_NODES.map((_, i) => `
      .${cls.line}-${i} { transition-delay: ${300 + i * 60}ms; }
    `).join('')}

    /* ─── Idle off : kill boot+scan+breathe (idleAnimation=false) ────── */
    /* Pour les usages ou le mark est rendu en grande quantite (avatar de
       chaque message chat, sidebar always visible). Hover/active continuent
       de fonctionner. */
    .${cls.root}.${cls.idleOff} .${cls.center} {
      animation: none;
      opacity: 1;
      transform: none;
    }
    .${cls.root}.${cls.idleOff} .${cls.linesGroup} {
      animation: none;
      opacity: ${palette.linesOpacity};
    }
    .${cls.root}.${cls.idleOff} .${cls.node} {
      animation: none;
      opacity: 1;
    }

    /* ─── Hover OR active : meme animation declenchee par survol souris
       OU par le prop active={true} (IA travaille). Les deux selecteurs
       sont combines pour partager les memes keyframes. ─────────────── */

    /* Centre : pulse-loop infini (1.4s, scale 1->1.25, drop-shadow glow).
       Demarre 450ms apres le declenchement (= duree absorb des lignes). */
    .${cls.root}:hover .${cls.center},
    .${cls.root}.${cls.active} .${cls.center} {
      animation:
        ${cls.center}-boot 400ms cubic-bezier(0.34, 1.56, 0.64, 1) both,
        ${cls.center}-pulse-loop 1.4s ease-in-out 450ms infinite;
    }
    /* Lignes : dashoffset transite vers ${LINE_LENGTH} => le trait se
       retracte depuis l'exterieur vers le centre. Reverse au desactive. */
    .${cls.root}:hover .${cls.line},
    .${cls.root}.${cls.active} .${cls.line} {
      stroke-dashoffset: ${LINE_LENGTH};
      transition-delay: 0ms;
    }
    /* Group nodes : orbite 360deg en 6s lineaire, demarre apres absorb. */
    .${cls.root}:hover .${cls.nodesGroup},
    .${cls.root}.${cls.active} .${cls.nodesGroup} {
      animation: ${cls.nodesGroup}-orbit 6s linear 450ms infinite;
    }
    /* Nodes individuels : animation:none pour laisser le orbit du group
       prendre le relais. opacity:1 explicite (sinon revient au base). */
    ${OCTAGON_NODES.map((_, i) => `
      .${cls.root}:hover .${cls.node}-${i},
      .${cls.root}.${cls.active} .${cls.node}-${i} {
        opacity: 1;
        animation: none;
      }
    `).join('')}

    /* ─── Keyframes : boot ───────────────────────────────────────────── */
    @keyframes ${cls.center}-boot {
      0%   { transform: scale(0);   opacity: 0; }
      100% { transform: scale(1);   opacity: 1; }
    }
    @keyframes ${cls.linesGroup}-fade {
      0%   { opacity: 0; }
      100% { opacity: ${palette.linesOpacity}; }
    }
    @keyframes ${cls.node}-pop {
      0%   { transform: translate(0, 0) scale(0);   opacity: 0; }
      60%  { transform: translate(0, 0) scale(1.4); opacity: 1; }
      100% { transform: translate(0, 0) scale(1);   opacity: 1; }
    }

    /* ─── Keyframes : idle constant ──────────────────────────────────── */
    @keyframes ${cls.center}-breathe {
      0%, 100% { transform: scale(1);    opacity: 1; }
      50%      { transform: scale(0.94); opacity: 0.88; }
    }
    ${OCTAGON_NODES.map((node, i) => buildScanKeyframes(i, node)).join('')}

    /* ─── Keyframes : hover (centre pulse + nodes orbit) ─────────────── */
    /* Pulse loop : 1.4s par cycle, peak a 50% (scale 1.25, glow 8px).
       Demarre 450ms apres le hover (post-absorb des lignes), tourne en
       boucle tant que hover. Visuel "orchestrator processing actively". */
    @keyframes ${cls.center}-pulse-loop {
      0%, 100% { transform: scale(1);    filter: brightness(1)   drop-shadow(0 0 0 transparent); }
      50%      { transform: scale(1.25); filter: brightness(1.4) drop-shadow(0 0 8px currentColor); }
    }
    /* Orbit : rotation horaire 360deg en 6s, lineaire (vitesse constante).
       Group transform-origin = centre du mark => les nodes tournent autour
       du centre qui pulse. Sync avec le pulse-loop : tous les deux demarrent
       a 450ms post-hover (apres absorb des lignes), narratif coherent
       "orchestrator dispatching, agents orbiting in coordination". */
    @keyframes ${cls.nodesGroup}-orbit {
      from { transform: rotate(0deg); }
      to   { transform: rotate(360deg); }
    }

    /* ─── prefers-reduced-motion : tout kill (idle + hover + active) ─── */
    @media (prefers-reduced-motion: reduce) {
      .${cls.center},
      .${cls.linesGroup},
      .${cls.line},
      .${cls.nodesGroup},
      .${cls.node},
      .${cls.root}:hover .${cls.center},
      .${cls.root}:hover .${cls.line},
      .${cls.root}:hover .${cls.nodesGroup},
      .${cls.root}:hover .${cls.node},
      .${cls.root}.${cls.active} .${cls.center},
      .${cls.root}.${cls.active} .${cls.line},
      .${cls.root}.${cls.active} .${cls.nodesGroup},
      .${cls.root}.${cls.active} .${cls.node} {
        animation: none !important;
        transition: none !important;
        opacity: 1 !important;
        transform: none !important;
        stroke-dashoffset: 0 !important;
        stroke-dasharray: none !important;
        filter: none !important;
      }
      .${cls.linesGroup} { opacity: ${palette.linesOpacity} !important; }
    }
  ` : '';

  const content =
    variant === 'mark' ? mark :
    variant === 'wordmark' ? wordmark :
    <>{mark}{wordmark}</>;

  // Compose className based on behavior props.
  // - active : ajoute .active => declenche l'animation hover-equivalent
  // - !idleAnimation : ajoute .idle-off => kill boot/scan/breathe
  const rootClassName = [
    cls.root,
    active && cls.active,
    !idleAnimation && cls.idleOff,
  ].filter(Boolean).join(' ');

  return (
    <>
      {!disableAnimation && <style>{animationCss}</style>}
      <Box
        className={rootClassName}
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
