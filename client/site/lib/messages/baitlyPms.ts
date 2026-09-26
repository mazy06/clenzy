import type { SiteLanguage } from '../siteLanguage';

const fr = {
  eyebrow: 'PMS & Channel manager',
  title: ['Tous vos logements.', 'Un planning qui fait le lien.'],
  intro:
    'De la réservation au départ, retrouvez chaque séjour au même endroit. Vos canaux se synchronisent, votre équipe garde le fil.',
  cta: 'Découvrir Baitly',
  explore: 'Voir le planning en action',
  pricing: 'Voir les tarifs',
  promises: [
    'Planning multi-logements',
    'Réservations OTA & directes',
    'Tarifs et disponibilités synchronisés',
  ],
  hero: {
    eyebrow: 'Votre prochaine réservation',
    property: 'Riad Bab Doukkala',
    location: 'Fès · Médina',
    guest: 'Sofia Fontaine',
    dates: '28 sept. → 2 oct.',
    nights: '4 nuits · 2 voyageurs',
    status: 'Confirmée',
    sync: 'Un séjour reçu. Un planning à jour.',
    caption: 'Exemple de réservation dans Baitly',
  },
  channelIntro: 'Vos canaux, réunis dans votre quotidien.',
  direct: 'Votre site direct',
  planning: {
    eyebrow: 'Votre nouveau point de repère',
    title: 'Le bon détail, au bon endroit.',
    intro:
      'Les logements à gauche. Les séjours dans le calendrier. Les paiements, les interventions et les alertes directement sur les réservations.',
    note: 'Démonstration avec des données fictives. Faites défiler le planning horizontalement sur mobile.',
    legends: [
      'Les couleurs indiquent le statut du séjour.',
      'Les logos identifient le canal de réservation.',
      'Les pastilles donnent les informations à traiter.',
    ],
  },
  sync: {
    eyebrow: 'Channel manager',
    title: 'Plusieurs canaux. La même disponibilité.',
    intro:
      'Une réservation arrive, les disponibilités sont mises à jour. Ajustez vos tarifs et vos restrictions depuis Baitly, puis diffusez-les vers les canaux connectés.',
    hub: 'Un point de gestion',
    status: 'Disponibilités mises à jour',
    fields: ['Disponibilités', 'Tarifs par nuit', 'Séjour minimum'],
    values: ['Fermé à la vente', '1 250 MAD', '3 nuits'],
    date: '28 sept. → 2 oct.',
    labels: ['Réception', 'Mise à jour', 'Diffusion'],
    details: [
      'Les réservations OTA et directes rejoignent le même calendrier.',
      'Les dates occupées sont prises en compte dans les disponibilités.',
      'Les canaux connectés reçoivent les tarifs et restrictions.',
    ],
    footnote:
      'Connexions ARI via Channex. Imports iCal disponibles selon les canaux, avec un rythme de mise à jour propre à iCal.',
  },
  stay: {
    eyebrow: 'Au-delà du calendrier',
    title: 'Un séjour se prépare à plusieurs.',
    intro:
      'Passez du planning aux informations utiles à votre équipe, sans perdre le contexte de la réservation.',
    arrival: 'Tout est prêt pour l’arrivée.',
    arrivalCopy:
      'Coordonnées du voyageur, dates, règlement et attentions : retrouvez les détails du séjour dans sa fiche.',
    guest: 'Sofia Fontaine',
    checkin: 'Arrivée · 28 sept., 15 h',
    paid: 'Règlement suivi',
    cleaning: 'Le départ donne le tempo.',
    cleaningCopy:
      'Visualisez le ménage et la maintenance associés aux séjours pour préparer le prochain accueil.',
    cleanStatus: 'Ménage après départ',
    cleanTime: '2 oct. · 11 h → 14 h',
    operations: 'Explorer les opérations',
    finance: 'Explorer les paiements',
    footer: 'Le planning relie vos réservations, vos voyageurs et vos équipes.',
  },
  faq: 'Avant de réunir vos calendriers.',
  final: {
    eyebrow: 'Votre prochain chapitre',
    title: 'Changez de PMS. Gardez vos repères.',
    copy: 'Votre portefeuille, vos canaux, votre équipe : découvrez comment organiser votre passage à Baitly.',
    migration: 'Découvrir la migration',
  },
};

