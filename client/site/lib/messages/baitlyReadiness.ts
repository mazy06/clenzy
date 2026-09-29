import type { SiteLanguage } from "../siteLanguage";

const fr = {
  status: {
    eyebrow: "Transparence · Disponibilité",
    title: "L’ouverture se prépare.\nLa transparence aussi.",
    intro:
      "Baitly est en pré-lancement. Cette page distingue l’ouverture des inscriptions de la disponibilité technique du service.",
    openTitle: "Les inscriptions sont ouvertes.\nLe suivi reste à construire.",
    openIntro:
      "L’ouverture des inscriptions est confirmée. La disponibilité technique des services n’est pas encore mesurée sur cette page.",
    unknownTitle: "La disponibilité,\nen toute clarté.",
    unknownIntro:
      "Le statut d’ouverture ne peut pas être confirmé pour le moment. Aucune mesure technique en temps réel n’est publiée ici.",
    launch: "Pré-lancement",
    open: "Inscriptions ouvertes",
    loading: "Vérification de l’ouverture…",
    unknown: "Ouverture non confirmée",
    contextTitle: "Deux informations différentes",
    contextCopy:
      "L’ouverture indique quand créer un compte. La supervision mesure si les services fonctionnent. L’une ne remplace pas l’autre.",
    componentsTitle: "Les services à suivre",
    componentsCopy:
      "Aucune sonde publique n’alimente ces indicateurs pour le moment.",
    unmeasured: "Non mesuré",
    components: [
      "Application PMS",
      "API & webhooks",
      "Booking engine & sites",
      "Synchronisation des canaux",
      "Paiements",
      "Messagerie",
      "Agents IA",
    ],
    targetLabel: "Objectif mensuel des CGV",
    measurementTitle: "Un objectif, pas un résultat mesuré.",
    measurementCopy:
      "99,5 % est l’objectif de disponibilité prévu dans les CGV. Aucun taux observé ni historique de disponibilité n’est encore publié.",
    terms: "Consulter les CGV",
    incidentsTitle: "Un historique à construire",
    noIncidents:
      "L’historique public des incidents n’est pas encore alimenté. Son absence ne signifie pas qu’aucun incident n’a eu lieu.",
    action: "Suivre le lancement",
    explore: "Explorer le produit",
  },
  next: {
    title: "Et après votre inscription ?",
    steps: [
      { title: "Aujourd’hui", copy: "Votre email rejoint la liste d’attente." },
      {
        title: "À l’ouverture",
        copy: "Vous recevez les informations pour découvrir les offres disponibles.",
      },
      {
        title: "À votre rythme",
        copy: "Vous choisissez ensuite de créer votre compte et de souscrire.",
      },
    ],
    note: "La liste d’attente ne crée aucun abonnement et ne réserve pas de tarif.",
    explore: "Faites-vous votre propre idée.",
    copy: "Explorez les parcours du produit avec des données fictives. Chaque démo vous montre un usage concret.",
    planning: "Un planning, plusieurs canaux",
    planningCopy: "Suivez une réservation et les actions qui l’accompagnent.",
    booking: "Votre site de réservation",
    bookingCopy: "Des dates aux extras, jusqu’au paiement simulé.",
    action: "Explorer la démo",
  },
  compare: {
    eyebrow: "Bien choisir son PMS",
    title: "Les bonnes questions.\nDes réponses à explorer.",
    intro:
      "Baitly est en pré-lancement. Appuyez votre choix sur vos besoins, les parcours de démonstration et les conditions de l’offre.",
    note: "Les démos utilisent des données fictives. Le périmètre disponible et les conditions seront confirmés avant souscription.",
    criteriaTitle: "Ce qui compte pour votre activité.",
    criteriaCopy:
      "Six points à vérifier, quel que soit le logiciel que vous choisissez.",
    criteria: [
      {
        title: "Vos canaux de réservation",
        question:
          "Quelles données sont synchronisées, et par quelle connexion ?",
        copy: "Distinguez les réservations, les disponibilités, les tarifs et les restrictions. Vérifiez le périmètre de chaque canal.",
        action: "Explorer le planning",
      },
      {
        title: "Vos ventes en direct",
        question: "Quel parcours proposez-vous à vos voyageurs ?",
        copy: "Essayez le choix des dates, des logements et des extras, puis le paiement. Repérez les options de personnalisation.",
        action: "Parcourir les templates",
      },
      {
        title: "Votre contrôle sur l’IA",
        question: "Que peut faire un agent sans votre accord ?",
        copy: "Examinez les propositions, les validations et les règles d’autonomie. Les limites doivent être aussi lisibles que les actions.",
        action: "Essayer les agents",
      },
      {
        title: "Votre coût complet",
        question: "Que paierez-vous pour votre parc et vos usages ?",
        copy: "Comparez l’abonnement, les options et les frais de tiers. Simulez aussi l’évolution du tarif avec le volume et la fidélité.",
        action: "Simuler mon tarif",
      },
      {
        title: "Votre changement d’outil",
        question: "Quelles données pourrez-vous reprendre ?",
        copy: "Vérifiez les exports disponibles, les limites sur l’historique et les étapes de reconnexion de vos annonces.",
        action: "Préparer la migration",
      },
      {
        title: "Votre organisation au quotidien",
        question: "Qui doit voir, décider et intervenir ?",
        copy: "Parcourez les consignes, les preuves photo et la validation des missions. Vérifiez que chaque rôle retrouve les informations utiles.",
        action: "Voir les opérations",
      },
    ],
    closingTitle: "Commencez par votre propre scénario.",
    closingCopy:
      "Votre nombre de logements, vos canaux et vos équipes sont les meilleurs points de départ pour comparer.",
    pricing: "Estimer mon abonnement",
    migration: "Préparer mon changement d’outil",
  },
};

