import { useState, useEffect, useCallback, useRef } from 'react';
import { createSettledScheduler } from '../utils/layoutShift';

/**
 * Hook that dynamically computes how many table rows fit in the available
 * viewport height, so that the list never needs to scroll — pagination
 * handles the overflow instead.
 *
 * La mesure porte sur la CARTE designee par `containerRef`, jamais sur
 * `window.innerHeight` moins la position de cette carte : cette derniere
 * formule ne tenait que tant que rien n'arrivait AU-DESSUS de la liste apres la
 * premiere mesure. Sur Proprietes, les tuiles de portefeuille et le bandeau
 * « contrat manquant » dependent de requetes distinctes, apparaissent apres
 * coup et poussent la carte vers le bas : la liste gardait alors les lignes
 * calculees pour une carte plus haute, la derniere etait coupee en deux et la
 * pagination sortait du cadre, sans defilement pour aller la chercher.
 *
 * La carte est `flex-1 min-h-0 overflow-hidden` : sa hauteur vient de son
 * parent, pas de ses lignes. La mesure est donc stable — pas de boucle entre le
 * nombre de lignes et la hauteur disponible. Une seule piece du calcul pouvait
 * dependre de son propre resultat, la barre de pagination qui s'efface a une
 * seule page : voir `footerHeightRef`.
 *
 * Le calcul est :
 *   rowsPerPage = floor((hauteur carte - pagination - en-tete) / hauteur ligne)
 *
 * Le resultat est borne a [min, max] et recalcule des que la carte change de
 * taille (redimensionnement, repli de la barre laterale, bloc qui s'insere
 * au-dessus) ou que son contenu change.
 */

interface UseDynamicPageSizeOptions {
  /** Approximate height of one table body row in px (default: 49) */
  rowHeight?: number;
  /** Height of the table header row in px (default: 42) */
  headerHeight?: number;
  /**
   * Repli quand la barre de pagination n'est pas encore mesurable : pixels
   * retranches de la hauteur de la carte (default: 72).
   */
  bottomChrome?: number;
  /** Minimum rows to show (default: 5) */
  min?: number;
  /** Maximum rows to show (default: 50) */
  max?: number;
  /** Fallback if measurement is not yet available (default: 10) */
  fallback?: number;
}

/** Barre de pagination : dernier enfant de la carte, s'il ne porte pas le tableau. */
function findFooter(card: HTMLElement): HTMLElement | null {
  const last = card.lastElementChild;
  if (!(last instanceof HTMLElement)) return null;
  return last.querySelector('table') ? null : last;
}

export function useDynamicPageSize(options: UseDynamicPageSizeOptions = {}) {
  const {
    rowHeight = 49,
    headerHeight = 42,
    bottomChrome = 72,
    min = 5,
    max = 50,
    fallback = 10,
  } = options;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [pageSize, setPageSize] = useState(fallback);
  /**
   * Derniere hauteur REELLE de la barre de pagination. Elle survit a sa
   * disparition : `PagePagination` s'efface quand il ne reste qu'une page
   * (`hideOnSinglePage`), et sans cette memoire la mesure repartait sur le
   * repli `bottomChrome`, plus haut que la barre reelle. La carte semblait
   * alors RETRECIR au moment meme ou elle gagnait de la place, et le compte
   * de lignes basculait sans fin entre les deux etats — chaque bascule
   * remontant/retirant la barre, donc relancant la mesure. Reserver toujours
   * la meme hauteur casse ce cycle : le calcul ne depend plus de ce qu'il
   * vient lui-meme de provoquer.
   */
  const footerHeightRef = useRef<number | null>(null);

  const compute = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (el.clientHeight <= 0) return; // pas encore dispose : on garde la valeur courante

    // Hauteurs MESURÉES quand la table est déjà rendue ; les options ne servent
    // qu'au premier calcul, avant que la table existe. Une constante finit
    // toujours par mentir : les lignes des réservations font 73 px (cellule à
    // deux niveaux) contre les 49 annoncés. Le compte était donc trop
    // optimiste, et comme le cadre clippe sans défiler, les dernières lignes
    // devenaient inatteignables — la pagination annonçait « 1-13 sur 25 » avec
    // 9 lignes visibles. Le défaut ne venait pas de l'étroitesse : il touchait
    // aussi le grand écran.
    const bodyRow = el.querySelector('tbody tr');
    const headRow = el.querySelector('thead tr');
    const measuredRow = bodyRow instanceof HTMLElement && bodyRow.offsetHeight > 0
      ? bodyRow.offsetHeight
      : rowHeight;
    const measuredHead = headRow instanceof HTMLElement && headRow.offsetHeight > 0
      ? headRow.offsetHeight
      : headerHeight;

    const footer = findFooter(el);
    if (footer && footer.offsetHeight > 0) footerHeightRef.current = footer.offsetHeight;
    const measuredFooter = footerHeightRef.current ?? bottomChrome;

    // Barre de defilement horizontale du conteneur de tableau (`overflow-x-auto`) :
    // nulle avec les barres flottantes de macOS, ~15 px ailleurs, et elle mange
    // la hauteur de la derniere ligne quand on l'ignore.
    const tableBox = el.querySelector('[data-slot="table-container"]');
    const scrollbar = tableBox instanceof HTMLElement
      ? Math.max(0, tableBox.offsetHeight - tableBox.clientHeight)
      : 0;

    const available = el.clientHeight - measuredFooter - measuredHead - scrollbar;
    const rows = Math.floor(available / measuredRow);
    const clamped = Math.max(min, Math.min(max, rows));

    setPageSize((prev) => (prev !== clamped ? clamped : prev));
  }, [rowHeight, headerHeight, bottomChrome, min, max]);

  useEffect(() => {
    const timer = setTimeout(compute, 50);

    const handleResize = () => {
      compute();
    };

    window.addEventListener('resize', handleResize);

    // Les données arrivent souvent APRÈS ce premier calcul : sans ce guet, la
    // mesure porterait sur une table encore vide et retomberait sur la
    // constante. Le recalcul converge en un tour (même hauteur de ligne → même
    // valeur → `setPageSize` sans effet).
    // `compute` lit la mise en page (offsetHeight, clientHeight) : l'appeler
    // pendant que la gouttiere de navigation pousse le contenu forcerait un
    // recalcul synchrone a chaque frame. Le planificateur attend l'arrivee.
    const settled = createSettledScheduler(compute);
    const schedule = settled.schedule;

    const observer = new MutationObserver(schedule);
    // La carte retrecit exactement quand un bloc s'insere au-dessus d'elle :
    // c'est cet observateur qui rattrape tuiles et bandeaux differes, que le
    // MutationObserver ne voit pas puisqu'ils sont hors de la carte.
    const resizeObserver = new ResizeObserver(schedule);
    const el = containerRef.current;
    if (el) {
      observer.observe(el, { childList: true, subtree: true });
      resizeObserver.observe(el);
      // La pagination passe sur deux lignes quand la largeur manque.
      const footer = findFooter(el);
      if (footer) resizeObserver.observe(footer);
    }

    return () => {
      clearTimeout(timer);
      settled.cancel();
      observer.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, [compute]);

  return { containerRef, pageSize };
}
