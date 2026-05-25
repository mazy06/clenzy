import { useCallback, useEffect, useRef, useState } from 'react';
import {
  assistantApi,
  AssistantMessage,
  AgentSseEvent,
  ChatRequestBody,
} from '../services/api/assistantApi';

// ─── Types ────────────────────────────────────────────────────────────────

/**
 * Message tel qu'affiche cote frontend. Les messages persistes en BDD sont
 * charges via {@link assistantApi.getMessages} ; les messages emis pendant
 * un stream sont construits incrementalement a partir des deltas.
 */
export interface DisplayMessage {
  id?: number;             // null pendant le streaming
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: ToolCallExecuted[]; // hydratees pendant le stream depuis tool_call_executed
  toolCallId?: string;
  createdAt?: string;
  /** True pendant que le delta arrive — bascule a false sur "done". */
  streaming?: boolean;
}

export interface ToolCallExecuted {
  toolName: string;
  toolCallId: string;
  toolError: boolean;
  displayHint?: string;
  /**
   * Contenu JSON serialise renvoye par le tool. Le composant {@code MessageBubble}
   * le parse et rend un widget contextualise via {@code ToolResultWidget}.
   * Null si le tool a echoue (toolError=true).
   */
  toolResult?: string;
}

export type AgentStatus = 'idle' | 'sending' | 'streaming' | 'awaiting_confirmation' | 'error';

/**
 * Tool en attente de confirmation user. Quand l'orchestrateur croise un tool
 * {@code requiresConfirmation=true}, il emet un evenement SSE puis suspend
 * le stream. Le frontend doit afficher un dialog et envoyer la decision
 * via {@link UseAgentResult#confirmTool}.
 */
export interface PendingToolConfirmation {
  toolName: string;
  toolCallId: string;
  toolArgs: string;        // JSON string des args, prêt à parser par l'UI pour récap lisible
  toolDescription: string;  // Description du tool (issue du descriptor) pour le dialog
}

export interface UseAgentOptions {
  /** Page courante pour le context (ex: "dashboard", "calendar"). */
  currentPage?: string;
  /** Propriete actuellement selectionnee dans l'UI. */
  selectedPropertyId?: number;
}

