import type { SiteLanguage } from '../siteLanguage';

/**
 * Copie de la page d'accueil, dans les trois langues.
 *
 * <p>Un dictionnaire par langue, de meme forme — comme le corpus juridique. Un
 * texte de marketing se relit comme un texte : eclate en clés plates, il ne se
 * relit plus, et personne ne voit qu'une promesse a derive.</p>
 *
 * <p>Les titres coupes a dessein gardent leurs deux moitiés (`…1`, `…2`) : la
 * cesure fait partie de la composition, et l'arabe ne la place pas au meme
 * endroit que le francais.</p>
 */
const fr = {
  hero: {
    title1: 'Faites grandir vos revenus.',
    title2: 'Pas votre charge de travail.',
    lead1: 'Avec les agents IA de Baitly, automatisez les tâches répétitives, ajustez vos tarifs',
    lead2: 'et développez vos ventes directes et vos services additionnels.',
    description:
      'Un PMS pensé pour améliorer votre rentabilité au quotidien, en tenant compte des réglementations de l’Arabie saoudite, du Maroc et de la France.',
    demo: 'Réserver une démo',
    watch: 'Voir Baitly en action',
    reassurance1: 'Sans engagement',
    reassurance2: 'Démo personnalisée de 30 min',
    photoAlt: 'Une hôte à la réception consulte le planning Baitly',
    photoCaption: 'Le planning sous les yeux. L’esprit à l’accueil.',
    noteLabel: 'Votre équipe d’agents IA',
    agentDeck: [
      {
        agent: 'Communication',
        title: 'Le prochain séjour se prépare.',
        detail: 'Message d’accueil prêt. Équipe informée.',
      },
      {
        agent: 'Revenue',
        title: 'Trois nuits creuses à Marrakech.',
        detail: 'Baisse proposée, plancher de 680 MAD respecté.',
      },
      {
        agent: 'Opérations',
        title: 'Départ tardif accepté.',
        detail: 'Le ménage s’est replanifié tout seul.',
      },
      {
        agent: 'Conformité',
        title: 'Voyageur enregistré.',
        detail: 'Fiche de police au format DGSN, transmise.',
      },
      {
        agent: 'Synchronisation',
        title: 'Réservation reçue sur Airbnb.',
        detail: 'Les mêmes dates fermées ailleurs.',
      },
      {
        agent: 'Finance',
        title: 'Encaissement CMI confirmé.',
        detail: '4 800 MAD reçus, facture émise.',
      },
      {
        agent: 'Voyageur',
        title: 'Départ tardif vendu.',
        detail: '150 MAD, proposés dans le livret d’accueil.',
      },
      {
        agent: 'Avis & Réputation',
        title: 'Avis 5 étoiles publié.',
        detail: 'Réponse rédigée, prête à envoyer.',
      },
      {
        agent: 'Propriétaire',
        title: 'Relevé de juillet prêt.',
        detail: 'Net à verser et commission, en dirhams.',
      },
      {
        agent: 'Croissance',
        title: 'Votre site direct a converti.',
        detail: 'Zéro commission sur cette réservation.',
      },
      {
        agent: 'Objets connectés',
        title: 'Code d’entrée généré.',
        detail: 'Valable du check-in au départ, pas après.',
      },
    ],
    noteTitle: 'Le prochain séjour se prépare.',
    noteBody: 'Message d’accueil prêt. Équipe informée.',
    exampleLabel: 'Scène illustrative générée avec IA · planning Baitly',
    audience: 'Pour les hôtes, les istirahas et les conciergeries.',
    scroll: 'Prenez le temps d’accueillir',
  },
  channels: {
    aria: 'Intégrations disponibles',
    line1: 'Vos outils préférés.',
    line2: 'Enfin réunis.',
  },
  platform: {
    label: 'Un seul espace, tout votre métier',
    title1: 'Moins d’onglets.',
    title2: 'Plus de présence.',
    intro:
      'Du premier clic au prochain check-in, Baitly relie chaque détail du séjour. Et vous redonne une vue d’ensemble.',
    planningNumber: '01 / PILOTER',
    planningTitle1: 'Votre activité,',
    planningTitle2: 'en un regard.',
    planningCopy:
      'Un planning partagé. Tous vos logements, tous vos canaux, les bonnes informations au bon endroit.',
    planningLink: 'Découvrir le PMS',
    planningAria: 'Planning PMS animé : réservations, canaux et disponibilités',
    directPhotoAlt:
      'Chambre meublée et préparée, prête à accueillir des voyageurs',
    directNoteTitle: 'Votre adresse. Votre site.',
    directNoteBody: 'La réservation, en direct.',
    directNumber: '02 / DÉVELOPPER',
    directTitle1: 'Le prochain séjour',
    directTitle2: 'commence chez vous.',
    directCopy:
      'Un site à votre image et un moteur de réservation intégré pour créer une relation directe avec vos voyageurs.',
    directLink: 'Explorer la réservation directe',
  },
  local: {
    photoAlt: 'Kingdom Centre dans le paysage urbain de Riyad',
    rootsLine1: 'Des racines locales.',
    rootsLine2: 'Une vision sans frontières.',
    label: 'Arabie saoudite, Maroc, France : dès le lancement.',
    title1: 'À l’aise avec votre métier.',
    title2: 'Et votre réalité.',
    copy: 'Une istiraha à Riyad ne se gère pas comme un appartement à Paris. Votre outil doit connaître la différence.',
    points: [
      [
        'Des arrivées déclarées',
        'Shomoos (شموس) en Arabie saoudite, fiche de police DGSN au Maroc, fiche de police des voyageurs étrangers en France.',
      ],
      [
        'Une fiscalité juste du premier coup',
        'TVA à 15 %, frais municipaux et facture ZATCA en Arabie saoudite, taxe de séjour par commune au Maroc et en France, facture électronique Factur-X en France.',
      ],
      [
        'Des paiements que vos voyageurs utilisent',
        'PayTabs en riyals, CMI, PayZone et YouCan Pay en dirhams, Stripe en euros.',
      ],
      [
        'Des règles de location tenues',
        'Numéro d’enregistrement en mairie et plafond de 120 nuits par an pour une résidence principale en France.',
      ],
      [
        'Votre langue, vraiment',
        'Français, anglais et arabe, lecture de droite à gauche, calendrier hégirien.',
      ],
    ] as ReadonlyArray<readonly [string, string]>,
    link: 'Voir Baitly dans votre pays',
    supportTitle: 'Vous lancez votre digitalisation ?',
    supportBody:
      'Parlons migration, accompagnement et aides à la digitalisation lors de votre démo.',
  },
  faq: {
    label: 'On en parle ?',
    title1: 'Les bonnes questions,',
    title2: 'avant de se lancer.',
    link: 'Échanger avec notre équipe',
    items: [
      [
        'Est-ce adapté à mon nombre de logements ?',
        'Baitly s’adresse aux hôtes indépendants, aux istirahas et aux conciergeries. La démo permet de parcourir les modules utiles à votre organisation, que vous gériez un logement ou un portefeuille.',
      ],
      [
        'Les agents IA prennent-ils les décisions à ma place ?',
        'Vous définissez leur autonomie. Les actions qui demandent votre accord vous sont présentées avec leur contexte : vous pouvez approuver, ajuster ou refuser. Les décisions sont journalisées.',
      ],
      [
        'Puis-je garder mes annonces Airbnb et Booking.com ?',
        'Oui. Baitly réunit vos réservations et synchronise les disponibilités de vos canaux connectés. Vous conservez vos annonces et vos comptes existants.',
      ],
      [
        'Comment se passe le changement de logiciel ?',
        'Nous faisons le point sur vos logements, vos canaux et vos données pour préparer la migration. Le périmètre et les étapes sont définis avec vous avant la bascule.',
      ],
    ] as ReadonlyArray<readonly [string, string]>,
  },
  final: {
    label: 'Votre prochain chapitre commence ici',
    title1: 'Laissez de la place',
    title2: 'à ce qui compte.',
    copy1: '30 minutes pour découvrir ce que Baitly',
    copy2: 'peut changer dans votre quotidien.',
    cta: 'Rencontrons-nous',
    note: 'En arabe, en français ou en anglais. Sans engagement.',
  },
};

