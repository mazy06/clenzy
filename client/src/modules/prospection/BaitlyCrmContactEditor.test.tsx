import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import fr from '../../../public/locales/fr.json';
import { prospectsApi } from '../../services/api/prospectsApi';
import BaitlyCrmContactEditor from './BaitlyCrmContactEditor';
vi.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key.split('.').reduce((node: unknown, part: string) =>
    node && typeof node === 'object' ? (node as Record<string,unknown>)[part] : undefined, fr) ?? key }),
}));
afterEach(() => vi.restoreAllMocks());
describe('Baitly CRM contact editor', () => {
  it('requires provenance and creates an owner without any contact authorization', async () => {
    const create = vi.spyOn(prospectsApi,'create').mockResolvedValue({ id: 1 } as never);
    const authorize = vi.spyOn(prospectsApi,'authorize');
    const done=vi.fn();
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
      <BaitlyCrmContactEditor onDone={done} />
    </QueryClientProvider>);
    fireEvent.change(screen.getByLabelText('Nom'),{ target: { value: 'Samira' } });
    fireEvent.change(screen.getByLabelText('Email'),{ target: { value: 'samira@example.com' } });
    const source=screen.getByLabelText('Origine et contexte de la collecte');
    expect(source).toBeRequired();
    fireEvent.change(source,{ target: { value: 'Demande reçue au salon local' } });
    fireEvent.click(screen.getByRole('button',{ name: 'Enregistrer' }));
    await waitFor(() => expect(create).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Samira', contactType: 'OWNER', contactNature: 'UNKNOWN',
      sourceDetail: 'Demande reçue au salon local', sourceType: 'MANUAL',
    })));
    await waitFor(() => expect(done).toHaveBeenCalled());
    expect(authorize).not.toHaveBeenCalled();
  });
  it('keeps a rejected save open with an accessible error', async () => {
    vi.spyOn(prospectsApi,'create').mockRejectedValue({ message: 'Contact déjà présent' });
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
      <BaitlyCrmContactEditor onDone={vi.fn()} />
    </QueryClientProvider>);
    fireEvent.change(screen.getByLabelText('Nom'),{ target: { value: 'Samira' } });
    fireEvent.change(screen.getByLabelText('Origine et contexte de la collecte'),{ target: { value: 'Recommandation' } });
    fireEvent.click(screen.getByRole('button',{ name: 'Enregistrer' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Contact déjà présent'));
  });
});
