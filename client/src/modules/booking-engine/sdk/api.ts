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

export interface ReserveGuestInfo {
  name: string;
  email: string;
  phone?: string;
}

export class BookingApi {
  private readonly base: string;
  private readonly apiKey: string;

  constructor(baseUrl: string, apiKey: string, slug = 'widget') {
    const root = baseUrl.replace(/\/$/, '');
    this.base = `${root}/api/public/booking/${encodeURIComponent(slug)}`;
    this.apiKey = apiKey;
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${this.base}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-Booking-Key': this.apiKey,
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
  ): Promise<ApiAvailability> {
    return this.request(`/availability${this.currencyQuery(currency)}`, {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  reserve(params: {
    propertyId: number;
    checkIn: string;
    checkOut: string;
    guests: number;
    guest: ReserveGuestInfo;
    notes?: string;
    voucherCode?: string;
  }): Promise<ApiReserveResult> {
    return this.request('/reserve', { method: 'POST', body: JSON.stringify(params) });
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
  }): Promise<ApiBatchReserveResult> {
    return this.request('/reserve-batch', { method: 'POST', body: JSON.stringify(params) });
  }
}
