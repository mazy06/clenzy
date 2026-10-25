import type { SiteLanguage } from './siteLanguage';

export const SITE_ORIGIN = 'https://baitly.fr';

export const canonicalPath = (path: string) =>
  path === '/pre-lancement' ? '/bientot-disponible' : path;

/**
 * Query string for an internal link. French, the default language, stays
 * parameter-free: links to `?lang=fr` led Google to index those duplicates and
 * override the canonical URL.
 */
export const langQuery = (language: SiteLanguage) =>
  language === 'fr' ? '' : `?lang=${language}`;

export const canonicalUrl = (path: string, language: SiteLanguage = 'fr') =>
  `${SITE_ORIGIN}${canonicalPath(path)}${langQuery(language)}`;

export const robotsDirective = (index: boolean, video = false) =>
  index
    ? `index, follow, max-image-preview:large${video ? ', max-video-preview:-1' : ''}`
    : 'noindex, follow';

/** Only canonical editorial pages belong in the search sitemap. */
export const isIndexablePath = (path: string) =>
  !path.startsWith('/legal/') &&
  ![
    '/404',
    '/inscription',
    '/register',
    '/prestataires/inscription',
    '/prestataires/activation',
    '/campagnes/reponse',
  ].includes(path);

export const HOME_SEARCH = {
  fr: {
    title: 'Logiciel de location saisonnière et conciergerie | Baitly',
    description:
      'PMS, channel manager et agents IA pour gérer vos locations saisonnières au Maroc, en France et en Arabie saoudite. Guides locaux et ressources pour les hôtes.',
  },
  en: {
    title: 'Vacation rental and property management software | Baitly',
    description:
      'PMS, channel manager and AI agents for vacation rentals in Morocco, France and Saudi Arabia. Country guides and practical resources for hosts.',
  },
  ar: {
    title: 'برنامج إدارة الإيجارات السياحية والضيافة | Baitly',
    description:
      'نظام إدارة عقارات ومدير قنوات ووكلاء ذكاء اصطناعي للإيجارات السياحية في السعودية والمغرب وفرنسا. أدلة محلية وموارد عملية للمضيفين.',
  },
} satisfies Record<SiteLanguage, { title: string; description: string }>;

type SearchSnippet = { title: string; description?: string };

/**
 * Search titles for commercial pages. Their visible H1 is a slogan that
 * nobody searches for; the <title> carries the query instead, keyword first
 * so it survives truncation at ~60 characters. Pages missing here keep the
 * title derived from their H1 (articles, episodes already read as queries).
 */
