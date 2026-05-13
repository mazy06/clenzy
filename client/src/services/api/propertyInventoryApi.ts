import apiClient from '../apiClient';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PropertyInventoryItem {
  id: number;
  propertyId: number;
  name: string;
  category: string | null;
  quantity: number;
  notes: string | null;
  /** Photo facultative (data URL base64 ou URL distante) */
  photoUrl: string | null;
}

export interface PropertyLaundryItem {
  id: number;
  propertyId: number;
  itemKey: string;
  label: string;
  quantityPerStay: number;
}

export interface BlanchisserieCatalogItem {
  key: string;
  label: string;
  price: number;
  enabled: boolean;
}

export interface LaundryQuoteLine {
  key: string;
  label: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface LaundryQuote {
  id: number;
  propertyId: number;
  reservationId: number | null;
  status: 'DRAFT' | 'CONFIRMED' | 'INVOICED';
  lines: LaundryQuoteLine[];
  totalHt: number;
  currency: string;
  generatedAt: string;
  confirmedAt: string | null;
  notes: string | null;
}

export interface GenerateLaundryQuoteRequest {
  reservationId?: number | null;
  notes?: string | null;
}

// ─── API ─────────────────────────────────────────────────────────────────────

const propertyInventoryApi = {
  // Inventory items
  getItems(propertyId: number): Promise<PropertyInventoryItem[]> {
    return apiClient.get<PropertyInventoryItem[]>(`/properties/${propertyId}/inventory/items`);
  },
  addItem(propertyId: number, data: Partial<PropertyInventoryItem>): Promise<PropertyInventoryItem> {
    return apiClient.post<PropertyInventoryItem>(`/properties/${propertyId}/inventory/items`, data);
  },
  updateItem(propertyId: number, itemId: number, data: Partial<PropertyInventoryItem>): Promise<PropertyInventoryItem> {
    return apiClient.put<PropertyInventoryItem>(`/properties/${propertyId}/inventory/items/${itemId}`, data);
  },
  deleteItem(propertyId: number, itemId: number): Promise<void> {
    return apiClient.delete(`/properties/${propertyId}/inventory/items/${itemId}`);
  },

  // Laundry items
  getLaundryItems(propertyId: number): Promise<PropertyLaundryItem[]> {
    return apiClient.get<PropertyLaundryItem[]>(`/properties/${propertyId}/inventory/laundry`);
  },
  addLaundryItem(propertyId: number, data: Partial<PropertyLaundryItem>): Promise<PropertyLaundryItem> {
    return apiClient.post<PropertyLaundryItem>(`/properties/${propertyId}/inventory/laundry`, data);
  },
  updateLaundryItem(propertyId: number, itemId: number, data: Partial<PropertyLaundryItem>): Promise<PropertyLaundryItem> {
    return apiClient.put<PropertyLaundryItem>(`/properties/${propertyId}/inventory/laundry/${itemId}`, data);
  },
  deleteLaundryItem(propertyId: number, itemId: number): Promise<void> {
    return apiClient.delete(`/properties/${propertyId}/inventory/laundry/${itemId}`);
  },

  // Blanchisserie catalog
  getCatalog(propertyId: number): Promise<BlanchisserieCatalogItem[]> {
    return apiClient.get<BlanchisserieCatalogItem[]>(`/properties/${propertyId}/inventory/laundry/catalog`);
  },

  // Quotes
  getQuotes(propertyId: number): Promise<LaundryQuote[]> {
    return apiClient.get<LaundryQuote[]>(`/properties/${propertyId}/inventory/laundry/quotes`);
  },
  generateQuote(propertyId: number, data: GenerateLaundryQuoteRequest): Promise<LaundryQuote> {
    return apiClient.post<LaundryQuote>(`/properties/${propertyId}/inventory/laundry/quotes`, data);
  },
  confirmQuote(propertyId: number, quoteId: number): Promise<LaundryQuote> {
    return apiClient.put<LaundryQuote>(`/properties/${propertyId}/inventory/laundry/quotes/${quoteId}/confirm`, {});
  },
};

export default propertyInventoryApi;