export interface UseAgentResult {
  conversationId: number | null;
  messages: DisplayMessage[];
  status: AgentStatus;
  error: string | null;
  /** Tool en attente de confirmation user, null sinon. */
  pendingConfirmation: PendingToolConfirmation | null;
  /** Envoie un message et stream la reponse. */
  sendMessage(text: string): Promise<void>;
  /** Confirme ou refuse un tool d'ecriture en attente. */
  confirmTool(confirmed: boolean): Promise<void>;
  /** Charge l'historique d'une conversation existante. */
  loadConversation(id: number): Promise<void>;
  /** Reset : nouvelle conversation, vide messages. */
  reset(): void;
  /** Annule un stream en cours. */
  abort(): void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────

/**
 * Hook principal de l'assistant conversationnel.
 *
 * <p>Gere :
 * - L'envoi de messages (POST SSE)
 * - L'accumulation des deltas en {@link DisplayMessage} streaming
 * - Le chargement d'une conversation existante
 * - L'abort d'un stream en cours
 * </p>
 */
export function useAgent(options: UseAgentOptions = {}): UseAgentResult {
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [status, setStatus] = useState<AgentStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingToolConfirmation | null>(null);

  // Ref pour le AbortController du stream en cours
  const abortRef = useRef<AbortController | null>(null);
  // Ref pour le draft assistant message en cours (mutated par les deltas)
  const draftRef = useRef<DisplayMessage | null>(null);

  // ─── Reset / Abort ──────────────────────────────────────────────────────

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    draftRef.current = null;
    setConversationId(null);
    setMessages([]);
    setStatus('idle');
    setError(null);
    setPendingConfirmation(null);
  }, []);

  const abort = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus('idle');
  }, []);

  // Cleanup au unmount
  useEffect(() => () => {
    abortRef.current?.abort();
  }, []);

  // ─── Load existing conversation ────────────────────────────────────────

  const loadConversation = useCallback(async (id: number) => {
    setStatus('sending');
    setError(null);
    try {
      const persisted = await assistantApi.getMessages(id);
      const display: DisplayMessage[] = persisted
        .filter((m) => m.role !== 'tool') // les tool results ne sont pas affiches comme messages
        .map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content ?? '',
          toolCallId: m.toolCallId,
          createdAt: m.createdAt,
        }));
      setConversationId(id);
      setMessages(display);
      setStatus('idle');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setStatus('error');
    }
  }, []);

  // ─── Send message + stream ─────────────────────────────────────────────

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (status === 'streaming' || status === 'sending') return;

    setError(null);
    setStatus('sending');

    // Optimistic : ajoute le user message immediatement
    const userMessage: DisplayMessage = {
      role: 'user',
      content: trimmed,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);

    // Prepare draft assistant message
    const draft: DisplayMessage = {
      role: 'assistant',
      content: '',
      streaming: true,
    };
    draftRef.current = draft;
    setMessages((prev) => [...prev, draft]);

    const body: ChatRequestBody = {
      conversationId: conversationId ?? undefined,
      message: trimmed,
      currentPage: options.currentPage,
      selectedPropertyId: options.selectedPropertyId,
    };

    const controller = new AbortController();
    abortRef.current = controller;

    const handleEvent = (event: AgentSseEvent) => {
      if (status !== 'awaiting_confirmation') {
        setStatus('streaming');
      }

      switch (event.type) {
        case 'conversation_created':
          setConversationId(event.conversationId);
          break;

        case 'text_delta': {
          if (!draftRef.current) return;
          draftRef.current.content += event.delta;
          setMessages((prev) => prev.map((m) => (m === draft ? { ...draft } : m)));
          break;
        }

        case 'tool_call_executed': {
          if (!draftRef.current) return;
          const tc: ToolCallExecuted = {
            toolName: event.toolName,
            toolCallId: event.toolCallId,
            toolError: event.toolError,
            displayHint: event.displayHint,
            toolResult: event.toolResult,
          };
          draftRef.current.toolCalls = [...(draftRef.current.toolCalls ?? []), tc];
          setMessages((prev) => prev.map((m) => (m === draft ? { ...draft } : m)));
          break;
        }

        case 'tool_confirmation_request': {
          // Le backend a suspendu le stream — on memorise les details pour le dialog
          setPendingConfirmation({
            toolName: event.toolName,
            toolCallId: event.toolCallId,
            toolArgs: event.toolArgs,
            toolDescription: event.toolDescription,
          });
          break;
        }

        case 'paused_awaiting_confirmation': {
          // Stream suspendu — status passe en awaiting, le dialog prend le relais.
          // Le draft assistant reste en streaming=true pour signaler visuellement
          // qu'on est en pause (vs idle si pas de tool actif).
          if (draftRef.current) {
            draftRef.current.streaming = false;
            setMessages((prev) => prev.map((m) => (m === draft ? { ...draft } : m)));
          }
          setStatus('awaiting_confirmation');
          // draftRef reste null pour que le prochain stream (apres confirm) cree un nouveau draft
          draftRef.current = null;
          break;
        }

        case 'done': {
          if (draftRef.current) {
            draftRef.current.streaming = false;
            setMessages((prev) => prev.map((m) => (m === draft ? { ...draft } : m)));
          }
          draftRef.current = null;
          setStatus('idle');
          break;
        }

        case 'error': {
          setError(event.error);
          setStatus('error');
          if (draftRef.current) {
            draftRef.current.streaming = false;
            draftRef.current.content = draftRef.current.content || `(erreur: ${event.error})`;
            setMessages((prev) => prev.map((m) => (m === draft ? { ...draft } : m)));
          }
          draftRef.current = null;
          break;
        }
      }
    };

    try {
      await assistantApi.streamChat(body, handleEvent, controller.signal);
    } catch (e) {
      // AbortError = abort volontaire, on n'affiche pas d'erreur
      if (controller.signal.aborted) {
        return;
      }
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setStatus('error');
      if (draftRef.current) {
        draftRef.current.streaming = false;
        draftRef.current.content = draftRef.current.content || `(erreur reseau: ${msg})`;
        setMessages((prev) => prev.map((m) => (m === draft ? { ...draft } : m)));
      }
      draftRef.current = null;
    } finally {
      abortRef.current = null;
    }
  }, [conversationId, options.currentPage, options.selectedPropertyId, status]);

  // ─── Tool confirmation (write tools) ────────────────────────────────────

  const confirmTool = useCallback(async (confirmed: boolean) => {
    const pending = pendingConfirmation;
    if (!pending) return;

    setPendingConfirmation(null);
    setStatus('streaming');

    // Reprend un draft pour le tour suivant (le LLM va reformuler une reponse texte)
    const draft: DisplayMessage = { role: 'assistant', content: '', streaming: true };
    draftRef.current = draft;
    setMessages((prev) => [...prev, draft]);

    const controller = new AbortController();
    abortRef.current = controller;

    const handleEvent = (event: AgentSseEvent) => {
      switch (event.type) {
        case 'text_delta': {
          if (!draftRef.current) return;
          draftRef.current.content += event.delta;
          setMessages((prev) => prev.map((m) => (m === draft ? { ...draft } : m)));
          break;
        }
        case 'tool_call_executed': {
          if (!draftRef.current) return;
          const tc: ToolCallExecuted = {
            toolName: event.toolName,
            toolCallId: event.toolCallId,
            toolError: event.toolError,
            displayHint: event.displayHint,
            toolResult: event.toolResult,
          };
          draftRef.current.toolCalls = [...(draftRef.current.toolCalls ?? []), tc];
          setMessages((prev) => prev.map((m) => (m === draft ? { ...draft } : m)));
          break;
        }
        case 'tool_confirmation_request': {
          // Cas rare : un autre tool requires_confirmation est demande par le LLM
          // apres execution du premier. On le remet en queue.
          setPendingConfirmation({
            toolName: event.toolName,
            toolCallId: event.toolCallId,
            toolArgs: event.toolArgs,
            toolDescription: event.toolDescription,
          });
          break;
        }
        case 'paused_awaiting_confirmation': {
          if (draftRef.current) {
            draftRef.current.streaming = false;
            setMessages((prev) => prev.map((m) => (m === draft ? { ...draft } : m)));
          }
          draftRef.current = null;
          setStatus('awaiting_confirmation');
          break;
        }
        case 'done': {
          if (draftRef.current) {
            draftRef.current.streaming = false;
            setMessages((prev) => prev.map((m) => (m === draft ? { ...draft } : m)));
          }
          draftRef.current = null;
          setStatus('idle');
          break;
        }
        case 'error': {
          setError(event.error);
          setStatus('error');
          if (draftRef.current) {
            draftRef.current.streaming = false;
            draftRef.current.content = draftRef.current.content || `(erreur: ${event.error})`;
            setMessages((prev) => prev.map((m) => (m === draft ? { ...draft } : m)));
          }
          draftRef.current = null;
          break;
        }
      }
    };

    try {
      await assistantApi.confirmTool(
        { toolCallId: pending.toolCallId, confirmed },
        handleEvent,
        controller.signal,
      );
    } catch (e) {
      if (controller.signal.aborted) return;
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setStatus('error');
      if (draftRef.current) {
        draftRef.current.streaming = false;
        draftRef.current.content = draftRef.current.content || `(erreur reseau: ${msg})`;
        setMessages((prev) => prev.map((m) => (m === draft ? { ...draft } : m)));
      }
      draftRef.current = null;
    } finally {
      abortRef.current = null;
    }
  }, [pendingConfirmation]);

  return {
    conversationId,
    messages,
    status,
    error,
    pendingConfirmation,
    sendMessage,
    confirmTool,
    loadConversation,
    reset,
    abort,
  };
}
