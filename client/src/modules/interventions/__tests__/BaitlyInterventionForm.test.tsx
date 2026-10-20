import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import InterventionForm from '../InterventionForm';
import { interventionsApi } from '../../../services/api/interventionsApi';

const auth = vi.hoisted(() => ({
  user: { id: 'admin', email: 'admin@example.test' },
  hasPermissionAsync: vi.fn().mockResolvedValue(true),
  isAdmin: vi.fn(() => true), isManager: vi.fn(() => false), isHost: vi.fn(() => false),
}));
const viewport = vi.hoisted(() => ({ mobile: false }));
vi.mock('../../../hooks/use-media-query', () => ({ useMediaQuery: () => viewport.mobile }));
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => auth }));
vi.mock('../../../providers/PostHogProvider', () => ({ trackEvent: { interventionScheduled: vi.fn() } }));
vi.mock('../../../components/PageHeader', () => ({ default: ({ title, actions }: { title: string; actions: React.ReactNode }) => <header>{title}{actions}</header> }));
vi.mock('../../../services/api/interventionsApi', () => ({ interventionsApi: { getById: vi.fn(), update: vi.fn() } }));
vi.mock('../../../services/api/propertiesApi', () => ({ propertiesApi: { getAll: vi.fn().mockResolvedValue([
  { id: 1, name: 'Logement de test', address: 'Adresse de test', city: 'Paris' },
]) } }));
vi.mock('../../../services/api/usersApi', () => ({ usersApi: { getAll: vi.fn().mockResolvedValue([
  { id: 3, firstName: 'Jean', lastName: 'Martin', email: 'jean@example.test', role: 'HOUSEKEEPER' },
  { id: 2, firstName: 'Propriétaire', lastName: 'Test', email: 'owner@example.test', role: 'HOST' },
]) } }));
vi.mock('../../../services/api/teamsApi', () => ({ teamsApi: { getAll: vi.fn().mockResolvedValue([]) } }));

beforeEach(() => {
  viewport.mobile = false;
  vi.clearAllMocks();
  auth.user.email = 'admin@example.test';
  auth.isAdmin.mockReturnValue(true);
  auth.isManager.mockReturnValue(false);
  auth.isHost.mockReturnValue(false);
  vi.mocked(interventionsApi.getById).mockResolvedValue({
    id: 332, title: 'Ménage de test', description: 'Mission de simulation', type: 'CLEANING',
    serviceItemCode: 'cleaning-turnover', status: 'PENDING', priority: 'NORMAL',
    propertyId: 1, requestorId: 2, assignedToId: 3, assignedToType: 'user',
    scheduledDate: '2026-10-19T13:00:00', estimatedDurationHours: 3,
    estimatedCost: 35, progressPercentage: 0,
  } as Awaited<ReturnType<typeof interventionsApi.getById>>);
  vi.mocked(interventionsApi.update).mockResolvedValue({} as Awaited<ReturnType<typeof interventionsApi.update>>);
});
afterEach(cleanup);

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return { client, ...render(<MemoryRouter><QueryClientProvider client={client}>
    <InterventionForm interventionId={332} mode="edit" onSuccess={vi.fn()} />
  </QueryClientProvider></MemoryRouter>) };
}

