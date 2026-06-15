// Client HTTP du widget embarquable — cible la VRAIE API publique du Booking Engine
// (PublicBookingController, base path /api/public/booking/{slug}, header X-Booking-Key).
// L'org est resolue par la cle API ; {slug} est un placeholder de routage.

export interface ApiProperty {
  id: number;
  name: string;
  type: string | null;
  city: string | null;
  country: string | null;
  bedroomCount: number | null;
  bathroomCount: number | null;
  maxGuests: number | null;
  squareMeters: number | null;
  priceFrom: number | null;
  cleaningFee: number | null;
  minimumNights: number | null;
  currency: string;
  mainPhotoUrl: string | null;
  photoUrls: string[];
  amenities: string[] | null;
  checkInTime: string | null;
  checkOutTime: string | null;
  totalBookings: number | null;
  availableDays30: number | null;
}

export interface ApiCalendarDay {
  date: string;
  available: boolean;
  price: number | null;
  minNights: number;
  checkInOnly: boolean;
  checkOutOnly: boolean;
}

export interface ApiCalendar {
  propertyId: number;
  currency: string;
  days: ApiCalendarDay[];
}

export interface ApiNightBreakdown {
  date: string;
  price: number;
  rateType: string;
}

export interface ApiAvailability {
  available: boolean;
  propertyId: number;
  propertyName: string | null;
  checkIn: string;
  checkOut: string;
  guests: number;
  nights: number;
  breakdown: ApiNightBreakdown[];
  subtotal: number;
  cleaningFee: number;
  touristTax: number;
  total: number;
  /** Book Direct & Save (2.8) : économie déjà déduite de subtotal/total. */
  directDiscount: number;
  currency: string;
  minStay: number | null;
  maxGuests: number | null;
  checkInTime: string | null;
  checkOutTime: string | null;
  violations: string[];
}

export interface ApiReserveResult {
  reservationCode: string;
  status: string;
  propertyName: string;
  checkIn: string;
  checkOut: string;
  total: number;
  currency: string;
  requiresPayment: boolean;
}

export interface ApiCheckoutResult {
  checkoutUrl: string | null;
  sessionId: string | null;
}

export interface ApiBatchReserveResult {
  batchCode: string;
  reservations: ApiReserveResult[];
  grandTotal: number;
  currency: string;
  requiresPayment: boolean;
}

/** Séjour direct passé d'un voyageur connecté (re-booking 1-clic, 2.11). */
export interface ApiGuestBooking {
  code: string;
  propertyId: number | null;
  propertyName: string | null;
  checkIn: string;
  checkOut: string;
  guests: number;
  status: string;
  total: number | null;
  currency: string;
}

export interface ReserveGuestInfo {
  name: string;
  email: string;
  phone?: string;
}

/** Réponse d'auth guest (Keycloak realm clenzy-guests) — token gardé EN MÉMOIRE (règle #7). */
export interface GuestAuthResult {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  keycloakId?: string;
  profile?: { email?: string; firstName?: string; lastName?: string };
}

export class BookingApi {
  private readonly base: string;
  private readonly root: string;
  private readonly apiKey: string;

  constructor(baseUrl: string, apiKey: string, slug = 'widget') {
    const root = baseUrl.replace(/\/$/, '');
    this.root = root;
    this.base = `${root}/api/public/booking/${encodeURIComponent(slug)}`;
    this.apiKey = apiKey;
  }

  // ─── Compte voyageur (2.11) — auth guest + wishlist ──────────────────────
  // URLs hors base booking : /api/booking-engine/auth/** (permitAll) et /api/public/guest/wishlist
  // (token guest validé côté serveur via Keycloak userinfo). Pas de X-Booking-Key ici.

