import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SiteLanguageProvider, SITE_LANGUAGES } from '../lib/siteLanguage';
import { HOME_MESSAGES } from '../lib/messages/home';
import { HOME_RESOURCE_MESSAGES } from '../lib/messages/homeResources';
import HomePage from './HomePage';

vi.mock('../lib/siteLaunch', () => ({
  useSiteLaunch: () => ({ paused: false }),
}));

/**
 * La landing etait en francais EN DUR alors que le lancement se prepare en
 * Arabie saoudite. Deux choses peuvent casser sans que `tsc` ne bronche : une
 * section qui reste en francais parce qu'on a oublie de la brancher, et la
 * direction du document qui ne bascule pas en RTL.
 */

function mount(search: string) {
  window.history.replaceState({}, '', `/${search}`);
  return render(
    <MemoryRouter>
      <SiteLanguageProvider>
        <HomePage />
      </SiteLanguageProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  try {
    sessionStorage.clear();
  } catch {
    /* navigation privee */
  }
});

afterEach(() => {
  cleanup();
  window.history.replaceState({}, '', '/');
  document.documentElement.dir = 'ltr';
  document.documentElement.lang = 'fr';
});

describe('Accueil du site public', () => {
  it.each(SITE_LANGUAGES)(
    'ouvre les ressources et leurs outils dans la langue %s',
    (language) => {
      mount(`?lang=${language}`);
      const m = HOME_RESOURCE_MESSAGES[language];
      const section = within(screen.getByRole('region', { name: m.title }));
      expect(
        section
          .getByRole('link', { name: m.library.title })
          .getAttribute('href'),
      ).toBe(`/ressources?lang=${language}`);
      expect(
        section
          .getByRole('link', { name: m.calculator.title })
          .getAttribute('href'),
      ).toBe(`/ressources/calculateur?lang=${language}`);
      expect(
        section
          .getByRole('link', { name: m.obligations.title })
          .getAttribute('href'),
      ).toBe(`/ressources/obligations?lang=${language}`);
    },
  );
  it('sert l’arabe quand le lien le demande, et bascule en RTL', () => {
    mount('?lang=ar');

    expect(document.documentElement.lang).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain(
      HOME_MESSAGES.ar.hero.title1,
    );
  });

  it('ne laisse aucune section en français quand la page est en arabe', () => {
    // Une section non branchee resterait francaise au milieu de l'arabe.
    mount('?lang=ar');
    const text = document.body.textContent ?? '';
    for (const phrase of [
      HOME_MESSAGES.ar.hero.description,
      HOME_MESSAGES.ar.platform.intro,
      HOME_MESSAGES.ar.local.copy,
      HOME_MESSAGES.ar.faq.title1,
      HOME_MESSAGES.ar.final.cta,
    ]) {
      expect(text).toContain(phrase);
    }
    // Et aucune de leurs contreparties francaises.
    for (const phrase of [
      HOME_MESSAGES.fr.hero.description,
      HOME_MESSAGES.fr.platform.intro,
      HOME_MESSAGES.fr.local.copy,
    ]) {
      expect(text).not.toContain(phrase);
    }
  });

  it('reste en LTR dans les autres langues', () => {
    mount('?lang=en');
    expect(document.documentElement.dir).toBe('ltr');
    expect(document.body.textContent).toContain(
      HOME_MESSAGES.en.hero.description,
    );
  });

  it('garde la promesse saoudienne dans les trois langues', () => {
    // Le marche de lancement doit se lire quelle que soit la langue.
    const EXPECTED: Record<string, RegExp> = {
      fr: /Arabie saoudite/,
      en: /Saudi Arabia/,
      ar: /السعودية/,
    };
    for (const language of SITE_LANGUAGES) {
      cleanup();
      mount(`?lang=${language}`);
      expect(document.body.textContent ?? '', language).toMatch(
        EXPECTED[language],
      );
    }
  });
});
