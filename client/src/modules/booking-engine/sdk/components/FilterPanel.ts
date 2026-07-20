import type { StateManager } from '../state';
import type { WidgetState, SearchFilters, FilterFacets, WidgetProperty } from '../types';
import { sliders, chevronDown } from './icons';

interface I18n {
  t: (key: string) => string;
  tObject: (key: string) => Record<string, string>;
}

/** Sous-filtres disponibles dans le widget Filtre, dans l'ordre par défaut. Le Studio en choisit le sous-ensemble + l'ordre. */
export const FILTER_SUB_KEYS = ['type', 'price', 'bedrooms', 'bathrooms', 'guests', 'amenities'] as const;
export type FilterSubKey = (typeof FILTER_SUB_KEYS)[number];

/** Libellés FR des sous-filtres (UI admin du constructeur de composite). Le panneau lui-même utilise l'i18n. */
export const FILTER_SUB_LABELS: Record<FilterSubKey, string> = {
  type: 'Type de logement',
  price: 'Prix',
  bedrooms: 'Chambres',
  bathrooms: 'Salles de bain',
  guests: 'Voyageurs',
  amenities: 'Équipements',
};

function normalizeSubs(subs: string[] | null | undefined): FilterSubKey[] {
  const valid = new Set<string>(FILTER_SUB_KEYS);
  const picked = (subs ?? []).filter((s): s is FilterSubKey => valid.has(s));
  return picked.length ? [...new Set(picked)] : [...FILTER_SUB_KEYS];
}

function countActive(f: SearchFilters): number {
  return (f.types.length ? 1 : 0) + (f.amenities.length ? 1 : 0)
    + (f.minPrice != null || f.maxPrice != null ? 1 : 0)
    + (f.minBedrooms != null ? 1 : 0) + (f.minBathrooms != null ? 1 : 0) + (f.minGuests != null ? 1 : 0);
}

