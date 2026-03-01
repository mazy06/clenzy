import { apiClient } from '../apiClient';

export interface CalendarDay {
  id: number;
  propertyId: number;
  date: string;
  status: string;
  notes?: string;
}

export const calendarApi = {
  getDays(propertyId: number, startDate: string, endDate: string) {
    return apiClient.get<CalendarDay[]>(`/calendar/${propertyId}/days`, {
      params: { startDate, endDate },
    });
  },
};
