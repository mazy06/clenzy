import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '../../utils/cn';
import { Button } from '../../components/ui';
import { useIsMobile } from '../../hooks/use-mobile';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Edit as EditIcon, Forum as ForumIcon, Message as MessageIcon } from '../../icons';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import { useTranslation } from '../../hooks/useTranslation';
import { useHighlightParam, useHighlightTarget } from '../../hooks/useHighlight';
import { useAuth } from '../../hooks/useAuth';
import { useMarkAsRead, useUpdateConversationStatus } from '../../hooks/useConversations';
import { useArchiveThread, useMarkThreadAsRead } from '../../hooks/useContactMessages';
import { useUpdateFormStatus } from '../../hooks/useReceivedForms';
import { useUnifiedInbox, useArchivedInbox, conversationRawId, type UnifiedConversation } from './conversations/unified';
import ConversationList, { type InboxFilter } from './conversations/ConversationList';
import ChannelThread from './conversations/ChannelThread';
import InternalThread from './conversations/InternalThread';
import FormDetailPanel from './received-forms/FormDetailPanel';

/**
 * Anciennes clés d'onglets (?tab= de /contact et du hub) → filtre de la vue
 * unique (compat bookmarks). Les clés « conversations » retombent sur la vue
 * par défaut (le paramètre est simplement retiré).
 */
const LEGACY_TAB_FILTERS: Record<string, InboxFilter> = {
  'received-forms': 'forms',
  formulaires: 'forms',
  archived: 'archived',
  archives: 'archived',
};

/**
 * Écran Messagerie unifié — UN SEUL visuel 3 volets (référence .mg- / .fr-) :
 * la liste de gauche agrège TOUS les flux (chat interne, conversations canal
 * Email / SMS / WhatsApp, conversations OTA, formulaires reçus), différenciés
 * par la pastille de flux (.mg-chn) et triés par dernière activité. Le volet
 * droit s'adapte à la sélection : fil + compose (conversations) ou détail
 * .fr-* (formulaires). Monté sur la route /contact.
 */
