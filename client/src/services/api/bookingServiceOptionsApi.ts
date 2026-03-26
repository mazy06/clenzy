import apiClient from '../apiClient';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BookingServiceCategory {
  id: number;
  organizationId: number;
  name: string;
  description: string | null;
  sortOrder: number;
  active: boolean;
  items: BookingServiceItem[];
}

export interface BookingServiceItem {
  id: number;
  categoryId: number;
  name: string;
  description: string | null;
  price: number;
  pricingMode: 'PER_BOOKING' | 'PER_PERSON' | 'PER_NIGHT';
  inputType: 'QUANTITY' | 'CHECKBOX';
  maxQuantity: number | null;
  mandatory: boolean;
  sortOrder: number;
  active: boolean;
}

export interface SelectedServiceOption {
  serviceItemId: number;
  quantity: number;
}

// ─── Payloads ────────────────────────────────────────────────────────────────

export type CreateCategoryPayload = Pick<BookingServiceCategory, 'name' | 'description' | 'active'>;
export type UpdateCategoryPayload = CreateCategoryPayload;

export type CreateItemPayload = Pick<
  BookingServiceItem,
  'name' | 'description' | 'price' | 'pricingMode' | 'inputType' | 'maxQuantity' | 'mandatory' | 'active'
>;
export type UpdateItemPayload = CreateItemPayload;

// ─── API ─────────────────────────────────────────────────────────────────────

export const bookingServiceOptionsApi = {
  // ─── Admin CRUD (categories) ─────────────────────────────────────
  getCategories: () =>
    apiClient.get<BookingServiceCategory[]>('/booking-engine/service-options/categories'),

  createCategory: (data: CreateCategoryPayload) =>
    apiClient.post<BookingServiceCategory>('/booking-engine/service-options/categories', data),

  updateCategory: (id: number, data: UpdateCategoryPayload) =>
    apiClient.put<BookingServiceCategory>(`/booking-engine/service-options/categories/${id}`, data),

  deleteCategory: (id: number) =>
    apiClient.delete(`/booking-engine/service-options/categories/${id}`),

  reorderCategories: (orderedIds: number[]) =>
    apiClient.put('/booking-engine/service-options/categories/reorder', orderedIds),

  // ─── Admin CRUD (items) ──────────────────────────────────────────
  createItem: (categoryId: number, data: CreateItemPayload) =>
    apiClient.post<BookingServiceItem>(`/booking-engine/service-options/categories/${categoryId}/items`, data),

  updateItem: (id: number, data: UpdateItemPayload) =>
    apiClient.put<BookingServiceItem>(`/booking-engine/service-options/items/${id}`, data),

  deleteItem: (id: number) =>
    apiClient.delete(`/booking-engine/service-options/items/${id}`),

  // ─── Public ──────────────────────────────────────────────────────
  getPublicServiceOptions: (slug: string) =>
    apiClient.get<BookingServiceCategory[]>(`/public/booking/${slug}/service-options`),
};