function toggleIn(arr: string[], v: string): string[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

function parseNum(s: string): number | null {
  const n = parseFloat(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Facettes : depuis l'état (runtime, via /search-filters) ou dérivées des logements chargés (aperçu éditeur). */
function facetsFrom(s: WidgetState): FilterFacets {
  return s.filterFacets ?? deriveFacets(s.properties);
}

function deriveFacets(props: WidgetProperty[]): FilterFacets {
  const typeCounts = new Map<string, number>();
  const amenityCounts = new Map<string, number>();
  let priceMin: number | null = null;
  let priceMax: number | null = null;
  let maxBedrooms = 0, maxBathrooms = 0, maxGuests = 0;
  let currency: string | null = null;
  for (const p of props) {
    if (p.type) typeCounts.set(p.type, (typeCounts.get(p.type) ?? 0) + 1);
    for (const a of p.amenities ?? []) amenityCounts.set(a, (amenityCounts.get(a) ?? 0) + 1);
    if (p.priceFrom != null) {
      priceMin = priceMin == null ? p.priceFrom : Math.min(priceMin, p.priceFrom);
      priceMax = priceMax == null ? p.priceFrom : Math.max(priceMax, p.priceFrom);
    }
    if (p.bedroomCount != null) maxBedrooms = Math.max(maxBedrooms, p.bedroomCount);
    if (p.bathroomCount != null) maxBathrooms = Math.max(maxBathrooms, p.bathroomCount);
    if (p.maxGuests != null) maxGuests = Math.max(maxGuests, p.maxGuests);
    if (!currency && p.currency) currency = p.currency;
  }
  const toFacets = (m: Map<string, number>) =>
    [...m.entries()].sort((a, b) => b[1] - a[1]).map(([code, count]) => ({ code, count }));
  return { propertyTypes: toFacets(typeCounts), amenities: toFacets(amenityCounts), priceMin, priceMax, maxBedrooms, maxBathrooms, maxGuests, currency };
}

function facetSignature(f: FilterFacets): string {
  return [
    f.propertyTypes.map((t) => t.code).join('|'),
    f.amenities.map((a) => a.code).join('|'),
    f.priceMin, f.priceMax, f.maxBedrooms, f.maxBathrooms, f.maxGuests,
  ].join('::');
}

/**
 * Widget « Filtre » : bouton icône (sliders + chevron + pastille) qui révèle, EN FLUX dans la barre, des
 * sous-filtres choisis/ordonnés au Studio (props `subs`). Application LIVE (pas de bouton Appliquer) :
 * chaque contrôle écrit directement `state.filters` → le cœur refait la recherche, `PropertyList` re-filtre.
 * Sous-filtres : type / chambres / SDB / voyageurs = SELECT ; équipements = MULTI-SELECT ; prix = 2 champs.
 * Tous habillés par le template (classes `.cb-input` / `.cb-property-select`). Facettes : `state.filterFacets`
 * (runtime) ou dérivées des logements chargés (aperçu éditeur sans réseau).
 */
export function createFilterPanel(state: StateManager, i18n: I18n, subs?: string[] | null): HTMLElement {
  const enabledSubs = normalizeSubs(subs);
  const container = document.createElement('div');
  container.className = 'cb-section cb-filters';

  const current = (): SearchFilters => state.get().filters;
  const patch = (p: Partial<SearchFilters>) => state.set({ filters: { ...current(), ...p } }, 'stateChange');

  // Déclencheur : icône (sliders) + pastille (nb filtres actifs) + chevron (haut/bas = ouvert/fermé).
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'cb-filters__toggle';
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-label', i18n.t('filters.title'));
  toggle.appendChild(sliders());
  const badge = document.createElement('span');
  badge.className = 'cb-filters__badge';
  badge.hidden = true;
  toggle.appendChild(badge);
  const chevron = document.createElement('span');
  chevron.className = 'cb-filters__chevron';
  chevron.appendChild(chevronDown());
  toggle.appendChild(chevron);

  const panel = document.createElement('div');
  panel.className = 'cb-filters__panel';

  let open = false;
  const setOpen = (v: boolean) => {
    open = v;
    toggle.classList.toggle('cb-open', v);
    panel.classList.toggle('cb-open', v);
    toggle.setAttribute('aria-expanded', String(v));
  };
  toggle.addEventListener('click', () => setOpen(!open));

  container.append(toggle, panel);

  const typeLabels = i18n.tObject('propertyTypes');
  const syncFns: Array<() => void> = [];

  // Pastille = nombre de filtres actifs (live).
  const refreshValue = () => {
    const n = countActive(current());
    badge.textContent = String(n);
    badge.hidden = n === 0;
    toggle.classList.toggle('cb-has-active', n > 0);
  };
  const syncAll = () => { syncFns.forEach((fn) => fn()); refreshValue(); };

  function group(label: string, body: HTMLElement): HTMLElement {
    const g = document.createElement('div');
    g.className = 'cb-section';
    const l = document.createElement('span');
    l.className = 'cb-section-label';
    l.textContent = label;
    g.append(l, body);
    return g;
  }

  /** Enveloppe un contrôle dans une boîte champ `.sb__control` → MÊME habillage (fond crème + bordure du
   *  template) que les champs de la barre ; le contrôle interne est « nu » (cf. reset `.sb__control`). */
  const sbBox = (control: HTMLElement): HTMLElement => {
    const box = document.createElement('div');
    box.className = 'sb__control';
    box.appendChild(control);
    return box;
  };

  /** SELECT mono-valeur : dropdown CUSTOM stylisé (≠ `<select>` natif) + coordonné (un seul popover ouvert). */
  function selectControl(options: Array<{ value: string; label: string }>, get: () => string, set: (v: string) => void): HTMLElement {
    return sbBox(createSingleSelect(state, { getOptions: () => options, getValue: get, setValue: set }));
  }

  /** SELECT « minimum » : Tous · 1+ · 2+ … (chambres / SDB / voyageurs). */
  function minSelect(max: number, get: () => number | null, set: (v: number | null) => void): HTMLElement {
    const options = [{ value: '', label: i18n.t('filters.any') }];
    for (let i = 1; i <= Math.min(max, 6); i++) options.push({ value: String(i), label: `${i}+` });
    return selectControl(options, () => { const v = get(); return v != null ? String(v) : ''; }, (v) => set(v ? Number(v) : null));
  }

  /** MULTI-SELECT habillé template (déclencheur `.cb-input` + popover de cases à cocher). */
  function multiSelect(items: Array<{ code: string; label: string }>, get: () => string[], onToggle: (code: string) => void): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'cb-multiselect';
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'cb-input cb-property-select__control cb-multiselect__trigger';
    const labelSpan = document.createElement('span');
    trigger.appendChild(labelSpan);
    const chev = document.createElement('span');
    chev.className = 'cb-property-select__chevron';
    chev.appendChild(chevronDown());
    const pop = document.createElement('div');
    pop.className = 'cb-multiselect__panel';
    for (const it of items) {
      const opt = document.createElement('label');
      opt.className = 'cb-multiselect__option';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.addEventListener('change', () => onToggle(it.code));
      const txt = document.createElement('span');
      txt.textContent = it.label;
      opt.append(cb, txt);
      syncFns.push(() => { cb.checked = get().includes(it.code); });
      pop.appendChild(opt);
    }
    let msOpen = false;
    const setMs = (v: boolean) => { msOpen = v; pop.classList.toggle('cb-open', v); trigger.classList.toggle('cb-open', v); };
    trigger.addEventListener('click', () => setMs(!msOpen));
    syncFns.push(() => {
      const n = get().length;
      labelSpan.textContent = n ? `${i18n.t('filters.amenities')} (${n})` : i18n.t('filters.amenities');
    });
    wrap.append(trigger, chev, pop);
    return sbBox(wrap);
  }

  function priceGroup(facets: FilterFacets): HTMLElement {
    const row = document.createElement('div');
    row.className = 'cb-row cb-gap-2';
    const mkInput = (ph: string, getV: () => number | null, setV: (n: number | null) => void): HTMLInputElement => {
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.className = 'cb-input';
      inp.min = '0';
      inp.placeholder = ph;
      inp.addEventListener('input', () => setV(parseNum(inp.value)));
      syncFns.push(() => { if (document.activeElement !== inp) { const v = getV(); inp.value = v != null ? String(v) : ''; } });
      return inp;
    };
    const min = mkInput(facets.priceMin != null ? String(Math.floor(facets.priceMin)) : i18n.t('filters.priceMin'),
      () => current().minPrice, (n) => patch({ minPrice: n }));
    const max = mkInput(facets.priceMax != null ? String(Math.ceil(facets.priceMax)) : i18n.t('filters.priceMax'),
      () => current().maxPrice, (n) => patch({ maxPrice: n }));
    row.append(min, max);
    return group(`${i18n.t('filters.price')}${facets.currency ? ` (${facets.currency})` : ''}`, sbBox(row));
  }

  // Constructeurs de sections par clé de sous-filtre (chacune gardée par les facettes disponibles).
  const sectionFor: Record<FilterSubKey, () => HTMLElement | null> = {
    type: () => {
      const f = facetsFrom(state.get());
      if (!f.propertyTypes.length) return null;
      const options = [{ value: '', label: i18n.t('filters.any') },
        ...f.propertyTypes.map((t) => ({ value: t.code, label: typeLabels[t.code] || t.code }))];
      return group(i18n.t('filters.type'),
        selectControl(options, () => current().types[0] ?? '', (v) => patch({ types: v ? [v] : [] })));
    },
    price: () => {
      const f = facetsFrom(state.get());
      return (f.priceMin != null && f.priceMax != null && f.priceMax > f.priceMin) ? priceGroup(f) : null;
    },
    bedrooms: () => {
      const max = facetsFrom(state.get()).maxBedrooms;
      return max >= 1 ? group(i18n.t('filters.bedrooms'), minSelect(max, () => current().minBedrooms, (v) => patch({ minBedrooms: v }))) : null;
    },
    bathrooms: () => {
      const max = facetsFrom(state.get()).maxBathrooms;
      return max >= 1 ? group(i18n.t('filters.bathrooms'), minSelect(max, () => current().minBathrooms, (v) => patch({ minBathrooms: v }))) : null;
    },
    guests: () => {
      const max = facetsFrom(state.get()).maxGuests;
      return max >= 1 ? group(i18n.t('filters.guests'), minSelect(max, () => current().minGuests, (v) => patch({ minGuests: v }))) : null;
    },
    amenities: () => {
      const f = facetsFrom(state.get());
      return f.amenities.length
        ? group(i18n.t('filters.amenities'), multiSelect(
            f.amenities.map((a) => ({ code: a.code, label: a.code })),
            () => current().amenities,
            (code) => patch({ amenities: toggleIn(current().amenities, code) })))
        : null;
    },
  };

  let builtSig = '';
  const build = (s: WidgetState) => {
    const sig = enabledSubs.join(',') + '#' + facetSignature(facetsFrom(s));
    if (sig === builtSig) { syncAll(); return; }
    builtSig = sig;
    panel.textContent = '';
    syncFns.length = 0;
    // Rendu des sous-filtres choisis, DANS L'ORDRE configuré au Studio (chacun gardé par ses facettes).
    for (const key of enabledSubs) {
      const sec = sectionFor[key]();
      if (sec) panel.appendChild(sec);
    }
    syncAll();
  };

  state.on('*', (s) => build(s));
  build(state.get());

  return container;
}

/* ── Critères de filtre AUTONOMES (widgets indépendants, déposables/déplaçables en DnD) ──────────────────
 * Mêmes contrôles que les sous-filtres du widget « Filtre », mais chacun est un widget à part entière qui
 * écrit directement `state.filters` (live). Options/bornes issues des facettes. */

type MinField = 'minBedrooms' | 'minBathrooms' | 'minGuests';

/** Critère PRIX autonome : deux champs (min / max). */
export function createPriceFilter(state: StateManager, i18n: I18n): HTMLElement {
  const row = document.createElement('div');
  row.className = 'cb-row cb-gap-2 cb-criterion';
  const patch = (p: Partial<SearchFilters>) => state.set({ filters: { ...state.get().filters, ...p } }, 'stateChange');
  const min = document.createElement('input'); min.type = 'number'; min.className = 'cb-input'; min.min = '0';
  const max = document.createElement('input'); max.type = 'number'; max.className = 'cb-input'; max.min = '0';
  min.addEventListener('input', () => patch({ minPrice: parseNum(min.value) }));
  max.addEventListener('input', () => patch({ maxPrice: parseNum(max.value) }));
  row.append(min, max);
  const sync = (s: WidgetState) => {
    const f = facetsFrom(s);
    min.placeholder = f.priceMin != null ? String(Math.floor(f.priceMin)) : i18n.t('filters.priceMin');
    max.placeholder = f.priceMax != null ? String(Math.ceil(f.priceMax)) : i18n.t('filters.priceMax');
    if (document.activeElement !== min) min.value = s.filters.minPrice != null ? String(s.filters.minPrice) : '';
    if (document.activeElement !== max) max.value = s.filters.maxPrice != null ? String(s.filters.maxPrice) : '';
  };
  state.on('*', sync); sync(state.get());
  return row;
}

/** Critère « minimum » autonome (chambres / SDB / capacité) : dropdown CUSTOM stylisé Tous · 1+ · 2+ … */
export function createMinFilter(state: StateManager, i18n: I18n, field: MinField, maxOf: (f: FilterFacets) => number): HTMLElement {
  return createSingleSelect(state, {
    getOptions: (s) => {
      const max = Math.min(Math.max(maxOf(facetsFrom(s)), 1), 6);
      const opts = [{ value: '', label: i18n.t('filters.any') }];
      for (let i = 1; i <= max; i++) opts.push({ value: String(i), label: `${i}+` });
      return opts;
    },
    getValue: () => { const v = state.get().filters[field]; return v != null ? String(v) : ''; },
    setValue: (v) => state.set({ filters: { ...state.get().filters, [field]: v ? Number(v) : null } }, 'stateChange'),
  });
}

/**
 * Dropdown SINGLE-SELECT CUSTOM (déclencheur stylisé `.cb-property-select__control` + popover de la liste),
 * pour habiller les selects des sous-filtres comme le calendrier/voyageurs (≠ `<select>` natif du navigateur).
 * Coordonné via `multiselectOpen` (un seul popover ouvert à la fois, clic-outside, ferme calendrier/voyageurs).
 * `getOptions` renvoie `[]` ⇒ le widget est masqué (pas d'options disponibles).
 */
export function createSingleSelect(
  state: StateManager,
  cfg: { getOptions: (s: WidgetState) => Array<{ value: string; label: string }>; getValue: () => string; setValue: (v: string) => void },
): HTMLElement {
  const id = `ms-${++MS_SEQ}`;
  const wrap = document.createElement('div');
  wrap.className = 'cb-property-select cb-singleselect cb-criterion';
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'cb-input cb-property-select__control cb-singleselect__trigger';
  const labelSpan = document.createElement('span');
  trigger.appendChild(labelSpan);
  const chev = document.createElement('span');
  chev.className = 'cb-property-select__chevron';
  chev.appendChild(chevronDown());
  const pop = document.createElement('div');
  pop.className = 'cb-multiselect__panel cb-singleselect__panel';
  wrap.append(trigger, chev, pop);

  trigger.addEventListener('click', () => {
    const cur = state.get().multiselectOpen;
    state.set({ multiselectOpen: cur === id ? null : id, calendarOpen: false, guestsOpen: false }, 'msToggle');
  });
  let outsideDoc: Document | null = null;
  const onOutsidePointer = (e: Event): void => {
    if (!wrap.isConnected) { removeOutside(); return; }
    if (state.get().multiselectOpen !== id) return;
    if (!wrap.contains(e.target as Node | null)) state.set({ multiselectOpen: null }, 'msToggle');
  };
  const ensureOutside = (): void => {
    const doc = wrap.ownerDocument;
    if (outsideDoc === doc) return;
    if (outsideDoc) outsideDoc.removeEventListener('pointerdown', onOutsidePointer, true);
    doc.addEventListener('pointerdown', onOutsidePointer, true);
    outsideDoc = doc;
  };
  const removeOutside = (): void => {
    if (outsideDoc) { outsideDoc.removeEventListener('pointerdown', onOutsidePointer, true); outsideDoc = null; }
  };

  let builtSig = '';
  const sync = (s: WidgetState) => {
    const options = cfg.getOptions(s);
    if (options.length === 0) { wrap.hidden = true; return; }
    wrap.hidden = false;
    const sig = options.map((o) => `${o.value}:${o.label}`).join('|');
    if (sig !== builtSig) {
      builtSig = sig;
      pop.textContent = '';
      for (const o of options) {
        const optEl = document.createElement('button');
        optEl.type = 'button';
        optEl.className = 'cb-multiselect__option cb-singleselect__option';
        optEl.dataset.value = o.value;
        optEl.textContent = o.label;
        optEl.addEventListener('click', () => { cfg.setValue(o.value); state.set({ multiselectOpen: null }, 'msToggle'); });
        pop.appendChild(optEl);
      }
    }
    const cur = cfg.getValue();
    const selected = options.find((o) => o.value === cur);
    labelSpan.textContent = selected ? selected.label : (options[0]?.label ?? '');
    for (const c of Array.from(pop.children)) {
      (c as HTMLElement).classList.toggle('cb-selected', (c as HTMLElement).dataset.value === cur);
    }
    const isOpen = s.multiselectOpen === id;
    pop.classList.toggle('cb-open', isOpen);
    trigger.classList.toggle('cb-open', isOpen);
    if (isOpen) ensureOutside(); else removeOutside();
  };
  state.on('*', sync); sync(state.get());
  return wrap;
}

/** Critère ÉQUIPEMENTS autonome : multi-select (déclencheur + popover de cases). */
/** Compteur d'instances → id unique par multi-select (gestion « un seul popover ouvert à la fois »). */
let MS_SEQ = 0;
export function createAmenitiesFilter(state: StateManager, i18n: I18n): HTMLElement {
  const id = `ms-${++MS_SEQ}`;
  const wrap = document.createElement('div');
  wrap.className = 'cb-multiselect cb-criterion';
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'cb-input cb-property-select__control cb-multiselect__trigger';
  const labelSpan = document.createElement('span');
  trigger.appendChild(labelSpan);
  const chev = document.createElement('span');
  chev.className = 'cb-property-select__chevron';
  chev.appendChild(chevronDown());
  const pop = document.createElement('div');
  pop.className = 'cb-multiselect__panel';
  wrap.append(trigger, chev, pop);
  trigger.addEventListener('click', () => {
    const cur = state.get().multiselectOpen;
    // Toggle ; à l'ouverture, ferme les autres popovers (un seul ouvert à la fois).
    state.set({ multiselectOpen: cur === id ? null : id, calendarOpen: false, guestsOpen: false }, 'msToggle');
  });
  // Fermeture au clic EN DEHORS (zone = `wrap`).
  let outsideDoc: Document | null = null;
  const onOutsidePointer = (e: Event): void => {
    if (!wrap.isConnected) { removeOutside(); return; }
    if (state.get().multiselectOpen !== id) return;
    if (!wrap.contains(e.target as Node | null)) state.set({ multiselectOpen: null }, 'msToggle');
  };
  const ensureOutside = (): void => {
    const doc = wrap.ownerDocument;
    if (outsideDoc === doc) return;
    if (outsideDoc) outsideDoc.removeEventListener('pointerdown', onOutsidePointer, true);
    doc.addEventListener('pointerdown', onOutsidePointer, true);
    outsideDoc = doc;
  };
  const removeOutside = (): void => {
    if (outsideDoc) { outsideDoc.removeEventListener('pointerdown', onOutsidePointer, true); outsideDoc = null; }
  };
  let builtSig = '';
  let codes: string[] = [];
  const sync = (s: WidgetState) => {
    const items = facetsFrom(s).amenities;
    const sig = items.map((a) => a.code).join('|');
    if (sig !== builtSig) {
      builtSig = sig;
      codes = items.map((a) => a.code);
      pop.textContent = '';
      for (const a of items) {
        const opt = document.createElement('label');
        opt.className = 'cb-multiselect__option';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.addEventListener('change', () => state.set({ filters: { ...state.get().filters, amenities: toggleIn(state.get().filters.amenities, a.code) } }, 'stateChange'));
        const txt = document.createElement('span');
        txt.textContent = a.code;
        opt.append(cb, txt);
        pop.appendChild(opt);
      }
    }
    const selected = s.filters.amenities;
    const selectedSet = new Set(selected);
    Array.from(pop.querySelectorAll<HTMLInputElement>('input')).forEach((cb, i) => { cb.checked = selectedSet.has(codes[i]); });
    const n = selected.length;
    labelSpan.textContent = n ? `${i18n.t('filters.amenities')} (${n})` : i18n.t('filters.amenities');
    // Ouverture pilotée par l'état partagé (un seul popover ouvert) + click-outside.
    const isOpen = s.multiselectOpen === id;
    pop.classList.toggle('cb-open', isOpen);
    trigger.classList.toggle('cb-open', isOpen);
    if (isOpen) ensureOutside(); else removeOutside();
  };
  state.on('*', sync); sync(state.get());
  return wrap;
}
