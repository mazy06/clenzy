import type { SiteLanguage } from '../siteLanguage';

const fr = {
  label: 'Les ressources Baitly',
  title: 'Des repères pour mieux accueillir.',
  intro:
    'Des guides pour comprendre, des outils pour décider. Explorez le métier à votre rythme, même avant de vous lancer avec Baitly.',
  library: {
    label: 'Votre bibliothèque',
    title: 'Un nouvel éclairage sur votre quotidien.',
    copy: 'Réservation directe, expérience voyageur, organisation : faites le plein de conseils concrets.',
    topics: ['Guides pratiques', 'Académie', 'Glossaire'],
    action: 'Explorer les ressources',
    note: 'En accès libre, sans compte.',
  },
  calculator: {
    label: 'Faire ses calculs',
    title: 'Votre projet, en chiffres.',
    copy: 'Faites varier vos hypothèses pour estimer les revenus et les charges de votre location.',
    night: 'par nuit',
    nights: 'nuits réservées',
    result: 'Recettes brutes · exemple',
    action: 'Ouvrir le calculateur',
  },
  obligations: {
    label: 'Y voir plus clair',
    title: 'À chaque pays, ses repères.',
    copy: 'Identifiez les démarches à vérifier pour votre hébergement et retrouvez les sources officielles.',
    countries: 'France · Maroc · Arabie saoudite',
    checks: ['Déclaration des voyageurs', 'Taxes de séjour', 'Facturation'],
    action: 'Consulter les obligations',
  },
};

type Messages = {
  [K in keyof typeof fr]: (typeof fr)[K] extends string
    ? string
    : {
        [P in keyof (typeof fr)[K]]: (typeof fr)[K][P] extends string[]
          ? string[]
          : string;
      };
};

const en: Messages = {
  label: 'Baitly resources',
  title: 'A clearer view of hosting.',
  intro:
    'Guides to understand, tools to decide. Explore at your own pace, even before getting started with Baitly.',
  library: {
    label: 'Your library',
    title: 'A fresh perspective on your day-to-day.',
    copy: 'Direct bookings, guest experience, organisation: find practical ideas you can put to work.',
    topics: ['Practical guides', 'Academy', 'Glossary'],
    action: 'Explore the resources',
    note: 'Open access. No account needed.',
  },
  calculator: {
    label: 'Run the numbers',
    title: 'Your project, in numbers.',
    copy: 'Adjust your assumptions to estimate your rental income and expenses.',
    night: 'per night',
    nights: 'booked nights',
    result: 'Gross revenue · example',
    action: 'Open the calculator',
  },
  obligations: {
    label: 'Find your bearings',
    title: 'Each country has its own rules.',
    copy: 'Identify the requirements to check for your property and find official sources.',
    countries: 'France · Morocco · Saudi Arabia',
    checks: ['Guest registration', 'Tourist taxes', 'Invoicing'],
    action: 'Explore local requirements',
  },
};

const ar: Messages = {
  label: 'موارد بايتلي',
  title: 'رؤية أوضح لضيافة أفضل.',
  intro:
    'أدلة للفهم وأدوات لاتخاذ القرار. استكشف عالم الضيافة بالوتيرة التي تناسبك، حتى قبل البدء مع بايتلي.',
  library: {
    label: 'مكتبتك',
    title: 'نظرة جديدة إلى إدارة يومك.',
    copy: 'الحجز المباشر وتجربة الضيف والتنظيم: أفكار عملية يمكنك الاستفادة منها.',
    topics: ['أدلة عملية', 'الأكاديمية', 'المسرد'],
    action: 'استكشف الموارد',
    note: 'متاحة للجميع، دون حساب.',
  },
  calculator: {
    label: 'احسب خياراتك',
    title: 'مشروعك بالأرقام.',
    copy: 'عدّل افتراضاتك لتقدير إيرادات ومصاريف وحدتك السياحية.',
    night: 'لليلة',
    nights: 'ليلة محجوزة',
    result: 'إيرادات إجمالية · مثال',
    action: 'افتح الحاسبة',
  },
  obligations: {
    label: 'معلومات أوضح',
    title: 'لكل بلد متطلباته.',
    copy: 'تعرّف على الإجراءات التي ينبغي التحقق منها لوحدتك واطّلع على المصادر الرسمية.',
    countries: 'فرنسا · المغرب · السعودية',
    checks: ['تسجيل الضيوف', 'الرسوم السياحية', 'الفوترة'],
    action: 'اطّلع على المتطلبات',
  },
};

export const HOME_RESOURCE_MESSAGES: Record<SiteLanguage, Messages> = {
  fr,
  en,
  ar,
};
