import type { SiteLanguage } from '../siteLanguage';

/**
 * Page « Agents IA ».
 *
 * <p>La liste des agents suit `AGENT_IDS` du PMS — dix agents, pas quatre.
 * Leurs noms sont ceux de l'application (`supervision.agents.*`) : la page
 * vend ce que le produit livre, sous le meme nom.</p>
 *
 * <p>Les chiffres d'impact (heures gagnees, points de RevPAR) ont ete retires :
 * aucune mesure ne les soutenait. Ce qui reste est verifiable — le nombre
 * d'agents vient du code, les bornes du yield sont celles de l'AutoApplyGate,
 * la tracabilite est celle du journal d'audit.</p>
 */
export interface AgentCardText {
  /** Identifiant d'agent du PMS : porte l'icone et la couleur. */
  id: string;
  name: string;
  watches: string;
  proposes: string;
}

const fr = {
  hero: {
    eyebrow: 'Produit · Agents IA',
    title: 'Une équipe d’agents IA qui travaille pour vos logements.',
    copyBefore:
      'La constellation Baitly surveille vos prix, vos séjours, vos équipes ménage et vos canaux — en continu. Chaque agent propose, simule et explique. ',
    copyStrong: 'Vous approuvez, ils exécutent.',
    ctaPrimary: 'Voir les agents en action',
    ctaSecondary: 'Essayer gratuitement',
    note: 'Sans carte bancaire · Interface AR / FR / EN',
    metricAgentsLabel: 'agents spécialisés, chacun son métier',
    metricBounded: 'Bornes',
    metricBoundedLabel: 'plancher de prix et délai de repos, fixés par vous',
    metricTraceable: '100 %',
    metricTraceableLabel: 'des décisions expliquées et journalisées',
  },
  trust: [
    'Déclaration des voyageurs automatisée',
    'Taxe de séjour et TVA locales',
    'Airbnb · Booking.com · Channex',
    'PayTabs · CMI / PayZone · Stripe',
  ],
  agentsTitle: 'Des agents nommés, chacun son métier.',
  agentsCopy:
    'Pas une « fonctionnalité IA » diffuse : une équipe dont chaque membre a un périmètre, des garde-fous et un journal d’activité.',
  agentBadge: 'Auto ou validation',
  watchesLabel: 'Surveille',
  proposesLabel: 'Propose',
  agents: [
    { id: 'rev', name: 'Revenue', watches: 'Occupation par bloc de dates, pace de réservation, saisonnalité, prix du marché.', proposes: 'Ajustements tarifaires bornés (plancher garanti), simulés avant application.' },
    { id: 'com', name: 'Communication', watches: 'Messages voyageurs entrants, sur tous les canaux, dans toutes les langues.', proposes: 'Réponses prêtes à envoyer, traduites, appuyées sur le livret d’accueil.' },
    { id: 'ops', name: 'Opérations', watches: 'Planning ménage, preuves photo, incidents et maintenances.', proposes: 'Missions assignées aux bonnes équipes, payouts gatés sur preuve.' },
    { id: 'sync', name: 'Synchronisation', watches: 'Synchronisation des canaux (ARI), conflits de calendrier, annonces.', proposes: 'Corrections de sync et alertes avant qu’un chevauchement n’arrive.' },
    { id: 'fin', name: 'Finance', watches: 'Encaissements, cautions, commissions, relevés propriétaires.', proposes: 'Rapprochements, relances de paiement et relevés prêts à envoyer.' },
    { id: 'cmp', name: 'Conformité', watches: 'Déclarations de voyageurs, taxes locales, pièces et échéances réglementaires.', proposes: 'Déclarations à valider et alertes avant échéance.' },
    { id: 'gst', name: 'Voyageur', watches: 'Le séjour en cours : arrivée, incidents, demandes, départ.', proposes: 'Attentions au bon moment, ventes additionnelles pertinentes.' },
    { id: 'rep', name: 'Avis & Réputation', watches: 'Avis publiés, notes par critère, réponses en attente.', proposes: 'Réponses rédigées et signaux d’alerte sur une note qui décroche.' },
    { id: 'own', name: 'Propriétaire', watches: 'Performance par mandant, relevés, échéances de contrat.', proposes: 'Relevés mensuels et points de situation à envoyer.' },
    { id: 'gro', name: 'Croissance', watches: 'Distribution, visibilité des annonces, canaux sous-exploités.', proposes: 'Actions d’acquisition et ouvertures de canal à arbitrer.' },
  ] as readonly AgentCardText[],
  hitl: {
    title: 'Vous gardez la main. Vraiment.',
    copy:
      'L’autopilote total n’inspire pas confiance — et il a tort de le faire. Baitly est conçu humain-dans-la-boucle d’abord.',
    points: [
      'Chaque proposition arrive en carte à approuver — rien ne part sans vous.',
      'Passez un agent en automatique quand il a gagné votre confiance, agent par agent.',
      'Chaque décision est expliquée en langage clair : le pourquoi, les bornes, la simulation.',
      'Un journal d’audit conserve tout : qui a approuvé quoi, quand, avec quel effet.',
    ],
  },
  capabilitiesTitle: 'Tout ce que la constellation sait faire.',
  tabs: [
    {
      key: 'pricing',
      label: 'Pricing & yield',
      title: 'Un yield bloc par bloc, jamais aveugle',
      copy: 'Baisse ciblée sous 55 % d’occupation, hausse au-delà de 85 %, cooldown de 14 jours entre deux ajustements, plancher intouchable. Le tout simulé avant application.',
      rows: ['Prix par nuit sur le calendrier', 'Overrides par plage', 'Saisons et promotions', 'Market data par ville'],
    },
    {
      key: 'guests',
      label: 'Messages voyageurs',
      title: 'Des réponses prêtes, dans la langue du voyageur',
      copy: 'Brouillons générés depuis votre livret d’accueil et l’historique du séjour, envoi manuel ou automatique par modèle. WhatsApp, email et SMS unifiés.',
      rows: ['Boîte unifiée multi-canaux', 'Modèles par évènement', 'Traduction AR / FR / EN', 'Relance de panier direct'],
    },
    {
      key: 'ops',
      label: 'Opérations ménage',
      title: 'Le ménage assigné, prouvé, payé',
      copy: 'Chaque départ génère la mission, l’agent l’assigne selon les disponibilités, la preuve photo conditionne le payout du prestataire.',
      rows: ['Planning auto post-checkout', 'Checklists par logement', 'Preuve photo obligatoire', 'Payouts gatés'],
    },
    {
      key: 'watch',
      label: 'Supervision',
      title: 'Une constellation, un tableau de bord',
      copy: 'Le feed d’activité montre ce que chaque agent a fait, en auto ou après votre validation. Les compteurs de cartes en attente sont dans votre barre latérale.',
      rows: ['Feed temps réel', 'File de cartes à traiter', 'Toggles Auto / HITL par agent', 'Journal d’audit exportable'],
    },
  ],
  transparency: {
    eyebrow: 'Pas de boîte noire',
    title: 'Chaque décision est documentée.',
    copy:
      'Les règles du yield sont bornées et lisibles : seuils d’occupation, plancher de prix, périodes de repos, simulation d’élasticité. Nous publions comment nos agents décident — parce qu’un outil auquel on confie ses revenus doit pouvoir s’expliquer.',
    cta: 'Lire « Comment notre yield décide »',
    points: [
      'Bornes explicites : jamais sous votre prix plancher, jamais plus d’un ajustement par bloc et par quinzaine.',
      'Simulation avant action : impact estimé en nuits et en revenu, affiché sur chaque carte.',
      'Journal d’audit : chaque action d’agent est horodatée, attribuée et réversible.',
    ],
  },
  segmentsTitle: 'À chaque taille de portefeuille, son usage.',
  segments: [
    { range: '1 à 5 logements', title: 'L’autopilote simple', copy: 'Les agents gèrent messages et prix pendant que vous gardez votre emploi du temps. Validation sur mobile en deux gestes.' },
    { range: '5 à 50 logements', title: 'La conciergerie augmentée', copy: 'Cartes à valider par équipe, ménage gaté sur preuve photo, portail propriétaires alimenté automatiquement.' },
    { range: '50+ logements', title: 'Le portefeuille piloté', copy: 'Vue multi-organisations, agents par segment de biens, journal d’audit exportable pour vos mandants.' },
  ],
  pricingTitle: 'Les agents sont inclus dans le plan Pro.',
  pricingCopy: 'Tarif par logement, dégressif, sans commission sur vos réservations directes.',
  pricingCta: 'Voir tous les tarifs',
  faqTitle: 'Questions fréquentes',
  faq: [
    {
      q: 'Les agents décident-ils seuls ?',
      a: 'Non par défaut. Chaque agent démarre en mode validation : il propose des cartes que vous approuvez, ajustez ou ignorez. Vous pouvez ensuite le passer en automatique, agent par agent, avec des bornes que vous fixez.',
    },
    {
      q: 'Que se passe-t-il si je refuse une proposition ?',
      a: 'Rien — la carte est archivée avec votre décision. L’agent respecte un délai de repos avant de reproposer sur le même sujet.',
    },
    {
      q: 'Mes données servent-elles à entraîner des modèles tiers ?',
      a: 'Non. Vos données restent dans votre organisation. Les comparables de marché sont agrégés et anonymisés.',
    },
    {
      q: 'Ça fonctionne en arabe ?',
      a: 'Oui — l’interface existe en arabe (RTL complet), en français et en anglais, et les agents répondent aux voyageurs dans leur langue.',
    },
    {
      q: 'Je viens d’un autre PMS, je dois tout reconfigurer ?',
      a: 'Non : l’import Baitly récupère logements, réservations passées et voyageurs depuis vos exports OTA, le fichier de votre ancien PMS ou votre tableur. Les données importées ne déclenchent aucune automatisation.',
    },
  ],
  finalCta: {
    title: 'Mettez une équipe d’agents sur vos logements.',
    copy: 'Démo en 30 minutes, en arabe, en français ou en anglais. Ou explorez par vous-même — sans carte bancaire.',
    primary: 'Réserver une démo',
    secondary: 'Discuter sur WhatsApp',
  },
};

