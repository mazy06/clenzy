import { StrictMode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ProviderSignupPage from '../../site/pages/ProviderSignupPage';
import { ApiError, marketplaceApi } from '../../site/lib/marketplaceApi';
import { readUploadToken } from '../../site/lib/uploadToken';

vi.mock('../../site/components/Reveal', () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('../../site/lib/uploadToken', () => ({ readUploadToken: vi.fn(), writeUploadToken: vi.fn(), clearUploadToken: vi.fn() }));
vi.mock('../../site/lib/marketplaceApi', async importOriginal => {
  const actual = await importOriginal<typeof import('../../site/lib/marketplaceApi')>();
  return { ...actual, marketplaceApi: {
    getCategories: vi.fn(), getTermsVersion: vi.fn(), apply: vi.fn(),
    confirmEmail: vi.fn(), getStatus: vi.fn(), uploadDocument: vi.fn(),
  } };
});
beforeEach(() => {
  vi.resetAllMocks();
  window.history.replaceState({}, '', '/prestataires/inscription?lang=en');
  vi.mocked(readUploadToken).mockResolvedValue(null);
  vi.mocked(marketplaceApi.getTermsVersion).mockResolvedValue('2026-09');
  vi.mocked(marketplaceApi.getCategories).mockResolvedValue([{
    id: 1, code: 'CLEANING', labelFr: 'Ménage', labelEn: 'Cleaning', family: 'HOME',
    common: true, sortOrder: 1, items: [],
  }]);
});
afterEach(cleanup);
const mount = () => render(<MemoryRouter><ProviderSignupPage /></MemoryRouter>);
async function completeForm() {
  fireEvent.click(await screen.findByRole('button', { name: 'Cleaning' }));
  fireEvent.click(screen.getByRole('button', { name: 'Add a service' }));
  fireEvent.change(screen.getByLabelText('Service name'), { target: { value: 'Cleaning service' } });
  fireEvent.change(screen.getByLabelText('Pricing model'), { target: { value: 'ON_QUOTE' } });
  for (const [label, value] of [
    ['Display name *', 'Atelier'], ['Contact first name *', 'Sam'],
    ['Contact last name *', 'Test'], ['Email *', 'sam@example.com'],
    ['Business country (2-letter code) *', 'GB'], ['Country (2 letters)', 'GB'],
  ]) fireEvent.change(screen.getByLabelText(label), { target: { value } });
  fireEvent.change(screen.getAllByLabelText('City')[1], { target: { value: 'London' } });
  fireEvent.click(screen.getByRole('checkbox'));
}

describe('Public provider application', () => {
  it('keeps network failures distinct from an expired session and allows retry', async () => {
    vi.mocked(readUploadToken).mockResolvedValue('session');
    vi.mocked(marketplaceApi.getStatus).mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockRejectedValueOnce(new ApiError('Expired', 404));
    mount();
    await screen.findByText('Unable to load your application. Check your connection and try again.');
    expect(screen.queryByText('Application not found.')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await screen.findByRole('heading', { name: 'Offer your services to rental managers' });
    expect(marketplaceApi.getStatus).toHaveBeenCalledTimes(2);
  });

  it('preserves drafts and spoken languages when switching to Arabic', async () => {
    const { container } = mount();
    await completeForm();
    expect(screen.getByRole('button', { name: 'Submit my application' })).toBeEnabled();
    fireEvent.change(screen.getByRole('combobox', { name: 'Language' }), { target: { value: 'ar' } });
    expect(container.querySelector('section')).toHaveAttribute('dir', 'rtl');
    expect(screen.getByLabelText('الاسم المعروض *')).toHaveValue('Atelier');
    expect(screen.getByLabelText('اسم الخدمة')).toHaveValue('Cleaning service');
    expect(screen.getByRole('button', { name: 'الفرنسية' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'العربية' })).toHaveAttribute('aria-pressed', 'false');
    expect(marketplaceApi.getCategories).toHaveBeenCalledTimes(1);
    expect(window.location.search).toBe('?lang=ar');
  });

  it('prevents submission when the terms could not be loaded', async () => {
    vi.mocked(marketplaceApi.getTermsVersion).mockRejectedValue(new Error('offline'));
    mount();
    await completeForm();
    expect(screen.getByRole('alert')).toHaveTextContent('The terms could not be loaded');
    expect(screen.getByRole('button', { name: 'Submit my application' })).toBeDisabled();
    expect(marketplaceApi.apply).not.toHaveBeenCalled();
  });

  it('localizes submission errors and preserves the complete payload', async () => {
    vi.mocked(marketplaceApi.apply).mockRejectedValue(new ApiError('Erreur française', 429));
    mount();
    await completeForm();
    fireEvent.click(screen.getByRole('button', { name: 'Submit my application' }));
    await screen.findByText('Too many attempts. Try again shortly.');
    expect(marketplaceApi.apply).toHaveBeenCalledWith(expect.objectContaining({
      baseCountryCode: 'GB', languages: ['fr'], termsVersion: '2026-09',
      zones: [{ countryCode: 'GB', city: 'London', department: '', primary: true }],
      offers: [expect.objectContaining({ label: 'Cleaning service', pricingModel: 'ON_QUOTE', amount: null, currency: 'EUR' })],
    }));
    expect(screen.queryByText('Erreur française')).toBeNull();
  });

  it('consumes the confirmation link once in StrictMode and scrubs its secret', async () => {
    window.history.replaceState({}, '', '/prestataires/inscription?confirmation=secret&lang=en');
    vi.mocked(marketplaceApi.confirmEmail).mockResolvedValue('Texte serveur français');
    render(<StrictMode><MemoryRouter><ProviderSignupPage /></MemoryRouter></StrictMode>);
    await screen.findByText('If this link is valid, your email address is now confirmed.');
    expect(marketplaceApi.confirmEmail).toHaveBeenCalledExactlyOnceWith('secret');
    expect(window.location.search).toBe('?lang=en');
  });

  it('localizes documents without refetching on language changes', async () => {
    vi.mocked(readUploadToken).mockResolvedValue('session');
    vi.mocked(marketplaceApi.getStatus).mockResolvedValue({
      displayName: 'Atelier', status: 'PENDING', submittedAt: '2026-09-16T12:00:00Z',
      requiredTypes: ['IDENTITY'], documents: [],
    });
    mount();
    await screen.findByText('Your documents');
    fireEvent.change(screen.getByRole('combobox', { name: 'Language' }), { target: { value: 'ar' } });
    await screen.findByText('وثائقك');
    await waitFor(() => expect(marketplaceApi.getStatus).toHaveBeenCalledTimes(1));
    expect(screen.getByLabelText('وثيقة هوية الممثل')).toBeEnabled();
  });
});
