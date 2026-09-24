import type { SiteLanguage } from '../siteLanguage';

interface TemplateCopy {
  category: string;
  tagline: string;
  description: string;
  location: string;
  stay: string;
  steps: [string, string, string, string];
  notes: [string, string, string, string];
  extras: [string, string];
}

export interface BaitlyBookingMessages {
  eyebrow: string;
  title: [string, string];
  intro: string;
  explore: string;
  cta: string;
  promises: [string, string, string];
  galleryLabel: string;
  galleryTitle: string;
  galleryCopy: string;
  choose: string;
  demo: string;
  play: string;
  pause: string;
  replay: string;
  previous: string;
  next: string;
  selected: string;
  dates: string;
  guests: string;
  arrival: string;
  departure: string;
  dateRange: string;
  guestCount: string;
  availability: string;
  room: string;
  destination: string;
  firstStay: string;
  secondStay: string;
  cartTitle: string;
  templateCount: string;
  month: string;
  extrasTitle: string;
  extrasCopy: string;
  add: string;
  added: string;
  stayLabel: string;
  extrasLabel: string;
  total: string;
  confirmation: string;
  confirmationCopy: string;
  recap: string;
  saleNote: string;
  caption: string;
  finalTitle: string;
  finalCopy: string;
  pricing: string;
  faq: string;
  templates: [TemplateCopy, TemplateCopy, TemplateCopy];
}

const fr: BaitlyBookingMessages = {
  eyebrow: 'Booking engine & sites',
  title: ['Un site qui donne envie.', 'Un séjour qui vaut plus.'],
  intro:
    'Votre site, vos réservations directes et bien plus qu’une nuitée. Proposez un chef privé, un départ tardif ou une activité locale : vos voyageurs composent leur séjour, vos services font grandir le panier.',
  explore: 'Explorer les templates',
  cta: 'Créer mon booking engine',
  promises: ['À votre image', 'Réservation directe', 'Upsells intégrés'],
  galleryLabel: 'Du premier regard au séjour réservé',
  galleryTitle: 'À chaque hébergement, son parcours.',
  galleryCopy:
    'Choisissez un univers et glissez-vous à la place du voyageur. Découvrez comment le site accompagne sa réservation et lui donne envie d’ajouter un service.',
  choose: 'Choisir un exemple de template',
  demo: 'Démo interactive',
  play: 'Lire le parcours',
  pause: 'Mettre en pause',
  replay: 'Rejouer le parcours',
  previous: 'Étape précédente',
  next: 'Étape suivante',
  selected: 'Sélectionné',
  dates: 'Vos dates',
  guests: 'Voyageurs',
  arrival: 'Arrivée',
  departure: 'Départ',
  dateRange: '12 → 15 octobre',
  guestCount: '2 adultes',
  availability: 'Voir les disponibilités',
  room: 'Suite Patio',
  destination: 'Une adresse, puis une autre.',
  firstStay: 'Agafay · 2 nuits',
  secondStay: 'Maison Zayna · 1 nuit',
  cartTitle: 'Deux étapes, un seul panier.',
  templateCount: '3 univers à explorer',
  month: 'octobre',
  extrasTitle: 'Et si vous en profitiez un peu plus ?',
  extrasCopy: 'Les petites attentions, avant même votre arrivée.',
  add: 'Ajouter',
  added: 'Ajouté',
  stayLabel: 'Hébergement',
  extrasLabel: 'Services ajoutés',
  total: 'Total du séjour',
  confirmation: 'Votre escapade prend forme.',
  confirmationCopy:
    'Le séjour et les services se retrouvent dans une seule réservation.',
  recap: 'Votre séjour',
  saleNote: 'de services dans ce panier',
  caption:
    'Maquettes de démonstration. Hébergements, disponibilités et montants illustratifs en euros ; aucune réservation ni aucun paiement réel. Les options dépendent de votre catalogue.',
  finalTitle: 'Votre prochaine réservation peut commencer ici.',
  finalCopy:
    'Un template à personnaliser, votre catalogue à proposer, une relation directe avec vos voyageurs.',
  pricing: 'Voir les tarifs',
  faq: 'Avant de vous lancer',
  templates: [
    {
      category: 'Riad & maison d’hôtes',
      tagline: 'L’hospitalité, dès le premier clic.',
      description:
        'Une chambre coup de cœur, puis les attentions qui rendent le séjour unique.',
      location: 'Marrakech, Maroc',
      stay: 'Suite Patio · 3 nuits',
      steps: ['La chambre', 'Les dates', 'Les attentions', 'La réservation'],
      notes: [
        'La photo donne envie, la chambre devient le point de départ.',
        'Les dates et les voyageurs donnent le cadre du séjour.',
        'Le dîner et le transfert se proposent avant de finaliser.',
        'Un récapitulatif rassemble la chambre et les services choisis.',
      ],
      extras: ['Dîner pour deux', 'Transfert aéroport'],
    },
    {
      category: 'Villa & séjour privé',
      tagline: 'Quelques jours, rien qu’à vous.',
      description:
        'Les dates d’abord, la villa ensuite. Les services complètent l’évasion.',
      location: 'Marrakech, Maroc',
      stay: 'Villa privatisée · 3 nuits',
      steps: ['Les dates', 'La villa', 'Les services', 'La réservation'],
      notes: [
        'Le voyageur commence par les dates de son escapade.',
        'La villa se dévoile avec son tarif pour le séjour.',
        'Un dîner privé ou un départ tardif enrichit la réservation.',
        'La villa et les services sont réunis dans le récapitulatif.',
      ],
      extras: ['Dîner avec chef privé', 'Départ tardif'],
    },
    {
      category: 'Conciergerie & collection',
      tagline: 'Plus d’adresses. Un seul voyage.',
      description:
        'Plusieurs logements à découvrir et des séjours à réunir dans un panier.',
      location: 'Agafay & Marrakech, Maroc',
      stay: '2 adresses · 3 nuits',
      steps: ['Les adresses', 'Le panier', 'Les expériences', 'La réservation'],
      notes: [
        'Une collection permet de découvrir plusieurs adresses.',
        'Deux étapes du voyage se retrouvent dans le même panier.',
        'Un transfert ou un dîner accompagne ce parcours multi-séjours.',
        'Une vue d’ensemble pour les hébergements et leurs options.',
      ],
      extras: ['Transfert entre les adresses', 'Dîner de bienvenue'],
    },
  ],
};