export type AgentsMessages = typeof fr;

const en: AgentsMessages = {
  hero: {
    eyebrow: 'Product · AI agents',
    title: 'A team of AI agents working on your properties.',
    copyBefore:
      'The Baitly constellation watches your prices, your stays, your housekeeping teams and your channels — continuously. Each agent proposes, simulates and explains. ',
    copyStrong: 'You approve, they act.',
    ctaPrimary: 'See the agents at work',
    ctaSecondary: 'Try it free',
    note: 'No card required · Arabic / French / English interface',
    metricAgentsLabel: 'specialised agents, each with its trade',
    metricBounded: 'Bounds',
    metricBoundedLabel: 'price floor and cooldown, set by you',
    metricTraceable: '100%',
    metricTraceableLabel: 'of decisions explained and logged',
  },
  trust: [
    'Automated guest registration',
    'Local tourist tax and VAT',
    'Airbnb · Booking.com · Channex',
    'PayTabs · CMI / PayZone · Stripe',
  ],
  agentsTitle: 'Named agents, each with its trade.',
  agentsCopy:
    'Not a vague “AI feature”: a team where every member has a scope, guardrails and an activity log.',
  agentBadge: 'Auto or approval',
  watchesLabel: 'Watches',
  proposesLabel: 'Proposes',
  agents: [
    { id: 'rev', name: 'Revenue', watches: 'Occupancy per date block, booking pace, seasonality, market prices.', proposes: 'Bounded price adjustments (guaranteed floor), simulated before they apply.' },
    { id: 'com', name: 'Communication', watches: 'Incoming guest messages, on every channel, in every language.', proposes: 'Replies ready to send, translated, grounded in your guest guide.' },
    { id: 'ops', name: 'Operations', watches: 'Housekeeping schedule, photo proof, incidents and maintenance.', proposes: 'Missions assigned to the right teams, payouts gated on proof.' },
    { id: 'sync', name: 'Sync', watches: 'Channel synchronisation (ARI), calendar conflicts, listings.', proposes: 'Sync fixes and alerts before an overlap happens.' },
    { id: 'fin', name: 'Finance', watches: 'Collections, deposits, commissions, owner statements.', proposes: 'Reconciliations, payment reminders and statements ready to send.' },
    { id: 'cmp', name: 'Compliance', watches: 'Guest registrations, local taxes, documents and regulatory deadlines.', proposes: 'Filings to approve and alerts ahead of each deadline.' },
    { id: 'gst', name: 'Guest', watches: 'The stay in progress: arrival, incidents, requests, departure.', proposes: 'The right touch at the right moment, relevant upsells.' },
    { id: 'rep', name: 'Reviews & Reputation', watches: 'Published reviews, ratings by criterion, replies pending.', proposes: 'Drafted replies and warnings when a rating slips.' },
    { id: 'own', name: 'Owner', watches: 'Performance per owner, statements, contract deadlines.', proposes: 'Monthly statements and updates to send.' },
    { id: 'gro', name: 'Growth', watches: 'Distribution, listing visibility, under-used channels.', proposes: 'Acquisition moves and channel openings to weigh up.' },
  ],
  hitl: {
    title: 'You stay in control. Genuinely.',
    copy:
      'Full autopilot does not earn trust — and it should not. Baitly is built human-in-the-loop first.',
    points: [
      'Every proposal arrives as a card to approve — nothing goes out without you.',
      'Switch an agent to automatic once it has earned your trust, agent by agent.',
      'Every decision is explained in plain language: the why, the bounds, the simulation.',
      'An audit log keeps everything: who approved what, when, and to what effect.',
    ],
  },
  capabilitiesTitle: 'Everything the constellation can do.',
  tabs: [
    {
      key: 'pricing',
      label: 'Pricing & yield',
      title: 'Yield block by block, never blind',
      copy: 'Targeted cuts below 55% occupancy, increases above 85%, a 14-day cooldown between adjustments, an untouchable floor. All simulated before it applies.',
      rows: ['Nightly price on the calendar', 'Overrides per range', 'Seasons and promotions', 'Market data by city'],
    },
    {
      key: 'guests',
      label: 'Guest messages',
      title: 'Replies ready, in the guest’s language',
      copy: 'Drafts generated from your guest guide and the stay’s history, sent manually or automatically per template. WhatsApp, email and SMS unified.',
      rows: ['Unified multi-channel inbox', 'Templates per event', 'Arabic / French / English translation', 'Direct cart recovery'],
    },
    {
      key: 'ops',
      label: 'Housekeeping',
      title: 'Cleaning assigned, proven, paid',
      copy: 'Every checkout generates the mission, the agent assigns it by availability, photo proof gates the provider’s payout.',
      rows: ['Auto schedule after checkout', 'Checklists per property', 'Photo proof required', 'Gated payouts'],
    },
    {
      key: 'watch',
      label: 'Supervision',
      title: 'One constellation, one dashboard',
      copy: 'The activity feed shows what each agent did, automatically or after your approval. Pending-card counters sit in your sidebar.',
      rows: ['Real-time feed', 'Queue of cards to handle', 'Auto / approval toggles per agent', 'Exportable audit log'],
    },
  ],
  transparency: {
    eyebrow: 'No black box',
    title: 'Every decision is documented.',
    copy:
      'The yield rules are bounded and readable: occupancy thresholds, price floor, cooldowns, elasticity simulation. We publish how our agents decide — because a tool you trust with your revenue must be able to explain itself.',
    cta: 'Read “How our yield decides”',
    points: [
      'Explicit bounds: never below your floor price, never more than one adjustment per block per fortnight.',
      'Simulation before action: estimated impact in nights and revenue, shown on every card.',
      'Audit log: every agent action is timestamped, attributed and reversible.',
    ],
  },
  segmentsTitle: 'Every portfolio size, its own way of using it.',
  segments: [
    { range: '1 to 5 properties', title: 'Simple autopilot', copy: 'The agents handle messages and prices while you keep your schedule. Approval on mobile in two taps.' },
    { range: '5 to 50 properties', title: 'The augmented property manager', copy: 'Approval cards per team, cleaning gated on photo proof, owner portal fed automatically.' },
    { range: '50+ properties', title: 'The steered portfolio', copy: 'Multi-organisation view, agents per property segment, exportable audit log for your owners.' },
  ],
  pricingTitle: 'Agents are included in the Pro plan.',
  pricingCopy: 'Priced per property, scaling down, with no commission on your direct bookings.',
  pricingCta: 'See all pricing',
  faqTitle: 'Frequently asked questions',
  faq: [
    {
      q: 'Do the agents decide on their own?',
      a: 'Not by default. Each agent starts in approval mode: it proposes cards you approve, adjust or dismiss. You can then switch it to automatic, agent by agent, within bounds you set.',
    },
    {
      q: 'What happens if I decline a proposal?',
      a: 'Nothing — the card is archived with your decision. The agent observes a cooldown before raising the same subject again.',
    },
    {
      q: 'Is my data used to train third-party models?',
      a: 'No. Your data stays in your organisation. Market comparables are aggregated and anonymised.',
    },
    {
      q: 'Does it work in Arabic?',
      a: 'Yes — the interface exists in Arabic (full RTL), French and English, and the agents reply to guests in their own language.',
    },
    {
      q: 'I am coming from another PMS, do I have to set everything up again?',
      a: 'No: the Baitly import brings properties, past bookings and guests across from your OTA exports, your old PMS file or your spreadsheet. Imported data fires no automation.',
    },
  ],
  finalCta: {
    title: 'Put a team of agents on your properties.',
    copy: 'A 30-minute demo, in Arabic, French or English. Or explore on your own — no card required.',
    primary: 'Book a demo',
    secondary: 'Chat on WhatsApp',
  },
};