export default function MessagingHubPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  // Palier 900 : c'est le `md` de MUI (et non le 768 de Tailwind), donc le meme
  // seuil que les classes `min-[900px]:` qui basculent la mise en page en dessous.
  const isMobile = useIsMobile(900);

  const isAdminOrManager =
    user?.roles?.some((r) => ['SUPER_ADMIN', 'SUPER_MANAGER'].includes(r)) ?? false;
  const canAccessChannels =
    user?.roles?.some((r) => ['SUPER_ADMIN', 'SUPER_MANAGER', 'HOST'].includes(r)) ?? false;

  const [filter, setFilter] = useState<InboxFilter>('all');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  // Deep-link notification (?highlight=<messageId>) : ouvre + surligne la conversation/formulaire.
  const highlightId = useHighlightParam();
  const highlightApplied = useRef(false);

  // Compat : les anciens ?tab= sélectionnent le filtre correspondant de la
  // vue unique, puis le paramètre est retiré de l'URL.
  useEffect(() => {
    const raw = searchParams.get('tab');
    if (raw == null) return;
    const mapped = LEGACY_TAB_FILTERS[raw];
    if (mapped && (mapped !== 'forms' || isAdminOrManager)) setFilter(mapped);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('tab');
        return next;
      },
      { replace: true },
    );
  }, [searchParams, setSearchParams, isAdminOrManager]);

  const isArchivedView = filter === 'archived';
  const inbox = useUnifiedInbox(canAccessChannels, isAdminOrManager);
  const archived = useArchivedInbox(isArchivedView, isAdminOrManager);
  const source = isArchivedView ? archived : inbox;

  // La sélection reste résolue depuis la liste active : un archivage (ou un
  // changement de filtre qui sort l'élément de la source) la retire.
  const selected = useMemo(
    () => source.items.find((item) => item.key === selectedKey) ?? null,
    [source.items, selectedKey],
  );

  const markAsReadMutation = useMarkAsRead();
  const markThreadAsReadMutation = useMarkThreadAsRead();
  const updateStatusMutation = useUpdateConversationStatus();
  const archiveThreadMutation = useArchiveThread();
  const updateFormStatusMutation = useUpdateFormStatus();

  const handleSelect = useCallback((item: UnifiedConversation) => {
    setSelectedKey(item.key);
    if (item.unreadCount === 0) return;
    if (item.kind === 'channel' && item.conv) markAsReadMutation.mutate(item.conv.id);
    if (item.kind === 'internal' && item.thread) {
      markThreadAsReadMutation.mutate(item.thread.counterpartKeycloakId);
    }
    // Formulaire : seul un clic utilisateur déclenche NEW → READ.
    if (item.kind === 'form' && item.form?.status === 'NEW') {
      updateFormStatusMutation.mutate({ id: item.form.id, status: 'READ' });
    }
    // .mutate est une reference stable (react-query v5) -> handleSelect stable.
  }, [markAsReadMutation.mutate, markThreadAsReadMutation.mutate, updateFormStatusMutation.mutate]);

  // Resout le deep-link une fois la liste chargee : selectionne l'element cible
  // (ouvre le volet droit + marque comme lu) puis laisse useHighlightTarget le flasher.
  useEffect(() => {
    if (!highlightId || source.isLoading || highlightApplied.current) return;
    const target = source.items.find(
      (item) => conversationRawId(item) === highlightId || item.key === highlightId,
    );
    if (!target) return;
    highlightApplied.current = true;
    handleSelect(target);
    // One-shot via highlightApplied.current : re-runs = no-op.
  }, [highlightId, source.isLoading, source.items, handleSelect]);

  useHighlightTarget(highlightId, !source.isLoading && source.items.length > 0);

  // Archivage branché sur les API existantes : status ARCHIVED (canal /
  // formulaire), archive du thread (interne).
  const handleArchive = (item: UnifiedConversation) => {
    const deselectIfCurrent = () => {
      if (item.key === selectedKey) setSelectedKey(null);
    };
    if (item.kind === 'channel' && item.conv) {
      updateStatusMutation.mutate(
        { conversationId: item.conv.id, status: 'ARCHIVED' },
        { onSuccess: deselectIfCurrent },
      );
    }
    if (item.kind === 'internal' && item.thread) {
      archiveThreadMutation.mutate(item.thread.counterpartKeycloakId, {
        onSuccess: deselectIfCurrent,
      });
    }
    if (item.kind === 'form' && item.form) {
      updateFormStatusMutation.mutate(
        { id: item.form.id, status: 'ARCHIVED' },
        { onSuccess: deselectIfCurrent },
      );
    }
  };

  // Vue Archivés : Rouvrir (conversation → OPEN) / Restaurer (formulaire → READ).
  const handleRestore = (item: UnifiedConversation) => {
    const deselectIfCurrent = () => {
      if (item.key === selectedKey) setSelectedKey(null);
    };
    if (item.kind === 'channel' && item.conv) {
      updateStatusMutation.mutate(
        { conversationId: item.conv.id, status: 'OPEN' },
        { onSuccess: deselectIfCurrent },
      );
    }
    if (item.kind === 'form' && item.form) {
      updateFormStatusMutation.mutate(
        { id: item.form.id, status: 'READ' },
        { onSuccess: deselectIfCurrent },
      );
    }
  };

  // Sous-titre vivant : ce que contient la boîte, pas la liste des canaux —
  // « Email · SMS · WhatsApp · Formulaires » se relisait à chaque visite sans
  // jamais rien apprendre, alors que le nombre de non-lus, si.
  const unreadCount = useMemo(
    () => source.items.reduce((total, item) => total + (item.unreadCount > 0 ? 1 : 0), 0),
    [source.items],
  );
  const subtitle = source.isLoading
    ? t('messagingHub.loading')
    : `${t('messagingHub.conversationCount', { count: source.items.length })} · ${t('messagingHub.unreadCount', { count: unreadCount })}`;

  return (
    <div className="w-full flex-1 min-h-0 flex flex-col overflow-hidden">
      <PageHeader
        title={t('messagingHub.title', 'Messagerie')}
        subtitle={subtitle}
        iconBadge={<MessageIcon />}
        backPath="/dashboard"
        showBackButton={false}
        actions={
          // Action principale de l'ecran : encre pleine du kit.
          <Button onClick={() => navigate('/contact/create')}>
            <EditIcon size={15} strokeWidth={1.75} />
            {t('messagingHub.newMessage', 'Nouveau message')}
          </Button>
        }
      />

      {/* Deux CARTES distinctes plutot qu'une carte scindee par un filet : la
          liste et le fil sont deux objets, la projection les separe par une
          gouttiere. Le seuil 900 px est le `md` de MUI, celui du reste de
          l'ecran (master-detail mobile). */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 min-[900px]:grid-cols-[300px_1fr]">
        <div className={cn('min-h-0 min-[900px]:flex min-[900px]:flex-col', selected ? 'hidden' : 'flex flex-col')}>
          <ConversationList
            items={source.items}
            isLoading={source.isLoading}
            error={source.error}
            filter={filter}
            onFilterChange={setFilter}
            showFormsFilter={isAdminOrManager}
            selectedKey={selectedKey}
            onSelect={handleSelect}
            onArchive={handleArchive}
            onRestore={handleRestore}
          />
        </div>

        {/* ── Volet droit adaptatif : fil + compose ou détail formulaire ──── */}
        <div className={cn('min-w-0 min-h-0 min-[900px]:flex min-[900px]:flex-col', selected ? 'flex flex-col' : 'hidden')}>
          {selected?.kind === 'channel' && selected.conv ? (
            <ChannelThread
              conv={selected.conv}
              onArchived={() => setSelectedKey(null)}
              showBack={isMobile}
              onBack={() => setSelectedKey(null)}
            />
          ) : selected?.kind === 'internal' && selected.thread ? (
            <InternalThread
              // key = correspondant : remount au changement de thread (etat frais
              // draft/attachments) — remplace l'ancien effet de reset interne.
              key={selected.thread.counterpartKeycloakId}
              thread={selected.thread}
              onArchived={() => setSelectedKey(null)}
              showBack={isMobile}
              onBack={() => setSelectedKey(null)}
            />
          ) : selected?.kind === 'form' && selected.form ? (
            <FormDetailPanel
              form={selected.form}
              showBack={isMobile}
              onBack={() => setSelectedKey(null)}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center rounded-xl border border-border bg-card p-4">
              <EmptyState
                variant="transparent"
                icon={<ForumIcon />}
                title={t('messagingHub.selectConversation', 'Sélectionnez une conversation')}
                description={t(
                  'messagingHub.selectConversationHint',
                  'Choisissez une conversation ou un formulaire à gauche pour afficher le détail.',
                )}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
