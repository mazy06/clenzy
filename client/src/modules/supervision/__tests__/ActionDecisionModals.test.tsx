// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders as render, screen, fireEvent, waitFor, act } from '../../../test/renderWithProviders';
import { ActionConfirmModal } from '../components/ActionConfirmModal';
import { ActionChoiceModal } from '../components/ActionChoiceModal';
import { ActionParamsModal } from '../components/ActionParamsModal';
import { ActionReviewModal } from '../components/ActionReviewModal';
import { PriceAdjustmentModal } from '../components/PriceAdjustmentModal';
import { pricingApi } from '../pricingApi';
import type { PendingAction } from '../types';

vi.mock('../pricingApi', () => ({ pricingApi: { simulate: vi.fn(), applyCustom: vi.fn() } }));
const noop = () => {};
const action = (applyActionType: string, extra: Partial<PendingAction> = {}): PendingAction => ({
  id: 'decision-test', agentId: 'ops', title: 'Une décision à prendre', motif: 'Contexte de la proposition.',
  reasoning: '', createdAt: '2026-09-30T10:00:00Z', expiresAt: '2026-10-03T10:00:00Z', applyActionType, ...extra,
});
const preview = (extra = {}) => ({ channel: 'Email', recipients: ['guest@example.test'], subject: 'Votre séjour',
  body: 'Bonjour, votre séjour commence demain.', bodyRendered: true, facts: [], blocked: null, options: [], photos: [], ...extra });
const response = (data: unknown) => ({ ok: true, json: async () => data });
beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());

describe('Décisions HITL', () => {
  it('conserve la saisie délibérée avant une suppression irréversible', () => {
    const onConfirm = vi.fn();
    render(<ActionConfirmModal action={action('GDPR_ERASE', { agentId: 'cmp' })} onClose={noop} onConfirm={onConfirm} />);
    const submit = screen.getByRole('button', { name: 'Effacer définitivement' });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText('CONFIRMER'), { target: { value: 'oui' } });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText('CONFIRMER'), { target: { value: 'CONFIRMER' } });
    fireEvent.click(submit);
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(submit).toBeDisabled();
  });

  it('permet de choisir un autre devis que celui proposé', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(preview({ options: [
      { paramName: 'quoteId', value: 12, label: 'Atelier A', detail: '320 € · Disponible le 2026-10-04', recommended: true },
      { paramName: 'quoteId', value: 24, label: 'Atelier B', detail: '280 € · Disponible le 2026-10-06', recommended: false },
    ] }))));
    const onConfirm = vi.fn();
    render(<ActionChoiceModal action={action('QUOTE_APPROVAL')} onClose={noop} onConfirm={onConfirm} />);
    const first = await screen.findByRole('radio', { name: /Atelier A/ });
    expect(first).toBeChecked();
    fireEvent.click(screen.getByRole('radio', { name: /Atelier B/ }));
    expect(first).not.toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Retenir ce devis' }));
    expect(onConfirm).toHaveBeenCalledWith({ quoteId: 24 });
  });

  it('garde le blocage du serveur malgré une option présélectionnée', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(preview({ blocked: 'Ce devis a expiré.', options: [
      { paramName: 'quoteId', value: 12, label: 'Atelier A', detail: null, recommended: true },
    ] }))));
    render(<ActionChoiceModal action={action('QUOTE_APPROVAL')} onClose={noop} onConfirm={noop} />);
    await screen.findByText('Ce devis a expiré.');
    expect(screen.getByRole('button', { name: 'Retenir ce devis' })).toBeDisabled();
  });

  it('ne transforme pas un champ numérique vide en zéro et conserve les bornes', () => {
    render(<ActionParamsModal action={action('CALENDAR_BLOCK')} onClose={noop} onConfirm={noop} />);
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '' } });
    expect(screen.getByRole('button', { name: 'Bloquer' })).toBeDisabled();
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '31' } });
    expect(screen.getByRole('button', { name: 'Bloquer' })).toBeDisabled();
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '7' } });
    expect(screen.getByRole('button', { name: 'Bloquer' })).toBeEnabled();
  });

  it('ne réaffiche pas une simulation arrivée après une nouvelle saisie', async () => {
    let resolve!: (v: unknown) => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise((r) => { resolve = r; })));
    render(<ActionParamsModal action={action('CALENDAR_BLOCK')} onClose={noop} onConfirm={noop} />);
    fireEvent.click(screen.getByRole('button', { name: 'Simuler' }));
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '3' } });
    await act(async () => resolve(response({ facts: ['Ancienne période de 7 nuits'] })));
    expect(screen.queryByText(/Ancienne période/)).toBeNull();
  });

  it('affiche le texte du message sans interpréter son HTML et conserve les refus', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(preview({ body: '<img src=x onerror=alert(1)>', blocked: 'Adresse invalide.' }))));
    render(<ActionReviewModal action={action('GUIDE_SEND', { agentId: 'com' })} onClose={noop} onConfirm={noop} />);
    await screen.findByText('<img src=x onerror=alert(1)>');
    expect(document.querySelector('.baitly-action-message img')).toBeNull();
    expect(screen.getByText('Adresse invalide.')).toBeTruthy();
    expect(document.querySelector('[data-slot="dialog-footer"] [data-variant="default"]')).toBeDisabled();
  });
});

describe('Prévision tarifaire', () => {
  const params = JSON.stringify({ segments: [{ from: '2026-10-05', to: '2026-10-07', percent: 15 }] });
  beforeEach(() => {
    vi.mocked(pricingApi.simulate).mockResolvedValue({
      segments: [{ from: '2026-10-05', to: '2026-10-07', pctChange: -15, simulationDays: 2,
        baseline: { adr: 100, occupancyRate: .4, nights: 2, revenue: 80 },
        scenario: { adr: 85, occupancyRate: .6, nights: 2, revenue: 102 }, deltaRevenue: 22, deltaOccupancy: .2, recommendation: '' }],
      totalBaselineRevenue: 80, totalScenarioRevenue: 102, totalDeltaRevenue: 22,
    });
  });
  it('retire la prévision obsolète après modification de l’ajustement', async () => {
    render(<PriceAdjustmentModal suggestionId="qa" propertyId={1} actionParams={params} onClose={noop} onApplied={noop} />);
    await screen.findByText('Prévision cumulée');
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '20' } });
    expect(screen.queryByText('Prévision cumulée')).toBeNull();
    expect(screen.getByText(/Relancez la simulation/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Simuler' }));
    await screen.findByText('Prévision cumulée');
    expect(pricingApi.simulate).toHaveBeenLastCalledWith(1, [{ from: '2026-10-05', to: '2026-10-07', percent: 20 }], 'down');
  });
  it('empêche d’appliquer un créneau inversé ou une liste vide', async () => {
    render(<PriceAdjustmentModal suggestionId="qa" propertyId={1} actionParams={params} onClose={noop} onApplied={noop} />);
    await waitFor(() => expect(pricingApi.simulate).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText('Fin (exclue)'), { target: { value: '2026-10-01' } });
    expect(screen.getByRole('button', { name: 'Appliquer les tarifs' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Retirer ce créneau' }));
    expect(screen.getByRole('button', { name: 'Appliquer les tarifs' })).toBeDisabled();
    expect(pricingApi.applyCustom).not.toHaveBeenCalled();
  });
});
