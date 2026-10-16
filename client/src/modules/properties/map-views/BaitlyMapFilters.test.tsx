import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import BaitlyMapFilters from './BaitlyMapFilters';
import { DEFAULT_MAP_CONTEXT } from './baitlyMapContext';

afterEach(cleanup);
it('regroupe les dates et les filtres dans un panneau ouvert par un bouton de carte', async () => {
  const change = vi.fn();
  const clear = vi.fn();
  const reset = vi.fn();
  render(<BaitlyMapFilters context={{ ...DEFAULT_MAP_CONTEXT, period: 'custom' }} onChange={change} hasArea onClearArea={clear} onReset={reset} />);
  expect(screen.queryByLabelText('Date de début')).toBeNull();
  const trigger = screen.getByRole('button', { name: 'Filtres de la carte' });
  expect(trigger.className).toContain('baitly-map-tool');
  expect(trigger.getAttribute('data-active')).toBe('true');
  fireEvent.click(trigger);
  const from = await screen.findByLabelText('Date de début');
  expect(screen.getByRole('dialog').textContent).toContain('Choisissez une période valide');
  fireEvent.change(from, { target: { value: '2026-10-16' } });
  expect(change).toHaveBeenLastCalledWith({ from: '2026-10-16' });
  fireEvent.click(screen.getByRole('button', { name: 'Effacer la zone' }));
  expect(clear).toHaveBeenCalledOnce();
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  fireEvent.click(screen.getByRole('button', { name: 'Réinitialiser la carte' }));
  expect(reset).toHaveBeenCalledOnce();
});
