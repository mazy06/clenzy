import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  bookingServiceOptionsApi,
  type CreateCategoryPayload,
  type UpdateCategoryPayload,
  type CreateItemPayload,
  type UpdateItemPayload,
} from '../services/api/bookingServiceOptionsApi';

// ─── Query Keys ─────────────────────────────────────────────────────────────

export const serviceOptionsKeys = {
  all: ['service-options'] as const,
  categories: ['service-options', 'categories'] as const,
};

// ─── Hooks ──────────────────────────────────────────────────────────────────

/** Fetch all service categories with their items. */
export function useServiceCategories() {
  return useQuery({
    queryKey: serviceOptionsKeys.categories,
    queryFn: () => bookingServiceOptionsApi.getCategories(),
    staleTime: 60_000,
    retry: 1,
    retryDelay: 1_000,
  });
}

/** Create a new service category. */
export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateCategoryPayload) => bookingServiceOptionsApi.createCategory(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: serviceOptionsKeys.categories }); },
  });
}

/** Update an existing service category. */
export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateCategoryPayload }) =>
      bookingServiceOptionsApi.updateCategory(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: serviceOptionsKeys.categories }); },
  });
}

/** Delete a service category. */
export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => bookingServiceOptionsApi.deleteCategory(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: serviceOptionsKeys.categories }); },
  });
}

/** Create a new service item within a category. */
export function useCreateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ categoryId, data }: { categoryId: number; data: CreateItemPayload }) =>
      bookingServiceOptionsApi.createItem(categoryId, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: serviceOptionsKeys.categories }); },
  });
}

/** Update an existing service item. */
export function useUpdateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateItemPayload }) =>
      bookingServiceOptionsApi.updateItem(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: serviceOptionsKeys.categories }); },
  });
}

/** Delete a service item. */
export function useDeleteItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => bookingServiceOptionsApi.deleteItem(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: serviceOptionsKeys.categories }); },
  });
}
