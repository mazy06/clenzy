import React, { useEffect, useMemo, useState } from 'react';
import { Box, Button, Paper, useMediaQuery, useTheme } from '@mui/material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Edit as EditIcon, Forum as ForumIcon, Message as MessageIcon } from '../../icons';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import { useTranslation } from '../../hooks/useTranslation';
import { useAuth } from '../../hooks/useAuth';
import { useMarkAsRead, useUpdateConversationStatus } from '../../hooks/useConversations';
import { useArchiveThread, useMarkThreadAsRead } from '../../hooks/useContactMessages';
import { useUpdateFormStatus } from '../../hooks/useReceivedForms';
import { useUnifiedInbox, useArchivedInbox, type UnifiedConversation } from './conversations/unified';
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
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const isAdminOrManager =
    user?.roles?.some((r) => ['SUPER_ADMIN', 'SUPER_MANAGER'].includes(r)) ?? false;
  const canAccessChannels =
    user?.roles?.some((r) => ['SUPER_ADMIN', 'SUPER_MANAGER', 'HOST'].includes(r)) ?? false;

  const [filter, setFilter] = useState<InboxFilter>('all');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

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

  const handleSelect = (item: UnifiedConversation) => {
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
  };

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

  return (
    <Box sx={{ width: '100%', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <PageHeader
        title={t('messagingHub.title', 'Messagerie')}
        subtitle={t('messagingHub.subtitle', 'Email · SMS · WhatsApp · Formulaires')}
        iconBadge={<MessageIcon />}
        backPath="/dashboard"
        showBackButton={false}
        actions={
          // Réf .s-btn--p : contour accent (signatureTheme containedPrimary).
          <Button
            variant="contained"
            color="primary"
            startIcon={<EditIcon size={15} strokeWidth={1.75} />}
            onClick={() => navigate('/contact/create')}
          >
            {t('messagingHub.newMessage', 'Nouveau message')}
          </Button>
        }
      />
      <Paper sx={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden', height: '100%' }}>
        {/* ── Liste agrégée (340px, plein écran en mobile) ─────────────────── */}
        <Box
          sx={{
            width: { xs: '100%', md: 340 },
            flexShrink: 0,
            display: { xs: selected ? 'none' : 'flex', md: 'flex' },
            flexDirection: 'column',
            minHeight: 0,
            borderRight: { md: '1px solid var(--line)' },
            bgcolor: 'var(--card)',
          }}
        >
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
        </Box>

        {/* ── Volet droit adaptatif : fil + compose ou détail formulaire ──── */}
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            display: { xs: selected ? 'flex' : 'none', md: 'flex' },
            flexDirection: 'column',
          }}
        >
          {selected?.kind === 'channel' && selected.conv ? (
            <ChannelThread
              conv={selected.conv}
              onArchived={() => setSelectedKey(null)}
              showBack={isMobile}
              onBack={() => setSelectedKey(null)}
            />
          ) : selected?.kind === 'internal' && selected.thread ? (
            <InternalThread
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
            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3, bgcolor: 'var(--bg)' }}>
              <EmptyState
                variant="transparent"
                icon={<ForumIcon />}
                title={t('messagingHub.selectConversation', 'Sélectionnez une conversation')}
                description={t(
                  'messagingHub.selectConversationHint',
                  'Choisissez une conversation ou un formulaire à gauche pour afficher le détail.',
                )}
              />
            </Box>
          )}
        </Box>
      </Paper>
    </Box>
  );
}
