import React from 'react';
import { Alert, AlertDescription, Button } from '../../components/ui';
import { TriangleAlert } from 'lucide-react';
import { Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
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
          <Alert variant="warning" className="text-[0.8125rem]">
            <TriangleAlert />
            <AlertDescription>{getSharedChannelWarning(channel.id)}</AlertDescription>
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 2.5, pb: 2 }}>
        <Button variant="ghost" size="sm" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button variant="destructive" size="sm" onClick={onConfirm}>
          {t('channels.airbnb.disconnect')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ChannelDisconnectDialog;
