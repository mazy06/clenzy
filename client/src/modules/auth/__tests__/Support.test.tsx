import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import i18n from '../../../i18n/config';
import { renderWithProviders } from '../../../test/renderWithProviders';
import apiClient from '../../../services/apiClient';
import Support from '../Support';

vi.mock('../../../services/apiClient', () => ({ default: { post: vi.fn() } }));
vi.mock('../../../hooks/useGeoAuthLanguage', () => ({
  useGeoAuthLanguage: () => ({ language: 'fr', chooseLanguage: () => {} }),
}));
vi.mock('../../../hooks/use-media-query', () => ({ useMediaQuery: () => false }));

beforeEach(async () => {
  vi.clearAllMocks();
  await i18n.changeLanguage('fr');
});
afterEach(cleanup);

function fillRequest() {
  fireEvent.change(screen.getByLabelText('Nom complet'), { target: { value: 'Nadia Amrani' } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'nadia@example.com' } });
  fireEvent.change(screen.getByLabelText('Sujet'), { target: { value: 'technical' } });
  fireEvent.change(screen.getByLabelText('Votre message'), { target: { value: 'Le calendrier ne se charge pas.' } });
}

describe('Support Baitly', () => {
  it('présente une aide statique et confirme uniquement un envoi réussi', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({});
    renderWithProviders(<Support />);
    expect(screen.queryByLabelText('Explorer les fonctionnalités', { selector: 'select' })).toBeNull();
    fillRequest();
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer ma demande' }));
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Votre message a été envoyé' })).toBeTruthy());
    expect(apiClient.post).toHaveBeenCalledWith('/public/support', {
      name: 'Nadia Amrani', email: 'nadia@example.com', phone: '',
      subject: 'technical', message: 'Le calendrier ne se charge pas.',
    }, { skipAuth: true });
    expect(screen.getByText('nadia@example.com')).toBeTruthy();
  });

  it('conserve la demande pour permettre de réessayer après un échec', async () => {
    vi.mocked(apiClient.post).mockRejectedValueOnce(new Error('unavailable'));
    renderWithProviders(<Support />);
    fillRequest();
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer ma demande' }));
    await waitFor(() => expect(screen.getByText(/Nous n’avons pas pu envoyer/)).toBeTruthy());
    expect((screen.getByLabelText('Votre message') as HTMLTextAreaElement).value).toBe('Le calendrier ne se charge pas.');
    expect(screen.queryByRole('heading', { name: 'Votre message a été envoyé' })).toBeNull();
    expect((screen.getByRole('button', { name: 'Envoyer ma demande' }) as HTMLButtonElement).disabled).toBe(false);
  });
});
