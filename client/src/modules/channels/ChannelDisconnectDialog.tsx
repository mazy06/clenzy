import React from 'react';
import {
  Alert,
  AlertDescription,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui';
import { TriangleAlert } from 'lucide-react';
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

  const sharedWarning = channel ? getSharedChannelWarning(channel.id) : null;

  return (
    <Dialog open={!!channel} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="pe-8">
            {t('channels.connect.disconnectConfirm', { channel: channel?.name ?? '' })}
          </DialogTitle>
          {/* Le seul corps de cette modale est l'avertissement de backend partage :
              quand il n'y a rien a dire, la description reste vide plutot qu'inventee. */}
          <DialogDescription className="sr-only">
            {t('channels.airbnb.disconnect')}
          </DialogDescription>
        </DialogHeader>

        {sharedWarning && (
          <Alert variant="warning" className="text-[0.8125rem]">
            <TriangleAlert />
            <AlertDescription>{sharedWarning}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="destructive" size="sm" onClick={onConfirm}>
            {t('channels.airbnb.disconnect')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ChannelDisconnectDialog;
