import type { StateManager } from '../state';
import type { WidgetState, PropertyTypeInfo } from '../types';
import { createSingleSelect } from './FilterPanel';

interface I18n {
  t: (key: string) => string;
  tObject: (key: string) => Record<string, string>;
}

/**
 * Sélecteur de TYPE de logement en DROPDOWN (`<select>` natif stylé `.cb-input` + chevron), à la manière
 * du sélecteur de voyageurs/devise. ≠ `createPropertyFilter` (onglets horizontaux, pour la page résultats).
 * Masqué tant qu'aucun type n'est disponible. Rendu initial inclus (`state.on` ne déclenche pas à l'abonnement).
 */
export function createPropertyTypeSelect(state: StateManager, i18n: I18n, currency: string): HTMLElement {
  // Dropdown CUSTOM stylisé (≠ `<select>` natif) + coordonné (un seul popover ouvert). Écrit `filters.types`
  // (sélection unique → tableau de 0/1 élément) pour filtrer les résultats (server-side + miroir client).
  return createSingleSelect(state, {
    getOptions: (s) => {
      const options = typeOptions(s);
      if (options.length === 0) return [];
      const typeLabels = i18n.tObject('propertyTypes');
      const list = [{ value: '', label: i18n.t('common.all') }];
      for (const t of options) {
        const label = typeLabels[t.code] || t.label || t.code;
        const priceStr = t.minPrice ? ` ${currency === 'EUR' ? '€' : currency}${Math.round(t.minPrice)}` : '';
        list.push({ value: t.code, label: label + priceStr });
      }
      return list;
    },
    getValue: () => state.get().filters.types[0] ?? '',
    setValue: (v) => state.set({ filters: { ...state.get().filters, types: v ? [v] : [] } }, 'stateChange'),
  });
}

interface TypeOption { code: string; label?: string; minPrice?: number | null; }

/** Options de type : facettes serveur, sinon `propertyTypes` (éditeur seedé), sinon dérivées des logements. */
function typeOptions(s: WidgetState): TypeOption[] {
  if (s.filterFacets && s.filterFacets.propertyTypes.length) {
    return s.filterFacets.propertyTypes.map((t) => ({ code: t.code }));
  }
  if (s.propertyTypes.length) {
    return s.propertyTypes.map((t) => ({ code: t.code, label: t.label, minPrice: t.minPrice }));
  }
  const seen = new Map<string, number | null>();
  for (const p of s.properties) {
    if (p.type && !seen.has(p.type)) seen.set(p.type, p.priceFrom ?? null);
  }
  return [...seen.entries()].map(([code, minPrice]) => ({ code, minPrice }));
}

export function createPropertyFilter(state: StateManager, i18n: I18n, currency: string): HTMLElement {
  const container = document.createElement('div');
  container.className = 'cb-section';

  const tabs = document.createElement('div');
  tabs.className = 'cb-property-tabs';
  tabs.setAttribute('role', 'tablist');
  container.appendChild(tabs);

  const update = (s: WidgetState): void => {
    if (s.propertyTypes.length === 0) {
      container.hidden = true;
      return;
    }
    container.hidden = false;
    renderTabs(tabs, s.propertyTypes, s.selectedPropertyType, i18n, currency, state);
  };
  state.on('*', update);
  // Rendu initial : `state.on` ne déclenche pas à l'abonnement ; sans ça le filtre reste vide quand les
  // types sont déjà en état au montage (aperçu éditeur seedé, ou hydratation runtime après chargement).
  update(state.get());

  return container;
}

function renderTabs(
  container: HTMLElement,
  types: PropertyTypeInfo[],
  selected: string | null,
  i18n: I18n,
  currency: string,
  state: StateManager,
): void {
  // Only re-render if types or selection changed
  const currentKey = container.dataset.key;
  const newKey = `${types.map(t => t.code).join(',')}:${selected}`;
  if (currentKey === newKey) return;
  container.dataset.key = newKey;

  container.textContent = '';

  const typeLabels = i18n.tObject('propertyTypes');

  // "All" tab
  const allTab = createTab(
    i18n.t('common.all'),
    null,
    selected === null,
    state,
  );
  container.appendChild(allTab);

  types.forEach(type => {
    const label = typeLabels[type.code] || type.label || type.code;
    const priceStr = type.minPrice
      ? ` ${currency === 'EUR' ? '€' : currency}${Math.round(type.minPrice)}`
      : '';

    const tab = createTab(
      label + priceStr,
      type.code,
      selected === type.code,
      state,
    );
    container.appendChild(tab);
  });
}

function createTab(
  label: string,
  code: string | null,
  active: boolean,
  state: StateManager,
): HTMLElement {
  const btn = document.createElement('button');
  btn.className = `cb-property-tab${active ? ' cb-active' : ''}`;
  btn.setAttribute('type', 'button');
  btn.setAttribute('role', 'tab');
  btn.setAttribute('aria-selected', String(active));
  btn.textContent = label;

  btn.addEventListener('click', () => {
    state.set({ selectedPropertyType: code }, 'stateChange');
  });

  return btn;
}