export type HomeMessages = typeof fr;

const en: HomeMessages = {
  hero: {
    title1: 'Grow your revenue.',
    title2: 'Not your workload.',
    lead1: 'With Baitly’s AI agents, automate repetitive tasks, adjust your rates',
    lead2: 'and grow your direct bookings and add-on sales.',
    description:
      'A PMS designed to improve your day-to-day profitability, with the regulatory requirements of Saudi Arabia, Morocco and France in mind.',
    demo: 'Book a demo',
    watch: 'See Baitly in action',
    reassurance1: 'No commitment',
    reassurance2: '30-minute tailored demo',
    photoAlt: 'A host at reception checks the Baitly calendar',
    photoCaption: 'Your calendar in view. Your mind on your guests.',
    noteLabel: 'Your team of AI agents',
    agentDeck: [
      {
        agent: 'Communication',
        title: 'The next stay is getting ready.',
        detail: 'Welcome message drafted. Team notified.',
      },
      {
        agent: 'Revenue',
        title: 'Three empty nights in Riyadh.',
        detail: 'Cut proposed, 450 SAR floor respected.',
      },
      {
        agent: 'Operations',
        title: 'Late checkout accepted.',
        detail: 'Housekeeping rescheduled itself.',
      },
      {
        agent: 'Compliance',
        title: 'Guest registered with Shomoos.',
        detail: 'Filing sent, nothing to re-enter.',
      },
      {
        agent: 'Sync',
        title: 'Booking received on Airbnb.',
        detail: 'The same dates closed everywhere else.',
      },
      {
        agent: 'Finance',
        title: 'PayTabs payment confirmed.',
        detail: '1,850 SAR received, ZATCA invoice issued.',
      },
      {
        agent: 'Guest',
        title: 'Late checkout sold.',
        detail: '60 SAR, offered in the guest guide.',
      },
      {
        agent: 'Reviews',
        title: 'Five-star review published.',
        detail: 'Reply drafted, ready to send.',
      },
      {
        agent: 'Owner',
        title: 'July statement ready.',
        detail: 'Net payout and commission, in riyals.',
      },
      {
        agent: 'Growth',
        title: 'Your direct site converted.',
        detail: 'No commission on this booking.',
      },
      {
        agent: 'Connected devices',
        title: 'Entry code generated.',
        detail: 'Valid from check-in to departure, not after.',
      },
    ],
    noteTitle: 'The next stay is being prepared.',
    noteBody: 'Welcome message ready. Team notified.',
    exampleLabel: 'AI-generated illustrative scene · Baitly calendar',
    audience: 'For hosts, istirahas and property managers.',
    scroll: 'Take the time to welcome',
  },
  channels: {
    aria: 'Available integrations',
    line1: 'Your favourite tools.',
    line2: 'Together at last.',
  },
  platform: {
    label: 'One place, your whole trade',
    title1: 'Fewer tabs.',
    title2: 'More presence.',
    intro:
      'From the first click to the next check-in, Baitly connects every detail of the stay. And gives you the whole picture back.',
    planningNumber: '01 / RUN',
    planningTitle1: 'Your business,',
    planningTitle2: 'at a glance.',
    planningCopy:
      'One shared planning board. Every property, every channel, the right information in the right place.',
    planningLink: 'Explore the PMS',
    planningAria: 'Animated PMS planning: bookings, channels and availability',
    directPhotoAlt: 'A furnished bedroom, made up and ready for guests',
    directNoteTitle: 'Your address. Your site.',
    directNoteBody: 'Booking, direct.',
    directNumber: '02 / GROW',
    directTitle1: 'The next stay',
    directTitle2: 'starts at your place.',
    directCopy:
      'A site in your image and a built-in booking engine, to build a direct relationship with your guests.',
    directLink: 'Explore direct booking',
  },
  local: {
    photoAlt: 'Kingdom Centre in the Riyadh skyline',
    rootsLine1: 'Local roots.',
    rootsLine2: 'A view without borders.',
    label: 'Saudi Arabia, Morocco, France: from day one.',
    title1: 'At ease with your trade.',
    title2: 'And your reality.',
    copy: 'An istiraha in Riyadh is not run like a flat in Paris. Your tool should know the difference.',
    points: [
      [
        'Arrivals properly declared',
        'Shomoos (شموس) in Saudi Arabia, DGSN police records in Morocco, police records for foreign guests in France.',
      ],
      [
        'Tax right the first time',
        '15% VAT, municipality fees and ZATCA invoicing in Saudi Arabia, tourist tax by municipality in Morocco and France, Factur-X e-invoicing in France.',
      ],
      [
        'Payments your guests actually use',
        'PayTabs in riyals, CMI, PayZone and YouCan Pay in dirhams, Stripe in euros.',
      ],
      [
        'Rental rules kept',
        'Town hall registration number and a 120-night yearly cap for a main residence in France.',
      ],
      [
        'Your language, properly',
        'French, English and Arabic, right-to-left reading, Hijri calendar.',
      ],
    ],
    link: 'See Baitly in your country',
    supportTitle: 'Starting your digital shift?',
    supportBody:
      'Let’s talk migration, onboarding and digitalisation support at your demo.',
  },
  faq: {
    label: 'Shall we talk?',
    title1: 'The right questions,',
    title2: 'before you start.',
    link: 'Talk to our team',
    items: [
      [
        'Does it suit the number of properties I have?',
        'Baitly is for independent hosts, istirahas and property managers. The demo walks through the modules that matter to your organisation, whether you run one property or a portfolio.',
      ],
      [
        'Do the AI agents decide in my place?',
        'You set how much autonomy they have. Actions that need your approval are shown with their context: you can approve, adjust or refuse. Decisions are logged.',
      ],
      [
        'Can I keep my Airbnb and Booking.com listings?',
        'Yes. Baitly brings your bookings together and syncs availability across your connected channels. You keep your listings and your existing accounts.',
      ],
      [
        'How does switching software work?',
        'We review your properties, your channels and your data to prepare the migration. The scope and the steps are agreed with you before the switch.',
      ],
    ],
  },
  final: {
    label: 'Your next chapter starts here',
    title1: 'Make room',
    title2: 'for what matters.',
    copy1: '30 minutes to see what Baitly',
    copy2: 'can change in your day-to-day.',
    cta: 'Let’s meet',
    note: 'In Arabic, French or English. No commitment.',
  },
};

