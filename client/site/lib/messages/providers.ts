import type { SiteLanguage } from '../siteLanguage';

/**
 * Marketplace prestataires : la page `/prestataires` et les donnees qu'elle
 * affiche (metiers, parcours, arguments).
 *
 * <p>Le parcours d'inscription lui-meme a deja son dictionnaire
 * (`providerSignupMessages`) : c'est lui qui a servi de modele a tout le
 * reste du site.</p>
 */
const fr = {
  eyebrow: 'Marketplace prestataires',
  titleBefore: 'Vous rendez les logements impeccables. ',
  titleAccent: 'Baitly vous apporte les missions.',
  intro:
    'Ménage, maintenance, blanchisserie, jardin, accueil : rejoignez le réseau de prestataires Baitly et recevez un flux régulier d’interventions près de chez vous — planning, preuves photo et paiement, tout au même endroit.',
  ctaJoin: 'Devenir prestataire',
  ctaWhatsapp: 'En parler sur WhatsApp',
  statsTitle: 'Rejoindre, en clair',
  stats: [
    { value: '48 h', label: 'Validation du profil' },
    { value: '0', label: 'Inscription & abonnement' },
    { value: '6', label: 'Métiers référencés' },
    { value: 'À la preuve', label: 'Déclenchement du paiement' },
  ],
  statsNote:
    'Baitly prélève une commission de mise en relation uniquement sur les missions réalisées. Aucun frais tant que vous ne travaillez pas.',
  showcaseTitle: 'Ils vendent déjà leurs services sur Baitly',
  showcaseCopy:
    'Artisans, équipes et indépendants : chacun publie son offre, ses tarifs et sa zone. Les hôtes réservent directement depuis le PMS.',
  sampleNotice: 'Profils d’illustration — la place de marché ouvre avec le lancement.',
  verified: 'Pièces vérifiées',
  insured: 'Assurance à jour',
  zone: 'Zone',
  from: 'dès',
  profiles: [
    {
      name: 'Fatima Z.',
      trade: 'Ménage & entretien',
      city: 'Riyad · Al-Olaya',
      kind: 'Indépendante',
      services: ['Ménage entre deux séjours', 'Remise en état', 'Réassort consommables'],
      price: '90 SAR',
      unit: '/intervention',
    },
    {
      name: 'Atlas Plomberie',
      trade: 'Maintenance & petits travaux',
      city: 'Djeddah · Al-Hamra',
      kind: 'Entreprise · 4 techniciens',
      services: ['Dépannage urgent 24/7', 'Plomberie & sanitaires', 'Électricité'],
      price: '150 SAR',
      unit: '/heure',
    },
    {
      name: 'Pressing Al Wafa',
      trade: 'Blanchisserie & linge',
      city: 'Riyad · Al-Malqa',
      kind: 'Entreprise',
      services: ['Collecte & livraison', 'Linge hôtelier', 'Repassage'],
      price: '12 SAR',
      unit: '/kg',
    },
    {
      name: 'Youssef A.',
      trade: 'Accueil & conciergerie',
      city: 'Riyad · Diriyah',
      kind: 'Indépendant',
      services: ['Check-in en personne', 'Remise de clés', 'Assistance voyageurs'],
      price: '120 SAR',
      unit: '/accueil',
    },
  ],
  activeTitle: 'Les prestataires les plus actifs',
  activeCopy:
    'Toutes les régions, tous les métiers : la place de marché n’est pas réservée aux grandes structures.',
  activeColumns: { provider: 'Prestataire', trade: 'Métier', area: 'Zone', missions: 'Missions' },
  activeProfiles: [
    { name: 'Fatima Z.', trade: 'Ménage & entretien', area: 'Riyad', missions: 128, kind: 'Indépendante' },
    { name: 'Atlas Plomberie', trade: 'Maintenance', area: 'Djeddah', missions: 96, kind: 'Entreprise' },
    { name: 'Pressing Al Wafa', trade: 'Blanchisserie', area: 'Riyad', missions: 84, kind: 'Entreprise' },
    { name: 'Nour H.', trade: 'Jardin & piscine', area: 'Khobar', missions: 61, kind: 'Indépendante' },
    { name: 'Youssef A.', trade: 'Accueil & conciergerie', area: 'Diriyah', missions: 57, kind: 'Indépendant' },
    { name: 'Chef Karim', trade: 'Chef & expériences', area: 'Djeddah', missions: 43, kind: 'Indépendant' },
  ],
  categoriesTitle: 'Quel que soit votre métier, il a sa place.',
  categoriesCopy:
    'Vous proposez déjà un service autour de la location courte durée ? Publiez votre offre et laissez les hôtes et conciergeries venir à vous.',
  categories: [
    {
      name: 'Ménage & entretien',
      copy: 'Ménage entre deux séjours, remise en état, réassort des consommables.',
      examples: ['Femme / homme de ménage', 'Équipe de nettoyage', 'Remise en état après séjour'],
    },
    {
      name: 'Maintenance & petits travaux',
      copy: 'Plomberie, électricité, serrurerie, dépannages et interventions urgentes.',
      examples: ['Plombier / électricien', 'Bricoleur multiservices', 'Astreinte urgence 24/7'],
    },
    {
      name: 'Blanchisserie & linge',
      copy: 'Collecte, lavage, repassage et livraison du linge de maison et de toilette.',
      examples: ['Pressing / laverie', 'Location de linge hôtelier', 'Collecte & livraison'],
    },
    {
      name: 'Jardin & piscine',
      copy: 'Entretien des espaces verts, nettoyage et traitement des piscines.',
      examples: ['Jardinier / paysagiste', 'Pisciniste', 'Traitement de l’eau'],
    },
    {
      name: 'Accueil & conciergerie',
      copy: 'Check-in / check-out en personne, remise des clés, assistance voyageurs.',
      examples: ['Agent d’accueil', 'Remise de clés', 'Conciergerie de proximité'],
    },
    {
      name: 'Chef & expériences',
      copy: 'Chef à domicile, traiteur, transferts et activités vendus aux voyageurs.',
      examples: ['Chef à domicile', 'Chauffeur / transferts', 'Guide & activités'],
    },
  ],
  howTitle: 'De l’inscription au paiement, en quatre temps.',
  howBadge: 'Comment ça marche',
  steps: [
    {
      title: 'Créez votre profil',
      copy: 'Métier, zone d’intervention, tarifs, disponibilités et pièces justificatives. Validation sous 48 h.',
    },
    {
      title: 'Recevez des missions',
      copy: 'Les hôtes et conciergeries autour de vous vous proposent des interventions. Zéro prospection.',
    },
    {
      title: 'Intervenez & prouvez',
      copy: 'Check-list mobile, photos avant / après et validation en un geste depuis votre téléphone.',
    },
    {
      title: 'Soyez payé, sans relance',
      copy: 'Paiement déclenché à la preuve, viré par la plateforme. Fini les factures qui traînent.',
    },
  ],
  appEyebrow: 'L’application prestataire',
  appTitle: 'Vos missions, votre planning, vos preuves — en un écran.',
  appCopy:
    'Retrouvez vos interventions du jour, l’adresse et les consignes de chaque logement, la check-list à cocher et les photos avant / après à joindre. Une fois validé, le paiement part tout seul.',
  appPoints: [
    'Missions assignées automatiquement selon votre zone',
    'Check-list et preuve photo obligatoires par mission',
    'Itinéraire optimisé entre deux logements',
    'Historique et revenus consultables à tout moment',
  ],
  benefitsTitle: 'Pourquoi rejoindre le réseau Baitly.',
  benefits: [
    {
      title: 'Un carnet qui se remplit',
      copy: 'Un flux régulier de missions près de chez vous, sans budget pub ni démarchage.',
    },
    {
      title: 'Paiement garanti',
      copy: 'Le règlement est sécurisé par Baitly et déclenché à la preuve de réalisation.',
    },
    {
      title: 'Une réputation qui compte',
      copy: 'Chaque mission bien faite nourrit votre note et vous ouvre plus de demandes.',
    },
    {
      title: 'Tout depuis le mobile',
      copy: 'Planning, itinéraire, check-lists et preuves photo dans une seule application.',
    },
  ],
  finalTitle: 'Prêt à remplir votre carnet de missions ?',
  finalCopy:
    'Créez votre profil en quelques minutes. C’est gratuit, et vous ne payez que sur les interventions réalisées.',
  finalQuestion: 'Poser une question',
};

