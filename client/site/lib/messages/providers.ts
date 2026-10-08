import type { SiteLanguage } from "../siteLanguage";

const fr = {
  eyebrow: "Marketplace de services · Inscriptions ouvertes",
  titleBefore: "Proposez vos services. ",
  titleAccent: "Trouvez de nouvelles missions.",
  intro:
    "Rejoignez la marketplace Baitly pour proposer vos services aux propriétaires, conciergeries et voyageurs. Développez votre activité ou cherchez un revenu complémentaire, avec des missions régulières ou ponctuelles.",
  ctaJoin: "Rejoindre la marketplace",
  ctaExplore: "Découvrir les métiers",
  openingNote:
    "Inscrivez-vous dès maintenant pour le lancement du réseau. Les zones d’ouverture, les frais et les conditions vous seront précisés avant toute mission.",
  previewLabel: "Aperçu produit · Mission fictive",
  previewTitle: "Un logement prêt pour l’arrivée.",
  previewCopy:
    "Les consignes, les photos et la validation réunies dans une même mission.",
  previewSteps: ["Consignes", "Photos", "Validation"],
  categoriesTitle: "À chaque séjour, les bons savoir-faire.",
  categoriesCopy:
    "De la préparation des logements aux expériences voyageurs : choisissez les services que vous souhaitez proposer.",
  howTitle: "De votre inscription à votre prochaine mission.",
  howBadge: "Au lancement",
  steps: [
    {
      title: "Présenter votre activité",
      copy: "Renseignez votre métier, votre zone et les informations utiles à l’étude de votre profil.",
    },
    {
      title: "Examiner une mission",
      copy: "Consultez le lieu, les consignes, le tarif et les conditions avant de vous engager.",
    },
    {
      title: "Partager le travail réalisé",
      copy: "Retrouvez la checklist et joignez les photos utiles à la validation de l’intervention.",
    },
    {
      title: "Suivre la validation",
      copy: "Gardez une trace de la mission et du règlement selon les modalités convenues.",
    },
  ],
  appEyebrow: "Aperçu de l’application",
  appTitle: "Le travail à faire, en un coup d’œil.",
  appCopy:
    "Le parcours de démonstration rassemble le planning, les consignes et le suivi d’une intervention. Explorez-le pour vous projeter dans votre quotidien.",
  appPoints: [
    "Le logement et les consignes de la mission",
    "Une checklist et les photos associées",
    "Un état d’avancement partagé avec l’hôte",
  ],
  sampleNotice: "Démonstration avec des données fictives.",
  appAction: "Explorer la démo des opérations",
  finalTitle: "Votre prochain chapitre commence par votre profil.",
  finalCopy:
    "Indépendant ou entreprise, activité principale ou complémentaire : présentez vos services et rejoignez les candidats au lancement de la marketplace Baitly.",
  finalQuestion: "Comprendre les étapes",
  categories: [
    {
      name: "Ménage & entretien",
      copy: "Ménage entre deux séjours, remise en état, réassort des consommables.",
      examples: [
        "Femme / homme de ménage",
        "Équipe de nettoyage",
        "Remise en état après séjour",
      ],
    },
    {
      name: "Maintenance & petits travaux",
      copy: "Plomberie, électricité, serrurerie, dépannages et interventions urgentes.",
      examples: [
        "Plombier / électricien",
        "Bricoleur multiservices",
        "Astreinte urgence 24/7",
      ],
    },
    {
      name: "Blanchisserie & linge",
      copy: "Collecte, lavage, repassage et livraison du linge de maison et de toilette.",
      examples: [
        "Pressing / laverie",
        "Location de linge hôtelier",
        "Collecte & livraison",
      ],
    },
    {
      name: "Jardin & piscine",
      copy: "Entretien des espaces verts, nettoyage et traitement des piscines.",
      examples: ["Jardinier / paysagiste", "Pisciniste", "Traitement de l’eau"],
    },
    {
      name: "Accueil & conciergerie",
      copy: "Check-in / check-out en personne, remise des clés, assistance voyageurs.",
      examples: [
        "Agent d’accueil",
        "Remise de clés",
        "Conciergerie de proximité",
      ],
    },
    {
      name: "Chef & expériences",
      copy: "Chef à domicile, traiteur, transferts et activités vendus aux voyageurs.",
      examples: [
        "Chef à domicile",
        "Chauffeur / transferts",
        "Guide & activités",
      ],
    },
  ],
};

