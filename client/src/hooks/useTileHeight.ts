import * as React from 'react';

/**
 * Canal par lequel une tuile dit de quelle hauteur elle aurait besoin.
 *
 * <p>Une ligne du tableau de bord se cale sur la tuile la plus COURTE, et
 * aucune tuile ne defile : ce qui ne tient pas, la tuile le resorbe. Encore
 * faut-il savoir, pour chacune, la hauteur qu'il lui faudrait — et le DOM seul
 * ne le dit pas : une tuile etiree mesure exactement ce qu'on vient de lui
 * imposer.</p>
 *
 * <p>Une tuile n'annonce donc pas une hauteur mais un ECART : ce qui lui manque
 * (positif) ou ce qui lui reste (negatif) dans la place qu'on lui a donnee. Le
 * panneau, qui connait sa propre hauteur, en deduit la hauteur voulue. La ligne
 * converge alors en une passe vers la plus courte — et y reste, parce que
 * l'ecart se mesure toujours sur le contenu COMPLET, jamais sur celui qu'on
 * affiche ({@link useFitRows}).</p>
 *
 * <p>Une meme tuile peut porter plusieurs listes — « Operations du jour » en
 * aligne trois. Chacune s'annonce sous sa propre cle et le panneau retient la
 * plus exigeante : la tuile a besoin de la hauteur qui contente sa partie la
 * plus haute.</p>
 *
 * <p>Hors du tableau de bord — galeries, ecrans d'origine — il n'y a aucun
 * fournisseur : le crochet ne fait rien.</p>
 */
export interface TileHeightChannel {
  /**
   * @param source cle stable de la liste qui s'annonce (un `useId`).
   * @param overflow ecart en pixels, ou `null` pour ne plus se prononcer.
   */
  declare: (source: string, overflow: number | null) => void;
}

const TileHeight = React.createContext<TileHeightChannel | null>(null);

/** Pose le canal autour d'une tuile. Cf. `DashboardWidgetGrid`. */
export const TileHeightProvider = TileHeight.Provider;

/** Rappel stable pour annoncer son ecart. `undefined` hors tableau de bord. */
export function useDeclareTileOverflow(): TileHeightChannel['declare'] | undefined {
  return React.useContext(TileHeight)?.declare;
}
