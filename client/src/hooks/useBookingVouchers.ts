import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  bookingVouchersApi,
  type BookingVoucher,
  type BookingVoucherCreateRequest,
  type BookingVoucherUpdateRequest,
  type VoucherStatus,
} from '../services/api/bookingVouchersApi';

/**
 * Query keys hierarchiques pour invalidation ciblee.
 * Convention TanStack Query : factory functions, jamais de strings hardcodes.
 */
export const bookingVouchersKeys = {
  all: ['booking-vouchers'] as const,
  lists: () => [...bookingVouchersKeys.all, 'list'] as const,
  list: (status?: VoucherStatus) => [...bookingVouchersKeys.lists(), status ?? 'all'] as const,
  detail: (id: number) => [...bookingVouchersKeys.all, 'detail', id] as const,
};

// ─── Queries ─────────────────────────────────────────────────────────────────

export function useBookingVouchersList(statusFilter?: VoucherStatus) {
  return useQuery<BookingVoucher[]>({
    queryKey: bookingVouchersKeys.list(statusFilter),
    queryFn: () => bookingVouchersApi.list(statusFilter),
    staleTime: 30_000,
  });
}

export function useBookingVoucherDetail(id: number | null, enabled = true) {
  return useQuery<BookingVoucher>({
    queryKey: bookingVouchersKeys.detail(id ?? 0),
    queryFn: () => bookingVouchersApi.getById(id!),
    enabled: enabled && id !== null && id > 0,
    staleTime: 30_000,
  });
}

// ─── Mutations ───────────────────────────────────────────────────────────────

export function useCreateBookingVoucher() {
  const qc = useQueryClient();
  return useMutation<BookingVoucher, Error, BookingVoucherCreateRequest>({
    mutationFn: (payload) => bookingVouchersApi.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: bookingVouchersKeys.lists() });
    },
  });
}

export function useUpdateBookingVoucher() {
  const qc = useQueryClient();
  return useMutation<BookingVoucher, Error, { id: number; payload: BookingVoucherUpdateRequest }>({
    mutationFn: ({ id, payload }) => bookingVouchersApi.update(id, payload),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: bookingVouchersKeys.lists() });
      qc.invalidateQueries({ queryKey: bookingVouchersKeys.detail(variables.id) });
    },
  });
}

export function useDeleteBookingVoucher() {
  const qc = useQueryClient();
  return useMutation<void, Error, number>({
    mutationFn: (id) => bookingVouchersApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: bookingVouchersKeys.lists() });
    },
  });
}

export function usePauseBookingVoucher() {
  const qc = useQueryClient();
  return useMutation<BookingVoucher, Error, number>({
    mutationFn: (id) => bookingVouchersApi.pause(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: bookingVouchersKeys.lists() });
      qc.invalidateQueries({ queryKey: bookingVouchersKeys.detail(id) });
    },
  });
}

export function useResumeBookingVoucher() {
  const qc = useQueryClient();
  return useMutation<BookingVoucher, Error, number>({
    mutationFn: (id) => bookingVouchersApi.resume(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: bookingVouchersKeys.lists() });
      qc.invalidateQueries({ queryKey: bookingVouchersKeys.detail(id) });
    },
  });
}
