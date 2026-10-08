import * as React from 'react';
import { CheckIcon } from '../../icons/glyphs';
import { cn } from '../../utils/cn';
import { usePrefersReducedMotion } from './ShowcaseCycler';
import './firstUseStage.css';

/**
 * Baitly — scène des écrans de première arrivée.
 *
 * Un écran vide a un seul travail : faire comprendre en un regard ce que
 * l'écran fera une fois rempli. Ce kit le fait avec l'image et le schéma — la
 * phrase se réduit au titre, à une ligne et aux deux gestes attendus.
 *
 *  - {@link FirstUseStage}  : le décor, la promesse à gauche, le schéma à droite,
 *                             le rail en pied ;
 *  - {@link StageCard}      : la carte qui porte l'aperçu ;
 *  - {@link Packshot}       : une illustration générée, en tuile ou flottante ;
 *  - {@link StageRail}      : les étapes, en images, qui PILOTENT l'aperçu ;
 *  - {@link useStageScene}  : la scène active, son défilement, sa reprise en main.
 *
 * Deux thèmes : carte blanche aux textes bleu nuit en thème clair, îlot bleu nuit
 * (celui de la sidebar) en thème sombre. Tout passe par les variables `--ns-*`
 * de `firstUseStage.css` : un aperçu qui n'écrit aucune couleur en dur suit les
 * deux thèmes sans règle dédiée.
 */

// ─── Scène active ───────────────────────────────────────────────────────────

export interface StageSceneState {
  scene: number;
  select: (index: number) => void;
  /** `true` tant que le défilement automatique n'a pas été interrompu. */
  auto: boolean;
  /** Durée d'une scène, en ms — la liaison du rail se remplit sur ce laps. */
  interval: number;
  /** À brancher sur `onFocusCapture` du schéma : toucher à l'aperçu = reprendre la main. */
  takeOver: () => void;
}

/**
 * Les scènes défilent seules, **jusqu'à ce que l'utilisateur en choisisse une** :
 * on ne se bat pas avec lui. Sous `prefers-reduced-motion: reduce` rien ne
 * défile — la première scène reste affichée et les autres restent accessibles.
 */
export function useStageScene(count: number, interval = 5200): StageSceneState {
  const reducedMotion = usePrefersReducedMotion();
  const [scene, setScene] = React.useState(0);
  const [interacted, setInteracted] = React.useState(false);

  React.useEffect(() => {
    if (interacted || reducedMotion || count < 2) return;
    const id = window.setInterval(() => setScene((current) => (current + 1) % count), interval);
    return () => window.clearInterval(id);
  }, [interacted, reducedMotion, count, interval]);

  const select = React.useCallback((index: number) => {
    setInteracted(true);
    setScene(index);
  }, []);
  const takeOver = React.useCallback(() => setInteracted(true), []);

  return { scene, select, auto: !interacted && !reducedMotion && count > 1, interval, takeOver };
}

// ─── Illustration ───────────────────────────────────────────────────────────

export interface PackshotProps {
  src: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  /** Sans tuile : l'objet flotte sur le fond nuit (réservé aux fichiers à fond transparent). */
  bare?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/** Les vignettes HITL et notifications ont un fond bleu-gris opaque : elles remplissent la tuile. */
const isOpaqueArtwork = (src: string) => /\/images\/(hitl|notifications)\//.test(src);

export function Packshot({ src, size = 'md', bare, className, style }: PackshotProps) {
  return (
    <span
      aria-hidden
      data-bare={bare || undefined}
      data-fit={isOpaqueArtwork(src) && !bare ? 'cover' : 'contain'}
      className={cn('ns-pack', size !== 'md' && `ns-pack--${size}`, className)}
      style={style}
    >
      <img src={src} alt="" loading="lazy" decoding="async" draggable={false} />
    </span>
  );
}

/** Une illustration qui flotte au bord d'une carte. Position et inclinaison par `style`/`className`. */
export function Floater({
  delay = 0,
  rotate = 0,
  className,
  style,
  ...pack
}: PackshotProps & { delay?: number; rotate?: number }) {
  return (
    <span
      aria-hidden
      className={cn('ns-float', className)}
      style={{ '--d': `${delay}s`, '--r': `${rotate}deg`, ...style } as React.CSSProperties}
    >
      <Packshot {...pack} />
    </span>
  );
}

// ─── Carte d'aperçu ─────────────────────────────────────────────────────────

export function StageCard({
  icon,
  title,
  aside,
  children,
  className,
}: {
  icon?: React.ReactNode;
  title?: React.ReactNode;
  /** À droite de l'en-tête : une pastille d'état, un compteur… */
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('ns-card', className)}>
      {(icon || title || aside) && (
        <div className="ns-card-head">
          {icon && <span className="inline-flex text-[var(--ns-brass)] [&>svg]:size-4">{icon}</span>}
          {title && <span className="min-w-0 truncate">{title}</span>}
          <span className="ns-spacer" />
          {aside}
        </div>
      )}
      {children}
    </div>
  );
}

