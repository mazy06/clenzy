import type { StateManager } from '../state';
import type { WidgetState } from '../types';

/**
 * Équipements du logement sélectionné, en puces. Factory PARTAGÉE entre l'aperçu éditeur
 * (`BaitlyWidget.buildLayoutWidget`) et le runtime (`mountPrimitive`, bloc `booking-amenities`).
 * Donnée : `WidgetProperty.amenities` (peut être nulle/vide). Repli sur le premier logement quand
 * aucun n'est sélectionné (aperçu Studio / page mono-bien) → cohérent avec `createPropertySummary`.
 */
export function createAmenitiesList(state: StateManager): HTMLElement {
  const container = document.createElement('div');
  container.className = 'cb-section cb-amenities';

  const render = (s: WidgetState): void => {
    const prop = s.properties.find((p) => p.id === s.selectedPropertyId) ?? s.properties[0];
    container.textContent = '';

    const amenities = prop?.amenities ?? [];
    if (amenities.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'cb-text-sm cb-text-secondary';
      empty.textContent = '—';
      container.appendChild(empty);
      return;
    }

    const list = document.createElement('ul');
    list.className = 'cb-amenities__list';
    amenities.forEach((a) => {
      const li = document.createElement('li');
      li.className = 'cb-amenity';
      li.textContent = a;
      list.appendChild(li);
    });
    container.appendChild(list);
  };

  state.on('*', (s: WidgetState) => render(s));
  render(state.get());
  return container;
}
