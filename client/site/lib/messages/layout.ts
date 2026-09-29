import type { SiteLanguage } from '../siteLanguage';

/**
 * Coquille commune du site : navigation, en-tete, pied de page.
 *
 * <p>Elle entoure chaque page. Laissee en francais, elle encadrait un accueil
 * arabe d'une navigation francaise — le genre d'incoherence qui se voit avant
 * meme qu'on lise le contenu.</p>
 */
const fr = {
  nav: {
    aria: 'Navigation principale',
    mobileAria: 'Navigation mobile',
    product: 'Produit',
    solutions: 'Solutions',
    pricing: 'Tarifs',
    migration: 'Migration',
    resources: 'Ressources',
    compare: 'Comparer',
    providers: 'Prestataires',
  },
  /* Vitrines des volets de navigation (cf. `components/NavMegaPanel`). */
  mega: {
    discover: 'Découvrir',
    productAll: 'Bien choisir votre PMS',
    solutionsAll: 'Voir toutes les solutions',
    resourcesAll: 'Toutes les ressources',
  },
  header: {
    homeAria: 'Baitly, accueil',
    login: 'Se connecter',
    demo: 'Réserver une démo',
    openMenu: 'Ouvrir le menu',
    closeMenu: 'Fermer le menu',
  },
  mobile: {
    explore: 'Explorer Baitly',
    account: 'Votre espace Baitly',
  },
  footer: {
    pitch:
      'Le PMS avec une équipe d’agents IA, conçu pour l’Arabie saoudite, le Maroc et la France. Explorez les parcours de gestion, de réservation directe et d’accueil.',
    columns: {
      product: 'Produit',
      solutions: 'Solutions',
      resources: 'Ressources',
      company: 'Entreprise',
    },
    resources: [
      'Baromètre de la location courte durée',
      'Calculateur de revenus',
      'Guide des obligations',
      'Académie',
      'Blog',
    ] as readonly string[],
    company: [
      'Tarifs',
      'Migration',
      'Comparer',
      'Devenir prestataire',
      'Réserver une démo',
    ] as readonly string[],
    legal: {
      notice: 'Mentions légales',
      privacy: 'Confidentialité',
      terms: 'CGV',
      status: 'Statut du service',
    },
    rights: '© 2026 Baitly. Tous droits réservés.',
  },
  shell: {
    skip: 'Aller au contenu',
    loading: 'Chargement de la page…',
  },
};

export type LayoutMessages = typeof fr;

const en: LayoutMessages = {
  nav: {
    aria: 'Main navigation',
    mobileAria: 'Mobile navigation',
    product: 'Product',
    solutions: 'Solutions',
    pricing: 'Pricing',
    migration: 'Migration',
    resources: 'Resources',
    compare: 'Compare',
    providers: 'Providers',
  },
  mega: {
    discover: 'Explore',
    productAll: 'Choose the right PMS',
    solutionsAll: 'See every solution',
    resourcesAll: 'All resources',
  },
  header: {
    homeAria: 'Baitly, home',
    login: 'Sign in',
    demo: 'Book a demo',
    openMenu: 'Open the menu',
    closeMenu: 'Close the menu',
  },
  mobile: {
    explore: 'Explore Baitly',
    account: 'Your Baitly workspace',
  },
  footer: {
    pitch:
      'The PMS with a team of AI agents, built for Saudi Arabia, Morocco and France. Explore property management, direct booking and guest welcome journeys.',
    columns: {
      product: 'Product',
      solutions: 'Solutions',
      resources: 'Resources',
      company: 'Company',
    },
    resources: [
      'Short-term rental barometer',
      'Revenue calculator',
      'Guide to your obligations',
      'Academy',
      'Blog',
    ],
    company: [
      'Pricing',
      'Migration',
      'Compare',
      'Become a provider',
      'Book a demo',
    ],
    legal: {
      notice: 'Legal notice',
      privacy: 'Privacy',
      terms: 'Terms',
      status: 'Service status',
    },
    rights: '© 2026 Baitly. All rights reserved.',
  },
  shell: {
    skip: 'Skip to content',
    loading: 'Loading the page…',
  },
};

const ar: LayoutMessages = {
  nav: {
    aria: 'التنقل الرئيسي',
    mobileAria: 'التنقل على الهاتف',
    product: 'المنتج',
    solutions: 'الحلول',
    pricing: 'الأسعار',
    migration: 'الترحيل',
    resources: 'الموارد',
    compare: 'المقارنة',
    providers: 'المزوّدون',
  },
  mega: {
    discover: 'اكتشف',
    productAll: 'اختيار نظام الإدارة المناسب',
    solutionsAll: 'اطّلع على جميع الحلول',
    resourcesAll: 'كل الموارد',
  },
  header: {
    homeAria: 'بيتلي، الصفحة الرئيسية',
    login: 'تسجيل الدخول',
    demo: 'احجز عرضاً توضيحياً',
    openMenu: 'فتح القائمة',
    closeMenu: 'إغلاق القائمة',
  },
  mobile: {
    explore: 'اكتشف بيتلي',
    account: 'مساحتك في بيتلي',
  },
  footer: {
    pitch:
      'نظام إدارة عقارات مع فريق من وكلاء الذكاء الاصطناعي، مصمّم للسعودية والمغرب وفرنسا. استكشف مسارات الإدارة والحجز المباشر واستقبال النزلاء.',
    columns: {
      product: 'المنتج',
      solutions: 'الحلول',
      resources: 'الموارد',
      company: 'الشركة',
    },
    resources: [
      'مؤشر الإيجار قصير الأمد',
      'حاسبة الإيرادات',
      'دليل الالتزامات',
      'الأكاديمية',
      'المدونة',
    ],
    company: [
      'الأسعار',
      'الترحيل',
      'المقارنة',
      'كن مزوّداً',
      'احجز عرضاً توضيحياً',
    ],
    legal: {
      notice: 'البيانات القانونية',
      privacy: 'الخصوصية',
      terms: 'الشروط العامة',
      status: 'حالة الخدمة',
    },
    rights: '© 2026 بيتلي. جميع الحقوق محفوظة.',
  },
  shell: {
    skip: 'تخطَّ إلى المحتوى',
    loading: 'جارٍ تحميل الصفحة…',
  },
};

export const LAYOUT_MESSAGES: Record<SiteLanguage, LayoutMessages> = {
  fr,
  en,
  ar,
};
