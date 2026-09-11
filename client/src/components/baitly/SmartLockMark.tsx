import React from 'react';
import { cn } from '../../utils/cn';
import './deviceAlert.css';

/** Rapport de la maquette d'origine (viewBox 260 × 420), poignée comprise. */
const VIEWBOX = '0 0 260 420';
const RATIO = 420 / 260;

export interface SmartLockMarkProps {
  /**
   * Couleur du signal — diode et arcs de connectivité. C'est la SEULE couleur
   * de la serrure : le reste est neutre, pour que la teinte porte l'état et
   * rien d'autre. Défaut : l'accent produit.
   */
  signal?: string;
  /** Largeur en px ; la hauteur suit le rapport de la maquette. Défaut 78. */
  width?: number;
  className?: string;
}

/**
 * Serrure connectée, de face, poignée animée.
 *
 * <p>Géométrie et mouvements repris de {@code assets/logo/smart-lock-animation.html},
 * une maquette autonome qui n'était branchée nulle part. Deux écarts assumés :
 * elle était peinte à l'ancienne palette Clenzy (bleu-gris et or, en dégradés)
 * et dimensionnée pour une page vitrine. Ici elle est NEUTRE et compacte, parce
 * qu'elle accompagne un texte.</p>
 *
 * <p><b>Deux tons, pas trois.</b> Le châssis et la ferronnerie sont
 * {@code --bui-muted-foreground} (opacité variable), la platine
 * {@code --bui-card}. Surtout PAS {@code --bui-field} pour le corps : ce jeton
 * vaut exactement {@code --bui-muted} dans les deux thèmes (#EEF3F7 en clair,
 * #16223A en sombre) — posé sur le panneau `bg-muted` de la fiche, le corps de
 * la serrure aurait disparu.</p>
 *
 * <p>Ce que le mouvement dit : le levier tourne, la diode et les arcs battent.
 * La serrure fonctionne encore — et chaque tour puise dans ce qu'il reste de
 * pile. {@code prefers-reduced-motion} fige le tout sans rien retirer.</p>
 */
export default function SmartLockMark({
  signal = 'var(--bui-primary)',
  width = 78,
  className,
}: SmartLockMarkProps) {
  const metal = 'var(--bui-muted-foreground)';
  const plate = 'var(--bui-card)';

  return (
    <svg
      viewBox={VIEWBOX}
      width={width}
      height={Math.round(width * RATIO)}
      className={cn('shrink-0', className)}
      aria-hidden="true"
    >
      {/* Châssis */}
      <rect x="25" y="30" width="150" height="370" rx="16" fill={metal} fillOpacity="0.45" />
      {/* Platine */}
      <rect x="36" y="41" width="128" height="348" rx="11" fill={plate} />

      {/* Écran du clavier */}
      <rect x="58" y="95" width="84" height="55" rx="6" fill={metal} fillOpacity="0.16" />

      {/* Connectivité : trois arcs qui battent en décalé. */}
      <g transform="translate(100, 132)" fill="none" stroke={signal} strokeWidth="3" strokeLinecap="round">
        <circle cx="0" cy="0" r="3" fill={signal} stroke="none" />
        <path className="bui-lock-arc" d="M-8,-7 a11,11 0 0,1 16,0" />
        <path className="bui-lock-arc bui-lock-arc--2" d="M-14,-12 a19,19 0 0,1 28,0" />
        <path className="bui-lock-arc bui-lock-arc--3" d="M-20,-17 a27,27 0 0,1 40,0" />
      </g>

      {/* Diode d'état */}
      <circle className="bui-lock-led" cx="100" cy="170" r="5.5" fill={signal} />

      {/* Trou de serrure */}
      <g fill={metal} fillOpacity="0.6">
        <circle cx="100" cy="305" r="8" />
        <path d="M96,309 L93,323 Q100,326 107,323 L104,309 Z" />
      </g>

      {/* Poignée : la rosette est un anneau sur la platine, le levier pivote
          autour d'elle. Tout le groupe tourne — les cercles concentriques ne
          le trahissent pas, seul le levier se voit bouger. */}
      <g className="bui-lock-handle">
        <circle cx="100" cy="230" r="28" fill={plate} stroke={metal} strokeOpacity="0.45" strokeWidth="3" />

        <rect x="94" y="213" width="140" height="34" rx="17" fill={metal} />
        <circle cx="230" cy="230" r="23" fill={metal} />

        <circle cx="100" cy="230" r="12" fill={metal} />
        <circle cx="100" cy="230" r="4.5" fill={plate} />
      </g>
    </svg>
  );
}
