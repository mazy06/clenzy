import type { SiteLanguage } from '../lib/siteLanguage';

// Public evidence, not a list of working Baitly connectors. Recheck before publishing updates.
export const PMS_RESEARCH_DATE = '2026-10-03';
type Localized = Record<SiteLanguage, string>;
type Evidence = 'exports' | 'api' | 'plan' | 'confirm';
export type PmsPortability = {
  id: string;
  name: string;
  evidence: Evidence;
  formats: string;
  coverage: Localized;
  caution: Localized;
  timing: Localized;
  sources: {
    kind: 'export' | 'api' | 'exit' | 'plan' | 'timing' | 'community';
    url: string;
  }[];
};

export const PMS_PORTABILITY: readonly PmsPortability[] = [
  {
    id: 'superhote',
    name: 'SuperHote',
    evidence: 'exports',
    formats: 'CSV',
    coverage: {
      fr: 'Réservations, par logement et par année.',
      en: 'Reservations, by property and year.',
      ar: 'الحجوزات حسب العقار والسنة.',
    },
    caution: {
      fr: 'Emails Airbnb et Booking exclus de cet export depuis mars 2026.',
      en: 'Airbnb and Booking emails excluded from this export since March 2026.',
      ar: 'لا يشمل هذا التصدير بريد ضيوف Airbnb وBooking منذ مارس ٢٠٢٦.',
    },
    timing: {
      fr: 'Envoi par email ; délai non annoncé.',
      en: 'Email delivery; no published turnaround.',
      ar: 'يُرسل بالبريد؛ لم تُعلن مدة التسليم.',
    },
    sources: [
      {
        kind: 'export',
        url: 'https://helpcenter.superhote.com/fr/article/comment-exporter-les-reservations-superhote-ekmxl2/',
      },
      {
        kind: 'exit',
        url: 'https://helpcenter.superhote.com/fr/article/supprimer-son-compte-superhote-1ci09k5/',
      },
    ],
  },
  {
    id: 'smoobu',
    name: 'Smoobu',
    evidence: 'api',
    formats: 'CSV · Excel · PDF · API',
    coverage: {
      fr: 'Réservations et contacts via des exports distincts.',
      en: 'Reservations and contacts through separate exports.',
      ar: 'الحجوزات وجهات الاتصال في ملفات منفصلة.',
    },
    caution: {
      fr: 'Vérifier les filtres et exporter séparément les données de check-in.',
      en: 'Check filters and export check-in data separately.',
      ar: 'راجع المرشحات وصدّر بيانات تسجيل الوصول بشكل منفصل.',
    },
    timing: {
      fr: 'Immédiat sous 300 réservations ; téléchargement ou email au-delà.',
      en: 'Immediate below 300 reservations; download or email above that.',
      ar: 'فوري لأقل من ٣٠٠ حجز؛ تنزيل أو بريد للأعداد الأكبر.',
    },
    sources: [
      {
        kind: 'export',
        url: 'https://support.smoobu.com/hc/en-us/articles/360010511879-Download-or-export-your-bookings-list',
      },
      { kind: 'api', url: 'https://docs.smoobu.com/' },
    ],
  },
  {
    id: 'guesty',
    name: 'Guesty',
    evidence: 'api',
    formats: 'CSV · API',
    coverage: {
      fr: 'Rapports de réservations et de voyageurs.',
      en: 'Reservation and guest reports.',
      ar: 'تقارير الحجوزات والضيوف.',
    },
    caution: {
      fr: 'Séjours propriétaires à part. Vérifier votre offre Guesty : les produits diffèrent.',
      en: 'Owner stays are separate. Check your Guesty product: capabilities differ.',
      ar: 'إقامات المالك منفصلة. تختلف الإمكانات حسب منتج Guesty.',
    },
    timing: {
      fr: 'Téléchargement ou email ; délai global non annoncé.',
      en: 'Download or email; no published full-export turnaround.',
      ar: 'تنزيل أو بريد؛ لا توجد مدة معلنة للتصدير الشامل.',
    },
    sources: [
      {
        kind: 'export',
        url: 'https://help.guesty.com/hc/en-gb/articles/9370076145437-Setting-up-a-reservations-report',
      },
      { kind: 'api', url: 'https://open-api-docs.guesty.com/' },
    ],
  },
  {
    id: 'hostaway',
    name: 'Hostaway',
    evidence: 'api',
    formats: 'CSV · API',
    coverage: {
      fr: 'Réservations, carnet de voyageurs et données de check-in.',
      en: 'Reservations, guest book and check-in data.',
      ar: 'الحجوزات وسجل الضيوف وبيانات تسجيل الوصول.',
    },
    caution: {
      fr: 'Plusieurs exports. Sauvegarder avant la désactivation du compte.',
      en: 'Multiple exports. Back up before account deactivation.',
      ar: 'عدة ملفات تصدير. احفظ نسخة قبل تعطيل الحساب.',
    },
    timing: {
      fr: 'Export depuis le compte ; les 30 jours annoncés concernent la résiliation.',
      en: 'Export from the account; the stated 30 days concern cancellation.',
      ar: 'التصدير من الحساب؛ مدة ٣٠ يوماً المعلنة تخص الإلغاء.',
    },
    sources: [
      {
        kind: 'export',
        url: 'https://support.hostaway.com/hc/en-us/articles/360021922293-Reservations-Download-Reservations-via-CSV',
      },
      { kind: 'api', url: 'https://api.hostaway.com/documentation' },
      {
        kind: 'exit',
        url: 'https://support.hostaway.com/hc/en-us/articles/14006214140699-Cancel-Your-Hostaway-Account',
      },
    ],
  },
  {
    id: 'beds24',
    name: 'Beds24',
    evidence: 'api',
    formats: 'CSV · API V2',
    coverage: {
      fr: 'Réservations en CSV ; API pour compléter la reprise.',
      en: 'Reservation CSV; API to extend the migration scope.',
      ar: 'ملف CSV للحجوزات وواجهة API لاستكمال البيانات.',
    },
    caution: {
      fr: 'Autorisations personnelles et financières distinctes. Exporter avant fermeture.',
      en: 'Separate personal and financial permissions. Export before closing.',
      ar: 'صلاحيات منفصلة للبيانات الشخصية والمالية. صدّر قبل الإغلاق.',
    },
    timing: {
      fr: 'Téléchargement autonome ; durée API selon le volume et les quotas.',
      en: 'Self-service download; API duration depends on volume and quotas.',
      ar: 'تنزيل ذاتي؛ مدة API تعتمد على الحجم وحدود الاستخدام.',
    },
    sources: [
      {
        kind: 'export',
        url: 'https://wiki.beds24.com/index.php/Export_Bookings',
      },
      { kind: 'api', url: 'https://wiki.beds24.com/index.php/API_V2.0' },
      {
        kind: 'exit',
        url: 'https://wiki.beds24.com/index.php/Questions_and_Answers',
      },
    ],
  },
  {
    id: 'ownerrez',
    name: 'OwnerRez',
    evidence: 'api',
    formats: 'Excel · CSV · TSV · API',
    coverage: {
      fr: 'Exports de listes : réservations, voyageurs, rapports.',
      en: 'List exports: bookings, guests and reports.',
      ar: 'تصدير قوائم الحجوزات والضيوف والتقارير.',
    },
    caution: {
      fr: 'Avis dans un export distinct. Enlever les filtres pour récupérer tout le périmètre.',
      en: 'Reviews use a separate export. Clear filters for full coverage.',
      ar: 'التقييمات في ملف منفصل. أزل المرشحات لتضمين النطاق كاملاً.',
    },
    timing: {
      fr: 'Téléchargement autonome ; export intégral sans délai publié.',
      en: 'Self-service download; no published full-export turnaround.',
      ar: 'تنزيل ذاتي؛ لا توجد مدة معلنة للتصدير الشامل.',
    },
    sources: [
      {
        kind: 'export',
        url: 'https://www.ownerrez.com/support/articles/export-guest-info-data',
      },
      {
        kind: 'api',
        url: 'https://www.ownerrez.com/support/articles/api-pagination-etags',
      },
      {
        kind: 'exit',
        url: 'https://www.ownerrez.com/support/articles/closing-your-account',
      },
      {
        kind: 'community',
        url: 'https://www.ownerrez.com/forums/requests/export-all-guest-data-including-tags-reviews',
      },
    ],
  },
  {
    id: 'lodgify',
    name: 'Lodgify',
    evidence: 'api',
    formats: 'CSV · API',
    coverage: {
      fr: 'Rapports de réservations et détail financier.',
      en: 'Reservation reports and financial breakdowns.',
      ar: 'تقارير الحجوزات والتفاصيل المالية.',
    },
    caution: {
      fr: 'Vérifier la profondeur historique des rapports. Exporter avant la résiliation.',
      en: 'Check report history coverage. Export before termination.',
      ar: 'تحقق من الفترة التاريخية للتقارير. صدّر قبل إنهاء الاشتراك.',
    },
    timing: {
      fr: 'Génération depuis les rapports ; délai global non annoncé.',
      en: 'Generated from reports; no published full-export turnaround.',
      ar: 'يُنشأ من التقارير؛ لا توجد مدة معلنة للتصدير الشامل.',
    },
    sources: [
      {
        kind: 'export',
        url: 'https://www.lodgify.com/blog/product-updates-may-2025/',
      },
      { kind: 'api', url: 'https://docs.lodgify.com/docs/getting-started-1' },
      { kind: 'exit', url: 'https://www.lodgify.com/terms/' },
    ],
  },
  {
    id: 'hostfully',
    name: 'Hostfully',
    evidence: 'api',
    formats: 'CSV · HTML · PDF · API',
    coverage: {
      fr: 'Rapports personnalisables et exports comptables.',
      en: 'Custom reports and accounting exports.',
      ar: 'تقارير مخصصة وتصدير البيانات المحاسبية.',
    },
    caution: {
      fr: 'Le tableau Analytics lui-même ne s’exporte pas. Préparer les rapports nécessaires.',
      en: 'The Analytics dashboard itself cannot be exported. Prepare the required reports.',
      ar: 'لوحة Analytics نفسها غير قابلة للتصدير. جهّز التقارير المطلوبة.',
    },
    timing: {
      fr: 'Exports de rapports ; délai de restitution complète à confirmer.',
      en: 'Report exports; confirm full-account delivery time.',
      ar: 'تصدير التقارير؛ يجب تأكيد مدة تسليم بيانات الحساب كاملة.',
    },
    sources: [
      {
        kind: 'export',
        url: 'https://www.hostfully.com/property-management-software/features/enhanced-reporting/',
      },
      { kind: 'api', url: 'https://www.hostfully.com/resources/faq/' },
    ],
  },
  {
    id: 'hospitable',
    name: 'Hospitable',
    evidence: 'plan',
    formats: 'CSV · API',
    coverage: {
      fr: 'Réservations/finances, avis Airbnb, tâches et taxes : exports séparés.',
      en: 'Reservations/financials, Airbnb reviews, tasks and taxes: separate exports.',
      ar: 'ملفات منفصلة للحجوزات والماليات وتقييمات Airbnb والمهام والضرائب.',
    },
    caution: {
      fr: 'Exports selon l’abonnement ; logements mis en sourdine exclus.',
      en: 'Exports depend on the plan; muted properties are excluded.',
      ar: 'التصدير حسب الاشتراك؛ العقارات المكتومة مستثناة.',
    },
    timing: {
      fr: 'Email ; contacter le support après 15 minutes sans réception. Ce n’est pas un délai garanti.',
      en: 'Email; contact support after 15 minutes without delivery. This is not a guaranteed deadline.',
      ar: 'بالبريد؛ تواصل مع الدعم بعد ١٥ دقيقة دون استلام. ليست مهلة مضمونة.',
    },
    sources: [
      {
        kind: 'export',
        url: 'https://help.hospitable.com/en/articles/5651284-reservations-financials-export',
      },
      {
        kind: 'plan',
        url: 'https://help.hospitable.com/en/articles/12897404-metrics-overview-where-to-start',
      },
      {
        kind: 'exit',
        url: 'https://help.hospitable.com/en/articles/13783126-cancel-or-pause-your-hospitable-subscription',
      },
      {
        kind: 'timing',
        url: 'https://help.hospitable.com/en/articles/5625450-getting-started-with-exports',
      },
      {
        kind: 'api',
        url: 'https://hospitable.com/hospitable-core-integration',
      },
    ],
  },
  {
    id: 'avantio',
    name: 'Avantio',
    evidence: 'confirm',
    formats: 'API',
    coverage: {
      fr: 'API de distribution, de site et de comptabilité présentées publiquement.',
      en: 'Distribution, website and accounting APIs are publicly described.',
      ar: 'واجهات معلنة للتوزيع والموقع والمحاسبة.',
    },
    caution: {
      fr: 'Cela ne démontre pas un export intégral de départ. Demander le périmètre par écrit.',
      en: 'This does not establish a full offboarding export. Request written scope.',
      ar: 'هذا لا يثبت توفر تصدير شامل عند المغادرة. اطلب النطاق كتابياً.',
    },
    timing: {
      fr: 'Format de restitution et délai à confirmer avec l’éditeur.',
      en: 'Confirm delivery format and turnaround with the vendor.',
      ar: 'يجب تأكيد صيغة التسليم ومدته مع المزوّد.',
    },
    sources: [
      { kind: 'api', url: 'https://www.avantio.com/api-integrations/' },
    ],
  },
];