describe('Replanification Baitly', () => {
  it.each([false, true])('affiche et conserve le demandeur absent de la liste des utilisateurs (mobile : %s)', async (mobile) => {
    viewport.mobile = mobile;
    const mission = await interventionsApi.getById(332);
    vi.mocked(interventionsApi.getById).mockResolvedValue({ ...mission, requestorId: 99, requestorName: 'Admin User' });
    mount();
    const requestor = await screen.findByRole('combobox', { name: 'Demandeur', exact: true });
    await waitFor(() => expect(requestor).toHaveValue('99'));
    expect(screen.getByRole('option', { name: 'Admin User', exact: true })).toBeInTheDocument();
    if (mobile) fireEvent.click(screen.getByRole('button', { name: 'Coûts', exact: true }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Enregistrer' })[0]);
    await waitFor(() => expect(interventionsApi.update).toHaveBeenCalledWith(332, expect.objectContaining({ requestorId: 99 })));
  });

  it.each(['HOST', 'HOUSEKEEPER'])('conserve le demandeur enregistré pour une modification par %s', async (role) => {
    auth.user.email = 'jean@example.test';
    auth.isAdmin.mockReturnValue(false);
    auth.isHost.mockReturnValue(role === 'HOST');
    const { container } = mount();
    await screen.findByDisplayValue('Ménage de test');
    expect(screen.getByRole('combobox', { name: 'Demandeur', exact: true })).toHaveValue('2');
    fireEvent.click(screen.getAllByRole('button', { name: 'Enregistrer' })[0]);
    await waitFor(() => expect(interventionsApi.update).toHaveBeenCalledWith(332, expect.objectContaining({ requestorId: 2 })));
    expect(container.querySelector('#intervention-requestor')).toBeDisabled();
  });

  it('transmet une seule modification si la validation mobile est déclenchée deux fois', async () => {
    viewport.mobile = true;
    let finish!: (value: Awaited<ReturnType<typeof interventionsApi.update>>) => void;
    vi.mocked(interventionsApi.update).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const { container } = mount();
    await screen.findByRole('combobox', { name: 'Propriété', exact: true });
    fireEvent.click(screen.getByRole('button', { name: 'Coûts', exact: true }));
    await act(async () => {
      fireEvent.submit(container.querySelector('#intervention-form')!);
      fireEvent.submit(container.querySelector('#intervention-form')!);
    });
    await waitFor(() => expect(interventionsApi.update).toHaveBeenCalledTimes(1));
    await act(async () => finish({} as Awaited<ReturnType<typeof interventionsApi.update>>));
  });
  it('conserve la saisie entre les étapes mobiles et revient au champ invalide', async () => {
    viewport.mobile = true;
    mount();
    await screen.findByRole('combobox', { name: 'Propriété', exact: true });
    fireEvent.click(screen.getByRole('button', { name: 'Les prestations', exact: true }));
    await screen.findByDisplayValue('Ménage de test');
    fireEvent.change(screen.getByLabelText('Titre'), { target: { value: 'Ménage mobile conservé' } });
    fireEvent.click(screen.getByRole('button', { name: 'Quand et comment ?', exact: true }));
    expect(screen.queryByLabelText('Titre')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Les prestations', exact: true }));
    expect(screen.getByLabelText('Titre')).toHaveValue('Ménage mobile conservé');
    fireEvent.change(screen.getByLabelText('Titre'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Coûts', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer', exact: true }));
    await waitFor(() => expect(screen.getByLabelText('Titre')).toHaveAttribute('aria-invalid', 'true'));
    expect(interventionsApi.update).not.toHaveBeenCalled();
  });
  it('conserve l’heure locale et transmet la nouvelle date sans changer le prix ni le prestataire', async () => {
    const { container } = mount();
    await screen.findByDisplayValue('Ménage de test');
    const date = container.querySelector<HTMLInputElement>('#intervention-scheduled-date')!;
    const time = container.querySelector<HTMLInputElement>('#intervention-scheduled-time')!;
    const assignee = container.querySelector<HTMLSelectElement>('#intervention-assigned-user')!;
    expect(time.value).toBe(`${String(new Date('2026-10-19T13:00:00Z').getHours()).padStart(2, '0')}:00`);
    expect(assignee.value).toBe('3');
    expect(assignee.selectedOptions[0]).toHaveTextContent('Jean Martin');
    fireEvent.change(date, { target: { value: '2026-10-06' } });
    fireEvent.change(time, { target: { value: '05:00' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Enregistrer' })[0]);
    await waitFor(() => expect(interventionsApi.update).toHaveBeenCalledWith(332, expect.objectContaining({
      scheduledDate: new Date('2026-10-06T05:00').toISOString().slice(0, 19),
      assignedToId: 3, assignedToType: 'user', estimatedCost: 35,
    })));
  });

  it('affiche le motif métier quand le nouveau créneau est refusé', async () => {
    vi.mocked(interventionsApi.update).mockRejectedValue({ status: 409, message: 'Le prestataire est indisponible sur ce créneau.' });
    mount();
    await screen.findByDisplayValue('Ménage de test');
    fireEvent.click(screen.getAllByRole('button', { name: 'Enregistrer' })[0]);
    expect(await screen.findByText('Le prestataire est indisponible sur ce créneau.')).toBeVisible();
    expect(interventionsApi.update).toHaveBeenCalledWith(332, expect.objectContaining({
      scheduledDate: '2026-10-19T13:00:00',
    }));
  });

  it('ne perd pas la date en cours de saisie lors du rafraîchissement de la mission', async () => {
    const { container, client } = mount();
    await screen.findByDisplayValue('Ménage de test');
    const date = container.querySelector<HTMLInputElement>('#intervention-scheduled-date')!;
    fireEvent.change(date, { target: { value: '2026-10-06' } });
    await act(async () => {
      client.setQueryData(['intervention-form-data', 'intervention', 332], (previous: object) => ({
        ...previous, description: 'Description rafraîchie par le serveur',
      }));
    });
    expect(date.value).toBe('2026-10-06');
  });
});
