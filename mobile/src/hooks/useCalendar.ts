import { useQuery } from '@tanstack/react-query';
import { calendarApi } from '@/api/endpoints/calendarApi';

const KEYS = {
  days: (propertyId: number, startDate: string, endDate: string) =>
    ['calendar', propertyId, startDate, endDate] as const,
};

export function useCalendarDays(propertyId: number, startDate: string, endDate: string) {
  return useQuery({
    queryKey: KEYS.days(propertyId, startDate, endDate),
    queryFn: () => calendarApi.getDays(propertyId, startDate, endDate),
    enabled: propertyId > 0 && !!startDate && !!endDate,
  });
}
