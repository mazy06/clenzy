import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  Chip,
  IconButton,
  TextField,
  InputAdornment,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  Person as PersonIcon,
  Refresh as RefreshIcon,
  Forum as ForumIcon,
  Search as SearchIcon,
} from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import { useChannelInbox, useMarkAsRead } from '../../hooks/useConversations';
import type { ConversationDto } from '../../services/api/conversationApi';
import FilterChipRow from '../../components/FilterChipRow';
import EmptyState from '../../components/EmptyState';
import InboxListItem from '../../components/InboxListItem';
import { usePageHeaderFilters } from '../../components/PageHeaderActionsContext';
import ConversationDetailPanel from './ConversationDetailPanel';
import {
  getChannelConfig,
  conversationTitle,
  isOtaChannel,
  OTA_CHANNELS,
  OTA_GROUP_COLOR,
  CONTACT_LIST_WIDTH,
  type ChannelFilter,
} from './channelConfig';

// Re-export pour les consommateurs existants (cf. ContactPage).
export { OTA_CHANNELS };

/** Date compacte pour la liste : heure si aujourd'hui, sinon jour/mois. */
function formatListDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

// ─── Élément de liste (colonne de gauche) ────────────────────────────────────

const ConversationListItem: React.FC<{
  conv: ConversationDto;
  active: boolean;
  onClick: () => void;
}> = ({ conv, active, onClick }) => {
  const channelCfg = getChannelConfig(conv.channel);
  return (
    <InboxListItem
      active={active}
      unread={conv.unread}
      onClick={onClick}
      avatar={
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            bgcolor: channelCfg.color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
          }}
        >
          {conv.guestName ? <PersonIcon size={20} strokeWidth={1.75} /> : channelCfg.icon}
        </Box>
      }
      title={conversationTitle(conv)}
      time={conv.lastMessageAt ? formatListDate(conv.lastMessageAt) : undefined}
      meta={
        <>
          <Chip
            label={channelCfg.label}
            size="small"
            sx={{
              fontSize: '0.5rem',
              height: 14,
              fontWeight: 600,
              bgcolor: `${channelCfg.color}18`,
              color: channelCfg.color,
              border: `1px solid ${channelCfg.color}40`,
              flexShrink: 0,
              '& .MuiChip-label': { px: 0.5 },
            }}
          />
          {conv.propertyName && (
            <Typography
              sx={{
                fontSize: '0.625rem',
                color: 'text.secondary',
                fontStyle: 'italic',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {conv.propertyName}
            </Typography>
          )}
        </>
      }
      preview={conv.lastMessagePreview || '—'}
      trailing={conv.unread ? <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'primary.main' }} /> : undefined}
    />
  );
};

// ─── Composant principal : master-detail ─────────────────────────────────────

