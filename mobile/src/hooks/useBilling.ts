import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { billingApi, type RefundRequest } from '@/api/endpoints/billingApi';

const KEYS = {
  all: ['billing'] as const,
  paymentHistory: (params?: Record<string, string>) => [...KEYS.all, 'payment-history', params] as const,
  paymentSummary: () => [...KEYS.all, 'payment-summary'] as const,
  invoices: (params?: Record<string, string>) => [...KEYS.all, 'invoices', params] as const,
};

export function useBillingPaymentHistory(params?: Record<string, string>) {
  return useQuery({
    queryKey: KEYS.paymentHistory(params),
    queryFn: () => billingApi.getPaymentHistory(params),
  });
}

export function useBillingPaymentSummary() {
  return useQuery({
    queryKey: KEYS.paymentSummary(),
    queryFn: () => billingApi.getPaymentSummary(),
  });
}

export function useSendPaymentLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reservationId: number) => billingApi.sendPaymentLink(reservationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.all });
    },
  });
}

export function useRequestRefund() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ paymentId, request }: { paymentId: number; request: RefundRequest }) =>
      billingApi.requestRefund(paymentId, request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.all });
    },
  });
}

export function useBillingInvoices(params?: Record<string, string>) {
  return useQuery({
    queryKey: KEYS.invoices(params),
    queryFn: () => billingApi.getInvoices(params),
  });
}

export function useDownloadInvoice() {
  return useMutation({
    mutationFn: (id: number) => billingApi.downloadInvoice(id),
  });
}
