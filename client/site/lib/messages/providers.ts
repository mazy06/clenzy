import type { SiteLanguage } from "../siteLanguage";

const fr = {
  eyebrow: "Réseau prestataires · En préparation",
  titleBefore: "Votre savoir-faire. ",
  titleAccent: "Sa place dans Baitly.",
  intro:
    "Ménage, maintenance, accueil : découvrez comment vos services pourront accompagner les hôtes et leurs voyageurs. Préparez votre profil pour le lancement.",
  ctaJoin: "Préparer mon profil",
  ctaExplore: "Découvrir les métiers",
  openingNote:
    "Le réseau se prépare. Les zones couvertes, les frais et les conditions des missions seront précisés avant tout engagement.",
  previewLabel: "Aperçu produit · Mission fictive",
  previewTitle: "Un logement prêt pour l’arrivée.",
  previewCopy:
    "Les consignes, les photos et la validation réunies dans une même mission.",
  previewSteps: ["Consignes", "Photos", "Validation"],
  categoriesTitle: "À chaque séjour, les bons savoir-faire.",
  categoriesCopy:
    "Six familles de services à découvrir. Les visuels illustrent les métiers, sans représenter des prestataires déjà inscrits.",
  howTitle: "Un parcours à préparer, étape par étape.",
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
  finalTitle: "Construisons la suite avec votre métier.",
  finalCopy:
    "Préparez votre profil. L’ouverture du réseau et les conditions d’accès seront communiquées au lancement.",
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
  eyebrow: "Provider network · In preparation",
  titleBefore: "Your expertise. ",
  titleAccent: "A place for it in Baitly.",
  intro:
    "Cleaning, maintenance, guest arrivals: discover how your services could support hosts and their guests. Prepare your profile for launch.",
  ctaJoin: "Prepare my profile",
  ctaExplore: "Explore the services",
  openingNote:
    "The network is being prepared. Coverage, fees and job terms will be clarified before any commitment.",
  previewLabel: "Product preview · Fictional job",
  previewTitle: "Ready for the next arrival.",
  previewCopy: "Instructions, photos and approval brought together in one job.",
  previewSteps: ["Instructions", "Photos", "Approval"],
  categoriesTitle: "The right skills for every stay.",
  categoriesCopy:
    "Explore six service categories. Images illustrate the trades, not providers already registered.",
  howTitle: "Prepare your journey, step by step.",
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
  finalTitle: "Help shape what comes next.",
  finalCopy:
    "Prepare your profile. Network opening and access terms will be communicated at launch.",
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
  eyebrow: "شبكة مقدّمي الخدمات · قيد الإعداد",
  titleBefore: "خبرتك. ",
  titleAccent: "لها مكان في بايتلي.",
  intro:
    "النظافة والصيانة واستقبال الضيوف: اكتشف كيف يمكن لخدماتك مساعدة المضيفين وضيوفهم. جهّز ملفك للإطلاق.",
  ctaJoin: "تحضير ملفي",
  ctaExplore: "اكتشاف المهن",
  openingNote:
    "الشبكة قيد الإعداد. سيتم توضيح المناطق والرسوم وشروط المهام قبل أي التزام.",
  previewLabel: "معاينة المنتج · مهمة توضيحية",
  previewTitle: "وحدة جاهزة لاستقبال الضيوف.",
  previewCopy: "التعليمات والصور والاعتماد في مهمة واحدة.",
  previewSteps: ["التعليمات", "الصور", "الاعتماد"],
  categoriesTitle: "المهارات المناسبة لكل إقامة.",
  categoriesCopy:
    "اكتشف ست فئات من الخدمات. الصور توضيحية للمهن ولا تمثّل مقدّمي خدمات مسجّلين بالفعل.",
  howTitle: "جهّز مسارك، خطوة بخطوة.",
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
  finalTitle: "لنعدّ الخطوة التالية بخبرتك.",
  finalCopy:
    "جهّز ملفك. سيتم الإعلان عن فتح الشبكة وشروط الانضمام عند الإطلاق.",
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
