import type { SiteLanguage } from '../lib/siteLanguage';

// Public evidence, not a list of working Baitly connectors. Recheck before publishing updates.
export const PMS_RESEARCH_DATE = '2026-10-06';
type Localized = Record<SiteLanguage, string>;
type Evidence = 'exports' | 'api' | 'plan' | 'confirm';
/** Four documented exit criteria. `unknown` means no public source was found, not a fault. */
export type ExitCriterion = 'export' | 'api' | 'afterExit' | 'freeToLeave';
export type ExitSignal = 'yes' | 'partial' | 'no' | 'unknown';
export type ExitLevel = 'smooth' | 'prepare' | 'constrained' | 'undocumented';
export const EXIT_CRITERIA: readonly ExitCriterion[] = [
  'export',
  'api',
  'afterExit',
  'freeToLeave',
];
export type PmsPortability = {
  id: string;
  name: string;
  evidence: Evidence;
  formats: string;
  coverage: Localized;
  caution: Localized;
  timing: Localized;
  exit: Record<ExitCriterion, ExitSignal>;
  /** Contract terms behind `afterExit` and `freeToLeave`, as published by the vendor. */
  exitTerms: Localized;
  /** Public user reports (reviews, forums). Individual experiences, attributed to their source. */
  feedback?: Localized;
  /** How Baitly takes the data in: a read-only API connector (beta) or the file importer. */
  baitlyImport: 'api' | 'files';
  sources: {
    kind:
      | 'export'
      | 'api'
      | 'exit'
      | 'plan'
      | 'timing'
      | 'community'
      | 'terms'
      | 'review';
    url: string;
  }[];
};

const SIGNAL_POINTS: Record<ExitSignal, number> = {
  yes: 2,
  partial: 1,
  no: 0,
  unknown: 0,
};

