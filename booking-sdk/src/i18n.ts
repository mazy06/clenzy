// ─── i18n + RTL + Intl formatting (CLZ-P0-12) ────────────────────────────────
// Léger, sans dépendance externe. Les locales sont des objets simples (importables
// individuellement pour le tree-shaking). Le SDK reste headless : il fournit le
// dictionnaire, la direction et les formatters ; l'intégrateur applique `dir`/CSS.

export type Language = 'fr' | 'en' | 'ar';

/** Tags BCP-47 pour Intl. */
const LOCALE_TAG: Record<Language, string> = {
  fr: 'fr-FR',
  en: 'en-GB',
  ar: 'ar-SA',
};

/** Langues écrites de droite à gauche. */
const RTL_LANGUAGES: ReadonlySet<Language> = new Set<Language>(['ar']);

export function isRtl(language: Language): boolean {
  return RTL_LANGUAGES.has(language);
}

/** Direction de lecture à appliquer côté intégrateur (`dir="rtl"`/`"ltr"`). */
export function getDirection(language: Language): 'rtl' | 'ltr' {
  return isRtl(language) ? 'rtl' : 'ltr';
}

export function localeTag(language: Language): string {
  return LOCALE_TAG[language] ?? 'en-GB';
}

type Dict = Record<string, string>;

export const fr: Dict = {
  search: 'Rechercher',
  book: 'Réserver',
  checkIn: 'Arrivée',
  checkOut: 'Départ',
  guests: 'Voyageurs',
  nights: 'nuits',
  total: 'Total',
  cleaningFee: 'Frais de ménage',
  touristTax: 'Taxe de séjour',
  confirm: 'Confirmer',
  loading: 'Chargement…',
  unavailable: 'Indisponible',
  'voucher.label': 'Code promo',
  'voucher.apply': 'Appliquer',
  'voucher.applied': 'Code appliqué : -{discount}',
  'error.generic': 'Une erreur est survenue. Veuillez réessayer.',
  'voucher.error.NOT_FOUND': 'Code promo introuvable.',
  'voucher.error.DRAFT_NOT_ACTIVE': "Ce code n'est pas encore actif.",
  'voucher.error.PAUSED': 'Ce code est suspendu.',
  'voucher.error.EXPIRED': 'Ce code a expiré.',
  'voucher.error.NOT_YET_ACTIVE': "Ce code n'est pas encore valable.",
  'voucher.error.PROPERTY_NOT_IN_SCOPE': "Ce code ne s'applique pas à ce logement.",
  'voucher.error.MIN_STAY_NOT_MET': 'Durée de séjour minimale non atteinte.',
  'voucher.error.MAX_STAY_EXCEEDED': 'Durée de séjour maximale dépassée.',
  'voucher.error.MIN_TOTAL_NOT_MET': 'Montant minimum non atteint.',
  'voucher.error.USAGE_LIMIT_REACHED': "Ce code a atteint sa limite d'utilisation.",
  'voucher.error.GUEST_LIMIT_REACHED': 'Vous avez déjà utilisé ce code.',
  'voucher.error.CHANNEL_NOT_ALLOWED': "Ce code n'est pas valable ici.",
  'voucher.error.INVALID_INPUT': 'Code promo invalide.',
};

export const en: Dict = {
  search: 'Search',
  book: 'Book',
  checkIn: 'Check-in',
  checkOut: 'Check-out',
  guests: 'Guests',
  nights: 'nights',
  total: 'Total',
  cleaningFee: 'Cleaning fee',
  touristTax: 'Tourist tax',
  confirm: 'Confirm',
  loading: 'Loading…',
  unavailable: 'Unavailable',
  'voucher.label': 'Promo code',
  'voucher.apply': 'Apply',
  'voucher.applied': 'Code applied: -{discount}',
  'error.generic': 'Something went wrong. Please try again.',
  'voucher.error.NOT_FOUND': 'Promo code not found.',
  'voucher.error.DRAFT_NOT_ACTIVE': 'This code is not active yet.',
  'voucher.error.PAUSED': 'This code is paused.',
  'voucher.error.EXPIRED': 'This code has expired.',
  'voucher.error.NOT_YET_ACTIVE': 'This code is not valid yet.',
  'voucher.error.PROPERTY_NOT_IN_SCOPE': 'This code does not apply to this property.',
  'voucher.error.MIN_STAY_NOT_MET': 'Minimum stay not met.',
  'voucher.error.MAX_STAY_EXCEEDED': 'Maximum stay exceeded.',
  'voucher.error.MIN_TOTAL_NOT_MET': 'Minimum amount not reached.',
  'voucher.error.USAGE_LIMIT_REACHED': 'This code has reached its usage limit.',
  'voucher.error.GUEST_LIMIT_REACHED': 'You have already used this code.',
  'voucher.error.CHANNEL_NOT_ALLOWED': 'This code is not valid here.',
  'voucher.error.INVALID_INPUT': 'Invalid promo code.',
};

