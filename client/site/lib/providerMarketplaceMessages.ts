import type { SiteLanguage } from "./siteLanguage";

const fr = {
  previewTitle: "Votre savoir-faire, visible au bon endroit.",
  previewEyebrow: "Dans la marketplace Baitly",
  example: "Profils, tarifs et avis fictifs. Photos générées par IA.",
  from: "Dès",
  reviews: "avis",
  perVisit: "/ intervention",
  perHour: "/ heure",
  perPerson: "/ personne",
  profiles: [
    {
      name: "Leïla B.",
      trade: "Ménage & préparation des logements",
      city: "Marrakech, Maroc",
      rhythm: "Missions régulières",
    },
    {
      name: "Thomas R.",
      trade: "Maintenance & petits travaux",
      city: "Bordeaux, France",
      rhythm: "Selon ses disponibilités",
    },
    {
      name: "Sarah A.",
      trade: "Chef à domicile",
      city: "Riyad, Arabie saoudite",
      rhythm: "Prestations ponctuelles",
    },
  ],
  benefits: ["Vos tarifs", "Votre zone", "Vos disponibilités"],
  opportunityEyebrow: "Une activité qui s’adapte à vous",
  opportunityTitle:
    "Un complément de revenu. Ou de nouvelles habitudes de travail.",
  opportunityIntro:
    "Baitly mettra votre activité en relation avec les propriétaires, les conciergeries et leurs voyageurs. Vous choisirez les missions qui vous correspondent.",
  regularTitle: "Vous cherchez des missions régulières",
  regularCopy:
    "Ménage entre les séjours, entretien du linge, jardin ou piscine : présentez vos services aux gestionnaires qui ont des besoins récurrents.",
  occasionalTitle: "Vous avez des créneaux à proposer",
  occasionalCopy:
    "Un dépannage, un dîner, un transfert ou une remise de clés : mettez votre savoir-faire à disposition quand votre planning le permet.",
  regularTag: "Construire des relations dans la durée",
  occasionalTag: "Compléter votre activité à votre rythme",
  offerService: "Proposer mes services",
  signupBack: "Découvrir la marketplace",
  signupTitle: "Faites une place à vos services sur Baitly.",
  signupIntro:
    "Présentez votre activité pour rejoindre la marketplace. Commencez par ce que vous proposez et les tarifs que vous choisissez.",
  steps: [
    "Services & tarifs",
    "Zone & disponibilités",
    "Votre profil",
    "Vérification",
  ],
  stepLabel: "Étape {step} sur {total}",
  next: "Continuer",
  previous: "Retour",
  edit: "Modifier",
  optional: "Informations complémentaires (facultatif)",
  availability: "Préciser mes disponibilités (facultatif)",
  preview: "Votre profil prend forme",
  previewNote:
    "Aperçu de votre saisie. Votre profil sera étudié avant publication.",
  previewName: "Votre nom ou votre entreprise",
  previewTrade: "Votre service principal",
  previewCity: "Votre zone d’intervention",
  previewPrice: "Votre tarif",
  noReviews: "Les avis viendront après vos premières missions.",
  afterTitle: "Et après l’inscription ?",
  afterSteps: [
    "Confirmez votre adresse email.",
    "Complétez les justificatifs demandés.",
    "Nous étudions votre profil pour l’ouverture du réseau.",
  ],
  verifyTitle: "Tout est prêt pour envoyer votre candidature ?",
  verifyHint:
    "Relisez votre présentation et vos tarifs. Vous pourrez revenir à chaque étape avant l’envoi.",
  missingServices:
    "Choisissez un métier et ajoutez au moins une prestation avec un tarif ou la mention « Sur devis ».",
  missingCoverage:
    "Choisissez votre pays et au moins une zone d’intervention. Vérifiez les horaires et le rayon saisis.",
  missingProfile:
    "Renseignez votre nom affiché, votre prénom, votre nom et une adresse email valide.",
  chooseCountry: "Choisir un pays",
  country: "Pays de votre activité *",
  zoneCountry: "Pays d’intervention",
  currency: "Devise de vos tarifs",
  searchTrade: "Rechercher un métier",
  noTrades: "Aucun métier ne correspond à votre recherche.",
  selectedTrades: "{count} métier(s) sélectionné(s)",
  serviceExample: "Ex. Ménage après un séjour",
  submitNote:
    "L’inscription prépare votre arrivée dans le réseau. Les zones d’ouverture et les conditions vous seront communiquées avant toute mission.",
  noCommitment:
    "Vous gardez la main sur vos tarifs et les missions que vous acceptez.",
};
type Messages = typeof fr;
const en: Messages = {
  previewTitle: "Your skills, in front of the right people.",
  previewEyebrow: "On the Baitly marketplace",
  example: "Illustrative profiles, prices and reviews. AI-generated photos.",
  from: "From",
  reviews: "reviews",
  perVisit: "/ visit",
  perHour: "/ hour",
  perPerson: "/ person",
  profiles: [
    {
      name: "Leïla B.",
      trade: "Cleaning & property preparation",
      city: "Marrakech, Morocco",
      rhythm: "Recurring jobs",
    },
    {
      name: "Thomas R.",
      trade: "Maintenance & small repairs",
      city: "Bordeaux, France",
      rhythm: "When available",
    },
    {
      name: "Sarah A.",
      trade: "Private chef",
      city: "Riyadh, Saudi Arabia",
      rhythm: "Occasional services",
    },
  ],
  benefits: ["Your rates", "Your area", "Your availability"],
  opportunityEyebrow: "Work that fits around you",
  opportunityTitle: "Extra income. Or new working relationships.",
  opportunityIntro:
    "Baitly will connect your business with property owners, rental managers and their guests. You will choose the jobs that suit you.",
  regularTitle: "Looking for regular work?",
  regularCopy:
    "Turnover cleaning, laundry, garden or pool maintenance: offer your services to managers with recurring needs.",
  occasionalTitle: "Have some time available?",
  occasionalCopy:
    "A repair, a dinner, a transfer or a key handover: offer your skills when your schedule allows.",
  regularTag: "Build long-term working relationships",
  occasionalTag: "Add to your income at your own pace",
  offerService: "Offer my services",
  signupBack: "Explore the marketplace",
  signupTitle: "Make room for your services on Baitly.",
  signupIntro:
    "Introduce your business to join the marketplace. Start with the services you offer and the rates you choose.",
  steps: ["Services & rates", "Area & availability", "Your profile", "Review"],
  stepLabel: "Step {step} of {total}",
  next: "Continue",
  previous: "Back",
  edit: "Edit",
  optional: "Additional information (optional)",
  availability: "Set my availability (optional)",
  preview: "Your profile is taking shape",
  previewNote:
    "Preview of your details. Your profile will be reviewed before publication.",
  previewName: "Your name or business",
  previewTrade: "Your main service",
  previewCity: "Your service area",
  previewPrice: "Your rate",
  noReviews: "Reviews will follow your first jobs.",
  afterTitle: "What happens next?",
  afterSteps: [
    "Confirm your email address.",
    "Provide the requested documents.",
    "We review your profile ahead of the network opening.",
  ],
  verifyTitle: "Ready to submit your application?",
  verifyHint:
    "Review your details and rates. You can return to any step before submitting.",
  missingServices:
    "Choose a trade and add at least one service with a price or select “On quotation”.",
  missingCoverage:
    "Choose your country and at least one service area. Check the time slots and travel radius.",
  missingProfile:
    "Enter your display name, first name, last name and a valid email address.",
  chooseCountry: "Choose a country",
  country: "Business country *",
  zoneCountry: "Service country",
  currency: "Currency for your rates",
  searchTrade: "Search for a trade",
  noTrades: "No trades match your search.",
  selectedTrades: "{count} trade(s) selected",
  serviceExample: "E.g. Turnover cleaning",
  submitNote:
    "Your application prepares your entry into the network. Opening areas and terms will be shared before any job.",
  noCommitment: "You decide your rates and which jobs to accept.",
};
const ar: Messages = {
  previewTitle: "مهاراتك أمام من يحتاج إليها.",
  previewEyebrow: "في سوق خدمات بيتلي",
  example: "ملفات وأسعار وتقييمات افتراضية. صور مولّدة بالذكاء الاصطناعي.",
  from: "ابتداءً من",
  reviews: "تقييمًا",
  perVisit: "/ زيارة",
  perHour: "/ ساعة",
  perPerson: "/ شخص",
  profiles: [
    {
      name: "ليلى ب.",
      trade: "تنظيف وتجهيز الوحدات",
      city: "مراكش، المغرب",
      rhythm: "مهام منتظمة",
    },
    {
      name: "توماس ر.",
      trade: "الصيانة والإصلاحات البسيطة",
      city: "بوردو، فرنسا",
      rhythm: "حسب التفرّغ",
    },
    {
      name: "سارة أ.",
      trade: "طاهية خاصة",
      city: "الرياض، السعودية",
      rhythm: "خدمات عرضية",
    },
  ],
  benefits: ["أسعارك", "منطقتك", "أوقات تفرّغك"],
  opportunityEyebrow: "نشاط يناسب وقتك",
  opportunityTitle: "دخل إضافي. أو علاقات عمل مستمرة.",
  opportunityIntro:
    "سيربط بيتلي نشاطك بالمالكين ومديري العقارات وضيوفهم. تختار المهام التي تناسبك.",
  regularTitle: "هل تبحث عن مهام منتظمة؟",
  regularCopy:
    "التنظيف بين الإقامات أو العناية بالبياضات والحدائق والمسابح: اعرض خدماتك على مديرين لديهم احتياجات متكررة.",
  occasionalTitle: "هل لديك وقت متاح؟",
  occasionalCopy:
    "إصلاح أو عشاء أو نقل أو تسليم مفاتيح: قدّم خبرتك عندما يسمح جدولك بذلك.",
  regularTag: "بناء علاقات عمل طويلة الأمد",
  occasionalTag: "زيادة دخلك وفق إيقاعك",
  offerService: "تقديم خدماتي",
  signupBack: "اكتشاف سوق الخدمات",
  signupTitle: "امنح خدماتك مكانًا في بيتلي.",
  signupIntro:
    "عرّف بنشاطك للانضمام إلى سوق الخدمات. ابدأ بالخدمات التي تقدّمها والأسعار التي تختارها.",
  steps: ["الخدمات والأسعار", "المنطقة والتفرّغ", "ملفك", "المراجعة"],
  stepLabel: "الخطوة {step} من {total}",
  next: "متابعة",
  previous: "رجوع",
  edit: "تعديل",
  optional: "معلومات إضافية (اختياري)",
  availability: "تحديد أوقات تفرّغي (اختياري)",
  preview: "ملفك يأخذ شكله",
  previewNote: "معاينة لبياناتك. سنراجع ملفك قبل نشره.",
  previewName: "اسمك أو اسم نشاطك",
  previewTrade: "خدمتك الرئيسية",
  previewCity: "منطقة تدخّلك",
  previewPrice: "سعرك",
  noReviews: "ستظهر التقييمات بعد مهامك الأولى.",
  afterTitle: "ماذا بعد التسجيل؟",
  afterSteps: [
    "أكّد عنوان بريدك الإلكتروني.",
    "أكمل الوثائق المطلوبة.",
    "ندرس ملفك استعدادًا لافتتاح الشبكة.",
  ],
  verifyTitle: "هل أنت مستعد لإرسال طلبك؟",
  verifyHint: "راجع بياناتك وأسعارك. يمكنك العودة إلى أي خطوة قبل الإرسال.",
  missingServices:
    "اختر مهنة وأضف خدمة واحدة على الأقل بسعر أو اختر «حسب عرض السعر».",
  missingCoverage:
    "اختر بلدك ومنطقة تدخّل واحدة على الأقل. تحقّق من الأوقات ونطاق التنقّل.",
  missingProfile:
    "أدخل الاسم المعروض واسمك الأول واسم العائلة وبريدًا إلكترونيًا صالحًا.",
  chooseCountry: "اختر بلدًا",
  country: "بلد نشاطك *",
  zoneCountry: "بلد تقديم الخدمة",
  currency: "عملة أسعارك",
  searchTrade: "البحث عن مهنة",
  noTrades: "لا توجد مهن تطابق بحثك.",
  selectedTrades: "المهن المحدّدة: {count}",
  serviceExample: "مثال: تنظيف بعد الإقامة",
  submitNote:
    "يهيّئ تسجيلك للانضمام إلى الشبكة. سنبلغك بمناطق الافتتاح والشروط قبل أي مهمة.",
  noCommitment: "أنت تحدّد أسعارك والمهام التي تقبلها.",
};
export const PROVIDER_MARKETPLACE_MESSAGES: Record<SiteLanguage, Messages> = {
  fr,
  en,
  ar,
};
