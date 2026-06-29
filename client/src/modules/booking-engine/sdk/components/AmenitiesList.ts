import type { StateManager } from '../state';
import type { WidgetState } from '../types';
import type { createBookingI18n } from '../i18n';
import { amenityIcon } from './icons';

type I18n = ReturnType<typeof createBookingI18n>;

/** Options de présentation des équipements. */
export interface AmenitiesListOptions {
  /** `true` = regroupe les équipements en catégories (Essentiels / Cuisine / Bien-être / Famille). */
  grouped?: boolean;
}

/** Catégories d'équipements (ordre d'affichage). Les codes hors catégorie tombent dans « Autres ». */
const AMENITY_CATEGORIES: ReadonlyArray<{ key: string; codes: readonly string[] }> = [
  { key: 'essentials', codes: ['WIFI', 'HEATING', 'AIR_CONDITIONING', 'TV', 'SAFE'] },
  { key: 'kitchen', codes: ['EQUIPPED_KITCHEN', 'OVEN', 'MICROWAVE', 'DISHWASHER', 'WASHING_MACHINE', 'DRYER'] },
  { key: 'wellness', codes: ['POOL', 'JACUZZI', 'BARBECUE', 'GARDEN_TERRACE', 'PARKING'] },
  { key: 'family', codes: ['BABY_BED', 'HIGH_CHAIR', 'IRON', 'HAIR_DRYER'] },
];

/**
 * Équipements du logement sélectionné. Factory PARTAGÉE entre l'aperçu éditeur
 * (`BaitlyWidget.buildLayoutWidget`) et le runtime (`mountPrimitive`, bloc `booking-amenities`).
 * Donnée : `WidgetProperty.amenities` = CODES (ex. `AIR_CONDITIONING`) → libellé localisé via
 * `amenity.<CODE>` (i18n), avec repli humanisé pour les codes custom. Repli sur le premier logement
 * quand aucun n'est sélectionné. `opts.grouped` → 4 colonnes de catégories (sinon liste à plat).
 */
export function createAmenitiesList(state: StateManager, i18n: I18n, opts: AmenitiesListOptions = {}): HTMLElement {
  const container = document.createElement('div');
  container.className = 'cb-section cb-amenities' + (opts.grouped ? ' cb-amenities--grouped' : '');

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

    if (opts.grouped) {
      renderGrouped(container, amenities, i18n);
    } else {
      container.appendChild(renderFlat(amenities, i18n));
    }
  };

  state.on('*', (s: WidgetState) => render(s));
  render(state.get());
  return container;
}

/** Liste à plat (puces icône + libellé). */
function renderFlat(codes: string[], i18n: I18n): HTMLElement {
  const list = document.createElement('ul');
  list.className = 'cb-amenities__list';
  codes.forEach((code) => list.appendChild(amenityItem(code, i18n)));
  return list;
}

/** Groupé par catégorie : un bloc par catégorie présente (+ « Autres » pour les codes hors catalogue). */
function renderGrouped(container: HTMLElement, codes: string[], i18n: I18n): void {
  const remaining = new Set(codes);
  const groups = document.createElement('div');
  groups.className = 'cb-amenities__groups';

  for (const cat of AMENITY_CATEGORIES) {
    const items = cat.codes.filter((c) => remaining.has(c));
    if (items.length === 0) continue;
    items.forEach((c) => remaining.delete(c));
    groups.appendChild(amenityGroup(i18n.t(`amenityCat.${cat.key}`), items, i18n));
  }
  // Codes restants (custom / hors catalogue) → « Autres ».
  if (remaining.size > 0) {
    groups.appendChild(amenityGroup(i18n.t('amenityCat.other'), Array.from(remaining), i18n));
  }
  container.appendChild(groups);
}

/** Un bloc de catégorie : titre + liste icône/libellé. */
function amenityGroup(title: string, codes: string[], i18n: I18n): HTMLElement {
  const group = document.createElement('div');
  group.className = 'cb-amenities__group';
  const head = document.createElement('div');
  head.className = 'cb-amenities__group-title';
  head.textContent = title;
  const list = document.createElement('ul');
  list.className = 'cb-amenities__list';
  codes.forEach((code) => list.appendChild(amenityItem(code, i18n)));
  group.append(head, list);
  return group;
}

/** Un item équipement (icône + libellé). */
function amenityItem(code: string, i18n: I18n): HTMLElement {
  const li = document.createElement('li');
  li.className = 'cb-amenity';
  const icon = document.createElement('span');
  icon.className = 'cb-amenity__icon';
  icon.appendChild(amenityIcon(code));
  li.append(icon, document.createTextNode(amenityLabel(code, i18n)));
  return li;
}

/** Libellé d'un code équipement : i18n `amenity.<CODE>` si connu, sinon humanisation du code. */
function amenityLabel(code: string, i18n: I18n): string {
  const key = `amenity.${code}`;
  const label = i18n.t(key);
  if (label && label !== key) return label;
  return code
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/^./, (c) => c.toUpperCase());
}