const en: BaitlyBookingMessages = {
  eyebrow: 'Booking engine & websites',
  title: ['A site that inspires.', 'A stay that offers more.'],
  intro:
    'Your website, your direct bookings and more than a place to stay. Offer a private chef, late checkout or a local activity: guests shape their stay and your services add value to their booking.',
  explore: 'Explore the templates',
  cta: 'Create my booking engine',
  promises: ['Your own identity', 'Direct bookings', 'Built-in upsells'],
  galleryLabel: 'From first impression to booked stay',
  galleryTitle: 'A journey for every property.',
  galleryCopy:
    'Choose a style and step into your guest’s shoes. See how the website guides their booking and invites them to add a service.',
  choose: 'Choose a template example',
  demo: 'Interactive demo',
  play: 'Play the journey',
  pause: 'Pause',
  replay: 'Replay the journey',
  previous: 'Previous step',
  next: 'Next step',
  selected: 'Selected',
  dates: 'Your dates',
  guests: 'Guests',
  arrival: 'Check-in',
  departure: 'Check-out',
  dateRange: '12 → 15 October',
  guestCount: '2 adults',
  availability: 'Check availability',
  room: 'Patio suite',
  destination: 'One address, then another.',
  firstStay: 'Agafay · 2 nights',
  secondStay: 'Maison Zayna · 1 night',
  cartTitle: 'Two stops, one cart.',
  templateCount: '3 styles to explore',
  month: 'October',
  extrasTitle: 'Make a little more of your stay.',
  extrasCopy: 'Thoughtful touches, before you even arrive.',
  add: 'Add',
  added: 'Added',
  stayLabel: 'Accommodation',
  extrasLabel: 'Added services',
  total: 'Stay total',
  confirmation: 'Your getaway is taking shape.',
  confirmationCopy:
    'Your stay and chosen services come together in one booking.',
  recap: 'Your stay',
  saleNote: 'in services in this cart',
  caption:
    'Illustrative mockups. Sample properties, availability and prices in euros; no actual bookings or payments. Options depend on your catalogue.',
  finalTitle: 'Your next direct booking can start here.',
  finalCopy:
    'A template to personalise, your catalogue to share, a direct relationship with your guests.',
  pricing: 'View pricing',
  faq: 'Before you begin',
  templates: [
    {
      category: 'Riad & guesthouse',
      tagline: 'Hospitality from the first click.',
      description:
        'A favourite room, then the touches that make a stay special.',
      location: 'Marrakech, Morocco',
      stay: 'Patio suite · 3 nights',
      steps: ['The room', 'The dates', 'The extras', 'The booking'],
      notes: [
        'A room and its photography start the journey.',
        'Dates and guests set the scene for the stay.',
        'Dinner and transfers appear before checkout.',
        'One summary brings the room and selected services together.',
      ],
      extras: ['Dinner for two', 'Airport transfer'],
    },
    {
      category: 'Villa & private stay',
      tagline: 'A few days, all to yourself.',
      description:
        'Dates first, then the villa. Services complete the getaway.',
      location: 'Marrakech, Morocco',
      stay: 'Private villa · 3 nights',
      steps: ['The dates', 'The villa', 'The services', 'The booking'],
      notes: [
        'Guests begin with their getaway dates.',
        'The villa appears with its stay price.',
        'A private dinner or late check-out adds to the booking.',
        'The villa and services appear in one summary.',
      ],
      extras: ['Private chef dinner', 'Late check-out'],
    },
    {
      category: 'Property collection',
      tagline: 'More addresses. One journey.',
      description: 'A collection to discover and several stays in one cart.',
      location: 'Agafay & Marrakech, Morocco',
      stay: '2 addresses · 3 nights',
      steps: ['The addresses', 'The cart', 'The experiences', 'The booking'],
      notes: [
        'A collection opens up several places to stay.',
        'Two stops on the journey share a single cart.',
        'A transfer or dinner adds to a multi-stay journey.',
        'One overview of properties and their options.',
      ],
      extras: ['Transfer between properties', 'Welcome dinner'],
    },
  ],
};

