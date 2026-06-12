import React, { useMemo, useState } from 'react';
import { Box, Typography, CircularProgress, Alert, Tooltip, IconButton } from '@mui/material';
import { Archive as ArchiveIcon, Unarchive as UnarchiveIcon } from '../../../icons';
import { useChannelInbox, useUpdateConversationStatus } from '../../../hooks/useConversations';
import { OTA_CHANNELS } from '../../channels/channelConfig';
import { SigSearch, SigConvItem } from './ota/conversationVisuals';

/**
 * Volet « Messages archivés » du hub Messagerie — liste pleine largeur,
 * lecture seule (référence Signature, section C : `.mg-list` sans fil).
 *
 * Source : conversations dont `status === 'ARCHIVED'`
 * (GET /conversations?status=ARCHIVED — même inbox que la Messagerie OTA,
 * archivage posé par PUT /conversations/{id}/status). L'API permettant la
 * restauration (status → OPEN), chaque ligne propose « Rouvrir ».
 */
export default function ArchivedPane() {
  const [search, setSearch] = useState('');

  const { data, isLoading, error } = useChannelInbox(OTA_CHANNELS, 0, 50, 'ARCHIVED');
  const conversations = useMemo(() => data?.content ?? [], [data]);

  const updateStatusMutation = useUpdateConversationStatus();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) =>
      [c.guestName, c.subject, c.propertyName, c.lastMessagePreview]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [conversations, search]);

  return (
    <Box
      sx={{
        flex: 1,
        width: '100%',
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'var(--card)',
      }}
    >
      {/* ── En-tête : recherche (.mg-list__h) ──────────────────────────────── */}
      <Box sx={{ p: '14px 16px', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
        <SigSearch value={search} onChange={setSearch} placeholder="Rechercher dans les archives…" />
      </Box>

      {/* ── Liste (.mg-convs) ──────────────────────────────────────────────── */}
      <Box sx={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
            <CircularProgress size={22} />
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ m: 2, fontSize: 'var(--text-sm)' }}>
            Impossible de charger les conversations archivées.
          </Alert>
        ) : filtered.length === 0 ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '10px',
              py: 7,
              color: 'var(--faint)',
            }}
          >
            <ArchiveIcon size={28} strokeWidth={1.5} />
            <Typography sx={{ fontSize: 'var(--text-md)', color: 'var(--muted)' }}>
              {search.trim() ? 'Aucun résultat dans les archives' : 'Aucune conversation archivée'}
            </Typography>
            {!search.trim() && (
              <Typography sx={{ fontSize: 'var(--text-xs)', color: 'var(--faint)' }}>
                Les conversations archivées depuis la Messagerie OTA apparaîtront ici.
              </Typography>
            )}
          </Box>
        ) : (
          filtered.map((conv) => (
            <SigConvItem
              key={conv.id}
              conv={conv}
              trailing={
                <Tooltip title="Rouvrir la conversation" arrow>
                  <span style={{ alignSelf: 'center', flexShrink: 0 }}>
                    <IconButton
                      size="small"
                      disabled={updateStatusMutation.isPending}
                      onClick={() =>
                        updateStatusMutation.mutate({ conversationId: conv.id, status: 'OPEN' })
                      }
                      aria-label="Rouvrir la conversation"
                      sx={{
                        width: 32,
                        height: 32,
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--line-2)',
                        bgcolor: 'var(--card)',
                        color: 'var(--muted)',
                        transition: 'color var(--duration-fast), border-color var(--duration-fast)',
                        '&:hover': {
                          color: 'var(--accent)',
                          borderColor: 'var(--accent)',
                          bgcolor: 'var(--card)',
                        },
                      }}
                    >
                      <UnarchiveIcon size={15} strokeWidth={1.75} />
                    </IconButton>
                  </span>
                </Tooltip>
              }
            />
          ))
        )}
      </Box>
    </Box>
  );
}
