import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SiteLanguageProvider, type SiteLanguage } from '../lib/siteLanguage';
import { SiteLaunchProvider } from '../lib/siteLaunch';
import { PRELAUNCH_MESSAGES } from '../lib/messages/prelaunch';
import { DemoRoute } from '../components/AcquisitionRoutes';
import PrelaunchPage from './PrelaunchPage';

const config = {
  registrationsPaused: true,
  launchAt: null,
  launchTimeZone: 'Europe/Paris',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });
const fetchMock = vi.fn();

beforeEach(() => {
  sessionStorage.clear();
  fetchMock.mockReset().mockImplementation(() => Promise.resolve(json(config)));
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState({}, '', '/');
});

function mount(language: SiteLanguage = 'fr', route = '/bientot-disponible') {
  window.history.replaceState({}, '', `${route}?lang=${language}`);
  return render(
    <MemoryRouter initialEntries={[`${route}?lang=${language}`]}>
      <SiteLanguageProvider>
        <SiteLaunchProvider>
          <Routes>
            <Route path="/demo" element={<DemoRoute />} />
            <Route path="/bientot-disponible" element={<PrelaunchPage />} />
          </Routes>
        </SiteLaunchProvider>
      </SiteLanguageProvider>
    </MemoryRouter>,
  );
}

function fillSignup(language: SiteLanguage = 'fr') {
  const m = PRELAUNCH_MESSAGES[language];
  fireEvent.change(screen.getByLabelText(m.email), {
    target: { value: 'guest@example.com' },
  });
  fireEvent.click(
    screen.getByRole('checkbox', {
      name: new RegExp(m.consent.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    }),
  );
  fireEvent.click(screen.getByRole('button', { name: m.submit }));
}

describe('Pré-lancement public', () => {
  it.each(['fr', 'en', 'ar'] as const)(
    'affiche le parcours et la direction en %s',
    async (language) => {
      mount(language);
      const m = PRELAUNCH_MESSAGES[language];
      expect(await screen.findByText(m.dateSoon)).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
        m.heading,
      );
      expect(
        screen.getByRole('button', { name: m.submit }),
      ).toBeInTheDocument();
      expect(document.documentElement.dir).toBe(
        language === 'ar' ? 'rtl' : 'ltr',
      );
    },
  );

  it('valide email et consentement avant tout envoi', async () => {
    mount();
    const m = PRELAUNCH_MESSAGES.fr;
    await screen.findByText(m.dateSoon);
    fireEvent.click(screen.getByRole('button', { name: m.submit }));
    expect(screen.getByRole('alert')).toHaveTextContent(m.invalidEmail);
    fireEvent.change(screen.getByLabelText(m.email), {
      target: { value: 'guest@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: m.submit }));
    expect(screen.getByRole('alert')).toHaveTextContent(m.consentRequired);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([false, true])(
    'enregistre un email dans la liste existante (doublon : %s)',
    async (alreadyRegistered) => {
      mount('ar');
      const m = PRELAUNCH_MESSAGES.ar;
      await screen.findByText(m.dateSoon);
      fetchMock.mockResolvedValueOnce(json({ position: 3, alreadyRegistered }));
      fillSignup('ar');
      expect(
        await screen.findByRole('heading', {
          name: alreadyRegistered ? m.duplicate : m.success,
        }),
      ).toBeInTheDocument();
      expect(fetchMock).toHaveBeenLastCalledWith(
        expect.stringContaining('/api/public/waitlist'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            email: 'guest@example.com',
            source: 'baitly-prelaunch-ar',
          }),
        }),
      );
      expect(screen.getByRole('status')).toHaveFocus();
    },
  );

  it.each([429, 500])(
    'garde le formulaire récupérable après HTTP %s',
    async (status) => {
      mount('en');
      const m = PRELAUNCH_MESSAGES.en;
      await screen.findByText(m.dateSoon);
      fetchMock.mockResolvedValueOnce(json({}, status));
      fillSignup('en');
      await waitFor(() =>
        expect(screen.getByRole('alert')).toHaveTextContent(
          status === 429 ? m.rateLimit : m.error,
        ),
      );
      expect(screen.getByRole('button', { name: m.submit })).toBeEnabled();
      expect(screen.getByLabelText(m.email)).toHaveValue('guest@example.com');
    },
  );

  it('reste fermé avec un fuseau invalide reçu du serveur', async () => {
    fetchMock.mockResolvedValueOnce(
      json({ ...config, launchTimeZone: 'Invalid/Zone' }),
    );
    mount();
    expect(
      await screen.findByText(PRELAUNCH_MESSAGES.fr.unavailable),
    ).toBeInTheDocument();
    expect(screen.getByText(PRELAUNCH_MESSAGES.fr.paused)).toBeInTheDocument();
  });

  it('réoriente les anciens liens démo pendant la pause', async () => {
    mount('en', '/demo');
    expect(
      await screen.findByText(PRELAUNCH_MESSAGES.en.dateSoon),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: PRELAUNCH_MESSAGES.en.submit }),
    ).toBeInTheDocument();
  });

  it('attend la configuration avant de rétablir la démo', async () => {
    let resolve!: (response: Response) => void;
    fetchMock.mockReturnValueOnce(
      new Promise<Response>((done) => {
        resolve = done;
      }),
    );
    mount('fr', '/demo');
    expect(screen.getByRole('status')).toHaveTextContent(
      PRELAUNCH_MESSAGES.fr.loading,
    );
    resolve(json({ ...config, registrationsPaused: false }));
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1 })).not.toHaveTextContent(
        PRELAUNCH_MESSAGES.fr.heading,
      ),
    );
    expect(
      screen.queryByText(PRELAUNCH_MESSAGES.fr.formTitle),
    ).not.toBeInTheDocument();
  });
});
