import type { CalendarAvailabilityResponse, PriceBreakdown } from './types';

export class BookingApi {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.apiKey = apiKey;
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-Booking-Api-Key': this.apiKey,
        ...options?.headers,
      },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`API error ${res.status}: ${body}`);
    }

    return res.json();
  }

  async getAvailability(params: {
    from: string;
    to: string;
    types?: string[];
    guests?: number;
  }): Promise<CalendarAvailabilityResponse> {
    const qs = new URLSearchParams({ from: params.from, to: params.to });
    if (params.types?.length) params.types.forEach(t => qs.append('types', t));
    if (params.guests) qs.set('guests', String(params.guests));
    return this.request(`/api/public/booking/calendar?${qs}`);
  }

  async calculatePrice(params: {
    checkIn: string;
    checkOut: string;
    propertyTypeCode?: string;
    guests: number;
    addonIds?: string[];
  }): Promise<PriceBreakdown> {
    return this.request('/api/public/booking/price', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async createCheckoutSession(params: {
    checkIn: string;
    checkOut: string;
    propertyTypeCode?: string;
    guests: number;
    addonIds?: string[];
    guestInfo: {
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
      message?: string;
    };
  }): Promise<{ sessionId: string; url: string }> {
    return this.request('/api/public/booking/checkout', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async getCheckoutStatus(sessionId: string): Promise<{ status: string; reservationId?: string }> {
    return this.request(`/api/public/booking/checkout/${sessionId}/status`);
  }
}
