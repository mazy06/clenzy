import { useEffect, useRef, useState } from 'react';

/** En deca de cette largeur la mise en page s'empile : la figer serait nuisible. */
const SIDE_BY_SIDE = 1024;

/** Marge sous la carte, pour que le bord bas ne colle pas a la fenetre. */
const GUTTER = 20;

/**
 * Hauteur restante entre le haut de l'element et le bas de la fenetre.
 *
 * <p>L'ecran n'a aucune contrainte de hauteur au-dessus de lui : la coque
 * grandit avec son contenu. Sans hauteur explicite ici, `flex-1` et
 * `overflow-y-auto` se resolvent a zero — les deux colonnes ne pourraient
 * jamais defiler independamment, et la carte s'arreterait au milieu d'un
 * grand ecran.</p>
 *
 * <p>On mesure plutot que de soustraire un `calc(100dvh - Xpx)` code en dur :
 * l'en-tete change de hauteur quand le champ de recherche apparait ou que les
 * onglets passent a la ligne, et un offset fige laisserait deriver le bas de
 * la carte. Renvoie `undefined` sous {@link SIDE_BY_SIDE}, ou la mise en
 * page s'empile et doit reprendre sa hauteur naturelle.</p>
 */
export function useViewportFill<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [height, setHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;

    const measure = () => {
      if (window.innerWidth < SIDE_BY_SIDE) {
        setHeight(undefined);
        return;
      }
      const top = element.getBoundingClientRect().top;
      // Un plancher : sur une fenetre tres basse mieux vaut deborder que
      // reduire les colonnes a une bande illisible.
      setHeight(Math.max(360, Math.round(window.innerHeight - top - GUTTER)));
    };

    measure();
    window.addEventListener('resize', measure);
    // Ce qui precede l'element peut changer de hauteur sans que la fenetre
    // bouge — bandeau d'erreur, onglets qui passent a la ligne.
    const observer = new ResizeObserver(measure);
    observer.observe(document.body);
    return () => {
      window.removeEventListener('resize', measure);
      observer.disconnect();
    };
  }, []);

  return [ref, height] as const;
}
