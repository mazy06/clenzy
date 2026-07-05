import apiClient from '../apiClient';

// ─── Types ──────────────────────────────────────────────────────────────────

export type AutomationTrigger =
  // Cycle de vie réservation (basés sur un décalage J-X/J+X + heure)
  | 'RESERVATION_CONFIRMED'
  | 'CHECK_IN_APPROACHING'
  | 'CHECK_IN_DAY'
  | 'CHECK_OUT_DAY'
  | 'CHECK_OUT_PASSED'
  | 'REVIEW_REMINDER'
  // Événementiels (tirés par les capteurs, exécution immédiate)
  | 'RESERVATION_BOOKED'
  | 'RESERVATION_CANCELLED'
  | 'NOISE_ALERT'
  | 'PAYMENT_FAILED'
  | 'LOCK_BATTERY_CRITICAL'
  | 'INVOICE_OVERDUE'
  | 'PAYOUT_PENDING_REMINDER'
  | 'OWNER_MONTHLY_STATEMENT'
  | 'IOT_DEVICE_OFFLINE'
  | 'RATE_PARITY_DISPARITY';

export type AutomationAction =
  // Messaging invité (template + canal)
  | 'SEND_MESSAGE'
  | 'SEND_GUIDE'
  | 'SEND_REVIEW_REQUEST'
  | 'SEND_CHECKIN_LINK'
  // Opérations
  | 'CREATE_CLEANING_REQUEST'
  | 'CANCEL_LINKED_CLEANING_REQUEST'
  | 'CREATE_MAINTENANCE_INTERVENTION'
  | 'NOTIFY_STAFF'
  | 'REVOKE_ACCESS_CODE'
  // Finance
  | 'SEND_INVOICE_REMINDER'
  | 'SEND_OWNER_STATEMENT'
  | 'NOTIFY_RATE_PARITY'
  // Sécurité / incidents
  | 'SEND_NOISE_WARNING'
  // Argent — suggestions HITL (jamais auto)
  | 'SUGGEST_DEPOSIT_REFUND'
  | 'SUGGEST_DEPOSIT_RELEASE'
  | 'SUGGEST_CALENDAR_BLOCK';

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
  actionConfig: string | null;
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
  actionConfig?: string;
  templateId?: number;
  deliveryChannel?: MessageChannelType;
}

