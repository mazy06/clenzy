import type { ReactNode } from 'react';

/**
 * Rend une phrase dont les passages en gras sont marques `<b>…</b>`.
 *
 * <p>Les repliques des maquettes portent des chiffres a mettre en avant au
 * milieu d'une phrase. Les decouper en tableau de fragments rendrait la
 * traduction illisible — et un traducteur qui deplace un chiffre casserait le
 * decoupage. Un seul balisage, applique au texte du dictionnaire : aucun HTML
 * n'est interprete, seul `<b>` est reconnu et le reste est affiche tel quel.</p>
 */
export function richText(source: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let rest = source;
  let key = 0;
  while (rest.length > 0) {
    const open = rest.indexOf('<b>');
    if (open < 0) {
      parts.push(rest);
      break;
    }
    const close = rest.indexOf('</b>', open);
    if (close < 0) {
      // Balise non fermee : on prefere afficher la phrase entiere plutot que
      // de la tronquer en silence.
      parts.push(rest);
      break;
    }
    if (open > 0) parts.push(rest.slice(0, open));
    parts.push(<b key={key++}>{rest.slice(open + 3, close)}</b>);
    rest = rest.slice(close + 4);
  }
  return parts;
}
