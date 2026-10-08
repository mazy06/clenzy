import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FinanceBatchPanel, type FinanceBatchItem } from './FinanceBatchPanel';
import { PageHeaderActionsProvider, usePageHeaderActionsSlot } from '../../components/PageHeaderActionsContext';
import { useState } from 'react';

afterEach(cleanup);
const items: FinanceBatchItem[] = [{ key: '1', label: 'Ménage', amount: 20, currency: 'EUR' }, { key: '2', label: 'Maintenance', amount: 30, currency: 'EUR' }];
describe('Actions financières groupées', () => {
  it('réunit approbation et versement dans un seul bouton du header sans transmettre la sélection', async () => {
    const approve = vi.fn();
    const transfer = vi.fn().mockResolvedValue([{ key: '1', state: 'sent' }]);
    function Page() {
      const { slot, portalContainer } = usePageHeaderActionsSlot();
      const [approved, setApproved] = useState(false);
      return <PageHeaderActionsProvider slot={slot}><header data-testid="header">{portalContainer}</header>
        <main data-testid="body"><FinanceBatchPanel placement="header" title="Reversements groupés" operations={[
          { key: 'approve', label: 'À approuver', actionLabel: 'Approuver les montants', items: approved ? [] : [items[0]],
            onExecute: async selected => { approve(selected); setApproved(true); return [{ key: '1', state: 'approved' }]; } },
          { key: 'transfer', label: 'À verser', actionLabel: 'Lancer les reversements', items: approved ? [items[0]] : [], onExecute: transfer },
        ]} /></main>
      </PageHeaderActionsProvider>;
    }
    render(<Page />);
    const header = within(screen.getByTestId('header'));
    expect(header.getAllByRole('button')).toHaveLength(1);
    expect(within(screen.getByTestId('body')).queryByRole('button')).not.toBeInTheDocument();
    fireEvent.click(header.getByRole('button', { name: 'Reversements groupés' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Reversements groupés' }));
    fireEvent.click(dialog.getByRole('checkbox', { name: 'Sélectionner Ménage' }));
    fireEvent.click(dialog.getByRole('button', { name: 'Approuver les montants' }));
    expect(await dialog.findByText('Approuvé, aucun versement déclenché')).toBeVisible();
    expect(approve).toHaveBeenCalledExactlyOnceWith([items[0]]);
    expect(transfer).not.toHaveBeenCalled();
    fireEvent.click(dialog.getByRole('button', { name: /À verser/ }));
    expect(dialog.getByRole('checkbox', { name: 'Sélectionner Ménage' })).not.toBeChecked();
    expect(dialog.getByRole('button', { name: 'Lancer les reversements' })).toBeDisabled();
    fireEvent.click(dialog.getByRole('checkbox', { name: 'Sélectionner Ménage' }));
    fireEvent.click(dialog.getByRole('button', { name: 'Lancer les reversements' }));
    await waitFor(() => expect(transfer).toHaveBeenCalledExactlyOnceWith([items[0]]));
  });

  it('verrouille le changement d’étape pendant le traitement du lot', async () => {
    let finish!: (value: []) => void;
    const execute = vi.fn(() => new Promise<[]>(resolve => { finish = resolve; }));
    render(<FinanceBatchPanel title="Reversements groupés" operations={[
      { key: 'approve', label: 'À approuver', actionLabel: 'Approuver les montants', items, onExecute: execute },
      { key: 'transfer', label: 'À verser', actionLabel: 'Lancer les reversements', items, onExecute: vi.fn() },
    ]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Reversements groupés' }));
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Sélectionner Ménage' }));
    fireEvent.click(screen.getByRole('button', { name: 'Approuver les montants' }));
    expect(screen.getByRole('button', { name: /À verser/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Fermer' })).toBeDisabled();
    finish([]);
    await waitFor(() => expect(screen.getByRole('button', { name: /À verser/ })).toBeEnabled());
  });

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
