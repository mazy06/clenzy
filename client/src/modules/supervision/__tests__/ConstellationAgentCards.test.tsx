import { describe, expect, it, vi } from 'vitest';
import { fireEvent, renderWithProviders as render, screen, within } from '../../../test/renderWithProviders';
import { ConstellationAgentCards } from '../components/ConstellationAgentCards';
import type { ConstellationAgentView } from '../renderers/ConstellationRenderer';

const agents: ConstellationAgentView[] = [
  { id: 'com', status: 'veille', autonomy: 'suggest', task: null },
  { id: 'ops', status: 'wait', autonomy: 'suggest', task: null, pendingCount: 3 },
  { id: 'cmp', status: 'veille', autonomy: 'suggest', task: null },
];

function setup(items = agents) {
  const onSelect = vi.fn();
  const onAutonomyChange = vi.fn();
  const view = render(<ConstellationAgentCards agents={items} feed={[]} selected="ops" onSelect={onSelect} onAutonomyChange={onAutonomyChange} />);
  return { ...view, onSelect, onAutonomyChange };
}

describe('Liste des agents Baitly', () => {
  it('propose des boutons de sélection accessibles, avec les décisions en premier', () => {
    const { onSelect } = setup();
    const rows = screen.getAllByRole('listitem');
    const operations = within(rows[0]).getByRole('button', { name: /Opérations.*3 à valider/ });
    expect(operations).toHaveAttribute('aria-pressed', 'true');
    const communication = screen.getByRole('button', { name: /Communication Messages voyageurs/ });
    expect(communication).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(communication);
    expect(onSelect).toHaveBeenCalledWith('com');
  });

  it('changer le mode ne sélectionne pas la file et respecte les plafonds', () => {
    const { onSelect, onAutonomyChange } = setup();
    const mode = screen.getByRole('combobox', { name: 'Autonomie : Communication' });
    expect(within(mode).getAllByRole('option').map(option => option.getAttribute('value'))).toEqual(['suggest', 'notify']);
    fireEvent.change(mode, { target: { value: 'notify' } });
    expect(onAutonomyChange).toHaveBeenCalledWith('com', 'notify');
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.queryByRole('combobox', { name: /Conformité/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Validation requise' })).toBeVisible();
  });

  it('conserve le consentement explicite avant la pleine autonomie', () => {
    const { onAutonomyChange, onSelect } = setup();
    fireEvent.change(screen.getByRole('combobox', { name: 'Autonomie : Opérations' }), { target: { value: 'full' } });
    const dialog = screen.getByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: 'Activer la pleine autonomie' });
    expect(confirm).toBeDisabled();
    expect(onAutonomyChange).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('checkbox'));
    fireEvent.click(confirm);
    expect(onAutonomyChange).toHaveBeenCalledWith('ops', 'full');
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('annuler la pleine autonomie ne modifie aucun réglage', () => {
    const { onAutonomyChange } = setup();
    fireEvent.change(screen.getByRole('combobox', { name: 'Autonomie : Opérations' }), { target: { value: 'full' } });
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onAutonomyChange).not.toHaveBeenCalled();
  });

  it('ne masque pas une erreur derrière le compteur de décisions', () => {
    setup([{ ...agents[1], status: 'err', task: 'Échec de synchronisation' }]);
    const row = screen.getByRole('listitem');
    expect(within(row).getByText('3')).toBeVisible();
    expect(row.querySelector('.baitly-agent-list-status')).toHaveTextContent('Erreur');
  });
});
