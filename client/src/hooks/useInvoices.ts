import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invoicesApi } from '../services/api/invoicesApi';
import type { InvoiceFilters } from '../services/api/invoicesApi';
import { trackEvent } from '../providers/PostHogProvider';
import { useTranslation } from './useTranslation';
import { useCommerceScope } from './useCommerceScope';

// ─── Query Keys ─────────────────────────────────────────────────────────────

export const invoiceKeys = {
  all: ['invoices'] as const,
  detail: (id: number) => ['invoices', id] as const,
};

// ─── Hooks ──────────────────────────────────────────────────────────────────

export function useInvoices(filters?: InvoiceFilters) {
  const scope = useCommerceScope();
  return useQuery({
    queryKey: [...invoiceKeys.all, scope, filters] as const,
    enabled: !!scope,
    queryFn: () => invoicesApi.list(filters),
    staleTime: 60_000,
  });
}

export function useIssueInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => invoicesApi.issue(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.all });
      queryClient.invalidateQueries({ queryKey: invoiceKeys.detail(id) });
      trackEvent.invoiceIssued({ invoiceId: id });
    },
  });
}

export function usePayInvoice() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (id: number) => {
      const result = await invoicesApi.initiatePayment(id);
      const url = result.paymentResult?.redirectUrl;
      if (!result.paymentResult?.success || !url || !/^https:\/\//i.test(url)) {
        throw new Error(result.paymentResult?.errorMessage || t('supervision.invoiceModal.payError', 'Lien de paiement non généré.'));
      }
      return url;
    },
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

export function useTemplateStatus() {
  const scope = useCommerceScope();
  return useQuery({
    queryKey: ['invoices', 'template-status', scope] as const,
    enabled: !!scope,
    queryFn: () => invoicesApi.checkTemplateStatus(),
    staleTime: 5 * 60_000,
  });
}

export function useDuplicateInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => invoicesApi.generateDuplicate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.all });
      trackEvent.invoiceGenerated({ type: 'duplicate' });
    },
  });
}
