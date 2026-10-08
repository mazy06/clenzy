// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders as render, screen, fireEvent, waitFor } from '../../../test/renderWithProviders';
import { ProviderBeneficiaryModal } from '../components/ProviderBeneficiaryModal';
import { familyOf, opensModal } from '../components/actionRegistry';
import type { PendingAction } from '../types';

const auth = vi.hoisted(() => ({ allowed: true }));
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ hasAnyRole: () => auth.allowed }) }));
const action: PendingAction = {
  id: '3', agentId: 'fin', title: 'Bénéficiaire du versement · mission #11', motif: 'Atelier Exemple',
  reasoning: '', createdAt: '2026-10-08T10:00:00Z', expiresAt: '2026-10-15T10:00:00Z',
  applyActionType: 'PROVIDER_PAYOUT_BENEFICIARY',
};
const preview = { channel: 'Bénéficiaire', recipients: ['Atelier Exemple'], subject: 'Mission #11',
  body: null, bodyRendered: false, facts: ['Le choix sera figé.', 'Le versement reste soumis aux contrôles.'],
  blocked: null, options: [], photos: [] };
const response = (data: unknown) => ({ ok: true, json: async () => data });
beforeEach(() => { auth.allowed = true; vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(preview))); });
afterEach(() => vi.unstubAllGlobals());

describe('Validation du bénéficiaire dans la constellation', () => {
  it('ouvre une revue dédiée et exige la confirmation du bénéficiaire relu sur le serveur', async () => {
    expect(familyOf(action.applyActionType)).toBe('beneficiary');
    expect(opensModal(action.applyActionType)).toBe(true);
    const confirm = vi.fn();
    render(<ProviderBeneficiaryModal action={action} onClose={vi.fn()} onConfirm={confirm} />);
    const button = screen.getByRole('button', { name: 'Désigner cette organisation' });
    expect(button).toBeDisabled();
    const checkbox = await screen.findByRole('checkbox', { name: /Atelier Exemple/ });
    expect(checkbox).not.toBeChecked();
    fireEvent.click(checkbox);
    fireEvent.click(button);
    expect(confirm).toHaveBeenCalledOnce();
    expect(button).toBeDisabled();
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/suggestions/3/preview'), expect.objectContaining({ credentials: 'include' }));
  });
  it('bloque la validation lorsque la situation est devenue obsolète', async () => {
    vi.mocked(fetch).mockResolvedValue(response({ ...preview, blocked: 'Affectation modifiée.' }) as Response);
    render(<ProviderBeneficiaryModal action={action} onClose={vi.fn()} onConfirm={vi.fn()} />);
    expect(await screen.findByText('Affectation modifiée.')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Désigner cette organisation' })).toBeDisabled();
  });
  it('ne propose aucun repli aveugle si la vérification échoue', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('offline'));
    render(<ProviderBeneficiaryModal action={action} onClose={vi.fn()} onConfirm={vi.fn()} />);
    expect(await screen.findByText(/Impossible de vérifier le bénéficiaire/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Désigner cette organisation' })).toBeDisabled();
  });
  it('réserve le choix au staff et ne charge pas les données pour un rôle non autorisé', () => {
    auth.allowed = false;
    render(<ProviderBeneficiaryModal action={action} onClose={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByText(/réservée à un administrateur/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Désigner cette organisation' })).toBeDisabled();
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes('/suggestions/3/preview'))).toBe(false);
  });
  it('rejette un aperçu générique sans bénéficiaire vérifié', async () => {
    vi.mocked(fetch).mockResolvedValue(response({ ...preview, channel: null, recipients: [] }) as Response);
    render(<ProviderBeneficiaryModal action={action} onClose={vi.fn()} onConfirm={vi.fn()} />);
    await waitFor(() => expect(screen.getByText(/Impossible de vérifier le bénéficiaire/)).toBeInTheDocument());
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });
});