export const ar: Dict = {
  search: 'بحث',
  book: 'احجز',
  checkIn: 'تسجيل الوصول',
  checkOut: 'تسجيل المغادرة',
  guests: 'النزلاء',
  nights: 'ليالٍ',
  total: 'الإجمالي',
  cleaningFee: 'رسوم التنظيف',
  touristTax: 'ضريبة الإقامة',
  confirm: 'تأكيد',
  loading: 'جارٍ التحميل…',
  unavailable: 'غير متاح',
  'voucher.label': 'رمز الخصم',
  'voucher.apply': 'تطبيق',
  'voucher.applied': 'تم تطبيق الرمز: -{discount}',
  'error.generic': 'حدث خطأ. يرجى المحاولة مرة أخرى.',
  'voucher.error.NOT_FOUND': 'رمز الخصم غير موجود.',
  'voucher.error.DRAFT_NOT_ACTIVE': 'هذا الرمز غير مُفعّل بعد.',
  'voucher.error.PAUSED': 'هذا الرمز موقوف.',
  'voucher.error.EXPIRED': 'انتهت صلاحية هذا الرمز.',
  'voucher.error.NOT_YET_ACTIVE': 'هذا الرمز غير صالح بعد.',
  'voucher.error.PROPERTY_NOT_IN_SCOPE': 'لا ينطبق هذا الرمز على هذا العقار.',
  'voucher.error.MIN_STAY_NOT_MET': 'لم يتم استيفاء الحد الأدنى لمدة الإقامة.',
  'voucher.error.MAX_STAY_EXCEEDED': 'تم تجاوز الحد الأقصى لمدة الإقامة.',
  'voucher.error.MIN_TOTAL_NOT_MET': 'لم يتم بلوغ الحد الأدنى للمبلغ.',
  'voucher.error.USAGE_LIMIT_REACHED': 'بلغ هذا الرمز حد الاستخدام.',
  'voucher.error.GUEST_LIMIT_REACHED': 'لقد استخدمت هذا الرمز من قبل.',
  'voucher.error.CHANNEL_NOT_ALLOWED': 'هذا الرمز غير صالح هنا.',
  'voucher.error.INVALID_INPUT': 'رمز خصم غير صالح.',
};

const DICTS: Record<Language, Dict> = { fr, en, ar };

/** Traducteur : fonction `t(key, vars?)` portant la langue active. */
export interface I18n {
  (key: string, vars?: Record<string, string | number>): string;
  language: Language;
}

/**
 * Crée un traducteur pour une langue avec repli gracieux
 * (langue → fallback → clé) et interpolation `{var}`.
 */
export function createI18n(language: Language, fallback: Language = 'en'): I18n {
  const primary = DICTS[language] ?? {};
  const fb = DICTS[fallback] ?? {};
  const t = ((key: string, vars?: Record<string, string | number>): string => {
    const template = primary[key] ?? fb[key] ?? key;
    if (!vars) return template;
    return template.replace(/\{(\w+)\}/g, (_match, name: string) =>
      name in vars ? String(vars[name]) : `{${name}}`
    );
  }) as I18n;
  t.language = language;
  return t;
}

export function formatNumber(value: number, language: Language): string {
  return new Intl.NumberFormat(localeTag(language)).format(value);
}

export function formatCurrency(amount: number, currency: string, language: Language): string {
  try {
    return new Intl.NumberFormat(localeTag(language), { style: 'currency', currency }).format(amount);
  } catch {
    // Devise inconnue d'Intl : repli lisible.
    return `${formatNumber(amount, language)} ${currency}`;
  }
}

export function formatDate(
  date: Date | string,
  language: Language,
  options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' }
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(localeTag(language), options).format(d);
}
