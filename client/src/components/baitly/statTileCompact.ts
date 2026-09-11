import * as React from 'react';

/**
 * Mode compact d'une rangee de tuiles KPI.
 *
 * <p>Le contexte vit dans son propre module pour que `StatTileRow` (le
 * conteneur) et `StatTile` (la tuile) puissent tous deux le lire sans
 * s'importer l'un l'autre.</p>
 *
 * <p>`true` = la tuile se rend en CHIFFRE de bandeau, comme dans les Rapports :
 * valeur et libelle sur une ligne de base commune, dans une seule carte. Une
 * rangee de quatre tuiles passe alors d'environ 110 px de haut a 46 px.</p>
 */
export const StatTileCompactContext = React.createContext(false);

export function useStatTileCompact(): boolean {
  return React.useContext(StatTileCompactContext);
}
