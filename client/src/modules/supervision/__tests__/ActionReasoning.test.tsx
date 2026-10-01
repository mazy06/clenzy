// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { renderWithProviders as render, screen, fireEvent } from '../../../test/renderWithProviders';
import { ConstellationQueue } from '../components/ConstellationQueue';
import { PendingActionCard } from '../components/PendingActionCard';
import type { PendingAction } from '../types';

const motif = 'Arrivée prévue le 2026-09-27, aucun signe de vie depuis. Marquer no-show libère les nuits restantes.';
const action = (overrides: Partial<PendingAction> = {}): PendingAction => ({
  id: 'reasoning-demo',
  agentId: 'sync',
  title: 'No-show possible',
  motif,
  reasoning: motif,
  createdAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
  ...overrides,
});

const noop = () => {};
const visibleSummary = () => screen.getAllByText((_, element) =>
  element?.classList.contains('baitly-description-narrative') === true
  && element.textContent?.replace(/\s/g, '') === motif.replace(/\s/g, ''));
const surfaces = [
  { name: 'constellation', view: (item: PendingAction) => <ConstellationQueue agent="sync" actions={[item]} onValidate={noop} onEdit={noop} /> },
  { name: 'carte compacte', view: (item: PendingAction) => <PendingActionCard action={item} onValidate={noop} onEdit={noop} /> },
];

describe.each(surfaces)('Explication HITL : $name', ({ view }) => {
  it('affiche le résumé une seule fois sans proposer un volet identique', () => {
    render(view(action()));
    expect(visibleSummary()).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Pourquoi ?' })).toBeNull();
  });

  it('ignore les seules différences d’espaces et de retours à la ligne', () => {
    render(view(action({ reasoning: `\n${motif.replace(/ /g, '\u00a0  ')}\n` })));
    expect(screen.queryByRole('button', { name: 'Pourquoi ?' })).toBeNull();
    expect(visibleSummary()).toHaveLength(1);
  });

  it('conserve une explication complémentaire et la retire si une mise à jour la duplique', () => {
    const reasoning = 'La déclaration sur le canal d’origine reste à effectuer sous 48 h.';
    const { rerender } = render(view(action({ reasoning })));
    fireEvent.click(screen.getByRole('button', { name: 'Pourquoi ?' }));
    expect(screen.getByText(reasoning)).toBeVisible();

    rerender(view(action()));
    expect(screen.queryByRole('button', { name: 'Pourquoi ?' })).toBeNull();
    expect(screen.queryByText(reasoning)).toBeNull();
    expect(visibleSummary()).toHaveLength(1);
  });

  it('ne propose aucun volet pour une explication vide', () => {
    render(view(action({ reasoning: ' \n\t ' })));
    expect(screen.queryByRole('button', { name: 'Pourquoi ?' })).toBeNull();
  });

  it('conserve les explications du paiement, dont le résumé n’est pas affiché', () => {
    render(view(action({ kind: 'payment', motif: '', reasoning: '' })));
    fireEvent.click(screen.getByRole('button', { name: 'Pourquoi ?' }));
    expect(screen.getByText(/Stripe/)).toBeVisible();
  });
});
