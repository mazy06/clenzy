import type { SiteLanguage } from '../siteLanguage';
import type { BaitlyMarket } from '../../data/baitlyLoyaltyPricing';

export interface BaitlyLoyaltyMessages {
  eyebrow: string;
  title: [string, string];
  intro: string;
  explore: string;
  compare: string;
  proposal: string;
  promises: [string, string, string];
  simulator: string;
  planLabel: string;
  marketLabel: string;
  markets: Record<BaitlyMarket, string>;
  properties: string;
  volumeTitle: string;
  volumeHint: string;
  averageUnit: string;
  totalFor: string;
  calculation: string;
  beforeDiscounts: string;
  volumeSubtotal: string;
  volumeSavings: string;
  loyaltySavings: string;
  propertyWords: [string, string];
  month: string;
  phase: string;
  periods: [string, string, string, string];
  milestones: [string, string, string, string];
  stageCopy: [string, string, string, string];
  base: string;
  stable: string;
  unit: string;
  monthly: string;
  tax: string;
  firstYear: string;
  savings: string;
  savingsNote: string;
  simulationNote: string;
  play: string;
  pause: string;
  replay: string;
  plansTitle: string;
  plansCopy: string;
  needs: string;
  direct: string;
  automate: string;
  selected: string;
  planDescriptions: [string, string];
  initial: string;
  later: string;
  planCtas: [string, string];
  planFits: [string, string];
  planHighlights: [[string, string, string], [string, string, string]];
  visuals: {
    example: string;
    booking: string;
    breakfast: string;
    confirmed: string;
    planning: string;
    approved: string;
    captions: [string, string];
  };
  customTitle: string;
  customCopy: string;
  customCta: string;
  comparisonTitle: string;
  comparisonToggle: string;
  comparisonCopy: string;
  service: string;
  included: string;
  excluded: string;
  comparisonHint: string;
  groups: {
    title: string;
    rows: { label: string; detail: string; essential: boolean; pro: boolean }[];
  }[];
  optionsTitle: string;
  optionsCopy: string;
  optional: string;
  thirdParty: string;
  rulesTitle: string;
  rules: { q: string; a: string }[];
  finalTitle: string;
  finalCopy: string;
  finalCta: string;
}

