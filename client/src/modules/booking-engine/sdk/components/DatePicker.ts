import type { StateManager } from '../state';
import type { WidgetState } from '../types';
import { calendar as calendarIcon } from './icons';

interface I18n {
  t: (key: string) => string;
}

/** Options de PRÉSENTATION du sélecteur de dates. La FONCTION est inchangée (calendrier custom + état) :
 *  seules la structure/cosmétique varient. Défaut (objet vide) = style compact historique. */
export interface DateFieldOptions {
  /** `true` = libellé rendu AU-DESSUS de la boîte (hors du bouton) + icône calendrier à gauche.
   *  Défaut (absent/false) = compact (libellé À L'INTÉRIEUR, pas d'icône). */
  labeled?: boolean;
  /** Texte quand aucune date n'est choisie. `undefined` = défaut i18n ; `''`/`null` = aucun placeholder. */
  placeholder?: string | null;
}

export function createDatePicker(state: StateManager, i18n: I18n, opts: DateFieldOptions = {}): HTMLElement {
  const container = document.createElement('div');
  container.className = opts.labeled ? 'cb-dates cb-dates--labeled' : 'cb-dates';

  const checkIn = createDateBox('checkin', i18n.t('searchBar.checkIn'), opts);
  const checkOut = createDateBox('checkout', i18n.t('searchBar.checkOut'), opts);
  container.appendChild(checkIn.root);
  container.appendChild(checkOut.root);

  // Bascule (toggle) : 1er clic ouvre le calendrier, 2e clic le FERME (corrige le « ne se ferme jamais »).
  // Ferme aussi les autres popovers (un seul ouvert à la fois).
  const toggle = (): void => {
    const s = state.get();
    state.set({ calendarOpen: !s.calendarOpen, guestsOpen: false, multiselectOpen: null }, 'calendarToggle');
  };
  checkIn.button.addEventListener('click', toggle);
  checkOut.button.addEventListener('click', toggle);

  const placeholder = opts.placeholder !== undefined ? opts.placeholder : i18n.t('searchBar.addDate');

  // State sync — rendu initial INCLUS (hauteur stable dès le montage).
  const render = (s: WidgetState): void => {
    updateDateBox(checkIn.button, s.checkIn, placeholder);
    updateDateBox(checkOut.button, s.checkOut, placeholder);
    checkIn.button.classList.toggle('cb-active', s.calendarOpen && !s.checkIn);
    checkOut.button.classList.toggle('cb-active', s.calendarOpen && !!s.checkIn && !s.checkOut);
  };
  state.on('*', render);
  render(state.get());

  return container;
}

/** Construit une boîte de date. Retourne la racine à insérer + le bouton cliquable : en compact, la racine
 *  EST le bouton ; en `labeled`, la racine est un champ `.cb-datefield` avec le libellé AU-DESSUS du bouton. */
function createDateBox(role: string, label: string, opts: DateFieldOptions): { root: HTMLElement; button: HTMLButtonElement } {
  const button = document.createElement('button');
  button.className = opts.labeled ? 'cb-date-input cb-date-input--icon' : 'cb-date-input';
  button.setAttribute('type', 'button');
  button.setAttribute('aria-label', label);
  button.dataset.role = role;

  if (opts.labeled) {
    const ic = calendarIcon();
    ic.classList.add('cb-date-input__ic');
    ic.setAttribute('aria-hidden', 'true');
    button.appendChild(ic);
  } else {
    // Compact : libellé À L'INTÉRIEUR de la boîte (au-dessus de la valeur).
    const labelEl = document.createElement('span');
    labelEl.className = 'cb-date-input__label';
    labelEl.textContent = label;
    button.appendChild(labelEl);
  }

  const valueEl = document.createElement('span');
  valueEl.className = 'cb-date-input__placeholder';
  valueEl.dataset.slot = 'value';
  button.appendChild(valueEl);

  if (!opts.labeled) return { root: button, button };

  // Labeled : libellé HORS de la boîte (au-dessus), comme une étiquette de champ de formulaire.
  const field = document.createElement('div');
  field.className = 'cb-datefield';
  const labelEl = document.createElement('span');
  labelEl.className = 'cb-datefield__label';
  labelEl.textContent = label;
  field.appendChild(labelEl);
  field.appendChild(button);
  return { root: field, button };
}

function updateDateBox(box: HTMLElement, date: string | null, placeholder: string | null): void {
  const valueEl = box.querySelector('[data-slot="value"]');
  if (!valueEl) return;

  if (date) {
    valueEl.className = 'cb-date-input__value';
    valueEl.textContent = formatDate(date);
  } else {
    valueEl.className = 'cb-date-input__placeholder';
    valueEl.textContent = placeholder ?? '';
  }
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: '2-digit' });
}
