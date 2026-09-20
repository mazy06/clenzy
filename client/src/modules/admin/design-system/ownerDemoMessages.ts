/**
 * Texte de la projection « Portail proprietaire ».
 *
 * <p>Meme raison d'etre que `iotDemoMessages` : la projection est lue dans
 * l'atelier du design system ET dans la landing, ou i18next n'est pas
 * initialise. La langue est lue sur l'attribut `lang` du document.</p>
 */
const fr = {
  title: 'Portail propriétaire',
  subtitle: 'Villa Palmeraie · M. Alaoui',
  noticeTitle: 'Relevé de juillet disponible',
  noticeBody: 'Le versement sera effectué le 5 août sur votre compte se terminant par 4412.',
  kpi: {
    properties: 'Propriétés',
    reservations: 'Réservations actives',
    netRevenue: 'Revenu net',
    occupancy: 'Occupation moy.',
    rating: 'Note moyenne',
  },
  revenueByMonth: 'Revenu par mois',
  statements: 'Relevés mensuels',
  download: 'Télécharger',
  columns: {
    property: 'Propriété',
    revenue: 'Revenu',
    occupancy: 'Occupation',
    reservations: 'Réservations',
  },
  properties: ['Villa Palmeraie', 'Riad Yasmine', 'Duplex Guéliz'],
  statementLabels: ['Relevé juillet 2026', 'Relevé juin 2026', 'Relevé mai 2026'],
  months: ['févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.'],
};

export type OwnerDemoMessages = typeof fr;

const en: OwnerDemoMessages = {
  title: 'Owner portal',
  subtitle: 'Villa Palmeraie · Mr Alaoui',
  noticeTitle: 'July statement available',
  noticeBody: 'The payout will be made on 5 August to your account ending 4412.',
  kpi: {
    properties: 'Properties',
    reservations: 'Active bookings',
    netRevenue: 'Net revenue',
    occupancy: 'Avg. occupancy',
    rating: 'Average rating',
  },
  revenueByMonth: 'Revenue by month',
  statements: 'Monthly statements',
  download: 'Download',
  columns: {
    property: 'Property',
    revenue: 'Revenue',
    occupancy: 'Occupancy',
    reservations: 'Bookings',
  },
  properties: ['Villa Palmeraie', 'Riad Yasmine', 'Duplex Guéliz'],
  statementLabels: ['July 2026 statement', 'June 2026 statement', 'May 2026 statement'],
  months: ['Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'],
};

const ar: OwnerDemoMessages = {
  title: 'بوابة المالك',
  subtitle: 'فيلا النخيل · السيد العلوي',
  noticeTitle: 'كشف يوليو متاح',
  noticeBody: 'سيُحوَّل المستحق في 5 أغسطس إلى حسابك المنتهي بـ4412.',
  kpi: {
    properties: 'العقارات',
    reservations: 'حجوزات نشطة',
    netRevenue: 'الإيراد الصافي',
    occupancy: 'متوسط الإشغال',
    rating: 'متوسط التقييم',
  },
  revenueByMonth: 'الإيراد حسب الشهر',
  statements: 'الكشوف الشهرية',
  download: 'تحميل',
  columns: {
    property: 'العقار',
    revenue: 'الإيراد',
    occupancy: 'الإشغال',
    reservations: 'الحجوزات',
  },
  properties: ['فيلا النخيل', 'استراحة الملقا', 'دوبلكس العليا'],
  statementLabels: ['كشف يوليو 2026', 'كشف يونيو 2026', 'كشف مايو 2026'],
  months: ['فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو'],
};

const BY_LANGUAGE: Record<string, OwnerDemoMessages> = { fr, en, ar };

/** Texte de la projection, dans la langue du document. */
export function ownerDemoText(): OwnerDemoMessages {
  const lang = typeof document !== 'undefined'
    ? (document.documentElement.lang || 'fr').split('-')[0]
    : 'fr';
  return BY_LANGUAGE[lang] ?? fr;
}
