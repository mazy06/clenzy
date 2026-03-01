import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ratePlanApi,
  type RatePlanDto,
  type PricingCalendarDay,
  type CreateRatePlanRequest,
  type UpdateRatePlanRequest,
} from '@/api/endpoints/ratePlanApi';

const KEYS = {
  plans: (propertyId: number) => ['rate-plans', propertyId] as const,
  calendar: (propertyId: number, from: string, to: string) =>
    ['pricing-calendar', propertyId, from, to] as const,
};

/** Fetch all rate plans for a property */
export function useRatePlans(propertyId: number) {
  return useQuery<RatePlanDto[]>({
    queryKey: KEYS.plans(propertyId),
    queryFn: () => ratePlanApi.getByProperty(propertyId),
    enabled: propertyId > 0,
    staleTime: 30_000,
  });
}

/** Fetch enriched pricing calendar for a property + date range */
export function usePricingCalendar(propertyId: number, from: string, to: string) {
  return useQuery<PricingCalendarDay[]>({
    queryKey: KEYS.calendar(propertyId, from, to),
    queryFn: () => ratePlanApi.getPricingCalendar(propertyId, from, to),
    enabled: propertyId > 0 && !!from && !!to,
    staleTime: 30_000,
  });
}

/** Create a new rate plan */
export function useCreateRatePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateRatePlanRequest) => ratePlanApi.create(data),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: KEYS.plans(variables.propertyId) });
      // Invalidate all pricing calendars for this property
      queryClient.invalidateQueries({
        queryKey: ['pricing-calendar', variables.propertyId],
      });
    },
  });
}

/** Update an existing rate plan */
export function useUpdateRatePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateRatePlanRequest }) =>
      ratePlanApi.update(id, data),
    onSuccess: (_result, { data }) => {
      queryClient.invalidateQueries({ queryKey: KEYS.plans(data.propertyId) });
      queryClient.invalidateQueries({
        queryKey: ['pricing-calendar', data.propertyId],
      });
    },
  });
}

/** Delete a rate plan */
export function useDeleteRatePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, propertyId }: { id: number; propertyId: number }) =>
      ratePlanApi.delete(id),
    onSuccess: (_result, { propertyId }) => {
      queryClient.invalidateQueries({ queryKey: KEYS.plans(propertyId) });
      queryClient.invalidateQueries({
        queryKey: ['pricing-calendar', propertyId],
      });
    },
  });
}