type ReadinessMessages = typeof fr;
const en: ReadinessMessages = {
  status: {
    eyebrow: "Transparency · Availability",
    title: "Preparing to launch.\nBeing clear from the start.",
    intro:
      "Baitly is in pre-launch. This page distinguishes registration availability from the technical availability of the service.",
    openTitle: "Registrations are open.\nMonitoring is still to come.",
    openIntro:
      "Registration is confirmed open. Technical service availability is not yet measured on this page.",
    unknownTitle: "Availability,\nclearly explained.",
    unknownIntro:
      "The registration status cannot be confirmed right now. No live technical measurements are published here.",
    launch: "Pre-launch",
    open: "Registrations open",
    loading: "Checking registration status…",
    unknown: "Opening not confirmed",
    contextTitle: "Two different signals",
    contextCopy:
      "Registration tells you when you can create an account. Monitoring tells you whether services are running. One does not replace the other.",
    componentsTitle: "Services to monitor",
    componentsCopy:
      "These indicators are not connected to public monitoring yet.",
    unmeasured: "Not measured",
    components: [
      "PMS application",
      "API & webhooks",
      "Booking engine & sites",
      "Channel synchronisation",
      "Payments",
      "Messaging",
      "AI agents",
    ],
    targetLabel: "Monthly target in the terms",
    measurementTitle: "A target, not measured uptime.",
    measurementCopy:
      "99.5% is the availability target stated in the terms. No observed uptime or availability history is published yet.",
    terms: "Read the terms",
    incidentsTitle: "A history still to be built",
    noIncidents:
      "The public incident history is not populated yet. Its absence does not mean that no incidents have occurred.",
    action: "Follow the launch",
    explore: "Explore the product",
  },
  next: {
    title: "What happens after you join?",
    steps: [
      { title: "Today", copy: "Your email is added to the waiting list." },
      {
        title: "At launch",
        copy: "You receive information about the available plans.",
      },
      {
        title: "At your own pace",
        copy: "You then choose whether to create an account and subscribe.",
      },
    ],
    note: "The waiting list does not create a subscription or reserve a price.",
    explore: "See for yourself.",
    copy: "Explore product workflows with fictional data. Each demo shows a practical use case.",
    planning: "One calendar, multiple channels",
    planningCopy: "Follow a booking and the actions around it.",
    booking: "Your direct booking site",
    bookingCopy: "From dates and extras to a simulated payment.",
    action: "Explore the demo",
  },
  compare: {
    eyebrow: "Choosing your PMS",
    title: "The right questions.\nAnswers you can explore.",
    intro:
      "Baitly is in pre-launch. Base your choice on your needs, the product demonstrations and the terms of each plan.",
    note: "Demos use fictional data. Available features and terms will be confirmed before subscribing.",
    criteriaTitle: "What matters for your business.",
    criteriaCopy: "Six points to check, whichever software you choose.",
    criteria: [
      {
        title: "Your booking channels",
        question: "What is synchronised, and through which connection?",
        copy: "Distinguish bookings, availability, rates and restrictions. Check the scope of each channel.",
        action: "Explore the calendar",
      },
      {
        title: "Your direct sales",
        question: "What journey do you offer your guests?",
        copy: "Try dates, properties, extras and payment. Look at the customisation options.",
        action: "Explore the templates",
      },
      {
        title: "Your control over AI",
        question: "What can an agent do without your approval?",
        copy: "Review proposals, approvals and autonomy rules. Limits should be as clear as actions.",
        action: "Try the agents",
      },
      {
        title: "Your complete cost",
        question: "What will you pay for your portfolio and usage?",
        copy: "Compare subscriptions, options and third-party fees. Simulate volume and loyalty pricing too.",
        action: "Simulate my price",
      },
      {
        title: "Your move to a new tool",
        question: "Which data can you bring with you?",
        copy: "Check available exports, history limitations and the steps to reconnect your listings.",
        action: "Prepare the migration",
      },
      {
        title: "Your daily operations",
        question: "Who needs to see, decide and act?",
        copy: "Explore instructions, photo proof and job approval. Check that each role has the information it needs.",
        action: "Explore operations",
      },
    ],
    closingTitle: "Start with your own scenario.",
    closingCopy:
      "Your properties, channels and team are the best starting point for a comparison.",
    pricing: "Estimate my subscription",
    migration: "Prepare my move",
  },
};

