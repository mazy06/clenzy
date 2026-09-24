import type { SiteLanguage } from '../siteLanguage';
import { BAITLY_LOYALTY_MESSAGES } from './baitlyLoyalty';
import {
  BAITLY_PRICING_MARKETS,
  formatLoyaltyPrice,
} from '../../data/baitlyLoyaltyPricing';
import { AGENT_IDS } from '../../../src/modules/supervision/constants';

/** Baitly public plan copy. Numeric market prices live in baitlyLoyaltyPricing. */
export interface PlanText {
  name: string;
  price: string;
  unit: string;
  copy: string;
  features: readonly string[];
  featured: boolean;
  /** Le plan renvoie vers l'equipe au lieu d'un parcours d'inscription. */
  quoteOnly: boolean;
}

export interface PricingMessages {
  eyebrow: string;
  title: string;
  intro: string;
  recommended: string;
  ctaStart: string;
  ctaTalk: string;
  /** Mention de financement local : absente la ou aucun dispositif ne s'applique. */
  subsidy?: { copy: string; link: string };
  addonsTitle: string;
  addonsCopy: string;
  addonsPending: string;
  perMonth: string;
  addons: readonly { name: string; copy: string }[];
  faqTitle: string;
  faq: readonly { q: string; a: string }[];
  ctaDemo: string;
  plans: readonly PlanText[];
}

const fr: PricingMessages = {
  eyebrow: 'Tarifs',
  title: BAITLY_LOYALTY_MESSAGES.fr.title.join(' '),
  intro: BAITLY_LOYALTY_MESSAGES.fr.intro,
  recommended: 'Recommandé',
  ctaStart: 'Commencer',
  ctaTalk: 'Parler à l’équipe',
  subsidy: {
    copy: 'Dispositifs d’aide à la digitalisation : nous vous aidons à monter le dossier.',
    link: 'Vérifier mon éligibilité',
  },
  addonsTitle: 'Add-ons à la carte',
  addonsCopy: BAITLY_LOYALTY_MESSAGES.fr.optionsCopy,
  addonsPending: 'À définir',
  perMonth: '/mois',
  addons: [
    {
      name: 'Objets connectés',
      copy: 'Serrures, capteurs de bruit, vidéosurveillance.',
    },
    {
      name: 'Site de réservation avancé',
      copy: 'Templates premium + domaine dédié.',
    },
    {
      name: 'Messagerie WhatsApp',
      copy: 'Conversations et alertes via l’API Meta.',
    },
    {
      name: 'Market data étendu',
      copy: 'Comps concurrentiels et rapports de marché.',
    },
  ],
  faqTitle: 'Questions sur les tarifs',
  faq: BAITLY_LOYALTY_MESSAGES.fr.rules,
  ctaDemo: 'Réserver une démo',
  plans: [
    {
      name: 'Essentiel',
      price: formatLoyaltyPrice(
        BAITLY_PRICING_MARKETS.MA.essential,
        'MA',
        'fr',
      ),
      unit: '/logement/mois',
      copy: 'Pour démarrer proprement.',
      features: [
        'PMS & channel manager',
        'Booking engine & site',
        'Livret d’accueil & upsells',
        'Déclaration des voyageurs + taxe de séjour',
        'Facturation conforme',
        'Support WhatsApp',
      ],
      featured: false,
      quoteOnly: false,
    },
    {
      name: 'Pro',
      price: formatLoyaltyPrice(BAITLY_PRICING_MARKETS.MA.pro, 'MA', 'fr'),
      unit: '/logement/mois',
      copy: 'Le PMS piloté par les agents.',
      features: [
        'Tout Essentiel',
        `${AGENT_IDS.length} agents IA avec validation humaine`,
        'Tarification automatique encadrée',
        'Market data par ville',
        'Portail propriétaire + e-signature',
        'Opérations ménage avec preuve photo',
      ],
      featured: true,
      quoteOnly: false,
    },
    {
      name: 'Sur mesure',
      price: 'Devis',
      unit: '',
      copy: '50+ logements, groupes.',
      features: [
        'Multi-organisations',
        'SLA & support dédié',
        'Migration accompagnée',
        'Journal d’audit exportable',
      ],
      featured: false,
      quoteOnly: true,
    },
  ],
};