const fr: BaitlyLoyaltyMessages = {
  eyebrow: 'Tarifs · Volume + fidélité',
  title: ['Plus vous restez,', 'moins vous payez.'],
  intro:
    'Plus de logements, un prix moyen plus bas. Et jusqu’à −30 % supplémentaires avec le temps.',
  explore: 'Trouver mon offre',
  compare: 'Comparer les services',
  proposal:
    'Nouvelle grille proposée pour le lancement. Conditions à confirmer avant souscription.',
  promises: [
    'Vos services restent inclus',
    'Volume + fidélité, cumulables',
    'Un tarif stabilisé après un an',
  ],
  simulator: 'Votre tarif, à votre échelle',
  planLabel: 'Offre à simuler',
  marketLabel: 'Votre marché',
  markets: {
    MA: 'Maroc',
    EU: 'Europe',
    SA: 'Arabie saoudite',
  },
  properties: 'Nombre de logements',
  volumeTitle: 'Remise par tranche de logements',
  volumeHint:
    'Chaque remise s’applique uniquement aux logements de sa tranche.',
  averageUnit: 'Prix moyen / logement / mois, HT',
  totalFor: 'Total pour',
  calculation: 'Voir le détail du calcul',
  beforeDiscounts: 'Total avant remises',
  volumeSubtotal: 'Après remise de volume',
  volumeSavings: 'Économie de volume',
  loyaltySavings: 'Économie de fidélité',
  propertyWords: ['logement', 'logements'],
  month: 'Mois',
  phase: 'Explorer les paliers de fidélité',
  periods: ['Mois 1 à 3', 'Mois 4 à 6', 'Mois 7 à 12', 'Dès le mois 13'],
  milestones: ['À vos débuts', 'Après 3 mois', 'Après 6 mois', 'Après 12 mois'],
  stageCopy: [
    'Vous démarrez avec tous les services de votre offre.',
    'Votre première baisse, sans perdre une fonctionnalité.',
    'Votre fidélité compte, votre abonnement baisse encore.',
    'Le dernier palier est atteint. Ce tarif se stabilise.',
  ],
  base: 'Tarif de départ',
  stable: 'Tarif fidélité',
  unit: '/ logement / mois, HT',
  monthly: 'Votre mensualité',
  tax: 'HT / mois',
  firstYear: 'Budget des 12 premiers mois',
  savings: 'Économisés la première année',
  savingsNote:
    'Comparé au tarif de base sans remise, pour le même parc pendant 12 mois.',
  simulationNote:
    'Simulation hors taxes, hors options et frais de tiers. Mensualités, sans paiement annuel anticipé. À partir de 50 logements, une proposition sur mesure.',
  play: 'Animer les paliers',
  pause: 'Mettre en pause',
  replay: 'Rejouer les paliers',
  plansTitle: 'Votre activité. Votre offre.',
  plansCopy: 'Deux offres. Les mêmes remises de volume et de fidélité.',
  needs: 'Quel est votre besoin principal ?',
  direct: 'Gérer et vendre en direct',
  automate: 'Automatiser ma gestion',
  selected: 'Votre sélection',
  planDescriptions: [
    'Gérez vos locations. Vendez en direct.',
    'Tout Essentiel, avec l’IA pour vous épauler.',
  ],
  initial: 'Au démarrage',
  later: 'Après 12 mois',
  planCtas: ['Choisir Essentiel', 'Choisir Pro'],
  planFits: [
    'Pour garder la main sur votre quotidien.',
    'Pour déléguer les tâches, avec votre validation.',
  ],
  planHighlights: [
    [
      'PMS & calendrier synchronisé',
      'Site, réservation directe & upsells',
      'Facturation & support',
    ],
    [
      'Tous les services Essentiel',
      'Agents IA & tarification encadrée',
      'Ménage & portail propriétaire',
    ],
  ],
  visuals: {
    example: 'Aperçu illustratif',
    booking: 'Votre réservation directe',
    breakfast: 'Petit-déjeuner',
    confirmed: 'Séjour confirmé',
    planning: 'Votre planning centralisé',
    approved: 'Action IA validée',
    captions: [
      'Votre site. Vos réservations. Vos extras.',
      'Vos logements. Vos équipes. Un seul planning.',
    ],
  },
  comparisonToggle: 'Comparer Essentiel et Pro',
  customTitle: '50 logements et plus ?',
  customCopy: 'Une offre sur mesure, à l’échelle de votre organisation.',
  customCta: 'Étudier mon projet',
  comparisonTitle: 'Les services, en détail.',
  comparisonCopy:
    'Le prix baisse. Tous les services de votre offre restent inclus.',
  service: 'Services',
  included: 'Inclus',
  excluded: 'Non inclus',
  comparisonHint: 'Sur petit écran, faites défiler le tableau horizontalement.',
  groups: [
    {
      title: 'Gérer & vendre',
      rows: [
        {
          label: 'PMS & channel manager',
          detail: 'Réservations, calendrier et synchronisation des canaux.',
          essential: true,
          pro: true,
        },
        {
          label: 'Booking engine & site',
          detail: 'Réservation directe et templates à votre image.',
          essential: true,
          pro: true,
        },
        {
          label: 'Livret d’accueil & upsells',
          detail: 'Informations du séjour, services et expériences à proposer.',
          essential: true,
          pro: true,
        },
      ],
    },
    {
      title: 'Accueillir & facturer',
      rows: [
        {
          label: 'Déclaration des voyageurs & taxe de séjour',
          detail: 'Les démarches de votre marché dans le même outil.',
          essential: true,
          pro: true,
        },
        {
          label: 'Facturation conforme',
          detail: 'Documents et suivi de votre facturation.',
          essential: true,
          pro: true,
        },
        {
          label: 'Support WhatsApp',
          detail: 'Une équipe pour répondre à vos questions.',
          essential: true,
          pro: true,
        },
      ],
    },
    {
      title: 'Automatiser & piloter',
      rows: [
        {
          label: 'Agents IA',
          detail: 'Actions supervisées, avec validation humaine.',
          essential: false,
          pro: true,
        },
        {
          label: 'Tarification automatique encadrée',
          detail: 'Des ajustements dans les limites que vous fixez.',
          essential: false,
          pro: true,
        },
        {
          label: 'Market data par ville',
          detail: 'Des repères pour vos décisions tarifaires.',
          essential: false,
          pro: true,
        },
        {
          label: 'Portail propriétaire & e-signature',
          detail: 'Un espace dédié à la relation avec vos propriétaires.',
          essential: false,
          pro: true,
        },
        {
          label: 'Opérations ménage & preuve photo',
          detail: 'Planification et suivi des interventions.',
          essential: false,
          pro: true,
        },
      ],
    },
  ],
  optionsTitle: 'À chaque besoin, son extension.',
  optionsCopy:
    'Options hors abonnement et remise fidélité. Tarif confirmé avant activation.',
  optional: 'En option · tarif à confirmer',
  thirdParty:
    'Les paiements, messages WhatsApp, matériels et prestations partenaires peuvent entraîner des frais de tiers. Ils restent distincts de la remise sur l’abonnement.',
  rulesTitle: 'Vos questions, simplement.',
  rules: [
    {
      q: 'Comment fonctionne la remise par nombre de logements ?',
      a: 'Le tarif se calcule par tranches progressives. Les premiers logements gardent leur tarif ; seuls ceux de la tranche suivante bénéficient de sa remise. Le prix moyen par logement diminue ainsi avec votre parc. À partir de 50 logements, nous préparons une offre sur mesure.',
    },
    {
      q: 'Quand les baisses s’appliquent-elles ?',
      a: 'Après 3 mois complets, le tarif baisse de 10 % au 4e mois. Après 6 mois complets, la remise atteint 20 % au 7e mois. Après 12 mois complets, elle atteint 30 % au 13e mois.',
    },
    {
      q: 'Les remises se cumulent-elles ?',
      a: 'Oui : la remise de volume se calcule tranche par tranche, puis la remise de fidélité s’applique au sous-total obtenu. Les pourcentages se multiplient ; ils ne s’additionnent pas. Les paliers de durée ne se cumulent pas entre eux.',
    },
    {
      q: 'Que signifie un tarif stabilisé ?',
      a: 'Le palier de 30 % est conservé après la première année, pour une offre et un nombre de logements identiques, tant que l’abonnement reste actif. Il n’y a pas de baisse supplémentaire liée à l’ancienneté.',
    },
    {
      q: 'Faut-il payer un an à l’avance ?',
      a: 'Le modèle proposé reste mensuel, sans engagement annuel. Les remises se débloquent au fil des mois d’abonnement actif et continu. Une résiliation interrompt l’ancienneté ; les conditions de reprise seront précisées au lancement.',
    },
    {
      q: 'Et si mon activité évolue ?',
      a: 'Le simulateur garde une offre et un nombre de logements constants. Un ajout de logements ou un changement d’offre fera l’objet d’un calcul détaillé avant validation. Les règles de transfert d’ancienneté seront précisées à la souscription.',
    },
    {
      q: 'La grille est-elle déjà en vigueur ?',
      a: 'Cette page présente la proposition de tarification volume et fidélité pour le lancement. Les conditions et les éventuels frais complémentaires seront confirmés avant souscription. Le simulateur ne crée aucun abonnement.',
    },
  ],
  finalTitle: 'Construisons une relation qui dure.',
  finalCopy:
    'Choisissez les services dont vous avez besoin aujourd’hui. Votre fidélité fera le reste.',
  finalCta: 'Parler de mon projet',
};

