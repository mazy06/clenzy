import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import i18n from '../../../i18n/config';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { AGENT_IDS } from '../../supervision/constants';
import AuthLayout, { SLIDE_IDS } from '../AuthLayout';

/**
 * Le premier ecran du produit annonce combien d'agents travaillent pour l'hote.
 * Ce nombre a vecu a « 8 » pendant que la constellation en comptait dix : une
 * promesse fausse, dans les trois langues, sur la page la plus vue. Rien ne
 * pouvait le signaler — un chiffre en dur dans une traduction ne contredit
 * aucun type.
 */

// Le panneau de marque — donc le carrousel — n'est monte qu'au-dela de 900 px.
// Sous jsdom, `matchMedia` repond toujours faux et l'accroche ne serait jamais
// rendue : le test passerait au vert sans rien avoir regarde. On force le grand
// ecran, et on laisse `prefers-reduced-motion` a faux pour rester sur le cas reel.
vi.mock('../../../hooks/use-media-query', () => ({
  useMediaQuery: (query: string) => !query.includes('prefers-reduced-motion'),
}));

// La geoloc IP n'a rien a faire dans un test : la langue est fixee ici.
vi.mock('../../../hooks/useGeoAuthLanguage', () => ({
  useGeoAuthLanguage: () => ({
    isRtl: false,
    detectedLanguage: null,
    language: 'fr',
    chooseLanguage: () => {},
  }),
}));

const LANGUAGES = ['fr', 'en', 'ar'] as const;

afterEach(cleanup);

describe.each(LANGUAGES)('Carrousel d’authentification (%s)', (language) => {
  beforeEach(async () => {
    await i18n.changeLanguage(language);
  });

  it('annonce le nombre REEL d’agents de la constellation', () => {
    renderWithProviders(<AuthLayout><div /></AuthLayout>);
    const heading = screen.getAllByRole('heading', { level: 2 })[0];
    expect(heading).toBeTruthy();
    expect(heading.textContent).toContain(String(AGENT_IDS.length));
  });

  it('ne laisse pas le gabarit d’interpolation a l’ecran', () => {
    renderWithProviders(<AuthLayout><div /></AuthLayout>);
    // Une cle mal appelee afficherait « {{agentCount}} » tel quel.
    expect(document.body.textContent ?? '').not.toContain('{{');
  });
});

describe('Accroche du carrousel', () => {
  it('ne cite plus un nombre d’agents fige dans les traductions', () => {
    // Le nombre vient de AGENT_IDS ; le retrouver en dur dans une locale
    // signifie qu'une promesse s'est remise a vivre sa propre vie.
    for (const language of LANGUAGES) {
      const highlight = i18n.getResource(language, 'translation', 'auth.slides.s0.highlight');
      expect(String(highlight)).toContain('{{agentCount}}');
      expect(String(highlight)).not.toMatch(/\b\d+\s*(agents?|وكلاء)/i);
    }
  });
});

describe('Promesses du carrousel', () => {
  /**
   * Chiffres retires parce que personne, dans l'equipe, ne savait d'ou ils
   * venaient — et une capacite que le produit n'a pas. Les reintroduire est
   * silencieux : une traduction ne contredit aucun type.
   */
  const RETIREES: ReadonlyArray<[string, RegExp]> = [
    ['gain d’heures hebdomadaire', /12\s*h|12 hours|12\s*ساعة/i],
    ['delai de premiere reservation', /24\s*(heures|hours|ساعة)/i],
    ['duree de mise en route', /15\s*(minutes|دقيقة)/i],
    ['delai de signature', /30\s*(secondes|seconds|ثانية)/i],
    ['taille de portefeuille chiffree', /1\s*(a|à|to|إلى)\s*100/i],
    ['notation des photos', /photos? (analys|not)|photo (scoring|rated)|تقييم الصور/i],
  ];

  it.each(RETIREES)('ne reintroduit pas : %s', (_label, pattern) => {
    for (const language of LANGUAGES) {
      const bundle = i18n.getResourceBundle(language, 'translation');
      const slides = JSON.stringify(bundle?.auth?.slides ?? {});
      expect(slides).not.toMatch(pattern);
    }
  });

  it('n’annonce pas la fin des doubles reservations, que le produit COMPTE', () => {
    // Un KPI dedie les denombre : promettre leur disparition contredirait
    // l'instrumentation que le produit expose a ses propres administrateurs.
    for (const language of LANGUAGES) {
      const bundle = i18n.getResourceBundle(language, 'translation');
      const slides = JSON.stringify(bundle?.auth?.slides ?? {});
      expect(slides).not.toMatch(/plus de double|no more double booking/i);
    }
  });
});

describe('Couverture des slides', () => {
  it('donne son texte a CHAQUE slide, dans les trois langues', () => {
    // Ajouter un identifiant sans poser ses cles afficherait
    // « auth.slides.s14.highlight » en clair sur la page de connexion.
    const missing: string[] = [];
    for (const language of LANGUAGES) {
      const bundle = i18n.getResourceBundle(language, 'translation');
      for (const id of SLIDE_IDS) {
        const slide = bundle?.auth?.slides?.[id];
        for (const field of ['highlight', 'end', 'subtitle']) {
          if (!slide?.[field]) missing.push(`${language}.${id}.${field}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it('ne garde pas le texte d’une slide retiree du carrousel', () => {
    // Le sens inverse du test precedent. Retirer une slide du tableau sans
    // retirer ses cles laisse du poids mort que le prochain lecteur prendra
    // pour du contenu vivant — c'est exactement ce qu'avait fait `auth.layout`.
    const orphans: string[] = [];
    for (const language of LANGUAGES) {
      const bundle = i18n.getResourceBundle(language, 'translation');
      for (const id of Object.keys(bundle?.auth?.slides ?? {})) {
        if (!SLIDE_IDS.includes(id)) orphans.push(`${language}.${id}`);
      }
    }
    expect(orphans).toEqual([]);
  });

  it('couvre les modules vendeurs du produit', () => {
    // Le moteur de reservation est le deuxieme module du produit par la taille
    // et n'apparaissait nulle part ; le livret, la marketplace et les ventes
    // additionnelles non plus. Ce test tient la porte ouverte.
    const bundle = i18n.getResourceBundle('fr', 'translation');
    const copy = JSON.stringify(bundle?.auth?.slides ?? {}).toLowerCase();
    for (const theme of [/r[ée]servation/, /livret/, /prestataire/, /additionnelle/]) {
      expect(copy).toMatch(theme);
    }
  });
});