// ─── Rail d'étapes ──────────────────────────────────────────────────────────

export interface RailStep {
  key: string;
  /** Un ou deux mots : l'image porte le sens. */
  label: string;
  image: string;
}

export interface StageRailProps {
  steps: RailStep[];
  scene: StageSceneState;
  /** Nom accessible du schéma. */
  label: string;
}

export function StageRail({ steps, scene, label }: StageRailProps) {
  return (
    <ol
      className="ns-rail"
      aria-label={label}
      data-auto={scene.auto}
      style={{ '--ns-interval': `${scene.interval}ms` } as React.CSSProperties}
    >
      {steps.map((step, index) => {
        const active = index === scene.scene;
        return (
          <li key={step.key} className="ns-rail-item" data-active={active || undefined} data-done={index < scene.scene || undefined}>
            <button type="button" className="ns-rail-btn" aria-current={active ? 'step' : undefined} onClick={() => scene.select(index)}>
              <span className="ns-rail-media">
                <Packshot src={step.image} />
                <span className="ns-rail-num" aria-hidden>{index + 1}</span>
              </span>
              <span className="ns-rail-label">{step.label}</span>
            </button>
            {index < steps.length - 1 && (
              <span className="ns-rail-link" aria-hidden>
                {/* `key` : relance le remplissage à chaque changement de scène. */}
                <span key={`${index}-${scene.scene}`} className="ns-rail-fill" />
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

// ─── Scène complète ─────────────────────────────────────────────────────────

export interface FirstUseStageProps {
  icon?: React.ReactNode;
  eyebrow: React.ReactNode;
  /** La promesse de l'écran — une phrase courte, jamais un constat de vide. */
  title: React.ReactNode;
  /** Optionnelle : une ligne, pas un paragraphe. */
  lede?: React.ReactNode;
  actions?: React.ReactNode;
  /** Sous les gestes : bande de logos, pastilles… */
  extra?: React.ReactNode;
  /** Le schéma, à droite. Sans lui, la promesse occupe toute la largeur. */
  visual?: React.ReactNode;
  /** Le rail d'étapes, en pied. */
  rail?: React.ReactNode;
  /** Appelé quand le focus entre dans le schéma : l'utilisateur reprend la main. */
  onVisualFocus?: () => void;
  headingId?: string;
  className?: string;
}

export function FirstUseStage({
  icon,
  eyebrow,
  title,
  lede,
  actions,
  extra,
  visual,
  rail,
  onVisualFocus,
  headingId,
  className,
}: FirstUseStageProps) {
  return (
    <div className="ns-root">
      <section data-stage className={cn('ns', className)} aria-labelledby={headingId}>
        <div className="ns-grid" data-solo={!visual || undefined}>
          <div className="ns-copy">
            {(eyebrow || icon) && (
              <p className="ns-eyebrow">
                {icon && <span className="ns-eyebrow-icon">{icon}</span>}
                {eyebrow}
              </p>
            )}
            <h2 id={headingId} className="cn-font-heading ns-title">{title}</h2>
            {lede && <p className="ns-lede">{lede}</p>}
            {actions && <div className="ns-actions">{actions}</div>}
            {extra}
          </div>
          {visual && <div className="ns-visual" onFocusCapture={onVisualFocus}>{visual}</div>}
        </div>
        {rail}
      </section>
    </div>
  );
}

/** Pied de scène : une ligne rassurante et, au besoin, la sortie de secours. */
export function StageFoot({ note, children }: { note?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="ns-foot">
      {note ? (
        <span className="ns-foot-note">
          <CheckIcon aria-hidden />
          {note}
        </span>
      ) : <span />}
      {children}
    </div>
  );
}
