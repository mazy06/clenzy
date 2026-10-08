import { afterEach, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import FinanceStatusIcon from './FinanceStatusIcon';
import FinanceWorkspace from './FinanceWorkspace';
import DocumentStatusIcon from '../../documents/components/DocumentStatusIcon';

afterEach(cleanup);

it.each([
  ['PAID', 'Payée', 'success'], ['OVERDUE', 'En retard', 'destructive'],
  ['PENDING', 'En attente', 'warning'], ['APPROVED', 'Approuvé, aucun versement lancé', 'info'],
  ['PARTIALLY_REFUNDED', 'Partiellement remboursé', 'info'],
] as const)('explique %s au clic avec la même primitive que Documents', async (value, label, tone) => {
  render(<FinanceStatusIcon value={value} label={label} />);
  const button = screen.getByRole('button', { name: label });
  expect(button).toHaveClass('baitly-status-icon');
  expect(button).toHaveAttribute('data-tone', tone);
  expect(button).toHaveTextContent('');
  fireEvent.click(button);
  expect(await screen.findByRole('tooltip')).toHaveTextContent(label);
});

it('utilise le même rendu pour un document et une facture', () => {
  render(<><DocumentStatusIcon value="COMPLETED" label="Document terminé" /><FinanceStatusIcon value="PAID" label="Facture payée" /></>);
  expect(screen.getAllByRole('button').every(button => button.classList.contains('baitly-status-icon'))).toBe(true);
});

it('ouvre uniquement l’explication du statut et garde les boutons de ligne indépendants', async () => {
  render(<FinanceWorkspace items={[{ id: 1, title: 'FA-001', amount: '90 €', fields: [],
    status: <FinanceStatusIcon value="OVERDUE" label="En retard" /> }]} />);
  const list = screen.getByRole('list', { name: 'Dossiers financiers' });
  const row = within(list).getByRole('button', { name: /FA-001/ });
  const status = within(list).getByRole('button', { name: 'En retard' });
  expect(row.contains(status)).toBe(false);
  fireEvent.click(status);
  expect(await screen.findByRole('tooltip')).toHaveTextContent('En retard');
  expect(row).toHaveAttribute('aria-pressed', 'false');
  fireEvent.click(row);
  expect(row).toHaveAttribute('aria-pressed', 'true');
});
