import React, { useState } from 'react';
import { Paper, Box, Typography, Button, CircularProgress, Tooltip, IconButton, Menu, MenuItem, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Snackbar, Alert, alpha, useTheme } from '@mui/material';
import { Wifi, WifiOff, ChevronRight, Lock, LockOpen, MoreVert, Delete } from '../../../icons';
import { useIconSize } from '../../../hooks/useResponsiveSize';
import StatusPill from './StatusPill';
import BatteryIndicator from './BatteryIndicator';
import AccessCodeSection from './AccessCodeSection';
import { DEVICE_KINDS } from '../deviceRegistry';
import { useDeleteDevice } from '../useDeleteDevice';
import { useLockLiveStatus } from '../useLockLiveStatus';
import { useNoiseLiveStatus } from '../useNoiseLiveStatus';
import { useSensorLiveStatus } from '../useSensorLiveStatus';
import { isDeviceDeletable, type ConnectedDevice, type DeviceAction } from '../types';

interface DeviceCardProps {
  device: ConnectedDevice;
  /** Déclenche une action rapide (lock/unlock/view). */
  onAction?: (uid: string, action: DeviceAction) => void;
  /** Action lock/unlock en cours (spinner + désactivation). */
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

  // Suppression auto-portée par la carte : fonctionne partout où elle est rendue
  // (Hub, vue par logement…) sans câblage par l'hôte. Confirmation explicite
  // (geste destructif) ; au succès la carte disparaît au refetch, l'erreur reste
  // affichée en snackbar pour permettre un nouvel essai.
  // Sync ponctuelle du statut réel au montage (online réel via provider), qui
  // rafraîchit le read-model → carte + KPIs cohérents. No-op hors du type concerné.
  useLockLiveStatus(device.id, device.kind === 'lock');
  useNoiseLiveStatus(device.id, device.kind === 'noise');
  // Capteurs d'environnement (Tuya/Netatmo) : 1re lecture auto au montage (init).
  useSensorLiveStatus(
    device.id,
    device.kind === 'climate' || device.kind === 'contact' || device.kind === 'motion' || device.kind === 'smoke',
  );

  const deletable = isDeviceDeletable(device.kind);
  const { remove, removing } = useDeleteDevice();
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const closeMenu = () => setMenuAnchor(null);
  const handleDeleteClick = () => { closeMenu(); setConfirmOpen(true); };
  const handleConfirmDelete = async () => {
    try {
      await remove(device);
      setConfirmOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Échec de la suppression.');
    }
  };

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
        {device.kind === 'camera' ? (
          // Caméra : aperçu (snapshot) du flux. Repli sur l'icône (placée derrière) si hors
          // ligne, pas de snapshot, ou image en erreur (onError masque l'img → l'icône réapparaît).
          <Box
            sx={{
              position: 'relative', width: 40, height: 30, borderRadius: 1, flexShrink: 0, overflow: 'hidden',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: meta.color,
              bgcolor: alpha(meta.color, theme.palette.mode === 'dark' ? 0.2 : 0.12),
            }}
          >
            {meta.icon(iconSize)}
            {device.online && device.previewUrl && (
              <Box
                component="img"
                src={device.previewUrl}
                alt=""
                loading="lazy"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
              />
            )}
          </Box>
        ) : (
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
        )}
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography
            onClick={() => onAction?.(device.uid, 'view')}
            sx={{ fontWeight: 600, fontSize: '0.875rem', lineHeight: 1.25, color: 'text.primary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer', '&:hover': { color: 'primary.main' } }}
          >
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
        {device.kind === 'lock' ? (
          <BatteryIndicator level={device.battery} />
        ) : (
          <>
            {device.primaryMetric && (
              <Typography variant="caption" sx={{ color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
                {device.primaryMetric.label} : <strong>{device.primaryMetric.value}</strong>
              </Typography>
            )}
            {device.battery != null && <BatteryIndicator level={device.battery} />}
          </>
        )}
      </Box>

      {/* Code d'accès (serrures uniquement) */}
      {device.kind === 'lock' && <AccessCodeSection deviceId={device.id} />}

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

        {/* Menu d'options (⋮) — actions secondaires dont la suppression. */}
        {deletable && (
          <>
            <Tooltip title="Options" arrow>
              <IconButton
                size="small"
                aria-label="Options de l'objet"
                onClick={(e) => setMenuAnchor(e.currentTarget)}
                disabled={removing}
                sx={{ flexShrink: 0, color: 'text.secondary', cursor: 'pointer' }}
              >
                {removing ? <CircularProgress size={16} /> : <MoreVert size={16} strokeWidth={1.75} />}
              </IconButton>
            </Tooltip>
            <Menu
              anchorEl={menuAnchor}
              open={Boolean(menuAnchor)}
              onClose={closeMenu}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
              <MenuItem onClick={handleDeleteClick} sx={{ color: 'error.main', gap: 1 }}>
                <Delete size={16} strokeWidth={1.75} />
                Supprimer
              </MenuItem>
            </Menu>
          </>
        )}
      </Box>

      {/* Confirmation de suppression (geste destructif → dialog explicite). */}
      <Dialog
        open={confirmOpen}
        onClose={() => { if (!removing) setConfirmOpen(false); }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Supprimer cet objet ?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            «&nbsp;{device.name}&nbsp;» sera retiré de vos objets connectés.
            Le service relié reste connecté — vous pourrez le rajouter ensuite.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)} disabled={removing}>
            Annuler
          </Button>
          <Button
            onClick={() => { void handleConfirmDelete(); }}
            color="error"
            variant="contained"
            disabled={removing}
            startIcon={removing ? <CircularProgress size={14} color="inherit" /> : <Delete size={16} strokeWidth={1.75} />}
          >
            Supprimer
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(error)}
        autoHideDuration={5000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {error ? (
          <Alert severity="error" variant="filled" onClose={() => setError(null)} sx={{ width: '100%' }}>
            {error}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Paper>
  );
}
