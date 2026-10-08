import type { SiteLanguage } from '../siteLanguage';

/**
 * Texte des neuf modules produit.
 *
 * <p>Clé de voute : ces libelles alimentent le mega-menu Produit, les colonnes
 * du pied de page ET les pages `/produit/:slug`. Tant qu'ils restaient
 * francais, ouvrir le menu sur une page arabe suffisait a rompre la
 * promesse.</p>
 *
 * <p>La STRUCTURE (slug, icone, valeur du chiffre) reste dans `catalog.tsx` :
 * elle ne depend pas de la langue. Seul le texte vit ici.</p>
 */
export interface ModuleText {
  name: string;
  menuCopy: string;
  heroTitle: string;
  heroCopy: string;
  metricLabel: string;
  features: ReadonlyArray<{ title: string; copy: string }>;
  faq: ReadonlyArray<{ q: string; a: string }>;
}

const fr: Record<string, ModuleText> = {
  'pms-channel-manager': {
    name: 'PMS & Channel manager',
    menuCopy: 'Calendrier multi-biens, réservations, synchronisation OTA en continu.',
    heroTitle: 'Tous vos calendriers, une seule vérité.',
    heroCopy:
      'Airbnb, Booking.com et vos réservations directes synchronisés en continu (ARI via Channex). Les disponibilités sont centralisées pour limiter les conflits de réservation.',
    metricLabel: 'double booking par conception — absence de ligne = disponible',
    features: [
      { title: 'Planning multi-propriétés', copy: 'Blocs colorés par statut, occupation par jour, drag & drop des séjours.' },
      { title: 'Synchronisation ARI', copy: 'Tarifs, disponibilités et restrictions poussés en continu vers les canaux.' },
      { title: 'Réservations unifiées', copy: 'OTA, direct et imports iCal dans une seule liste, avec cycle de vie complet.' },
      { title: 'Filet iCal', copy: 'Mode dégradé universel pendant les transitions — jamais de trou de couverture.' },
    ],
    faq: [
      { q: 'Combien de canaux sont couverts ?', a: 'Airbnb et Booking.com en connexion native via Channex, plus tout canal compatible iCal (Vrbo, Abritel…).' },
      { q: 'Que se passe-t-il si un canal tombe ?', a: 'L’Agent Distribution détecte les conflits de synchronisation et vous alerte avant qu’un double booking n’arrive.' },
    ],
  },
  'booking-engine': {
    name: 'Booking engine & sites',
    menuCopy: 'Votre site de réservation directe, sans commission, avec templates.',
    heroTitle: 'Vos réservations directes, sans commission.',
    heroCopy:
      'Un moteur de réservation embarquable sur n’importe quel site, une galerie de templates prêts à personnaliser, un panier multi-séjours et le paiement intégré.',
    metricLabel: 'de commission sur vos réservations directes',
    features: [
      { title: 'Widget embarquable', copy: 'Recherche par dates, calendrier 2 mois avec prix par nuit, multi-langue FR/EN/AR avec RTL.' },
      { title: 'Galerie de templates', copy: 'Des sites complets prêts à instancier, personnalisables dans le Studio no-code.' },
      { title: 'Panier multi-séjours', copy: 'Plusieurs logements et dates dans une seule réservation payée en une fois.' },
      { title: 'Relance de panier', copy: 'Les paniers abandonnés sont relancés automatiquement par email.' },
    ],
    faq: [
      { q: 'Puis-je utiliser mon site existant ?', a: 'Oui — le widget s’intègre en une balise script sur WordPress, Wix ou tout site HTML.' },
      { q: 'Le paiement est-il inclus ?', a: 'Stripe est raccordé pour la France. Les prestataires de paiement pour le Maroc et l’Arabie saoudite sont en cours de sélection.' },
    ],
  },
  'livret-accueil': {
    name: 'Livret d’accueil & expériences',
    menuCopy: 'Livret numérique, upsells et marketplace d’activités — nouveaux revenus par commission.',
    heroTitle: 'Le voyage parfait pour vos voyageurs. De nouveaux revenus pour vous.',
    heroCopy:
      'Un livret d’accueil numérique qui organise tout le séjour — arrivée, recommandations, activités locales et services à domicile — et fait naître un revenu additionnel à chaque réservation.',
    metricLabel: 'de revenu additionnel par séjour via upsells et commissions',
    features: [
      { title: 'Livret d’accueil numérique', copy: 'Accessible par un simple lien borné à la réservation, sans app ni mot de passe : arrivée, wifi, règles, contacts, guide de quartier — multilingue FR/EN/AR.' },
      { title: 'Upsells intégrés', copy: 'Check-in anticipé, départ tardif, ménage en cours de séjour, panier de bienvenue — proposés et payés directement dans le livret.' },
      { title: 'Marketplace d’expériences', copy: 'Activités, excursions et bons plans de partenaires locaux réservables depuis le livret — commission automatique à chaque réservation.' },
      { title: 'Services à domicile', copy: 'Chef privé, spa, transferts, garde d’enfants : le logement devient une conciergerie. Vous choisissez l’offre, vous fixez votre marge.' },
    ],
    faq: [
      { q: 'Le voyageur doit-il installer une application ?', a: 'Non — il reçoit un simple lien avant l’arrivée, valable le temps du séjour, sans compte ni mot de passe.' },
      { q: 'Comment gagnez-vous de l’argent avec la marketplace ?', a: 'Chaque activité ou service réservé depuis le livret génère une commission que vous paramétrez ; l’encaissement passe par votre provider de paiement.' },
      { q: 'Qui fournit les activités et les services ?', a: 'Des partenaires locaux que vous sélectionnez, ou votre propre catalogue — vous gardez la main sur l’offre, les prix et les marges.' },
    ],
  },
  'agents-ia': {
    name: 'Agents IA',
    menuCopy: 'La constellation qui surveille, propose et exécute — sous votre contrôle.',
    heroTitle: 'Une équipe d’agents IA qui travaille pour vos logements.',
    heroCopy: '',
    metricLabel: 'des décisions expliquées et traçables',
    features: [],
    faq: [],
  },
  'revenue-market-data': {
    name: 'Revenue & market data',
    menuCopy: 'Yield automatique borné + comparables de marché par ville.',
    heroTitle: 'Des prix qui suivent votre marché. Pas l’inverse.',
    heroCopy:
      'Le yield ajuste vos tarifs bloc par bloc dans des bornes que vous fixez, nourri par des comparables de marché anonymisés. Chaque ajustement est simulé et expliqué.',
    metricLabel: 'de RevPAR visé par le yield automatique',
    features: [
      { title: 'Tarification 6 niveaux', copy: 'Overrides, promotions, saisons, last-minute, prix de base — résolus dans un ordre clair.' },
      { title: 'Yield borné', copy: 'Baisse sous 55 % d’occupation, hausse au-delà de 85 %, plancher intouchable, repos de 14 jours.' },
      { title: 'Market data', copy: 'ADR, occupation et saisonnalité de votre ville, agrégés et anonymisés.' },
      { title: 'Rapports RMS', copy: 'Pacing, courbes de réservation, funnel de conversion, snapshots historiques.' },
    ],
    faq: [
      { q: 'Le yield peut-il brader mes nuits ?', a: 'Non : le prix plancher que vous définissez est une borne dure, et chaque baisse est plafonnée et espacée dans le temps.' },
      { q: 'D’où viennent les données de marché ?', a: 'Des portefeuilles Baitly agrégés avec k-anonymat — aucune donnée individuelle n’est exposée.' },
    ],
  },
  'paiements-finances': {
    name: 'Paiements & finances',
    menuCopy: 'Encaissements, factures et versements réunis dans un même espace.',
    heroTitle: 'Encaissez sur vos marchés. Facturez dans les règles.',
    heroCopy:
      'Retrouvez les encaissements, les factures et les versements dans Baitly. Stripe est raccordé pour la France ; les PSP locaux du Maroc et de l’Arabie saoudite restent à sélectionner.',
    metricLabel: 'providers d’encaissement selon votre pays',
    features: [
      { title: 'Multi-providers', copy: 'Stripe pour la France. Le raccordement des PSP locaux du Maroc et de l’Arabie saoudite sera confirmé après leur sélection.' },
      { title: 'Facturation conforme', copy: 'Numérotation séquentielle, facture électronique ZATCA, mentions légales, factures de commission pour vos mandants.' },
      { title: 'Fiscalité locale', copy: 'TVA 15 % et frais municipaux en Arabie saoudite, barèmes de taxe de séjour par commune au Maroc et en France.' },
      { title: 'Versements', copy: 'Suivez la validation du bénéficiaire, le transfert via le PSP et la confirmation du versement bancaire.' },
    ],
    faq: [
      { q: 'Stripe suffit-il sur vos marchés ?', a: 'Stripe est le PSP retenu pour la France. Les PSP du Maroc et de l’Arabie saoudite ne sont pas encore choisis ; leurs moyens de paiement seront précisés après raccordement.' },
      { q: 'Gérez-vous la caution ?', a: 'Oui, par pré-autorisation sur les providers qui la supportent.' },
    ],
  },
  'operations-menage': {
    name: 'Opérations & ménage',
    menuCopy: 'Missions auto-assignées, preuve photo, payouts gatés.',
    heroTitle: 'Le ménage assigné, prouvé, payé.',
    heroCopy:
      'Chaque départ génère sa mission, l’équipe reçoit sa checklist, la preuve photo conditionne le paiement. Vos standards deviennent des processus.',
    metricLabel: 'des payouts ménage conditionnés à la preuve photo',
    features: [
      { title: 'Planning auto', copy: 'Missions générées au checkout, assignées selon disponibilités et zones.' },
      { title: 'Checklists par logement', copy: 'Pièce par pièce, avec photos de référence et consignes.' },
      { title: 'Preuve photo', copy: 'Le prestataire documente, vous validez, le payout se débloque.' },
      { title: 'Maintenance', copy: 'Interventions, devis, tarifs travaux des techniciens.' },
    ],
    faq: [
      { q: 'Mes équipes doivent-elles installer une app ?', a: 'Elles reçoivent leurs missions sur mobile avec un accès limité à leur rôle — rien d’autre.' },
      { q: 'Comment sont payés les prestataires ?', a: 'Tarifs par prestation, payout déclenché après validation de la preuve photo.' },
    ],
  },
  'objets-connectes': {
    name: 'Objets connectés',
    menuCopy: 'Serrures, capteurs de bruit, vidéosurveillance des accès.',
    heroTitle: 'Vos logements sous contrôle, à distance.',
    heroCopy:
      'Serrures connectées avec codes bornés au séjour, capteurs de bruit avec seuils et alertes WhatsApp, caméras des espaces extérieurs — dans le respect de la vie privée.',
    metricLabel: 'avant l’arrivée : le code d’accès part automatiquement',
    features: [
      { title: 'Serrures connectées', copy: 'Nuki, KeyNest — codes générés par séjour, journal des accès.' },
      { title: 'Capteurs de bruit', copy: 'Seuils jour/nuit, créneaux, alertes graduées avant l’escalade.' },
      { title: 'Vidéosurveillance', copy: 'Espaces extérieurs et accès uniquement — flux intérieurs interdits.' },
      { title: 'Automatisations', copy: 'Arrivée → code + guide voyageur ; bruit → message WhatsApp au guest.' },
    ],
    faq: [
      { q: 'Quelles marques sont supportées ?', a: 'Nuki et KeyNest pour les serrures, Minut pour le bruit ; le catalogue s’étend en continu.' },
      { q: 'Et la vie privée des voyageurs ?', a: 'Prévoyez uniquement des caméras extérieures autorisées et déclarées, et des sonomètres sans enregistrement audio. Vérifiez les règles locales et celles de votre plateforme de réservation. Le gestionnaire reste responsable de l’installation et de son usage.' },
    ],
  },
  'portail-proprietaire': {
    name: 'Portail propriétaire & contrats',
    menuCopy: 'Relevés, versements, mandats signés en ligne.',
    heroTitle: 'Vos mandants voient tout. Vous ne ressaisissez rien.',
    heroCopy:
      'Un portail par propriétaire avec relevés mensuels, versements et performances. Les mandats de gestion se signent en ligne, certificat de preuve inclus.',
    metricLabel: 'modèles d’encaissement contractuels supportés',
    features: [
      { title: 'Portail dédié', copy: 'Relevés, calendrier, revenus nets — chaque propriétaire voit son bien.' },
      { title: 'E-signature', copy: 'Mandat signé en ligne, horodaté, certificat joint au PDF.' },
      { title: 'Modèles d’encaissement', copy: 'Direct, propriétaire encaisse, conciergerie encaisse, co-hôte OTA.' },
      { title: 'Factures de commission', copy: 'Générées automatiquement à chaque période, conformes.' },
    ],
    faq: [
      { q: 'La signature électronique est-elle valable ?', a: 'Signature simple avec dossier de preuve (IP, horodatage, consentement) — adaptée aux mandats de gestion.' },
      { q: 'Le propriétaire peut-il bloquer des dates ?', a: 'Oui, selon les permissions que vous lui accordez.' },
    ],
  },
};

