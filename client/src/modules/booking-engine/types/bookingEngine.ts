import type React from 'react';

// ─── Domain types ───────────────────────────────────────────────────────────

export interface PreviewProperty {
  id: number;
  name: string;
  type: string;
  nightlyPrice?: number;
  cleaningFee?: number;
  photoIds?: number[];
  /** Pre-built photo URLs ready to use in <img src> */
  photoUrls?: string[];
  // Detail fields (loaded from PMS for +INFOS panel)
  description?: string | null;
  amenities?: string[] | null;
  maxGuests?: number | null;
  squareMeters?: number | null;
  bedroomCount?: number | null;
  bathroomCount?: number | null;
  city?: string | null;
  country?: string | null;
  checkInTime?: string | null;
  checkOutTime?: string | null;
}

export interface PreviewPropertyType {
  type: string;
  label: string;
  count: number;
  minPrice: number | null;
  minCleaningFee?: number | null;
}

export interface PreviewAvailabilityDay {
  date: string;
  available: boolean;
  minPrice: number | null;
  availableCount: number;
  availableTypes: string[];
}

export type PreviewPage = 'search' | 'results' | 'cart' | 'identification' | 'validation' | 'confirmation';

export type PanelType = 'guests' | 'types' | 'dates' | null;

export interface CartItem {
  property: PreviewProperty;
  nights: number;
}

// ─── Design tokens (resolved) ───────────────────────────────────────────────

export interface ResolvedTokens {
  primary: string;
  accent: string;
  secondary: string;
  text: string;
  textLabel: string;
  textPlaceholder: string;
  surface: string;
  surfaceMuted: string;
  border: string;
  font: string;
  headingFont: string;
  radius: string;
  radiusSm: string;
  cardRadius: string;
  shadow: string;
  cardShadow: string;
  btnTransform: React.CSSProperties['textTransform'];
  btnStyle: string;
}

// ─── Defaults (Safari Lodge style) ──────────────────────────────────────────

export const DEFAULTS = {
  primary: '#B2974A',
  secondary: '#49554C',
  text: '#49554C',
  textLabel: '#8EA093',
  textPlaceholder: '#BCBFB8',
  surface: '#FFFFFF',
  surfaceMuted: '#F2F1EB',
  border: '#E5E2D9',
  font: 'Poppins, Arial, sans-serif',
  radius: '4px',
  radiusSm: '2px',
  cardRadius: '4px',
};

// ─── Utility functions ──────────────────────────────────────────────────────

export function getMonthGrid(year: number, month: number) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const offset = firstDay === 0 ? 6 : firstDay - 1;
  return { daysInMonth, offset };
}

const LOCALE_MAP: Record<string, string> = { fr: 'fr-FR', en: 'en-GB', ar: 'ar-MA' };

export function getLocale(lang?: string): string {
  return LOCALE_MAP[lang ?? 'fr'] ?? 'fr-FR';
}

export function fmt(amount: number, currency: string, lang?: string): string {
  try {
    return new Intl.NumberFormat(getLocale(lang), { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${amount}€`;
  }
}

export function fmtDate(date: string | Date, lang?: string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString(getLocale(lang), { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function fmtDateShort(date: string | Date, lang?: string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString(getLocale(lang), { day: '2-digit', month: '2-digit' });
}
