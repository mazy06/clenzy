import type { SiteLanguage } from './siteLanguage';

export const SITE_ORIGIN = 'https://baitly.fr';

export const canonicalPath = (path: string) =>
  path === '/pre-lancement' ? '/bientot-disponible' : path;

export const canonicalUrl = (path: string, language: SiteLanguage = 'fr') =>
  `${SITE_ORIGIN}${canonicalPath(path)}${language === 'fr' ? '' : `?lang=${language}`}`;

export const robotsDirective = (index: boolean) =>
  index ? 'index, follow, max-image-preview:large' : 'noindex, follow';

/** Only canonical editorial pages belong in the search sitemap. */
export const isIndexablePath = (path: string) =>
  !path.startsWith('/legal/') &&
  ![
    '/404',
    '/inscription',
    '/register',
    '/prestataires/inscription',
    '/prestataires/activation',
  ].includes(path);

export const HOME_SEARCH = {
  fr: {
    title: 'Logiciel de location saisonnière et conciergerie | Baitly',
    description:
      'PMS, channel manager et agents IA pour gérer vos locations saisonnières au Maroc, en France et en Arabie saoudite. Guides locaux et ressources pour les hôtes.',
  },
  en: {
    title: 'Vacation rental and property management software | Baitly',
    description:
      'PMS, channel manager and AI agents for vacation rentals in Morocco, France and Saudi Arabia. Country guides and practical resources for hosts.',
  },
  ar: {
    title: 'برنامج إدارة الإيجارات السياحية والضيافة | Baitly',
    description:
      'نظام إدارة عقارات ومدير قنوات ووكلاء ذكاء اصطناعي للإيجارات السياحية في السعودية والمغرب وفرنسا. أدلة محلية وموارد عملية للمضيفين.',
  },
} satisfies Record<SiteLanguage, { title: string; description: string }>;
