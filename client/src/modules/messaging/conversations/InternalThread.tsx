import React, { useMemo, useRef, useState } from 'react';
import { Box, Chip, Tooltip } from '@mui/material';
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
  useThreadMessages,
} from '../../../hooks/useContactMessages';
import { useAiSuggestResponse } from '../../../hooks/useAi';
import type { ContactThreadSummary } from '../../../services/api/contactApi';
import ThreadView, { composeToolSx } from './ThreadView';
import { type ThreadMessage, getChannelBadge } from './unified';

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
      })),
    [rawMessages, user?.id],
  );

  const lastInbound = useMemo(() => [...messages].reverse().find((msg) => !msg.out), [messages]);

  const counterpartName =
    `${thread.counterpartFirstName ?? ''} ${thread.counterpartLastName ?? ''}`.trim() ||
    thread.counterpartEmail;

  const handleSend = () => {
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
            <Box component="span" sx={{ display: 'inline-flex', color: 'var(--accent)' }}>
              <badge.Icon size={13} strokeWidth={2} />
            </Box>
            {t('messagingHub.internalChat', 'Chat interne')}
            {thread.counterpartEmail ? ` · ${thread.counterpartEmail}` : ''}
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
        sending={replyMutation.isPending}
        composePlaceholder={t('messagingHub.replyTo', 'Répondre à {{name}}…', { name: counterpartName })}
        composeExtra={
          attachments.length > 0 ? (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, pb: 1 }}>
              {attachments.map((file, idx) => (
                <Chip
                  key={`${file.name}-${idx}`}
                  label={file.name}
                  size="small"
                  onDelete={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                  sx={{ fontSize: '11px', height: 22 }}
                />
              ))}
            </Box>
          ) : undefined
        }
        composeTools={
          <>
            <Tooltip title={t('messagingHub.attachFile', 'Joindre un fichier')} arrow>
              <Box
                component="button"
                onClick={() => fileInputRef.current?.click()}
                aria-label={t('messagingHub.attachFile', 'Joindre un fichier')}
                sx={composeToolSx}
              >
                <AttachFileIcon size={15} strokeWidth={1.75} />
              </Box>
            </Tooltip>
            {lastInbound && (
              <Tooltip
                title={
                  aiSuggestMutation.isError
                    ? t('messagingHub.aiUnavailable', 'Suggestion IA indisponible')
                    : t('messagingHub.aiSuggest', 'Suggérer une réponse (IA)')
                }
                arrow
              >
                <Box
                  component="button"
                  onClick={handleAiSuggest}
                  disabled={aiSuggestMutation.isPending}
                  aria-label={t('messagingHub.aiSuggest', 'Suggérer une réponse (IA)')}
                  sx={composeToolSx}
                >
                  <SparklesIcon size={15} strokeWidth={1.75} />
                </Box>
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