const en: BaitlyLoyaltyMessages = {
  eyebrow: 'Pricing · Volume + loyalty',
  title: ['The longer you stay,', 'the less you pay.'],
  intro:
    'More properties, a lower average price. Plus up to 30% off as your loyalty grows.',
  explore: 'Find my plan',
  compare: 'Compare services',
  proposal:
    'Proposed launch pricing. Terms to be confirmed before subscribing.',
  promises: [
    'Your services stay included',
    'Volume + loyalty, combined',
    'Stable pricing after one year',
  ],
  simulator: 'Pricing that fits your portfolio',
  planLabel: 'Plan to simulate',
  marketLabel: 'Your market',
  markets: {
    MA: 'Morocco',
    EU: 'Europe',
    SA: 'Saudi Arabia',
  },
  properties: 'Number of properties',
  volumeTitle: 'Discount per property band',
  volumeHint: 'Each discount applies only to the properties in its band.',
  averageUnit: 'Average / property / month, excl. tax',
  totalFor: 'Total for',
  calculation: 'See the calculation',
  beforeDiscounts: 'Total before discounts',
  volumeSubtotal: 'After volume discount',
  volumeSavings: 'Volume savings',
  loyaltySavings: 'Loyalty savings',
  propertyWords: ['property', 'properties'],
  month: 'Month',
  phase: 'Explore loyalty milestones',
  periods: ['Months 1–3', 'Months 4–6', 'Months 7–12', 'From month 13'],
  milestones: [
    'Getting started',
    'After 3 months',
    'After 6 months',
    'After 12 months',
  ],
  stageCopy: [
    'Start with every service in your plan.',
    'Your first reduction, with all your features.',
    'Your loyalty earns another price reduction.',
    'You have reached the final tier. This rate stays stable.',
  ],
  base: 'Starting price',
  stable: 'Loyalty price',
  unit: '/ property / month, excl. tax',
  monthly: 'Your monthly total',
  tax: 'excl. tax / month',
  firstYear: 'Budget for the first 12 months',
  savings: 'Saved in the first year',
  savingsNote:
    'Compared with the undiscounted base rate for the same portfolio over 12 months.',
  simulationNote:
    'Simulation excludes taxes, options and third-party fees. Monthly payments, no annual prepayment. For 50 or more properties, request a custom proposal.',
  play: 'Animate the milestones',
  pause: 'Pause',
  replay: 'Replay the milestones',
  plansTitle: 'Your business. Your plan.',
  plansCopy: 'Two plans. The same volume and loyalty discounts.',
  needs: 'What is your main priority?',
  direct: 'Manage and sell direct',
  automate: 'Automate my operations',
  selected: 'Your selection',
  planDescriptions: [
    'Manage your properties. Sell direct.',
    'Everything in Essential, with AI by your side.',
  ],
  initial: 'At the start',
  later: 'After 12 months',
  planCtas: ['Choose Essential', 'Choose Pro'],
  planFits: [
    'For hands-on day-to-day management.',
    'Delegate tasks while keeping human approval.',
  ],
  planHighlights: [
    [
      'PMS & synced calendar',
      'Website, direct booking & upsells',
      'Invoicing & support',
    ],
    [
      'Every Essential service',
      'AI agents & bounded pricing',
      'Housekeeping & owner portal',
    ],
  ],
  visuals: {
    example: 'Illustrative preview',
    booking: 'Your direct booking',
    breakfast: 'Breakfast',
    confirmed: 'Stay confirmed',
    planning: 'Your central calendar',
    approved: 'AI action approved',
    captions: [
      'Your website. Your bookings. Your extras.',
      'Your properties. Your teams. One calendar.',
    ],
  },
  comparisonToggle: 'Compare Essential and Pro',
  customTitle: '50 properties or more?',
  customCopy: 'A custom plan that fits your organisation.',
  customCta: 'Discuss my project',
  comparisonTitle: 'Every service, in detail.',
  comparisonCopy:
    'Your price goes down. Every service in your plan stays included.',
  service: 'Services',
  included: 'Included',
  excluded: 'Not included',
  comparisonHint: 'On smaller screens, scroll the table horizontally.',
  groups: [
    {
      title: 'Manage & sell',
      rows: [
        {
          label: 'PMS & channel manager',
          detail: 'Bookings, calendar and channel synchronisation.',
          essential: true,
          pro: true,
        },
        {
          label: 'Booking engine & website',
          detail: 'Direct booking and templates in your own style.',
          essential: true,
          pro: true,
        },
        {
          label: 'Welcome guide & upsells',
          detail: 'Stay information, services and experiences to offer.',
          essential: true,
          pro: true,
        },
      ],
    },
    {
      title: 'Welcome & invoice',
      rows: [
        {
          label: 'Guest registration & tourist tax',
          detail: 'Your market’s processes in the same tool.',
          essential: true,
          pro: true,
        },
        {
          label: 'Compliant invoicing',
          detail: 'Documents and invoice tracking.',
          essential: true,
          pro: true,
        },
        {
          label: 'WhatsApp support',
          detail: 'A team to answer your questions.',
          essential: true,
          pro: true,
        },
      ],
    },
    {
      title: 'Automate & oversee',
      rows: [
        {
          label: 'AI agents',
          detail: 'Supervised actions with human approval.',
          essential: false,
          pro: true,
        },
        {
          label: 'Bounded automatic pricing',
          detail: 'Adjustments within limits you set.',
          essential: false,
          pro: true,
        },
        {
          label: 'Market data by city',
          detail: 'Context for your pricing decisions.',
          essential: false,
          pro: true,
        },
        {
          label: 'Owner portal & e-signature',
          detail: 'A dedicated space for owner relationships.',
          essential: false,
          pro: true,
        },
        {
          label: 'Housekeeping & photo proof',
          detail: 'Schedule and track interventions.',
          essential: false,
          pro: true,
        },
      ],
    },
  ],
  optionsTitle: 'An extension for every need.',
  optionsCopy:
    'Options exclude subscription and loyalty discounts. Price confirmed before activation.',
  optional: 'Optional · price to be confirmed',
  thirdParty:
    'Payments, WhatsApp messages, hardware and partner services may incur third-party fees. These remain separate from subscription discounts.',
  rulesTitle: 'Your questions, answered.',
  rules: [
    {
      q: 'How does the property volume discount work?',
      a: 'Pricing uses progressive bands. Earlier properties keep their rate; only the properties in the next band receive its discount. The average price per property falls as your portfolio grows. From 50 properties, we prepare a custom offer.',
    },
    {
      q: 'When do prices go down?',
      a: 'After 3 full months, your price drops by 10% in month 4. After 6 full months, the discount reaches 20% in month 7. After 12 full months, it reaches 30% in month 13.',
    },
    {
      q: 'Do the discounts stack?',
      a: 'Yes: volume discounts apply band by band, then the loyalty discount applies to that subtotal. The percentages multiply rather than add. Tenure tiers do not stack with each other.',
    },
    {
      q: 'What does stable pricing mean?',
      a: 'The 30% tier stays after year one, for the same plan and property count, as long as the subscription remains active. No further tenure-based reduction applies.',
    },
    {
      q: 'Do I have to pay for a year upfront?',
      a: 'The proposed model remains monthly, without an annual commitment. Discounts unlock after consecutive active subscription months. Cancellation interrupts tenure; restart terms will be detailed at launch.',
    },
    {
      q: 'What if my business changes?',
      a: 'The simulation assumes a constant plan and property count. Adding properties or changing plans will receive a detailed calculation before approval. Tenure transfer rules will be provided before subscribing.',
    },
    {
      q: 'Is this pricing already active?',
      a: 'This page presents proposed launch volume and loyalty pricing. Terms and any additional fees will be confirmed before subscribing. The simulator does not create a subscription.',
    },
  ],
  finalTitle: 'Build a relationship that lasts.',
  finalCopy:
    'Choose the services you need today. Your loyalty will do the rest.',
  finalCta: 'Discuss my project',
};

