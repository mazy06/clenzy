import apiClient from '../apiClient';

/** Article de stock consommable d'un logement (fiche logement > Inventaire > Stock, M5). */
export interface PropertyStockItem {
  id: number;
  name: string;
  category: 'LINEN' | 'TOILETRIES' | 'CLEANING' | 'CONSUMABLES';
  unit: string | null;
  quantity: number;
  reorderThreshold: number;
  reorderQuantity: number;
  consumptionPerStay: number;
  supplierName: string | null;
  supplierEmail: string | null;
}

export type PropertyStockItemRequest = Omit<PropertyStockItem, 'id'> & { id: number | null };

export const propertyStockApi = {
  list(propertyId: number): Promise<PropertyStockItem[]> {
    return apiClient.get<PropertyStockItem[]>(`/properties/${propertyId}/stock`);
  },
  save(propertyId: number, request: PropertyStockItemRequest): Promise<PropertyStockItem> {
    return apiClient.post<PropertyStockItem>(`/properties/${propertyId}/stock`, request);
  },
  /** Confirme un réassort livré (défaut serveur = quantité de réappro). */
  restock(propertyId: number, id: number, quantity?: number): Promise<PropertyStockItem> {
    return apiClient.post<PropertyStockItem>(
      `/properties/${propertyId}/stock/${id}/restock`,
      quantity != null ? { quantity } : {},
    );
  },
  remove(propertyId: number, id: number): Promise<void> {
    return apiClient.delete<void>(`/properties/${propertyId}/stock/${id}`);
  },
};
