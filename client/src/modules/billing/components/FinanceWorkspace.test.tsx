import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import FinanceWorkspace, { type FinanceRecord } from './FinanceWorkspace';

afterEach(cleanup);
describe('Finance list and detail', () => {
  it('preserves a current selection across responsive pagination without retaining a stale record', () => {
    const selected: FinanceRecord = { id: 1, title: 'Mission sélectionnée', amount: '55 €', fields: [] };
    const view = render(<FinanceWorkspace items={[]} selectedId={1} selectedRecord={selected} />);
    expect(screen.getByRole('heading', { name: 'Mission sélectionnée' })).toBeVisible();
    view.rerender(<FinanceWorkspace items={[]} selectedId={1} selectedRecord={{ ...selected, amount: '45 €' }} />);
    expect(screen.getByText('45 €')).toBeVisible();
    view.rerender(<FinanceWorkspace items={[]} selectedId={1} />);
    expect(screen.queryByRole('heading', { name: 'Mission sélectionnée' })).not.toBeInTheDocument();
  });
  it('keeps actions in the selected detail and updates financial data after a refresh', () => {
    const pay = vi.fn();
    const row: FinanceRecord = { id: 1, title: 'Ménage de départ', amount: '45,00 €', status: 'En attente',
      fields: [{ label: 'Logement', value: 'Maison Atlas' }], actions: <button onClick={pay}>Régler</button> };
    const view = render(<FinanceWorkspace items={[row]} />);
    expect(screen.queryByRole('button', { name: 'Régler' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Ménage de départ/ }));
    expect(pay).not.toHaveBeenCalled();
    const detail = screen.getByRole('region', { name: 'Détails' });
    expect(within(detail).getByText('Maison Atlas')).toBeVisible();
    expect(within(detail).getByRole('button', { name: 'Régler' })).toBeVisible();
    view.rerender(<FinanceWorkspace items={[{ ...row, amount: '40,00 €', status: 'Payé', actions: null }]} />);
    expect(within(detail).getByText('40,00 €')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Régler' })).not.toBeInTheDocument();
    view.rerender(<FinanceWorkspace items={[]} />);
    expect(within(detail).queryByText('Maison Atlas')).not.toBeInTheDocument();
  });
});