/** Automatisation HORS hub (code / autre mécanisme), lecture seule, statut réel. */
export interface SystemAutomation {
  key: string;
  label: string;
  description: string;
  triggerLabel: string;
  actionLabel: string;
  effective: boolean;
  status: 'ACTIVE' | 'INACTIVE' | 'TRANSACTIONAL' | 'OPT_IN';
  statusLabel: string;
  mechanism: string;
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

// ─── Conditions (JSONB) ───────────────────────────────────────────────────────
// Le backend (AutomationConditionEvaluator) lit ces champs optionnels (ET logique).

export type GuestLanguage = 'fr' | 'en' | 'ar';

export interface AutomationConditions {
  propertyIds?: number[];
  minNights?: number;
  maxNights?: number;
  guestLanguage?: GuestLanguage;
}

/** Parse le champ `conditions` (string JSON) en objet structure. Tolerant aux valeurs invalides. */
export function parseConditions(json: string | null | undefined): AutomationConditions {
  if (!json || !json.trim()) return {};
  try {
    const parsed = JSON.parse(json);
    return parsed && typeof parsed === 'object' ? (parsed as AutomationConditions) : {};
  } catch {
    return {};
  }
}

/** Serialise les conditions en JSON compact, en omettant les champs vides. Retourne '' si aucune condition. */
export function stringifyConditions(c: AutomationConditions): string {
  const out: AutomationConditions = {};
  if (c.propertyIds && c.propertyIds.length > 0) out.propertyIds = c.propertyIds;
  if (typeof c.minNights === 'number' && !Number.isNaN(c.minNights)) out.minNights = c.minNights;
  if (typeof c.maxNights === 'number' && !Number.isNaN(c.maxNights)) out.maxNights = c.maxNights;
  if (c.guestLanguage) out.guestLanguage = c.guestLanguage;
  return Object.keys(out).length > 0 ? JSON.stringify(out) : '';
}

// ─── Display Helpers ────────────────────────────────────────────────────────

export const TRIGGER_LABELS: Record<AutomationTrigger, string> = {
  RESERVATION_CONFIRMED: 'Reservation confirmee',
  CHECK_IN_APPROACHING: 'Check-in approche',
  CHECK_IN_DAY: 'Jour du check-in',
  CHECK_OUT_DAY: 'Jour du check-out',
  CHECK_OUT_PASSED: 'Apres le check-out',
  REVIEW_REMINDER: 'Rappel avis',
  RESERVATION_BOOKED: 'Nouvelle reservation',
  RESERVATION_CANCELLED: 'Reservation annulee',
  NOISE_ALERT: 'Alerte bruit',
  PAYMENT_FAILED: 'Paiement echoue',
  LOCK_BATTERY_CRITICAL: 'Batterie serrure critique',
  INVOICE_OVERDUE: 'Facture impayee',
  PAYOUT_PENDING_REMINDER: 'Reversement en attente',
  OWNER_MONTHLY_STATEMENT: 'Releve mensuel proprietaire',
  IOT_DEVICE_OFFLINE: 'Capteur IoT hors ligne',
  RATE_PARITY_DISPARITY: 'Disparite de prix (canaux)',
};

export const ACTION_LABELS: Record<AutomationAction, string> = {
  SEND_MESSAGE: 'Envoyer un message',
  SEND_GUIDE: "Envoyer le livret d'accueil",
  SEND_REVIEW_REQUEST: 'Demander un avis',
  SEND_CHECKIN_LINK: 'Envoyer le lien de check-in',
  CREATE_CLEANING_REQUEST: 'Creer une demande de menage',
  CANCEL_LINKED_CLEANING_REQUEST: 'Annuler le menage lie',
  CREATE_MAINTENANCE_INTERVENTION: 'Creer une intervention de maintenance',
  NOTIFY_STAFF: "Notifier l'equipe",
  REVOKE_ACCESS_CODE: "Revoquer le code d'acces",
  SEND_INVOICE_REMINDER: 'Relancer la facture',
  SEND_OWNER_STATEMENT: 'Envoyer le releve proprietaire',
  NOTIFY_RATE_PARITY: 'Alerter sur la disparite de prix',
  SEND_NOISE_WARNING: 'Avertir le voyageur (bruit)',
  SUGGEST_DEPOSIT_REFUND: 'Suggerer un remboursement de caution',
  SUGGEST_DEPOSIT_RELEASE: 'Suggerer une liberation de caution',
  SUGGEST_CALENDAR_BLOCK: 'Suggerer un blocage du calendrier',
};

// ─── Métadonnées (pour piloter le formulaire) ─────────────────────────────────

/** Déclencheurs « cycle de vie » : amorcés à la résa + re-évalués par un décalage
 *  J-X/J+X + heure. Les autres sont événementiels (immédiats, sans décalage).
 *  Miroir de AutomationTrigger.RESERVATION_LIFECYCLE côté backend. */
export const LIFECYCLE_TRIGGERS: ReadonlySet<AutomationTrigger> = new Set([
  'RESERVATION_CONFIRMED', 'CHECK_IN_APPROACHING', 'CHECK_IN_DAY',
  'CHECK_OUT_DAY', 'CHECK_OUT_PASSED', 'REVIEW_REMINDER',
]);

export function isLifecycleTrigger(t: AutomationTrigger): boolean {
  return LIFECYCLE_TRIGGERS.has(t);
}

/** Groupes de déclencheurs pour l'affichage groupé du sélecteur. */
export const TRIGGER_GROUPS: { label: string; triggers: AutomationTrigger[] }[] = [
  {
    label: 'Cycle de vie de la reservation',
    triggers: ['RESERVATION_CONFIRMED', 'CHECK_IN_APPROACHING', 'CHECK_IN_DAY', 'CHECK_OUT_DAY', 'CHECK_OUT_PASSED', 'REVIEW_REMINDER'],
  },
  {
    label: 'Evenements',
    triggers: ['RESERVATION_BOOKED', 'RESERVATION_CANCELLED', 'NOISE_ALERT', 'PAYMENT_FAILED', 'LOCK_BATTERY_CRITICAL', 'INVOICE_OVERDUE', 'PAYOUT_PENDING_REMINDER', 'OWNER_MONTHLY_STATEMENT', 'IOT_DEVICE_OFFLINE', 'RATE_PARITY_DISPARITY'],
  },
];

/** Actions « messaging » : nécessitent un canal d'envoi (et un template pour SEND_MESSAGE). */
export const MESSAGING_ACTIONS: ReadonlySet<AutomationAction> = new Set([
  'SEND_MESSAGE', 'SEND_GUIDE', 'SEND_REVIEW_REQUEST', 'SEND_CHECKIN_LINK',
]);

export function isMessagingAction(a: AutomationAction): boolean {
  return MESSAGING_ACTIONS.has(a);
}

/** Seule SEND_MESSAGE référence un template libre ; les autres portent leur contenu. */
export function actionNeedsTemplate(a: AutomationAction): boolean {
  return a === 'SEND_MESSAGE';
}

/** Actions recommandées par déclencheur (les executors attendent un sujet cohérent).
 *  Le sélecteur d'action se restreint à ces choix pour éviter les combinaisons vides. */
export const TRIGGER_ACTIONS: Record<AutomationTrigger, AutomationAction[]> = {
  RESERVATION_CONFIRMED: ['SEND_MESSAGE', 'SEND_GUIDE', 'SEND_CHECKIN_LINK'],
  CHECK_IN_APPROACHING: ['SEND_MESSAGE', 'SEND_GUIDE', 'SEND_CHECKIN_LINK'],
  CHECK_IN_DAY: ['SEND_MESSAGE', 'SEND_GUIDE', 'SEND_CHECKIN_LINK'],
  CHECK_OUT_DAY: ['SEND_MESSAGE'],
  CHECK_OUT_PASSED: ['SEND_MESSAGE', 'SEND_REVIEW_REQUEST', 'CREATE_CLEANING_REQUEST', 'REVOKE_ACCESS_CODE', 'SUGGEST_DEPOSIT_RELEASE'],
  REVIEW_REMINDER: ['SEND_MESSAGE', 'SEND_REVIEW_REQUEST'],
  RESERVATION_BOOKED: ['CREATE_CLEANING_REQUEST', 'SEND_MESSAGE'],
  RESERVATION_CANCELLED: ['CANCEL_LINKED_CLEANING_REQUEST', 'NOTIFY_STAFF', 'SUGGEST_DEPOSIT_REFUND'],
  NOISE_ALERT: ['SEND_NOISE_WARNING', 'NOTIFY_STAFF', 'CREATE_MAINTENANCE_INTERVENTION', 'SUGGEST_CALENDAR_BLOCK'],
  PAYMENT_FAILED: ['NOTIFY_STAFF'],
  LOCK_BATTERY_CRITICAL: ['CREATE_MAINTENANCE_INTERVENTION', 'NOTIFY_STAFF'],
  INVOICE_OVERDUE: ['SEND_INVOICE_REMINDER', 'NOTIFY_STAFF'],
  PAYOUT_PENDING_REMINDER: ['NOTIFY_STAFF'],
  OWNER_MONTHLY_STATEMENT: ['SEND_OWNER_STATEMENT'],
  IOT_DEVICE_OFFLINE: ['NOTIFY_STAFF'],
  RATE_PARITY_DISPARITY: ['NOTIFY_RATE_PARITY', 'NOTIFY_STAFF'],
};

/** Action config (JSONB) : seule REVOKE_ACCESS_CODE en porte une (délai de grâce). */
export interface RevokeAccessConfig {
  graceHours?: number;
}

export function actionUsesGraceHours(a: AutomationAction): boolean {
  return a === 'REVOKE_ACCESS_CODE';
}

export function parseActionConfig(json: string | null | undefined): RevokeAccessConfig {
  if (!json || !json.trim()) return {};
  try {
    const p = JSON.parse(json);
    return p && typeof p === 'object' ? (p as RevokeAccessConfig) : {};
  } catch {
    return {};
  }
}

export function stringifyGraceHours(hours: number | undefined): string {
  return typeof hours === 'number' && !Number.isNaN(hours) && hours >= 0
    ? JSON.stringify({ graceHours: hours })
    : '';
}

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

  /** Automatisations hors hub (code / autre mécanisme), lecture seule, statut réel. */
  async getSystemAutomations(): Promise<SystemAutomation[]> {
    return apiClient.get<SystemAutomation[]>('/automation-rules/system');
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
