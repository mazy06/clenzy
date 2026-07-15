import type { StateManager } from '../state';
import type { WidgetState, SelectedAddon } from '../types';

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
