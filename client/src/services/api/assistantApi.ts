import apiClient from '../apiClient';
import { buildApiUrl } from '../../config/api';
import { getAccessToken } from '../../keycloak';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface ConversationSummary {
  id: number;
  title: string | null;
  model: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationsPage {
  content: ConversationSummary[];
  totalElements: number;
  totalPages: number;
  number: number;
}

export interface AssistantMessage {
  id: number;
  role: 'user' | 'assistant' | 'tool';
  content?: string;
  toolCalls?: string; // JSON string from backend
  toolCallId?: string;
  /** JSON string array : [{ storageKey, mediaType, url, name }] */
  attachments?: string;
  createdAt: string;
}

/**
 * Reference vers une image uploadee au prealable via {@link uploadImage}.
 * Le frontend la reinjecte dans {@link ChatRequestBody.attachments} pour
 * que le backend resolve les bytes et les fournisse a Claude Vision.
 */
export interface AttachmentRef {
  storageKey: string;
  mediaType: string;
  url: string;
  name?: string;
}

export interface UploadResponse {
  storageKey: string;
  mediaType: string;
  name?: string;
  size: number;
  url: string;
}

/**
 * Evenement SSE emis par le backend. Discriminant {@link type}.
 */
export type AgentSseEvent =
  | { type: 'conversation_created'; conversationId: number }
  | { type: 'text_delta'; delta: string }
  | { type: 'tool_call_executed'; toolName: string; toolCallId: string; toolError: boolean; displayHint?: string; toolResult?: string }
  | { type: 'tool_confirmation_request'; toolName: string; toolCallId: string; toolArgs: string; toolDescription: string }
  | { type: 'paused_awaiting_confirmation' }
  | { type: 'done'; finishReason: string }
  | { type: 'error'; error: string };

/**
 * Snapshot de consommation de l'assistant (tokens + cout USD).
 * Retourne par {@code GET /assistant/usage} et utilise par le badge header chat.
 */
export interface AssistantUsage {
  tokensIn: number;
  tokensOut: number;
  /** Cout cumule en USD (BigDecimal serialise en string ou number selon Jackson). */
  costUsd: number;
  byModel: AssistantUsageModel[];
  period: 'today' | 'month' | 'all' | 'conversation';
  monthlyBudget: number | null;
  requestCount: number;
}

export interface AssistantUsageModel {
  model: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  count: number;
}

export interface ChatRequestBody {
  conversationId?: number | null;
  message: string;
  currentPage?: string;
  selectedPropertyId?: number;
  attachments?: AttachmentRef[];
}

export interface ToolConfirmBody {
  toolCallId: string;
  confirmed: boolean;
}

// ─── REST endpoints ────────────────────────────────────────────────────────

export const assistantApi = {
  listConversations(page = 0, size = 20): Promise<ConversationsPage> {
    return apiClient.get<ConversationsPage>('/assistant/conversations', { params: { page, size } });
  },

  getMessages(conversationId: number): Promise<AssistantMessage[]> {
    return apiClient.get<AssistantMessage[]>(`/assistant/conversations/${conversationId}/messages`);
  },

  archiveConversation(conversationId: number): Promise<void> {
    return apiClient.delete<void>(`/assistant/conversations/${conversationId}`);
  },

  /**
   * Consommation tokens + cout USD de l'organisation sur une periode.
   * Alimente le badge "$0.12 ce mois · 1.2k tokens" dans le header chat.
   */
  getUsage(period: 'today' | 'month' | 'all' = 'month'): Promise<AssistantUsage> {
    return apiClient.get<AssistantUsage>('/assistant/usage', { params: { period } });
  },

  /**
   * Consommation d'une conversation specifique (404 si non-owner).
   */
  getConversationUsage(conversationId: number): Promise<AssistantUsage> {
    return apiClient.get<AssistantUsage>(`/assistant/usage/conversations/${conversationId}`);
  },

  /**
   * Upload une image pour usage dans le chat (vision). Le backend valide MIME +
   * taille (max 5MB, formats jpeg/png/gif/webp) et retourne une reference a
   * reinjecter dans le {@link ChatRequestBody.attachments}.
   */
  uploadImage(file: File): Promise<UploadResponse> {
    const form = new FormData();
    form.append('file', file);
    return apiClient.upload<UploadResponse>('/assistant/upload', form);
  },

  // ─── SSE chat ────────────────────────────────────────────────────────────
  /**
   * Lance un message dans l'assistant et stream les evenements SSE.
   *
   * On ne peut PAS utiliser `EventSource` natif car il ne supporte que GET.
   * On utilise donc `fetch` + `ReadableStream` pour lire le flux text/event-stream.
   *
   * @param body         contenu du message
   * @param onEvent      callback appele pour chaque event SSE parse
   * @param signal       optionnel pour cancel via AbortController
   * @returns promise qui se resout quand le stream est fini (apres event "done" ou "error")
   */
  /**
   * Confirme ou refuse un tool d'ecriture en attente. Reprend la conversation
   * en SSE comme {@link streamChat}.
   */
  async confirmTool(
    body: ToolConfirmBody,
    onEvent: (event: AgentSseEvent) => void,
    signal?: AbortSignal,
  ): Promise<void> {
    return this._postSse('/assistant/tool-confirm', body, onEvent, signal);
  },

  async streamChat(
    body: ChatRequestBody,
    onEvent: (event: AgentSseEvent) => void,
    signal?: AbortSignal,
  ): Promise<void> {
    return this._postSse('/assistant/chat', body, onEvent, signal);
  },

  // ─── Internal SSE POST helper (used by streamChat + confirmTool) ────────
  async _postSse(
    endpoint: string,
    body: unknown,
    onEvent: (event: AgentSseEvent) => void,
    signal?: AbortSignal,
  ): Promise<void> {
    const token = getAccessToken();
    const response = await fetch(buildApiUrl(endpoint), {
      method: 'POST',
      credentials: 'include',
      headers: {
        'content-type': 'application/json',
        accept: 'text/event-stream',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok || !response.body) {
      const text = await response.text().catch(() => '');
      throw new Error(`Assistant SSE ${endpoint} failed (${response.status}): ${text || 'no body'}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let currentEventName: string | null = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // SSE events are separated by double newline (\n\n).
      // Each event may have multiple lines : "event: name\ndata: {json}".
      let separatorIdx;
      while ((separatorIdx = buffer.indexOf('\n\n')) >= 0) {
        const rawEvent = buffer.slice(0, separatorIdx);
        buffer = buffer.slice(separatorIdx + 2);

        // Parse each line of the event
        const lines = rawEvent.split('\n');
        let data = '';
        for (const line of lines) {
          if (line.startsWith('event:')) {
            currentEventName = line.slice(6).trim();
          } else if (line.startsWith('data:')) {
            data += line.slice(5).trim();
          }
        }

        if (data) {
          try {
            const parsed = JSON.parse(data) as AgentSseEvent;
            onEvent(parsed);
          } catch (e) {
            // eslint-disable-next-line no-console
            console.warn('Failed to parse SSE event', { data, eventName: currentEventName, error: e });
          }
        }
      }
    }
  },
};
