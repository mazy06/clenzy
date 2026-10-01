import apiClient from '../apiClient';

export type ConsumablesView = 'pending' | 'ordered' | 'stock';
export interface ConsumableRow {
  id: string;
  stockItemId: number | null;
  propertyId: number;
  propertyName: string;
  name: string;
  catalogKey: string | null;
  photoUrl: string | null;
  unit: string | null;
  quantity: number | null;
  threshold: number | null;
  supplierName: string | null;
  createdAt: string | null;
  orderedAt: string | null;
  lastRestockedAt: string | null;
  description: string | null;
  actionable: boolean;
}
export interface ConsumablesOverview {
  rows: ConsumableRow[];
  totalElements: number;
  page: number;
  size: number;
  counts: Record<ConsumablesView, number>;
}

export const consumablesApi = {
  properties(): Promise<{ id: number; name: string }[]> {
    return apiClient.get('/consumables/properties');
  },
  list(view: ConsumablesView, propertyId: string, search: string, page: number): Promise<ConsumablesOverview> {
    const params = new URLSearchParams({ view, search, page: String(page), size: '20' });
    if (propertyId !== 'all') params.set('propertyId', propertyId);
    return apiClient.get(`/consumables?${params}`);
  },
};
