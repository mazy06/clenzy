import type { SiteLanguage } from "../siteLanguage";

const fr = {
  exitTitle: "Facilité de départ, d’après les sources publiques",
  exitLevels: {
    smooth: "Départ facilité",
    prepare: "Départ à préparer",
    constrained: "Départ contraignant",
    undocumented: "Conditions peu documentées",
  },
  exitHints: {
    smooth:
      "Exports et conditions de sortie documentés, sans verrou contractuel identifié.",
    prepare:
      "Les données sortent, mais plusieurs exports, délais ou clauses demandent de l’anticipation.",
    constrained:
      "Engagement, préavis ou perte d’accès rapide : planifiez la sortie avant de signer ailleurs.",
    undocumented:
      "Trop peu d’éléments publics : obtenez le périmètre et les délais par écrit.",
  },
  criteria: {
    export: "Export en autonomie",
    api: "API documentée",
    afterExit: "Accès après résiliation",
    freeToLeave: "Sans engagement long ni frais",
  },
  signals: {
    yes: "Oui",
    partial: "Partiel",
    no: "Non",
    unknown: "Non documenté",
  },
  yourPms: "Votre PMS",
  baitly: "Baitly",
  baitlyValues: {
    export: "Export intégral : CSV, JSON et fichiers",
    api: "Schéma documenté, réimportable ailleurs",
    afterExit: "30 jours minimum pour récupérer l’export",
    freeToLeave: "Mensuel, sans frais de sortie",
  },
  exitTerms: "Conditions de sortie publiées",
  feedback: "Ce que rapportent des utilisateurs",
  feedbackNote:
    "Expériences individuelles publiées sur des sites d’avis et forums, non vérifiées par Baitly.",
  terms: "CGU / contrat",
  review: "Avis utilisateurs",
  homeTag: "Portabilité des données",
  homeTitle: "Changer de PMS sans perdre votre historique.",
  homeIntro:
    "Sélectionnez votre logiciel actuel : nous résumons ce qu’il permet d’exporter, ses conditions de sortie et les retours d’utilisateurs, avec les sources.",
  airbnbNote:
    "En septembre 2026, Airbnb a retiré l’export CSV opérationnel des réservations. Votre PMS est souvent la seule copie exploitable de votre historique : récupérez-la avant de partir.",
  dataAct:
    "Depuis le 12 septembre 2025, le Data Act européen encadre le changement de fournisseur cloud, y compris de nombreux logiciels SaaS : préavis de deux mois maximum, transition de 30 jours et frais de changement interdits à partir du 12 janvier 2027.",
  homeLink: "Préparer ma migration",
  label: "Quel PMS utilisez-vous ?",
  intro:
    "Découvrez les exports documentés de votre logiciel et les points à vérifier avant de partir.",
  placeholder: "Sélectionner mon PMS",
  other: "Autre PMS / je ne sais pas",
  emptyTitle: "Une migration commence par un inventaire.",
  empty:
    "Choisissez votre logiciel pour consulter les formats, les limites et les sources disponibles.",
  unknownTitle: "Préparons le périmètre ensemble.",
  unknown:
    "Demandez à votre éditeur un exemple d’export, la liste des données incluses, le délai et les conditions d’accès après résiliation.",
  evidence: {
    exports: "Export autonome documenté",
    api: "Exports et API documentés",
    plan: "Exports selon l’offre",
    confirm: "Périmètre à confirmer",
  },
  coverage: "Données documentées",
  caution: "À anticiper",
  timing: "Accès et délai",
  sources: "Consulter les sources",
  sourceKinds: {
    export: "Export",
    api: "API",
    exit: "Départ du PMS",
    plan: "Offres et accès",
    timing: "Délais",
    community: "Forum utilisateurs",
    terms: "CGU / contrat",
    review: "Avis utilisateurs",
  },
  checked: "Sources publiques consultées le",
  methodology:
    "L’indicateur de départ est calculé à partir de quatre critères documentés (export, API, accès après résiliation, engagement) ; il ne juge pas les intentions des éditeurs. Les avis cités restent des expériences individuelles. Ce repère ne garantit ni un export exhaustif ni un connecteur Baitly déjà disponible. Le contrat et un échantillon d’export restent à vérifier.",
  download: "Télécharger ma fiche de préparation",
  checklist: [
    "Exporter avant la fin des accès, avec toutes les périodes et tous les statuts.",
    "Demander les messages, pièces jointes, factures, photos et paramètres séparément.",
    "Faire confirmer les données absentes, les frais éventuels et le délai par écrit.",
    "Comparer les volumes et les montants avant de résilier.",
  ],
  promiseTag: "Notre engagement de réversibilité",
  promiseTitle: "Vous restez libre de partir, avec toutes vos données.",
  promise:
    "Baitly s’engage à vous restituer l’ensemble des données de votre activité qu’il détient, dans des formats ouverts et réutilisables. Baitly ne retient aucune donnée pour vous empêcher de partir : ni frais de sortie, ni export partiel, ni engagement annuel.",
  promiseItems: [
    [
      "Des données exploitables",
      "CSV et JSON documentés, avec les liens entre logements, voyageurs, réservations et finances.",
    ],
    [
      "Les fichiers associés",
      "Photos, documents et pièces jointes, avec un inventaire pour vérifier ce qui a été remis.",
    ],
    [
      "Un périmètre transparent",
      "Toute exception liée aux droits de tiers ou à une obligation légale sera explicitée, ainsi que les durées de conservation.",
    ],
    [
      "Le temps de partir",
      "Au moins 30 jours après la résiliation pour télécharger votre export, sans frais, dans l’esprit du Data Act européen.",
    ],
  ],
  promiseStatus:
    "Engagement de pré-lancement : l’export intégral n’est pas encore disponible. Son périmètre, ses délais et ses modalités seront publiés avant sa mise en service.",
};
export type PortabilityMessages = typeof fr;
const en: PortabilityMessages = {
  exitTitle: "Ease of leaving, based on public sources",
  exitLevels: {
    smooth: "Easy exit",
    prepare: "Exit needs planning",
    constrained: "Restrictive exit",
    undocumented: "Poorly documented terms",
  },
  exitHints: {
    smooth:
      "Exports and exit terms are documented, with no identified contractual lock.",
    prepare:
      "Your data can leave, but several exports, delays or clauses need planning.",
    constrained:
      "Commitment, notice or fast loss of access: plan your exit before signing elsewhere.",
    undocumented:
      "Too little public information: get the scope and timing in writing.",
  },
  criteria: {
    export: "Self-service export",
    api: "Documented API",
    afterExit: "Access after cancellation",
    freeToLeave: "No long commitment or fees",
  },
  signals: {
    yes: "Yes",
    partial: "Partial",
    no: "No",
    unknown: "Not documented",
  },
  yourPms: "Your PMS",
  baitly: "Baitly",
  baitlyValues: {
    export: "Full export: CSV, JSON and files",
    api: "Documented schema, reusable elsewhere",
    afterExit: "At least 30 days to retrieve the export",
    freeToLeave: "Monthly, no exit fees",
  },
  exitTerms: "Published exit terms",
  feedback: "What users report",
  feedbackNote:
    "Individual experiences published on review sites and forums, not verified by Baitly.",
  terms: "Terms / contract",
  review: "User reviews",
  homeTag: "Data portability",
  homeTitle: "Switch PMS without losing your history.",
  homeIntro:
    "Select your current software: we summarise what it lets you export, its exit terms and user feedback, with sources.",
  airbnbNote:
    "In September 2026, Airbnb removed its operational reservations CSV export. Your PMS is often the only usable copy of your history: retrieve it before you leave.",
  dataAct:
    "Since 12 September 2025, the EU Data Act governs switching between cloud providers, including many SaaS tools: at most two months’ notice, a 30-day transition, and switching charges banned from 12 January 2027.",
  homeLink: "Prepare my migration",
  label: "Which PMS do you use?",
  intro:
    "Explore your software’s documented exports and what to check before leaving.",
  placeholder: "Select my PMS",
  other: "Other PMS / not sure",
  emptyTitle: "Every migration starts with an inventory.",
  empty:
    "Choose your software to see available formats, limitations and sources.",
  unknownTitle: "Let’s define the scope together.",
  unknown:
    "Ask your vendor for an export sample, the data included, delivery time and access conditions after cancellation.",
  evidence: {
    exports: "Documented self-service export",
    api: "Documented exports and API",
    plan: "Exports depend on the plan",
    confirm: "Scope to confirm",
  },
  coverage: "Documented data",
  caution: "Plan ahead",
  timing: "Access and timing",
  sources: "Read the sources",
  sourceKinds: {
    export: "Export",
    api: "API",
    exit: "Leaving the PMS",
    plan: "Plans and access",
    timing: "Timing",
    community: "User forum",
    terms: "Terms / contract",
    review: "User reviews",
  },
  checked: "Public sources checked on",
  methodology:
    "The exit indicator is computed from four documented criteria (export, API, access after cancellation, commitment); it does not judge vendors’ intentions. Quoted reviews remain individual experiences. This guide guarantees neither a complete export nor an existing Baitly connector. Your contract and an export sample still need checking.",
  download: "Download my preparation sheet",
  checklist: [
    "Export all periods and statuses before access ends.",
    "Request messages, attachments, invoices, photos and settings separately.",
    "Get written confirmation of missing data, any fees and delivery time.",
    "Reconcile record counts and amounts before cancelling.",
  ],
  promiseTag: "Our data portability commitment",
  promiseTitle: "You stay free to leave, with all your data.",
  promise:
    "Baitly commits to returning all the business data it holds for you, in open, reusable formats. Baitly holds back no data to keep you: no exit fees, no partial export, no annual commitment.",
  promiseItems: [
    [
      "Reusable data",
      "Documented CSV and JSON, with relationships between properties, guests, bookings and financial records.",
    ],
    [
      "Associated files",
      "Photos, documents and attachments, with an inventory to verify what was delivered.",
    ],
    [
      "Transparent scope",
      "Any third-party rights or legal exceptions will be explained, along with retention periods.",
    ],
    [
      "Time to leave",
      "At least 30 days after cancellation to download your export, free of charge, in line with the EU Data Act.",
    ],
  ],
  promiseStatus:
    "Pre-launch commitment: full account export is not yet available. Scope, turnaround and terms will be published before it goes live.",
};
const ar: PortabilityMessages = {
  exitTitle: "سهولة المغادرة وفق المصادر العامة",
  exitLevels: {
    smooth: "مغادرة ميسّرة",
    prepare: "مغادرة تحتاج إلى تحضير",
    constrained: "مغادرة مقيّدة",
    undocumented: "شروط غير موثّقة بما يكفي",
  },
  exitHints: {
    smooth: "التصدير وشروط المغادرة موثّقة دون قيد تعاقدي ظاهر.",
    prepare:
      "يمكن نقل البيانات، لكن تعدد الملفات أو المهل أو البنود يتطلب تخطيطاً.",
    constrained:
      "التزام أو إشعار مسبق أو فقدان سريع للوصول: خطّط للمغادرة قبل التعاقد مع غيره.",
    undocumented: "المعلومات العامة قليلة: احصل كتابياً على النطاق والمدة.",
  },
  criteria: {
    export: "تصدير ذاتي",
    api: "واجهة API موثّقة",
    afterExit: "الوصول بعد الإلغاء",
    freeToLeave: "دون التزام طويل أو رسوم",
  },
  signals: {
    yes: "نعم",
    partial: "جزئي",
    no: "لا",
    unknown: "غير موثّق",
  },
  yourPms: "نظامك الحالي",
  baitly: "بيتلي",
  baitlyValues: {
    export: "تصدير كامل: CSV وJSON والملفات",
    api: "مخطط موثّق قابل لإعادة الاستخدام",
    afterExit: "٣٠ يوماً على الأقل لاسترجاع التصدير",
    freeToLeave: "اشتراك شهري دون رسوم مغادرة",
  },
  exitTerms: "شروط المغادرة المنشورة",
  feedback: "ما يذكره المستخدمون",
  feedbackNote:
    "تجارب فردية منشورة على مواقع التقييم والمنتديات، لم يتحقق منها بيتلي.",
  terms: "الشروط / العقد",
  review: "تقييمات المستخدمين",
  homeTag: "قابلية نقل البيانات",
  homeTitle: "غيّر نظامك دون أن تفقد سجلك.",
  homeIntro:
    "اختر برنامجك الحالي: نلخّص ما يتيح تصديره وشروط المغادرة وتجارب المستخدمين مع المصادر.",
  airbnbNote:
    "في سبتمبر ٢٠٢٦ أزالت Airbnb تصدير CSV التشغيلي للحجوزات. غالباً ما يكون نظامك النسخة الوحيدة القابلة للاستخدام من سجلك: استرجعها قبل المغادرة.",
  dataAct:
    "منذ ١٢ سبتمبر ٢٠٢٥ ينظّم قانون البيانات الأوروبي تغيير مزوّد الخدمات السحابية، بما في ذلك كثير من برامج SaaS: إشعار لا يتجاوز شهرين، وفترة انتقال ٣٠ يوماً، وحظر رسوم التغيير ابتداءً من ١٢ يناير ٢٠٢٧.",
  homeLink: "تحضير انتقالي",
  label: "ما نظام إدارة العقارات الذي تستخدمه؟",
  intro: "تعرّف على خيارات التصدير الموثّقة وما يجب التحقق منه قبل المغادرة.",
  placeholder: "اختر نظامك",
  other: "نظام آخر / لست متأكداً",
  emptyTitle: "تبدأ كل عملية انتقال بحصر البيانات.",
  empty: "اختر نظامك للاطلاع على الصيغ والقيود والمصادر المتاحة.",
  unknownTitle: "لنحدّد نطاق النقل معاً.",
  unknown:
    "اطلب من المزوّد نموذج تصدير وقائمة بالبيانات المشمولة ومدة التسليم وشروط الوصول بعد الإلغاء.",
  evidence: {
    exports: "تصدير ذاتي موثّق",
    api: "تصدير وواجهة API موثّقان",
    plan: "التصدير حسب الاشتراك",
    confirm: "النطاق يحتاج إلى تأكيد",
  },
  coverage: "البيانات الموثّقة",
  caution: "ما يجب الاستعداد له",
  timing: "الوصول والمدة",
  sources: "الاطلاع على المصادر",
  sourceKinds: {
    export: "التصدير",
    api: "واجهة API",
    exit: "مغادرة النظام",
    plan: "الاشتراكات والوصول",
    timing: "المدة",
    community: "منتدى المستخدمين",
    terms: "الشروط / العقد",
    review: "تقييمات المستخدمين",
  },
  checked: "تاريخ مراجعة المصادر العامة:",
  methodology:
    "يُحسب مؤشر المغادرة من أربعة معايير موثّقة (التصدير، API، الوصول بعد الإلغاء، الالتزام) ولا يحكم على نوايا المزوّدين. التقييمات المذكورة تجارب فردية. لا يضمن هذا الدليل تصديراً شاملاً ولا توفّر رابط استيراد جاهز في بيتلي. يبقى التحقق من العقد ونموذج التصدير ضرورياً.",
  download: "تنزيل ورقة التحضير",
  checklist: [
    "صدّر جميع الفترات والحالات قبل انتهاء الوصول.",
    "اطلب الرسائل والمرفقات والفواتير والصور والإعدادات بشكل منفصل.",
    "احصل على تأكيد كتابي للبيانات الناقصة والرسوم المحتملة ومدة التسليم.",
    "طابق أعداد السجلات والمبالغ قبل الإلغاء.",
  ],
  promiseTag: "التزامنا بإمكانية نقل بياناتك",
  promiseTitle: "أنت حرّ في المغادرة مع كل بياناتك.",
  promise:
    "يلتزم بيتلي بإعادة جميع بيانات نشاطك التي يحتفظ بها، بصيغ مفتوحة وقابلة لإعادة الاستخدام. لا يحتجز بيتلي أي بيانات لإبقائك: لا رسوم مغادرة ولا تصدير جزئي ولا التزام سنوي.",
  promiseItems: [
    [
      "بيانات قابلة للاستخدام",
      "ملفات CSV وJSON موثّقة مع الروابط بين العقارات والضيوف والحجوزات والسجلات المالية.",
    ],
    [
      "الملفات المرتبطة",
      "الصور والمستندات والمرفقات مع قائمة للتحقق مما تم تسليمه.",
    ],
    [
      "نطاق واضح",
      "توضيح أي استثناء مرتبط بحقوق الغير أو الالتزامات القانونية، وفترات الاحتفاظ بالبيانات.",
    ],
    [
      "وقت كافٍ للمغادرة",
      "٣٠ يوماً على الأقل بعد الإلغاء لتنزيل التصدير مجاناً، وفق روح قانون البيانات الأوروبي.",
    ],
  ],
  promiseStatus:
    "التزام قبل الإطلاق: التصدير الشامل غير متاح بعد. سننشر نطاقه ومدته وشروطه قبل إتاحته.",
};
export const PMS_PORTABILITY_MESSAGES: Record<
  SiteLanguage,
  PortabilityMessages
> = { fr, en, ar };
