import * as React from 'react';
import { cn } from '../../utils/cn';

/**
 * Baitly — aperçu produit qui défile, pour la colonne droite de `ShowcaseEmpty`.
 *
 * Un état vide décrit une promesse ; l'aperçu la rend tangible. En faire défiler
 * plusieurs montre que l'écran a plusieurs usages, sans allonger le texte.
 *
 * Volontairement **non interactif** : l'aperçu est illustratif, il ne doit pas
 * devenir un composant que l'utilisateur doit manipuler (et il vit dans un
 * conteneur `aria-hidden` — y mettre des boutons créerait des cibles focusables
 * invisibles pour les lecteurs d'écran). Deux modes :
 *  - **libre** : défile tout seul ;
 *  - **piloté** : passer `index` et laisser un contrôle légitime du parent
 *    (une liste de jalons, par exemple) décider de la vue affichée.
 *
 * Sous `prefers-reduced-motion: reduce`, le défilement automatique est coupé —
 * la première vue reste affichée.
 */
export interface ShowcaseCyclerFrame {
  key: string;
  node: React.ReactNode;
}

export interface ShowcaseCyclerProps {
  frames: ShowcaseCyclerFrame[];
  /** Vue affichée, si le parent pilote. Sinon défilement automatique. */
  index?: number;
  /** Cadence du défilement libre, en ms. */
  interval?: number;
  className?: string;
}

/** `true` si l'utilisateur a demandé à réduire les animations. */
export function usePrefersReducedMotion() {
  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(query.matches);
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

export default function ShowcaseCycler({
  frames,
  index,
  interval = 3800,
  className,
}: ShowcaseCyclerProps) {
  const reducedMotion = usePrefersReducedMotion();
  const [autoIndex, setAutoIndex] = React.useState(0);
  const controlled = index !== undefined;

  React.useEffect(() => {
    if (controlled || reducedMotion || frames.length < 2) return;
    const id = window.setInterval(
      () => setAutoIndex((current) => (current + 1) % frames.length),
      interval
    );
    return () => window.clearInterval(id);
  }, [controlled, reducedMotion, frames.length, interval]);

  const active = (controlled ? index : autoIndex) % Math.max(frames.length, 1);

  return (
    <div className={cn('grid', className)}>
      {frames.map((frame, position) => (
        <div
          key={frame.key}
          // Toutes les vues occupent la même cellule : la hauteur du bloc est
          // celle de la plus grande, donc aucun saut de mise en page au défilé.
          className={cn(
            '[grid-area:1/1] transition-opacity duration-500 ease-out motion-reduce:transition-none',
            position === active ? 'opacity-100' : 'pointer-events-none opacity-0'
          )}
        >
          {frame.node}
        </div>
      ))}
    </div>
  );
}