  private async rootFetch<T>(path: string, options?: RequestInit, bearer?: string): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options?.headers as Record<string, string> | undefined),
    };
    if (bearer) headers['Authorization'] = `Bearer ${bearer}`;
    const res = await fetch(`${this.root}${path}`, { ...options, headers });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`API error ${res.status}: ${body}`);
    }
    const text = await res.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }

  guestLogin(organizationId: number, email: string, password: string): Promise<GuestAuthResult> {
    return this.rootFetch('/api/booking-engine/auth/login', {
      method: 'POST', body: JSON.stringify({ organizationId, email, password }),
    });
  }

  guestRegister(
    organizationId: number,
    data: { email: string; password: string; firstName?: string; lastName?: string; phone?: string },
  ): Promise<GuestAuthResult> {
    return this.rootFetch('/api/booking-engine/auth/register', {
      method: 'POST', body: JSON.stringify({ ...data, organizationId }),
    });
  }

  /** Re-booking 1-clic (2.11) : séjours directs passés du voyageur connecté (token guest validé). */
  myBookings(organizationId: number, token: string): Promise<ApiGuestBooking[]> {
    return this.rootFetch(`/api/public/guest/bookings?organizationId=${organizationId}`, { method: 'GET' }, token);
  }

  /** Parrainage (2.11) : code de parrainage du voyageur connecté + crédit par parrainage (centimes). */
  getReferral(organizationId: number, token: string): Promise<{ code: string; creditCents: number }> {
    return this.rootFetch(`/api/public/guest/referral?organizationId=${organizationId}`, { method: 'GET' }, token);
  }

  /** Parrainage (2.11) : rattache un filleul (best-effort) après une réservation directe. */
  claimReferral(organizationId: number, reservationCode: string, referralCode: string): Promise<{ claimed: boolean }> {
    return this.rootFetch('/api/public/guest/referral/claim', {
      method: 'POST', body: JSON.stringify({ organizationId, reservationCode, referralCode }),
    });
  }

  wishlistList(organizationId: number, token: string): Promise<number[]> {
    return this.rootFetch(`/api/public/guest/wishlist?organizationId=${organizationId}`, { method: 'GET' }, token);
  }

  wishlistAdd(organizationId: number, propertyId: number, token: string): Promise<number[]> {
    return this.rootFetch('/api/public/guest/wishlist', {
      method: 'POST', body: JSON.stringify({ organizationId, propertyId }),
    }, token);
  }

  wishlistRemove(organizationId: number, propertyId: number, token: string): Promise<number[]> {
    return this.rootFetch(`/api/public/guest/wishlist/${propertyId}?organizationId=${organizationId}`, { method: 'DELETE' }, token);
  }

  private async request<T>(path: string, options?: RequestInit, bearer?: string): Promise<T> {
    const res = await fetch(`${this.base}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-Booking-Key': this.apiKey,
        // Tarif membre (2.8) : token guest optionnel → le serveur applique la remise membre.
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
        ...options?.headers,
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`API error ${res.status}: ${body}`);
    }
    // Certaines reponses (checkout sans contenu) peuvent etre vides.
    const text = await res.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }

  private currencyQuery(currency?: string, prefix: '?' | '&' = '?'): string {
    return currency ? `${prefix}currency=${encodeURIComponent(currency)}` : '';
  }

  getCurrencies(): Promise<string[]> {
    return this.request('/currencies');
  }

  /** Capture d'un lead (exit-intent / form embarquable — 2.12). 403 si l'org a désactivé la capture. */
  postLead(params: { email: string; name?: string; source: string; locale?: string; consent: boolean }): Promise<void> {
    return this.request('/leads', { method: 'POST', body: JSON.stringify(params) });
  }

  getProperties(currency?: string): Promise<ApiProperty[]> {
    return this.request(`/properties${this.currencyQuery(currency)}`);
  }

  getCalendar(propertyId: number, month: string, months = 2, currency?: string): Promise<ApiCalendar> {
    const qs = `?month=${encodeURIComponent(month)}&months=${months}${this.currencyQuery(currency, '&')}`;
    return this.request(`/properties/${propertyId}/calendar${qs}`);
  }

  checkAvailability(
    params: { propertyId: number; checkIn: string; checkOut: string; guests: number },
    currency?: string,
    guestToken?: string,
  ): Promise<ApiAvailability> {
    return this.request(`/availability${this.currencyQuery(currency)}`, {
      method: 'POST',
      body: JSON.stringify(params),
    }, guestToken);
  }

  reserve(params: {
    propertyId: number;
    checkIn: string;
    checkOut: string;
    guests: number;
    guest: ReserveGuestInfo;
    notes?: string;
    voucherCode?: string;
  }, guestToken?: string): Promise<ApiReserveResult> {
    return this.request('/reserve', { method: 'POST', body: JSON.stringify(params) }, guestToken);
  }

  checkout(reservationCode: string): Promise<ApiCheckoutResult> {
    return this.request('/checkout', {
      method: 'POST',
      body: JSON.stringify({ reservationCode }),
    });
  }

  /** Panier multi-séjours : crée N réservations PENDING (paiement item par item ensuite). */
  reserveBatch(params: {
    items: { propertyId: number; checkIn: string; checkOut: string; guests: number; notes?: string }[];
    guest: ReserveGuestInfo;
  }, guestToken?: string): Promise<ApiBatchReserveResult> {
    return this.request('/reserve-batch', { method: 'POST', body: JSON.stringify(params) }, guestToken);
  }
}
