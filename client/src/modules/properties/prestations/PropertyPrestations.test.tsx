import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import PropertyPrestations from './PropertyPrestations';
import { interventionsApi } from '../../../services/api/interventionsApi';
import { serviceRequestsApi } from '../../../services/api/serviceRequestsApi';
import { addDays, isoDay, startOfDay } from './prestationTimeline';

vi.mock('../../../services/api/interventionsApi', () => ({ interventionsApi: { getPage: vi.fn() } }));
vi.mock('../../../services/api/serviceRequestsApi', () => ({ serviceRequestsApi: { getAll: vi.fn() } }));

afterEach(cleanup);

// Midi : la date reste le même jour quel que soit le fuseau du poste.
const noon = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12).toISOString();

function mount(onDayAssignee = vi.fn(), range?: { from?: string; to?: string }) {
  const today = startOfDay(new Date());
  vi.mocked(interventionsApi.getPage).mockResolvedValue({ content: [
    { id: 1, title: 'Ménage du jour', scheduledDate: noon(today), status: 'PENDING', assignedToName: 'Jean', assignedToType: 'user', assignedToId: 42 },
    { id: 2, title: 'Ménage plus tard', scheduledDate: noon(addDays(today, 3)), status: 'PENDING', assignedToName: 'Jean' },
  ] } as never);
  vi.mocked(serviceRequestsApi.getAll).mockResolvedValue([] as never);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(<MemoryRouter><QueryClientProvider client={client}><PropertyPrestations propertyId={7} onDayAssignee={onDayAssignee} range={range} /></QueryClientProvider></MemoryRouter>);
  return { onDayAssignee, view };
}

describe('PropertyPrestations', () => {
  it('reprend la période de la carte et exclut les prestations hors période dans la fiche', async () => {
    const today = startOfDay(new Date());
    mount(vi.fn(), { from: isoDay(addDays(today, 1)), to: isoDay(addDays(today, 4)) });
    await waitFor(() => expect(screen.queryByText('Chargement des prestations…')).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Dans la période' }));
    expect(await screen.findByText('Ménage plus tard')).toBeTruthy();
    expect(screen.queryByText('Ménage du jour')).toBeNull();
  });
  it("affiche d'abord les prestations du jour, puis toutes les prochaines sur « À venir »", async () => {
    mount();
    expect(await screen.findByText('Ménage du jour')).toBeTruthy();
    expect(screen.queryByText('Ménage plus tard')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /venir/i }));
    expect(await screen.findByText('Ménage plus tard')).toBeTruthy();
    expect(screen.getByText('Ménage du jour')).toBeTruthy();
  });

  it('signale l’intervenant du jour affiché, l’efface sur « À venir » et à la fermeture', async () => {
    const { onDayAssignee, view } = mount();
    await screen.findByText('Ménage du jour');
    await waitFor(() => expect(onDayAssignee).toHaveBeenLastCalledWith(42)); // aujourd'hui, sans clic
    const today = screen.getAllByRole('button', { pressed: true }).find((b) => b.getAttribute('aria-label')?.includes(','))!;
    fireEvent.click(today); // désélectionne le jour → « À venir »
    expect(onDayAssignee).toHaveBeenLastCalledWith(null);
    fireEvent.click(today); // re-sélectionne aujourd'hui
    expect(onDayAssignee).toHaveBeenLastCalledWith(42);
    view.unmount();
    expect(onDayAssignee).toHaveBeenLastCalledWith(null);
  });
});
