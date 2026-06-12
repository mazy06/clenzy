import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Tooltip } from '@mui/material';
import {
  Archive as ArchiveIcon,
  AutoAwesome as SparklesIcon,
  Description as TemplateIcon,
  Link as LinkIcon,
  Person as PersonIcon,
} from '../../../icons';
import { useTranslation } from '../../../hooks/useTranslation';
import {
  useConversationMessages,
  useSendMessage,
  useSendTemplate,
  useUpdateConversationStatus,
} from '../../../hooks/useConversations';
import { useAiSuggestResponse } from '../../../hooks/useAi';
import type { ConversationDto } from '../../../services/api/conversationApi';
import AttachReservationDialog from '../../channels/AttachReservationDialog';
import SendWhatsAppTemplateDialog from '../../channels/SendWhatsAppTemplateDialog';
import GuestProfileDialog from '../../channels/GuestProfileDialog';
import ThreadView, { composeToolSx, type ThreadAction } from './ThreadView';
import { type ThreadMessage, getChannelBadge } from './unified';

interface ChannelThreadProps {
  conv: ConversationDto;
  /** Appelé après archivage (désélection côté parent). */
  onArchived: () => void;
  showBack?: boolean;
  onBack?: () => void;
}

/**
 * Fil d'une conversation canal (WhatsApp / Email / OTA) — réutilise les hooks
 * de l'inbox unifiée existante (conversationApi) : messages, réponse libre,
 * fenêtre WhatsApp 24h + templates, rattachement réservation, archivage.
 */
export default function ChannelThread({ conv, onArchived, showBack, onBack }: ChannelThreadProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');
  const [attachOpen, setAttachOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [guestOpen, setGuestOpen] = useState(false);

  const { data: messagesData, isLoading } = useConversationMessages(conv.id);
  const sendMessageMutation = useSendMessage();
  const updateStatusMutation = useUpdateConversationStatus();
  const sendTemplateMutation = useSendTemplate();
  const aiSuggestMutation = useAiSuggestResponse();

  // Reset du brouillon au changement de conversation.
  useEffect(() => {
    setDraft('');
  }, [conv.id]);

  const messages: ThreadMessage[] = useMemo(
    () =>
      (messagesData?.content ?? []).map((msg) => ({
        id: msg.id,
        out: msg.direction === 'OUTBOUND',
        text: msg.content,
        at: msg.sentAt,
        sender: msg.senderName,
      })),
    [messagesData],
  );

  // Fenêtre de service WhatsApp 24h : au-delà de 24h après le dernier message
  // ENTRANT, Meta interdit la réponse libre (template approuvé requis).
  const whatsappWindowExpired = useMemo(() => {
    if (conv.channel !== 'WHATSAPP') return false;
    let lastInboundMs = 0;
    for (const msg of messages) {
      if (!msg.out) {
        const ms = new Date(msg.at).getTime();
        if (ms > lastInboundMs) lastInboundMs = ms;
      }
    }
    if (lastInboundMs === 0) return true;
    return Date.now() - lastInboundMs > 24 * 60 * 60 * 1000;
  }, [conv.channel, messages]);

  const lastInbound = useMemo(() => [...messages].reverse().find((msg) => !msg.out), [messages]);

  const handleSend = () => {
    sendMessageMutation.mutate(
      { conversationId: conv.id, content: draft.trim() },
      { onSuccess: () => setDraft('') },
    );
  };

  const handleArchive = () => {
    updateStatusMutation.mutate(
      { conversationId: conv.id, status: 'ARCHIVED' },
      { onSuccess: onArchived },
    );
  };

  const handleAiSuggest = () => {
    if (!lastInbound) return;
    aiSuggestMutation.mutate(
      {
        message: lastInbound.text,
        context: conv.propertyName ? `Logement : ${conv.propertyName}` : undefined,
      },
      { onSuccess: (result) => setDraft(result.response) },
    );
  };

  const badge = getChannelBadge(conv.channel);
  const actions: ThreadAction[] = [];
  if (conv.guestId != null) {
    actions.push({
      key: 'guest',
      title: t('messagingHub.guestProfile', 'Fiche voyageur'),
      icon: <PersonIcon size={16} strokeWidth={1.75} />,
      onClick: () => setGuestOpen(true),
    });
  }
  if (!conv.reservationId) {
    actions.push({
      key: 'attach',
      title: t('messagingHub.attachReservation', 'Rattacher à une réservation'),
      icon: <LinkIcon size={16} strokeWidth={1.75} />,
      onClick: () => setAttachOpen(true),
    });
  } else {
    actions.push({
      key: 'template',
      title: t('messagingHub.sendTemplate', 'Envoyer un template WhatsApp'),
      icon: <TemplateIcon size={16} strokeWidth={1.75} />,
      onClick: () => setTemplateOpen(true),
    });
  }

  return (
    <>
      <AttachReservationDialog
        open={attachOpen}
        conversation={conv}
        onClose={() => setAttachOpen(false)}
        onAttached={() => setAttachOpen(false)}
      />
      <SendWhatsAppTemplateDialog
        open={templateOpen}
        onClose={() => setTemplateOpen(false)}
        onSend={(key) =>
          sendTemplateMutation.mutate(
            { conversationId: conv.id, templateKey: key },
            { onSuccess: () => setTemplateOpen(false) },
          )
        }
        sending={sendTemplateMutation.isPending}
        error={sendTemplateMutation.isError}
      />
      <GuestProfileDialog guestId={conv.guestId} open={guestOpen} onClose={() => setGuestOpen(false)} />
      <ThreadView
        title={conv.guestName || badge.label}
        subtitle={
          <>
            <Box component="span" sx={{ display: 'inline-flex', color: badge.color }}>
              <badge.Icon size={13} strokeWidth={2} />
            </Box>
            {badge.label}
            {conv.propertyName ? ` · ${conv.propertyName}` : ''}
          </>
        }
        actions={actions}
        menuItems={[
          {
            key: 'archive',
            label: t('messagingHub.archive', 'Archiver'),
            icon: <ArchiveIcon size={15} strokeWidth={1.75} />,
            onClick: handleArchive,
            disabled: updateStatusMutation.isPending,
          },
        ]}
        messages={messages}
        loading={isLoading}
        draft={draft}
        onDraftChange={setDraft}
        onSend={handleSend}
        sending={sendMessageMutation.isPending}
        composePlaceholder={
          whatsappWindowExpired
            ? t('messagingHub.whatsappWindowPlaceholder', 'Réponse libre indisponible (template requis)')
            : t('messagingHub.replyTo', 'Répondre à {{name}}…', { name: conv.guestName || badge.label })
        }
        composeDisabled={whatsappWindowExpired}
        composeNotice={
          whatsappWindowExpired ? (
            <Alert
              severity="warning"
              sx={{ borderRadius: 0, fontSize: '0.72rem', py: 0.25, alignItems: 'center' }}
              action={
                conv.reservationId ? (
                  <Button
                    color="inherit"
                    size="small"
                    onClick={() => setTemplateOpen(true)}
                    sx={{ textTransform: 'none', fontWeight: 600 }}
                  >
                    {t('messagingHub.sendTemplateShort', 'Envoyer un template')}
                  </Button>
                ) : undefined
              }
            >
              {t(
                'messagingHub.whatsappWindowExpired',
                'Fenêtre de 24h dépassée — un template est requis pour relancer ce voyageur.',
              )}
            </Alert>
          ) : undefined
        }
        composeTools={
          lastInbound && !whatsappWindowExpired ? (
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
          ) : undefined
        }
        showBack={showBack}
        onBack={onBack}
      />
    </>
  );
}
