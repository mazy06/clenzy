import { useTranslation } from 'react-i18next';
import * as presentation from './providerPresentation';
import { formatDate } from '../quotes/quotePresentation';

/** Même vocabulaire et mêmes formats dans le catalogue et la fiche administrative. */
export function useMarketplacePresentation() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language || 'fr';
  const labels = <T extends Record<string, string>>(namespace: string, values: T): T =>
    Object.fromEntries(Object.entries(values).map(([key, fallback]) =>
      [key, t('marketplaceAdmin.' + namespace + '.' + key, { defaultValue: fallback })])) as T;
  const days = Array.from({ length: 7 }, (_, index) => new Date(Date.UTC(2024, 0, 1 + index)));
  const dayNames = days.map(day => new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' }).format(day));
  return {
    t, locale,
    catalogLabel: (item: { labelFr: string; labelEn?: string }) =>
      locale.startsWith('en') && item.labelEn ? item.labelEn : item.labelFr,
    STATUS_LABELS: labels('status', presentation.STATUS_LABELS),
    ENGAGEMENT_LABELS: labels('engagementLabels', presentation.ENGAGEMENT_LABELS),
    ENGAGEMENT_HINTS: labels('engagementHints', presentation.ENGAGEMENT_HINTS),
    SOURCE_LABELS: labels('sourceLabels', presentation.SOURCE_LABELS),
    FAMILY_LABELS: labels('family', presentation.FAMILY_LABELS),
    RECURRENCE_LABELS: labels('recurrence', presentation.RECURRENCE_LABELS),
    PAYER_LABELS: labels('payer', presentation.PAYER_LABELS),
    COMPLIANCE_LABELS: labels('compliance', presentation.COMPLIANCE_LABELS),
    DAY_NAMES: dayNames,
    DAY_INITIALS: days.map(day => new Intl.DateTimeFormat(locale, { weekday: 'narrow', timeZone: 'UTC' }).format(day)),
    formatDate: (value?: string) => formatDate(value, locale),
    formatMoney: (amount: number, currency: string) => presentation.formatMoney(amount, currency, locale),
    formatOfferPrice: (amount: number | undefined, currency: string, model: Parameters<typeof presentation.formatOfferPrice>[2], unit?: string) =>
      presentation.formatOfferPrice(amount, currency, model, unit, locale, t('marketplaceAdmin.onQuote')),
    languageName: (code: string) => {
      try { return new Intl.DisplayNames([locale], { type: 'language' }).of(code) ?? code; }
      catch { return code.toUpperCase(); }
    },
    availabilitySummary: (availableDays: number[], weeklyRestricted = false) => {
      if (weeklyRestricted && availableDays?.length === 0) return t('marketplaceAdmin.noAllowedSlots');
      if (!availableDays?.length) return t('marketplaceAdmin.noConstraints');
      if (availableDays.length === 7) return t('marketplaceAdmin.everyDay');
      return [...availableDays].sort((a, b) => a - b).map(day => dayNames[day - 1]).filter(Boolean).join(', ');
    },
  };
}
