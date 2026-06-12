import React, { useMemo, useState } from 'react';
import { Box, useMediaQuery, useTheme } from '@mui/material';
import { Forum as ForumIcon } from '../../../icons';
import EmptyState from '../../../components/EmptyState';
import { useAuth } from '../../../hooks/useAuth';
import { useTranslation } from '../../../hooks/useTranslation';
import { useMarkAsRead, useUpdateConversationStatus } from '../../../hooks/useConversations';
import { useArchiveThread, useMarkThreadAsRead } from '../../../hooks/useContactMessages';
import { useUnifiedInbox, type UnifiedConversation } from '../conversations/unified';
import ConversationList from '../conversations/ConversationList';
import ChannelThread from '../conversations/ChannelThread';
import InternalThread from '../conversations/InternalThread';

/**
 * Volet « Messagerie » du hub : conversations unifiées « tout dans un seul
 * chat » (threads internes + WhatsApp / Email / OTA) en master-detail 3 volets
 * — liste 340px, fil, compose (référence .mg-*).
 */
export default function ConversationsPane() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Mêmes droits que l'inbox canal existante (Contact > Messagerie OTA).
  const canAccessChannels =
    user?.roles?.some((r) => ['SUPER_ADMIN', 'SUPER_MANAGER', 'HOST'].includes(r)) ?? false;

  const { items, isLoading, error } = useUnifiedInbox(canAccessChannels);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  // La sélection reste résolue depuis la liste : un archivage la retire naturellement.
  const selected = useMemo(
    () => items.find((item) => item.key === selectedKey) ?? null,
    [items, selectedKey],
  );

  const markAsReadMutation = useMarkAsRead();
  const markThreadAsReadMutation = useMarkThreadAsRead();
  const updateStatusMutation = useUpdateConversationStatus();
  const archiveThreadMutation = useArchiveThread();

  const handleSelect = (item: UnifiedConversation) => {
    setSelectedKey(item.key);
    if (item.unreadCount === 0) return;
    if (item.kind === 'channel' && item.conv) markAsReadMutation.mutate(item.conv.id);
    if (item.kind === 'internal' && item.thread) {
      markThreadAsReadMutation.mutate(item.thread.counterpartKeycloakId);
    }
  };

  // Archivage branché sur les API existantes : status ARCHIVED (canal) /
  // archive du thread (interne).
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
  };

  return (
    <Box sx={{ display: 'flex', height: '100%', width: '100%', minHeight: 0, overflow: 'hidden' }}>
      {/* ── Liste (340px, plein écran en mobile) ───────────────────────────── */}
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
          items={items}
          isLoading={isLoading}
          error={error}
          selectedKey={selectedKey}
          onSelect={handleSelect}
          onArchive={handleArchive}
        />
      </Box>

      {/* ── Fil (ou état vide) ─────────────────────────────────────────────── */}
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
        ) : (
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3, bgcolor: 'var(--bg)' }}>
            <EmptyState
              variant="transparent"
              icon={<ForumIcon />}
              title={t('messagingHub.selectConversation', 'Sélectionnez une conversation')}
              description={t(
                'messagingHub.selectConversationHint',
                'Choisissez un échange à gauche pour afficher les messages et répondre.',
              )}
            />
          </Box>
        )}
      </Box>
    </Box>
  );
}
