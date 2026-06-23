import { StateManager, createInitialState } from '../state';
import { BookingApi, type ApiProperty, type ApiCalendar, type ApiAvailability } from '../api';
import { createBookingI18n, type BookingI18n } from '../i18n';
import type { WidgetState, WidgetProperty, DayAvailability, PriceBreakdown } from '../types';

/**
 * Cœur headless du booking (B1 — parcours template-driven).
 *
 * Possède l'ÉTAT (`StateManager`) + l'API (`BookingApi`) + la PERSISTANCE du parcours. L'état durable est
 * sauvegardé en `sessionStorage` (par onglet, clé dérivée de l'apiKey) et réhydraté à la construction
 * → le parcours SURVIT à la navigation entre les pages du template (objectif central de la refonte).
 *
 * B1 : le monolithe `BaitlyWidget` consomme ce cœur (state/api) sans changer son comportement. Les
 * primitives multi-pages (B2+) partageront ce même cœur via le bootstrap d'hydratation.
 */

/**
 * Clés DURABLES persistées (le « parcours »). EXCLUS volontairement :
 *  - auth/session : `guestToken`, `guestEmail` (règle sécurité #7 — jamais de token en web storage) ;
 *  - données re-fetchées : `properties`, `availability`, `pricing`, `currencies`, `propertyTypes`, `addons` ;
 *  - UI transitoire : `page`, `calendarOpen`, `guestsOpen`, `loading`, `error`, `guestFormErrors`, `wishlist`.
 * `guestForm` (brouillon coordonnées) est persisté : PII non sensible, volatile (sessionStorage par onglet).
 */
const DURABLE_KEYS = [
  'selectedPropertyId',
  'checkIn',
  'checkOut',
  'adults',
  'children',
  'infants',
  'destination',
  'displayCurrency',
  'cart',
  'guestForm',
  'selectedPropertyType',
] as const satisfies readonly (keyof WidgetState)[];

const STORAGE_PREFIX = 'clenzy_booking_';

export interface BaitlyBookingCoreOptions {
  apiKey: string;
  baseUrl: string;
  slug?: string;
  /** Langue du parcours (devise/i18n des libellés de prix). Défaut : 'fr'. */
  language?: 'fr' | 'en' | 'ar';
  /** Valeurs initiales (devise/voyageurs par défaut). Écrasées par l'état restauré et l'URL. */
  defaults?: Partial<WidgetState>;
  /** Persistance sessionStorage + lecture de la sélection en query string. Défaut : true. */
  persist?: boolean;
}

