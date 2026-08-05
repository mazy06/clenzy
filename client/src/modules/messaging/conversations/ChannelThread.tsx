import React, { useEffect, useMemo, useState } from 'react';
import { cn } from '../../../utils/cn';
import {
  Alert,
  AlertAction,
  AlertDescription,
  Button,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../../components/ui';
import { TriangleAlert } from 'lucide-react';
import {
  Archive as ArchiveIcon,
  AutoAwesome as SparklesIcon,
  Description as TemplateIcon,
  EventNote as ReservationIcon,
  Link as LinkIcon,
  Person as PersonIcon,
  Send as SendIcon,
} from '../../../icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../../hooks/useTranslation';
import {
  useConversationMessages,
  useDismissAiDraft,
  useSendAiDraft,
  useSendMessage,
  useSendTemplate,
  useUpdateConversationStatus,
} from '../../../hooks/useConversations';
import { useAiSuggestResponse } from '../../../hooks/useAi';
import type { ConversationDto } from '../../../services/api/conversationApi';
import AttachReservationDialog from '../../channels/AttachReservationDialog';
import SendWhatsAppTemplateDialog from '../../channels/SendWhatsAppTemplateDialog';
import GuestProfileDialog from '../../channels/GuestProfileDialog';
import ThreadView, { type ThreadAction } from './ThreadView';
import { type ThreadMessage, getChannelBadge } from './unified';

/** Equivalent classes de `composeToolSx` (meme transcription que InternalThread). */
const COMPOSE_TOOL_CLASS =
  'flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent p-0 text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-primary disabled:cursor-default disabled:opacity-45 motion-reduce:transition-none';

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
  const navigate = useNavigate();
  const [draft, setDraft] = useState('');
  const [attachOpen, setAttachOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [guestOpen, setGuestOpen] = useState(false);

  const { data: messagesData, isLoading } = useConversationMessages(conv.id);
  const sendMessageMutation = useSendMessage();
  const updateStatusMutation = useUpdateConversationStatus();
  const sendTemplateMutation = useSendTemplate();
  const aiSuggestMutation = useAiSuggestResponse();
  const sendAiDraftMutation = useSendAiDraft();
  const dismissAiDraftMutation = useDismissAiDraft();

  // Reset du brouillon au changement de conversation.
  useEffect(() => {
    setDraft('');
  }, [conv.id]);

  // Concierge IA : brouillon de réponse pré-rédigé, à valider par l'opérateur
  // (jamais envoyé automatiquement quand l'autonomie est en mode « Suggère »).
  const aiDraft = conv.aiDraftReply;
  const handleSendDraft = () => sendAiDraftMutation.mutate(conv.id);
  const handleDismissDraft = () => dismissAiDraftMutation.mutate(conv.id);
  const handleEditDraft = () => {
    if (aiDraft) setDraft(aiDraft);
    dismissAiDraftMutation.mutate(conv.id);
  };

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
    // « Voir la réservation » de la projection : le fil connait son sejour,
    // l'entete y mene (surlignage deep-link de la liste des reservations).
    actions.push({
      key: 'reservation',
      title: t('messagingHub.viewReservation', 'Voir la réservation'),
      icon: <ReservationIcon size={16} strokeWidth={1.75} />,
      onClick: () => navigate(`/reservations?highlight=${conv.reservationId}`),
    });
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
            <span className="inline-flex" style={{ color: badge.color }}>
              <badge.Icon size={13} strokeWidth={2} />
            </span>
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
          aiDraft || whatsappWindowExpired ? (
            <>
              {/* Concierge IA : brouillon à valider (C1) — jamais envoyé sans l'opérateur. */}
              {aiDraft && (
                // Carte teintee marque : le brouillon IA doit se distinguer d'un
                // message reellement envoye, sans passer pour une alerte.
                <div className="mb-2 rounded-lg border border-border bg-primary-soft/40 p-2.5">
                  <div className="mb-1 flex items-center gap-1 text-primary">
                    <SparklesIcon size={14} strokeWidth={1.75} />
                    <span className="text-2xs font-semibold uppercase tracking-wide">
                      {t('concierge.draftTitle', 'Brouillon Concierge IA')}
                    </span>
                  </div>
                  <p className="mb-1.5 whitespace-pre-wrap text-xs text-foreground">
                    {aiDraft}
                  </p>
                  <div className="flex gap-1.5">
                    {/* Le brouillon n'a qu'un but : etre envoye. Editer et rejeter
                        sont des sorties de secours -> tertiaires. */}
                    <Button
                      size="sm"
                      onClick={handleSendDraft}
                      disabled={sendAiDraftMutation.isPending || whatsappWindowExpired}
                    >
                      <SendIcon size={14} strokeWidth={1.75} />
                      {t('common.send', 'Envoyer')}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleEditDraft}>
                      {t('common.edit', 'Éditer')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleDismissDraft}
                      disabled={dismissAiDraftMutation.isPending}
                      className="text-muted-foreground"
                    >
                      {t('common.reject', 'Rejeter')}
                    </Button>
                  </div>
                </div>
              )}
              {whatsappWindowExpired && (
                <Alert variant="warning" className="mb-2 items-center py-1 text-2xs">
                  <TriangleAlert />
                  <AlertDescription>
                    {t(
                      'messagingHub.whatsappWindowExpired',
                      'Fenêtre de 24h dépassée — un template est requis pour relancer ce voyageur.',
                    )}
                  </AlertDescription>
                  {conv.reservationId && (
                    <AlertAction>
                      {/* Aucune couleur posee : le ghost herite de la teinte de l'alerte hote. */}
                      <Button variant="ghost" size="sm" onClick={() => setTemplateOpen(true)}>
                        {t('messagingHub.sendTemplateShort', 'Envoyer un template')}
                      </Button>
                    </AlertAction>
                  )}
                </Alert>
              )}
            </>
          ) : undefined
        }
        composeTools={
          lastInbound && !whatsappWindowExpired ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleAiSuggest}
                  disabled={aiSuggestMutation.isPending}
                  aria-label={t('messagingHub.aiSuggest', 'Suggérer une réponse (IA)')}
                  className={COMPOSE_TOOL_CLASS}
                >
                  <SparklesIcon size={15} strokeWidth={1.75} />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                {aiSuggestMutation.isError
                  ? t('messagingHub.aiUnavailable', 'Suggestion IA indisponible')
                  : t('messagingHub.aiSuggest', 'Suggérer une réponse (IA)')}
              </TooltipContent>
            </Tooltip>
          ) : undefined
        }
        showBack={showBack}
        onBack={onBack}
      />
    </>
  );
}