export type ProvidersMessages = typeof fr;

const en: ProvidersMessages = {
  eyebrow: "Services marketplace · Applications open",
  titleBefore: "Offer your services. ",
  titleAccent: "Find new opportunities.",
  intro:
    "Join the Baitly marketplace to offer your services to property owners, rental managers and guests. Grow your business or earn additional income through regular or occasional jobs.",
  ctaJoin: "Join the marketplace",
  ctaExplore: "Explore the services",
  openingNote:
    "The network is being prepared. Coverage, fees and job terms will be clarified before any commitment.",
  previewLabel: "Product preview · Fictional job",
  previewTitle: "Ready for the next arrival.",
  previewCopy: "Instructions, photos and approval brought together in one job.",
  previewSteps: ["Instructions", "Photos", "Approval"],
  categoriesTitle: "The right skills for every stay.",
  categoriesCopy:
    "From property preparation to guest experiences: choose the services you would like to offer.",
  howTitle: "From your application to your next job.",
  howBadge: "At launch",
  steps: [
    {
      title: "Present your business",
      copy: "Provide your trade, area and the information needed to review your profile.",
    },
    {
      title: "Review a job",
      copy: "Read the location, instructions, rate and terms before committing.",
    },
    {
      title: "Share the completed work",
      copy: "Use the checklist and add photos to support approval of the work.",
    },
    {
      title: "Follow the approval",
      copy: "Keep a record of the job and payment under the agreed terms.",
    },
  ],
  appEyebrow: "Application preview",
  appTitle: "The work ahead, at a glance.",
  appCopy:
    "The demo brings together the schedule, instructions and job progress. Explore a workflow you could use day to day.",
  appPoints: [
    "The property and job instructions",
    "A checklist with associated photos",
    "Progress shared with the host",
  ],
  sampleNotice: "Demonstration with fictional data.",
  appAction: "Explore the operations demo",
  finalTitle: "Your next chapter starts with your profile.",
  finalCopy:
    "Independent professional or company, full-time business or side activity: introduce your services and apply to join the Baitly marketplace at launch.",
  finalQuestion: "Understand the steps",
  categories: [
    {
      name: "Cleaning & upkeep",
      copy: "Turnover cleaning, deep cleans, restocking consumables.",
      examples: ["Cleaner", "Cleaning team", "Post-stay restoration"],
    },
    {
      name: "Maintenance & small works",
      copy: "Plumbing, electrics, locks, repairs and urgent call-outs.",
      examples: [
        "Plumber / electrician",
        "General handyperson",
        "24/7 emergency cover",
      ],
    },
    {
      name: "Laundry & linen",
      copy: "Collection, washing, ironing and delivery of household and bath linen.",
      examples: [
        "Dry cleaner / launderette",
        "Hotel linen rental",
        "Collection & delivery",
      ],
    },
    {
      name: "Garden & pool",
      copy: "Grounds upkeep, pool cleaning and water treatment.",
      examples: ["Gardener / landscaper", "Pool technician", "Water treatment"],
    },
    {
      name: "Check-in & concierge",
      copy: "In-person check-in and check-out, key handover, guest assistance.",
      examples: ["Welcome agent", "Key handover", "Local concierge"],
    },
    {
      name: "Chef & experiences",
      copy: "Private chef, caterer, transfers and activities sold to guests.",
      examples: ["Private chef", "Driver / transfers", "Guide & activities"],
    },
  ],
};

