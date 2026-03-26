import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import propertyInventoryApi from '../services/api/propertyInventoryApi';
import type {
  PropertyInventoryItem,
  PropertyLaundryItem,
  LaundryQuote,
  BlanchisserieCatalogItem,
  GenerateLaundryQuoteRequest,
} from '../services/api/propertyInventoryApi';

export const inventoryKeys = {
  items: (propertyId: number) => ['property-inventory', 'items', propertyId] as const,
  laundry: (propertyId: number) => ['property-inventory', 'laundry', propertyId] as const,
  catalog: (propertyId: number) => ['property-inventory', 'catalog', propertyId] as const,
  quotes: (propertyId: number) => ['property-inventory', 'quotes', propertyId] as const,
};

export function usePropertyInventory(propertyId: number) {
  const qc = useQueryClient();

  // ── Queries ────────────────────────────────────────────────────────

  const { data: inventoryItems = [], isLoading: loadingItems } = useQuery<PropertyInventoryItem[]>({
    queryKey: inventoryKeys.items(propertyId),
    queryFn: () => propertyInventoryApi.getItems(propertyId),
    enabled: propertyId > 0,
  });

  const { data: laundryItems = [], isLoading: loadingLaundry } = useQuery<PropertyLaundryItem[]>({
    queryKey: inventoryKeys.laundry(propertyId),
    queryFn: () => propertyInventoryApi.getLaundryItems(propertyId),
    enabled: propertyId > 0,
  });

  const { data: catalog = [], isLoading: loadingCatalog } = useQuery<BlanchisserieCatalogItem[]>({
    queryKey: inventoryKeys.catalog(propertyId),
    queryFn: () => propertyInventoryApi.getCatalog(propertyId),
    enabled: propertyId > 0,
    staleTime: 5 * 60 * 1000,
  });

  const { data: quotes = [], isLoading: loadingQuotes } = useQuery<LaundryQuote[]>({
    queryKey: inventoryKeys.quotes(propertyId),
    queryFn: () => propertyInventoryApi.getQuotes(propertyId),
    enabled: propertyId > 0,
  });

  // ── Mutations ──────────────────────────────────────────────────────

  const addItemMutation = useMutation({
    mutationFn: (data: Partial<PropertyInventoryItem>) => propertyInventoryApi.addItem(propertyId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: inventoryKeys.items(propertyId) }),
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ id, ...data }: Partial<PropertyInventoryItem> & { id: number }) =>
      propertyInventoryApi.updateItem(propertyId, id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: inventoryKeys.items(propertyId) }),
  });

  const deleteItemMutation = useMutation({
    mutationFn: (itemId: number) => propertyInventoryApi.deleteItem(propertyId, itemId),
    onSuccess: () => qc.invalidateQueries({ queryKey: inventoryKeys.items(propertyId) }),
  });

  const addLaundryMutation = useMutation({
    mutationFn: (data: Partial<PropertyLaundryItem>) => propertyInventoryApi.addLaundryItem(propertyId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: inventoryKeys.laundry(propertyId) }),
  });

  const updateLaundryMutation = useMutation({
    mutationFn: ({ id, ...data }: Partial<PropertyLaundryItem> & { id: number }) =>
      propertyInventoryApi.updateLaundryItem(propertyId, id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: inventoryKeys.laundry(propertyId) }),
  });

  const deleteLaundryMutation = useMutation({
    mutationFn: (itemId: number) => propertyInventoryApi.deleteLaundryItem(propertyId, itemId),
    onSuccess: () => qc.invalidateQueries({ queryKey: inventoryKeys.laundry(propertyId) }),
  });

  const generateQuoteMutation = useMutation({
    mutationFn: (data: GenerateLaundryQuoteRequest) => propertyInventoryApi.generateQuote(propertyId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: inventoryKeys.quotes(propertyId) }),
  });

  const confirmQuoteMutation = useMutation({
    mutationFn: (quoteId: number) => propertyInventoryApi.confirmQuote(propertyId, quoteId),
    onSuccess: () => qc.invalidateQueries({ queryKey: inventoryKeys.quotes(propertyId) }),
  });

  return {
    inventoryItems,
    laundryItems,
    catalog,
    quotes,
    isLoading: loadingItems || loadingLaundry || loadingCatalog || loadingQuotes,

    addItem: addItemMutation.mutateAsync,
    updateItem: updateItemMutation.mutateAsync,
    deleteItem: deleteItemMutation.mutateAsync,
    addLaundryItem: addLaundryMutation.mutateAsync,
    updateLaundryItem: updateLaundryMutation.mutateAsync,
    deleteLaundryItem: deleteLaundryMutation.mutateAsync,
    generateQuote: generateQuoteMutation.mutateAsync,
    confirmQuote: confirmQuoteMutation.mutateAsync,
  };
}