const en: Record<string, ModuleText> = {
  'pms-channel-manager': {
    name: 'PMS & channel manager',
    menuCopy: 'Multi-property calendar, bookings, continuous OTA sync.',
    heroTitle: 'Every calendar, one single truth.',
    heroCopy:
      'Airbnb, Booking.com and your direct bookings synced continuously (ARI through Channex). Centralised availability helps prevent booking conflicts.',
    metricLabel: 'double bookings by design — no row means available',
    features: [
      { title: 'Multi-property planning', copy: 'Blocks coloured by status, daily occupancy, drag & drop stays.' },
      { title: 'ARI synchronisation', copy: 'Rates, availability and restrictions pushed continuously to the channels.' },
      { title: 'Unified bookings', copy: 'OTA, direct and iCal imports in one list, with the full life cycle.' },
      { title: 'iCal safety net', copy: 'A universal fallback during transitions — never a gap in coverage.' },
    ],
    faq: [
      { q: 'How many channels are covered?', a: 'Airbnb and Booking.com natively through Channex, plus any iCal-compatible channel (Vrbo, Abritel…).' },
      { q: 'What happens if a channel goes down?', a: 'The Distribution agent spots sync conflicts and warns you before a double booking happens.' },
    ],
  },
  'booking-engine': {
    name: 'Booking engine & sites',
    menuCopy: 'Your direct booking site, commission-free, with templates.',
    heroTitle: 'Your direct bookings, commission-free.',
    heroCopy:
      'A booking engine you can embed on any site, a gallery of templates ready to customise, a multi-stay cart and built-in payment.',
    metricLabel: 'commission on your direct bookings',
    features: [
      { title: 'Embeddable widget', copy: 'Search by dates, two-month calendar with nightly prices, multilingual FR/EN/AR with RTL.' },
      { title: 'Template gallery', copy: 'Complete sites ready to spin up, customisable in the no-code Studio.' },
      { title: 'Multi-stay cart', copy: 'Several properties and dates in one booking, paid in one go.' },
      { title: 'Cart recovery', copy: 'Abandoned carts are followed up automatically by email.' },
    ],
    faq: [
      { q: 'Can I use my existing site?', a: 'Yes — the widget drops in as a single script tag on WordPress, Wix or any HTML site.' },
      { q: 'Is payment included?', a: 'Stripe is connected for France. Payment providers for Morocco and Saudi Arabia are being selected.' },
    ],
  },
  'livret-accueil': {
    name: 'Welcome guide & experiences',
    menuCopy: 'Digital guide, add-ons and an activities marketplace — new commission revenue.',
    heroTitle: 'The perfect trip for your guests. New revenue for you.',
    heroCopy:
      'A digital welcome guide that organises the whole stay — arrival, recommendations, local activities and at-home services — and creates extra revenue on every booking.',
    metricLabel: 'extra revenue per stay through add-ons and commissions',
    features: [
      { title: 'Digital welcome guide', copy: 'Reached through a single link tied to the booking, with no app and no password: arrival, Wi-Fi, rules, contacts, neighbourhood guide — multilingual FR/EN/AR.' },
      { title: 'Built-in add-ons', copy: 'Early check-in, late check-out, mid-stay cleaning, welcome basket — offered and paid for inside the guide.' },
      { title: 'Experience marketplace', copy: 'Activities, excursions and local partner deals bookable from the guide — automatic commission on every booking.' },
      { title: 'At-home services', copy: 'Private chef, spa, transfers, childcare: the property becomes a concierge service. You pick the offer, you set your margin.' },
    ],
    faq: [
      { q: 'Does the guest need to install an app?', a: 'No — they get a plain link before arrival, valid for the stay, with no account and no password.' },
      { q: 'How do you earn from the marketplace?', a: 'Every activity or service booked from the guide generates a commission you set; collection goes through your payment provider.' },
      { q: 'Who supplies the activities and services?', a: 'Local partners you select, or your own catalogue — you keep control of the offer, the prices and the margins.' },
    ],
  },
  'agents-ia': {
    name: 'AI agents',
    menuCopy: 'The constellation that watches, proposes and acts — under your control.',
    heroTitle: 'A team of AI agents working for your properties.',
    heroCopy: '',
    metricLabel: 'of decisions explained and traceable',
    features: [],
    faq: [],
  },
  'revenue-market-data': {
    name: 'Revenue & market data',
    menuCopy: 'Bounded automatic yield plus market comparables by city.',
    heroTitle: 'Prices that follow your market. Not the other way round.',
    heroCopy:
      'Yield adjusts your rates block by block within bounds you set, fed by anonymised market comparables. Every adjustment is simulated and explained.',
    metricLabel: 'RevPAR targeted by automatic yield',
    features: [
      { title: 'Six-level pricing', copy: 'Overrides, promotions, seasons, last minute, base price — resolved in a clear order.' },
      { title: 'Bounded yield', copy: 'Down below 55% occupancy, up above 85%, an untouchable floor, a 14-day rest period.' },
      { title: 'Market data', copy: 'ADR, occupancy and seasonality for your city, aggregated and anonymised.' },
      { title: 'RMS reports', copy: 'Pacing, booking curves, conversion funnel, historical snapshots.' },
    ],
    faq: [
      { q: 'Can yield undersell my nights?', a: 'No: the floor price you set is a hard bound, and every decrease is capped and spaced out over time.' },
      { q: 'Where does the market data come from?', a: 'From Baitly portfolios aggregated with k-anonymity — no individual data is exposed.' },
    ],
  },
  'paiements-finances': {
    name: 'Payments & finance',
    menuCopy: 'Collections, invoices and payouts in one workspace.',
    heroTitle: 'Collect in your markets. Invoice by the book.',
    heroCopy:
      'Track collections, invoices and payouts in Baitly. Stripe is connected for France; local providers for Morocco and Saudi Arabia are still to be selected.',
    metricLabel: 'collection providers, depending on your country',
    features: [
      { title: 'Multi-provider', copy: 'Stripe for France. Local integrations for Morocco and Saudi Arabia will be confirmed after provider selection.' },
      { title: 'Compliant invoicing', copy: 'Sequential numbering, ZATCA electronic invoicing, legal statements, commission invoices for your owners.' },
      { title: 'Local taxation', copy: '15% VAT and municipality fees in Saudi Arabia, tourist tax schedules by municipality in Morocco and France.' },
      { title: 'Payouts', copy: 'Track beneficiary approval, the PSP transfer and confirmation of the bank payout.' },
    ],
    faq: [
      { q: 'Is Stripe enough in your markets?', a: 'Stripe is the selected provider for France. Providers for Morocco and Saudi Arabia have not yet been chosen; their payment methods will be specified after integration.' },
      { q: 'Do you handle deposits?', a: 'Yes, through pre-authorisation on the providers that support it.' },
    ],
  },
  'operations-menage': {
    name: 'Operations & housekeeping',
    menuCopy: 'Auto-assigned jobs, photo proof, gated payouts.',
    heroTitle: 'Housekeeping assigned, proven, paid.',
    heroCopy:
      'Every departure generates its job, the team gets its checklist, photo proof gates the payment. Your standards become processes.',
    metricLabel: 'of housekeeping payouts gated on photo proof',
    features: [
      { title: 'Automatic scheduling', copy: 'Jobs generated at checkout, assigned by availability and zone.' },
      { title: 'Per-property checklists', copy: 'Room by room, with reference photos and instructions.' },
      { title: 'Photo proof', copy: 'The provider documents, you approve, the payout is released.' },
      { title: 'Maintenance', copy: 'Jobs, quotes, technician labour rates.' },
    ],
    faq: [
      { q: 'Do my teams need to install an app?', a: 'They receive their jobs on mobile with access limited to their role — nothing else.' },
      { q: 'How are providers paid?', a: 'Rates per service, payout triggered once the photo proof is approved.' },
    ],
  },
  'objets-connectes': {
    name: 'Connected devices',
    menuCopy: 'Locks, noise sensors, access video monitoring.',
    heroTitle: 'Your properties under control, remotely.',
    heroCopy:
      'Smart locks with codes bounded to the stay, noise sensors with thresholds and WhatsApp alerts, cameras on outdoor areas — with privacy respected.',
    metricLabel: 'before arrival: the access code goes out automatically',
    features: [
      { title: 'Smart locks', copy: 'Nuki, KeyNest — codes generated per stay, access log.' },
      { title: 'Noise sensors', copy: 'Day/night thresholds, time slots, graduated alerts before escalation.' },
      { title: 'Video monitoring', copy: 'Outdoor areas and access points only — indoor feeds are forbidden.' },
      { title: 'Automations', copy: 'Arrival → code plus guest guide; noise → WhatsApp message to the guest.' },
    ],
    faq: [
      { q: 'Which brands are supported?', a: 'Nuki and KeyNest for locks, Minut for noise; the catalogue keeps growing.' },
      { q: 'What about guest privacy?', a: 'Use only permitted, disclosed exterior cameras and noise monitors without audio recording. Check local law and your booking platform’s rules. The manager remains responsible for installation and use.' },
    ],
  },
  'portail-proprietaire': {
    name: 'Owner portal & contracts',
    menuCopy: 'Statements, payouts, mandates signed online.',
    heroTitle: 'Your owners see everything. You retype nothing.',
    heroCopy:
      'A portal per owner with monthly statements, payouts and performance. Management mandates are signed online, proof certificate included.',
    metricLabel: 'contractual collection models supported',
    features: [
      { title: 'Dedicated portal', copy: 'Statements, calendar, net revenue — each owner sees their property.' },
      { title: 'E-signature', copy: 'Mandate signed online, timestamped, certificate attached to the PDF.' },
      { title: 'Collection models', copy: 'Direct, owner collects, agency collects, OTA co-host.' },
      { title: 'Commission invoices', copy: 'Generated automatically each period, compliant.' },
    ],
    faq: [
      { q: 'Is the electronic signature valid?', a: 'A simple signature with an evidence file (IP, timestamp, consent) — suited to management mandates.' },
      { q: 'Can the owner block dates?', a: 'Yes, according to the permissions you grant them.' },
    ],
  },
};

