import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SiteLanguageProvider, type SiteLanguage } from '../lib/siteLanguage';
import { BAITLY_CONTACT_MESSAGES } from '../lib/messages/baitlyContact';
import ContactPage from './ContactPage';

const fetchMock = vi.fn();
beforeEach(() => {
  sessionStorage.clear();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState({}, '', '/');
});
function mount(language: SiteLanguage = 'fr', query = '') {
  window.history.replaceState({}, '', `/contact?lang=${language}`);
  return render(
    <MemoryRouter initialEntries={[`/contact?lang=${language}${query}`]}>
      <SiteLanguageProvider>
        <ContactPage intent="demo" />
      </SiteLanguageProvider>
    </MemoryRouter>,
  );
}
function fill(language: SiteLanguage = 'fr') {
  const m = BAITLY_CONTACT_MESSAGES[language];
  fireEvent.change(screen.getByLabelText(m.name), {
    target: { value: 'Alex Exemple' },
  });
  fireEvent.change(screen.getByLabelText(m.email), {
    target: { value: 'alex@example.test' },
  });
  fireEvent.change(screen.getByLabelText(m.message), {
    target: { value: 'Je souhaite découvrir le planning.' },
  });
}
describe('Public contact request', () => {
  it('prefills the property count and includes the selected market and offer', async () => {
    fetchMock.mockResolvedValue(
      new Response('{"status":"success"}', { status: 200 }),
    );
    mount('fr', '&plan=pro&market=SA&properties=12');
    fill();
    expect(
      screen.getByLabelText(BAITLY_CONTACT_MESSAGES.fr.properties),
    ).toHaveValue(12);
    fireEvent.click(
      screen.getByRole('button', { name: BAITLY_CONTACT_MESSAGES.fr.send }),
    );
    await screen.findByRole('status');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      plan: 'pro',
      market: 'SA',
      properties: '12',
    });
  });
  it.each(['fr', 'en', 'ar'] as const)(
    'confirms only a successful save in %s',
    async (language) => {
      fetchMock.mockResolvedValue(
        new Response(JSON.stringify({ status: 'success' }), { status: 200 }),
      );
      mount(language);
      fill(language);
      const m = BAITLY_CONTACT_MESSAGES[language];
      fireEvent.click(screen.getByRole('button', { name: m.send }));
      expect(await screen.findByRole('status')).toHaveTextContent(m.success);
      expect(screen.getByText(m.noAppointment)).toBeVisible();
      const [url, request] = fetchMock.mock.calls[0];
      expect(url).toMatch(/\/api\/public\/support$/);
      expect(JSON.parse(request.body)).toMatchObject({
        subject: 'demo',
        name: 'Alex Exemple',
        language,
        source: 'baitly-site',
      });
    },
  );
  it('preserves input on failure and allows a retry', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('{}', { status: 429 }))
      .mockResolvedValueOnce(
        new Response('{"status":"success"}', { status: 200 }),
      );
    mount();
    fill();
    const m = BAITLY_CONTACT_MESSAGES.fr;
    fireEvent.click(screen.getByRole('button', { name: m.send }));
    expect(await screen.findByRole('alert')).toHaveTextContent(m.limited);
    expect(screen.getByLabelText(m.name)).toHaveValue('Alex Exemple');
    fireEvent.click(screen.getByRole('button', { name: m.send }));
    expect(await screen.findByRole('status')).toHaveTextContent(m.success);
  });
  it('does not treat an unexpected 200 payload as success', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));
    mount();
    fill();
    const m = BAITLY_CONTACT_MESSAGES.fr;
    fireEvent.click(screen.getByRole('button', { name: m.send }));
    expect(await screen.findByRole('alert')).toHaveTextContent(m.error);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
  it('disables duplicate submissions while saving', async () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    mount();
    fill();
    const m = BAITLY_CONTACT_MESSAGES.fr;
    fireEvent.click(screen.getByRole('button', { name: m.send }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: m.sending })).toBeDisabled(),
    );
    fireEvent.submit(screen.getByLabelText(m.name).closest('form')!);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
