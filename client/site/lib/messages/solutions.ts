import type { SiteLanguage } from '../siteLanguage';
import { BAITLY_RESOURCE_MESSAGES } from './baitlyResources';

/**
 * Texte des solutions et des ressources.
 *
 * <p>Ils alimentent les deux derniers menus restes francais — Solutions et
 * Ressources — ainsi que la page `/solutions`. Comme pour les modules, seule
 * la structure (slug, icone, etiquette) reste dans `catalog.tsx`.</p>
 */
export interface SolutionText {
  name: string;
  menuCopy: string;
  copy: string;
  points: readonly string[];
}

export interface ResourceText {
  name: string;
  copy: string;
  tag: string;
}

const solutionsFr: Record<string, SolutionText> = {
  conciergeries: {
    name: 'Conciergeries',
    menuCopy: 'De 5 à 200 lots, multi-propriétaires.',
    copy: 'Pilotez le portefeuille, les équipes et les mandants depuis un seul cockpit.',
    points: [
      'Cartes HITL par équipe',
      'Portail propriétaires',
      'Factures de commission',
      'Contrats 4 modèles',
    ],
  },
  'hotes-independants': {
    name: 'Hôtes indépendants',
    menuCopy: '1 à 5 logements, autopilote simple.',
    copy: 'Les agents gèrent le quotidien, vous validez depuis votre téléphone.',
    points: [
      'Autopilote messages + prix',
      'Validation en 2 gestes',
      'Sans carte bancaire pour essayer',
      'WhatsApp natif',
    ],
  },
  'riads-maisons-dhotes': {
    name: 'Riads & maisons d’hôtes',
    menuCopy: 'Chambres + logements entiers, petit-déjeuner, équipe sur place.',
    copy: 'Le fonctionnement hybride chambre/logement, avec la conformité locale intégrée.',
    points: [
      'Déclaration des voyageurs',
      'Taxe de séjour auto',
      'Interface FR/AR',
      'Boutique & extras',
    ],
  },
  'arabie-saoudite': {
    name: 'Arabie saoudite — conformité',
    menuCopy:
      'Shomoos, TVA 15 %, frais municipaux, facture ZATCA, encaissement en SAR.',
    copy: 'La conformité saoudienne traitée comme un produit : déclaration des voyageurs, fiscalité et facture électronique.',
    points: [
      'Enregistrement Shomoos (شموس)',
      'TVA 15 % et frais municipaux 5 %',
      'Facture électronique ZATCA',
      'PayTabs et encaissement en riyals',
    ],
  },
  maroc: {
    name: 'Maroc — conformité',
    menuCopy: 'Fiche police, taxe de séjour, encaissement en MAD.',
    copy: 'La conformité marocaine traitée comme un produit, pas comme une promesse.',
    points: [
      'Fiche police au format DGSN',
      'Barèmes de taxe par commune',
      'Aides à la digitalisation',
      'CMI / PayZone / YouCan Pay',
    ],
  },
  'multi-proprietaires': {
    name: 'Multi-propriétaires',
    menuCopy: 'Gestion pour compte de tiers, relevés et versements.',
    copy: 'Chaque mandant a son contrat, son relevé, son versement — automatiquement.',
    points: [
      'Relevés mensuels',
      'Versements SEPA/Wise',
      'Journal d’audit exportable',
      'Accès propriétaire borné',
    ],
  },
};

const solutionsEn: Record<string, SolutionText> = {
  conciergeries: {
    name: 'Property managers',
    menuCopy: 'From 5 to 200 units, multi-owner.',
    copy: 'Run the portfolio, the teams and the owners from a single cockpit.',
    points: [
      'Approval cards per team',
      'Owner portal',
      'Commission invoices',
      'Four contract models',
    ],
  },
  'hotes-independants': {
    name: 'Independent hosts',
    menuCopy: '1 to 5 properties, simple autopilot.',
    copy: 'The agents handle the day-to-day, you approve from your phone.',
    points: [
      'Message and price autopilot',
      'Approval in two taps',
      'No card needed to try',
      'Native WhatsApp',
    ],
  },
  'riads-maisons-dhotes': {
    name: 'Riads & guesthouses',
    menuCopy: 'Rooms plus whole properties, breakfast, on-site team.',
    copy: 'The hybrid room/property model, with local compliance built in.',
    points: [
      'Guest registration',
      'Automatic tourist tax',
      'FR/AR interface',
      'Shop & extras',
    ],
  },
  'arabie-saoudite': {
    name: 'Saudi Arabia — compliance',
    menuCopy:
      'Shomoos, 15% VAT, municipality fees, ZATCA invoicing, collection in SAR.',
    copy: 'Saudi compliance treated as a product: guest registration, taxation and electronic invoicing.',
    points: [
      'Shomoos registration (شموس)',
      '15% VAT and 5% municipality fee',
      'ZATCA electronic invoicing',
      'PayTabs and collection in riyals',
    ],
  },
  maroc: {
    name: 'Morocco — compliance',
    menuCopy: 'Police record, tourist tax, collection in MAD.',
    copy: 'Moroccan compliance treated as a product, not as a promise.',
    points: [
      'Police record in DGSN format',
      'Tax schedules by municipality',
      'Digitalisation support',
      'CMI / PayZone / YouCan Pay',
    ],
  },
  'multi-proprietaires': {
    name: 'Multi-owner',
    menuCopy: 'Third-party management, statements and payouts.',
    copy: 'Each owner has their contract, their statement, their payout — automatically.',
    points: [
      'Monthly statements',
      'SEPA/Wise payouts',
      'Exportable audit log',
      'Bounded owner access',
    ],
  },
};

