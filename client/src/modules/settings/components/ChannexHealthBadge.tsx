/**
 * ChannexHealthBadge — Quick Win #4.
 *
 * <p>Petit indicateur visuel discret affiche sur les cards / lignes de propriete
 * pour signaler l'etat de sync Channex en un coup d'oeil, sans necessiter
 * d'ouvrir la page Integrations.</p>
 *
 * <p>States :</p>
 * <ul>
 *   <li>ACTIVE   : point vert  · "Sync OK · last sync 14:32"</li>
 *   <li>PENDING  : point orange · "Connexion en cours · push declenche au 1er OTA actif"</li>
 *   <li>ERROR    : point rouge  · last error message en tooltip</li>
 *   <li>DISABLED : point gris   · "Sync mise en pause"</li>
 *   <li>null     : pas de badge (property non connectee)</li>
 * </ul>
 *
 * <p>Le badge est cliquable (curseur pointer) si {@code onClick} est fourni.</p>
 */
import React from 'react';
import { Box, Tooltip, Typography } from '@mui/material';
import { Cable, AlertCircle, Pause, Clock, CheckCircle2 } from 'lucide-react';

import type { ChannexSyncStatus, ChannexMappingDto } from '../../../services/api/channexApi';

interface ChannexHealthBadgeProps {
  mapping: ChannexMappingDto | null;
  /** Taille du badge en px (icone + dot). Default 12 (compact). */
  size?: number;
  /** Style 'dot' = petit point seul. 'icon' = icone + dot superpose. */
  variant?: 'dot' | 'icon';
  /** Si fourni, le badge devient cliquable (typiquement : ouvre les settings Channex). */
  onClick?: () => void;
}

interface StatusMeta {
  color: string;
  label: string;
  Icon: typeof CheckCircle2;
}

const STATUS_META: Record<ChannexSyncStatus, StatusMeta> = {
  ACTIVE: { color: '#10B981', label: 'Sync Channex active', Icon: CheckCircle2 },
  PENDING: { color: '#D97706', label: 'Connexion Channex en cours', Icon: Clock },
  ERROR: { color: '#EF4444', label: 'Erreur de sync Channex', Icon: AlertCircle },
  DISABLED: { color: '#6B7280', label: 'Sync Channex mise en pause', Icon: Pause },
};

function formatLastSync(iso: string | null): string {
  if (!iso) return 'pas encore synchronisee';
  try {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "a l'instant";
    if (mins < 60) return `il y a ${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `il y a ${hours} h`;
    const days = Math.floor(hours / 24);
    return `il y a ${days} j`;
  } catch {
    return iso;
  }
}

export default function ChannexHealthBadge({
  mapping,
  size = 12,
  variant = 'dot',
  onClick,
}: ChannexHealthBadgeProps) {
  if (!mapping) return null;

  const meta = STATUS_META[mapping.syncStatus];
  const lastSyncStr = formatLastSync(mapping.lastSyncAt);

  const tooltipContent = (
    <Box sx={{ maxWidth: 260 }}>
      <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.75rem', lineHeight: 1.3, mb: 0.3 }}>
        {meta.label}
      </Typography>
      <Typography variant="caption" sx={{ display: 'block', lineHeight: 1.45, opacity: 0.85 }}>
        Derniere sync : {lastSyncStr}
      </Typography>
      {mapping.lastSyncError && mapping.syncStatus === 'ERROR' && (
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            mt: 0.5,
            pt: 0.5,
            borderTop: '1px solid rgba(255,255,255,0.15)',
            opacity: 0.9,
            fontStyle: 'italic',
          }}
        >
          {mapping.lastSyncError.slice(0, 200)}
          {mapping.lastSyncError.length > 200 && '…'}
        </Typography>
      )}
      {onClick && (
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            mt: 0.5,
            fontSize: '0.65rem',
            opacity: 0.7,
          }}
        >
          Cliquer pour ouvrir les details
        </Typography>
      )}
    </Box>
  );

  return (
    <Tooltip title={tooltipContent} arrow placement="top">
      <Box
        component={onClick ? 'button' : 'span'}
        onClick={onClick ? (e: React.MouseEvent) => { e.stopPropagation(); onClick(); } : undefined}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          padding: 0,
          border: 'none',
          background: 'transparent',
          cursor: onClick ? 'pointer' : 'default',
          color: meta.color,
          lineHeight: 0,
          ...(onClick && {
            transition: 'transform 150ms cubic-bezier(0.22, 1, 0.36, 1)',
            '&:hover': { transform: 'scale(1.12)' },
            '&:focus-visible': {
              outline: `2px solid ${meta.color}`,
              outlineOffset: 2,
              borderRadius: '50%',
            },
          }),
        }}
        aria-label={meta.label}
      >
        {variant === 'icon' ? (
          <Box
            sx={{
              position: 'relative',
              width: size + 8,
              height: size + 8,
              borderRadius: '50%',
              bgcolor: `${meta.color}1A`,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Cable size={size} strokeWidth={2.2} />
            {/* Dot exposant en bas a droite */}
            <Box
              sx={{
                position: 'absolute',
                bottom: -1,
                right: -1,
                width: size * 0.5,
                height: size * 0.5,
                borderRadius: '50%',
                bgcolor: meta.color,
                border: '1.5px solid white',
                animation: mapping.syncStatus === 'ERROR' ? 'pulse 2s infinite' : undefined,
                '@keyframes pulse': {
                  '0%, 100%': { opacity: 1 },
                  '50%': { opacity: 0.55 },
                },
              }}
            />
          </Box>
        ) : (
          <Box
            sx={{
              width: size,
              height: size,
              borderRadius: '50%',
              bgcolor: meta.color,
              flexShrink: 0,
              boxShadow: `0 0 0 2px ${meta.color}26`,
              animation: mapping.syncStatus === 'ERROR' ? 'pulse 2s infinite' : undefined,
              '@keyframes pulse': {
                '0%, 100%': { opacity: 1 },
                '50%': { opacity: 0.55 },
              },
            }}
          />
        )}
      </Box>
    </Tooltip>
  );
}
