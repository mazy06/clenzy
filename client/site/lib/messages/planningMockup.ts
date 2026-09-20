import type { SiteLanguage } from '../siteLanguage';

/**
 * Grande maquette de planning de la page produit.
 *
 * <p>Elle simule l'ecran Planning de l'application : barre d'outils, grille,
 * panneaux de logement et de reservation. Tout ce qui s'y lit passe par ici —
 * y compris le jeu de donnees de demonstration, dont le marche suit la langue
 * (Riyad et Djeddah en arabe, le Maroc en francais).</p>
 */
export interface PlanningProperty {
  name: string;
  city: string;
}

const fr = {
  channels: { airbnb: 'Airbnb', booking: 'Booking.com', direct: 'Direct' },
  dayLabels: ['SAM', 'DIM', 'LUN', 'MAR', 'MER', 'JEU', 'VEN'],
  zooms: ['Semaine', 'Quinzaine', 'Mois'],
  statuses: {
    confirmed: 'Confirmée',
    pending: 'En attente',
    checkedIn: 'Check-in',
    checkedOut: 'Check-out',
  },
  windowTitle: 'app.baitly — Planning',
  month: 'Août 2026',
  today: 'Aujourd’hui',
  /* Pluriel du compteur de nuits pose sur les briques. L'arabe a six formes ;
     ici seules deux valeurs apparaissent (1 et plus), d'ou ce couple. */
  nightOne: 'nuit',
  nightMany: 'nuits',
  interventions: 'Interventions',
  cancelled: 'Annulée',
  blockedReason: 'Travaux salle de bain',
  page: 'Page 1 / 2',
  pageRange: '1-6 sur 10 logements',
  searchGuest: 'Rechercher un voyageur…',
  owner: 'Toufik Mazy',
  property: {
    maxGuests: 'Voyageurs max',
    minNights: 'Nuits min.',
    nightlyPrice: 'Prix / nuit',
    checkIn: 'Check-in',
    checkOut: 'Check-out',
    cleaningFrequency: 'Fréquence ménage :',
    cleaningValue: 'Après chaque séjour',
    performance: 'Performance · 90 j',
    score: 'Score',
    revpan: 'RevPAN',
    occupancy: 'Taux d’occupation',
    totalRevenue: 'Revenu total',
    netMargin: 'Marge nette',
    close: 'Fermer',
    openRecord: 'Voir la fiche',
  },
  create: {
    title: 'Nouvelle réservation',
    stay: 'Séjour',
    stayValue: '28 → 31 août',
    nights: 'Nuits',
    nightlyPrice: 'Prix / nuit',
    arrivalDeparture: 'Arrivée / départ',
    total: 'Total',
    guest: 'Voyageur',
    submit: 'Créer la réservation',
  },
  properties: [
    { name: 'Riad Bab Doukkala', city: 'Fès · Médina' },
    { name: 'Duplex Anfa Place', city: 'Casablanca · Anfa' },
    { name: 'Villa Founty', city: 'Agadir · Founty' },
    { name: 'Appart. Guéliz', city: 'Marrakech · Guéliz' },
    { name: 'Dar Bab Bhar', city: 'Rabat · Kasbah des Oudayas' },
    { name: 'Studio Malabata', city: 'Tanger · Malabata' },
  ] as readonly PlanningProperty[],
  /** Le logement pre-rempli dans la boite de creation — le premier de la liste. */
  createProperty: 'Riad Bab Doukkala · Fès · Médina',
};

export type PlanningMockupMessages = typeof fr;