const en: PricingMessages = {
  eyebrow: 'Pricing',
  title: BAITLY_LOYALTY_MESSAGES.en.title.join(' '),
  intro: BAITLY_LOYALTY_MESSAGES.en.intro,
  recommended: 'Recommended',
  ctaStart: 'Get started',
  ctaTalk: 'Talk to the team',
  addonsTitle: 'Add-ons',
  addonsCopy: BAITLY_LOYALTY_MESSAGES.en.optionsCopy,
  addonsPending: 'To be confirmed',
  perMonth: '/month',
  addons: [
    {
      name: 'Connected devices',
      copy: 'Smart locks, noise sensors, video monitoring.',
    },
    {
      name: 'Advanced booking site',
      copy: 'Premium templates and a dedicated domain.',
    },
    {
      name: 'WhatsApp messaging',
      copy: 'Conversations and alerts through the Meta API.',
    },
    {
      name: 'Extended market data',
      copy: 'Competitive comps and market reports.',
    },
  ],
  faqTitle: 'Pricing questions',
  faq: BAITLY_LOYALTY_MESSAGES.en.rules,
  ctaDemo: 'Book a demo',
  plans: [
    {
      name: 'Essential',
      price: formatLoyaltyPrice(
        BAITLY_PRICING_MARKETS.EU.essential,
        'EU',
        'en',
      ),
      unit: '/property/month',
      copy: 'To start out properly.',
      features: [
        'PMS & channel manager',
        'Booking engine & website',
        'Welcome guide & upsells',
        'Guest registration + tourist tax',
        'Compliant invoicing',
        'WhatsApp support',
      ],
      featured: false,
      quoteOnly: false,
    },
    {
      name: 'Pro',
      price: formatLoyaltyPrice(BAITLY_PRICING_MARKETS.EU.pro, 'EU', 'en'),
      unit: '/property/month',
      copy: 'The PMS the agents drive.',
      features: [
        'Everything in Essential',
        `AI agents (${AGENT_IDS.length} agents, human approval)`,
        'Bounded automatic pricing',
        'Market data by city',
        'Owner portal + e-signature',
        'Housekeeping with photo proof',
      ],
      featured: true,
      quoteOnly: false,
    },
    {
      name: 'Custom',
      price: 'Quote',
      unit: '',
      copy: '50+ properties, groups.',
      features: [
        'Multi-organisation',
        'SLA & dedicated support',
        'Assisted migration',
        'Exportable audit log',
      ],
      featured: false,
      quoteOnly: true,
    },
  ],
};

const ar: PricingMessages = {
  eyebrow: 'الأسعار',
  title: BAITLY_LOYALTY_MESSAGES.ar.title.join(' '),
  intro: BAITLY_LOYALTY_MESSAGES.ar.intro,
  recommended: 'موصى به',
  ctaStart: 'ابدأ الآن',
  ctaTalk: 'تحدّث إلى الفريق',
  addonsTitle: 'خدمات إضافية',
  addonsCopy: BAITLY_LOYALTY_MESSAGES.ar.optionsCopy,
  addonsPending: 'قيد التحديد',
  perMonth: '/شهرياً',
  addons: [
    {
      name: 'الأجهزة المتصلة',
      copy: 'أقفال ذكية، وحساسات ضجيج، ومراقبة بالفيديو.',
    },
    { name: 'موقع حجز متقدّم', copy: 'قوالب متميّزة ونطاق خاص.' },
    { name: 'مراسلة واتساب', copy: 'محادثات وتنبيهات عبر واجهة ميتا.' },
    { name: 'بيانات سوق موسّعة', copy: 'مقارنات تنافسية وتقارير السوق.' },
  ],
  faqTitle: 'أسئلة حول الأسعار',
  faq: BAITLY_LOYALTY_MESSAGES.ar.rules,
  ctaDemo: 'احجز عرضاً توضيحياً',
  plans: [
    {
      name: 'الأساسية',
      price: formatLoyaltyPrice(
        BAITLY_PRICING_MARKETS.SA.essential,
        'SA',
        'ar',
      ),
      unit: '/وحدة/شهرياً',
      copy: 'لانطلاقة سليمة.',
      features: [
        'نظام إدارة ومدير قنوات',
        'محرك حجز وموقع',
        'دليل الاستقبال والخدمات الإضافية',
        'تسجيل النزلاء ورسم الإقامة',
        'فوترة مطابقة',
        'دعم عبر واتساب',
      ],
      featured: false,
      quoteOnly: false,
    },
    {
      name: 'المتقدّمة',
      price: formatLoyaltyPrice(BAITLY_PRICING_MARKETS.SA.pro, 'SA', 'ar'),
      unit: '/وحدة/شهرياً',
      copy: 'نظام إدارة يقوده الوكلاء.',
      features: [
        'كل ما في الأساسية',
        `وكلاء ذكاء اصطناعي (${AGENT_IDS.length} وكلاء بمصادقة بشرية)`,
        'تسعير آلي بحدود',
        'بيانات السوق حسب المدينة',
        'بوابة المالك والتوقيع الإلكتروني',
        'عمليات التنظيف بإثبات مصوّر',
      ],
      featured: true,
      quoteOnly: false,
    },
    {
      name: 'حسب الطلب',
      price: 'عرض سعر',
      unit: '',
      copy: 'أكثر من 50 وحدة، والمجموعات.',
      features: [
        'تعدّد المنشآت',
        'اتفاقية مستوى خدمة ودعم مخصّص',
        'ترحيل مصحوب',
        'سجل تدقيق قابل للتصدير',
      ],
      featured: false,
      quoteOnly: true,
    },
  ],
};

export const PRICING_MESSAGES: Record<SiteLanguage, PricingMessages> = {
  fr,
  en,
  ar,
};
