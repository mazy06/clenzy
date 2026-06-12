import React, { useMemo, useState } from 'react';
import { Box, CircularProgress, InputBase, Tooltip, Typography, Alert } from '@mui/material';
import { Search as SearchIcon, Archive as ArchiveIcon } from '../../../icons';
import { useTranslation } from '../../../hooks/useTranslation';
import {
  type UnifiedConversation,
  getChannelBadge,
  avatarColor,
  initials,
  formatConvTime,
} from './unified';

type SubTab = 'all' | 'unread' | 'guests';

interface ConversationListProps {
  items: UnifiedConversation[];
  isLoading: boolean;
  error?: unknown;
  selectedKey: string | null;
  onSelect: (item: UnifiedConversation) => void;
  onArchive: (item: UnifiedConversation) => void;
}

/** Élément .mg-conv : avatar 44 r13 + pastille canal 18px, nom/heure/propriété/aperçu. */
function ConversationRow({
  item,
  active,
  onSelect,
  onArchive,
  archiveTitle,
}: {
  item: UnifiedConversation;
  active: boolean;
  onSelect: () => void;
  onArchive: () => void;
  archiveTitle: string;
}) {
  const badge = getChannelBadge(item.channel);
  return (
    <Box
      onClick={onSelect}
      sx={{
        display: 'flex',
        gap: 1.5,
        p: '13px 16px',
        borderBottom: '1px solid var(--line)',
        cursor: 'pointer',
        position: 'relative',
        transition: 'background .12s',
        bgcolor: active ? 'var(--accent-soft)' : 'transparent',
        '&:hover': { bgcolor: active ? 'var(--accent-soft)' : 'var(--bg)' },
        ...(active && {
          '&::before': {
            content: '""',
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 3,
            bgcolor: 'var(--accent)',
          },
        }),
        '&:hover .mg-archive': { opacity: 1, pointerEvents: 'auto' },
        '&:hover .mg-unread': { opacity: 0 },
      }}
    >
      {/* Avatar initiales + pastille canal coin bas-droit */}
      <Box
        sx={{
          width: 44,
          height: 44,
          borderRadius: '13px',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--font-display)',
          fontWeight: 600,
          fontSize: 15,
          color: '#fff',
          bgcolor: avatarColor(item.name),
          position: 'relative',
        }}
      >
        {initials(item.name)}
        <Box
          sx={{
            position: 'absolute',
            bottom: -3,
            right: -3,
            width: 18,
            height: 18,
            borderRadius: '7px',
            border: '2px solid var(--card)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: badge.color,
            color: '#fff',
          }}
        >
          <badge.Icon size={10} strokeWidth={2.5} />
        </Box>
      </Box>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Typography
            component="span"
            sx={{
              fontSize: '13.5px',
              fontWeight: 600,
              color: 'var(--ink)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {item.name}
          </Typography>
          <Typography
            component="span"
            sx={{ ml: 'auto', fontSize: '10.5px', color: 'var(--faint)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}
          >
            {formatConvTime(item.lastAt)}
          </Typography>
        </Box>
        <Typography sx={{ fontSize: '11px', color: 'var(--accent)', fontWeight: 600, m: '2px 0 3px' }}>
          {item.context}
        </Typography>
        <Typography
          sx={{
            fontSize: '12px',
            color: 'var(--muted)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {item.preview}
        </Typography>
      </Box>

      {/* Badge non-lus (masqué au hover au profit de l'action archiver) */}
      {item.unreadCount > 0 && (
        <Box
          className="mg-unread"
          sx={{
            position: 'absolute',
            right: 16,
            bottom: 16,
            minWidth: 18,
            height: 18,
            borderRadius: '9px',
            bgcolor: 'var(--accent)',
            color: '#fff',
            fontSize: '10px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            px: '5px',
            transition: 'opacity .12s',
          }}
        >
          {item.unreadCount}
        </Box>
      )}

      {/* Archiver — visible au hover */}
      <Tooltip title={archiveTitle} arrow>
        <Box
          component="button"
          className="mg-archive"
          aria-label={archiveTitle}
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
            onArchive();
          }}
          sx={{
            position: 'absolute',
            right: 12,
            bottom: 12,
            width: 26,
            height: 26,
            borderRadius: '8px',
            border: '1px solid var(--line-2)',
            bgcolor: 'var(--card)',
            color: 'var(--muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            p: 0,
            opacity: 0,
            pointerEvents: 'none',
            transition: 'opacity .12s, color .14s, border-color .14s',
            '&:hover': { color: 'var(--accent)', borderColor: 'var(--accent)' },
          }}
        >
          <ArchiveIcon size={13} strokeWidth={1.75} />
        </Box>
      </Tooltip>
    </Box>
  );
}

/**
 * Volet gauche 340px : recherche (.mg-search), sous-onglets pilules
 * Tous / Non lus / Voyageurs (.mg-subtab) et liste des conversations (.mg-conv).
 */
export default function ConversationList({
  items,
  isLoading,
  error,
  selectedKey,
  onSelect,
  onArchive,
}: ConversationListProps) {
  const { t } = useTranslation();
  const [subTab, setSubTab] = useState<SubTab>('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (subTab === 'unread' && item.unreadCount === 0) return false;
      if (subTab === 'guests' && item.kind !== 'channel') return false;
      if (!q) return true;
      return [item.name, item.context, item.preview].join(' ').toLowerCase().includes(q);
    });
  }, [items, subTab, search]);

  const subTabs: Array<{ value: SubTab; label: string }> = [
    { value: 'all', label: t('messagingHub.filters.all', 'Tous') },
    { value: 'unread', label: t('messagingHub.filters.unread', 'Non lus') },
    { value: 'guests', label: t('messagingHub.filters.guests', 'Voyageurs') },
  ];

  return (
    <>
      {/* En-tête liste : recherche + pilules */}
      <Box sx={{ p: '14px 16px', display: 'flex', flexDirection: 'column', gap: 1.375, borderBottom: '1px solid var(--line)' }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.125,
            height: 38,
            px: '13px',
            bgcolor: 'var(--field)',
            border: '1px solid var(--field-line)',
            borderRadius: '11px',
            color: 'var(--faint)',
          }}
        >
          <SearchIcon size={15} strokeWidth={1.75} />
          <InputBase
            placeholder={t('messagingHub.searchPlaceholder', 'Rechercher une conversation…')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ flex: 1, fontSize: '12.5px', color: 'var(--body)', '& input': { p: 0 } }}
          />
        </Box>
        <Box sx={{ display: 'flex', gap: 0.75 }}>
          {subTabs.map((tab) => {
            const active = subTab === tab.value;
            return (
              <Box
                key={tab.value}
                component="button"
                onClick={() => setSubTab(tab.value)}
                sx={{
                  fontFamily: 'inherit',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: active ? '#fff' : 'var(--muted)',
                  p: '6px 13px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  border: 0,
                  bgcolor: active ? 'var(--accent)' : 'var(--field)',
                  transition: 'background .14s, color .14s',
                }}
              >
                {tab.label}
              </Box>
            );
          })}
        </Box>
      </Box>

      {/* Conversations */}
      <Box sx={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={22} />
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ m: 1.5, fontSize: '0.8125rem' }}>
            {t('messagingHub.errorLoading', 'Impossible de charger les conversations.')}
          </Alert>
        ) : filtered.length === 0 ? (
          <Typography sx={{ px: 2, py: 4, textAlign: 'center', fontSize: '12.5px', color: 'var(--muted)' }}>
            {search.trim()
              ? t('messagingHub.noSearchResults', 'Aucun résultat')
              : t('messagingHub.noConversations', 'Aucune conversation')}
          </Typography>
        ) : (
          filtered.map((item) => (
            <ConversationRow
              key={item.key}
              item={item}
              active={item.key === selectedKey}
              onSelect={() => onSelect(item)}
              onArchive={() => onArchive(item)}
              archiveTitle={t('messagingHub.archiveConversation', 'Archiver la conversation')}
            />
          ))
        )}
      </Box>
    </>
  );
}