type PmsMessages = typeof fr;
const en: PmsMessages = {
  eyebrow: 'PMS & Channel manager',
  title: ['Every property.', 'One calendar that connects it all.'],
  intro:
    'From booking to checkout, follow every stay in one place. Your channels stay in sync and your team stays in the loop.',
  cta: 'Discover Baitly',
  explore: 'See the calendar in action',
  pricing: 'View pricing',
  promises: [
    'Multi-property calendar',
    'OTA & direct bookings',
    'Rates and availability in sync',
  ],
  hero: {
    eyebrow: 'Your next reservation',
    property: 'Riad Bab Doukkala',
    location: 'Fez · Medina',
    guest: 'Sofia Fontaine',
    dates: '28 Sep → 2 Oct',
    nights: '4 nights · 2 guests',
    status: 'Confirmed',
    sync: 'A new booking. An updated calendar.',
    caption: 'Illustrative booking in Baitly',
  },
  channelIntro: 'Your channels, together in your daily workflow.',
  direct: 'Your direct website',
  planning: {
    eyebrow: 'Your daily overview',
    title: 'The right detail, in the right place.',
    intro:
      'Properties on the left. Stays in the calendar. Payments, tasks and alerts directly on each booking.',
    note: 'Demonstration with fictional data. Scroll the calendar horizontally on mobile.',
    legends: [
      'Colours show the status of each stay.',
      'Logos identify the booking channel.',
      'Badges surface the details that need attention.',
    ],
  },
  sync: {
    eyebrow: 'Channel manager',
    title: 'Multiple channels. The same availability.',
    intro:
      'When a booking arrives, availability is updated. Adjust rates and restrictions in Baitly, then distribute them to connected channels.',
    hub: 'One place to manage',
    status: 'Availability updated',
    fields: ['Availability', 'Nightly rate', 'Minimum stay'],
    values: ['Closed for sale', 'MAD 1,250', '3 nights'],
    date: '28 Sep → 2 Oct',
    labels: ['Receive', 'Update', 'Distribute'],
    details: [
      'OTA and direct bookings join the same calendar.',
      'Booked dates are reflected in availability.',
      'Connected channels receive rates and restrictions.',
    ],
    footnote:
      'ARI connections via Channex. iCal imports depend on the channel and follow their own update schedule.',
  },
  stay: {
    eyebrow: 'Beyond the calendar',
    title: 'Great stays are a team effort.',
    intro:
      'Go from the calendar to the details your team needs, keeping the reservation in context.',
    arrival: 'Ready for the next arrival.',
    arrivalCopy:
      'Guest details, dates, payments and extras: find the stay’s information in its booking record.',
    guest: 'Sofia Fontaine',
    checkin: 'Check-in · 28 Sep, 3 pm',
    paid: 'Payment tracked',
    cleaning: 'Checkout sets the pace.',
    cleaningCopy:
      'See the cleaning and maintenance linked to each stay and prepare for the next guest.',
    cleanStatus: 'Cleaning after checkout',
    cleanTime: '2 Oct · 11 am → 2 pm',
    operations: 'Explore operations',
    finance: 'Explore payments',
    footer: 'Your calendar connects your bookings, guests and teams.',
  },
  faq: 'Before bringing your calendars together.',
  final: {
    eyebrow: 'Your next chapter',
    title: 'A new PMS. Familiar ground.',
    copy: 'Your portfolio, channels and team: discover how to organise your move to Baitly.',
    migration: 'Explore migration',
  },
};

