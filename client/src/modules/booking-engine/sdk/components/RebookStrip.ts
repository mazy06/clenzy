import type { StateManager } from '../state';
import type { WidgetState } from '../types';
import type { BookingApi, ApiGuestBooking } from '../api';

interface I18n {
  t: (key: string) => string;
}

/**
 * Re-booking 1-clic (2.11). Bandeau « Réserver à nouveau » affiché seulement quand un voyageur est
 * connecté (token guest en mémoire) et a déjà réservé en direct. Un clic pré-sélectionne le logement
 * et le nombre de voyageurs ; le voyageur n'a plus qu'à choisir de nouvelles dates (aucun paiement
 * n'est déclenché ici — le flux normal de réservation s'applique ensuite).
 */
export function createRebookStrip(
  state: StateManager,
  i18n: I18n,
  api: BookingApi,
  organizationId: number,
): HTMLElement {
  const container = document.createElement('div');
  container.className = 'cb-section cb-rebook';
  container.hidden = true;

  let bookings: ApiGuestBooking[] = [];
  let fetchedForToken: string | null = null;
  let loading = false;

  function sync(s: WidgetState): void {
    const token = s.guestToken;
    if (!token) {
      // Déconnexion / pas de session → on masque et on réinitialise le cache.
      if (fetchedForToken !== null) {
        bookings = [];
        fetchedForToken = null;
        render();
      }
      return;
    }
    if (token === fetchedForToken || loading) {
      render();
      return;
    }
    loading = true;
    api.myBookings(organizationId, token)
      .then((list) => {
        bookings = dedupeByProperty(Array.isArray(list) ? list : []);
        fetchedForToken = token;
      })
      .catch(() => {
        bookings = [];
        fetchedForToken = token;
      })
      .finally(() => {
        loading = false;
        render();
      });
  }

  function render(): void {
    const key = `${fetchedForToken ?? ''}:${bookings.map((b) => b.code).join(',')}`;
    if (container.dataset.key === key) return;
    container.dataset.key = key;
    container.textContent = '';

    if (!bookings.length) {
      container.hidden = true;
      return;
    }
    container.hidden = false;

    const title = document.createElement('div');
    title.className = 'cb-rebook__title cb-text-sm cb-text-semibold';
    title.textContent = i18n.t('rebook.title');
    container.appendChild(title);

    const row = document.createElement('div');
    row.className = 'cb-rebook__row';
    bookings.forEach((b) => row.appendChild(card(b)));
    container.appendChild(row);
  }

  function card(b: ApiGuestBooking): HTMLElement {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'cb-rebook__card';
    el.disabled = b.propertyId == null;

    const name = document.createElement('div');
    name.className = 'cb-rebook__name cb-text-semibold';
    name.textContent = b.propertyName ?? '—';
    el.appendChild(name);

    const meta = document.createElement('div');
    meta.className = 'cb-rebook__meta cb-text-sm cb-text-secondary';
    meta.textContent = formatStay(b, i18n);
    el.appendChild(meta);

    const cta = document.createElement('span');
    cta.className = 'cb-rebook__cta';
    cta.textContent = i18n.t('rebook.again');
    el.appendChild(cta);

    el.addEventListener('click', () => {
      if (b.propertyId == null) return;
      // 1-clic : pré-sélection logement + voyageurs ; dates remises à zéro (choix par le voyageur).
      const guests = Math.max(1, b.guests || 1);
      state.set(
        {
          selectedPropertyId: b.propertyId,
          adults: guests,
          children: 0,
          checkIn: null,
          checkOut: null,
          pricing: null,
        },
        'stateChange',
      );
    });

    return el;
  }

  state.on('*', sync);
  sync(state.get());
  return container;
}

/** Un séjour par logement (le plus récent) — la liste serveur est déjà triée par check-in décroissant. */
function dedupeByProperty(list: ApiGuestBooking[]): ApiGuestBooking[] {
  const seen = new Set<number>();
  const out: ApiGuestBooking[] = [];
  for (const b of list) {
    if (b.propertyId == null || seen.has(b.propertyId)) continue;
    seen.add(b.propertyId);
    out.push(b);
  }
  return out;
}

function formatStay(b: ApiGuestBooking, i18n: I18n): string {
  const fmt = (iso: string): string => {
    try {
      return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return iso;
    }
  };
  const guests = `${b.guests} ${i18n.t(b.guests > 1 ? 'rebook.guests' : 'rebook.guest')}`;
  return `${fmt(b.checkIn)} · ${guests}`;
}
