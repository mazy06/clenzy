import { apiClient } from '../apiClient';

/* ─── Types ─── */

export interface MessagingAutomationConfig {
  autoSendCheckIn: boolean;
  autoSendCheckOut: boolean;
  hoursBeforeCheckIn: number;
  hoursBeforeCheckOut: number;
  checkInTemplateId: number | null;
  checkOutTemplateId: number | null;
  autoPushPricingEnabled: boolean;
}

export interface GuestMessageLog {
  id: number;
  reservationId: number;
  guestName: string | null;
  templateName: string | null;
  channel: string;
  recipient: string;
  subject: string | null;
  status: string; // PENDING, SENT, FAILED
  errorMessage: string | null;
  sentAt: string | null;
  createdAt: string;
}

export interface MessageTemplate {
  id: number;
  name: string;
  type: string; // CHECK_IN, CHECK_OUT, WELCOME, CUSTOM
  subject: string;
  body: string;
  language: string;
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface SendMessageRequest {
  reservationId: number;
  templateId: number;
}

/* ─── API ─── */

export const guestMessagingApi = {
  /** Get automation config (auto check-in/out, push pricing) */
  getAutomationConfig() {
    return apiClient.get<MessagingAutomationConfig>('/guest-messaging/config');
  },

  /** Update automation config */
  updateAutomationConfig(config: MessagingAutomationConfig) {
    return apiClient.put<MessagingAutomationConfig>('/guest-messaging/config', config);
  },

  /** Get all guest message history */
  getHistory() {
    return apiClient.get<GuestMessageLog[]>('/guest-messaging/history');
  },

  /** Get message history for a specific reservation */
  getReservationHistory(reservationId: number) {
    return apiClient.get<GuestMessageLog[]>(`/guest-messaging/history/reservation/${reservationId}`);
  },

  /** Send a manual message to a guest */
  sendMessage(data: SendMessageRequest) {
    return apiClient.post<GuestMessageLog>('/guest-messaging/send', data);
  },

  /** Get available message templates */
  getTemplates() {
    return apiClient.get<MessageTemplate[]>('/message-templates');
  },
};
