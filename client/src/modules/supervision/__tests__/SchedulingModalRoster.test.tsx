// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders as render, screen, fireEvent, waitFor } from '../../../test/renderWithProviders';
import { SchedulingModal } from '../components/SchedulingModal';
import type { PendingAction } from '../types';

/**
 * Qui peut recevoir une mission.
 *
 * <p>La liste des métiers était recopiée dans cette modale, et elle était
 * fausse : un `manager` inexistant, pas de blanchisserie ni de tech. extérieur.
 * Ces deux métiers n'apparaissaient donc nulle part — non pas grisés, mais
 * absents, sans rien pour le signaler.</p>
 */

const ROSTER = [
  { id: 1, firstName: 'Karim', lastName: 'Belhaj', role: 'TECHNICIAN', email: 'k@x.fr' },
  { id: 2, firstName: 'Sonia', lastName: 'Traoré', role: 'HOUSEKEEPER', email: 's@x.fr' },
  { id: 3, firstName: 'Louis', lastName: 'Ferrand', role: 'EXTERIOR_TECH', email: 'l@x.fr' },
  { id: 4, firstName: 'Nadia', lastName: 'Kessler', role: 'LAUNDRY', email: 'n@x.fr' },
  { id: 5, firstName: 'Paul', lastName: 'Dumont', role: 'HOST', email: 'p@x.fr' },
  { id: 9, firstName: 'Awa', lastName: 'Ndiaye', role: 'SUPER_MANAGER', email: 'a@x.fr' },
];

/** L'utilisateur connecté : ici Paul, hôte du logement. */
vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'kc-5', databaseId: 5 } }),
}));

vi.mock('../../../services/api/usersApi', () => ({
  usersApi: { getAll: vi.fn(() => Promise.resolve(ROSTER)) },
}));

const action = (): PendingAction => ({
  id: 'pa-3',
  agentId: 'ops',
  title: 'Remplacer la batterie de la serrure',
  motif: 'Batterie faible',
  reasoning: '',
  createdAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 4 * 3_600_000).toISOString(),
  applyActionType: 'LOCK_BATTERY_REPLACE',
});

const noop = () => {};
const open = () => render(<SchedulingModal action={action()} onClose={noop} onConfirm={noop} />);

beforeEach(() => vi.clearAllMocks());

describe('<SchedulingModal> — les intervenants', () => {
  it('propose les cinq métiers de terrain, blanchisserie et tech. extérieur compris', async () => {
    open();

    await waitFor(() => expect(screen.getByText('Karim Belhaj')).toBeTruthy());
    expect(screen.getByText('Louis Ferrand')).toBeTruthy();
    expect(screen.getByText('Nadia Kessler')).toBeTruthy();
    expect(screen.getByText('Sonia Traoré')).toBeTruthy();
  });

  it('écarte ceux qui n’interviennent pas sur le terrain des métiers', async () => {
    open();

    await waitFor(() => screen.getByText('Karim Belhaj'));
    // Un hôte n'est pas un métier : il n'apparaît pas parmi les intervenants,
    // mais il a désormais sa propre section (voir plus bas).
    const groups = screen.getAllByRole('group').map((g) => g.textContent ?? '');
    const metiers = groups.filter((g) => g.includes('Karim Belhaj')).join('');
    expect(metiers).not.toContain('Paul Dumont');
  });

  it('propose la conciergerie pour ce que n’importe qui peut faire', async () => {
    // Changer la pile d'une serrure ne demande pas un technicien : attendre
    // un métier pour cinq minutes de travail fait traîner la mission.
    open();

    await waitFor(() => screen.getByText('Karim Belhaj'));
    expect(screen.getByText('Conciergerie')).toBeTruthy();
    expect(screen.getByText('Awa Ndiaye')).toBeTruthy();
  });

  it('propose « Moi-même » plutôt que son propre nom', async () => {
    open();

    await waitFor(() => screen.getByText('Karim Belhaj'));
    // On ne cherche pas son propre nom dans une liste : c'est le choix le plus
    // fréquent des trois, il se désigne, il ne se cherche pas.
    expect(screen.getByText('Moi-même')).toBeTruthy();
    expect(screen.queryByText('Paul Dumont')).toBeNull();
  });

  it('assigne bien l’utilisateur connecté quand on choisit « Moi-même »', async () => {
    const onConfirm = vi.fn();
    render(<SchedulingModal action={action()} onClose={noop} onConfirm={onConfirm} />);

    await waitFor(() => screen.getByText('Moi-même'));
    fireEvent.click(screen.getByText('Moi-même'));
    fireEvent.click(screen.getByRole('button', { name: /Planifier/ }));

    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ assigneeId: 5 }));
  });

  it('met les métiers de travaux devant, sans écarter les autres', async () => {
    open();

    await waitFor(() => screen.getByText('Karim Belhaj'));
    expect(screen.getByText('Métier correspondant')).toBeTruthy();
    expect(screen.getByText('Autres intervenants')).toBeTruthy();
  });

  it('la frappe réduit la liste', async () => {
    open();

    await waitFor(() => screen.getByText('Karim Belhaj'));
    fireEvent.change(screen.getByPlaceholderText('Rechercher un intervenant…'), {
      target: { value: 'Nadia' },
    });

    await waitFor(() => expect(screen.queryByText('Karim Belhaj')).toBeNull());
    expect(screen.getByText('Nadia Kessler')).toBeTruthy();
  });

  it('se raviser est un geste explicite, pas un second clic à deviner', async () => {
    open();

    await waitFor(() => screen.getByText('Karim Belhaj'));
    expect(screen.queryByText('Laisser sans intervenant')).toBeNull();

    fireEvent.click(screen.getByText('Karim Belhaj'));
    fireEvent.click(screen.getByText('Laisser sans intervenant'));

    expect(screen.queryByText('Laisser sans intervenant')).toBeNull();
  });
});