export type ProvidersMessages = typeof fr;

const en: ProvidersMessages = {
  eyebrow: 'Provider marketplace',
  titleBefore: 'You keep the properties spotless. ',
  titleAccent: 'Baitly brings you the jobs.',
  intro:
    'Cleaning, maintenance, laundry, gardening, check-in: join the Baitly provider network and receive a steady flow of jobs near you — schedule, photo proof and payment, all in one place.',
  ctaJoin: 'Become a provider',
  ctaWhatsapp: 'Talk on WhatsApp',
  statsTitle: 'Joining, plainly',
  stats: [
    { value: '48 h', label: 'Profile approval' },
    { value: '0', label: 'Sign-up & subscription' },
    { value: '6', label: 'Trades listed' },
    { value: 'On proof', label: 'Payment trigger' },
  ],
  statsNote:
    'Baitly takes an introduction commission only on completed jobs. Nothing to pay while you are not working.',
  showcaseTitle: 'They already sell their services on Baitly',
  showcaseCopy:
    'Trades, teams and freelancers: each publishes their offer, their rates and their area. Hosts book straight from the PMS.',
  sampleNotice: 'Illustrative profiles — the marketplace opens with the launch.',
  verified: 'Documents verified',
  insured: 'Insurance current',
  zone: 'Area',
  from: 'from',
  profiles: [
    {
      name: 'Fatima Z.',
      trade: 'Cleaning & upkeep',
      city: 'Riyadh · Al-Olaya',
      kind: 'Freelance',
      services: ['Turnover cleaning', 'Deep clean', 'Restocking consumables'],
      price: 'SAR 90',
      unit: '/job',
    },
    {
      name: 'Atlas Plumbing',
      trade: 'Maintenance & small works',
      city: 'Jeddah · Al-Hamra',
      kind: 'Company · 4 technicians',
      services: ['24/7 emergency call-out', 'Plumbing & sanitary', 'Electrics'],
      price: 'SAR 150',
      unit: '/hour',
    },
    {
      name: 'Al Wafa Laundry',
      trade: 'Laundry & linen',
      city: 'Riyadh · Al-Malqa',
      kind: 'Company',
      services: ['Collection & delivery', 'Hotel linen', 'Ironing'],
      price: 'SAR 12',
      unit: '/kg',
    },
    {
      name: 'Youssef A.',
      trade: 'Check-in & concierge',
      city: 'Riyadh · Diriyah',
      kind: 'Freelance',
      services: ['In-person check-in', 'Key handover', 'Guest assistance'],
      price: 'SAR 120',
      unit: '/check-in',
    },
  ],
  activeTitle: 'The most active providers',
  activeCopy:
    'Every region, every trade: the marketplace is not reserved for large outfits.',
  activeColumns: { provider: 'Provider', trade: 'Trade', area: 'Area', missions: 'Jobs' },
  activeProfiles: [
    { name: 'Fatima Z.', trade: 'Cleaning & upkeep', area: 'Riyadh', missions: 128, kind: 'Freelance' },
    { name: 'Atlas Plumbing', trade: 'Maintenance', area: 'Jeddah', missions: 96, kind: 'Company' },
    { name: 'Al Wafa Laundry', trade: 'Laundry', area: 'Riyadh', missions: 84, kind: 'Company' },
    { name: 'Nour H.', trade: 'Garden & pool', area: 'Khobar', missions: 61, kind: 'Freelance' },
    { name: 'Youssef A.', trade: 'Check-in & concierge', area: 'Diriyah', missions: 57, kind: 'Freelance' },
    { name: 'Chef Karim', trade: 'Chef & experiences', area: 'Jeddah', missions: 43, kind: 'Freelance' },
  ],
  categoriesTitle: 'Whatever your trade, it has a place.',
  categoriesCopy:
    'Already offering a service around short-term rentals? Publish your offer and let hosts and property managers come to you.',
  categories: [
    {
      name: 'Cleaning & upkeep',
      copy: 'Turnover cleaning, deep cleans, restocking consumables.',
      examples: ['Cleaner', 'Cleaning team', 'Post-stay restoration'],
    },
    {
      name: 'Maintenance & small works',
      copy: 'Plumbing, electrics, locks, repairs and urgent call-outs.',
      examples: ['Plumber / electrician', 'General handyperson', '24/7 emergency cover'],
    },
    {
      name: 'Laundry & linen',
      copy: 'Collection, washing, ironing and delivery of household and bath linen.',
      examples: ['Dry cleaner / launderette', 'Hotel linen rental', 'Collection & delivery'],
    },
    {
      name: 'Garden & pool',
      copy: 'Grounds upkeep, pool cleaning and water treatment.',
      examples: ['Gardener / landscaper', 'Pool technician', 'Water treatment'],
    },
    {
      name: 'Check-in & concierge',
      copy: 'In-person check-in and check-out, key handover, guest assistance.',
      examples: ['Welcome agent', 'Key handover', 'Local concierge'],
    },
    {
      name: 'Chef & experiences',
      copy: 'Private chef, caterer, transfers and activities sold to guests.',
      examples: ['Private chef', 'Driver / transfers', 'Guide & activities'],
    },
  ],
  howTitle: 'From sign-up to payment, in four steps.',
  howBadge: 'How it works',
  steps: [
    {
      title: 'Create your profile',
      copy: 'Trade, service area, rates, availability and supporting documents. Approved within 48 hours.',
    },
    {
      title: 'Receive jobs',
      copy: 'Hosts and property managers around you offer you work. No prospecting.',
    },
    {
      title: 'Do the job & prove it',
      copy: 'Mobile checklist, before/after photos and approval in one tap from your phone.',
    },
    {
      title: 'Get paid, without chasing',
      copy: 'Payment triggered on proof, transferred by the platform. No more invoices left hanging.',
    },
  ],
  appEyebrow: 'The provider app',
  appTitle: 'Your jobs, your schedule, your proof — on one screen.',
  appCopy:
    'Find today’s jobs, each property’s address and instructions, the checklist to tick and the before/after photos to attach. Once approved, payment goes out on its own.',
  appPoints: [
    'Jobs assigned automatically by your area',
    'Checklist and photo proof required per job',
    'Optimised route between two properties',
    'History and earnings available at any time',
  ],
  benefitsTitle: 'Why join the Baitly network.',
  benefits: [
    {
      title: 'A diary that fills up',
      copy: 'A steady flow of jobs near you, with no ad budget and no cold calling.',
    },
    {
      title: 'Guaranteed payment',
      copy: 'The settlement is secured by Baitly and triggered on proof of completion.',
    },
    {
      title: 'A reputation that counts',
      copy: 'Every job well done feeds your rating and opens up more requests.',
    },
    {
      title: 'Everything from mobile',
      copy: 'Schedule, route, checklists and photo proof in a single app.',
    },
  ],
  finalTitle: 'Ready to fill your diary?',
  finalCopy:
    'Create your profile in a few minutes. It is free, and you only pay on completed jobs.',
  finalQuestion: 'Ask a question',
};

