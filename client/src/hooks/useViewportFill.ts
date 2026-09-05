import { useEffect, useRef, useState } from 'react';

/** En deca de cette largeur la mise en page s'empile : la figer serait nuisible. */
const SIDE_BY_SIDE = 1024;

/** Respiration sous l'element, pour que son bord ne colle pas a la fenetre. */
const GUTTER = 12;

/**
 * Espace REELLEMENT occupe sous l'element, jusqu'a la racine du document.
 *
 * <p>C'est la somme des freres qui le suivent et des rembourrages bas de ses
 * ancetres — jamais un ecart de boites. On mesurait auparavant
 * `scrollHeight - bas de l'element`, ce qui a deux defauts : quand la coque est
 * etiree (`min-height: 100vh`, ce que fait la notre) l'ecart contient tout le
 * BLANC restant de la fenetre, et quand la page est plus courte que la fenetre
 * `scrollHeight` vaut la fenetre. Dans les deux cas on retranchait l'espace
 * libre de l'espace disponible : l'element ne pouvait plus grandir au-dela de
 * sa hauteur naturelle — un point fixe qui ecrasait la grille des Rapports a
 * 373 px dans une fenetre de 950.</p>
 *
 * <p>Cette mesure ne depend d'aucune hauteur qu'on aurait soi-meme imposee :
 * elle se recalcule sans risque de circularite.</p>
 */
function occupiedBelow(element: HTMLElement): number {
  let total = 0;
  let node: HTMLElement = element;

  while (node.parentElement) {
    const parent = node.parentElement;

    for (let sibling = node.nextElementSibling; sibling; sibling = sibling.nextElementSibling) {
      // Un element sorti du flux (barre flottante, dock de l'assistant) ne
      // pousse rien vers le bas : il ne compte pas.
      const style = getComputedStyle(sibling);
      if (style.position === 'fixed' || style.position === 'absolute') continue;
      total += sibling.getBoundingClientRect().height;
    }

    total += parseFloat(getComputedStyle(parent).paddingBottom) || 0;
    if (parent === document.body || parent === document.documentElement) break;
    node = parent;
  }

  return Math.max(0, Math.round(total));
}

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
 *
 * <p>L'espace occupe SOUS l'element — les rembourrages des conteneurs qui
 * l'enveloppent — est retranche lui aussi (cf. {@link occupiedBelow}). Sans
 * cela l'element descend exactement au bas de la fenetre, ces rembourrages
 * depassent, et une barre de defilement apparait pour une dizaine de pixels.</p>
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
      const rect = element.getBoundingClientRect();
      setHeight(
        Math.max(360, Math.round(window.innerHeight - rect.top - occupiedBelow(element) - GUTTER)),
      );
    };

    measure();
    window.addEventListener('resize', measure);
    const observer = new ResizeObserver(measure);
    observer.observe(document.body);
    return () => {
      window.removeEventListener('resize', measure);
      observer.disconnect();
    };
  }, []);

  return [ref, height] as const;
}