const ar: BaitlyBookingMessages = {
  eyebrow: 'محرك الحجز والمواقع',
  title: ['موقع يدعو للاكتشاف.', 'وإقامة بقيمة أكبر.'],
  intro:
    'موقعك وحجوزاتك المباشرة وأكثر من مجرد ليلة. اقترح طاهياً خاصاً أو مغادرة متأخرة أو نشاطاً محلياً: يصمّم الضيف إقامته، وتزيد خدماتك قيمة الحجز.',
  explore: 'اكتشف القوالب',
  cta: 'أنشئ محرك الحجز الخاص بي',
  promises: ['بهويتك الخاصة', 'حجوزات مباشرة', 'خدمات إضافية مدمجة'],
  galleryLabel: 'من النظرة الأولى إلى حجز الإقامة',
  galleryTitle: 'لكل مكان، رحلة حجز تناسبه.',
  galleryCopy:
    'اختر تصميماً وجرّب الرحلة من منظور الضيف. اكتشف كيف يرافقه الموقع في الحجز ويشجعه على إضافة خدمة.',
  choose: 'اختر نموذج قالب',
  demo: 'عرض تفاعلي',
  play: 'شغّل رحلة الحجز',
  pause: 'إيقاف مؤقت',
  replay: 'أعد تشغيل الرحلة',
  previous: 'الخطوة السابقة',
  next: 'الخطوة التالية',
  selected: 'محدد',
  dates: 'تواريخ إقامتك',
  guests: 'الضيوف',
  arrival: 'الوصول',
  departure: 'المغادرة',
  dateRange: 'من 12 إلى 15 أكتوبر',
  guestCount: 'شخصان بالغان',
  availability: 'عرض التوافر',
  room: 'جناح الفناء',
  destination: 'عنوان، ثم عنوان آخر.',
  firstStay: 'أكافاي · ليلتان',
  secondStay: 'Maison Zayna · ليلة واحدة',
  cartTitle: 'محطتان، سلة واحدة.',
  templateCount: '3 تصاميم للاكتشاف',
  month: 'أكتوبر',
  extrasTitle: 'ماذا لو استمتعت بإقامتك أكثر؟',
  extrasCopy: 'لمسات مميزة، حتى قبل وصولك.',
  add: 'أضف',
  added: 'تمت الإضافة',
  stayLabel: 'الإقامة',
  extrasLabel: 'الخدمات المضافة',
  total: 'إجمالي الإقامة',
  confirmation: 'رحلتك بدأت تتشكل.',
  confirmationCopy: 'إقامتك والخدمات المختارة تجتمع في حجز واحد.',
  recap: 'إقامتك',
  saleNote: 'قيمة الخدمات في هذه السلة',
  caption:
    'نماذج توضيحية. أماكن الإقامة والتوافر والأسعار باليورو أمثلة فقط، دون حجز أو دفع فعلي. تعتمد الخيارات على كتالوجك.',
  finalTitle: 'حجزك المباشر القادم قد يبدأ هنا.',
  finalCopy: 'قالب تخصصه، وكتالوج تعرضه، وعلاقة مباشرة مع ضيوفك.',
  pricing: 'عرض الأسعار',
  faq: 'قبل أن تبدأ',
  templates: [
    {
      category: 'رياض ودار ضيافة',
      tagline: 'الضيافة، من النقرة الأولى.',
      description: 'غرفة مفضلة، ثم لمسات تجعل الإقامة مميزة.',
      location: 'مراكش، المغرب',
      stay: 'جناح الفناء · 3 ليالٍ',
      steps: ['الغرفة', 'التواريخ', 'الإضافات', 'الحجز'],
      notes: [
        'صورة الغرفة تمنح الرغبة وتبدأ رحلة الحجز.',
        'التواريخ والضيوف يحددون تفاصيل الإقامة.',
        'يُعرض العشاء والنقل قبل إتمام الحجز.',
        'ملخص واحد يجمع الغرفة والخدمات المختارة.',
      ],
      extras: ['عشاء لشخصين', 'نقل من المطار'],
    },
    {
      category: 'فيلا وإقامة خاصة',
      tagline: 'أيام قليلة، لك وحدك.',
      description: 'التواريخ أولاً، ثم الفيلا. والخدمات تكمل الرحلة.',
      location: 'مراكش، المغرب',
      stay: 'فيلا خاصة · 3 ليالٍ',
      steps: ['التواريخ', 'الفيلا', 'الخدمات', 'الحجز'],
      notes: [
        'يبدأ الضيف بتواريخ رحلته.',
        'تظهر الفيلا مع سعر الإقامة.',
        'عشاء خاص أو مغادرة متأخرة لإثراء الحجز.',
        'الفيلا والخدمات في ملخص واحد.',
      ],
      extras: ['عشاء مع طاهٍ خاص', 'مغادرة متأخرة'],
    },
    {
      category: 'مجموعة أماكن إقامة',
      tagline: 'عناوين أكثر. رحلة واحدة.',
      description: 'أماكن متعددة للاكتشاف وإقامات تجتمع في سلة واحدة.',
      location: 'أكافاي ومراكش، المغرب',
      stay: 'عنوانان · 3 ليالٍ',
      steps: ['العناوين', 'السلة', 'التجارب', 'الحجز'],
      notes: [
        'مجموعة تتيح اكتشاف عدة أماكن للإقامة.',
        'محطتان من الرحلة تجتمعان في سلة واحدة.',
        'نقل أو عشاء يكمل رحلة الإقامات المتعددة.',
        'نظرة شاملة على أماكن الإقامة وخياراتها.',
      ],
      extras: ['نقل بين مكانَي الإقامة', 'عشاء ترحيبي'],
    },
  ],
};

export const BAITLY_BOOKING_MESSAGES: Record<
  SiteLanguage,
  BaitlyBookingMessages
> = { fr, en, ar };
