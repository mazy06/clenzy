import React, { useMemo, useState } from 'react';
import {
  Alert,
  AlertAction,
  AlertDescription,
  Badge,
  Button,
  Sheet,
  SheetContent,
  SheetTitle,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../../components/ui';
import { Archive, FileText, Languages, Link, Sparkles, TriangleAlert, User } from '../../../icons/glyphs';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../../hooks/useTranslation';
import {
  useConversationAnalysis,
  useConversationMessages,
  useDismissAiDraft,
  useSendAiDraft,
  useSendMessage,
  useSendTemplate,
  useSuggestReply,
  useTranslateLastInbound,
  useUpdateConversationStatus,
} from '../../../hooks/useConversations';
import type { AiReplySuggestion, ConversationDto } from '../../../services/api/conversationApi';
import { activeIntlLocale } from '../../../utils/activeLocale';
import { cn } from '../../../utils/cn';
import AttachReservationDialog from '../../channels/AttachReservationDialog';
import SendWhatsAppTemplateDialog from '../../channels/SendWhatsAppTemplateDialog';
import GuestProfileDialog from '../../channels/GuestProfileDialog';
import ThreadView, { type ThreadAction } from './ThreadView';
import { type ThreadMessage } from './unified';
import ChannelMark, { channelLabel } from './ChannelMark';
import ConversationAvatar from './ConversationAvatar';
import ContextPanel from './ContextPanel';
import { AiDraftCard, AiDraftError, AiDraftSkeleton, AttentionBadges, CopilotBar } from './AiCopilot';
import { stayInfo } from './messagingModel';
import { useElementWidth } from './useElementWidth';

/** Date de séjour au format court « ven. 25 juil. » (locale de l'interface). */
function formatStayDate(date: Date): string {
  return date.toLocaleDateString(activeIntlLocale(), { weekday: 'short', day: 'numeric', month: 'short' });
}

/** Place minimale du poste de travail pour afficher le contexte en permanence. */
const INLINE_CONTEXT_MIN_WIDTH = 1000;

interface ChannelThreadProps {
  conv: ConversationDto;
  /** Appelé après archivage (désélection côté parent). */
  onArchived: () => void;
  showBack?: boolean;
  onBack?: () => void;
}

/**
 * Poste de travail d'une conversation voyageur (WhatsApp / Email / SMS / OTA) :
 * le fil et sa composition, le copilote IA, et le panneau de contexte
 * (séjour, voyageur, lecture de l'IA).
 *
 * <p>Réutilise les hooks de l'inbox unifiée : messages, réponse libre, fenêtre
 * WhatsApp 24h + templates, rattachement réservation, archivage. Le panneau de
 * contexte reste affiché quand la place le permet ; sinon il s'ouvre en tiroir.
 * Ce composant est monté avec {@code key = conv.id} : tout l'état local
 * (brouillon, suggestion, traduction) repart à zéro d'une conversation à
 * l'autre.</p>
 */
export default function ChannelThread({ conv, onArchived, showBack, onBack }: ChannelThreadProps) {
  const { t, currentLanguage } = useTranslation();
  const navigate = useNavigate();
  const [draft, setDraft] = useState('');
  const [attachOpen, setAttachOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [guestOpen, setGuestOpen] = useState(false);
  const [internalNote, setInternalNote] = useState(false);
  const [contextChoice, setContextChoice] = useState<boolean | null>(null);
  const [suggestion, setSuggestion] = useState<AiReplySuggestion | null>(null);
  const [suggestionFailed, setSuggestionFailed] = useState(false);
  const [translation, setTranslation] = useState<{ text: string } | 'error' | null>(null);

  const [workspaceRef, workspaceWidth] = useElementWidth<HTMLDivElement>();
  const inlineContext = workspaceWidth >= INLINE_CONTEXT_MIN_WIDTH;
  const contextOpen = contextChoice ?? inlineContext;

  const { data: messagesData, isLoading } = useConversationMessages(conv.id);
  const sendMessageMutation = useSendMessage();
  const updateStatusMutation = useUpdateConversationStatus();
  const sendTemplateMutation = useSendTemplate();
  const suggestMutation = useSuggestReply();
  const translateMutation = useTranslateLastInbound();
  const sendAiDraftMutation = useSendAiDraft();
  const dismissAiDraftMutation = useDismissAiDraft();

  const messages: ThreadMessage[] = useMemo(
    () =>
      (messagesData?.content ?? []).map((msg) => ({
        id: msg.id,
        out: msg.direction === 'OUTBOUND',
        text: msg.content,
        at: msg.sentAt,
        sender: msg.senderName,
        internalNote: msg.internalNote,
        delivery: msg.deliveryStatus,
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
  const { data: analysis } = useConversationAnalysis(conv.id, conv.lastMessageAt, lastInbound != null);

  // ─── Copilote IA ─────────────────────────────────────────────────────────

  const handleSuggest = () => {
    setSuggestionFailed(false);
    suggestMutation.mutate(conv.id, {
      onSuccess: (result) => setSuggestion(result),
      onError: () => {
        setSuggestion(null);
        setSuggestionFailed(true);
      },
    });
  };

  const handleUseDraft = (text: string) => {
    setDraft(text);
    setSuggestion(null);
  };

  const handleTranslate = () => {
    if (translation) {
      setTranslation(null);
      return;
    }
    translateMutation.mutate(
      { conversationId: conv.id, target: currentLanguage },
      {
        onSuccess: (result) => setTranslation({ text: result.translatedText }),
        onError: () => setTranslation('error'),
      },
    );
  };

  // Concierge IA : brouillon pré-rédigé, à valider (jamais envoyé automatiquement
  // quand l'autonomie est en mode « Suggère »).
  const conciergeDraft = conv.aiDraftReply;
  const handleEditConciergeDraft = (text: string) => {
    setDraft(text);
    dismissAiDraftMutation.mutate(conv.id);
  };

  const translationBlock = useMemo(() => {
    if (!translation || !lastInbound) return undefined;
    const same = translation !== 'error' && translation.text.trim() === lastInbound.text.trim();
    return (
      <div className="mt-1 max-w-full rounded-xl border border-dashed border-border bg-card/70 px-3 py-2 text-xs text-muted-foreground">
        <span className="mb-0.5 flex items-center gap-1 text-2xs font-semibold tracking-wide uppercase">
          <Languages className="size-3" aria-hidden />
          {t('messagingHub.ai.translationOf', 'Traduction · {{lang}}', { lang: currentLanguage.toUpperCase() })}
        </span>
        <span dir="auto" className="whitespace-pre-wrap text-foreground">
          {translation === 'error'
            ? t('messagingHub.ai.translationFailed', 'Traduction indisponible pour le moment.')
            : same
              ? t('messagingHub.ai.translationSame', 'Le message est déjà dans votre langue.')
              : translation.text}
        </span>
      </div>
    );
  }, [translation, lastInbound, currentLanguage, t]);

  const threadMessages = useMemo(
    () => messages.map((msg) => (translationBlock && lastInbound && msg.id === lastInbound.id ? { ...msg, extra: translationBlock } : msg)),
    [messages, translationBlock, lastInbound],
  );

  // ─── Envoi ───────────────────────────────────────────────────────────────

  const handleSend = () => {
    sendMessageMutation.mutate(
      { conversationId: conv.id, content: draft.trim(), internalNote },
      {
        onSuccess: () => {
          setDraft('');
          // La bascule NE se réarme pas : laisser « note interne » actif après
          // envoi ferait passer la réponse suivante pour une note, et le
          // voyageur ne la recevrait jamais sans que personne s'en aperçoive.
          setInternalNote(false);
        },
      },
    );
  };

  const handleArchive = () => {
    updateStatusMutation.mutate({ conversationId: conv.id, status: 'ARCHIVED' }, { onSuccess: onArchived });
  };

  const channelName = channelLabel(conv.channel);
  const stay = useMemo(() => stayInfo(conv), [conv]);
  const viewReservation = conv.reservationId
    // Il n'existe pas de route /reservations/:id : la liste porte le surlignage
    // par ?highlight=, c'est donc le lien profond réel.
    ? () => navigate(`/reservations?highlight=${conv.reservationId}`)
    : undefined;

  const actions: ThreadAction[] = [];
  if (conv.reservationId && conv.channel === 'WHATSAPP') {
    actions.push({
      key: 'template',
      title: t('messagingHub.sendTemplate', 'Envoyer un template WhatsApp'),
      icon: <FileText className="size-4" aria-hidden />,
      onClick: () => setTemplateOpen(true),
    });
  }
  if (!conv.reservationId) {
    actions.push({
      key: 'attach',
      title: t('messagingHub.attachReservation', 'Rattacher à une réservation'),
      icon: <Link className="size-4" aria-hidden />,
      onClick: () => setAttachOpen(true),
    });
  }
  if (conv.guestId != null) {
    actions.push({
      key: 'guest',
      title: t('messagingHub.guestProfile', 'Fiche voyageur'),
      icon: <User className="size-4" aria-hidden />,
      onClick: () => setGuestOpen(true),
    });
  }

  const stayBadge = stay ? (
    <Badge variant={stay.key === 'current' ? 'success' : stay.key === 'upcoming' ? 'info' : 'secondary'}>
      {stay.key === 'current'
        ? t('messagingHub.stayCurrent', 'Séjour en cours')
        : stay.key === 'upcoming'
          ? t('messagingHub.stayUpcoming', 'À venir')
          : t('messagingHub.stayPast', 'Séjour terminé')}
    </Badge>
  ) : undefined;

  const stayLabel = stay
    ? stay.key === 'upcoming'
      ? t('messagingHub.stayArrival', 'arrivée {{date}}', { date: formatStayDate(stay.highlight) })
      : stay.key === 'current'
        ? t('messagingHub.stayDeparture', 'départ {{date}}', { date: formatStayDate(stay.highlight) })
        : formatStayDate(stay.highlight)
    : '';

  const copilotAvailable = lastInbound != null && !whatsappWindowExpired;
  const conversationName = conv.guestName || channelName;

  const contextPanel = (onClose?: () => void) => (
    <ContextPanel
      conv={conv}
      stay={stay}
      analysis={analysis}
      onOpenGuest={conv.guestId != null ? () => setGuestOpen(true) : undefined}
      onViewReservation={viewReservation}
      onAttach={!conv.reservationId ? () => setAttachOpen(true) : undefined}
      onClose={onClose}
    />
  );

  return (
    <>
      <AttachReservationDialog open={attachOpen} conversation={conv} onClose={() => setAttachOpen(false)} onAttached={() => setAttachOpen(false)} />
      <SendWhatsAppTemplateDialog
        open={templateOpen}
        onClose={() => setTemplateOpen(false)}
        onSend={(key) =>
          sendTemplateMutation.mutate({ conversationId: conv.id, templateKey: key }, { onSuccess: () => setTemplateOpen(false) })
        }
        sending={sendTemplateMutation.isPending}
        error={sendTemplateMutation.isError}
      />
      <GuestProfileDialog guestId={conv.guestId} open={guestOpen} onClose={() => setGuestOpen(false)} />

      <div ref={workspaceRef} className="flex min-h-0 flex-1 gap-3">
        <div className="flex min-w-0 flex-1 flex-col">
          <ThreadView
            title={conversationName}
            avatar={<ConversationAvatar name={conversationName} channel={conv.channel} size={36} />}
            subtitle={
              <>
                <ChannelMark channel={conv.channel} size={14} />
                <span className="truncate">
                  {channelName}
                  {conv.propertyName ? ` · ${conv.propertyName}` : ''}
                  {stayLabel ? ` · ${stayLabel}` : ''}
                </span>
              </>
            }
            statusBadge={
              <>
                {stayBadge}
                <AttentionBadges analysis={analysis} />
              </>
            }
            contextAction={viewReservation ? { label: t('messagingHub.viewReservation', 'Voir la réservation'), onClick: viewReservation } : undefined}
            actions={actions}
            contextToggle={{
              open: contextOpen,
              onToggle: () => setContextChoice(!contextOpen),
              label: contextOpen ? t('messagingHub.context.hide', 'Masquer le contexte') : t('messagingHub.context.show', 'Afficher le contexte'),
            }}
            menuItems={[
              {
                key: 'archive',
                label: t('messagingHub.archive', 'Archiver'),
                icon: <Archive className="size-4" aria-hidden />,
                onClick: handleArchive,
                disabled: updateStatusMutation.isPending,
              },
            ]}
            messages={threadMessages}
            loading={isLoading}
            draft={draft}
            onDraftChange={setDraft}
            onSend={handleSend}
            sending={sendMessageMutation.isPending}
            composePlaceholder={
              whatsappWindowExpired
                ? t('messagingHub.whatsappWindowPlaceholder', 'Réponse libre indisponible (template requis)')
                : t('messagingHub.replyTo', 'Répondre à {{name}}…', { name: conversationName })
            }
            internalNote={internalNote}
            onInternalNoteChange={setInternalNote}
            // La fenêtre WhatsApp de 24 h interdit d'ÉCRIRE AU VOYAGEUR. Une note
            // interne ne lui est pas transmise : elle reste donc permise, et c'est
            // même là qu'elle sert le plus — consigner le contexte quand on ne peut
            // pas répondre.
            composeDisabled={whatsappWindowExpired && !internalNote}
            composeNotice={
              whatsappWindowExpired ? (
                <Alert variant="warning" className="mb-2 items-center py-1 text-2xs">
                  <TriangleAlert />
                  <AlertDescription>
                    {t('messagingHub.whatsappWindowExpired', 'Fenêtre de 24h dépassée — un template est requis pour relancer ce voyageur.')}
                  </AlertDescription>
                  {conv.reservationId && (
                    <AlertAction>
                      {/* Aucune couleur posée : le ghost hérite de la teinte de l'alerte hôte. */}
                      <Button variant="ghost" size="sm" onClick={() => setTemplateOpen(true)}>
                        {t('messagingHub.sendTemplateShort', 'Envoyer un template')}
                      </Button>
                    </AlertAction>
                  )}
                </Alert>
              ) : undefined
            }
            copilot={
              <>
                {conciergeDraft && (
                  <AiDraftCard
                    kind="concierge"
                    text={conciergeDraft}
                    onSend={() => sendAiDraftMutation.mutate(conv.id)}
                    sending={sendAiDraftMutation.isPending}
                    sendDisabled={whatsappWindowExpired}
                    onUse={handleEditConciergeDraft}
                    onDismiss={() => dismissAiDraftMutation.mutate(conv.id)}
                    dismissing={dismissAiDraftMutation.isPending}
                  />
                )}
                {suggestMutation.isPending && <AiDraftSkeleton />}
                {suggestionFailed && !suggestMutation.isPending && (
                  <AiDraftError onRetry={handleSuggest} onDismiss={() => setSuggestionFailed(false)} />
                )}
                {suggestion && !suggestMutation.isPending && (
                  <AiDraftCard
                    kind="suggestion"
                    text={suggestion.response}
                    alternatives={suggestion.alternatives}
                    tone={suggestion.tone}
                    language={suggestion.language}
                    onUse={handleUseDraft}
                    onRegenerate={handleSuggest}
                    onDismiss={() => setSuggestion(null)}
                  />
                )}
                {copilotAvailable && !suggestion && !suggestMutation.isPending && !suggestionFailed && (
                  <CopilotBar
                    onSuggest={handleSuggest}
                    suggesting={suggestMutation.isPending}
                    onTranslate={handleTranslate}
                    translating={translateMutation.isPending}
                    translated={translation != null}
                  />
                )}
              </>
            }
            showBack={showBack}
            onBack={onBack}
          />
        </div>

        {contextOpen && inlineContext && (
          <div className={cn('flex w-[300px] shrink-0 flex-col min-[1500px]:w-[320px]')}>{contextPanel()}</div>
        )}
      </div>

      {!inlineContext && (
        <Sheet open={contextOpen} onOpenChange={(open) => setContextChoice(open)}>
          <SheetContent side="right" className="w-[min(92vw,360px)] gap-0 p-0">
            <SheetTitle className="sr-only">{t('messagingHub.context.title', 'Contexte')}</SheetTitle>
            <div className="flex min-h-0 flex-1 flex-col p-3 pt-10">{contextPanel(() => setContextChoice(false))}</div>
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}
