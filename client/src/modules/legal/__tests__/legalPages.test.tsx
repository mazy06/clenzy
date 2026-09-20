import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import i18n from '../../../i18n/config';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { LEGAL_SLUGS, legalDocs, getLegalDoc } from '../corpus';
import Cgu from '../Cgu';
import Privacy from '../Privacy';
import MentionsLegales from '../MentionsLegales';

/**
 * Le PMS et la landing portaient chacun leur corpus juridique. Ils se
 * contredisaient sur le droit applicable (francais d'un cote, marocain de
 * l'autre), sur l'editeur, sur l'autorite de controle et sur le role RGPD —
 * et c'est le brouillon du PMS que la case obligatoire de l'inscription
 * faisait accepter.
 *
 * <p>Une source unique rend la contradiction impossible par construction. Ce
 * qui reste a tenir, c'est la parite entre les trois langues : un article
 * perdu en traduction ne se voit pas a la lecture d'un ecran.</p>
 */

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

beforeEach(async () => {
  await i18n.changeLanguage('fr');
});
afterEach(cleanup);

describe('Parite du corpus entre les trois langues', () => {
  it('sert les mêmes documents, sous les mêmes slugs', () => {
    for (const language of LANGUAGES) {
      expect(legalDocs(language).map((doc) => doc.slug)).toEqual([...LEGAL_SLUGS]);
    }
  });

  it('ne perd aucun article en traduction', () => {
    // Le defaut invisible : une traduction qui saute un article. Rien a
    // l'ecran ne le signale, et le document ampute engage quand meme.
    for (const slug of LEGAL_SLUGS) {
      const reference = getLegalDoc(slug, 'fr');
      for (const language of LANGUAGES) {
        const doc = getLegalDoc(slug, language);
        expect(doc?.blocks.length, `${slug} en ${language}`).toBe(reference?.blocks.length);
      }
    }
  });

  it('ne perd aucun paragraphe, aucune puce, aucune ligne de tableau', () => {
    for (const slug of LEGAL_SLUGS) {
      const reference = getLegalDoc(slug, 'fr');
      for (const language of LANGUAGES) {
        const doc = getLegalDoc(slug, language);
        reference?.blocks.forEach((block, index) => {
          const other = doc?.blocks[index];
          const where = `${slug}[${index}] en ${language}`;
          expect(other?.paragraphs?.length ?? 0, where).toBe(block.paragraphs?.length ?? 0);
          expect(other?.list?.length ?? 0, where).toBe(block.list?.length ?? 0);
          expect(other?.table?.rows.length ?? 0, where).toBe(block.table?.rows.length ?? 0);
          expect(other?.table?.headers.length ?? 0, where).toBe(block.table?.headers.length ?? 0);
        });
      }
    }
  });

  it('laisse un texte non vide partout', () => {
    for (const language of LANGUAGES) {
      for (const doc of legalDocs(language)) {
        expect(doc.title.trim()).not.toBe('');
        expect(doc.intro.trim()).not.toBe('');
        expect(doc.updated.trim()).not.toBe('');
        for (const block of doc.blocks) {
          expect(block.heading.trim(), `${doc.slug} / ${block.heading}`).not.toBe('');
        }
      }
    }
  });

  it('garde une date d’effet grégorienne dans les trois langues', () => {
    // En hegirien, la version arabe annoncerait une autre date d'effet que la
    // francaise, pour le meme document.
    for (const language of LANGUAGES) {
      for (const doc of legalDocs(language)) {
        expect(doc.updated, `${doc.slug} en ${language}`).toMatch(/2026/);
      }
    }
  });
});

describe('Ce que le corpus dit', () => {
  it('annonce le droit marocain, et non plus le droit français', () => {
    // La contradiction d'origine : les CGU du PMS stipulaient le droit
    // francais quand les CGV publiees stipulaient le droit marocain.
    const cgv = getLegalDoc('cgv', 'fr');
    expect(JSON.stringify(cgv?.blocks.at(-1))).toMatch(/droit marocain/);
    expect(JSON.stringify(cgv)).not.toMatch(/régies par le droit français/);
  });

  it('porte la clause de langue faisant foi dans les trois langues', () => {
    const EXPECTED: Record<string, RegExp> = {
      fr: /version française prévaut/,
      en: /French version prevails/,
      ar: /النسخة الفرنسية هي المعتمدة/,
    };
    for (const language of LANGUAGES) {
      const cgv = getLegalDoc('cgv', language);
      expect(JSON.stringify(cgv?.blocks.at(-1))).toMatch(EXPECTED[language]);
    }
  });

  it('qualifie Baitly de sous-traitant pour les données voyageurs', () => {
    // L'ancien stub du PMS disait l'inverse. C'est cette qualification qui
    // decide qui repond a une demande d'acces et qui porte la responsabilite.
    const privacy = JSON.stringify(getLegalDoc('confidentialite', 'fr'));
    expect(privacy).toMatch(/sous-traitant/);
    expect(privacy).toMatch(/CNDP/);
  });
});

describe.each(LANGUAGES)('Rendu des pages (%s)', (language) => {
  beforeEach(async () => {
    await i18n.changeLanguage(language);
  });

  it.each([
    ['CGU', 'cgv'],
    ['confidentialité', 'confidentialite'],
    ['mentions légales', 'mentions-legales'],
  ])('rend %s avec tous ses articles', (label, slug) => {
    const page = label === 'CGU'
      ? <Cgu />
      : label === 'confidentialité'
        ? <Privacy />
        : <MentionsLegales />;
    renderWithProviders(page);
    const expected = getLegalDoc(slug, language)?.blocks.length ?? 0;
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(expected);
  });

  it('rend le tableau des traitements de la politique de confidentialité', () => {
    const { container } = renderWithProviders(<Privacy />);
    const table = container.querySelector('table');
    expect(table).toBeTruthy();
    expect(table?.querySelectorAll('thead th')).toHaveLength(4);
    expect(table?.querySelectorAll('tbody tr')).toHaveLength(5);
  });
});