const ar: ReadinessMessages = {
  status: {
    eyebrow: "الشفافية · التوفّر",
    title: "نستعد للإطلاق.\nبوضوح منذ البداية.",
    intro:
      "بيتلي في مرحلة ما قبل الإطلاق. تميّز هذه الصفحة بين فتح التسجيل والتوفّر التقني للخدمة.",
    openTitle: "التسجيلات مفتوحة.\nوالمتابعة قيد الإعداد.",
    openIntro:
      "تم تأكيد فتح التسجيل. لم يبدأ بعد قياس التوفّر التقني للخدمات على هذه الصفحة.",
    unknownTitle: "توفّر الخدمة،\nبكل وضوح.",
    unknownIntro:
      "لا يمكن تأكيد حالة فتح التسجيل حالياً. لا تُنشر هنا قياسات تقنية مباشرة.",
    launch: "ما قبل الإطلاق",
    open: "التسجيلات مفتوحة",
    loading: "جارٍ التحقق من فتح التسجيل…",
    unknown: "لم يُؤكّد الافتتاح",
    contextTitle: "معلومتان مختلفتان",
    contextCopy:
      "فتح التسجيل يحدّد متى يمكنك إنشاء حساب. والمراقبة تقيس عمل الخدمات. إحداهما لا تعوّض الأخرى.",
    componentsTitle: "الخدمات التي ستتم متابعتها",
    componentsCopy: "هذه المؤشرات غير متصلة بعد بمراقبة عامة.",
    unmeasured: "غير مقاس",
    components: [
      "تطبيق إدارة العقارات",
      "API وwebhooks",
      "محرك الحجز والمواقع",
      "مزامنة القنوات",
      "المدفوعات",
      "المراسلة",
      "وكلاء الذكاء الاصطناعي",
    ],
    targetLabel: "الهدف الشهري في الشروط",
    measurementTitle: "هدف وليس نتيجة مقاسة.",
    measurementCopy:
      "99.5٪ هو هدف التوفّر المنصوص عليه في الشروط. لم يُنشر بعد معدل فعلي أو سجل للتوفّر.",
    terms: "قراءة الشروط",
    incidentsTitle: "سجل قيد الإعداد",
    noIncidents:
      "لم يبدأ نشر سجل الحوادث العام. غيابه لا يعني عدم وقوع أي حادث.",
    action: "متابعة الإطلاق",
    explore: "اكتشاف المنتج",
  },
  next: {
    title: "ماذا يحدث بعد التسجيل؟",
    steps: [
      { title: "اليوم", copy: "يُضاف بريدك الإلكتروني إلى قائمة الانتظار." },
      { title: "عند الإطلاق", copy: "تصلك معلومات عن العروض المتاحة." },
      { title: "عندما يناسبك", copy: "تختار بعد ذلك إنشاء حساب والاشتراك." },
    ],
    note: "قائمة الانتظار لا تُنشئ اشتراكاً ولا تحجز سعراً.",
    explore: "اكتشف بنفسك.",
    copy: "استكشف مسارات المنتج ببيانات توضيحية. يعرض كل نموذج حالة استخدام عملية.",
    planning: "تقويم واحد وقنوات متعددة",
    planningCopy: "تابع حجزاً والإجراءات المرتبطة به.",
    booking: "موقعك للحجز المباشر",
    bookingCopy: "من التواريخ والخدمات الإضافية إلى محاكاة الدفع.",
    action: "استكشاف العرض",
  },
  compare: {
    eyebrow: "اختيار نظام إدارة العقارات",
    title: "الأسئلة المناسبة.\nوإجابات تستكشفها.",
    intro:
      "بيتلي في مرحلة ما قبل الإطلاق. ابنِ اختيارك على احتياجاتك والعروض التوضيحية وشروط كل باقة.",
    note: "تستخدم العروض بيانات توضيحية. تُؤكّد الميزات المتاحة والشروط قبل الاشتراك.",
    criteriaTitle: "ما يهم نشاطك.",
    criteriaCopy: "ست نقاط للتحقق منها، أياً كان البرنامج الذي تختاره.",
    criteria: [
      {
        title: "قنوات الحجز",
        question: "ما البيانات المتزامنة، وعبر أي اتصال؟",
        copy: "ميّز بين الحجوزات والتوفّر والأسعار والقيود. تحقّق من نطاق كل قناة.",
        action: "استكشاف التقويم",
      },
      {
        title: "المبيعات المباشرة",
        question: "ما المسار الذي تقدّمه لضيوفك؟",
        copy: "جرّب التواريخ والوحدات والخدمات الإضافية والدفع. اكتشف خيارات التخصيص.",
        action: "استكشاف القوالب",
      },
      {
        title: "التحكم في الذكاء الاصطناعي",
        question: "ماذا يمكن للوكيل فعله دون موافقتك؟",
        copy: "راجع المقترحات والموافقات وقواعد الاستقلالية. يجب أن تكون الحدود واضحة كالإجراءات.",
        action: "تجربة الوكلاء",
      },
      {
        title: "التكلفة الكاملة",
        question: "كم ستدفع مقابل وحداتك واستخدامك؟",
        copy: "قارن الاشتراك والخيارات ورسوم الأطراف الأخرى. حاكِ أيضاً أسعار الحجم والوفاء.",
        action: "محاكاة السعر",
      },
      {
        title: "الانتقال إلى أداة جديدة",
        question: "ما البيانات التي يمكنك نقلها؟",
        copy: "تحقّق من ملفات التصدير وحدود السجل وخطوات إعادة ربط الإعلانات.",
        action: "تحضير الانتقال",
      },
      {
        title: "العمل اليومي",
        question: "من يحتاج إلى الاطلاع والقرار والتدخل؟",
        copy: "استكشف التعليمات والصور واعتماد المهام. تأكد من وصول كل دور إلى المعلومات المناسبة.",
        action: "استكشاف العمليات",
      },
    ],
    closingTitle: "ابدأ بسيناريو نشاطك.",
    closingCopy: "وحداتك وقنواتك وفريقك هي أفضل نقطة انطلاق للمقارنة.",
    pricing: "تقدير اشتراكي",
    migration: "تحضير انتقالي",
  },
};

export const BAITLY_READINESS_MESSAGES: Record<
  SiteLanguage,
  ReadinessMessages
> = { fr, en, ar };

export const BAITLY_COMPARISON_ROUTES = [
  "/produit/pms-channel-manager",
  "/produit/booking-engine",
  "/produit/agents-ia",
  "/tarifs",
  "/migration",
  "/produit/operations-menage",
] as const;
