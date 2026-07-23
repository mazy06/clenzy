import React, { useId } from 'react';
import { Box, useTheme } from '@mui/material';

/**
 * Logo Baitly SaaS — nouveau mark « maison + flux » + wordmark Space Grotesk.
 *
 * <h3>Concept</h3>
 * Une maison stylisée (le logement géré) tracée en un seul trait continu, sur
 * laquelle circulent deux « packets » de données : un aller <b>request</b>
 * (bleu {@code #2563EB}) et un retour <b>response</b> (teal {@code #14B8A6}).
 * Le va-et-vient évoque la synchronisation permanente entre le logement et les
 * canaux (OTA, channel manager, guests) — cœur du PMS. Ce mark remplace
 * l'ancien « 8 nodes orchestration », préservé dans {@link BaitlyMarkLogoLegacy}.
 *
 * <h3>Typo</h3>
 * Wordmark « baitly » en <b>Space Grotesk 600</b> (inchangé — pairing
 * « Tech Startup », skill {@code ui-ux-pro-max}).
 *
 * <h3>Animation</h3>
 * <ul>
 *   <li><b>Idle infini</b> : le packet request avance le long du tracé (première
 *       moitié du cycle) puis le packet response revient (seconde moitié).
 *       Cycle {@code --bl-cycle} = 5s, linéaire, jamais statique.</li>
 *   <li><b>prefers-reduced-motion</b> : les packets sont masqués, seul le mark
 *       (trait maison) reste — logo parfaitement lisible et immobile.</li>
 * </ul>
 *
 * <h3>Compat API</h3>
 * L'interface de props est identique à l'ancien composant : tous les
 * consommateurs (Sidebar, AuthLayout, AssistantWidget, Inscription…) continuent
 * de fonctionner sans changement. Le mapping des props :
 * <ul>
 *   <li>{@code variant} : {@code mark} (maison) / {@code wordmark} (typo) /
 *       {@code full} (les deux).</li>
 *   <li>{@code size} / {@code scale} : dimensionnement (mark carré + wordmark
 *       proportionnel), identique à l'ancien.</li>
 *   <li>{@code tone} / {@code colorMode} : couleur du trait du mark (accent /
 *       inherit / tone forcé), identique à l'ancien. Les packets gardent leurs
 *       teintes signature bleu/teal quelle que soit la teinte.</li>
 *   <li>{@code active} / {@code idleAnimation} / {@code disableAnimation} :
 *       {@code disableAnimation} ou {@code idleAnimation=false} figent le logo
 *       (packets masqués, trait seul). {@code active} est accepté (compat) mais
 *       n'a pas d'effet distinct : le flux tourne déjà en continu.</li>
 * </ul>
 */
export interface BaitlyMarkLogoProps {
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
   * Compat API (ancien logo) : signalait « l'IA travaille » en déclenchant
   * l'animation hover. Le nouveau mark anime son flux en continu ; ce prop est
   * accepté mais sans effet distinct.
   */
  active?: boolean;
  /**
   * Si false, fige le logo : les packets sont masqués, seul le trait maison
   * reste. Utile quand le mark est rendu en grande quantité (avatar de chaque
   * message chat, sidebar toujours visible) pour éviter le mouvement constant.
   */
  idleAnimation?: boolean;
  /**
   * Desactive TOUTE animation (equivalent a {@code idleAnimation=false} ici :
   * trait maison seul, packets masques). Utile pour screenshots / tests visuels.
   */
  disableAnimation?: boolean;
  /**
   * Source de couleur du <b>trait de la maison</b> :
   *   - {@code "accent"} (defaut) : suit la teinte selectionnee
   *     ({@code var(--accent)}) — le logo se reteinte au changement d'accent.
   *   - {@code "inherit"} : suit la couleur du parent ({@code currentColor}).
   *     A utiliser sur fond colore qui impose sa couleur de texte (ex : item de
   *     menu ACTIF a fond accent → trait blanc).
   * Les packets request/response gardent leurs teintes bleu/teal signature.
   */
  colorMode?: 'accent' | 'inherit';
}

