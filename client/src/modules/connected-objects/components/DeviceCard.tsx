import React from 'react';
import { Paper, Box, Typography, Button, CircularProgress, Tooltip, alpha, useTheme } from '@mui/material';
import { Wifi, WifiOff, BatteryWarning, ChevronRight, Lock, LockOpen } from '../../../icons';
import { useIconSize } from '../../../hooks/useResponsiveSize';
import StatusPill from './StatusPill';
import { DEVICE_KINDS } from '../deviceRegistry';
import type { ConnectedDevice, DeviceAction } from '../types';

interface DeviceCardProps {
  device: ConnectedDevice;
  /** Déclenche une action rapide (lock/unlock/view). */
  onAction?: (uid: string, action: DeviceAction) => void;
  /** Action en cours (spinner + désactivation). */
  acting?: boolean;
}

/**
 * Carte d'objet connecté UNIFIÉE — même forme quel que soit le type. L'accent vit
 * dans le badge d'icône (couleur de type) ; l'état dans la pastille (couleur de
 * sens). Action rapide contextualisée par le type (verrouiller/déverrouiller pour
 * une serrure, « Gérer » sinon). Respecte les bans Impeccable : pas de side-stripe,
 * pas de carte-dans-carte.
 */
export default function DeviceCard({ device, onAction, acting = false }: DeviceCardProps) {
  const theme = useTheme();
  const iconSize = useIconSize('row');
  const meta = DEVICE_KINDS[device.kind];
  const locked = device.kind === 'lock' && (device.raw as { lockState?: string })?.lockState?.toUpperCase() === 'LOCKED';

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.25,
        borderRadius: 1.5,
        borderColor: 'divider',
        display: 'flex',
        flexDirection: 'column',
        gap: 0.875,
        transition: 'border-color 200ms, box-shadow 200ms',
        '&:hover': { borderColor: meta.color },
      }}
    >
      {/* En-tête : badge type + nom (+ pièce) | indicateur en ligne */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, minWidth: 0 }}>
        <Box
          sx={{
            width: 30, height: 30, borderRadius: 1, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: meta.color,
            bgcolor: alpha(meta.color, theme.palette.mode === 'dark' ? 0.2 : 0.12),
          }}
        >
          {meta.icon(iconSize)}
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{ fontWeight: 600, fontSize: '0.875rem', lineHeight: 1.25, color: 'text.primary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {device.name}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {device.roomName ? `${device.roomName} · ` : ''}{meta.singular}
          </Typography>
        </Box>
        <Tooltip title={device.online ? 'En ligne' : 'Hors ligne'} arrow>
          <Box component="span" sx={{ color: device.online ? 'success.main' : 'text.disabled', display: 'inline-flex', flexShrink: 0, mt: 0.25 }}>
            {device.online ? <Wifi size={14} strokeWidth={1.75} /> : <WifiOff size={14} strokeWidth={1.75} />}
          </Box>
        </Tooltip>
      </Box>

      {/* État + métrique principale */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
        <StatusPill level={device.statusLevel} label={device.statusLabel} pulse={device.online} />
        {device.primaryMetric && (
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'inline-flex', alignItems: 'center', gap: 0.375 }}>
            {device.battery != null && device.battery <= 20 && (
              <Box component="span" sx={{ color: 'warning.main', display: 'inline-flex' }}>
                <BatteryWarning size={13} strokeWidth={1.75} />
              </Box>
            )}
            <Box component="span" sx={{ fontVariantNumeric: 'tabular-nums' }}>
              {device.primaryMetric.label} : <strong>{device.primaryMetric.value}</strong>
            </Box>
          </Typography>
        )}
      </Box>

      {/* Action rapide contextualisée */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 'auto', pt: 0.25 }}>
        {device.kind === 'lock' ? (
          <Button
            size="small"
            variant="outlined"
            disabled={acting || !device.online}
            startIcon={acting ? <CircularProgress size={13} /> : locked ? <LockOpen size={14} strokeWidth={1.75} /> : <Lock size={14} strokeWidth={1.75} />}
            onClick={() => onAction?.(device.uid, locked ? 'unlock' : 'lock')}
            sx={{ flex: 1, justifyContent: 'flex-start' }}
          >
            {locked ? 'Déverrouiller' : 'Verrouiller'}
          </Button>
        ) : (
          <Button
            size="small"
            variant="text"
            endIcon={<ChevronRight size={14} strokeWidth={1.75} />}
            onClick={() => onAction?.(device.uid, 'view')}
            sx={{ flex: 1, justifyContent: 'space-between', color: 'text.secondary' }}
          >
            Gérer
          </Button>
        )}
      </Box>
    </Paper>
  );
}
