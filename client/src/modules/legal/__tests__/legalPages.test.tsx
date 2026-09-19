import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import i18n from '../../../i18n/config';
import { renderWithProviders } from '../../../test/renderWithProviders';
import Cgu from '../Cgu';
import Privacy from '../Privacy';

/**
 * Les deux documents legaux sont servis en trois langues et leur texte vit
 * desormais en locales. Deux choses peuvent casser sans que `tsc` ne bronche :
 * une cle absente d'une locale — l'ecran affiche alors la CLE BRUTE au lieu de
 * la phrase — et un `Trans` dont le balisage ne correspond plus aux composants
 * fournis, qui ferait disparaitre le lien de contact d'une page qui engage.
 */

// La geoloc IP n'a rien a faire dans un test : on fige la langue nous-memes.
vi.mock('../../../hooks/useGeoAuthLanguage', () => ({
  useGeoAuthLanguage: () => ({ isRtl: false, detectedLanguage: null }),
}));

const LANGUAGES = ['fr', 'en', 'ar'] as const;

/** Le mot qui designe la version de reference, dans chaque langue. */
const FRENCH_PREVAILS: Record<(typeof LANGUAGES)[number], RegExp> = {
  fr: /version française (prévaut|fait référence)/,
  en: /French version (prevails|is the reference version)/,
  ar: /النسخة الفرنسية هي (المعتمدة|المرجع)/,
};

beforeEach(async () => {
  await i18n.changeLanguage('fr');
});
afterEach(cleanup);

/** Une cle brute a l'ecran : `legal.cgu.purpose.title` au lieu de « 1. Objet ». */
const RAW_KEY = /\blegal\.(cgu|privacy)\.[a-zA-Z0-9.]+/;

describe.each(LANGUAGES)('Pages legales (%s)', (language) => {
  beforeEach(async () => {
    await i18n.changeLanguage(language);
  });

  it('rend les CGU sans laisser de cle brute a l’ecran', () => {
    renderWithProviders(<Cgu />);
    // 10 sections + le titre de page : tout doit etre traduit.
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(10);
    expect(document.body.textContent ?? '').not.toMatch(RAW_KEY);
  });

  it('rend la politique de confidentialite sans laisser de cle brute', () => {
    renderWithProviders(<Privacy />);
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(9);
    expect(document.body.textContent ?? '').not.toMatch(RAW_KEY);
  });

  it('conserve le contact support dans les CGU', () => {
    renderWithProviders(<Cgu />);
    const mailtos = screen
      .getAllByRole('link')
      .filter((a) => a.getAttribute('href') === 'mailto:support@clenzy.fr');
    expect(mailtos.length).toBeGreaterThan(0);
  });

  it('conserve le contact DPO dans la politique de confidentialite', () => {
    renderWithProviders(<Privacy />);
    const mailtos = screen
      .getAllByRole('link')
      .filter((a) => a.getAttribute('href') === 'mailto:dpo@clenzy.fr');
    expect(mailtos.length).toBeGreaterThan(0);
  });

  it('porte la clause de langue faisant foi dans les deux documents', () => {
    // Elle designe la version qui tranche en cas de divergence entre les trois
    // traductions : un document publie sans elle n'a pas de texte de reference.
    renderWithProviders(<Cgu />);
    expect(document.body.textContent ?? '').toMatch(FRENCH_PREVAILS[language]);
    cleanup();

    renderWithProviders(<Privacy />);
    expect(document.body.textContent ?? '').toMatch(FRENCH_PREVAILS[language]);
  });

  it('met en exergue le nom des sept droits RGPD', () => {
    const { container } = renderWithProviders(<Privacy />);
    // Le balisage `<b>` des traductions doit devenir un VRAI <strong> : mal
    // cable, `Trans` recracherait « <b>Acces</b> » en texte litteral.
    expect(container.querySelectorAll('li strong')).toHaveLength(7);
    expect(document.body.textContent ?? '').not.toContain('<b>');
  });
});

describe('Date d’effet', () => {
  it('reste gregorienne en arabe — la date qui engage est la meme dans les trois langues', async () => {
    await i18n.changeLanguage('ar');
    renderWithProviders(<Cgu />);
    // 2026 en gregorien ; en hegirien la meme date tomberait sur 1447/1448.
    expect(document.body.textContent).toMatch(/2026/);
  });
});
