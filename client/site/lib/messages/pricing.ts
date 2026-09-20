import type { SiteLanguage } from '../siteLanguage';
import { AGENT_IDS } from '../../../src/modules/supervision/constants';

/**
 * Grille tarifaire de la landing.
 *
 * <p><b>La devise suit la langue</b> — arabe : riyal saoudien, francais :
 * dirham, anglais : euro. Chaque marche a sa grille ; la page n'affiche
 * jamais un montant converti a la volee.</p>
 *
 * <p><b>Une grille par marche, derivee de la grille marocaine</b> (290 et
 * 490 MAD par logement et par mois), convertie puis arrondie au palier
 * commercial superieur : 109 et 189 SAR, 29 et 49 EUR. Les taux retenus sont
 * ceux de septembre 2026 — 1 MAD pour 0,373 SAR et 0,093 EUR. Ce sont des
 * prix de lancement : les changer se fait ici, et nulle part ailleurs.</p>
 */
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
  /** Mention de financement local — absente la ou aucun dispositif ne s'applique. */
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
  title: 'Des tarifs publics. En dirhams.',
  intro:
    'Dégressif par logement, sans commission cachée, sans engagement.',
  recommended: 'Recommandé',
  ctaStart: 'Commencer',
  ctaTalk: 'Parler à l’équipe',
  subsidy: {
    copy: 'Dispositifs d’aide à la digitalisation : nous vous aidons à monter le dossier.',
    link: 'Vérifier mon éligibilité',
  },
  addonsTitle: 'Add-ons à la carte',
  addonsCopy: 'Activables à tout moment depuis Paramètres → Abonnement.',
  addonsPending: 'À définir',
  perMonth: '/mois',
  addons: [
    { name: 'Objets connectés', copy: 'Serrures, capteurs de bruit, vidéosurveillance.' },
    { name: 'Site de réservation avancé', copy: 'Templates premium + domaine dédié.' },
    { name: 'Messagerie WhatsApp', copy: 'Conversations et alertes via l’API Meta.' },
    { name: 'Market data étendu', copy: 'Comps concurrentiels et rapports de marché.' },
  ],
  faqTitle: 'Questions sur les tarifs',
  faq: [
    {
      q: 'Les prix sont-ils vraiment publics ?',
      a: 'Oui, et dégressifs par logement. Aucun frais caché, aucune commission sur vos réservations directes.',
    },
    {
      q: 'Puis-je payer à la réservation plutôt qu’à l’abonnement ?',
      a: 'Une option « % par réservation » est à l’étude pour les petits portefeuilles — parlez-en avec nous.',
    },
    {
      q: 'Y a-t-il un engagement ?',
      a: 'Non — mensuel sans engagement, remise sur l’annuel.',
    },
    {
      q: 'Dans quelle devise suis-je facturé ?',
      a: 'Dans celle de votre marché : dirham au Maroc, riyal en Arabie saoudite, euro en Europe.',
    },
  ],
  ctaDemo: 'Réserver une démo',
  plans: [
    {
      name: 'Essentiel',
      price: '290 MAD',
      unit: '/logement/mois',
      copy: 'Pour démarrer proprement.',
      features: ['PMS & channel manager', 'Booking engine & site', 'Déclaration des voyageurs + taxe de séjour', 'Facturation conforme', 'Support WhatsApp'],
      featured: false,
      quoteOnly: false,
    },
    {
      name: 'Pro',
      price: '490 MAD',
      unit: '/logement/mois',
      copy: 'Le PMS piloté par les agents.',
      features: ['Tout Essentiel', `Agents IA (${AGENT_IDS.length} agents, HITL)`, 'Yield automatique borné', 'Market data par ville', 'Portail propriétaire + e-signature', 'Opérations ménage avec preuve photo'],
      featured: true,
      quoteOnly: false,
    },
    {
      name: 'Sur mesure',
      price: 'Devis',
      unit: '',
      copy: '50+ logements, groupes.',
      features: ['Multi-organisations', 'SLA & support dédié', 'Migration accompagnée', 'Journal d’audit exportable'],
      featured: false,
      quoteOnly: true,
    },
  ],
};