const ar: Record<string, ModuleText> = {
  'pms-channel-manager': {
    name: 'نظام الإدارة ومدير القنوات',
    menuCopy: 'تقويم متعدد العقارات، وحجوزات، ومزامنة مستمرة مع منصات الحجز.',
    heroTitle: 'كل تقويماتك، وحقيقة واحدة.',
    heroCopy:
      'Airbnb وBooking.com وحجوزاتك المباشرة، متزامنة باستمرار (ARI عبر Channex). يساعد توحيد التوافر في الحد من تعارضات الحجز.',
    metricLabel: 'حجز مزدوج بحكم التصميم — غياب السطر يعني التوفر',
    features: [
      { title: 'تخطيط متعدد العقارات', copy: 'كتل ملوّنة حسب الحالة، وإشغال يومي، وسحب وإفلات للإقامات.' },
      { title: 'مزامنة ARI', copy: 'تُدفع الأسعار والتوفر والقيود باستمرار إلى القنوات.' },
      { title: 'حجوزات موحّدة', copy: 'منصات الحجز والحجز المباشر واستيراد iCal في قائمة واحدة، بدورة حياة كاملة.' },
      { title: 'شبكة أمان iCal', copy: 'وضع احتياطي شامل أثناء التحوّلات — دون أي فجوة في التغطية.' },
    ],
    faq: [
      { q: 'كم عدد القنوات المغطاة؟', a: 'Airbnb وBooking.com باتصال مباشر عبر Channex، إضافة إلى كل قناة متوافقة مع iCal (Vrbo وAbritel…).' },
      { q: 'ماذا يحدث إذا تعطّلت قناة؟', a: 'يكتشف وكيل التوزيع تعارضات المزامنة وينبّهك قبل وقوع حجز مزدوج.' },
    ],
  },
  'booking-engine': {
    name: 'محرك الحجز والمواقع',
    menuCopy: 'موقع حجزك المباشر، بلا عمولة، مع قوالب جاهزة.',
    heroTitle: 'حجوزاتك المباشرة، بلا عمولة.',
    heroCopy:
      'محرك حجز يمكن تضمينه في أي موقع، ومعرض قوالب جاهزة للتخصيص، وسلة متعددة الإقامات، ودفع مدمج.',
    metricLabel: 'عمولة على حجوزاتك المباشرة',
    features: [
      { title: 'أداة قابلة للتضمين', copy: 'بحث بالتواريخ، وتقويم شهرين بأسعار الليلة، ومتعدد اللغات بالفرنسية والإنجليزية والعربية مع الكتابة من اليمين.' },
      { title: 'معرض القوالب', copy: 'مواقع كاملة جاهزة للإنشاء، قابلة للتخصيص في الاستوديو بلا برمجة.' },
      { title: 'سلة متعددة الإقامات', copy: 'عدة عقارات وتواريخ في حجز واحد يُدفع دفعة واحدة.' },
      { title: 'استرجاع السلات', copy: 'تُتابَع السلات المتروكة تلقائياً بالبريد الإلكتروني.' },
    ],
    faq: [
      { q: 'هل يمكنني استخدام موقعي الحالي؟', a: 'نعم — تُضاف الأداة بوسم برمجي واحد على WordPress أو Wix أو أي موقع HTML.' },
      { q: 'هل الدفع مشمول؟', a: 'Stripe متصل لفرنسا. مزودو الدفع للمغرب والمملكة العربية السعودية قيد الاختيار.' },
    ],
  },
  'livret-accueil': {
    name: 'دليل الاستقبال والتجارب',
    menuCopy: 'دليل رقمي، وخدمات إضافية، وسوق أنشطة — إيرادات جديدة بالعمولة.',
    heroTitle: 'رحلة مثالية لنزلائك. وإيرادات جديدة لك.',
    heroCopy:
      'دليل استقبال رقمي ينظّم الإقامة كاملة — الوصول والتوصيات والأنشطة المحلية والخدمات المنزلية — ويولّد إيراداً إضافياً مع كل حجز.',
    metricLabel: 'إيراد إضافي لكل إقامة عبر الخدمات الإضافية والعمولات',
    features: [
      { title: 'دليل استقبال رقمي', copy: 'يُفتح برابط واحد مرتبط بالحجز، دون تطبيق ولا كلمة مرور: الوصول، والواي-فاي، والقواعد، وجهات الاتصال، ودليل الحي — بالفرنسية والإنجليزية والعربية.' },
      { title: 'خدمات إضافية مدمجة', copy: 'وصول مبكر، ومغادرة متأخرة، وتنظيف أثناء الإقامة، وسلة ترحيب — تُعرض وتُدفع داخل الدليل مباشرة.' },
      { title: 'سوق التجارب', copy: 'أنشطة ورحلات وعروض شركاء محليين يمكن حجزها من الدليل — بعمولة تلقائية مع كل حجز.' },
      { title: 'خدمات منزلية', copy: 'طاهٍ خاص، وسبا، ونقل، ورعاية أطفال: يتحوّل المسكن إلى خدمة ضيافة متكاملة. أنت تختار العرض وتحدّد هامشك.' },
    ],
    faq: [
      { q: 'هل على النزيل تثبيت تطبيق؟', a: 'لا — يصله رابط بسيط قبل الوصول، صالح طوال الإقامة، دون حساب ولا كلمة مرور.' },
      { q: 'كيف تربح من السوق؟', a: 'كل نشاط أو خدمة تُحجز من الدليل تولّد عمولة تحدّدها أنت؛ ويمر التحصيل عبر مزوّد الدفع لديك.' },
      { q: 'من يوفّر الأنشطة والخدمات؟', a: 'شركاء محليون تختارهم أنت، أو كتالوجك الخاص — تبقى لك السيطرة على العرض والأسعار والهوامش.' },
    ],
  },
  'agents-ia': {
    name: 'وكلاء الذكاء الاصطناعي',
    menuCopy: 'المنظومة التي تراقب وتقترح وتنفّذ — تحت سيطرتك.',
    heroTitle: 'فريق من وكلاء الذكاء الاصطناعي يعمل لأجل عقاراتك.',
    heroCopy: '',
    metricLabel: 'من القرارات موضَّحة وقابلة للتتبّع',
    features: [],
    faq: [],
  },
  'revenue-market-data': {
    name: 'الإيرادات وبيانات السوق',
    menuCopy: 'تسعير آلي محدود بضوابط، ومقارنات سوقية حسب المدينة.',
    heroTitle: 'أسعار تتبع سوقك. لا العكس.',
    heroCopy:
      'يعدّل محرك الإيرادات أسعارك كتلةً كتلة ضمن حدود تضعها أنت، مستنداً إلى مقارنات سوقية مجهّلة الهوية. وكل تعديل يُحاكى ويُشرح.',
    metricLabel: 'من الإيراد لكل غرفة متاحة يستهدفه التسعير الآلي',
    features: [
      { title: 'تسعير من ستة مستويات', copy: 'تجاوزات، وعروض، ومواسم، ولحظة أخيرة، وسعر أساسي — تُحلّ بترتيب واضح.' },
      { title: 'تسعير محدود بضوابط', copy: 'خفض دون 55 % إشغالاً، ورفع فوق 85 %، وحد أدنى لا يُمسّ، وفترة راحة 14 يوماً.' },
      { title: 'بيانات السوق', copy: 'متوسط السعر اليومي والإشغال والموسمية في مدينتك، مجمّعة ومجهّلة.' },
      { title: 'تقارير إدارة الإيرادات', copy: 'وتيرة الحجز، ومنحنياته، وقمع التحويل، ولقطات تاريخية.' },
    ],
    faq: [
      { q: 'هل يمكن للتسعير أن يبخس لياليَّ؟', a: 'لا: السعر الأدنى الذي تحدّده حدٌّ صارم، وكل خفض مسقوف ومتباعد زمنياً.' },
      { q: 'من أين تأتي بيانات السوق؟', a: 'من محافظ بيتلي مجمّعة بخاصية إخفاء الهوية — دون كشف أي بيانات فردية.' },
    ],
  },
  'paiements-finances': {
    name: 'المدفوعات والمالية',
    menuCopy: 'التحصيل والفواتير والتحويلات في مساحة واحدة.',
    heroTitle: 'حصّل في أسواقك. وفوتر وفق الأصول.',
    heroCopy:
      'تابع التحصيل والفواتير والتحويلات في Baitly. Stripe متصل لفرنسا؛ مزودو المغرب والسعودية قيد الاختيار.',
    metricLabel: 'مزوّدي تحصيل بحسب بلدك',
    features: [
      { title: 'تعدّد المزوّدين', copy: 'Stripe لفرنسا. سيُؤكَّد ربط مزودي المغرب والسعودية بعد اختيارهم.' },
      { title: 'فوترة مطابقة', copy: 'ترقيم تسلسلي، وفاتورة إلكترونية عبر هيئة الزكاة والضريبة والجمارك، وبيانات قانونية، وفواتير عمولة لملّاكك.' },
      { title: 'ضرائب محلية', copy: 'ضريبة قيمة مضافة 15 % ورسوم بلدية في السعودية، وجداول رسم الإقامة حسب البلدية في المغرب وفرنسا.' },
      { title: 'التحويلات', copy: 'تابع اعتماد المستفيد والتحويل عبر مزود الدفع وتأكيد الإيداع البنكي.' },
    ],
    faq: [
      { q: 'هل يكفي Stripe في أسواقكم؟', a: 'Stripe هو المزود المختار لفرنسا. لم يُختر بعد مزودو المغرب والسعودية؛ ستُحدَّد وسائل الدفع بعد الربط.' },
      { q: 'هل تديرون مبلغ التأمين؟', a: 'نعم، بالحجز المسبق لدى المزوّدين الذين يدعمونه.' },
    ],
  },
  'operations-menage': {
    name: 'العمليات والتنظيف',
    menuCopy: 'مهام تُسنَد تلقائياً، وإثبات بالصور، وتحويلات مشروطة.',
    heroTitle: 'التنظيف مُسنَد، ومُثبَت، ومدفوع.',
    heroCopy:
      'كل مغادرة تولّد مهمتها، ويتلقى الفريق قائمته، ويشترط إثبات الصور الدفعَ. معاييرك تتحوّل إلى إجراءات.',
    metricLabel: 'من تحويلات التنظيف مشروطة بإثبات بالصور',
    features: [
      { title: 'جدولة آلية', copy: 'مهام تُولَّد عند المغادرة وتُسنَد حسب التوفر والمناطق.' },
      { title: 'قوائم لكل عقار', copy: 'غرفة بغرفة، مع صور مرجعية وتعليمات.' },
      { title: 'إثبات بالصور', copy: 'يوثّق المزوّد، وتصادق أنت، فيُفرَج عن الدفعة.' },
      { title: 'الصيانة', copy: 'تدخّلات، وعروض أسعار، وتعريفات أعمال الفنيين.' },
    ],
    faq: [
      { q: 'هل على فرقي تثبيت تطبيق؟', a: 'تتلقى مهامها على الهاتف بوصول محدود بدورها — لا أكثر.' },
      { q: 'كيف يُدفع للمزوّدين؟', a: 'تعريفات لكل خدمة، وتُطلق الدفعة بعد اعتماد إثبات الصور.' },
    ],
  },
  'objets-connectes': {
    name: 'الأجهزة المتصلة',
    menuCopy: 'أقفال، ومستشعرات ضجيج، ومراقبة بالفيديو للمداخل.',
    heroTitle: 'عقاراتك تحت السيطرة، عن بُعد.',
    heroCopy:
      'أقفال ذكية برموز محدودة بمدة الإقامة، ومستشعرات ضجيج بعتبات وتنبيهات عبر واتساب، وكاميرات للمساحات الخارجية — مع احترام الخصوصية.',
    metricLabel: 'قبل الوصول: يُرسَل رمز الدخول تلقائياً',
    features: [
      { title: 'أقفال ذكية', copy: 'Nuki وKeyNest — رموز تُولَّد لكل إقامة، وسجل للدخول.' },
      { title: 'مستشعرات الضجيج', copy: 'عتبات نهارية وليلية، وفترات زمنية، وتنبيهات متدرّجة قبل التصعيد.' },
      { title: 'المراقبة بالفيديو', copy: 'المساحات الخارجية والمداخل فقط — تُمنع التغذيات الداخلية.' },
      { title: 'الأتمتة', copy: 'وصول ← رمز مع دليل النزيل؛ ضجيج ← رسالة واتساب إلى النزيل.' },
    ],
    faq: [
      { q: 'ما العلامات المدعومة؟', a: 'Nuki وKeyNest للأقفال، وMinut للضجيج؛ والكتالوج يتوسّع باستمرار.' },
      { q: 'وماذا عن خصوصية النزلاء؟', a: 'استخدم فقط كاميرات خارجية مسموحاً بها ومعلناً عنها ومستشعرات ضوضاء دون تسجيل صوتي. تحقق من القواعد المحلية وشروط منصة الحجز. ويظل المدير مسؤولاً عن التركيب والاستخدام.' },
    ],
  },
  'portail-proprietaire': {
    name: 'بوابة المالك والعقود',
    menuCopy: 'كشوف، وتحويلات، وتفويضات تُوقَّع إلكترونياً.',
    heroTitle: 'ملّاكك يرون كل شيء. وأنت لا تعيد إدخال شيء.',
    heroCopy:
      'بوابة لكل مالك تضم الكشوف الشهرية والتحويلات والأداء. وتُوقَّع تفويضات الإدارة إلكترونياً، مع شهادة إثبات.',
    metricLabel: 'نماذج تعاقدية للتحصيل مدعومة',
    features: [
      { title: 'بوابة مخصّصة', copy: 'كشوف، وتقويم، وإيرادات صافية — كل مالك يرى عقاره.' },
      { title: 'التوقيع الإلكتروني', copy: 'تفويض يُوقَّع إلكترونياً، موثّق زمنياً، مع شهادة مرفقة بملف PDF.' },
      { title: 'نماذج التحصيل', copy: 'مباشر، أو المالك يحصّل، أو شركة الإدارة تحصّل، أو استضافة مشتركة عبر منصة حجز.' },
      { title: 'فواتير العمولة', copy: 'تُولَّد تلقائياً في كل فترة، ومطابقة للأصول.' },
    ],
    faq: [
      { q: 'هل التوقيع الإلكتروني صالح؟', a: 'توقيع بسيط مع ملف إثبات (عنوان IP، وتوثيق زمني، وموافقة) — يناسب تفويضات الإدارة.' },
      { q: 'هل يمكن للمالك حجب تواريخ؟', a: 'نعم، وفق الصلاحيات التي تمنحها له.' },
    ],
  },
};

export const MODULE_TEXT: Record<SiteLanguage, Record<string, ModuleText>> = { fr, en, ar };

/**
 * Texte d'un module dans la langue demandee.
 *
 * <p>Repli sur le francais : un module ajoute au catalogue et pas encore
 * traduit doit s'afficher, pas faire tomber la page. Le test de parite le
 * signale par ailleurs.</p>
 */
export function moduleText(slug: string, language: SiteLanguage): ModuleText {
  return MODULE_TEXT[language][slug] ?? MODULE_TEXT.fr[slug];
}
