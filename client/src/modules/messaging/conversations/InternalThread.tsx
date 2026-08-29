import React, { useMemo, useRef, useState } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../../components/ui';
import StatusChip from '../../../components/StatusChip';
import {
  Archive as ArchiveIcon,
  AttachFile as AttachFileIcon,
  AutoAwesome as SparklesIcon,
} from '../../../icons';
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
import { type ThreadMessage, getChannelBadge } from './unified';

/** Equivalent classes de `composeToolSx` (toujours exporte par ThreadView pour ChannelThread). */
const COMPOSE_TOOL_CLASS =
  'flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent p-0 text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-primary disabled:cursor-default disabled:opacity-45 motion-reduce:transition-none';

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

  const handleAiSuggest = () => {
    if (!lastInbound) return;
    aiSuggestMutation.mutate(
      { message: lastInbound.text },
      { onSuccess: (result) => setDraft(result.response) },
    );
  };

  const badge = getChannelBadge('INTERNAL');

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
        subtitle={
          <>
            <span className="inline-flex text-primary">
              <badge.Icon size={13} strokeWidth={2} />
            </span>
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
            icon: <ArchiveIcon size={15} strokeWidth={1.75} />,
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
            <div className="flex flex-wrap gap-0.5 pb-1.5">
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
                  onClick={() => fileInputRef.current?.click()}
                  aria-label={t('messagingHub.attachFile', 'Joindre un fichier')}
                  className={COMPOSE_TOOL_CLASS}
                >
                  <AttachFileIcon size={15} strokeWidth={1.75} />
                </button>
              </TooltipTrigger>
              <TooltipContent>{t('messagingHub.attachFile', 'Joindre un fichier')}</TooltipContent>
            </Tooltip>
            {lastInbound && (
              <Tooltip>
                <TooltipTrigger asChild>
                  {/* Le span porte le declencheur : un bouton desactive n'emet
                      plus d'evenement de survol. */}
                  <span className="inline-flex">
                    <button
                      onClick={handleAiSuggest}
                      disabled={aiSuggestMutation.isPending}
                      aria-label={t('messagingHub.aiSuggest', 'Suggérer une réponse (IA)')}
                      className={COMPOSE_TOOL_CLASS}
                    >
                      <SparklesIcon size={15} strokeWidth={1.75} />
                    </button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {aiSuggestMutation.isError
                    ? t('messagingHub.aiUnavailable', 'Suggestion IA indisponible')
                    : t('messagingHub.aiSuggest', 'Suggérer une réponse (IA)')}
                </TooltipContent>
              </Tooltip>
            )}
          </>
        }
        showBack={showBack}
        onBack={onBack}
      />
    </>
  );
}
