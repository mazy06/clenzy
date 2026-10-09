import React, { useMemo, useRef, useState } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../../components/ui';
import StatusChip from '../../../components/StatusChip';
import { Archive, Paperclip } from '../../../icons/glyphs';
import { useTranslation } from '../../../hooks/useTranslation';
import { useAuth } from '../../../hooks/useAuth';
import {
  useArchiveThread,
  useReplyMessage,
  useReplyInThread,
  useThreadMessages,
} from '../../../hooks/useContactMessages';
import { useAiSuggestResponse } from '../../../hooks/useAi';
import type { ContactThreadSummary } from '../../../services/api/contactApi';
import QuoteMessageCard from './QuoteMessageCard';
import DepositMessageCard from './DepositMessageCard';
import ThreadView from './ThreadView';
import { type ThreadMessage } from './unified';
import ChannelMark from './ChannelMark';
import ConversationAvatar from './ConversationAvatar';
import { AiDraftCard, AiDraftError, AiDraftSkeleton, CopilotBar } from './AiCopilot';

/** Bouton d'outil de la barre de composition (trombone). */
const COMPOSE_TOOL_CLASS =
  'inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground disabled:cursor-default disabled:opacity-45 motion-reduce:transition-none';

interface InternalThreadProps {
  thread: ContactThreadSummary;
  /** Appelé après archivage (désélection côté parent). */
  onArchived: () => void;
  showBack?: boolean;
  onBack?: () => void;
}

/**
 * Fil d'une conversation interne (membres de l'organisation) — réutilise les
 * hooks de la messagerie interne existante (contactApi) : messages du thread,
 * réponse (avec pièces jointes), archivage du thread.
 */
