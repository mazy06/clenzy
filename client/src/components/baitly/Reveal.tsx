import * as React from 'react';
import { cn } from '../../utils/cn';

/**
 * Baitly — entrée en scène échelonnée.
 *
 * Sur un écran vide, l'animation n'est pas une décoration : elle **impose un
 * ordre de lecture** (sur-titre → titre → texte → action) là où un bloc statique
 * livre tout d'un coup. C'est le seul usage légitime ici.
 *
 * Contraintes tenues :
 *  - animation sur `opacity` / `transform` uniquement (jamais width/height) ;
 *  - `motion-safe:` — sous `prefers-reduced-motion: reduce`, rien ne bouge et le
 *    contenu est visible immédiatement, sans état intermédiaire invisible ;
 *  - easing sortant (`ease-out`), 400 ms, décalage court entre éléments.
 *
 * Usage :
 *   {items.map((item, i) => (
 *     <Reveal key={item.key} delay={i * 70}>…</Reveal>
 *   ))}
 */
export interface RevealProps extends React.ComponentProps<'div'> {
  /** Décalage d'entrée en millisecondes. Garder < 500 ms au total. */
  delay?: number;
}

export default function Reveal({ delay = 0, className, style, ...props }: RevealProps) {
  return (
    <div
      className={cn(
        'motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2',
        'motion-safe:duration-400 motion-safe:ease-out motion-safe:fill-mode-backwards',
        className
      )}
      style={{ animationDelay: delay ? `${delay}ms` : undefined, ...style }}
      {...props}
    />
  );
}