const ar: AgentsMessages = {
  hero: {
    eyebrow: 'المنتج · وكلاء الذكاء الاصطناعي',
    title: 'فريق من وكلاء الذكاء الاصطناعي يعمل على وحداتك.',
    copyBefore:
      'تراقب كوكبة بايتلي أسعارك وإقاماتك وفرق التنظيف وقنواتك — بلا انقطاع. كل وكيل يقترح ويحاكي ويشرح. ',
    copyStrong: 'أنت تصادق، وهم ينفّذون.',
    ctaPrimary: 'شاهد الوكلاء أثناء العمل',
    ctaSecondary: 'جرّبه مجاناً',
    note: 'دون بطاقة بنكية · واجهة بالعربية والفرنسية والإنجليزية',
    metricAgentsLabel: 'وكلاء متخصّصون، لكلٍّ مهنته',
    metricBounded: 'حدود',
    metricBoundedLabel: 'حد أدنى للسعر ومهلة راحة، تحدّدهما أنت',
    metricTraceable: '100 %',
    metricTraceableLabel: 'من القرارات مشروحة ومسجَّلة',
  },
  trust: [
    'تسجيل النزلاء آلياً',
    'رسم الإقامة والضريبة المحلية',
    'Airbnb · Booking.com · Channex',
    'PayTabs · CMI / PayZone · Stripe',
  ],
  agentsTitle: 'وكلاء بأسماء، لكلٍّ مهنته.',
  agentsCopy:
    'ليست «خاصية ذكاء اصطناعي» غامضة: فريق لكل عضو فيه نطاقه وضوابطه وسجلّ نشاطه.',
  agentBadge: 'آلي أو بمصادقة',
  watchesLabel: 'يراقب',
  proposesLabel: 'يقترح',
  agents: [
    { id: 'rev', name: 'الإيرادات', watches: 'الإشغال لكل فترة، ووتيرة الحجز، والموسمية، وأسعار السوق.', proposes: 'تعديلات سعرية محدودة (بحدٍّ أدنى مضمون)، تُحاكى قبل التطبيق.' },
    { id: 'com', name: 'التواصل', watches: 'رسائل النزلاء الواردة، على كل القنوات وبكل اللغات.', proposes: 'ردوداً جاهزة للإرسال، مترجمة، مستندة إلى دليل الاستقبال.' },
    { id: 'ops', name: 'العمليات', watches: 'جدول التنظيف، والإثباتات المصوّرة، والأعطال والصيانة.', proposes: 'مهامّ مُسندة إلى الفرق المناسبة، ودفعاً مشروطاً بالإثبات.' },
    { id: 'sync', name: 'المزامنة', watches: 'مزامنة القنوات، وتعارضات التقويم، والإعلانات.', proposes: 'تصحيحات المزامنة وتنبيهات قبل وقوع أي تداخل.' },
    { id: 'fin', name: 'المالية', watches: 'التحصيلات، والتأمينات، والعمولات، وكشوف الملّاك.', proposes: 'تسويات، وتذكيرات بالدفع، وكشوفاً جاهزة للإرسال.' },
    { id: 'cmp', name: 'الامتثال', watches: 'تسجيل النزلاء، والضرائب المحلية، والوثائق والمواعيد النظامية.', proposes: 'إقرارات للمصادقة وتنبيهات قبل كل موعد.' },
    { id: 'gst', name: 'الضيف', watches: 'الإقامة الجارية: الوصول، والملاحظات، والطلبات، والمغادرة.', proposes: 'لفتةً في وقتها، وخدمات إضافية مناسبة.' },
    { id: 'rep', name: 'التقييمات والسمعة', watches: 'التقييمات المنشورة، والتقديرات حسب المعيار، والردود المعلّقة.', proposes: 'ردوداً محرَّرة وإنذاراً حين يتراجع التقدير.' },
    { id: 'own', name: 'المالك', watches: 'الأداء لكل مالك، والكشوف، ومواعيد العقود.', proposes: 'كشوفاً شهرية وتحديثات للإرسال.' },
    { id: 'gro', name: 'النمو', watches: 'التوزيع، وظهور الإعلانات، والقنوات غير المستغلّة.', proposes: 'خطوات استقطاب وفتح قنوات للمفاضلة بينها.' },
  ],
  hitl: {
    title: 'القرار يبقى بيدك. فعلاً.',
    copy:
      'الطيار الآلي الكامل لا يمنح الثقة — ولا ينبغي له. بُني بايتلي على مبدأ الإنسان في الحلقة أولاً.',
    points: [
      'كل اقتراح يصل كبطاقة للمصادقة — لا شيء يخرج دونك.',
      'حوّل وكيلاً إلى الوضع الآلي متى كسب ثقتك، وكيلاً بعد وكيل.',
      'كل قرار مشروح بلغة واضحة: السبب، والحدود، والمحاكاة.',
      'سجلّ تدقيق يحفظ كل شيء: من صادق على ماذا، ومتى، وبأي أثر.',
    ],
  },
  capabilitiesTitle: 'كل ما تقدر عليه الكوكبة.',
  tabs: [
    {
      key: 'pricing',
      label: 'التسعير والإيرادات',
      title: 'تسعير فترةً بفترة، لا على عمى',
      copy: 'خفض موجَّه دون 55 % إشغالاً، ورفع فوق 85 %، ومهلة راحة 14 يوماً بين تعديلين، وحدّ أدنى لا يُمس. والكل مُحاكى قبل التطبيق.',
      rows: ['السعر الليلي على التقويم', 'تجاوزات لكل فترة', 'المواسم والعروض', 'بيانات السوق حسب المدينة'],
    },
    {
      key: 'guests',
      label: 'رسائل النزلاء',
      title: 'ردود جاهزة، بلغة النزيل',
      copy: 'مسوّدات مولَّدة من دليل الاستقبال وسجلّ الإقامة، تُرسَل يدوياً أو آلياً حسب القالب. واتساب وبريد ورسائل في مكان واحد.',
      rows: ['صندوق موحّد متعدّد القنوات', 'قوالب لكل حدث', 'ترجمة عربية/فرنسية/إنجليزية', 'استرجاع السلّة المباشرة'],
    },
    {
      key: 'ops',
      label: 'عمليات التنظيف',
      title: 'تنظيف مُسنَد ومُثبَت ومدفوع',
      copy: 'كل مغادرة تولّد المهمة، ويسندها الوكيل حسب التوفّر، ويشترط الإثبات المصوّر لدفع مستحق المزوّد.',
      rows: ['جدولة آلية بعد المغادرة', 'قوائم تحقّق لكل وحدة', 'إثبات مصوّر إلزامي', 'دفعات مشروطة'],
    },
    {
      key: 'watch',
      label: 'الإشراف',
      title: 'كوكبة واحدة، ولوحة واحدة',
      copy: 'يعرض سجلّ النشاط ما فعله كل وكيل، آلياً أو بعد مصادقتك. وعدّادات البطاقات المعلّقة في الشريط الجانبي.',
      rows: ['سجلّ لحظي', 'طابور بطاقات للمعالجة', 'مفاتيح آلي/مصادقة لكل وكيل', 'سجل تدقيق قابل للتصدير'],
    },
  ],
  transparency: {
    eyebrow: 'لا صندوق أسود',
    title: 'كل قرار موثَّق.',
    copy:
      'قواعد التسعير محدودة وواضحة: عتبات الإشغال، والحد الأدنى للسعر، ومهل الراحة، ومحاكاة المرونة. ننشر كيف يقرّر وكلاؤنا — لأن أداةً تُؤتمَن على إيراداتك يجب أن تقدر على تفسير نفسها.',
    cta: 'اقرأ «كيف يقرّر التسعير لدينا»',
    points: [
      'حدود صريحة: لا نزول تحت حدّك الأدنى، ولا أكثر من تعديل واحد لكل فترة كل خمسة عشر يوماً.',
      'محاكاة قبل الفعل: الأثر المقدَّر بالليالي وبالإيراد، معروضاً على كل بطاقة.',
      'سجلّ تدقيق: كل فعل لوكيل مؤرَّخ ومنسوب وقابل للتراجع.',
    ],
  },
  segmentsTitle: 'لكل حجم محفظة استعماله.',
  segments: [
    { range: 'من 1 إلى 5 وحدات', title: 'الطيار الآلي البسيط', copy: 'يتولى الوكلاء الرسائل والأسعار بينما يبقى وقتك لك. مصادقة من الهاتف بنقرتين.' },
    { range: 'من 5 إلى 50 وحدة', title: 'شركة إدارة معزَّزة', copy: 'بطاقات مصادقة لكل فريق، وتنظيف مشروط بالإثبات المصوّر، وبوابة ملّاك تُغذّى تلقائياً.' },
    { range: 'أكثر من 50 وحدة', title: 'محفظة مُدارة', copy: 'رؤية متعدّدة المنشآت، ووكلاء حسب فئة العقارات، وسجل تدقيق قابل للتصدير لملّاكك.' },
  ],
  pricingTitle: 'الوكلاء مشمولون في الباقة المتقدّمة.',
  pricingCopy: 'سعر لكل وحدة، متناقص، دون عمولة على حجوزاتك المباشرة.',
  pricingCta: 'اطّلع على كل الأسعار',
  faqTitle: 'أسئلة متكرّرة',
  faq: [
    {
      q: 'هل يقرّر الوكلاء بمفردهم؟',
      a: 'لا، ليس افتراضياً. يبدأ كل وكيل في وضع المصادقة: يقترح بطاقات تصادق عليها أو تعدّلها أو تتجاهلها. ثم يمكنك تحويله إلى الوضع الآلي، وكيلاً بعد وكيل، ضمن حدود تضعها أنت.',
    },
    {
      q: 'ماذا يحدث إن رفضت اقتراحاً؟',
      a: 'لا شيء — تُؤرشَف البطاقة مع قرارك. ويلتزم الوكيل بمهلة راحة قبل إعادة طرح الموضوع نفسه.',
    },
    {
      q: 'هل تُستخدم بياناتي لتدريب نماذج طرف ثالث؟',
      a: 'لا. تبقى بياناتك داخل منشأتك. ومقارنات السوق مجمَّعة ومجهَّلة.',
    },
    {
      q: 'هل يعمل بالعربية؟',
      a: 'نعم — الواجهة متوفرة بالعربية (باتجاه كامل من اليمين)، وبالفرنسية والإنجليزية، ويردّ الوكلاء على النزلاء بلغتهم.',
    },
    {
      q: 'أنا قادم من نظام آخر، هل أعيد الإعداد من الصفر؟',
      a: 'لا: يستعيد استيراد بايتلي الوحدات والحجوزات السابقة والنزلاء من ملفات المنصّات أو من نظامك السابق أو من جدولك. والبيانات المستورَدة لا تُشغّل أي أتمتة.',
    },
  ],
  finalCta: {
    title: 'ضع فريق وكلاء على وحداتك.',
    copy: 'عرض في ثلاثين دقيقة، بالعربية أو الفرنسية أو الإنجليزية. أو استكشفه بنفسك — دون بطاقة بنكية.',
    primary: 'احجز عرضاً توضيحياً',
    secondary: 'تحدّث على واتساب',
  },
};

export const AGENTS_MESSAGES: Record<SiteLanguage, AgentsMessages> = { fr, en, ar };