const ar: HomeMessages = {
  hero: {
    title1: 'نمِّ إيراداتك.',
    title2: 'لا أعباء عملك.',
    lead1: 'مع وكلاء الذكاء الاصطناعي في بيتلي، أتمت المهام المتكررة واضبط أسعارك',
    lead2: 'وطوّر حجوزاتك المباشرة ومبيعات خدماتك الإضافية.',
    description:
      'نظام إدارة عقارات مصمّم لتحسين ربحيتك اليومية، مع مراعاة المتطلبات التنظيمية في السعودية والمغرب وفرنسا.',
    demo: 'احجز عرضاً توضيحياً',
    watch: 'شاهد بيتلي أثناء العمل',
    reassurance1: 'بلا التزام',
    reassurance2: 'عرض مخصّص في 30 دقيقة',
    photoAlt: 'مضيفة في الاستقبال تتابع جدول بيتلي',
    photoCaption: 'الجدول أمامك. واهتمامك بضيوفك.',
    noteLabel: 'فريقك من وكلاء الذكاء الاصطناعي',
    agentDeck: [
      {
        agent: 'التواصل',
        title: 'الإقامة القادمة قيد التحضير.',
        detail: 'رسالة الترحيب جاهزة. والفريق على علم.',
      },
      {
        agent: 'الإيرادات',
        title: 'ثلاث ليالٍ فارغة في الرياض.',
        detail: 'اقتُرح خفض، مع احترام حدّ 450 ر.س.',
      },
      {
        agent: 'العمليات',
        title: 'قُبلت مغادرة متأخرة.',
        detail: 'وأُعيدت جدولة التنظيف وحدها.',
      },
      {
        agent: 'الامتثال',
        title: 'سُجِّل النزيل في شموس.',
        detail: 'أُرسل الإقرار، ولا شيء يُعاد إدخاله.',
      },
      {
        agent: 'المزامنة',
        title: 'وصل حجز من Airbnb.',
        detail: 'وأُغلقت التواريخ نفسها في بقية القنوات.',
      },
      {
        agent: 'المالية',
        title: 'تأكّد التحصيل عبر PayTabs.',
        detail: 'وصل 1٬850 ر.س، وصدرت الفاتورة الإلكترونية.',
      },
      {
        agent: 'الضيف',
        title: 'بيعت مغادرة متأخرة.',
        detail: '60 ر.س، عُرضت في دليل الاستقبال.',
      },
      {
        agent: 'التقييمات',
        title: 'نُشر تقييم بخمس نجوم.',
        detail: 'الرد محرَّر وجاهز للإرسال.',
      },
      {
        agent: 'المالك',
        title: 'كشف يوليو جاهز.',
        detail: 'الصافي والعمولة، بالريال.',
      },
      {
        agent: 'النمو',
        title: 'موقعك المباشر حقّق حجزاً.',
        detail: 'بلا أي عمولة على هذا الحجز.',
      },
      {
        agent: 'الأجهزة المتصلة',
        title: 'أُنشئ رمز الدخول.',
        detail: 'صالح من الوصول إلى المغادرة، لا بعدها.',
      },
    ],
    noteTitle: 'الإقامة القادمة قيد التحضير.',
    noteBody: 'رسالة الترحيب جاهزة. والفريق على علم.',
    exampleLabel: 'مشهد توضيحي مولّد بالذكاء الاصطناعي · جدول بيتلي',
    audience: 'للمضيفين، والاستراحات، وشركات الإدارة.',
    scroll: 'خُذ وقتك في حسن الاستقبال',
  },
  channels: {
    aria: 'التكاملات المتاحة',
    line1: 'أدواتك المفضّلة.',
    line2: 'مجتمعة أخيراً.',
  },
  platform: {
    label: 'مساحة واحدة، ومهنتك كلها',
    title1: 'تبويبات أقل.',
    title2: 'وحضور أكبر.',
    intro:
      'من النقرة الأولى إلى الوصول التالي، تربط بيتلي كل تفصيل من الإقامة. وتعيد إليك الصورة كاملة.',
    planningNumber: '01 / القيادة',
    planningTitle1: 'نشاطك،',
    planningTitle2: 'في نظرة واحدة.',
    planningCopy:
      'لوحة تخطيط مشتركة. كل عقاراتك، وكل قنواتك، والمعلومة المناسبة في مكانها.',
    planningLink: 'اكتشف نظام الإدارة',
    planningAria: 'لوحة تخطيط متحركة: الحجوزات والقنوات والتوفر',
    directPhotoAlt: 'غرفة نوم مفروشة ومجهّزة، جاهزة لاستقبال النزلاء',
    directNoteTitle: 'عنوانك. وموقعك.',
    directNoteBody: 'والحجز مباشرةً.',
    directNumber: '02 / النمو',
    directTitle1: 'الإقامة القادمة',
    directTitle2: 'تبدأ من عندك.',
    directCopy: 'موقع على صورتك ومحرك حجز مدمج، لبناء علاقة مباشرة مع نزلائك.',
    directLink: 'استكشف الحجز المباشر',
  },
  local: {
    photoAlt: 'برج المملكة في أفق الرياض',
    rootsLine1: 'جذور محلية.',
    rootsLine2: 'ورؤية بلا حدود.',
    label: 'السعودية والمغرب وفرنسا: منذ الإطلاق.',
    title1: 'على دراية بمهنتك.',
    title2: 'وبواقعك.',
    copy: 'الاستراحة في الرياض لا تُدار كشقة في باريس. وأداتك ينبغي أن تعرف الفرق.',
    points: [
      [
        'وصول مُبلَّغ عنه حسب الأصول',
        'منصة شموس في السعودية، وبطاقة الشرطة وفق صيغة المديرية العامة للأمن الوطني في المغرب، وبطاقة الشرطة للنزلاء الأجانب في فرنسا.',
      ],
      [
        'ضريبة صحيحة من أول مرة',
        'ضريبة قيمة مضافة 15 % ورسوم بلدية وفاتورة هيئة الزكاة والضريبة والجمارك في السعودية، ورسم الإقامة حسب البلدية في المغرب وفرنسا، وفاتورة Factur-X الإلكترونية في فرنسا.',
      ],
      [
        'وسائل دفع يستخدمها نزلاؤك فعلاً',
        'PayTabs بالريال، وCMI وPayZone وYouCan Pay بالدرهم، وStripe باليورو.',
      ],
      [
        'قواعد إيجار محترمة',
        'رقم التسجيل لدى البلدية وسقف 120 ليلة سنوياً للسكن الرئيسي في فرنسا.',
      ],
      [
        'لغتك، بحق',
        'الفرنسية والإنجليزية والعربية، وقراءة من اليمين إلى اليسار، وتقويم هجري.',
      ],
    ],
    link: 'اكتشف بيتلي في بلدك',
    supportTitle: 'هل تبدأ تحوّلك الرقمي؟',
    supportBody:
      'لنتحدث في العرض التوضيحي عن الترحيل والمواكبة ودعم التحوّل الرقمي.',
  },
  faq: {
    label: 'هل نتحدث؟',
    title1: 'الأسئلة الصحيحة،',
    title2: 'قبل الانطلاق.',
    link: 'تحدّث مع فريقنا',
    items: [
      [
        'هل يناسب عدد عقاراتي؟',
        'بيتلي موجّهة للمضيفين المستقلين والاستراحات وشركات الإدارة. ويتيح العرض التوضيحي استعراض الوحدات المفيدة لمؤسستك، سواء أدرت عقاراً واحداً أو محفظة كاملة.',
      ],
      [
        'هل يقرر وكلاء الذكاء الاصطناعي بدلاً عني؟',
        'أنت من يحدّد مدى استقلاليتهم. وتُعرض عليك الإجراءات التي تتطلب موافقتك مع سياقها: يمكنك الموافقة أو التعديل أو الرفض. وتُسجَّل القرارات في السجل.',
      ],
      [
        'هل يمكنني الاحتفاظ بإعلاناتي على Airbnb وBooking.com؟',
        'نعم. تجمع بيتلي حجوزاتك وتزامن التوفر عبر قنواتك المتصلة. وتحتفظ أنت بإعلاناتك وحساباتك القائمة.',
      ],
      [
        'كيف يجري تغيير البرنامج؟',
        'نراجع معك عقاراتك وقنواتك وبياناتك لتحضير الترحيل. ويُتفق على النطاق والمراحل معك قبل التبديل.',
      ],
    ],
  },
  final: {
    label: 'فصلك التالي يبدأ هنا',
    title1: 'أفسِح مكاناً',
    title2: 'لما يستحق.',
    copy1: 'ثلاثون دقيقة لاكتشاف ما يمكن لبيتلي',
    copy2: 'أن تغيّره في يومك.',
    cta: 'لنلتقِ',
    note: 'بالعربية أو الفرنسية أو الإنجليزية. بلا التزام.',
  },
};

export const HOME_MESSAGES: Record<SiteLanguage, HomeMessages> = { fr, en, ar };
