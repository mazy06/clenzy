import type { SiteLanguage } from '../siteLanguage';

const fr = {
  label: 'Quel PMS utilisez-vous ?',
  intro:
    'Découvrez les exports documentés de votre logiciel et les points à vérifier avant de partir.',
  placeholder: 'Sélectionner mon PMS',
  other: 'Autre PMS / je ne sais pas',
  emptyTitle: 'Une migration commence par un inventaire.',
  empty:
    'Choisissez votre logiciel pour consulter les formats, les limites et les sources disponibles.',
  unknownTitle: 'Préparons le périmètre ensemble.',
  unknown:
    'Demandez à votre éditeur un exemple d’export, la liste des données incluses, le délai et les conditions d’accès après résiliation.',
  evidence: {
    exports: 'Export autonome documenté',
    api: 'Exports et API documentés',
    plan: 'Exports selon l’offre',
    confirm: 'Périmètre à confirmer',
  },
  coverage: 'Données documentées',
  caution: 'À anticiper',
  timing: 'Accès et délai',
  sources: 'Consulter les sources',
  sourceKinds: {
    export: 'Export',
    api: 'API',
    exit: 'Départ du PMS',
    plan: 'Offres et accès',
    timing: 'Délais',
    community: 'Échange avec le support',
  },
  checked: 'Sources publiques consultées le',
  methodology:
    'Ce repère décrit les possibilités documentées, sans noter la bonne volonté des éditeurs. Il ne garantit ni un export exhaustif ni un connecteur Baitly déjà disponible. Le contrat et un échantillon d’export restent à vérifier.',
  download: 'Télécharger ma fiche de préparation',
  checklist: [
    'Exporter avant la fin des accès, avec toutes les périodes et tous les statuts.',
    'Demander les messages, pièces jointes, factures, photos et paramètres séparément.',
    'Faire confirmer les données absentes, les frais éventuels et le délai par écrit.',
    'Comparer les volumes et les montants avant de résilier.',
  ],
  promiseTag: 'Notre engagement de réversibilité',
  promiseTitle: 'Vous restez libre de partir.',
  promise:
    'Baitly s’engage à vous restituer l’ensemble des données de votre activité qu’il détient, dans des formats ouverts et réutilisables. Vos informations ne doivent jamais servir à vous retenir.',
  promiseItems: [
    [
      'Des données exploitables',
      'CSV et JSON documentés, avec les liens entre logements, voyageurs, réservations et finances.',
    ],
    [
      'Les fichiers associés',
      'Photos, documents et pièces jointes, avec un inventaire pour vérifier ce qui a été remis.',
    ],
    [
      'Un périmètre transparent',
      'Toute exception liée aux droits de tiers ou à une obligation légale sera explicitée, ainsi que les durées de conservation.',
    ],
  ],
  promiseStatus:
    'Engagement de pré-lancement : l’export intégral n’est pas encore disponible. Son périmètre, ses délais et ses modalités seront publiés avant sa mise en service.',
};
export type PortabilityMessages = typeof fr;
const en: PortabilityMessages = {
  label: 'Which PMS do you use?',
  intro:
    'Explore your software’s documented exports and what to check before leaving.',
  placeholder: 'Select my PMS',
  other: 'Other PMS / not sure',
  emptyTitle: 'Every migration starts with an inventory.',
  empty:
    'Choose your software to see available formats, limitations and sources.',
  unknownTitle: 'Let’s define the scope together.',
  unknown:
    'Ask your vendor for an export sample, the data included, delivery time and access conditions after cancellation.',
  evidence: {
    exports: 'Documented self-service export',
    api: 'Documented exports and API',
    plan: 'Exports depend on the plan',
    confirm: 'Scope to confirm',
  },
  coverage: 'Documented data',
  caution: 'Plan ahead',
  timing: 'Access and timing',
  sources: 'Read the sources',
  sourceKinds: {
    export: 'Export',
    api: 'API',
    exit: 'Leaving the PMS',
    plan: 'Plans and access',
    timing: 'Timing',
    community: 'Support discussion',
  },
  checked: 'Public sources checked on',
  methodology:
    'This guide describes documented capabilities without rating vendors’ willingness to help. It guarantees neither a complete export nor an existing Baitly connector. Your contract and an export sample still need checking.',
  download: 'Download my preparation sheet',
  checklist: [
    'Export all periods and statuses before access ends.',
    'Request messages, attachments, invoices, photos and settings separately.',
    'Get written confirmation of missing data, any fees and delivery time.',
    'Reconcile record counts and amounts before cancelling.',
  ],
  promiseTag: 'Our data portability commitment',
  promiseTitle: 'You stay free to leave.',
  promise:
    'Baitly commits to returning all the business data it holds for you, in open, reusable formats. Your information should never be used to make you stay.',
  promiseItems: [
    [
      'Reusable data',
      'Documented CSV and JSON, with relationships between properties, guests, bookings and financial records.',
    ],
    [
      'Associated files',
      'Photos, documents and attachments, with an inventory to verify what was delivered.',
    ],
    [
      'Transparent scope',
      'Any third-party rights or legal exceptions will be explained, along with retention periods.',
    ],
  ],
  promiseStatus:
    'Pre-launch commitment: full account export is not yet available. Scope, turnaround and terms will be published before it goes live.',
};
const ar: PortabilityMessages = {
  label: 'ما نظام إدارة العقارات الذي تستخدمه؟',
  intro: 'تعرّف على خيارات التصدير الموثّقة وما يجب التحقق منه قبل المغادرة.',
  placeholder: 'اختر نظامك',
  other: 'نظام آخر / لست متأكداً',
  emptyTitle: 'تبدأ كل عملية انتقال بحصر البيانات.',
  empty: 'اختر نظامك للاطلاع على الصيغ والقيود والمصادر المتاحة.',
  unknownTitle: 'لنحدّد نطاق النقل معاً.',
  unknown:
    'اطلب من المزوّد نموذج تصدير وقائمة بالبيانات المشمولة ومدة التسليم وشروط الوصول بعد الإلغاء.',
  evidence: {
    exports: 'تصدير ذاتي موثّق',
    api: 'تصدير وواجهة API موثّقان',
    plan: 'التصدير حسب الاشتراك',
    confirm: 'النطاق يحتاج إلى تأكيد',
  },
  coverage: 'البيانات الموثّقة',
  caution: 'ما يجب الاستعداد له',
  timing: 'الوصول والمدة',
  sources: 'الاطلاع على المصادر',
  sourceKinds: {
    export: 'التصدير',
    api: 'واجهة API',
    exit: 'مغادرة النظام',
    plan: 'الاشتراكات والوصول',
    timing: 'المدة',
    community: 'نقاش مع الدعم',
  },
  checked: 'تاريخ مراجعة المصادر العامة:',
  methodology:
    'يعرض هذا الدليل الإمكانات الموثّقة دون تقييم نوايا المزوّدين. لا يضمن تصديراً شاملاً ولا توفّر رابط استيراد جاهز في بيتلي. يبقى التحقق من العقد ونموذج التصدير ضرورياً.',
  download: 'تنزيل ورقة التحضير',
  checklist: [
    'صدّر جميع الفترات والحالات قبل انتهاء الوصول.',
    'اطلب الرسائل والمرفقات والفواتير والصور والإعدادات بشكل منفصل.',
    'احصل على تأكيد كتابي للبيانات الناقصة والرسوم المحتملة ومدة التسليم.',
    'طابق أعداد السجلات والمبالغ قبل الإلغاء.',
  ],
  promiseTag: 'التزامنا بإمكانية نقل بياناتك',
  promiseTitle: 'أنت حرّ في المغادرة.',
  promise:
    'يلتزم بيتلي بإعادة جميع بيانات نشاطك التي يحتفظ بها، بصيغ مفتوحة وقابلة لإعادة الاستخدام. لن تكون معلوماتك وسيلة لإجبارك على البقاء.',
  promiseItems: [
    [
      'بيانات قابلة للاستخدام',
      'ملفات CSV وJSON موثّقة مع الروابط بين العقارات والضيوف والحجوزات والسجلات المالية.',
    ],
    [
      'الملفات المرتبطة',
      'الصور والمستندات والمرفقات مع قائمة للتحقق مما تم تسليمه.',
    ],
    [
      'نطاق واضح',
      'توضيح أي استثناء مرتبط بحقوق الغير أو الالتزامات القانونية، وفترات الاحتفاظ بالبيانات.',
    ],
  ],
  promiseStatus:
    'التزام قبل الإطلاق: التصدير الشامل غير متاح بعد. سننشر نطاقه ومدته وشروطه قبل إتاحته.',
};
export const PMS_PORTABILITY_MESSAGES: Record<
  SiteLanguage,
  PortabilityMessages
> = { fr, en, ar };