const ar: ProvidersMessages = {
  eyebrow: 'سوق المزوّدين',
  titleBefore: 'أنت تُبقي الوحدات في أبهى حال. ',
  titleAccent: 'وبايتلي يجلب إليك المهام.',
  intro:
    'تنظيف، وصيانة، وغسيل، وحدائق، واستقبال: انضم إلى شبكة مزوّدي بايتلي واستقبل تدفّقاً منتظماً من المهام قربك — الجدول والإثباتات المصوّرة والدفع، في مكان واحد.',
  ctaJoin: 'كن مزوّداً',
  ctaWhatsapp: 'تحدّث على واتساب',
  statsTitle: 'الانضمام باختصار',
  stats: [
    { value: '48 ساعة', label: 'اعتماد الملف' },
    { value: '0', label: 'التسجيل والاشتراك' },
    { value: '6', label: 'مهن مدرجة' },
    { value: 'عند الإثبات', label: 'موعد الدفع' },
  ],
  statsNote:
    'لا يأخذ بايتلي عمولة وساطة إلا على المهام المنجزة. ولا رسوم ما دمت لا تعمل.',
  showcaseTitle: 'هم يبيعون خدماتهم على بايتلي بالفعل',
  showcaseCopy:
    'حرفيون وفرق ومستقلّون: كلٌّ ينشر عرضه وأسعاره ونطاقه. والمضيفون يحجزون مباشرةً من النظام.',
  sampleNotice: 'ملفات توضيحية — يفتح السوق مع الإطلاق.',
  verified: 'وثائق موثَّقة',
  insured: 'تأمين ساري',
  zone: 'النطاق',
  from: 'من',
  profiles: [
    {
      name: 'فاطمة ز.',
      trade: 'التنظيف والعناية',
      city: 'الرياض · العليا',
      kind: 'مستقلّة',
      services: ['تنظيف بين إقامتين', 'تجهيز شامل', 'تجديد المستهلكات'],
      price: '90 ر.س',
      unit: '/مهمة',
    },
    {
      name: 'أطلس للسباكة',
      trade: 'الصيانة والأعمال الصغيرة',
      city: 'جدة · الحمراء',
      kind: 'منشأة · 4 فنّيين',
      services: ['تدخّل طارئ 24/7', 'سباكة وأدوات صحية', 'كهرباء'],
      price: '150 ر.س',
      unit: '/ساعة',
    },
    {
      name: 'مغسلة الوفاء',
      trade: 'الغسيل والبياضات',
      city: 'الرياض · الملقا',
      kind: 'منشأة',
      services: ['جمع وتوصيل', 'بياضات فندقية', 'كي'],
      price: '12 ر.س',
      unit: '/كغ',
    },
    {
      name: 'يوسف ع.',
      trade: 'الاستقبال والكونسيرج',
      city: 'الرياض · الدرعية',
      kind: 'مستقلّ',
      services: ['استقبال بحضور شخصي', 'تسليم المفاتيح', 'مساندة النزلاء'],
      price: '120 ر.س',
      unit: '/استقبال',
    },
  ],
  activeTitle: 'أكثر المزوّدين نشاطاً',
  activeCopy: 'كل المناطق وكل المهن: السوق ليس حكراً على المنشآت الكبيرة.',
  activeColumns: { provider: 'المزوّد', trade: 'المهنة', area: 'النطاق', missions: 'المهام' },
  activeProfiles: [
    { name: 'فاطمة ز.', trade: 'التنظيف والعناية', area: 'الرياض', missions: 128, kind: 'مستقلّة' },
    { name: 'أطلس للسباكة', trade: 'الصيانة', area: 'جدة', missions: 96, kind: 'منشأة' },
    { name: 'مغسلة الوفاء', trade: 'الغسيل', area: 'الرياض', missions: 84, kind: 'منشأة' },
    { name: 'نور ه.', trade: 'الحديقة والمسبح', area: 'الخبر', missions: 61, kind: 'مستقلّة' },
    { name: 'يوسف ع.', trade: 'الاستقبال والكونسيرج', area: 'الدرعية', missions: 57, kind: 'مستقلّ' },
    { name: 'الشيف كريم', trade: 'الطهاة والتجارب', area: 'جدة', missions: 43, kind: 'مستقلّ' },
  ],
  categoriesTitle: 'مهما كانت مهنتك، لها مكان هنا.',
  categoriesCopy:
    'هل تقدّم خدمة في محيط الإيجار قصير الأمد؟ انشر عرضك ودع المضيفين وشركات الإدارة يأتون إليك.',
  categories: [
    {
      name: 'التنظيف والعناية',
      copy: 'تنظيف بين إقامتين، وتجهيز شامل، وتجديد المستهلكات.',
      examples: ['عامل أو عاملة تنظيف', 'فريق تنظيف', 'تجهيز ما بعد الإقامة'],
    },
    {
      name: 'الصيانة والأعمال الصغيرة',
      copy: 'سباكة، وكهرباء، وأقفال، وإصلاحات وتدخّلات عاجلة.',
      examples: ['سبّاك أو كهربائي', 'فنّي متعدّد المهام', 'استدعاء طارئ 24/7'],
    },
    {
      name: 'الغسيل والبياضات',
      copy: 'جمع وغسل وكيّ وتوصيل بياضات المنزل والحمّام.',
      examples: ['مغسلة', 'تأجير بياضات فندقية', 'جمع وتوصيل'],
    },
    {
      name: 'الحديقة والمسبح',
      copy: 'العناية بالمساحات الخضراء، وتنظيف المسابح ومعالجة مياهها.',
      examples: ['بستاني أو منسّق حدائق', 'فنّي مسابح', 'معالجة المياه'],
    },
    {
      name: 'الاستقبال والكونسيرج',
      copy: 'استقبال ومغادرة بحضور شخصي، وتسليم المفاتيح، ومساندة النزلاء.',
      examples: ['موظف استقبال', 'تسليم مفاتيح', 'كونسيرج محلي'],
    },
    {
      name: 'الطهاة والتجارب',
      copy: 'طاهٍ في الموقع، وتموين، وتوصيل وأنشطة تُباع للنزلاء.',
      examples: ['طاهٍ خاص', 'سائق وتوصيل', 'مرشد وأنشطة'],
    },
  ],
  howTitle: 'من التسجيل إلى الدفع، في أربع خطوات.',
  howBadge: 'كيف يعمل',
  steps: [
    {
      title: 'أنشئ ملفك',
      copy: 'المهنة، ونطاق العمل، والأسعار، والتوفّر، والوثائق. الاعتماد خلال 48 ساعة.',
    },
    {
      title: 'استقبل المهام',
      copy: 'يعرض عليك المضيفون وشركات الإدارة من حولك مهامّهم. بلا أي بحث عن عملاء.',
    },
    {
      title: 'نفّذ وأثبت',
      copy: 'قائمة تحقّق على الهاتف، وصور قبل وبعد، ومصادقة بحركة واحدة.',
    },
    {
      title: 'استلم مستحقك دون مطالبة',
      copy: 'الدفع يُطلَق عند الإثبات، وتحوّله المنصّة. وانتهى زمن الفواتير المعلّقة.',
    },
  ],
  appEyebrow: 'تطبيق المزوّد',
  appTitle: 'مهامك وجدولك وإثباتاتك — في شاشة واحدة.',
  appCopy:
    'تجد مهام يومك، وعنوان كل وحدة وتعليماتها، وقائمة التحقق، وصور قبل وبعد لإرفاقها. وبمجرد الاعتماد ينطلق الدفع وحده.',
  appPoints: [
    'مهام تُسنَد تلقائياً حسب نطاقك',
    'قائمة تحقّق وإثبات مصوّر إلزاميان لكل مهمة',
    'مسار محسَّن بين وحدتين',
    'السجل والإيرادات متاحان في أي وقت',
  ],
  benefitsTitle: 'لماذا تنضم إلى شبكة بايتلي.',
  benefits: [
    {
      title: 'أجندة تمتلئ',
      copy: 'تدفّق منتظم من المهام قربك، بلا ميزانية إعلان ولا تسويق مباشر.',
    },
    {
      title: 'دفع مضمون',
      copy: 'التسوية مؤمَّنة لدى بايتلي وتُطلَق عند إثبات الإنجاز.',
    },
    {
      title: 'سمعة لها وزن',
      copy: 'كل مهمة مُتقنة ترفع تقديرك وتفتح لك طلبات أكثر.',
    },
    {
      title: 'كل شيء من الهاتف',
      copy: 'الجدول والمسار وقوائم التحقق والإثباتات المصوّرة في تطبيق واحد.',
    },
  ],
  finalTitle: 'جاهز لملء أجندتك؟',
  finalCopy: 'أنشئ ملفك في دقائق. مجاناً، ولا تدفع إلا على المهام المنجزة.',
  finalQuestion: 'اطرح سؤالاً',
};

export const PROVIDERS_MESSAGES: Record<SiteLanguage, ProvidersMessages> = { fr, en, ar };
