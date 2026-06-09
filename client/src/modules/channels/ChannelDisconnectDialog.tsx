import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Alert,
} from '@mui/material';
import type { OtaChannel } from '../../services/channels/otaChannels';

interface ChannelDisconnectDialogProps {
  channel: OtaChannel | null;
  onClose: () => void;
  onConfirm: () => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}

/** Confirmation de déconnexion d'un channel OTA (avec avertissement backend partagé). */
const ChannelDisconnectDialog: React.FC<ChannelDisconnectDialogProps> = ({
  channel,
  onClose,
  onConfirm,
  t,
}) => {
  /** Check if a channel shares its backend with another (Vrbo ↔ Abritel → HOMEAWAY) */
  const getSharedChannelWarning = (channelId: string): string | null => {
    if (channelId === 'vrbo' || channelId === 'abritel') {
      const other = channelId === 'vrbo' ? 'Abritel' : 'Vrbo';
      return t('channels.connect.sharedChannelWarning', { other });
    }
    return null;
  };

  return (
    <Dialog open={!!channel} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontSize: '0.9375rem', fontWeight: 700 }}>
        {t('channels.connect.disconnectConfirm', { channel: channel?.name ?? '' })}
      </DialogTitle>
      <DialogContent>
        {channel && getSharedChannelWarning(channel.id) && (
          <Alert severity="warning" sx={{ fontSize: '0.8125rem' }}>
            {getSharedChannelWarning(channel.id)}
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 2.5, pb: 2 }}>
        <Button size="small" onClick={onClose} sx={{ textTransform: 'none' }}>
          {t('common.cancel')}
        </Button>
        <Button size="small" variant="contained" color="error" onClick={onConfirm} sx={{ textTransform: 'none' }}>
          {t('channels.airbnb.disconnect')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ChannelDisconnectDialog;
