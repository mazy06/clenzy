import apiClient from '../apiClient';

// ─── Types ───────────────────────────────────────────────────────────────────

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

export interface CreateMessageTemplateData {
  name: string;
  type: string;
  subject: string;
  body: string;
  language?: string;
}

export interface GuestMessageLog {
  id: number;
  reservationId: number;
  guestName: string | null;
  templateName: string | null;
  channel: string;
  recipient: string;
  subject: string | null;
  status: string;
  errorMessage: string | null;
  sentAt: string | null;
  createdAt: string;
}

export interface MessagingAutomationConfig {
  autoSendCheckIn: boolean;
  autoSendCheckOut: boolean;
  hoursBeforeCheckIn: number;
  hoursBeforeCheckOut: number;
  checkInTemplateId: number | null;
  checkOutTemplateId: number | null;
  autoPushPricingEnabled: boolean;
}

export interface SendMessageRequest {
  reservationId: number;
  templateId: number;
}

export interface TemplateVariable {
  key: string;
  description: string;
  example: string;
}

// ─── API ─────────────────────────────────────────────────────────────────────

const MESSAGING_BASE = '/guest-messaging';
const TEMPLATES_BASE = '/message-templates';

export const guestMessagingApi = {
  // ── Templates ──
  getTemplates: (): Promise<MessageTemplate[]> =>
    apiClient.get(TEMPLATES_BASE),

  getTemplate: (id: number): Promise<MessageTemplate> =>
    apiClient.get(`${TEMPLATES_BASE}/${id}`),

  createTemplate: (data: CreateMessageTemplateData): Promise<MessageTemplate> =>
    apiClient.post(TEMPLATES_BASE, data),

  updateTemplate: (id: number, data: Partial<CreateMessageTemplateData>): Promise<MessageTemplate> =>
    apiClient.put(`${TEMPLATES_BASE}/${id}`, data),

  deleteTemplate: (id: number): Promise<void> =>
    apiClient.delete(`${TEMPLATES_BASE}/${id}`),

  getVariables: (): Promise<TemplateVariable[]> =>
    apiClient.get(`${TEMPLATES_BASE}/variables`),

  // ── Automation Config ──
  getConfig: (): Promise<MessagingAutomationConfig> =>
    apiClient.get(`${MESSAGING_BASE}/config`),

  updateConfig: (data: Partial<MessagingAutomationConfig>): Promise<MessagingAutomationConfig> =>
    apiClient.put(`${MESSAGING_BASE}/config`, data),

  // ── Send ──
  sendMessage: (data: SendMessageRequest): Promise<GuestMessageLog> =>
    apiClient.post(`${MESSAGING_BASE}/send`, data),

  // ── History ──
  getHistory: (): Promise<GuestMessageLog[]> =>
    apiClient.get(`${MESSAGING_BASE}/history`),

  getReservationHistory: (reservationId: number): Promise<GuestMessageLog[]> =>
    apiClient.get(`${MESSAGING_BASE}/history/reservation/${reservationId}`),
};
