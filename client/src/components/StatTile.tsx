/**
 * Tuile KPI — ré-export du composant Baitly UI.
 *
 * <p>L'implémentation « Signature » qui vivait ici a été remplacée par
 * {@link ../components/baitly/StatTile} lors de la campagne de refonte : même
 * surface d'API, à ceci près que la couleur d'icône se dit en classe
 * (`iconClassName="text-success"`) et non plus en jeton CSS calculé
 * (`color="var(--ok)"`). Les 63 sites d'appel ont été convertis.</p>
 *
 * <p>Ce fichier reste pour ne pas casser un import oublié ; tout nouveau code
 * importe directement `components/baitly/StatTile`.</p>
 */
export { default, type StatTileProps } from './baitly/StatTile';