const ChannelInboxTab: React.FC<{ archivedOnly?: boolean; listHeaderSlot?: React.ReactNode }> = ({ archivedOnly = false, listHeaderSlot }) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>('');
  const [search, setSearch] = useState('');

  const { data: inboxData, isLoading, error, refetch } = useChannelInbox(
    OTA_CHANNELS,
    0,
    20,
    archivedOnly ? 'ARCHIVED' : undefined,
  );
  const conversations = useMemo(() => inboxData?.content ?? [], [inboxData]);

  const whatsappCount = useMemo(
    () => conversations.filter((c) => c.channel === 'WHATSAPP').length,
    [conversations],
  );
  const otaCount = useMemo(
    () => conversations.filter((c) => isOtaChannel(c.channel)).length,
    [conversations],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return conversations.filter((c) => {
      if (channelFilter === 'WHATSAPP' && c.channel !== 'WHATSAPP') return false;
      if (channelFilter === 'OTA' && !isOtaChannel(c.channel)) return false;
      if (!q) return true;
      const haystack = [c.guestName, c.subject, c.propertyName, c.lastMessagePreview]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [conversations, channelFilter, search]);

  // La conversation sélectionnée reste résolvable même si filtrée hors de la liste.
  const selected = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId],
  );

  const markAsReadMutation = useMarkAsRead();

  const handleSelect = (conv: ConversationDto) => {
    setSelectedId(conv.id);
    if (conv.unread && !archivedOnly) markAsReadMutation.mutate(conv.id);
  };

  // Recherche + filtre canal + refresh : portés dans la barre filtres du PageHeader
  // (inline à droite du titre) — pour tous les modes, y compris archivé.
  const filtersNode = (
    <>
      <TextField
        size="small"
        placeholder={t('channelInbox.search', 'Rechercher une conversation…')}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary' }}>
                <SearchIcon size={'1.125rem'} strokeWidth={1.75} />
              </Box>
            </InputAdornment>
          ),
        }}
        sx={{
          width: { xs: 150, sm: 220 },
          '& .MuiOutlinedInput-root': { borderRadius: '8px', fontSize: '0.8125rem' },
        }}
      />
      <FilterChipRow<'WHATSAPP' | 'OTA'>
        options={[
          { value: 'WHATSAPP', label: 'WhatsApp', color: getChannelConfig('WHATSAPP').color, count: whatsappCount },
          { value: 'OTA', label: 'OTA', color: OTA_GROUP_COLOR, count: otaCount },
        ]}
        value={channelFilter}
        onChange={(v) => setChannelFilter(v as ChannelFilter)}
        allLabel="Tous"
        allCount={conversations.length}
        size="compact"
      />
      <IconButton size="small" onClick={() => refetch()} title={t('common.refresh')} aria-label={t('common.refresh')}>
        <RefreshIcon size={'1rem'} strokeWidth={1.75} />
      </IconButton>
    </>
  );

  const headerFilters = usePageHeaderFilters(filtersNode);

  return (
    <>
      {headerFilters}
      <Box sx={{ display: 'flex', height: '100%', width: '100%', minHeight: 0, overflow: 'hidden' }}>
        {/* ── Colonne gauche : liste (filtres internes seulement en mode archivé) ── */}
        <Box
          sx={{
            width: CONTACT_LIST_WIDTH,
            flexShrink: 0,
            display: { xs: selected ? 'none' : 'flex', md: 'flex' },
            flexDirection: 'column',
            minHeight: 0,
            borderRight: { md: '1px solid' },
            borderColor: { md: 'divider' },
          }}
        >
          {listHeaderSlot}
          <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
            {isLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress size={22} />
              </Box>
            ) : error ? (
              <Alert severity="error" sx={{ m: 1.5, fontSize: '0.8125rem' }}>
                {t('channelInbox.errorLoading')}
              </Alert>
            ) : filtered.length === 0 ? (
              <Box sx={{ px: 2, py: 4, textAlign: 'center' }}>
                <Typography sx={{ fontSize: '0.8125rem', color: 'text.secondary' }}>
                  {search.trim()
                    ? t('channelInbox.noSearchResults', 'Aucun résultat')
                    : archivedOnly
                      ? 'Aucune conversation archivée'
                      : t('channelInbox.noConversations')}
                </Typography>
                {!archivedOnly && !search.trim() && channelFilter === '' && (
                  <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mt: 0.5 }}>
                    {t('channelInbox.noConversationsHint')}
                  </Typography>
                )}
              </Box>
            ) : (
              filtered.map((conv) => (
                <ConversationListItem
                  key={conv.id}
                  conv={conv}
                  active={conv.id === selectedId}
                  onClick={() => handleSelect(conv)}
                />
              ))
            )}
          </Box>
        </Box>

        {/* ── Colonne droite : détail inline (ou état vide) ───────────────────── */}
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            display: { xs: selected ? 'flex' : 'none', md: 'flex' },
            flexDirection: 'column',
          }}
        >
          {selected ? (
            <ConversationDetailPanel
              conversation={selected}
              archivedOnly={archivedOnly}
              showClose={isMobile}
              onClose={() => setSelectedId(null)}
              onStatusChanged={() => setSelectedId(null)}
            />
          ) : (
            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
              <EmptyState
                variant="transparent"
                icon={<ForumIcon />}
                title={t('channelInbox.selectConversation', 'Sélectionnez une conversation')}
                description={t(
                  'channelInbox.selectConversationHint',
                  'Choisissez un échange à gauche pour afficher les messages et répondre.',
                )}
              />
            </Box>
          )}
        </Box>
      </Box>
    </>
  );
};

export default ChannelInboxTab;
