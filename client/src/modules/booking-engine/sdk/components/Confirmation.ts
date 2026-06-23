interface I18n {
  t: (key: string) => string;
}

/** Carte de confirmation + ses nœuds enrichissables (titre / sous-titre / détails). */
export interface ConfirmationCard {
  node: HTMLElement;
  title: HTMLElement;
  subtitle: HTMLElement;
  details: HTMLElement;
}

/**
 * Carte de confirmation STATIQUE : icône de succès + titre + sous-titre + liste de détails (vide).
 * Factory PARTAGÉE : le runtime (`mountPrimitive.buildConfirmation`) l'hydrate via un re-fetch de la
 * réservation ; l'aperçu éditeur (`BaitlyWidget`) l'affiche telle quelle, SANS effet de bord ni
 * lecture d'URL. Les classes `cb-confirmation__*` sont stylées dans les styles SDK (Shadow DOM).
 */
export function createConfirmationCard(i18n: I18n): ConfirmationCard {
  const node = document.createElement('div');
  node.className = 'cb-page cb-confirmation';

  const icon = document.createElement('div');
  icon.className = 'cb-confirmation__icon';
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '3');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  polyline.setAttribute('points', '20 6 9 17 4 12');
  svg.appendChild(polyline);
  icon.appendChild(svg);

  const title = document.createElement('h3');
  title.className = 'cb-text-lg cb-text-semibold cb-text-center cb-confirmation__title';
  title.textContent = i18n.t('confirmation.title');

  const subtitle = document.createElement('p');
  subtitle.className = 'cb-text-sm cb-text-secondary cb-text-center cb-confirmation__subtitle';
  subtitle.textContent = i18n.t('confirmation.subtitle');

  const details = document.createElement('dl');
  details.className = 'cb-confirmation__details';

  node.appendChild(icon);
  node.appendChild(title);
  node.appendChild(subtitle);
  node.appendChild(details);
  return { node, title, subtitle, details };
}