/**
 * Tracé de la maison en un trait continu, dessiné dans un viewBox 1024.
 * Les deux packets réutilisent exactement ce même path (ils circulent dessus).
 */
const MARK_PATH =
  'M463 590.25 A30.25 30.25 0 0 1 463 529.75 A30.25 30.25 0 0 1 463 590.25 V710 ' +
  'A30 30 0 0 1 433 740 H368 A65 65 0 0 1 303 675 V441.8 A28 28 0 0 1 313.9 419.6 ' +
  'L478.2 294.1 A54 54 0 0 1 543.8 294.1 L708.1 419.6 A28 28 0 0 1 719 441.8 V675 ' +
  'A65 65 0 0 1 654 740 H589 A30 30 0 0 1 559 710 V590.25 A30.25 30.25 0 0 1 559 529.75 ' +
  'A30.25 30.25 0 0 1 559 590.25';

// viewBox resserré sur les limites du tracé (maison ~x[293,730] y[273,751] avec
// demi-épaisseur de trait) pour que le mark remplisse la boîte comme l'ancien
// octogone, sans padding excessif hérité du canvas 1024 d'origine.
const MARK_VIEWBOX = '251 251 522 522';

// Épaisseur de trait en unités du viewBox 1024 (identique au SVG source).
const STROKE_WIDTH = 21;

/**
 * Teintes signature du flux de données (request bleu / response ambre —
 * complémentaire du bleu, jamais confondable avec le trait vert-gris de la
 * maison), déclinées PAR token de couleur du trait pour rester lisibles :
 *  - `light`  : trait #6B8A9A (ou accent) sur fond clair → paire foncée et
 *    saturée, qui se détache du trait ET du fond clair.
 *  - `dark`   : trait #89B1C2 sur fond sombre → paire claire et vive, qui
 *    ressort du fond sombre sans se confondre avec le trait pastel.
 *  - `inherit`: trait currentColor (typiquement blanc sur fond accent) →
 *    même paire vive que `dark` : distincte du blanc et du fond mi-teinte.
 */
const PACKET_COLORS: Record<'light' | 'dark' | 'inherit', { request: string; response: string }> = {
  light: { request: '#2563EB', response: '#D97706' },
  dark: { request: '#60A5FA', response: '#FBBF24' },
  inherit: { request: '#60A5FA', response: '#FBBF24' },
};
const CYCLE_MS = 5000;