export default function InternalThread({ thread, onArchived, showBack, onBack }: InternalThreadProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [draft, setDraft] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [suggestionFailed, setSuggestionFailed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: rawMessages, isLoading } = useThreadMessages(thread.counterpartKeycloakId);
  const replyMutation = useReplyMessage();
  const replyInThreadMutation = useReplyInThread();
  const archiveThreadMutation = useArchiveThread();
  const aiSuggestMutation = useAiSuggestResponse();

  // Le reset du brouillon au changement de thread passe par le remount via
  // `key={counterpartKeycloakId}` chez le parent (MessagingHubPage).

  const messages: ThreadMessage[] = useMemo(
    () =>
      (rawMessages ?? []).map((msg) => ({
        id: msg.id,
        out: msg.senderId === user?.id,
        text: msg.message,
        at: msg.createdAt,
        sender: msg.senderName,
        attachments: msg.attachments?.map((a) => a.originalName),
        // Devis soumis dans le fil : l'intervention, le PDF et la decision.
        card: msg.payload?.kind === 'SERVICE_QUOTE'
          ? <QuoteMessageCard card={msg.payload} />
          : msg.payload?.kind === 'QUOTE_DEPOSIT'
            ? <DepositMessageCard card={msg.payload} threadKey={thread.counterpartKeycloakId} />
            : undefined,
      })),
    [rawMessages, user?.id],
  );

  const lastInbound = useMemo(() => [...messages].reverse().find((msg) => !msg.out), [messages]);

  // Un fil de GROUPE n'a pas d'interlocuteur : il a un sujet et des
  // participants. Le reste de l'ecran continue de l'adresser par sa cle.
  const isGroup = thread.threadId != null;
  const counterpartName = isGroup
    ? (thread.title ?? t('messagingHub.groupThread', 'Discussion de groupe'))
    : `${thread.counterpartFirstName ?? ''} ${thread.counterpartLastName ?? ''}`.trim()
      || thread.counterpartEmail;

  const handleSend = () => {
    // Repondre dans un groupe s'adresse au FIL, pas au dernier expediteur :
    // repondre au message aurait ouvert un echange un-a-un avec lui.
    if (isGroup) {
      replyInThreadMutation.mutate(
        { threadKey: thread.counterpartKeycloakId, message: draft.trim() },
        { onSuccess: () => { setDraft(''); setAttachments([]); } },
      );
      return;
    }
    if (!rawMessages || rawMessages.length === 0) return;
    const lastMessage = rawMessages[rawMessages.length - 1];
    replyMutation.mutate(
      {
        id: lastMessage.id,
        data: {
          message: draft.trim(),
          attachments: attachments.length > 0 ? attachments : undefined,
        },
      },
      {
        onSuccess: () => {
          setDraft('');
          setAttachments([]);
        },
      },
    );
  };

  // La suggestion s'affiche dans une carte à relire (comme sur les fils voyageur),
  // elle n'écrase plus ce que l'opérateur a déjà commencé à taper.
  const handleAiSuggest = () => {
    if (!lastInbound) return;
    setSuggestionFailed(false);
    aiSuggestMutation.mutate(
      { message: lastInbound.text },
      {
        onSuccess: (result) => setSuggestion(result.response),
        onError: () => {
          setSuggestion(null);
          setSuggestionFailed(true);
        },
      },
    );
  };

  const handleUseSuggestion = (text: string) => {
    setDraft(text);
    setSuggestion(null);
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        hidden
        multiple
        onChange={(e) => {
          if (e.target.files) setAttachments((prev) => [...prev, ...Array.from(e.target.files!)]);
          e.target.value = '';
        }}
      />
      <ThreadView
        title={counterpartName}
        avatar={<ConversationAvatar name={counterpartName} channel="INTERNAL" group={isGroup} />}
        subtitle={
          <>
            <ChannelMark channel="INTERNAL" size={14} />
            {t('messagingHub.internalChat', 'Chat interne')}
            {isGroup
              ? ` · ${(thread.participantNames ?? []).join(', ')}`
              : thread.counterpartEmail ? ` · ${thread.counterpartEmail}` : ''}
          </>
        }
        menuItems={[
          {
            key: 'archive',
            label: t('messagingHub.archive', 'Archiver'),
            icon: <Archive className="size-4" aria-hidden />,
            onClick: () =>
              archiveThreadMutation.mutate(thread.counterpartKeycloakId, { onSuccess: onArchived }),
            disabled: archiveThreadMutation.isPending,
          },
        ]}
        messages={messages}
        loading={isLoading}
        draft={draft}
        onDraftChange={setDraft}
        onSend={handleSend}
        sending={replyMutation.isPending || replyInThreadMutation.isPending}
        composePlaceholder={t('messagingHub.replyTo', 'Répondre à {{name}}…', { name: counterpartName })}
        composeExtra={
          attachments.length > 0 ? (
            <div className="flex flex-wrap gap-1 pb-1.5">
              {attachments.map((file, idx) => (
                <StatusChip
                  key={`${file.name}-${idx}`}
                  label={file.name}
                  onDelete={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                  deleteLabel={t('common.remove', 'Retirer')}
                />
              ))}
            </div>
          ) : undefined
        }
        composeTools={
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  aria-label={t('messagingHub.attachFile', 'Joindre un fichier')}
                  className={COMPOSE_TOOL_CLASS}
                >
                  <Paperclip className="size-4" aria-hidden />
                </button>
              </TooltipTrigger>
              <TooltipContent>{t('messagingHub.attachFile', 'Joindre un fichier')}</TooltipContent>
            </Tooltip>
          </>
        }
        copilot={
          <>
            {aiSuggestMutation.isPending && <AiDraftSkeleton />}
            {suggestionFailed && !aiSuggestMutation.isPending && (
              <AiDraftError onRetry={handleAiSuggest} onDismiss={() => setSuggestionFailed(false)} />
            )}
            {suggestion && !aiSuggestMutation.isPending && (
              <AiDraftCard
                kind="suggestion"
                text={suggestion}
                onUse={handleUseSuggestion}
                onRegenerate={handleAiSuggest}
                onDismiss={() => setSuggestion(null)}
              />
            )}
            {lastInbound && !suggestion && !aiSuggestMutation.isPending && !suggestionFailed && (
              <CopilotBar onSuggest={handleAiSuggest} suggesting={aiSuggestMutation.isPending} />
            )}
          </>
        }
        showBack={showBack}
        onBack={onBack}
      />
    </>
  );
}
