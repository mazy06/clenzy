import type { StateManager } from '../state';
import type { WidgetState } from '../types';
import { chevronDown, minus, plus } from './icons';

interface I18n {
  t: (key: string) => string;
}

export function createGuestSelector(state: StateManager, i18n: I18n, maxGuests: number): HTMLElement {
  const container = document.createElement('div');
  container.className = 'cb-section';

  // Toggle button
  const toggle = document.createElement('button');
  toggle.className = 'cb-guests-toggle';
  toggle.setAttribute('type', 'button');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-label', i18n.t('guests.title'));

  const toggleLeft = document.createElement('div');
  toggleLeft.className = 'cb-col cb-gap-1';

  const toggleLabel = document.createElement('span');
  toggleLabel.className = 'cb-guests-toggle__label';
  toggleLabel.textContent = i18n.t('guests.title');

  const toggleValue = document.createElement('span');
  toggleValue.className = 'cb-guests-toggle__value';

  toggleLeft.appendChild(toggleLabel);
  toggleLeft.appendChild(toggleValue);

  const toggleChevron = document.createElement('span');
  toggleChevron.className = 'cb-guests-toggle__chevron';
  toggleChevron.appendChild(chevronDown());

  toggle.appendChild(toggleLeft);
  toggle.appendChild(toggleChevron);

  toggle.addEventListener('click', () => {
    const s = state.get();
    // Toggle voyageurs ; à l'ouverture, ferme les autres popovers (un seul ouvert à la fois).
    state.set({ guestsOpen: !s.guestsOpen, calendarOpen: false, multiselectOpen: null }, 'guestsToggle');
  });

  // Fermeture au clic EN DEHORS (zone = `container`, qui contient le déclencheur + le panneau).
  let outsideDoc: Document | null = null;
  const onOutsidePointer = (e: Event): void => {
    if (!container.isConnected) { removeOutside(); return; }
    if (!state.get().guestsOpen) return;
    const target = e.target as Node | null;
    if (target && !container.contains(target)) state.set({ guestsOpen: false }, 'guestsToggle');
  };
  const ensureOutside = (): void => {
    const doc = container.ownerDocument;
    if (outsideDoc === doc) return;
    if (outsideDoc) outsideDoc.removeEventListener('pointerdown', onOutsidePointer, true);
    doc.addEventListener('pointerdown', onOutsidePointer, true);
    outsideDoc = doc;
  };
  const removeOutside = (): void => {
    if (outsideDoc) { outsideDoc.removeEventListener('pointerdown', onOutsidePointer, true); outsideDoc = null; }
  };

  // Panel
  const panel = document.createElement('div');
  panel.className = 'cb-guests-panel';
  panel.setAttribute('role', 'region');

  const adultsRow = createCounterRow(
    i18n.t('guests.adults'),
    i18n.t('guests.adultsAge'),
    () => state.get().adults,
    (v: number) => state.set({ adults: v }, 'stateChange'),
    1,
    maxGuests,
  );

  const childrenRow = createCounterRow(
    i18n.t('guests.children'),
    i18n.t('guests.childrenAge'),
    () => state.get().children,
    (v: number) => state.set({ children: v }, 'stateChange'),
    0,
    maxGuests,
  );

  // Bébés (0-3 ans) : gratuits, non comptés dans la capacité (total = adultes + enfants).
  const infantsRow = createCounterRow(
    i18n.t('guests.babies'),
    i18n.t('guests.babiesAge'),
    () => state.get().infants,
    (v: number) => state.set({ infants: v }, 'stateChange'),
    0,
    maxGuests,
  );

  panel.appendChild(adultsRow.el);
  panel.appendChild(childrenRow.el);
  panel.appendChild(infantsRow.el);

  container.appendChild(toggle);
  container.appendChild(panel);

  // State sync — rendu initial INCLUS (sinon la valeur est vide au montage → 1 ligne, puis 2 lignes au 1er
  // changement = la hauteur du champ « saute ». On peuple dès le départ pour une hauteur stable).
  const render = (s: WidgetState): void => {
    const totalGuests = s.adults + s.children;
    toggleValue.textContent = `${totalGuests} ${totalGuests === 1 ? i18n.t('guests.guest') : i18n.t('guests.guests')}`;

    toggle.classList.toggle('cb-open', s.guestsOpen);
    toggle.setAttribute('aria-expanded', String(s.guestsOpen));
    panel.classList.toggle('cb-open', s.guestsOpen);
    if (s.guestsOpen) ensureOutside(); else removeOutside();

    adultsRow.update(s.adults);
    childrenRow.update(s.children);
    infantsRow.update(s.infants);
  };
  state.on('*', render);
  render(state.get());

  return container;
}

function createCounterRow(
  title: string,
  subtitle: string,
  getValue: () => number,
  setValue: (v: number) => void,
  min: number,
  max: number,
): { el: HTMLElement; update: (v: number) => void } {
  const row = document.createElement('div');
  row.className = 'cb-guests-row';

  const info = document.createElement('div');
  info.className = 'cb-guests-row__info';

  const titleEl = document.createElement('span');
  titleEl.className = 'cb-guests-row__title';
  titleEl.textContent = title;

  const subtitleEl = document.createElement('span');
  subtitleEl.className = 'cb-guests-row__subtitle';
  subtitleEl.textContent = subtitle;

  info.appendChild(titleEl);
  info.appendChild(subtitleEl);

  const counter = document.createElement('div');
  counter.className = 'cb-counter';

  const decBtn = document.createElement('button');
  decBtn.className = 'cb-counter__btn';
  decBtn.setAttribute('type', 'button');
  decBtn.setAttribute('aria-label', `Decrease ${title}`);
  decBtn.appendChild(minus());

  const valueEl = document.createElement('span');
  valueEl.className = 'cb-counter__value';

  const incBtn = document.createElement('button');
  incBtn.className = 'cb-counter__btn';
  incBtn.setAttribute('type', 'button');
  incBtn.setAttribute('aria-label', `Increase ${title}`);
  incBtn.appendChild(plus());

  decBtn.addEventListener('click', () => {
    const v = getValue();
    if (v > min) setValue(v - 1);
  });

  incBtn.addEventListener('click', () => {
    const v = getValue();
    if (v < max) setValue(v + 1);
  });

  counter.appendChild(decBtn);
  counter.appendChild(valueEl);
  counter.appendChild(incBtn);

  row.appendChild(info);
  row.appendChild(counter);

  function update(v: number): void {
    valueEl.textContent = String(v);
    decBtn.disabled = v <= min;
    incBtn.disabled = v >= max;
  }

  return { el: row, update };
}