export default function BaitlyMarkLogo({
  scale = 1,
  size,
  variant = 'full',
  tone = 'auto',
  active: _active = false,
  idleAnimation = true,
  disableAnimation = false,
  colorMode = 'accent',
}: BaitlyMarkLogoProps) {
  const theme = useTheme();
  const uid = useId().replace(/:/g, '-');

  const resolvedTone =
    tone === 'auto' ? (theme.palette.mode === 'dark' ? 'dark' : 'light') : tone;

  // Couleur du trait de la maison — même logique que l'ancien logo pour garder
  // la compat des props tone/colorMode :
  //  - colorMode 'inherit' → currentColor (suit le parent : fond accent → blanc).
  //  - tone 'auto' → suit l'accent sélectionné (var(--accent)) → reteinte live.
  //  - tone FORCÉ (login photo-hero sombre) → palette fixe à fort contraste.
  const inherit = colorMode === 'inherit';
  const followAccent = tone === 'auto';
  const fixedDark = resolvedTone === 'dark';
  const markColor = inherit
    ? 'currentColor'
    : followAccent ? 'var(--accent)' : (fixedDark ? '#89B1C2' : '#6B8A9A');
  const wordmarkColor = inherit
    ? 'currentColor'
    : (fixedDark ? '#FFFFFF' : theme.palette.text.primary);

  // size override scale s'il est defini (API icone-style / injection Sidebar).
  const iconSize = size ?? (56 * scale);
  const effectiveScale = iconSize / 56;
  const fontSize = 32 * effectiveScale;
  const gap = 14 * effectiveScale;

  // Les packets ne s'animent que si les animations idle sont actives.
  const animated = !disableAnimation && idleAnimation;

  // Paire request/response adaptée au token de couleur du trait :
  //  - trait qui suit l'accent (tone auto) → variables --accent-flow-* définies
  //    PAR teinte dans tokens.css (accent indigo → request cyan, etc.), avec la
  //    paire statique du tone résolu en repli.
  //  - inherit (fond accent) ou tone forcé → paire statique PACKET_COLORS.
  const staticColors = PACKET_COLORS[inherit ? 'inherit' : resolvedTone];
  const packetColors = !inherit && followAccent
    ? {
        request: `var(--accent-flow-request, ${staticColors.request})`,
        response: `var(--accent-flow-response, ${staticColors.response})`,
      }
    : staticColors;

  const cls = {
    root: `baitly-mark-root-${uid}`,
    mark: `baitly-mark-stroke-${uid}`,
    packet: `baitly-mark-packet-${uid}`,
    request: `baitly-mark-request-${uid}`,
    response: `baitly-mark-response-${uid}`,
  };

  const strokeBase: React.CSSProperties = {
    fill: 'none',
    strokeWidth: STROKE_WIDTH,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  };

  const mark = (
    <svg
      className={cls.root}
      width={iconSize}
      height={iconSize}
      viewBox={MARK_VIEWBOX}
      fill="none"
      role="img"
      aria-label="Baitly"
      style={{ flexShrink: 0, overflow: 'visible', color: markColor }}
    >
      {animated && (
        <style>{`
          .${cls.packet} {
            fill: none;
            /* Legerement plus epais que le trait maison : le packet "chevauche"
               le trace et reste lisible aux petites tailles (18-24px). */
            stroke-width: ${STROKE_WIDTH + 6};
            stroke-linecap: round;
            stroke-linejoin: round;
            stroke-dasharray: 9 400;
            stroke-dashoffset: 10;
          }
          .${cls.request}  { stroke: ${packetColors.request}; }
          .${cls.response} { stroke: ${packetColors.response}; }
          @keyframes ${cls.request}-forward {
            0%   { stroke-dashoffset: 10; }
            45%  { stroke-dashoffset: -100; }
            100% { stroke-dashoffset: -100; }
          }
          @keyframes ${cls.response}-backward {
            0%   { stroke-dashoffset: -100; }
            50%  { stroke-dashoffset: -100; }
            95%  { stroke-dashoffset: 10; }
            100% { stroke-dashoffset: 10; }
          }
          @media (prefers-reduced-motion: no-preference) {
            .${cls.request}  { animation: ${cls.request}-forward  ${CYCLE_MS}ms linear infinite; }
            .${cls.response} { animation: ${cls.response}-backward ${CYCLE_MS}ms linear infinite; }
          }
          @media (prefers-reduced-motion: reduce) {
            .${cls.packet} { display: none; }
          }
        `}</style>
      )}

      {/* Trait maison — couleur pilotée par `color` inline (currentColor). */}
      <path className={cls.mark} d={MARK_PATH} style={{ ...strokeBase, stroke: 'currentColor' }} />

      {/* Packets de données (masqués si animations désactivées). */}
      {animated && (
        <>
          <path
            className={`${cls.packet} ${cls.request}`}
            pathLength={100}
            d={MARK_PATH}
          />
          <path
            className={`${cls.packet} ${cls.response}`}
            pathLength={100}
            d={MARK_PATH}
          />
        </>
      )}
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
        color: wordmarkColor,
        direction: 'ltr',
        whiteSpace: 'nowrap',
      }}
    >
      baitly
    </span>
  );

  const content =
    variant === 'mark' ? mark :
    variant === 'wordmark' ? wordmark :
    <>{mark}{wordmark}</>;

  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: variant === 'full' ? `${gap}px` : 0,
      }}
    >
      {content}
    </Box>
  );
}
