import type { SiteLanguage } from '../lib/siteLanguage';

type GlossaryEntry = { id: string; category: number } & Record<
  SiteLanguage,
  { term: string; definition: string }
>;

export const RESOURCE_GLOSSARY: GlossaryEntry[] = [
  {
    id: 'adr',
    category: 1,
    fr: {
      term: 'ADR · Prix moyen par nuit vendue',
      definition:
        'Revenus d’hébergement divisés par les nuits vendues. Les nuits non vendues n’entrent pas dans ce calcul.',
    },
    en: {
      term: 'ADR · Average daily rate',
      definition:
        'Accommodation revenue divided by sold nights. Unsold nights are excluded.',
    },
    ar: {
      term: 'ADR · متوسط سعر الليلة المباعة',
      definition:
        'إيرادات الإيواء مقسومة على الليالي المباعة، دون احتساب الليالي غير المباعة.',
    },
  },
  {
    id: 'revpar',
    category: 1,
    fr: {
      term: 'RevPAR · Revenu par nuit disponible',
      definition:
        'Revenus d’hébergement divisés par les nuits disponibles. Équivaut à l’ADR multiplié par le taux d’occupation sur le même périmètre.',
    },
    en: {
      term: 'RevPAR · Revenue per available room',
      definition:
        'Accommodation revenue divided by available room nights. Equals ADR multiplied by occupancy over the same scope.',
    },
    ar: {
      term: 'RevPAR · الإيراد لكل ليلة متاحة',
      definition:
        'إيرادات الإيواء مقسومة على الليالي المتاحة. يساوي متوسط السعر مضروباً في نسبة الإشغال للنطاق نفسه.',
    },
  },
  {
    id: 'occupancy',
    category: 1,
    fr: {
      term: 'Taux d’occupation',
      definition:
        'Nuits vendues divisées par les nuits disponibles, en pourcentage. Précisez le traitement des nuits bloquées pour comparer deux périodes.',
    },
    en: {
      term: 'Occupancy rate',
      definition:
        'Sold nights divided by available nights, as a percentage. Specify how blocked nights are treated before comparing periods.',
    },
    ar: {
      term: 'نسبة الإشغال',
      definition:
        'الليالي المباعة مقسومة على الليالي المتاحة كنسبة مئوية. وضّح معالجة الليالي المحجوبة عند مقارنة الفترات.',
    },
  },
  {
    id: 'pacing',
    category: 1,
    fr: {
      term: 'Pacing · Rythme des réservations',
      definition:
        'Évolution des réservations déjà acquises pour une période future, comparée au même délai avant séjour d’une période de référence.',
    },
    en: {
      term: 'Booking pace',
      definition:
        'Bookings already secured for a future stay period, compared at the same lead time with a reference period.',
    },
    ar: {
      term: 'وتيرة الحجز',
      definition:
        'تطور الحجوزات المؤكدة لفترة مستقبلية مقارنة بفترة مرجعية عند المدة نفسها قبل الإقامة.',
    },
  },
  {
    id: 'lead-time',
    category: 1,
    fr: {
      term: 'Délai de réservation',
      definition:
        'Nombre de jours entre la réservation et l’arrivée. Il aide à comprendre quand vos voyageurs décident.',
    },
    en: {
      term: 'Booking lead time',
      definition:
        'Days between booking and arrival. Helps identify when guests make their decision.',
    },
    ar: {
      term: 'المدة بين الحجز والوصول',
      definition:
        'عدد الأيام بين إجراء الحجز وتاريخ الوصول. تساعد على فهم توقيت قرار الضيف.',
    },
  },
  {
    id: 'los',
    category: 1,
    fr: {
      term: 'LOS · Durée de séjour',
      definition:
        'Nombre de nuits d’une réservation. La durée moyenne se calcule sur les séjours du périmètre choisi.',
    },
    en: {
      term: 'LOS · Length of stay',
      definition:
        'Number of nights in a booking. Average length of stay is calculated across stays in the chosen scope.',
    },
    ar: {
      term: 'LOS · مدة الإقامة',
      definition:
        'عدد ليالي الحجز. يُحسب متوسط المدة على الإقامات ضمن النطاق المختار.',
    },
  },
  {
    id: 'margin',
    category: 1,
    fr: {
      term: 'Marge sur coûts variables',
      definition:
        'Revenu diminué des coûts variables associés. Ce montant contribue à couvrir les charges fixes ; ce n’est pas le bénéfice net.',
    },
    en: {
      term: 'Contribution margin',
      definition:
        'Revenue less associated variable costs. Contributes to fixed costs; it is not net profit.',
    },
    ar: {
      term: 'هامش المساهمة',
      definition:
        'الإيراد بعد طرح التكاليف المتغيرة المرتبطة به. يساهم في تغطية الثابتة ولا يمثل صافي الربح.',
    },
  },
  {
    id: 'pms',
    category: 2,
    fr: {
      term: 'PMS · Logiciel de gestion',
      definition:
        'Système qui centralise la gestion des hébergements, réservations, voyageurs et opérations selon ses fonctionnalités.',
    },
    en: {
      term: 'PMS · Property management system',
      definition:
        'Software centralising properties, bookings, guests and operations according to its features.',
    },
    ar: {
      term: 'PMS · نظام إدارة العقارات',
      definition:
        'برنامج يجمع إدارة العقارات والحجوزات والضيوف والعمليات حسب وظائفه.',
    },
  },
  {
    id: 'channel-manager',
    category: 2,
    fr: {
      term: 'Channel manager',
      definition:
        'Outil de synchronisation des disponibilités, tarifs et réservations entre plusieurs canaux de distribution, selon les connexions disponibles.',
    },
    en: {
      term: 'Channel manager',
      definition:
        'A tool synchronising availability, rates and bookings across distribution channels, depending on supported connections.',
    },
    ar: {
      term: 'مدير القنوات',
      definition:
        'أداة لمزامنة التوفر والأسعار والحجوزات بين قنوات التوزيع وفق الاتصالات المدعومة.',
    },
  },
  {
    id: 'ota',
    category: 2,
    fr: {
      term: 'OTA · Agence de voyage en ligne',
      definition:
        'Plateforme tierce qui commercialise des hébergements et facilite la réservation, généralement contre une rémunération.',
    },
    en: {
      term: 'OTA · Online travel agency',
      definition:
        'A third-party platform marketing accommodation and facilitating bookings, usually for a fee.',
    },
    ar: {
      term: 'OTA · وكالة سفر إلكترونية',
      definition:
        'منصة خارجية تسوّق أماكن الإقامة وتسهّل الحجز، عادة مقابل رسوم.',
    },
  },
  {
    id: 'booking-engine',
    category: 2,
    fr: {
      term: 'Booking engine · Moteur de réservation',
      definition:
        'Parcours permettant au voyageur de choisir dates et hébergement, puis de confirmer sa réservation directement sur votre site.',
    },
    en: {
      term: 'Booking engine',
      definition:
        'A flow enabling guests to choose dates and accommodation, then confirm a booking directly on your website.',
    },
    ar: {
      term: 'محرك الحجز',
      definition:
        'مسار يسمح للضيف باختيار التواريخ والإقامة ثم تأكيد الحجز مباشرة على موقعك.',
    },
  },
  {
    id: 'upsell',
    category: 2,
    fr: {
      term: 'Upsell · Vente additionnelle',
      definition:
        'Proposition d’un service ou d’une option payante en complément du séjour, avec un choix explicite du voyageur.',
    },
    en: {
      term: 'Upsell · Additional sale',
      definition:
        'An optional paid service or upgrade offered alongside the stay, with an explicit guest choice.',
    },
    ar: {
      term: 'البيع الإضافي',
      definition:
        'عرض خدمة أو خيار مدفوع إلى جانب الإقامة، يختاره الضيف صراحة.',
    },
  },
  {
    id: 'turnover',
    category: 3,
    fr: {
      term: 'Rotation',
      definition:
        'Ensemble des opérations entre le départ d’un voyageur et l’arrivée du suivant : nettoyage, contrôle, linge et accès.',
    },
    en: {
      term: 'Turnover',
      definition:
        'Operations between one guest’s departure and the next arrival: cleaning, checks, linen and access.',
    },
    ar: {
      term: 'تجهيز العقار بين الإقامات',
      definition:
        'العمليات بين مغادرة ضيف ووصول التالي: التنظيف والفحص والمفروشات والدخول.',
    },
  },
  {
    id: 'no-show',
    category: 3,
    fr: {
      term: 'No-show · Non-présentation',
      definition:
        'Voyageur qui ne se présente pas à l’arrivée prévue. Son traitement dépend des conditions de réservation convenues.',
    },
    en: {
      term: 'No-show',
      definition:
        'A guest who does not arrive as booked. Handling depends on the agreed booking terms.',
    },
    ar: {
      term: 'عدم الحضور',
      definition:
        'ضيف لا يصل في الموعد المحجوز. تُعالج الحالة وفق شروط الحجز المتفق عليها.',
    },
  },
  {
    id: 'deposit',
    category: 3,
    fr: {
      term: 'Dépôt de garantie',
      definition:
        'Somme ou préautorisation destinée à couvrir d’éventuels dommages selon les conditions applicables. À distinguer du paiement du séjour.',
    },
    en: {
      term: 'Security deposit',
      definition:
        'An amount or preauthorisation intended to cover potential damage under applicable terms. Distinct from payment for the stay.',
    },
    ar: {
      term: 'وديعة الضمان',
      definition:
        'مبلغ أو تفويض مسبق لتغطية أضرار محتملة وفق الشروط المطبقة، ويختلف عن دفع ثمن الإقامة.',
    },
  },
  {
    id: 'owner-statement',
    category: 3,
    fr: {
      term: 'Relevé propriétaire',
      definition:
        'Synthèse des revenus, commissions, dépenses et sommes dues à un propriétaire pour une période donnée.',
    },
    en: {
      term: 'Owner statement',
      definition:
        'Summary of revenue, commissions, expenses and amounts due to an owner over a defined period.',
    },
    ar: {
      term: 'كشف المالك',
      definition:
        'ملخص الإيرادات والعمولات والمصروفات والمبالغ المستحقة للمالك خلال فترة محددة.',
    },
  },
];
