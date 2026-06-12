import React from 'react';
import { Box, Typography } from '@mui/material';

interface InboxListItemProps {
  /** Avatar 40×40 fourni par l'appelant (initiales, icône de canal, etc.). */
  avatar: React.ReactNode;
  title: React.ReactNode;
  /** Horodatage aligné à droite du titre. */
  time?: React.ReactNode;
  /** Ligne 2 : badges / sous-titre (canal, propriété, type…). */
  meta?: React.ReactNode;
  /** Ligne 3 : aperçu du dernier message. */
  preview?: React.ReactNode;
  /** Indicateur à droite de l'aperçu (pastille / chip non-lu). */
  trailing?: React.ReactNode;
  unread?: boolean;
  active?: boolean;
  onClick: () => void;
}

/**
 * Élément de liste unifié des inbox du module Contact (messagerie interne,
 * formulaires reçus, messagerie OTA). Garantit une structure et un rythme
 * visuel identiques : avatar 40px à gauche + 3 lignes (titre+heure / meta /
 * aperçu+indicateur). État actif via le fond uniquement (pas de side-stripe —
 * ban Impeccable).
 */
export default function InboxListItem({
  avatar,
  title,
  time,
  meta,
  preview,
  trailing,
  unread = false,
  active = false,
  onClick,
}: InboxListItemProps) {
  return (
    <Box
      onClick={onClick}
      sx={{
        display: 'flex',
        gap: 1.25,
        alignItems: 'flex-start',
        px: 1.5,
        py: 1.25,
        cursor: 'pointer',
        borderBottom: '1px solid var(--line)',
        // Actif — pattern .mg-conv (messagerie) : fond accent-soft, pas de side-stripe
        bgcolor: active ? 'var(--accent-soft)' : 'transparent',
        transition: 'background-color .14s',
        '&:hover': { bgcolor: active ? 'var(--accent-soft)' : 'var(--hover)' },
        '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
      }}
    >
      <Box sx={{ flexShrink: 0, mt: 0.125 }}>{avatar}</Box>

      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 0.5 }}>
          <Typography
            component="div"
            sx={{
              fontSize: '13px',
              fontWeight: unread ? 700 : 600,
              color: 'var(--ink)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              minWidth: 0,
            }}
          >
            {title}
          </Typography>
          {time && (
            <Typography
              component="div"
              sx={{ fontSize: '10.5px', color: 'var(--faint)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}
            >
              {time}
            </Typography>
          )}
        </Box>

        {meta && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.125, minWidth: 0 }}>
            {meta}
          </Box>
        )}

        {(preview || trailing) && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.25 }}>
            <Typography
              component="div"
              sx={{
                fontSize: '11.5px',
                color: unread ? 'var(--body)' : 'var(--muted)',
                fontWeight: unread ? 600 : 400,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: 1,
                minWidth: 0,
              }}
            >
              {preview}
            </Typography>
            {trailing && <Box sx={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center' }}>{trailing}</Box>}
          </Box>
        )}
      </Box>
    </Box>
  );
}
