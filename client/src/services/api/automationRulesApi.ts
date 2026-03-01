import apiClient from '../apiClient';

// ─── Types ──────────────────────────────────────────────────────────────────

export type AutomationTrigger =
  | 'RESERVATION_CONFIRMED'
  | 'CHECK_IN_APPROACHING'
  | 'CHECK_IN_DAY'
  | 'CHECK_OUT_DAY'
  | 'CHECK_OUT_PASSED'
  | 'REVIEW_REMINDER';

export type AutomationAction = 'SEND_MESSAGE';

export type MessageChannelType = 'EMAIL' | 'SMS' | 'WHATSAPP';

export interface AutomationRule {
  id: number;
  name: string;
  enabled: boolean;
  sortOrder: number;
  triggerType: AutomationTrigger;
  triggerOffsetDays: number;
  triggerTime: string;
  conditions: string | null;
  actionType: AutomationAction;
  templateId: number | null;
  templateName: string | null;
  deliveryChannel: MessageChannelType;
  createdAt: string;
}

export interface CreateAutomationRuleData {
  name: string;
  triggerType: AutomationTrigger;
  triggerOffsetDays: number;
  triggerTime?: string;
  conditions?: string;
  actionType?: AutomationAction;
  templateId?: number;
  deliveryChannel?: MessageChannelType;
}

export interface AutomationExecution {
  id: number;
  ruleId: number;
  ruleName: string;
  reservationId: number;
  guestName: string;
  status: string;
  errorMessage: string | null;
  createdAt: string;
}

export interface AutomationExecutionPage {
  content: AutomationExecution[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

// ─── Display Helpers ────────────────────────────────────────────────────────

export const TRIGGER_LABELS: Record<AutomationTrigger, string> = {
  RESERVATION_CONFIRMED: 'Reservation confirmee',
  CHECK_IN_APPROACHING: 'Check-in approche',
  CHECK_IN_DAY: 'Jour du check-in',
  CHECK_OUT_DAY: 'Jour du check-out',
  CHECK_OUT_PASSED: 'Apres le check-out',
  REVIEW_REMINDER: 'Rappel avis',
};

export const CHANNEL_TYPE_COLORS: Record<MessageChannelType, string> = {
  EMAIL: '#1976d2',
  SMS: '#4A9B8E',
  WHATSAPP: '#25D366',
};

// ─── API ────────────────────────────────────────────────────────────────────

export const automationRulesApi = {
  async getAll(): Promise<AutomationRule[]> {
    return apiClient.get<AutomationRule[]>('/automation-rules');
  },

  async getById(id: number): Promise<AutomationRule> {
    return apiClient.get<AutomationRule>(`/automation-rules/${id}`);
  },

  async create(data: CreateAutomationRuleData): Promise<AutomationRule> {
    return apiClient.post<AutomationRule>('/automation-rules', data);
  },

  async update(id: number, data: CreateAutomationRuleData): Promise<AutomationRule> {
    return apiClient.put<AutomationRule>(`/automation-rules/${id}`, data);
  },

  async remove(id: number): Promise<void> {
    return apiClient.delete(`/automation-rules/${id}`);
  },

  async toggle(id: number): Promise<AutomationRule> {
    return apiClient.put<AutomationRule>(`/automation-rules/${id}/toggle`);
  },

  async getExecutions(id: number, page = 0, size = 20): Promise<AutomationExecutionPage> {
    return apiClient.get<AutomationExecutionPage>(`/automation-rules/${id}/executions`, {
      params: { page, size },
    });
  },
};
