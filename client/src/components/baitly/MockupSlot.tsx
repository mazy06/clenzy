import * as React from 'react';
import { cn } from '../../utils/cn';
import { usePrefersReducedMotion } from './ShowcaseCycler';

/**
 * Baitly — emplacement réservé à un mockup animé.
 *
 * Les états vides du PMS montrent aujourd'hui un aperçu statique en barres de
 * squelette. À terme chacun recevra une **animation** qui démontre l'écran. Ce
 * composant réserve la place dès maintenant :
 *
 *  - **tant qu'il n'y a pas d'animation**, il rend le `poster` (l'aperçu
 *    statique actuel) — donc rien ne régresse ;
 *  - **quand l'animation arrive**, on la passe en `children` sans toucher à
 *    l'écran ni à sa mise en page ;
 *  - sous `prefers-reduced-motion: reduce`, il rend le `poster` **même si**
 *    l'animation existe. Le repli est donc un vrai rendu utile, pas un carré vide.
 *
 * Volontairement **agnostique du format** : `children` accepte aussi bien une
 * `<video>` en boucle, un lecteur Lottie, un SVG animé ou un `ShowcaseCycler`.
 * Le format sera tranché quand les animations seront produites — sans avoir à
 * repasser sur les écrans.
 *
 * Le `brief` n'est pas affiché : il documente, dans le code, ce que l'animation
 * doit montrer. Les emplacements se retrouvent avec `grep MockupSlot`, et la
 * liste complète des briefs est dans
 * `analyse-concurrentielle/46-teardown-guesty-produit.md`.
 *
 * Usage :
 *   <MockupSlot
 *     ratio="16/10"
 *     brief="Une réservation glisse sur le planning et se synchronise vers Airbnb."
 *     poster={<CalendarPreview />}
 *   />
 */
export interface MockupSlotProps {
  /** L'animation, quand elle existera. Absente → `poster`. */
  children?: React.ReactNode;
  /** Rendu statique : repli sans animation, et sous `prefers-reduced-motion`. */
  poster: React.ReactNode;
  /**
   * Ratio réservé (ex. `"16/10"`). À renseigner **dès que le format de
   * l'animation est connu** : c'est ce qui évite le saut de mise en page le jour
   * où on la branche. Sans lui, la hauteur suit le contenu.
   */
  ratio?: string;
  /** Ce que l'animation doit démontrer. Documentaire — jamais rendu à l'écran. */
  brief?: string;
  className?: string;
}

export default function MockupSlot({
  children,
  poster,
  ratio,
  brief,
  className,
}: MockupSlotProps) {
  const reducedMotion = usePrefersReducedMotion();
  const showAnimation = Boolean(children) && !reducedMotion;

  return (
    <div
      data-slot="mockup"
      data-mockup-brief={brief}
      data-mockup-state={showAnimation ? 'animated' : 'poster'}
      className={cn(ratio && 'overflow-hidden', className)}
      style={ratio ? { aspectRatio: ratio } : undefined}
    >
      {showAnimation ? children : poster}
    </div>
  );
}
