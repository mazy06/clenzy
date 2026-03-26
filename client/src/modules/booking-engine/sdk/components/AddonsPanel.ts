import type { StateManager } from '../state';
import type { WidgetState, SelectedAddon } from '../types';
import { check } from './icons';

interface I18n {
  t: (key: string) => string;
}

export function createAddonsPanel(state: StateManager, i18n: I18n, currency: string): HTMLElement {
  const container = document.createElement('div');
  container.className = 'cb-section';
  container.hidden = true;

  const label = document.createElement('div');
  label.className = 'cb-section-label';
  label.textContent = i18n.t('common.extras');
  container.appendChild(label);

  const list = document.createElement('div');
  list.className = 'cb-addons';
  container.appendChild(list);

  // For now, addons are populated from availability API response
  // This component renders whatever is in state.addons
  state.on('*', (s: WidgetState) => {
    // Show only when we have pricing and are on search page
    if (!s.pricing || !s.checkIn || !s.checkOut) {
      container.hidden = true;
      return;
    }
    container.hidden = false;
  });

  return container;
}

/** Create a single addon card — used by the widget when addons are loaded */
export function renderAddonItem(
  addon: { id: string; name: string; price: number },
  selected: boolean,
  currency: string,
  onToggle: (id: string) => void,
): HTMLElement {
  const card = document.createElement('button');
  card.className = `cb-addon${selected ? ' cb-selected' : ''}`;
  card.setAttribute('type', 'button');
  card.setAttribute('aria-pressed', String(selected));

  const info = document.createElement('div');
  info.className = 'cb-addon__info';

  const name = document.createElement('span');
  name.className = 'cb-addon__name';
  name.textContent = addon.name;

  const price = document.createElement('span');
  price.className = 'cb-addon__price';
  price.textContent = `+${formatCurrency(addon.price, currency)}`;

  info.appendChild(name);
  info.appendChild(price);

  const checkBox = document.createElement('span');
  checkBox.className = 'cb-addon__check';
  if (selected) {
    checkBox.appendChild(check());
  }

  card.appendChild(info);
  card.appendChild(checkBox);

  card.addEventListener('click', () => onToggle(addon.id));

  return card;
}

function formatCurrency(amount: number, currency: string): string {
  const symbol = currency === 'EUR' ? '€' : currency === 'USD' ? '$' : currency;
  return `${symbol}${Math.round(amount)}`;
}