const en: PricingMessages = {
  eyebrow: 'Pricing',
  title: 'Public pricing. In euros.',
  intro: 'Priced per property, scaling down, no hidden commission, no lock-in.',
  recommended: 'Recommended',
  ctaStart: 'Get started',
  ctaTalk: 'Talk to the team',
  addonsTitle: 'Add-ons',
  addonsCopy: 'Switch them on at any time from Settings → Subscription.',
  addonsPending: 'To be confirmed',
  perMonth: '/month',
  addons: [
    { name: 'Connected devices', copy: 'Smart locks, noise sensors, video monitoring.' },
    { name: 'Advanced booking site', copy: 'Premium templates and a dedicated domain.' },
    { name: 'WhatsApp messaging', copy: 'Conversations and alerts through the Meta API.' },
    { name: 'Extended market data', copy: 'Competitive comps and market reports.' },
  ],
  faqTitle: 'Pricing questions',
  faq: [
    {
      q: 'Is the pricing really public?',
      a: 'Yes, and it scales down per property. No hidden fees, no commission on your direct bookings.',
    },
    {
      q: 'Can I pay per booking instead of a subscription?',
      a: 'A “% per booking” option is under consideration for small portfolios — talk to us about it.',
    },
    { q: 'Is there a commitment?', a: 'No — monthly with no lock-in, discount on annual.' },
    {
      q: 'Which currency am I billed in?',
      a: 'Your market’s: dirham in Morocco, riyal in Saudi Arabia, euro in Europe.',
    },
  ],
  ctaDemo: 'Book a demo',
  plans: [
    {
      name: 'Essential',
      price: '€29',
      unit: '/property/month',
      copy: 'To start out properly.',
      features: ['PMS & channel manager', 'Booking engine & website', 'Guest registration + tourist tax', 'Compliant invoicing', 'WhatsApp support'],
      featured: false,
      quoteOnly: false,
    },
    {
      name: 'Pro',
      price: '€49',
      unit: '/property/month',
      copy: 'The PMS the agents drive.',
      features: ['Everything in Essential', `AI agents (${AGENT_IDS.length} agents, human approval)`, 'Bounded automatic yield', 'Market data by city', 'Owner portal + e-signature', 'Housekeeping with photo proof'],
      featured: true,
      quoteOnly: false,
    },
    {
      name: 'Custom',
      price: 'Quote',
      unit: '',
      copy: '50+ properties, groups.',
      features: ['Multi-organisation', 'SLA & dedicated support', 'Assisted migration', 'Exportable audit log'],
      featured: false,
      quoteOnly: true,
    },
  ],
};

const ar: PricingMessages = {
  eyebrow: 'الأسعار',
  title: 'أسعار معلنة. بالريال.',
  intro: 'سعر لكل وحدة، متناقص، دون عمولة خفية ودون ارتباط.',
  recommended: 'موصى به',
  ctaStart: 'ابدأ الآن',
  ctaTalk: 'تحدّث إلى الفريق',
  addonsTitle: 'خدمات إضافية',
  addonsCopy: 'يمكن تفعيلها في أي وقت من الإعدادات ← الاشتراك.',
  addonsPending: 'قيد التحديد',
  perMonth: '/شهرياً',
  addons: [
    { name: 'الأجهزة المتصلة', copy: 'أقفال ذكية، وحساسات ضجيج، ومراقبة بالفيديو.' },
    { name: 'موقع حجز متقدّم', copy: 'قوالب متميّزة ونطاق خاص.' },
    { name: 'مراسلة واتساب', copy: 'محادثات وتنبيهات عبر واجهة ميتا.' },
    { name: 'بيانات سوق موسّعة', copy: 'مقارنات تنافسية وتقارير السوق.' },
  ],
  faqTitle: 'أسئلة حول الأسعار',
  faq: [
    {
      q: 'هل الأسعار معلنة فعلاً؟',
      a: 'نعم، وتتناقص مع عدد الوحدات. لا رسوم خفية ولا عمولة على حجوزاتك المباشرة.',
    },
    {
      q: 'هل يمكن الدفع لكل حجز بدل الاشتراك؟',
      a: 'خيار «نسبة لكل حجز» قيد الدراسة للمحافظ الصغيرة — تحدّث إلينا بشأنه.',
    },
    { q: 'هل هناك ارتباط تعاقدي؟', a: 'لا — اشتراك شهري دون ارتباط، وخصم على السنوي.' },
    {
      q: 'بأي عملة تصدر فاتورتي؟',
      a: 'بعملة سوقك: الريال في السعودية، والدرهم في المغرب، واليورو في أوروبا.',
    },
  ],
  ctaDemo: 'احجز عرضاً توضيحياً',
  plans: [
    {
      name: 'الأساسية',
      price: '109 ر.س',
      unit: '/وحدة/شهرياً',
      copy: 'لانطلاقة سليمة.',
      features: ['نظام إدارة ومدير قنوات', 'محرك حجز وموقع', 'تسجيل النزلاء ورسم الإقامة', 'فوترة مطابقة', 'دعم عبر واتساب'],
      featured: false,
      quoteOnly: false,
    },
    {
      name: 'المتقدّمة',
      price: '189 ر.س',
      unit: '/وحدة/شهرياً',
      copy: 'نظام إدارة يقوده الوكلاء.',
      features: ['كل ما في الأساسية', `وكلاء ذكاء اصطناعي (${AGENT_IDS.length} وكلاء بمصادقة بشرية)`, 'تسعير آلي بحدود', 'بيانات السوق حسب المدينة', 'بوابة المالك والتوقيع الإلكتروني', 'عمليات التنظيف بإثبات مصوّر'],
      featured: true,
      quoteOnly: false,
    },
    {
      name: 'حسب الطلب',
      price: 'عرض سعر',
      unit: '',
      copy: 'أكثر من 50 وحدة، والمجموعات.',
      features: ['تعدّد المنشآت', 'اتفاقية مستوى خدمة ودعم مخصّص', 'ترحيل مصحوب', 'سجل تدقيق قابل للتصدير'],
      featured: false,
      quoteOnly: true,
    },
  ],
};

export const PRICING_MESSAGES: Record<SiteLanguage, PricingMessages> = { fr, en, ar };