const ar: ProvidersMessages = {
  eyebrow: "سوق الخدمات · التسجيل مفتوح",
  titleBefore: "قدّم خدماتك. ",
  titleAccent: "واكتشف فرص عمل جديدة.",
  intro:
    "انضم إلى سوق خدمات بيتلي لتقديم خدماتك للمالكين ومديري العقارات وضيوفهم. طوّر نشاطك أو ابحث عن دخل إضافي من خلال مهام منتظمة أو عرضية.",
  ctaJoin: "الانضمام إلى سوق الخدمات",
  ctaExplore: "اكتشاف المهن",
  openingNote:
    "الشبكة قيد الإعداد. سيتم توضيح المناطق والرسوم وشروط المهام قبل أي التزام.",
  previewLabel: "معاينة المنتج · مهمة توضيحية",
  previewTitle: "وحدة جاهزة لاستقبال الضيوف.",
  previewCopy: "التعليمات والصور والاعتماد في مهمة واحدة.",
  previewSteps: ["التعليمات", "الصور", "الاعتماد"],
  categoriesTitle: "المهارات المناسبة لكل إقامة.",
  categoriesCopy:
    "من تجهيز الوحدات إلى تجارب الضيوف: اختر الخدمات التي ترغب في تقديمها.",
  howTitle: "من تسجيلك إلى مهمتك المقبلة.",
  howBadge: "عند الإطلاق",
  steps: [
    {
      title: "التعريف بنشاطك",
      copy: "حدّد مهنتك ومنطقتك والمعلومات اللازمة لدراسة ملفك.",
    },
    {
      title: "مراجعة المهمة",
      copy: "اطّلع على المكان والتعليمات والسعر والشروط قبل الالتزام.",
    },
    {
      title: "مشاركة العمل المنجز",
      copy: "استخدم قائمة التحقّق وأضف الصور اللازمة لاعتماد التدخّل.",
    },
    {
      title: "متابعة الاعتماد",
      copy: "احتفظ بسجل المهمة والتسوية وفق الشروط المتفق عليها.",
    },
  ],
  appEyebrow: "معاينة التطبيق",
  appTitle: "العمل المطلوب، بنظرة واحدة.",
  appCopy:
    "يجمع العرض التوضيحي الجدول والتعليمات وتقدّم المهمة. استكشفه لتتصوّر عملك اليومي.",
  appPoints: [
    "الوحدة وتعليمات المهمة",
    "قائمة تحقّق وصور مرتبطة بها",
    "تقدّم مشترك مع المضيف",
  ],
  sampleNotice: "عرض توضيحي ببيانات افتراضية.",
  appAction: "استكشاف عرض العمليات",
  finalTitle: "خطوتك القادمة تبدأ بملفك.",
  finalCopy:
    "مستقل أو شركة، نشاط أساسي أو إضافي: قدّم خدماتك وترشّح للانضمام إلى سوق خدمات بيتلي عند الإطلاق.",
  finalQuestion: "فهم الخطوات",
  categories: [
    {
      name: "التنظيف والعناية",
      copy: "تنظيف بين إقامتين، وتجهيز شامل، وتجديد المستهلكات.",
      examples: ["عامل أو عاملة تنظيف", "فريق تنظيف", "تجهيز ما بعد الإقامة"],
    },
    {
      name: "الصيانة والأعمال الصغيرة",
      copy: "سباكة، وكهرباء، وأقفال، وإصلاحات وتدخّلات عاجلة.",
      examples: ["سبّاك أو كهربائي", "فنّي متعدّد المهام", "استدعاء طارئ 24/7"],
    },
    {
      name: "الغسيل والبياضات",
      copy: "جمع وغسل وكيّ وتوصيل بياضات المنزل والحمّام.",
      examples: ["مغسلة", "تأجير بياضات فندقية", "جمع وتوصيل"],
    },
    {
      name: "الحديقة والمسبح",
      copy: "العناية بالمساحات الخضراء، وتنظيف المسابح ومعالجة مياهها.",
      examples: ["بستاني أو منسّق حدائق", "فنّي مسابح", "معالجة المياه"],
    },
    {
      name: "الاستقبال والكونسيرج",
      copy: "استقبال ومغادرة بحضور شخصي، وتسليم المفاتيح، ومساندة النزلاء.",
      examples: ["موظف استقبال", "تسليم مفاتيح", "كونسيرج محلي"],
    },
    {
      name: "الطهاة والتجارب",
      copy: "طاهٍ في الموقع، وتموين، وتوصيل وأنشطة تُباع للنزلاء.",
      examples: ["طاهٍ خاص", "سائق وتوصيل", "مرشد وأنشطة"],
    },
  ],
};

export const PROVIDERS_MESSAGES: Record<SiteLanguage, ProvidersMessages> = {
  fr,
  en,
  ar,
};
