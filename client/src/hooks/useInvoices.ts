import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invoicesApi } from '../services/api/invoicesApi';
import type { InvoiceFilters } from '../services/api/invoicesApi';

// ─── Query Keys ─────────────────────────────────────────────────────────────

export const invoiceKeys = {
  all: ['invoices'] as const,
  detail: (id: number) => ['invoices', id] as const,
};

// ─── Hooks ──────────────────────────────────────────────────────────────────

export function useInvoices(filters?: InvoiceFilters) {
  return useQuery({
    queryKey: [...invoiceKeys.all, filters] as const,
    queryFn: () => invoicesApi.list(filters),
    staleTime: 60_000,
  });
}

export function useInvoice(id: number) {
  return useQuery({
    queryKey: invoiceKeys.detail(id),
    queryFn: () => invoicesApi.get(id),
    enabled: id > 0,
    staleTime: 60_000,
  });
}

export function useGenerateInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reservationId: number) => invoicesApi.generateFromReservation(reservationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.all });
    },
  });
}

export function useIssueInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => invoicesApi.issue(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.all });
      queryClient.invalidateQueries({ queryKey: invoiceKeys.detail(id) });
    },
  });
}

export function useMarkInvoicePaid() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => invoicesApi.markPaid(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.all });
      queryClient.invalidateQueries({ queryKey: invoiceKeys.detail(id) });
    },
  });
}

export function useCancelInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => invoicesApi.cancel(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.all });
      queryClient.invalidateQueries({ queryKey: invoiceKeys.detail(id) });
    },
  });
}