/** Vrai si sessionStorage est utilisable (peut échouer en navigation privée / quota). */
function sessionStorageAvailable(): boolean {
  try {
    const k = '__clenzy_test__';
    sessionStorage.setItem(k, '1');
    sessionStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

/** Hash court et stable (clé de stockage par apiKey, sans exposer la clé en clair). */
function shortHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/**
 * Sélection éventuellement passée en query string (liens partageables / retour de navigation).
 * Données NON sensibles uniquement (id de logement, dates) — jamais de PII en URL (règle confidentialité).
 */
function readUrlSelection(): Partial<WidgetState> {
  try {
    const p = new URLSearchParams(window.location.search);
    const out: Partial<WidgetState> = {};
    const prop = p.get('clenzy_property');
    if (prop && /^\d+$/.test(prop)) out.selectedPropertyId = Number(prop);
    const ci = p.get('clenzy_in');
    if (ci && /^\d{4}-\d{2}-\d{2}$/.test(ci)) out.checkIn = ci;
    const co = p.get('clenzy_out');
    if (co && /^\d{4}-\d{2}-\d{2}$/.test(co)) out.checkOut = co;
    return out;
  } catch {
    return {};
  }
}

export class BaitlyBookingCore {
  readonly state: StateManager;
  readonly api: BookingApi;
  readonly i18n: BookingI18n;
  private readonly storageKey: string;
  private readonly persistEnabled: boolean;
  private lastSerialized = '';
  private unsubscribe: (() => void) | null = null;
  // Effets de données (B2) : abonnements de fetch posés une seule fois par `start()`.
  private effectUnsubscribers: (() => void)[] = [];
  private started = false;
  // Suivi des champs déclencheurs de fetch (property / mois / devise) — miroir de BaitlyWidget.
  private prevPropertyId: number | null = null;
  private prevMonth = '';
  private prevCurrency = '';
  private prevFilters = '';
  private prevGuests = 0;

  constructor(opts: BaitlyBookingCoreOptions) {
    this.api = new BookingApi(opts.baseUrl, opts.apiKey, opts.slug);
    this.i18n = createBookingI18n(opts.language || 'fr');
    this.persistEnabled = opts.persist !== false && sessionStorageAvailable();
    this.storageKey = STORAGE_PREFIX + shortHash(opts.apiKey);

    const restored = this.persistEnabled ? this.readPersisted() : null;
    const urlSelection = readUrlSelection();
    // Priorité : URL > état restauré > défauts. (L'URL exprime une intention explicite de l'utilisateur.)
    this.state = new StateManager(createInitialState({ ...opts.defaults, ...restored, ...urlSelection }));

    if (this.persistEnabled) {
      this.lastSerialized = this.serializeDurable();
      // Sauvegarde à chaque mutation ; on compare le sous-ensemble durable → aucune écriture inutile.
      this.unsubscribe = this.state.on('*', () => this.persist());
    }
  }

  /**
   * Démarre les EFFETS DE DONNÉES du cœur partagé (B2) : devises + logements initiaux, puis re-fetch
   * du calendrier au changement de logement/mois et du pricing au changement de dates/devise. IDEMPOTENT
   * — un second appel est sans effet (utile car `getSharedBookingCore` peut être sollicité par plusieurs
   * pages/marqueurs). Réplique volontairement la logique de `BaitlyWidget.bindStateEffects` + ses fetchs
   * (DETTE B5 : à dédupliquer quand le monolithe sera retiré ; il garde ses propres effets → le cœur
   * partagé n'est PAS démarré par le monolithe pour éviter tout double-fetch).
   */
  start(): void {
    if (this.started) return;
    this.started = true;

    const s0 = this.state.get();
    this.prevPropertyId = s0.selectedPropertyId;
    this.prevMonth = s0.calendarBaseMonth;
    this.prevCurrency = s0.displayCurrency;
    this.prevFilters = JSON.stringify(s0.filters);
    this.prevGuests = s0.adults + s0.children;

    // Re-fetch sur changement de propriété / mois / devise / filtres / voyageurs.
    this.effectUnsubscribers.push(
      this.state.on('stateChange', (s: WidgetState) => {
        const currencyChanged = s.displayCurrency !== this.prevCurrency;
        const filtersChanged = JSON.stringify(s.filters) !== this.prevFilters;
        const propertyChanged = s.selectedPropertyId !== this.prevPropertyId;
        const monthChanged = s.calendarBaseMonth !== this.prevMonth;
        const guests = s.adults + s.children;
        const guestsChanged = guests !== this.prevGuests;
        this.prevCurrency = s.displayCurrency;
        this.prevFilters = JSON.stringify(s.filters);
        this.prevPropertyId = s.selectedPropertyId;
        this.prevMonth = s.calendarBaseMonth;
        this.prevGuests = guests;

        // Filtres ou devise → relance la recherche server-side de la liste.
        if (currencyChanged || filtersChanged) {
          void this.fetchProperties();
        }
        // Calendrier : per-property si sélection ; sinon agrégé (dépend des filtres + voyageurs + devise).
        const calendarRefetch = currencyChanged || propertyChanged || monthChanged
          || (!s.selectedPropertyId && (filtersChanged || guestsChanged));
        if (calendarRefetch) {
          void this.fetchCalendar();
        }
        if (currencyChanged && s.checkIn && s.checkOut) {
          void this.fetchPricing();
        }
      }),
    );

    // Prix quand les dates changent (via /availability).
    this.effectUnsubscribers.push(
      this.state.on('dateSelected', (s: WidgetState) => {
        if (s.checkIn && s.checkOut) void this.fetchPricing();
        else this.state.set({ pricing: null });
      }),
    );

    // Données initiales : devises + facettes de filtre + propriétés + calendrier agrégé (prix nuitée).
    void this.fetchCurrencies();
    void this.fetchSearchFilters();
    void this.fetchProperties();
    void this.fetchCalendar();
  }

  /** Charge les facettes de recherche (options du widget « Filtre »). Best-effort. */
  private async fetchSearchFilters(): Promise<void> {
    try {
      const facets = await this.api.getSearchFilters(this.state.get().displayCurrency);
      this.state.set({ filterFacets: facets });
    } catch {
      /* best-effort : sans facettes, le widget filtre se rabat sur les données déjà chargées */
    }
  }

  private async fetchCurrencies(): Promise<void> {
    try {
      const currencies = await this.api.getCurrencies();
      if (Array.isArray(currencies) && currencies.length) {
        this.state.set({ currencies });
      }
    } catch {
      /* best-effort : pas de sélecteur si l'endpoint échoue */
    }
  }

  private async fetchProperties(): Promise<void> {
    try {
      this.state.set({ loading: true });
      const { displayCurrency, filters } = this.state.get();
      const apiProps = await this.api.getProperties(displayCurrency, filters);
      const properties: WidgetProperty[] = apiProps.map(mapProperty);

      const s = this.state.get();
      // Auto-sélection si une seule propriété.
      const selectedPropertyId = s.selectedPropertyId
        ?? (properties.length === 1 ? properties[0].id : null);
      this.state.set({ properties, selectedPropertyId, loading: false }, 'stateChange');
    } catch (err) {
      this.state.set({ loading: false, error: msg(err) }, 'error');
    }
  }

  private async fetchCalendar(): Promise<void> {
    const s = this.state.get();
    try {
      this.state.set({ loading: true });
      let cal: ApiCalendar;
      if (s.selectedPropertyId) {
        // Calendrier EXACT du logement sélectionné (fiche détail).
        cal = await this.api.getCalendar(s.selectedPropertyId, s.calendarBaseMonth, 2, s.displayCurrency);
      } else {
        // Calendrier AGRÉGÉ (recherche) : prix nuitée le plus bas par jour selon filtres + capacité
        // voyageurs (bébés non comptés). Jours sans logement dispo → grisés.
        const guests = s.adults + s.children;
        cal = await this.api.getPriceCalendar(s.calendarBaseMonth, 2, guests, s.displayCurrency, s.filters);
      }
      this.state.set({ availability: toAvailabilityMap(cal), loading: false });
    } catch (err) {
      this.state.set({ loading: false, error: msg(err) }, 'error');
    }
  }

  private async fetchPricing(): Promise<void> {
    const s = this.state.get();
    if (!s.selectedPropertyId || !s.checkIn || !s.checkOut) return;
    try {
      this.state.set({ pricingLoading: true });
      const avail: ApiAvailability = await this.api.checkAvailability(
        { propertyId: s.selectedPropertyId, checkIn: s.checkIn, checkOut: s.checkOut, guests: s.adults + s.children },
        s.displayCurrency,
        s.guestToken ?? undefined, // tarif membre (2.8) si voyageur connecté
      );
      if (!avail.available) {
        this.state.set({ pricing: null, pricingLoading: false, error: avail.violations?.[0] ?? null }, 'error');
        return;
      }
      this.state.set({ pricing: toPriceBreakdown(avail, this.i18n), pricingLoading: false }, 'priceUpdated');
    } catch (err) {
      this.state.set({ pricingLoading: false, error: msg(err) }, 'error');
    }
  }

  private serializeDurable(): string {
    const s = this.state.get();
    const out: Record<string, unknown> = {};
    for (const k of DURABLE_KEYS) out[k] = s[k];
    return JSON.stringify(out);
  }

  private persist(): void {
    const json = this.serializeDurable();
    if (json === this.lastSerialized) return;
    this.lastSerialized = json;
    try {
      sessionStorage.setItem(this.storageKey, json);
    } catch {
      /* quota / mode privé : un échec de persistance ne doit jamais interrompre le parcours */
    }
  }

  private readPersisted(): Partial<WidgetState> | null {
    try {
      const raw = sessionStorage.getItem(this.storageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      for (const k of DURABLE_KEYS) {
        if (parsed[k] !== undefined) out[k] = parsed[k];
      }
      return out as Partial<WidgetState>;
    } catch {
      return null;
    }
  }

  /** Vide l'état persisté (ex. après confirmation de réservation, pour repartir d'un parcours neuf). */
  clearPersisted(): void {
    try {
      sessionStorage.removeItem(this.storageKey);
    } catch {
      /* no-op */
    }
    this.lastSerialized = '';
  }

  destroy(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.effectUnsubscribers.forEach((fn) => fn());
    this.effectUnsubscribers = [];
    this.started = false;
    this.state.destroy();
  }
}

// ─── Registre singleton du cœur partagé (B2) ──────────────────────────────────

/**
 * Stocke un cœur PARTAGÉ par apiKey sur `window` : tous les marqueurs hydratés d'une même page (et les
 * pages successives du même onglet, via la persistance B1) partagent le MÊME état. La clé inclut l'apiKey
 * → deux sites/orgs sur le même domaine n'écrasent pas leur état mutuellement (cf. risque R2 de l'archi).
 */
const SHARED_REGISTRY_KEY = '__clenzyBookingCores__';

type SharedRegistry = Record<string, BaitlyBookingCore>;

function getRegistry(): SharedRegistry {
  const w = window as unknown as Record<string, unknown>;
  if (!w[SHARED_REGISTRY_KEY]) w[SHARED_REGISTRY_KEY] = {} as SharedRegistry;
  return w[SHARED_REGISTRY_KEY] as SharedRegistry;
}

/**
 * Renvoie le cœur partagé pour cet apiKey, en le créant (et en appelant `start()`) à la première
 * demande. IDEMPOTENT : les appels suivants réutilisent l'instance et NE relancent PAS les fetchs
 * (un seul jeu d'effets de données par page → aucun double-fetch entre marqueurs).
 */
export function getSharedBookingCore(opts: BaitlyBookingCoreOptions): BaitlyBookingCore {
  const registry = getRegistry();
  const key = shortHash(opts.apiKey);
  let core = registry[key];
  if (!core) {
    core = new BaitlyBookingCore(opts);
    registry[key] = core;
    core.start();
  }
  return core;
}

// ─── Mappers API → état (DETTE B5 : dupliqués depuis BaitlyWidget le temps de la migration) ──────

function mapProperty(p: ApiProperty): WidgetProperty {
  return {
    id: p.id,
    name: p.name,
    type: p.type,
    city: p.city,
    country: p.country,
    bedroomCount: p.bedroomCount,
    bathroomCount: p.bathroomCount,
    maxGuests: p.maxGuests,
    priceFrom: p.priceFrom,
    cleaningFee: p.cleaningFee,
    minimumNights: p.minimumNights,
    currency: p.currency,
    mainPhotoUrl: p.mainPhotoUrl,
    amenities: p.amenities,
    checkInTime: p.checkInTime,
    checkOutTime: p.checkOutTime,
    totalBookings: p.totalBookings,
    availableDays30: p.availableDays30,
  };
}

function toAvailabilityMap(cal: ApiCalendar): Map<string, DayAvailability> {
  const map = new Map<string, DayAvailability>();
  cal.days.forEach((d) => {
    map.set(d.date, {
      date: d.date,
      available: d.available,
      minPrice: d.price,
      minNights: d.minNights,
      isCheckInOnly: d.checkInOnly,
      isCheckOutOnly: d.checkOutOnly,
    });
  });
  return map;
}

function toPriceBreakdown(a: ApiAvailability, i18n: { t: (k: string) => string }): PriceBreakdown {
  const nightlyRate = a.nights > 0 ? a.subtotal / a.nights : 0;
  // Book Direct & Save (2.8) : a.subtotal est déjà remisé → ligne de base au tarif PLEIN + ligne « réservation directe ».
  const directDiscount = a.directDiscount ?? 0;
  const fullSubtotal = a.subtotal + directDiscount;
  const lines: PriceBreakdown['lines'] = [
    { label: `${a.nights} ${i18n.t('cart.nights')}`, amount: fullSubtotal, type: 'base' },
  ];
  if (directDiscount > 0) {
    lines.push({ label: i18n.t('price.directDiscount'), amount: -directDiscount, type: 'discount' });
  }
  if (a.cleaningFee > 0) lines.push({ label: i18n.t('validation.cleaningFee'), amount: a.cleaningFee, type: 'fee' });
  if (a.touristTax > 0) lines.push({ label: i18n.t('validation.touristTax'), amount: a.touristTax, type: 'fee' });
  return {
    nightlyRate,
    nights: a.nights,
    subtotal: a.subtotal,
    cleaningFee: a.cleaningFee,
    addonsTotal: 0,
    total: a.total,
    currency: a.currency,
    lines,
  };
}

function msg(err: unknown): string {
  return err instanceof Error ? err.message : 'Unknown error';
}
