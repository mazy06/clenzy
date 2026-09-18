import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ProviderActivationPage from '../../site/pages/ProviderActivationPage';
import { ApiError, marketplaceApi } from '../../site/lib/marketplaceApi';

vi.mock('../../site/components/Reveal', () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('../../site/lib/marketplaceApi', async importOriginal => {
  const actual = await importOriginal<typeof import('../../site/lib/marketplaceApi')>();
  return { ...actual, marketplaceApi: { getActivationTarget: vi.fn(), activate: vi.fn() } };
});
beforeEach(() => {
  vi.resetAllMocks();
  window.history.replaceState({}, '', '/prestataires/activation?token=secret&lang=en');
  vi.mocked(marketplaceApi.getActivationTarget).mockResolvedValue('Atelier Baitly');
  vi.mocked(marketplaceApi.activate).mockResolvedValue('Message serveur français');
});
afterEach(cleanup);

describe('Public provider activation', () => {
  it('survives StrictMode while removing the secret and preserving the language', async () => {
    render(<StrictMode><ProviderActivationPage /></StrictMode>);
    await screen.findByText('Atelier Baitly');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(window.location.search).toBe('?lang=en');
    expect(marketplaceApi.getActivationTarget).toHaveBeenCalledWith('secret');
  });

  it('switches to Arabic without losing the password draft or restoring the secret', async () => {
    const { container } = render(<ProviderActivationPage />);
    await screen.findByText('Atelier Baitly');
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'StrongPass123' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Language' }), { target: { value: 'ar' } });
    expect(container.querySelector('section')).toHaveAttribute('dir', 'rtl');
    expect(screen.getByLabelText('كلمة المرور')).toHaveValue('StrongPass123');
    expect(window.location.search).toBe('?lang=ar');
    expect(marketplaceApi.getActivationTarget).toHaveBeenCalledTimes(1);
  });

  it('validates confirmation and shows localized success without retaining password fields', async () => {
    render(<ProviderActivationPage />);
    await screen.findByText('Atelier Baitly');
    const submit = screen.getByRole('button', { name: 'Activate my account' });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'StrongPass123' } });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'StrongPass123' } });
    fireEvent.click(submit);
    await screen.findByText('Your account is ready');
    expect(marketplaceApi.activate).toHaveBeenCalledExactlyOnceWith('secret', 'StrongPass123');
    expect(screen.queryByText('Message serveur français')).toBeNull();
    expect(screen.queryByLabelText('Password')).toBeNull();
  });

  it('explains rate limiting in the selected language', async () => {
    vi.mocked(marketplaceApi.getActivationTarget).mockRejectedValue(new ApiError('Limite atteinte', 429));
    render(<ProviderActivationPage />);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Too many attempts'));
    expect(marketplaceApi.activate).not.toHaveBeenCalled();
  });

  it('locks submission and password fields until activation finishes', async () => {
    let finish!: (message: string) => void;
    vi.mocked(marketplaceApi.activate).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    render(<ProviderActivationPage />);
    await screen.findByText('Atelier Baitly');
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'StrongPass123' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'StrongPass123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Activate my account' }));
    const pending = await screen.findByRole('button', { name: 'Activating…' });
    expect(pending).toBeDisabled();
    expect(screen.getByLabelText('Password')).toBeDisabled();
    expect(screen.getByLabelText('Confirm password')).toBeDisabled();
    fireEvent.click(pending);
    expect(marketplaceApi.activate).toHaveBeenCalledTimes(1);
    finish('OK');
    await screen.findByText('Your account is ready');
  });

  it('does not query the server when the token is missing', async () => {
    window.history.replaceState({}, '', '/prestataires/activation?lang=fr');
    render(<ProviderActivationPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Lien incomplet');
    expect(marketplaceApi.getActivationTarget).not.toHaveBeenCalled();
  });
});
