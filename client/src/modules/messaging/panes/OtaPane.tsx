import React, { useMemo, useState } from 'react';
import { Box, Typography, CircularProgress, Alert } from '@mui/material';
import { Forum as ForumIcon } from '../../../icons';
import { useChannelInbox, useMarkAsRead } from '../../../hooks/useConversations';
import type { ConversationDto } from '../../../services/api/conversationApi';
import { OTA_CHANNELS, CONTACT_LIST_WIDTH } from '../../channels/channelConfig';
import { SigSearch, SigConvItem } from './ota/conversationVisuals';
import OtaThread from './ota/OtaThread';

// ─── Sous-onglets (.mg-subtabs) ──────────────────────────────────────────────

/**
 * Mapping sur les états existants de ConversationDto :
 * « Non lus » = `unread === true`, « En cours » = `status === 'OPEN'`.
 */
type SubTab = 'all' | 'unread' | 'open';

const SUBTABS: { value: SubTab; label: string }[] = [
  { value: 'all', label: 'Tous' },
  { value: 'unread', label: 'Non lus' },
  { value: 'open', label: 'En cours' },
];

/**
 * Volet « Messagerie OTA » du hub Messagerie — 3 volets identiques au volet
 * Messagerie de la référence Signature (section D) : liste des conversations
 * voyageurs OTA/WhatsApp, fil avec séparateurs de jour, compose.
 *
 * Réutilise les données et hooks existants de la messagerie OTA
 * (useChannelInbox / useConversations + dialogs du module channels) —
 * ChannelInboxTab reste en place côté Channels, rien n'y est modifié.
 */
export default function OtaPane() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [subTab, setSubTab] = useState<SubTab>('all');
  const [search, setSearch] = useState('');

  const { data, isLoading, error } = useChannelInbox(OTA_CHANNELS, 0, 50);
  const conversations = useMemo(() => data?.content ?? [], [data]);

  const markAsReadMutation = useMarkAsRead();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return conversations.filter((c) => {
      if (subTab === 'unread' && !c.unread) return false;
      if (subTab === 'open' && c.status !== 'OPEN') return false;
      if (!q) return true;
      return [c.guestName, c.subject, c.propertyName, c.lastMessagePreview]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [conversations, subTab, search]);

  // La conversation sélectionnée reste résolvable même si filtrée hors liste.
  const selected = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId],
  );

  const handleSelect = (conv: ConversationDto) => {
    setSelectedId(conv.id);
    if (conv.unread) markAsReadMutation.mutate(conv.id);
  };

  return (
    <Box sx={{ display: 'flex', height: '100%', width: '100%', minHeight: 0, overflow: 'hidden' }}>
      {/* ── Volet 1 : liste (.mg-list) ─────────────────────────────────────── */}
      <Box
        sx={{
          width: CONTACT_LIST_WIDTH,
          flexShrink: 0,
          display: { xs: selected ? 'none' : 'flex', md: 'flex' },
          flexDirection: 'column',
          minHeight: 0,
          bgcolor: 'var(--card)',
          borderRight: { md: '1px solid var(--line)' },
        }}
      >
        <Box
          sx={{
            p: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '11px',
            borderBottom: '1px solid var(--line)',
            flexShrink: 0,
          }}
        >
          <SigSearch value={search} onChange={setSearch} placeholder="Rechercher un voyageur…" />
          <Box sx={{ display: 'flex', gap: '6px' }}>
            {SUBTABS.map((tab) => {
              const active = subTab === tab.value;
              return (
                <Box
                  key={tab.value}
                  component="button"
                  onClick={() => setSubTab(tab.value)}
                  sx={{
                    border: 0,
                    fontFamily: 'inherit',
                    fontSize: 'var(--text-xs)',
                    fontWeight: 'var(--fw-semibold)',
                    color: active ? 'var(--on-accent)' : 'var(--muted)',
                    p: '6px 13px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    bgcolor: active ? 'var(--accent)' : 'var(--field)',
                    transition: 'background var(--duration-fast), color var(--duration-fast)',
                    '&:hover': active ? undefined : { color: 'var(--body)' },
                  }}
                >
                  {tab.label}
                </Box>
              );
            })}
          </Box>
        </Box>
        <Box sx={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={22} />
            </Box>
          ) : error ? (
            <Alert severity="error" sx={{ m: 1.5, fontSize: 'var(--text-sm)' }}>
              Impossible de charger les conversations.
            </Alert>
          ) : filtered.length === 0 ? (
            <Box sx={{ px: 2, py: 4, textAlign: 'center' }}>
              <Typography sx={{ fontSize: 'var(--text-md)', color: 'var(--muted)' }}>
                {search.trim()
                  ? 'Aucun résultat'
                  : subTab === 'unread'
                    ? 'Aucune conversation non lue'
                    : 'Aucune conversation'}
              </Typography>
            </Box>
          ) : (
            filtered.map((conv) => (
              <SigConvItem
                key={conv.id}
                conv={conv}
                active={conv.id === selectedId}
                onClick={() => handleSelect(conv)}
              />
            ))
          )}
        </Box>
      </Box>

      {/* ── Volets 2-3 : fil + compose (.mg-thread) ────────────────────────── */}
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
          <OtaThread
            conversation={selected}
            onStatusChanged={() => setSelectedId(null)}
            onBack={() => setSelectedId(null)}
          />
        ) : (
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              bgcolor: 'var(--bg)',
              p: 3,
            }}
          >
            <Box sx={{ color: 'var(--faint)', display: 'inline-flex' }}>
              <ForumIcon size={30} strokeWidth={1.5} />
            </Box>
            <Typography
              sx={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-lg)', fontWeight: 'var(--fw-semibold)', color: 'var(--ink)' }}
            >
              Sélectionnez une conversation
            </Typography>
            <Typography sx={{ fontSize: 'var(--text-sm)', color: 'var(--muted)', textAlign: 'center' }}>
              Choisissez un échange à gauche pour afficher les messages et répondre.
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}