/** Deterministic reading of the four criteria; never a judgement of a vendor's intent. */
export function exitLevel(exit: Record<ExitCriterion, ExitSignal>): ExitLevel {
  const signals = EXIT_CRITERIA.map((criterion) => exit[criterion]);
  if (signals.filter((signal) => signal === 'unknown').length >= 2)
    return 'undocumented';
  const score = signals.reduce((sum, signal) => sum + SIGNAL_POINTS[signal], 0);
  if (score >= 6) return 'smooth';
  if (score >= 4) return 'prepare';
  return 'constrained';
}

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
    baitlyImport: 'files',
    exit: {
      export: 'partial',
      api: 'unknown',
      afterExit: 'no',
      freeToLeave: 'unknown',
    },
    exitTerms: {
      fr: 'Suppression du compte sur formulaire, effective sous 5 jours ouvrés et irréversible : réservations et factures ne sont plus accessibles ensuite.',
      en: 'Account deletion by form, completed within 5 business days and irreversible: bookings and invoices are no longer accessible afterwards.',
      ar: 'حذف الحساب عبر نموذج خلال ٥ أيام عمل وبشكل نهائي: لا يمكن الوصول إلى الحجوزات والفواتير بعد ذلك.',
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
    baitlyImport: 'api',
    exit: {
      export: 'yes',
      api: 'yes',
      afterExit: 'yes',
      freeToLeave: 'unknown',
    },
    exitTerms: {
      fr: 'Les CGU prévoient jusqu’à 30 jours après la fin du contrat pour télécharger ses données ; données personnelles des voyageurs supprimées ou anonymisées sous 120 jours.',
      en: 'The terms allow up to 30 days after termination to download your data; guest personal data deleted or anonymised within 120 days.',
      ar: 'تتيح الشروط تنزيل البيانات حتى ٣٠ يوماً بعد انتهاء العقد؛ وتُحذف بيانات الضيوف الشخصية أو تُجهَّل خلال ١٢٠ يوماً.',
    },
    feedback: {
      fr: 'Des avis publics jugent les exports comptables peu structurés et à retravailler dans un tableur.',
      en: 'Public reviews describe accounting exports as loosely structured and needing spreadsheet rework.',
      ar: 'تصف تقييمات عامة ملفات التصدير المحاسبية بأنها ضعيفة التنظيم وتحتاج إلى معالجة في جدول بيانات.',
    },
    sources: [
      {
        kind: 'export',
        url: 'https://support.smoobu.com/hc/en-us/articles/360010511879-Download-or-export-your-bookings-list',
      },
      { kind: 'api', url: 'https://docs.smoobu.com/' },
      { kind: 'terms', url: 'https://www.smoobu.com/en/terms/' },
      { kind: 'review', url: 'https://www.capterra.com/p/160106/Smoobu/' },
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
    baitlyImport: 'api',
    exit: {
      export: 'partial',
      api: 'yes',
      afterExit: 'unknown',
      freeToLeave: 'no',
    },
    exitTerms: {
      fr: 'Contrat initial de 13 mois, renouvelé tacitement par périodes de 12 mois sauf préavis de 30 jours ; frais de résiliation anticipée prévus.',
      en: 'Initial 13-month term, auto-renewing for 12-month periods unless 30 days’ notice is given; early termination fee applies.',
      ar: 'مدة أولية ١٣ شهراً تتجدد تلقائياً لفترات ١٢ شهراً ما لم يُرسل إشعار قبل ٣٠ يوماً؛ مع رسوم إنهاء مبكر.',
    },
    feedback: {
      fr: 'Un avis Capterra décrit un accès aux données devenu « presque impossible ». Guesty For Hosts a fermé le 31 mai 2026 : plus aucune consultation ni export après cette date.',
      en: 'A Capterra review describes data access as “nearly impossible”. Guesty For Hosts shut down on 31 May 2026: no viewing or export after that date.',
      ar: 'يصف تقييم على Capterra الوصول إلى البيانات بأنه «شبه مستحيل». أُغلق Guesty For Hosts في ٣١ مايو ٢٠٢٦ دون إمكانية عرض أو تصدير بعد ذلك.',
    },
    sources: [
      {
        kind: 'export',
        url: 'https://help.guesty.com/hc/en-gb/articles/9370076145437-Setting-up-a-reservations-report',
      },
      { kind: 'api', url: 'https://open-api-docs.guesty.com/' },
      { kind: 'terms', url: 'https://www.guesty.com/terms-of-service/' },
      {
        kind: 'review',
        url: 'https://www.capterra.com/p/159377/Guesty/reviews/',
      },
      {
        kind: 'exit',
        url: 'https://help.guestyforhosts.com/hc/en-gb/articles/33057135657373-Preparing-to-Disconnect-Guesty-for-Hosts',
      },
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
    baitlyImport: 'api',
    exit: {
      export: 'partial',
      api: 'yes',
      afterExit: 'no',
      freeToLeave: 'partial',
    },
    exitTerms: {
      fr: 'Résiliation traitée sous 30 jours ; les données de réservation ne sont pas conservées après la désactivation du compte. Durée d’engagement selon le contrat signé.',
      en: 'Cancellation processed within 30 days; reservation data is not kept after account deactivation. Commitment depends on the signed contract.',
      ar: 'يُعالج الإلغاء خلال ٣٠ يوماً؛ ولا تُحفظ بيانات الحجوزات بعد تعطيل الحساب. مدة الالتزام حسب العقد الموقّع.',
    },
    feedback: {
      fr: 'Des avis publics évoquent un engagement annuel découvert au moment de partir et des prélèvements pendant la résiliation.',
      en: 'Public reviews mention an annual commitment discovered when leaving and charges during cancellation.',
      ar: 'تذكر تقييمات عامة التزاماً سنوياً اكتُشف عند المغادرة ورسوماً أثناء الإلغاء.',
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
      {
        kind: 'review',
        url: 'https://www.trustpilot.com/review/www.hostaway.com',
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
    baitlyImport: 'api',
    exit: { export: 'yes', api: 'yes', afterExit: 'no', freeToLeave: 'yes' },
    exitTerms: {
      fr: 'Résiliation en autonomie à tout moment depuis la facturation ; plus aucun accès ensuite et les réservations supprimées ne sont pas restaurables.',
      en: 'Self-service cancellation at any time from billing; no access afterwards and deleted bookings cannot be restored.',
      ar: 'إلغاء ذاتي في أي وقت من صفحة الفوترة؛ لا وصول بعد ذلك ولا يمكن استعادة الحجوزات المحذوفة.',
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
    baitlyImport: 'api',
    exit: { export: 'yes', api: 'yes', afterExit: 'no', freeToLeave: 'yes' },
    exitTerms: {
      fr: 'Sans contrat ni frais de résiliation anticipée ; la fermeture est immédiate et coupe l’accès à toutes les données.',
      en: 'No contract and no early termination fee; closing is immediate and ends access to all data.',
      ar: 'بدون عقد أو رسوم إنهاء مبكر؛ الإغلاق فوري ويُنهي الوصول إلى جميع البيانات.',
    },
    feedback: {
      fr: 'Sur le forum OwnerRez, des utilisateurs demandent un export de tous les voyageurs avec tags et avis : l’export actuel ne couvre pas tout en une fois.',
      en: 'On the OwnerRez forum, users ask for a full guest export including tags and reviews: today’s export does not cover everything at once.',
      ar: 'في منتدى OwnerRez يطلب مستخدمون تصديراً كاملاً للضيوف مع الوسوم والتقييمات: التصدير الحالي لا يشمل كل شيء دفعة واحدة.',
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
    baitlyImport: 'files',
    exit: {
      export: 'partial',
      api: 'yes',
      afterExit: 'unknown',
      freeToLeave: 'partial',
    },
    exitTerms: {
      fr: 'Résiliation depuis la facturation ; offres mensuelles et annuelles. Suppression des données après la fin du compte, sans fenêtre d’export publiée.',
      en: 'Cancel from billing; monthly and annual plans. Data deleted after the account ends, with no published export window.',
      ar: 'الإلغاء من صفحة الفوترة؛ اشتراكات شهرية وسنوية. تُحذف البيانات بعد إغلاق الحساب دون مهلة تصدير معلنة.',
    },
    feedback: {
      fr: 'Des avis Trustpilot rapportent un renouvellement annuel sans remboursement au prorata et une demande d’extraction de données restée sans aide concrète.',
      en: 'Trustpilot reviews report annual renewals without pro-rated refunds and a data-extraction request left without practical help.',
      ar: 'تذكر تقييمات على Trustpilot تجديداً سنوياً دون استرداد نسبي وطلب استخراج بيانات لم يلقَ مساعدة فعلية.',
    },
    sources: [
      {
        kind: 'export',
        url: 'https://www.lodgify.com/blog/product-updates-may-2025/',
      },
      { kind: 'api', url: 'https://docs.lodgify.com/docs/getting-started-1' },
      { kind: 'exit', url: 'https://www.lodgify.com/terms/' },
      {
        kind: 'review',
        url: 'https://uk.trustpilot.com/review/lodgify.com?page=5',
      },
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
    baitlyImport: 'files',
    exit: {
      export: 'partial',
      api: 'yes',
      afterExit: 'no',
      freeToLeave: 'yes',
    },
    exitTerms: {
      fr: 'Résiliation en autonomie à tout moment, sans remboursement ; l’accès aux données s’arrête à la fin de la période payée.',
      en: 'Self-service cancellation at any time, without refunds; data access ends with the paid period.',
      ar: 'إلغاء ذاتي في أي وقت دون استرداد؛ ينتهي الوصول إلى البيانات مع نهاية الفترة المدفوعة.',
    },
    sources: [
      {
        kind: 'export',
        url: 'https://www.hostfully.com/property-management-software/features/enhanced-reporting/',
      },
      { kind: 'api', url: 'https://www.hostfully.com/resources/faq/' },
      {
        kind: 'exit',
        url: 'https://help.hostfully.com/en/articles/1695060-cancel-your-hostfully-subscriptions',
      },
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
    baitlyImport: 'api',
    exit: {
      export: 'partial',
      api: 'yes',
      afterExit: 'partial',
      freeToLeave: 'yes',
    },
    exitTerms: {
      fr: 'Résiliation effective en fin de période ; accès en lecture seule pendant un temps limité, sans garantie de conservation au-delà.',
      en: 'Cancellation takes effect at the end of the period; read-only access for a limited time, with no retention guarantee beyond it.',
      ar: 'يسري الإلغاء في نهاية الفترة؛ وصول للقراءة فقط لمدة محدودة دون ضمان للاحتفاظ بعدها.',
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
    id: 'amenitiz',
    name: 'Amenitiz',
    evidence: 'exports',
    formats: 'Excel',
    coverage: {
      fr: 'Liste des clients en Excel et factures exportables.',
      en: 'Client list in Excel and exportable invoices.',
      ar: 'قائمة العملاء بصيغة Excel وفواتير قابلة للتصدير.',
    },
    caution: {
      fr: 'Pas de CSV direct pour les clients. Exporter réservations et factures séparément.',
      en: 'No direct CSV for clients. Export bookings and invoices separately.',
      ar: 'لا يتوفر CSV مباشر للعملاء. صدّر الحجوزات والفواتير بشكل منفصل.',
    },
    timing: {
      fr: 'Téléchargement autonome ; restitution complète à confirmer.',
      en: 'Self-service download; confirm full data return.',
      ar: 'تنزيل ذاتي؛ يجب تأكيد إعادة البيانات كاملة.',
    },
    baitlyImport: 'files',
    exit: {
      export: 'partial',
      api: 'unknown',
      afterExit: 'no',
      freeToLeave: 'no',
    },
    exitTerms: {
      fr: 'Engagement d’un an renouvelé tacitement ; demande de résiliation trois mois avant le départ. Les données peuvent être supprimées ou devenir inaccessibles à la fin du contrat.',
      en: 'One-year commitment with automatic renewal; cancellation request three months before leaving. Data may be deleted or become inaccessible when the contract ends.',
      ar: 'التزام لمدة سنة يتجدد تلقائياً؛ يجب طلب الإلغاء قبل المغادرة بثلاثة أشهر. قد تُحذف البيانات أو يتعذر الوصول إليها عند انتهاء العقد.',
    },
    sources: [
      {
        kind: 'export',
        url: 'https://support.amenitiz.com/en/articles/332712-how-to-export-your-clients-list',
      },
      {
        kind: 'exit',
        url: 'https://support.amenitiz.com/en/articles/429634-how-to-cancel-your-amenitiz-subscription',
      },
      { kind: 'terms', url: 'https://amenitiz.com/en/legal/terms-conditions' },
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
    baitlyImport: 'files',
    exit: {
      export: 'unknown',
      api: 'yes',
      afterExit: 'unknown',
      freeToLeave: 'unknown',
    },
    exitTerms: {
      fr: 'Conditions de sortie non publiées : durée d’engagement, préavis et restitution à obtenir par écrit.',
      en: 'Exit terms are not published: get the commitment, notice and data return in writing.',
      ar: 'شروط المغادرة غير منشورة: احصل كتابياً على مدة الالتزام والإشعار وآلية إعادة البيانات.',
    },
    feedback: {
      fr: 'Des avis publics citent des difficultés d’échange de données et l’absence de remboursement après une résiliation anticipée.',
      en: 'Public reviews cite data-exchange difficulties and no refund after early termination.',
      ar: 'تذكر تقييمات عامة صعوبات في تبادل البيانات وعدم الاسترداد بعد الإنهاء المبكر.',
    },
    sources: [
      { kind: 'api', url: 'https://www.avantio.com/api-integrations/' },
      { kind: 'review', url: 'https://www.capterra.com/p/134278/Avantio/' },
    ],
  },
];
