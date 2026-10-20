import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useWatch } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';
import { usePropertyForm } from './usePropertyForm';
import { propertiesApi } from '../services/api/propertiesApi';
import type { PropertyFormValues } from '../schemas';

vi.mock('../services/api/propertiesApi', () => ({ propertiesApi: { getById: vi.fn(), update: vi.fn(), create: vi.fn() } }));
vi.mock('../services/api/usersApi', () => ({ usersApi: { getAll: vi.fn(async () => []) } }));
vi.mock('./usePropertyDetails', () => ({ propertyDetailsKeys: { all: ['property-details'] } }));
vi.mock('./usePropertiesList', () => ({ propertiesListKeys: { all: ['properties-list'] } }));

describe('caution du logement', () => {
  it('transmet le montant par bien et conserve la réponse serveur lors de la réouverture immédiate', async () => {
    const original = { id: 76, name: 'Logement de test', ownerId: 2, securityDepositAmount: 0, defaultCurrency: 'EUR' };
    const saved = { ...original, securityDepositAmount: 350.5 };
    vi.mocked(propertiesApi.getById).mockResolvedValue(original as never);
    vi.mocked(propertiesApi.update).mockResolvedValue(saved as never);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const useEditor = () => {
      const form = usePropertyForm({ propertyId: 76, isEditMode: true });
      return { form, amount: useWatch({ control: form.control, name: 'securityDepositAmount' }) };
    };
    const first = renderHook(useEditor, { wrapper });
    await waitFor(() => expect(first.result.current.form.isLoadingProperty).toBe(false));
    act(() => first.result.current.form.submitForm({ name: original.name, ownerId: 2, securityDepositAmount: 350.5 } as PropertyFormValues));
    await waitFor(() => expect(first.result.current.form.isSuccess).toBe(true));
    expect(propertiesApi.update).toHaveBeenCalledWith(76, expect.objectContaining({ ownerId: 2, securityDepositAmount: 350.5 }));
    first.unmount();
    const reopened = renderHook(useEditor, { wrapper });
    await waitFor(() => expect(reopened.result.current.amount).toBe(350.5));
    expect(propertiesApi.getById).toHaveBeenCalledTimes(1);
    reopened.unmount(); client.clear();
  });
});