const en: PlanningMockupMessages = {
  channels: { airbnb: 'Airbnb', booking: 'Booking.com', direct: 'Direct' },
  dayLabels: ['SAT', 'SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI'],
  zooms: ['Week', 'Fortnight', 'Month'],
  statuses: {
    confirmed: 'Confirmed',
    pending: 'Pending',
    checkedIn: 'Check-in',
    checkedOut: 'Check-out',
  },
  windowTitle: 'app.baitly — Calendar',
  month: 'August 2026',
  today: 'Today',
  nightOne: 'night',
  nightMany: 'nights',
  interventions: 'Jobs',
  cancelled: 'Cancelled',
  blockedReason: 'Bathroom works',
  page: 'Page 1 / 2',
  pageRange: '1-6 of 10 properties',
  searchGuest: 'Search for a guest…',
  owner: 'Toufik Mazy',
  property: {
    maxGuests: 'Max guests',
    minNights: 'Min. nights',
    nightlyPrice: 'Price / night',
    checkIn: 'Check-in',
    checkOut: 'Check-out',
    cleaningFrequency: 'Cleaning frequency:',
    cleaningValue: 'After every stay',
    performance: 'Performance · 90 d',
    score: 'Score',
    revpan: 'RevPAN',
    occupancy: 'Occupancy rate',
    totalRevenue: 'Total revenue',
    netMargin: 'Net margin',
    close: 'Close',
    openRecord: 'Open record',
  },
  create: {
    title: 'New booking',
    stay: 'Stay',
    stayValue: '28 → 31 August',
    nights: 'Nights',
    nightlyPrice: 'Price / night',
    arrivalDeparture: 'Check-in / check-out',
    total: 'Total',
    guest: 'Guest',
    submit: 'Create the booking',
  },
  properties: [
    { name: 'Riad Bab Doukkala', city: 'Fez · Medina' },
    { name: 'Duplex Anfa Place', city: 'Casablanca · Anfa' },
    { name: 'Villa Founty', city: 'Agadir · Founty' },
    { name: 'Appart. Guéliz', city: 'Marrakech · Guéliz' },
    { name: 'Dar Bab Bhar', city: 'Rabat · Kasbah of the Udayas' },
    { name: 'Studio Malabata', city: 'Tangier · Malabata' },
  ],
  createProperty: 'Riad Bab Doukkala · Fez · Medina',
};

const ar: PlanningMockupMessages = {
  channels: { airbnb: 'Airbnb', booking: 'Booking.com', direct: 'مباشر' },
  dayLabels: ['سبت', 'أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة'],
  zooms: ['أسبوع', 'أسبوعان', 'شهر'],
  statuses: {
    confirmed: 'مؤكَّد',
    pending: 'بالانتظار',
    checkedIn: 'تسجيل الوصول',
    checkedOut: 'تسجيل المغادرة',
  },
  windowTitle: 'app.baitly — التقويم',
  month: 'أغسطس 2026',
  today: 'اليوم',
  nightOne: 'ليلة',
  nightMany: 'ليالٍ',
  interventions: 'المهام',
  cancelled: 'ملغى',
  blockedReason: 'أشغال في دورة المياه',
  page: 'صفحة 1 / 2',
  pageRange: '1-6 من 10 وحدات',
  searchGuest: 'ابحث عن نزيل…',
  owner: 'توفيق مازي',
  property: {
    maxGuests: 'أقصى عدد نزلاء',
    minNights: 'أدنى عدد ليالٍ',
    nightlyPrice: 'السعر / ليلة',
    checkIn: 'الوصول',
    checkOut: 'المغادرة',
    cleaningFrequency: 'وتيرة التنظيف:',
    cleaningValue: 'بعد كل إقامة',
    performance: 'الأداء · 90 يوماً',
    score: 'النتيجة',
    revpan: 'الإيراد لكل ليلة متاحة',
    occupancy: 'نسبة الإشغال',
    totalRevenue: 'إجمالي الإيراد',
    netMargin: 'الهامش الصافي',
    close: 'إغلاق',
    openRecord: 'عرض البطاقة',
  },
  create: {
    title: 'حجز جديد',
    stay: 'الإقامة',
    stayValue: '28 ← 31 أغسطس',
    nights: 'الليالي',
    nightlyPrice: 'السعر / ليلة',
    arrivalDeparture: 'الوصول / المغادرة',
    total: 'الإجمالي',
    guest: 'النزيل',
    submit: 'أنشئ الحجز',
  },
  properties: [
    { name: 'استراحة الملقا', city: 'الرياض · الملقا' },
    { name: 'شقة الشاطئ', city: 'جدة · الشاطئ' },
    { name: 'فيلا العقربية', city: 'الخبر · العقربية' },
    { name: 'شقة العليا', city: 'الرياض · العليا' },
    { name: 'دار الفيصلية', city: 'الدمام · الفيصلية' },
    { name: 'استوديو السودة', city: 'أبها · السودة' },
  ],
  createProperty: 'استراحة الملقا · الرياض · الملقا',
};

export const PLANNING_MOCKUP_MESSAGES: Record<SiteLanguage, PlanningMockupMessages> = {
  fr, en, ar,
};
