import type { StateManager } from '../state';
import type { WidgetState, PropertyTypeInfo } from '../types';

interface I18n {
  t: (key: string) => string;
  tObject: (key: string) => Record<string, string>;
}

export function createPropertyFilter(state: StateManager, i18n: I18n, currency: string): HTMLElement {
  const container = document.createElement('div');
  container.className = 'cb-section';

  const tabs = document.createElement('div');
  tabs.className = 'cb-property-tabs';
  tabs.setAttribute('role', 'tablist');
  container.appendChild(tabs);

  state.on('*', (s: WidgetState) => {
    if (s.propertyTypes.length === 0) {
      container.hidden = true;
      return;
    }
    container.hidden = false;
    renderTabs(tabs, s.propertyTypes, s.selectedPropertyType, i18n, currency, state);
  });

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
