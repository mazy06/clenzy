import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import MyCoverageZoneCard from './MyCoverageZoneCard';
const mocks = vi.hoisted(() => ({ getMine: vi.fn(), replace: vi.fn(), success: vi.fn() }));
vi.mock('../../services/api/myCoverageZonesApi', () => ({ myCoverageZonesApi: mocks }));
vi.mock('../../hooks/useNotification', () => ({ useNotification: () => ({ notify: { success: mocks.success } }) }));
vi.mock('../../hooks/useTranslation', () => {
  const t = (key: string, fallback: string) => fallback || key;
  return { useTranslation: () => ({ t }) };
});
vi.mock('./ProviderPropertyTypes', () => ({ default: () => null }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it('does not allow an empty replacement after failing to load the saved zones', async () => {
  mocks.getMine.mockRejectedValue(new Error('network'));
  render(<MyCoverageZoneCard />);
  await screen.findByText('Impossible de charger votre zone.');
  expect(screen.queryByRole('button', { name: 'Enregistrer ma zone' })).not.toBeInTheDocument();
  expect(mocks.replace).not.toHaveBeenCalled();
});
it('does not silently drop an unfinished row when saving', async () => {
  mocks.getMine.mockResolvedValue([{ id: 1, country: 'JP', city: 'Kyoto', department: null, arrondissement: null }]);
  render(<MyCoverageZoneCard />);
  await screen.findByDisplayValue('Kyoto');
  fireEvent.click(screen.getByRole('button', { name: 'Ajouter un secteur' }));
  fireEvent.click(screen.getByRole('button', { name: 'Enregistrer ma zone' }));
  await screen.findByText('Complétez chaque secteur ou retirez les lignes inutiles.');
  expect(mocks.replace).not.toHaveBeenCalled();
  expect(screen.getByDisplayValue('Kyoto')).toBeInTheDocument();
});
it('saves a country outside the original whitelist without changing the declared city', async () => {
  const zone = { id: 1, country: 'JP', city: 'Kyoto', department: null, arrondissement: null };
  mocks.getMine.mockResolvedValue([zone]); mocks.replace.mockResolvedValue([zone]);
  render(<MyCoverageZoneCard />);
  await screen.findByDisplayValue('Kyoto');
  fireEvent.click(screen.getByRole('button', { name: 'Enregistrer ma zone' }));
  await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith([{ country: 'JP', city: 'Kyoto', department: null, arrondissement: null }]));
});