const solutionsAr: Record<string, SolutionText> = {
  conciergeries: {
    name: 'شركات الإدارة',
    menuCopy: 'من 5 إلى 200 وحدة، ومُلّاك متعددون.',
    copy: 'أدِر المحفظة والفرق والملّاك من مركز قيادة واحد.',
    points: [
      'بطاقات موافقة لكل فريق',
      'بوابة الملّاك',
      'فواتير العمولة',
      'أربعة نماذج عقود',
    ],
  },
  'hotes-independants': {
    name: 'المضيفون المستقلون',
    menuCopy: 'من 1 إلى 5 عقارات، بطيار آلي بسيط.',
    copy: 'يتولى الوكلاء اليومي، وتصادق أنت من هاتفك.',
    points: [
      'طيار آلي للرسائل والأسعار',
      'مصادقة بنقرتين',
      'تجربة دون بطاقة بنكية',
      'واتساب أصلي',
    ],
  },
  'riads-maisons-dhotes': {
    name: 'الرياضات ودور الضيافة',
    menuCopy: 'غرف وعقارات كاملة، وفطور، وفريق في الموقع.',
    copy: 'نموذج مختلط بين الغرفة والعقار، مع امتثال محلي مدمج.',
    points: [
      'تسجيل النزلاء',
      'رسم إقامة آلي',
      'واجهة بالفرنسية والعربية',
      'متجر وخدمات إضافية',
    ],
  },
  'arabie-saoudite': {
    name: 'السعودية — الامتثال',
    menuCopy:
      'شموس، وضريبة 15 %، ورسوم بلدية، وفاتورة إلكترونية، وتحصيل بالريال.',
    copy: 'الامتثال السعودي معالَجاً كمنتج: تسجيل النزلاء، والضرائب، والفوترة الإلكترونية.',
    points: [
      'التسجيل في شموس',
      'ضريبة 15 % ورسوم بلدية 5 %',
      'فاتورة إلكترونية معتمدة',
      'PayTabs والتحصيل بالريال',
    ],
  },
  maroc: {
    name: 'المغرب — الامتثال',
    menuCopy: 'بطاقة الشرطة، ورسم الإقامة، والتحصيل بالدرهم.',
    copy: 'الامتثال المغربي معالَجاً كمنتج، لا كوعد.',
    points: [
      'بطاقة الشرطة بصيغة الأمن الوطني',
      'جداول الرسم حسب البلدية',
      'دعم التحوّل الرقمي',
      'CMI / PayZone / YouCan Pay',
    ],
  },
  'multi-proprietaires': {
    name: 'تعدّد الملّاك',
    menuCopy: 'إدارة لحساب الغير، وكشوف، وتحويلات.',
    copy: 'لكل مالك عقده وكشفه وتحويله — تلقائياً.',
    points: [
      'كشوف شهرية',
      'تحويلات SEPA/Wise',
      'سجل تدقيق قابل للتصدير',
      'وصول محدود للمالك',
    ],
  },
};

export const SOLUTION_TEXT: Record<
  SiteLanguage,
  Record<string, SolutionText>
> = {
  fr: solutionsFr,
  en: solutionsEn,
  ar: solutionsAr,
};

export const RESOURCE_TEXT: Record<
  SiteLanguage,
  Record<string, ResourceText>
> = {
  fr: BAITLY_RESOURCE_MESSAGES.fr.modules,
  en: BAITLY_RESOURCE_MESSAGES.en.modules,
  ar: BAITLY_RESOURCE_MESSAGES.ar.modules,
};

/** Repli sur le francais : une solution non traduite s'affiche, elle ne casse pas. */
export function solutionText(
  slug: string,
  language: SiteLanguage,
): SolutionText {
  return SOLUTION_TEXT[language][slug] ?? SOLUTION_TEXT.fr[slug];
}

export function resourceText(id: string, language: SiteLanguage): ResourceText {
  return RESOURCE_TEXT[language][id] ?? RESOURCE_TEXT.fr[id];
}