const ar: PmsMessages = {
  eyebrow: 'نظام إدارة العقارات والقنوات',
  title: ['كل عقاراتك.', 'تقويم واحد يجمع التفاصيل.'],
  intro:
    'من الحجز إلى المغادرة، تابع كل إقامة في مكان واحد. تتزامن قنواتك ويبقى فريقك على اطلاع.',
  cta: 'اكتشف Baitly',
  explore: 'شاهد التقويم عملياً',
  pricing: 'عرض الأسعار',
  promises: [
    'تقويم متعدد العقارات',
    'حجوزات مباشرة ومنصات',
    'مزامنة الأسعار والتوافر',
  ],
  hero: {
    eyebrow: 'حجزك القادم',
    property: 'رياض باب دكالة',
    location: 'فاس · المدينة القديمة',
    guest: 'سارة العتيبي',
    dates: '28 سبتمبر ← 2 أكتوبر',
    nights: '4 ليالٍ · ضيفان',
    status: 'مؤكد',
    sync: 'حجز جديد. تقويم محدّث.',
    caption: 'مثال توضيحي لحجز في Baitly',
  },
  channelIntro: 'قنواتك مجتمعة في عملك اليومي.',
  direct: 'موقعك المباشر',
  planning: {
    eyebrow: 'نظرة شاملة ليومك',
    title: 'التفصيل المناسب في المكان المناسب.',
    intro:
      'العقارات بجانب التقويم، والإقامات داخله. والمدفوعات والمهام والتنبيهات على كل حجز مباشرة.',
    note: 'عرض ببيانات افتراضية. مرّر التقويم أفقياً على الجوال.',
    legends: [
      'الألوان توضّح حالة الإقامة.',
      'الشعارات تحدّد قناة الحجز.',
      'الشارات تبرز التفاصيل التي تحتاج للمتابعة.',
    ],
  },
  sync: {
    eyebrow: 'مدير القنوات',
    title: 'قنوات متعددة. توافر موحّد.',
    intro:
      'عند وصول حجز، يُحدَّث التوافر. عدّل الأسعار والقيود في Baitly ووزّعها على القنوات المتصلة.',
    hub: 'مكان واحد للإدارة',
    status: 'تم تحديث التوافر',
    fields: ['التوافر', 'سعر الليلة', 'الحد الأدنى للإقامة'],
    values: ['مغلق للبيع', '1,250 ر.س', '3 ليالٍ'],
    date: '28 سبتمبر ← 2 أكتوبر',
    labels: ['استقبال', 'تحديث', 'توزيع'],
    details: [
      'تجتمع الحجوزات المباشرة وحجوزات المنصات في تقويم واحد.',
      'تؤخذ التواريخ المحجوزة في حساب التوافر.',
      'تستقبل القنوات المتصلة الأسعار وقيود الإقامة.',
    ],
    footnote:
      'اتصالات ARI عبر Channex. تتوفر واردات iCal بحسب القناة ووفق وتيرة التحديث الخاصة بها.',
  },
  stay: {
    eyebrow: 'أكثر من تقويم',
    title: 'الإقامة الناجحة عمل فريق.',
    intro:
      'انتقل من التقويم إلى التفاصيل التي يحتاجها فريقك مع الحفاظ على سياق الحجز.',
    arrival: 'كل شيء جاهز للوصول.',
    arrivalCopy:
      'معلومات الضيف والمواعيد والمدفوعات والإضافات في سجل واحد للحجز.',
    guest: 'سارة العتيبي',
    checkin: 'الوصول · 28 سبتمبر، 15:00',
    paid: 'متابعة الدفع',
    cleaning: 'المغادرة تحدّد الخطوة التالية.',
    cleaningCopy:
      'اطّلع على التنظيف والصيانة المرتبطين بالإقامات وجهّز المكان لاستقبال الضيف التالي.',
    cleanStatus: 'تنظيف بعد المغادرة',
    cleanTime: '2 أكتوبر · 11:00 ← 14:00',
    operations: 'استكشف العمليات',
    finance: 'استكشف المدفوعات',
    footer: 'تقويمك يربط حجوزاتك وضيوفك وفرقك.',
  },
  faq: 'قبل توحيد تقاويمك.',
  final: {
    eyebrow: 'فصلك القادم',
    title: 'نظام جديد. تجربة مألوفة.',
    copy: 'عقاراتك وقنواتك وفريقك: اكتشف كيف تنظّم انتقالك إلى Baitly.',
    migration: 'اكتشف الانتقال',
  },
};

export const BAITLY_PMS_MESSAGES: Record<SiteLanguage, PmsMessages> = {
  fr,
  en,
  ar,
};
