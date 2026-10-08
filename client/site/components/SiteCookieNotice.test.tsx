import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SiteLanguageProvider, type SiteLanguage } from '../lib/siteLanguage';
import { SITE_COOKIES_MESSAGES } from '../lib/messages/siteCookies';
import { readSiteCookieChoice, saveSiteCookieChoice } from '../lib/siteCookieChoice';
import { STORAGE_KEYS } from '../../src/services/storageService';
import SiteCookieNoticeProvider, { SiteCookieSettingsButton } from './SiteCookieNotice';
import LegalPage from '../pages/legal/LegalPage';

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });

function mount(language: SiteLanguage = 'fr') {
  return render(<MemoryRouter><SiteLanguageProvider initialLanguage={language}>
    <SiteCookieNoticeProvider>
      <main id="site-content" tabIndex={-1}><Routes>
        <Route path="/" element={<a href="#content">Continuer à naviguer</a>} />
        <Route path="/legal/:slug" element={<LegalPage />} />
      </Routes></main>
      <footer><SiteCookieSettingsButton /></footer>
    </SiteCookieNoticeProvider>
  </SiteLanguageProvider></MemoryRouter>);
}

describe('landing cookie notice', () => {
  it.each<SiteLanguage>(['fr', 'en', 'ar'])('shows the static assistant and equal first-level choices (%s)', (language) => {
    mount(language);
    const m = SITE_COOKIES_MESSAGES[language];
    const notice = screen.getByRole('dialog', { name: m.title });
    expect(notice).not.toHaveAttribute('aria-modal', 'true');
    expect(notice).toHaveAttribute('dir', language === 'ar' ? 'rtl' : 'ltr');
    expect(notice.querySelector('img')).toHaveAttribute('src', expect.stringContaining('baitly-assistant.webp'));
    expect(notice.querySelector('video')).toBeNull();
    expect(within(notice).getByRole('button', { name: m.refuse }).parentElement)
      .toBe(within(notice).getByRole('button', { name: m.accept }).parentElement);
    expect(readSiteCookieChoice()).toBeNull();
    expect(document.activeElement).not.toBe(notice);
  });
  it.each(['Accepter', 'Refuser'])('remembers %s across a reload and lets the footer reopen it', async (label) => {
    const view = mount();
    fireEvent.click(screen.getByRole('button', { name: label, exact: true }));
    expect(screen.queryByRole('dialog')).toBeNull();
    view.unmount();
    mount();
    expect(screen.queryByRole('dialog')).toBeNull();
    const trigger = screen.getByRole('button', { name: 'Gérer les cookies' });
    trigger.focus();
    fireEvent.click(trigger);
    await waitFor(() => expect(screen.getByRole('dialog')).toHaveFocus());
    fireEvent(document, new Event('visibilitychange'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Refuser', exact: true }));
    expect(readSiteCookieChoice()?.decision).toBe('refused');
    expect(trigger).toHaveFocus();
  });
  it('does not turn closing, scrolling or navigation into consent', () => {
    mount();
    fireEvent.scroll(window);
    expect(readSiteCookieChoice()).toBeNull();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(readSiteCookieChoice()).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Gérer les cookies' }));
    fireEvent.click(screen.getByRole('link', { name: 'Lire la politique des cookies' }));
    expect(screen.getByRole('heading', { name: '10. Cookies et stockage du navigateur' })).toBeInTheDocument();
    expect(document.getElementById('cookies')).toBeInTheDocument();
    expect(readSiteCookieChoice()).toBeNull();
  });
  it('synchronises a refusal from another tab and asks again when the choice expires', () => {
    vi.useFakeTimers();
    mount();
    const { choice } = saveSiteCookieChoice('refused');
    fireEvent(window, new StorageEvent('storage', { key: STORAGE_KEYS.SITE_COOKIE_CHOICE }));
    expect(screen.queryByRole('dialog')).toBeNull();
    act(() => { vi.advanceTimersByTime(choice.expiresAt - Date.now()); });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(readSiteCookieChoice()).toBeNull();
  });
  it('keeps the page usable when storage is blocked and explains the limitation', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Blocked'); });
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Refuser', exact: true }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('Votre navigateur ne permet pas de mémoriser ce choix');
    expect(screen.getByRole('link', { name: 'Continuer à naviguer' })).toBeInTheDocument();
  });
});
