import type { SiteLanguage } from './siteLanguage';
import { SITE_ORIGIN, canonicalUrl } from './siteSeo';
import { BAITLY_PRICING_MARKETS } from '../data/baitlyLoyaltyPricing';
import { PRICING_MESSAGES } from './messages/pricing';
import { RESOURCE_GLOSSARY } from '../data/baitlyResourceGlossary';
import { ACADEMY_EPISODES } from '../data/baitlyAcademyVideos';
import { BAITLY_ACADEMY_MESSAGES } from './messages/baitlyAcademy';

type JsonLd = Record<string, unknown>;

const RESOURCES = { fr: 'Ressources', en: 'Resources', ar: 'الموارد' };
const ORGANIZATION = { '@id': `${SITE_ORIGIN}/#organization` };

/** Every value below is read from the data the page itself renders; nothing is restated by hand. */
function pricingOffers(language: SiteLanguage): JsonLd {
  const plans = PRICING_MESSAGES[language].plans;
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Baitly',
    url: canonicalUrl('/tarifs', language),
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    publisher: ORGANIZATION,
    offers: Object.entries(BAITLY_PRICING_MARKETS).flatMap(([market, rates]) =>
      (['essential', 'pro'] as const).map((plan, index) => ({
        '@type': 'Offer',
        name: plans[index].name,
        price: rates[plan],
        priceCurrency: rates.currency,
        eligibleRegion:
          market === 'EU' ? { '@type': 'Place', name: 'Europe' } : market,
        priceSpecification: {
          '@type': 'UnitPriceSpecification',
          price: rates[plan],
          priceCurrency: rates.currency,
          valueAddedTaxIncluded: false,
          referenceQuantity: {
            '@type': 'QuantitativeValue',
            value: 1,
            unitText: 'property per month',
          },
        },
      })),
    ),
  };
}

function glossary(language: SiteLanguage, name: string): JsonLd {
  const url = canonicalUrl('/ressources/glossaire', language);
  return {
    '@context': 'https://schema.org',
    '@type': 'DefinedTermSet',
    '@id': `${url}#glossary`,
    name,
    url,
    inLanguage: language,
    hasDefinedTerm: RESOURCE_GLOSSARY.map((entry) => ({
      '@type': 'DefinedTerm',
      name: entry[language].term,
      description: entry[language].definition,
      inDefinedTermSet: `${url}#glossary`,
    })),
  };
}

function calculator(language: SiteLanguage, name: string): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name,
    url: canonicalUrl('/ressources/calculateur', language),
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Web',
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: 0, priceCurrency: 'EUR' },
    publisher: ORGANIZATION,
  };
}

function academy(language: SiteLanguage, name: string): JsonLd {
  const episodes = BAITLY_ACADEMY_MESSAGES[language].episodes;
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name,
    url: canonicalUrl('/ressources/academie', language),
    itemListElement: ACADEMY_EPISODES.map((episode, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: episodes[episode.slug].title,
      url: canonicalUrl(`/ressources/academie/${episode.slug}`, language),
    })),
  };
}

function breadcrumb(path: string, language: SiteLanguage, name: string): JsonLd {
  const crumbs = [
    { name: 'Baitly', item: canonicalUrl('/', language) },
    ...(path.startsWith('/ressources/')
      ? [{ name: RESOURCES[language], item: canonicalUrl('/ressources', language) }]
      : []),
    { name, item: canonicalUrl(path, language) },
  ];
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      ...crumb,
    })),
  };
}

/**
 * Structured data for commercial and tool pages. Editorial pages (articles,
 * country guides, Academy episodes) carry their own data and are not handled here.
 */
export function siteStructuredData(
  path: string,
  language: SiteLanguage,
  title: string,
): JsonLd[] | undefined {
  if (path === '/' || path.startsWith('/ressources/academie/')) return undefined;
  const name = title.replace(/ \| Baitly$/, '');
  const page = {
    '/tarifs': () => pricingOffers(language),
    '/ressources/glossaire': () => glossary(language, name),
    '/ressources/calculateur': () => calculator(language, name),
    '/ressources/academie': () => academy(language, name),
  }[path];
  return [...(page ? [page()] : []), breadcrumb(path, language, name)];
}