const ar: BaitlyLoyaltyMessages = {
  eyebrow: 'الأسعار · عدد الوحدات والوفاء',
  title: ['كلما بقيت معنا،', 'دفعت أقل.'],
  intro: 'وحدات أكثر، ومتوسط سعر أقل. وخصم إضافي حتى 30٪ مع الوفاء.',
  explore: 'اختر خطتي',
  compare: 'قارن الخدمات',
  proposal: 'أسعار مقترحة للإطلاق. تُؤكّد الشروط قبل الاشتراك.',
  promises: [
    'خدماتك تبقى مشمولة',
    'خصم العدد والوفاء معاً',
    'سعر مستقر بعد سنة',
  ],
  simulator: 'سعر يناسب حجم نشاطك',
  planLabel: 'الخطة للمحاكاة',
  marketLabel: 'سوقك',
  markets: { MA: 'المغرب', EU: 'أوروبا', SA: 'السعودية' },
  properties: 'عدد الوحدات',
  volumeTitle: 'الخصم حسب شريحة الوحدات',
  volumeHint: 'يُطبّق كل خصم فقط على الوحدات ضمن شريحته.',
  averageUnit: 'المتوسط / وحدة / شهرياً، دون ضريبة',
  totalFor: 'الإجمالي لـ',
  calculation: 'عرض تفاصيل الحساب',
  beforeDiscounts: 'الإجمالي قبل الخصومات',
  volumeSubtotal: 'بعد خصم العدد',
  volumeSavings: 'توفير العدد',
  loyaltySavings: 'توفير الوفاء',
  propertyWords: ['وحدة', 'وحدات'],
  month: 'الشهر',
  phase: 'استكشف مراحل الوفاء',
  periods: [
    'الأشهر 1 إلى 3',
    'الأشهر 4 إلى 6',
    'الأشهر 7 إلى 12',
    'من الشهر 13',
  ],
  milestones: ['عند البداية', 'بعد 3 أشهر', 'بعد 6 أشهر', 'بعد 12 شهراً'],
  stageCopy: [
    'ابدأ بكل خدمات خطتك.',
    'أول تخفيض مع الحفاظ على كل المزايا.',
    'وفاؤك يُكافأ بانخفاض جديد للسعر.',
    'وصلت إلى المرحلة النهائية. يستقر السعر عند هذا الحد.',
  ],
  base: 'سعر البداية',
  stable: 'سعر الوفاء',
  unit: '/ وحدة / شهرياً، دون ضريبة',
  monthly: 'إجمالي اشتراكك الشهري',
  tax: 'دون ضريبة / شهرياً',
  firstYear: 'ميزانية أول 12 شهراً',
  savings: 'توفير السنة الأولى',
  savingsNote:
    'مقارنةً بالسعر الأساسي دون خصومات للعدد نفسه من الوحدات طوال 12 شهراً.',
  simulationNote:
    'المحاكاة لا تشمل الضرائب والخيارات ورسوم الجهات الخارجية. دفعات شهرية دون دفع سنوي مسبق. ابتداءً من 50 وحدة، اطلب عرضاً مخصصاً.',
  play: 'شغّل عرض المراحل',
  pause: 'إيقاف مؤقت',
  replay: 'أعد عرض المراحل',
  plansTitle: 'نشاطك. خطتك.',
  plansCopy: 'خطتان. وخصومات العدد والوفاء نفسها.',
  needs: 'ما أولويتك الرئيسية؟',
  direct: 'الإدارة والبيع المباشر',
  automate: 'أتمتة الإدارة',
  selected: 'اختيارك',
  planDescriptions: [
    'أدِر وحداتك. واحجز مباشرة.',
    'كل مزايا الأساسية، والذكاء الاصطناعي إلى جانبك.',
  ],
  initial: 'عند البداية',
  later: 'بعد 12 شهراً',
  planCtas: ['اختر الأساسية', 'اختر المتقدمة'],
  planFits: [
    'للإشراف المباشر على عملك اليومي.',
    'لتفويض المهام مع الاحتفاظ بالموافقة.',
  ],
  planHighlights: [
    ['إدارة وتقويم متزامن', 'موقع وحجز مباشر وخدمات إضافية', 'فوترة ودعم'],
    [
      'كل خدمات الأساسية',
      'وكلاء ذكاء اصطناعي وتسعير بحدود',
      'تنظيف وبوابة المالك',
    ],
  ],
  visuals: {
    example: 'معاينة توضيحية',
    booking: 'حجزك المباشر',
    breakfast: 'إفطار',
    confirmed: 'إقامة مؤكدة',
    planning: 'تقويمك المركزي',
    approved: 'إجراء ذكي معتمد',
    captions: ['موقعك. حجوزاتك. خدماتك الإضافية.', 'وحداتك. فرقك. تقويم واحد.'],
  },
  comparisonToggle: 'قارن الأساسية والمتقدمة',
  customTitle: '50 وحدة أو أكثر؟',
  customCopy: 'خطة مخصصة تناسب حجم منشأتك.',
  customCta: 'ناقش مشروعي',
  comparisonTitle: 'كل الخدمات، بالتفصيل.',
  comparisonCopy: 'ينخفض السعر. وتبقى كل خدمات خطتك مشمولة.',
  service: 'الخدمات',
  included: 'مشمول',
  excluded: 'غير مشمول',
  comparisonHint: 'على الشاشات الصغيرة، مرّر الجدول أفقياً.',
  groups: [
    {
      title: 'الإدارة والبيع',
      rows: [
        {
          label: 'نظام الإدارة ومدير القنوات',
          detail: 'الحجوزات والتقويم ومزامنة القنوات.',
          essential: true,
          pro: true,
        },
        {
          label: 'محرك الحجز والموقع',
          detail: 'حجز مباشر وقوالب بهويتك.',
          essential: true,
          pro: true,
        },
        {
          label: 'دليل الاستقبال والخدمات الإضافية',
          detail: 'معلومات الإقامة وخدمات وتجارب لعرضها.',
          essential: true,
          pro: true,
        },
      ],
    },
    {
      title: 'الاستقبال والفوترة',
      rows: [
        {
          label: 'تسجيل النزلاء ورسم الإقامة',
          detail: 'إجراءات سوقك في الأداة نفسها.',
          essential: true,
          pro: true,
        },
        {
          label: 'فوترة مطابقة',
          detail: 'المستندات ومتابعة الفواتير.',
          essential: true,
          pro: true,
        },
        {
          label: 'دعم واتساب',
          detail: 'فريق يجيب عن أسئلتك.',
          essential: true,
          pro: true,
        },
      ],
    },
    {
      title: 'الأتمتة والإشراف',
      rows: [
        {
          label: 'وكلاء الذكاء الاصطناعي',
          detail: 'إجراءات تحت الإشراف وبموافقة بشرية.',
          essential: false,
          pro: true,
        },
        {
          label: 'تسعير آلي بحدود',
          detail: 'تعديلات ضمن الحدود التي تحددها.',
          essential: false,
          pro: true,
        },
        {
          label: 'بيانات السوق حسب المدينة',
          detail: 'مؤشرات لقراراتك التسعيرية.',
          essential: false,
          pro: true,
        },
        {
          label: 'بوابة المالك والتوقيع الإلكتروني',
          detail: 'مساحة مخصصة للعلاقة مع المالكين.',
          essential: false,
          pro: true,
        },
        {
          label: 'التنظيف والإثبات المصوّر',
          detail: 'جدولة التدخلات ومتابعتها.',
          essential: false,
          pro: true,
        },
      ],
    },
  ],
  optionsTitle: 'إضافة لكل احتياج.',
  optionsCopy: 'خيارات خارج الاشتراك وخصم الوفاء. يُؤكّد السعر قبل التفعيل.',
  optional: 'اختياري · السعر يُحدّد لاحقاً',
  thirdParty:
    'قد تترتب رسوم خارجية على المدفوعات ورسائل واتساب والأجهزة وخدمات الشركاء. تبقى هذه الرسوم منفصلة عن خصم الاشتراك.',
  rulesTitle: 'إجابات عن أسئلتك.',
  rules: [
    {
      q: 'كيف يعمل الخصم حسب عدد الوحدات؟',
      a: 'يُحسب السعر بشرائح تصاعدية. تحتفظ الوحدات الأولى بسعرها، ويُطبّق خصم الشريحة التالية على وحداتها فقط. ينخفض متوسط سعر الوحدة مع نمو نشاطك. ابتداءً من 50 وحدة نقدّم عرضاً مخصصاً.',
    },
    {
      q: 'متى تنخفض الأسعار؟',
      a: 'بعد 3 أشهر كاملة ينخفض السعر 10٪ في الشهر الرابع. وبعد 6 أشهر كاملة يصل الخصم إلى 20٪ في الشهر السابع. وبعد 12 شهراً كاملاً يصل إلى 30٪ في الشهر الثالث عشر.',
    },
    {
      q: 'هل تتراكم الخصومات؟',
      a: 'نعم: يُحسب خصم العدد لكل شريحة، ثم يُطبّق خصم الوفاء على المجموع الناتج. تُضرب النسب ولا تُجمع. ولا تتراكم مراحل الوفاء فيما بينها.',
    },
    {
      q: 'ماذا يعني استقرار السعر؟',
      a: 'تستمر مرحلة خصم 30٪ بعد السنة الأولى للخطة نفسها وعدد الوحدات نفسه ما دام الاشتراك نشطاً. لا يوجد انخفاض إضافي مرتبط بالأقدمية.',
    },
    {
      q: 'هل يجب دفع السنة مسبقاً؟',
      a: 'النموذج المقترح شهري دون التزام سنوي. تُفتح الخصومات بعد أشهر اشتراك نشطة ومتواصلة. الإلغاء يقطع الأقدمية، وستُوضَّح شروط العودة عند الإطلاق.',
    },
    {
      q: 'ماذا لو تطوّر نشاطي؟',
      a: 'تفترض المحاكاة ثبات الخطة وعدد الوحدات. تُقدَّم تفاصيل الحساب قبل اعتماد أي إضافة وحدات أو تغيير خطة. ستُوضَّح قواعد نقل الأقدمية قبل الاشتراك.',
    },
    {
      q: 'هل الأسعار سارية الآن؟',
      a: 'تعرض الصفحة مقترح أسعار العدد والوفاء للإطلاق. تُؤكّد الشروط والرسوم الإضافية قبل الاشتراك. المحاكاة لا تنشئ اشتراكاً.',
    },
  ],
  finalTitle: 'لنبنِ علاقة تدوم.',
  finalCopy: 'اختر الخدمات التي تحتاج إليها اليوم. وفاؤك يتكفّل بالباقي.',
  finalCta: 'ناقش مشروعي',
};

export const BAITLY_LOYALTY_MESSAGES: Record<
  SiteLanguage,
  BaitlyLoyaltyMessages
> = { fr, en, ar };
