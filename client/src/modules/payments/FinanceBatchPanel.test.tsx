import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FinanceBatchPanel, type FinanceBatchItem } from './FinanceBatchPanel';
import { PageHeaderActionsProvider, usePageHeaderActionsSlot } from '../../components/PageHeaderActionsContext';

afterEach(cleanup);
const items: FinanceBatchItem[] = [{ key: '1', label: 'Ménage', amount: 20, currency: 'EUR' }, { key: '2', label: 'Maintenance', amount: 30, currency: 'EUR' }];
describe('Actions financières groupées', () => {
  it('places both actions in the page header while retaining the selection modal', async () => {
    const execute = vi.fn();
    function Page() {
      const { slot, portalContainer } = usePageHeaderActionsSlot();
      return <PageHeaderActionsProvider slot={slot}><header data-testid="header">{portalContainer}</header>
        <main data-testid="body"><FinanceBatchPanel placement="header" items={items} title="Lot" actionLabel="Confirmer le lot" onExecute={execute} /></main>
      </PageHeaderActionsProvider>;
    }
    render(<Page />);
    const header = within(screen.getByTestId('header'));
    expect(header.getByRole('button', { name: 'Sélectionner tous les dossiers éligibles du filtre' })).toBeVisible();
    expect(within(screen.getByTestId('body')).queryByRole('button')).not.toBeInTheDocument();
    fireEvent.click(header.getByRole('button', { name: 'Choisir plusieurs lignes' }));
    expect(await screen.findByRole('dialog', { name: 'Lot' })).toBeVisible();
    expect(execute).not.toHaveBeenCalled();
  });
  it('charge toutes les pages puis attend la confirmation avant exécution', async () => {
    const all = [...items, { key: '3', label: 'Autre page', amount: 40, currency: 'MAD' }];
    const execute = vi.fn().mockResolvedValue(all.map(item => ({ key: item.key, state: 'approved' })));
    const loadAll = vi.fn().mockResolvedValue(all);
    render(<FinanceBatchPanel items={items} title="Lot" actionLabel="Confirmer le lot" loadAll={loadAll} onExecute={execute} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sélectionner tous les dossiers éligibles du filtre' }));
    expect(await screen.findByText('Autre page')).toBeVisible();
    expect(execute).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer le lot' }));
    await waitFor(() => expect(execute).toHaveBeenCalledWith(all));
    expect(await screen.findAllByText('Approuvé, aucun versement déclenché')).toHaveLength(3);
  });
  it('respecte la sélection et bloque un double clic pendant l’exécution', async () => {
    let finish!: (value: []) => void;
    const execute = vi.fn(() => new Promise<[]>(resolve => { finish = resolve; }));
    render(<FinanceBatchPanel items={items} title="Lot" actionLabel="Confirmer le lot" onExecute={execute} />);
    fireEvent.click(screen.getByRole('button', { name: 'Choisir plusieurs lignes' }));
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Sélectionner Maintenance' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer le lot' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer le lot' }));
    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledWith([items[1]]);
    finish([]);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Confirmer le lot' })).toBeDisabled());
  });
});
