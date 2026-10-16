import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { ServiceMapStatus } from '../ServiceMapIndicator';
import { STATUS_TONES } from '../StatusChip';

afterEach(cleanup);

it.each([
  ['PENDING', 'En attente'], ['IN_PROGRESS', 'En cours'],
  ['COMPLETED', 'Terminée'], ['CANCELLED', 'Annulée'], ['UNKNOWN', 'Statut inconnu'],
])('conserve un libellé accessible et une icône pour %s', (status, label) => {
  render(<ServiceMapStatus status={status} label={label} tokens={STATUS_TONES.neutral} />);
  const indicator = screen.getByRole('img', { name: label });
  expect(indicator.tabIndex).toBe(0);
  expect(indicator.querySelector('svg[aria-hidden="true"]')).toBeTruthy();
  expect(indicator.textContent).toBe('');
});

it('explique le statut au focus clavier', async () => {
  render(<ServiceMapStatus status="PENDING" label="En attente" tokens={STATUS_TONES.warn} />);
  fireEvent.focus(screen.getByRole('img', { name: 'En attente' }));
  expect(await screen.findByRole('tooltip')).toHaveTextContent('En attente');
});