export const PAGE_SEARCH: Record<SiteLanguage, Record<string, SearchSnippet>> = {
  fr: {
    '/produit/pms-channel-manager': {
      title: 'PMS et channel manager Airbnb, Booking.com | Baitly',
      description:
        'Synchronisez Airbnb, Booking.com et vos réservations directes dans un seul calendrier. PMS et channel manager pour locations saisonnières en France, au Maroc et en Arabie saoudite.',
    },
    '/produit/booking-engine': {
      title: 'Moteur de réservation et site de réservation directe | Baitly',
      description:
        'Créez votre site de réservation directe sans commission : templates prêts à personnaliser, moteur embarquable, panier multi-séjours et paiement en ligne.',
    },
    '/produit/livret-accueil': {
      title: 'Livret d’accueil numérique pour location saisonnière | Baitly',
    },
    '/produit/agents-ia': {
      title: 'Agents IA pour la gestion de locations saisonnières | Baitly',
    },
    '/produit/revenue-market-data': {
      title: 'Tarification dynamique et données de marché | Baitly',
    },
    '/produit/paiements-finances': {
      title: 'Paiements, facturation et reversements propriétaires | Baitly',
    },
    '/produit/operations-menage': {
      title: 'Planning ménage et interventions en location courte durée | Baitly',
    },
    '/produit/objets-connectes': {
      title: 'Serrures connectées et capteurs pour location saisonnière | Baitly',
    },
    '/produit/portail-proprietaire': {
      title: 'Portail propriétaire pour conciergerie | Baitly',
    },
    '/solutions': {
      title: 'Logiciel pour hôtes, conciergeries et maisons d’hôtes | Baitly',
    },
    '/tarifs': {
      title: 'Tarifs du logiciel de location saisonnière | Baitly',
      description:
        'Prix du PMS et channel manager Baitly par logement : plus vous avez de logements, plus le prix moyen baisse, et jusqu’à −30 % supplémentaires avec l’ancienneté.',
    },
    '/migration': {
      title: 'Changer de logiciel de location saisonnière | Baitly',
    },
    '/comparer': {
      title: 'Comparer les logiciels de gestion locative saisonnière | Baitly',
    },
    '/ressources/calculateur': {
      title: 'Calculateur de rentabilité location saisonnière | Baitly',
    },
    '/ressources/barometre': {
      title: 'Baromètre des nuitées touristiques au Maroc | Baitly',
    },
    '/ressources/obligations': {
      title: 'Réglementation de la location saisonnière par pays | Baitly',
    },
    '/ressources/academie': {
      title: 'Formation location saisonnière gratuite en vidéo | Baitly',
    },
    '/ressources/blog': {
      title: 'Blog location saisonnière et conciergerie | Baitly',
    },
    '/ressources/glossaire': {
      title: 'Glossaire de la location saisonnière (FR, EN, AR) | Baitly',
    },
    '/conciergeries': {
      title: 'Trouver une conciergerie Airbnb et location saisonnière | Baitly',
    },
    '/prestataires': {
      title: 'Ménage et maintenance : missions en location courte durée | Baitly',
    },
    '/demo': { title: 'Demander une démo du logiciel Baitly' },
    '/maroc': {
      title: 'Logiciel de location saisonnière au Maroc | Baitly',
      description:
        'PMS et channel manager pour riads, maisons d’hôtes et appartements au Maroc : Airbnb et Booking.com synchronisés, fiche de police DGSN, taxe de séjour et montants en dirhams.',
    },
    '/arabie-saoudite': {
      title: 'Logiciel de gestion de locations en Arabie saoudite | Baitly',
      description:
        'PMS et channel manager pour unités de séjour privées en Arabie saoudite : déclaration Shomoos, facture ZATCA, TVA 15 %, calendrier hégirien et interface en arabe.',
    },
    '/france': {
      title: 'Logiciel de location saisonnière et conciergerie en France | Baitly',
      description:
        'PMS et channel manager pour meublés de tourisme et conciergeries : Airbnb et Booking.com synchronisés, plafond de 120 nuits, taxe de séjour, fiche de police et Factur-X.',
    },
  },
  en: {
    '/produit/pms-channel-manager': {
      title: 'PMS and channel manager for Airbnb, Booking.com | Baitly',
      description:
        'Sync Airbnb, Booking.com and direct bookings in one calendar. PMS and channel manager for vacation rentals in Saudi Arabia, Morocco and France.',
    },
    '/produit/booking-engine': {
      title: 'Booking engine and direct booking website | Baitly',
      description:
        'Launch a commission-free direct booking website: ready-made templates, an embeddable booking engine, multi-stay cart and online payment.',
    },
    '/produit/livret-accueil': {
      title: 'Digital guidebook for vacation rentals | Baitly',
    },
    '/produit/agents-ia': {
      title: 'AI agents for vacation rental management | Baitly',
    },
    '/produit/revenue-market-data': {
      title: 'Dynamic pricing and market data | Baitly',
    },
    '/produit/paiements-finances': {
      title: 'Payments, invoicing and owner payouts | Baitly',
    },
    '/produit/operations-menage': {
      title: 'Cleaning schedule and turnover management | Baitly',
    },
    '/produit/objets-connectes': {
      title: 'Smart locks and sensors for short-term rentals | Baitly',
    },
    '/produit/portail-proprietaire': {
      title: 'Owner portal for property managers | Baitly',
    },
    '/solutions': {
      title: 'Software for hosts, property managers and guesthouses | Baitly',
    },
    '/tarifs': {
      title: 'Vacation rental software pricing | Baitly',
    },
    '/migration': {
      title: 'Switch your vacation rental software | Baitly',
    },
    '/comparer': {
      title: 'Compare vacation rental management software | Baitly',
    },
    '/ressources/calculateur': {
      title: 'Vacation rental profitability calculator | Baitly',
    },
    '/ressources/barometre': {
      title: 'Morocco tourism overnight stays barometer | Baitly',
    },
    '/ressources/obligations': {
      title: 'Vacation rental regulations by country | Baitly',
    },
    '/ressources/academie': {
      title: 'Free vacation rental video training | Baitly',
    },
    '/ressources/blog': {
      title: 'Vacation rental and property management blog | Baitly',
    },
    '/ressources/glossaire': {
      title: 'Vacation rental glossary (EN, FR, AR) | Baitly',
    },
    '/conciergeries': {
      title: 'Find a vacation rental property manager | Baitly',
    },
    '/prestataires': {
      title: 'Cleaning and maintenance jobs in short-term rentals | Baitly',
    },
    '/demo': { title: 'Book a Baitly software demo' },
    '/maroc': {
      title: 'Vacation rental software in Morocco | Baitly',
      description:
        'PMS and channel manager for riads, guesthouses and apartments in Morocco: Airbnb and Booking.com synced, DGSN police records, tourist tax and amounts in dirhams.',
    },
    '/arabie-saoudite': {
      title: 'Vacation rental management software in Saudi Arabia | Baitly',
      description:
        'PMS and channel manager for private hospitality units in Saudi Arabia: Shomoos declarations, ZATCA invoices, 15% VAT, Hijri calendar and an Arabic interface.',
    },
    '/france': {
      title: 'Vacation rental software in France | Baitly',
      description:
        'PMS and channel manager for tourist rentals and property managers in France: Airbnb and Booking.com synced, 120-night cap, tourist tax, police records and Factur-X.',
    },
  },
  ar: {
    '/produit/pms-channel-manager': {
      title: 'نظام إدارة العقارات ومدير القنوات لـ Airbnb وBooking.com | Baitly',
      description:
        'زامن Airbnb وBooking.com وحجوزاتك المباشرة في تقويم واحد. نظام إدارة عقارات ومدير قنوات للإيجارات السياحية في السعودية والمغرب وفرنسا.',
    },
    '/produit/booking-engine': {
      title: 'محرك حجز وموقع للحجز المباشر بدون عمولة | Baitly',
    },
    '/produit/livret-accueil': {
      title: 'دليل ترحيب رقمي للإيجارات السياحية | Baitly',
    },
    '/produit/agents-ia': {
      title: 'وكلاء ذكاء اصطناعي لإدارة الإيجارات السياحية | Baitly',
    },
    '/produit/revenue-market-data': {
      title: 'التسعير الديناميكي وبيانات السوق | Baitly',
    },
    '/produit/paiements-finances': {
      title: 'المدفوعات والفوترة وتحويلات الملاك | Baitly',
    },
    '/produit/operations-menage': {
      title: 'جدولة التنظيف والصيانة بين الإقامات | Baitly',
    },
    '/produit/objets-connectes': {
      title: 'الأقفال الذكية وأجهزة الاستشعار للإيجار قصير المدى | Baitly',
    },
    '/produit/portail-proprietaire': {
      title: 'بوابة الملاك لشركات إدارة العقارات | Baitly',
    },
    '/solutions': {
      title: 'برنامج للمضيفين وشركات إدارة الشقق المفروشة | Baitly',
    },
    '/tarifs': {
      title: 'أسعار برنامج إدارة الشقق المفروشة والإيجار السياحي | Baitly',
    },
    '/migration': {
      title: 'الانتقال إلى برنامج جديد لإدارة الإيجارات السياحية | Baitly',
    },
    '/comparer': {
      title: 'مقارنة برامج إدارة الإيجارات السياحية | Baitly',
    },
    '/ressources/calculateur': {
      title: 'حاسبة ربحية الإيجار السياحي | Baitly',
    },
    '/ressources/barometre': {
      title: 'مؤشر الليالي السياحية في المغرب | Baitly',
    },
    '/ressources/obligations': {
      title: 'أنظمة الإيجار السياحي حسب الدولة | Baitly',
    },
    '/ressources/academie': {
      title: 'تدريب مجاني بالفيديو على إدارة الإيجار السياحي | Baitly',
    },
    '/ressources/blog': {
      title: 'مدونة الإيجار السياحي وإدارة الشقق المفروشة | Baitly',
    },
    '/ressources/glossaire': {
      title: 'معجم مصطلحات الإيجار السياحي | Baitly',
    },
    '/conciergeries': {
      title: 'ابحث عن شركة لإدارة الشقق المفروشة | Baitly',
    },
    '/prestataires': {
      title: 'وظائف التنظيف والصيانة في الإيجار قصير المدى | Baitly',
    },
    '/demo': { title: 'اطلب عرضاً تجريبياً لبرنامج Baitly' },
    '/maroc': {
      title: 'برنامج إدارة الإيجارات السياحية في المغرب | Baitly',
      description:
        'نظام إدارة عقارات ومدير قنوات للرياض ودور الضيافة والشقق في المغرب: مزامنة Airbnb وBooking.com، وبطاقة الشرطة، ورسم الإقامة، ومبالغ بالدرهم.',
    },
    '/arabie-saoudite': {
      title: 'برنامج إدارة الشقق المفروشة في السعودية | Baitly',
      description:
        'نظام إدارة عقارات ومدير قنوات لوحدات الضيافة الخاصة في السعودية: التسجيل في شموس، وفاتورة هيئة الزكاة والضريبة والجمارك، وضريبة 15 %، وتقويم هجري، وواجهة عربية.',
    },
    '/france': {
      title: 'برنامج إدارة الإيجارات السياحية في فرنسا | Baitly',
      description:
        'نظام إدارة عقارات ومدير قنوات للمساكن السياحية وشركات الإدارة في فرنسا: مزامنة Airbnb وBooking.com، وسقف 120 ليلة، ورسم الإقامة، وفاتورة Factur-X.',
    },
  },
};
