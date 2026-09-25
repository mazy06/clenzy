import type { SiteLanguage } from '../siteLanguage';

export const BOOKING_EXTRAS_COPY: Record<
  SiteLanguage,
  {
    catalogue: string;
    optional: string;
    selectedOne: string;
    selectedMany: string;
    skip: string;
  }
> = {
  fr: {
    catalogue: 'Services & expériences',
    optional: 'Toutes les options sont facultatives.',
    selectedOne: '{count} service sélectionné',
    selectedMany: '{count} services sélectionnés',
    skip: 'Continuer sans extras',
  },
  en: {
    catalogue: 'Services & experiences',
    optional: 'Every extra is optional.',
    selectedOne: '{count} service selected',
    selectedMany: '{count} services selected',
    skip: 'Continue without extras',
  },
  ar: {
    catalogue: 'خدمات وتجارب',
    optional: 'جميع الخدمات اختيارية.',
    selectedOne: 'الخدمات المختارة: {count}',
    selectedMany: 'الخدمات المختارة: {count}',
    skip: 'المتابعة دون إضافات',
  },
};
