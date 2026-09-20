import { describe, expect, it } from 'vitest';
import { RESOURCES, SOLUTIONS } from '../../data/catalog';
import { SITE_LANGUAGES } from '../siteLanguage';
import { RESOURCE_TEXT, SOLUTION_TEXT, resourceText, solutionText } from './solutions';

/**
 * Parite des solutions et des ressources.
 *
 * <p>Meme piege que pour les modules : une entree non traduite retombe en
 * silence sur le francais, au milieu d'un menu arabe. Rien a l'ecran ne le
 * signale — seul un test compte.</p>
 */
describe('Dictionnaires des solutions et ressources', () => {
  it('couvre CHAQUE solution du catalogue, dans les trois langues', () => {
    const missing: string[] = [];
    for (const language of SITE_LANGUAGES) {
      for (const solution of SOLUTIONS) {
        if (!SOLUTION_TEXT[language][solution.slug]) missing.push(`${language}/${solution.slug}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('couvre CHAQUE ressource du catalogue, dans les trois langues', () => {
    const missing: string[] = [];
    for (const language of SITE_LANGUAGES) {
      for (const resource of RESOURCES) {
        if (!RESOURCE_TEXT[language][resource.id]) missing.push(`${language}/${resource.id}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('ne garde aucune entrée orpheline', () => {
    const solutionSlugs = new Set(SOLUTIONS.map((solution) => solution.slug));
    const resourceIds = new Set(RESOURCES.map((resource) => resource.id));
    const orphans: string[] = [];
    for (const language of SITE_LANGUAGES) {
      for (const slug of Object.keys(SOLUTION_TEXT[language])) {
        if (!solutionSlugs.has(slug)) orphans.push(`solution ${language}/${slug}`);
      }
      for (const id of Object.keys(RESOURCE_TEXT[language])) {
        if (!resourceIds.has(id)) orphans.push(`ressource ${language}/${id}`);
      }
    }
    expect(orphans).toEqual([]);
  });

  it('ne perd aucun argument de vente en traduction', () => {
    // Les `points` sont la liste a coches de la page Solutions : en perdre un
    // en arabe, c'est vendre moins sans que personne ne le voie.
    for (const solution of SOLUTIONS) {
      const reference = SOLUTION_TEXT.fr[solution.slug];
      for (const language of SITE_LANGUAGES) {
        expect(SOLUTION_TEXT[language][solution.slug].points.length, `${solution.slug} en ${language}`)
          .toBe(reference.points.length);
      }
    }
  });

  it('ne laisse aucun libellé de menu vide', () => {
    for (const language of SITE_LANGUAGES) {
      for (const solution of SOLUTIONS) {
        const text = solutionText(solution.slug, language);
        expect(text.name.trim(), `${solution.slug} en ${language}`).not.toBe('');
        expect(text.menuCopy.trim(), `${solution.slug} en ${language}`).not.toBe('');
      }
      for (const resource of RESOURCES) {
        const text = resourceText(resource.id, language);
        expect(text.name.trim(), `${resource.id} en ${language}`).not.toBe('');
        expect(text.tag.trim(), `${resource.id} en ${language}`).not.toBe('');
      }
    }
  });
});
