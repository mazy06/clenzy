import type { StateManager } from '../state';
import type { WidgetState } from '../types';

/** Sélecteur de devise d'affichage (multi-devise). Masqué si une seule devise disponible. */
export function createCurrencySelector(state: StateManager): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'cb-currency-selector';

  const select = document.createElement('select');
  select.className = 'cb-currency-select';
  select.setAttribute('aria-label', 'Currency');
  wrap.appendChild(select);

  select.addEventListener('change', () => {
    state.set({ displayCurrency: select.value }, 'stateChange');
  });

  state.on('*', (s: WidgetState) => render(select, wrap, s));
  render(select, wrap, state.get());

  return wrap;
}

function render(select: HTMLSelectElement, wrap: HTMLElement, s: WidgetState): void {
  if (!s.currencies || s.currencies.length <= 1) {
    wrap.hidden = true;
    return;
  }
  wrap.hidden = false;

  const key = `${s.currencies.join(',')}:${s.displayCurrency}`;
  if (select.dataset.key === key) return;
  select.dataset.key = key;
  select.textContent = '';

  s.currencies.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    if (c === s.displayCurrency) opt.selected = true;
    select.appendChild(opt);
  });
}
