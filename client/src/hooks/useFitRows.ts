import * as React from 'react';
import { useDeclareTileOverflow } from './useTileHeight';

/**
 * Ajuste une liste a la hauteur qu'on lui donne, et annonce ce qui manque.
 *
 * <p>Le tableau de bord ne fait plus defiler ses tuiles : une ligne se cale sur
 * la plus courte, et chaque tuile RESORBE ce qui depasse. Un ascenseur dans une
 * tuile est une promesse qu'on ne tient pas — la page defile deja, le rail se
 * confond avec celui de l'ecran, et masque (`no-scrollbar`) il cache la moitie
 * d'une liste sans meme le laisser deviner. Mieux vaut montrer ce qui tient et
 * DIRE le reste.</p>
 *
 * <p><b>Le repli se fait dans le DOM, pas dans le rendu.</b> Les rangs sont
 * tous montes ; ceux qui ne tiennent pas passent en `display: none`. C'est ce
 * qui permet a un meme crochet de servir une liste, un tableau ou un accordeon
 * sans que l'appelant ait a decouper ses enfants — il lui suffit de poser la
 * ref sur le cadre. Et c'est ce qui rend la mesure juste : le passage par
 * l'etat COMPLET, avant peinture donc invisible, est le seul moment ou l'on
 * connait la hauteur du contenu entier. Mesurer l'etat replie reviendrait a
 * mesurer ce qu'on vient de masquer, et la liste perdrait un rang a chaque
 * passe.</p>
 *
 * <p>La liste ne doit donc PAS etirer ses rangs (`justify-between`, `grow`…) :
 * le rab doit rester visible au bas du cadre, c'est lui qui dit a la ligne
 * qu'elle peut se resserrer.</p>
 *
 * <p>La mention « +N » se pose en FRERE du cadre, jamais dedans : elle prend sa
 * place sur la hauteur disponible au lieu de la disputer aux rangs.</p>
 *
 * @param rowSelector selecteur des rangs quand ils ne sont pas les enfants
 *   DIRECTS du cadre — un tableau les enterre sous `<table><tbody>`, une carte
 *   de bloc sous le conteneur de son appelant.
 */
export function useFitRows<T extends HTMLElement>(rowSelector?: string): {
  /** A poser sur le cadre — ce qui borne la hauteur, pas la carte entiere. */
  ref: React.RefObject<T>;
  /** Nombre de rangs replies. Zero quand tout tient. */
  hidden: number;
} {
  const ref = React.useRef<T>(null);
  const [hidden, setHidden] = React.useState(0);
  const declare = useDeclareTileOverflow();
  const source = React.useId();

  const measure = React.useCallback(() => {
    const node = ref.current;
    if (!node) return;

    const rows = Array.from(
      rowSelector ? node.querySelectorAll<HTMLElement>(rowSelector) : node.children,
    ) as HTMLElement[];
    rows.forEach((row) => {
      row.style.display = '';
    });

    const top = node.getBoundingClientRect().top;
    const bottomOf = (element: Element) => element.getBoundingClientRect().bottom - top;
    const room = node.clientHeight;
    const content = node.children.length
      ? Math.max(...Array.from(node.children).map(bottomOf))
      : 0;

    declare?.(source, Math.round(content - room));

    let shown = rows.length;
    // Le « + 1 » absorbe l'arrondi sous-pixel d'un zoom navigateur : sans lui,
    // une liste qui tient au demi-pixel pres se replierait d'un rang.
    if (rows.length > 0 && content > room + 1) {
      shown = 0;
      for (const row of rows) {
        if (bottomOf(row) > room) break;
        shown += 1;
      }
      // Toujours un rang : un cadre vide surmonte d'un « +7 » ne montre rien.
      shown = Math.max(1, shown);
      for (let index = shown; index < rows.length; index += 1) {
        rows[index].style.display = 'none';
      }
    }
    setHidden(rows.length - shown);
  }, [declare, rowSelector, source]);

  // A chaque rendu : la donnee a pu changer sans que le cadre ne bouge.
  React.useLayoutEffect(measure);

  React.useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    // Le cadre change de taille (la ligne se resserre, le panneau s'elargit).
    const resize = new ResizeObserver(measure);
    resize.observe(node);

    // Un rang qui GRANDIT sur place — une rubrique qu'on deplie — ne change ni
    // la taille du cadre ni le rendu du parent : sans cette veille, il
    // deborderait sans que personne ne remesure. On n'ecoute que la structure,
    // pas les attributs : nos propres `display: none` ne se declenchent pas
    // eux-memes.
    const mutations = new MutationObserver(measure);
    mutations.observe(node, { childList: true, subtree: true });

    return () => {
      resize.disconnect();
      mutations.disconnect();
    };
  }, [measure]);

  // La tuile demontee ne pese plus sur la hauteur de sa ligne.
  React.useEffect(() => () => declare?.(source, null), [declare, source]);

  return { ref, hidden };
}
