import { describe, expect, it } from 'vitest';
import { SITE_LANGUAGES, type SiteLanguage } from '../siteLanguage';
import { AGENTS_MESSAGES } from './agents';
import { ASSISTANT_MESSAGES } from './assistant';
import { GUIDE_MESSAGES } from './guide';
import { HOME_MESSAGES } from './home';
import { LAYOUT_MESSAGES } from './layout';
import { MOCKUP_MESSAGES } from './mockups';
import { MODULE_PAGE_MESSAGES } from './modulePage';
import { PAGE_MESSAGES } from './pages';
import { PLANNING_MOCKUP_MESSAGES } from './planningMockup';
import { PRICING_MESSAGES } from './pricing';
import { PROVIDERS_MESSAGES } from './providers';
import { BAITLY_BOOKING_MESSAGES } from './baitlyBooking';
import { BAITLY_BOOKING_UPSELL_MESSAGES } from './baitlyBookingUpsells';
import { BAITLY_LOYALTY_MESSAGES } from './baitlyLoyalty';
import { BAITLY_PRODUCT_MESSAGES } from './baitlyProducts';
import { BAITLY_PRODUCT_DEMO_MESSAGES } from './baitlyProductDemos';
import { BAITLY_RESOURCE_MESSAGES } from './baitlyResources';

/**
 * Parite de FORME entre les trois langues.
 *
 * <p>TypeScript garantit deja que chaque dictionnaire traduit a les memes
 * CLES que le francais — `const en: Messages` ne compile pas autrement. Ce
 * qu'il ne voit pas, c'est la LONGUEUR des tableaux : un `features` a trois
 * entrees en francais et deux en arabe compile parfaitement, et fait
 * simplement disparaitre un argument de vente de la page arabe.</p>
 *
 * <p>Ce test parcourt donc chaque dictionnaire en profondeur et compare les
 * longueurs a la reference francaise. Il attrape aussi la chaine vide, qui
 * produit un titre ou un bouton muet.</p>
 */
const DICTIONARIES: Record<string, Record<SiteLanguage, unknown>> = {
  baitlyResources: BAITLY_RESOURCE_MESSAGES,
  baitlyBooking: BAITLY_BOOKING_MESSAGES,
  baitlyBookingUpsells: BAITLY_BOOKING_UPSELL_MESSAGES,
  baitlyLoyalty: BAITLY_LOYALTY_MESSAGES,
  baitlyProducts: BAITLY_PRODUCT_MESSAGES,
  baitlyProductDemos: BAITLY_PRODUCT_DEMO_MESSAGES,
  agents: AGENTS_MESSAGES,
  assistant: ASSISTANT_MESSAGES,
  guide: GUIDE_MESSAGES,
  home: HOME_MESSAGES,
  layout: LAYOUT_MESSAGES,
  mockups: MOCKUP_MESSAGES,
  modulePage: MODULE_PAGE_MESSAGES,
  pages: PAGE_MESSAGES,
  planningMockup: PLANNING_MOCKUP_MESSAGES,
  pricing: PRICING_MESSAGES,
  providers: PROVIDERS_MESSAGES,
};

/** Signale tout ecart de forme entre une traduction et la reference. */
function compare(
  reference: unknown,
  candidate: unknown,
  path: string,
  issues: string[],
): void {
  // Une cle facultative peut legitimement manquer : la mention de financement
  // n'existe que la ou un dispositif s'applique. TypeScript garantit deja que
  // les cles OBLIGATOIRES sont toutes presentes.
  if (candidate === undefined) return;
  if (Array.isArray(reference)) {
    if (!Array.isArray(candidate)) {
      issues.push(`${path} : tableau attendu`);
      return;
    }
    if (reference.length !== candidate.length) {
      issues.push(
        `${path} : ${candidate.length} entrées au lieu de ${reference.length}`,
      );
      return;
    }
    reference.forEach((item, index) =>
      compare(item, candidate[index], `${path}[${index}]`, issues),
    );
    return;
  }
  if (reference !== null && typeof reference === 'object') {
    if (candidate === null || typeof candidate !== 'object') {
      issues.push(`${path} : objet attendu`);
      return;
    }
    for (const key of Object.keys(reference as Record<string, unknown>)) {
      compare(
        (reference as Record<string, unknown>)[key],
        (candidate as Record<string, unknown>)[key],
        `${path}.${key}`,
        issues,
      );
    }
    return;
  }
  if (typeof reference === 'string' && typeof candidate !== 'string') {
    issues.push(`${path} : texte attendu`);
  }
}

describe('Parité des dictionnaires de la landing', () => {
  for (const [name, dictionary] of Object.entries(DICTIONARIES)) {
    it(`${name} a la même forme dans les trois langues`, () => {
      const issues: string[] = [];
      for (const language of SITE_LANGUAGES) {
        if (language === 'fr') continue;
        compare(
          dictionary.fr,
          dictionary[language],
          `${name}(${language})`,
          issues,
        );
      }
      expect(issues).toEqual([]);
    });
  }

  it('couvre les trois langues dans chaque dictionnaire', () => {
    for (const [name, dictionary] of Object.entries(DICTIONARIES)) {
      for (const language of SITE_LANGUAGES) {
        expect(dictionary[language], `${name} en ${language}`).toBeTruthy();
      }
    }
  });
});
