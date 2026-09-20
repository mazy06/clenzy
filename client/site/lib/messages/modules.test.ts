import { describe, expect, it } from 'vitest';
import { MODULES } from '../../data/catalog';
import { SITE_LANGUAGES } from '../siteLanguage';
import { MODULE_TEXT, moduleText } from './modules';

/**
 * Parite des trois dictionnaires de modules.
 *
 * <p>Deux defauts se cachent ici et ne se voient pas a l'ecran : un module du
 * catalogue sans traduction — qui retombe silencieusement sur le francais au
 * milieu d'une page arabe — et une traduction qui perd une fonctionnalite ou
 * une question. Le menu s'affiche, la page s'affiche, et personne ne compte.</p>
 */
describe('Dictionnaires des modules', () => {
  it('couvre CHAQUE module du catalogue, dans les trois langues', () => {
    const missing: string[] = [];
    for (const language of SITE_LANGUAGES) {
      for (const module of MODULES) {
        if (!MODULE_TEXT[language][module.slug]) {
          missing.push(`${language}/${module.slug}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it('ne garde aucune entrée orpheline', () => {
    // L'inverse : un slug traduit qui ne correspond plus a aucun module est du
    // poids mort, et laisse croire que la page existe encore.
    const slugs = new Set(MODULES.map((module) => module.slug));
    const orphans: string[] = [];
    for (const language of SITE_LANGUAGES) {
      for (const slug of Object.keys(MODULE_TEXT[language])) {
        if (!slugs.has(slug)) orphans.push(`${language}/${slug}`);
      }
    }
    expect(orphans).toEqual([]);
  });

  it('ne perd ni fonctionnalité ni question en traduction', () => {
    for (const module of MODULES) {
      const reference = MODULE_TEXT.fr[module.slug];
      for (const language of SITE_LANGUAGES) {
        const text = MODULE_TEXT[language][module.slug];
        expect(text.features.length, `${module.slug} en ${language}`)
          .toBe(reference.features.length);
        expect(text.faq.length, `${module.slug} en ${language}`)
          .toBe(reference.faq.length);
      }
    }
  });

  it('ne laisse aucun libellé de menu vide', () => {
    // Le `name` et le `menuCopy` alimentent le mega-menu : vides, ils
    // produisent une entree de navigation muette.
    for (const language of SITE_LANGUAGES) {
      for (const module of MODULES) {
        const text = moduleText(module.slug, language);
        expect(text.name.trim(), `${module.slug} en ${language}`).not.toBe('');
        expect(text.menuCopy.trim(), `${module.slug} en ${language}`).not.toBe('');
      }
    }
  });
});
