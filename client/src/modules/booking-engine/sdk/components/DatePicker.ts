import type { StateManager } from '../state';
import type { WidgetState } from '../types';

interface I18n {
  t: (key: string) => string;
}

export function createDatePicker(state: StateManager, i18n: I18n): HTMLElement {
  const container = document.createElement('div');
  container.className = 'cb-dates';

  const checkInBox = createDateBox('checkin', i18n.t('searchBar.checkIn'));
  const checkOutBox = createDateBox('checkout', i18n.t('searchBar.checkOut'));

  container.appendChild(checkInBox);
  container.appendChild(checkOutBox);

  // Click handlers
  checkInBox.addEventListener('click', () => {
    state.set({ calendarOpen: true }, 'calendarToggle');
  });
  checkOutBox.addEventListener('click', () => {
    state.set({ calendarOpen: true }, 'calendarToggle');
  });

  // State sync
  state.on('*', (s: WidgetState) => {
    updateDateBox(checkInBox, s.checkIn, i18n.t('searchBar.addDate'));
    updateDateBox(checkOutBox, s.checkOut, i18n.t('searchBar.addDate'));

    checkInBox.classList.toggle('cb-active', s.calendarOpen && !s.checkIn);
    checkOutBox.classList.toggle('cb-active', s.calendarOpen && !!s.checkIn && !s.checkOut);
  });

  return container;
}

function createDateBox(id: string, label: string): HTMLElement {
  const box = document.createElement('button');
  box.className = 'cb-date-input';
  box.setAttribute('type', 'button');
  box.setAttribute('aria-label', label);
  box.dataset.role = id;

  const labelEl = document.createElement('span');
  labelEl.className = 'cb-date-input__label';
  labelEl.textContent = label;

  const valueEl = document.createElement('span');
  valueEl.className = 'cb-date-input__placeholder';
  valueEl.dataset.slot = 'value';

  box.appendChild(labelEl);
  box.appendChild(valueEl);

  return box;
}

function updateDateBox(box: HTMLElement, date: string | null, placeholder: string): void {
  const valueEl = box.querySelector('[data-slot="value"]');
  if (!valueEl) return;

  if (date) {
    valueEl.className = 'cb-date-input__value';
    valueEl.textContent = formatDate(date);
  } else {
    valueEl.className = 'cb-date-input__placeholder';
    valueEl.textContent = placeholder;
  }
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: '2-digit' });
}
