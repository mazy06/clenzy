import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ServiceItemSelect from '../ServiceItemSelect';
import apiClient from '../../services/apiClient';

vi.mock('../../services/apiClient', () => ({ default: { get: vi.fn() } }));
afterEach(cleanup);

it('permet de sélectionner une prestation au clavier dans la configuration des équipes', async () => {
  const cleaning = { code: 'CLEANING', labelFr: 'Ménage entre séjours', labelEn: 'Turnover cleaning', legacyType: 'CLEANING' };
  vi.mocked(apiClient.get).mockResolvedValue([cleaning]);
  const select = vi.fn();
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <ServiceItemSelect onChange={select} />
  </QueryClientProvider>);
  const input = await screen.findByRole('combobox');
  input.focus();
  fireEvent.keyDown(input, { key: 'ArrowDown' });
  expect(await screen.findByRole('option', { name: cleaning.labelFr })).toBeVisible();
  fireEvent.keyDown(input, { key: 'Enter' });
  await waitFor(() => expect(select).toHaveBeenCalledWith(cleaning));
  expect(input).toHaveFocus();
});
