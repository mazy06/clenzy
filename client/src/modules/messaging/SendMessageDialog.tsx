import React, { useState, useEffect } from 'react';
import { Alert as BuiAlert, AlertDescription, AlertAction, Button as BuiButton } from '../../components/ui';
import { TriangleAlert, X, CircleCheck, Info } from 'lucide-react';
import { Spinner } from '../../components/ui';
import { Card } from '../../components/ui';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem, Box, Divider } from '@mui/material';
import { Send } from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import {
  guestMessagingApi,
  type MessageTemplate,
  type MessageChannel,
} from '../../services/api/guestMessagingApi';

interface SendMessageDialogProps {
  open: boolean;
  reservationId: number;
  guestName?: string;
  onClose: () => void;
  onSent?: () => void;
}

export default function SendMessageDialog({
  open,
  reservationId,
  guestName,
  onClose,
  onSent,
}: SendMessageDialogProps) {
  const { t } = useTranslation();
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | ''>('');
  const [channel, setChannel] = useState<MessageChannel>('EMAIL');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (open) {
      const loadTemplates = async () => {
        try {
          setLoading(true);
          const data = await guestMessagingApi.getTemplates();
          setTemplates(data.filter((tpl) => tpl.isActive));
        } catch {
          setError(t('messaging.send.loadError'));
        } finally {
          setLoading(false);
        }
      };
      loadTemplates();
      setSelectedTemplateId('');
      setChannel('EMAIL');
      setError(null);
      setSuccess(false);
    }
  }, [open, t]);

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  const handleSend = async () => {
    if (!selectedTemplateId) return;

    try {
      setSending(true);
      setError(null);
      await guestMessagingApi.sendMessage({
        reservationId,
        templateId: Number(selectedTemplateId),
        channel,
      });
      setSuccess(true);
      onSent?.();
      setTimeout(() => onClose(), 1500);
    } catch (err) {
      // Surface le message precis du backend (ex: voyageur sans email/telephone) si present.
      const message = (err as { message?: string })?.message;
      setError(message || t('messaging.send.error'));
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('messaging.send.title')}</DialogTitle>
      <DialogContent>
        {guestName && (
          <p className="cn-text-body2 text-muted-foreground mb-3">
            {t('messaging.send.sendTo')}: <strong>{guestName}</strong>
          </p>
        )}

        {error && (
          <BuiAlert variant="destructive" className="mb-3">
            <TriangleAlert />
            <AlertDescription>{error}</AlertDescription>
            <AlertAction>
              <BuiButton variant="ghost" size="icon-xs" aria-label="Fermer" onClick={() => setError(null)}>
                <X />
              </BuiButton>
            </AlertAction>
          </BuiAlert>
        )}

        {success && (
          <BuiAlert variant="success" className="mb-3">
            <CircleCheck />
            <AlertDescription>{t('messaging.send.success')}</AlertDescription>
          </BuiAlert>
        )}

        {loading ? (
          <Box display="flex" justifyContent="center" py={4}>
            <Spinner className="size-8" />
          </Box>
        ) : (
          <>
            <TextField
              select
              fullWidth
              label={t('messaging.send.channel', 'Canal')}
              value={channel}
              onChange={(e) => setChannel(e.target.value as MessageChannel)}
              size="small"
              sx={{ mb: 2 }}
            >
              <MenuItem value="EMAIL">{t('messaging.send.channelEmail', 'Email')}</MenuItem>
              <MenuItem value="WHATSAPP">{t('messaging.send.channelWhatsapp', 'WhatsApp')}</MenuItem>
            </TextField>

            {channel === 'WHATSAPP' && (
              <BuiAlert variant="info" className="mb-3">
                <Info />
                <AlertDescription>{t(
                  'messaging.send.whatsappHint',
                  "WhatsApp en texte libre : le message n'est délivré que si le voyageur a écrit au numéro Baitly dans les dernières 24h (fenêtre Meta). Sinon, privilégiez l'email.",
                )}</AlertDescription>
              </BuiAlert>
            )}

            <TextField
              select
              fullWidth
              label={t('messaging.send.selectTemplate')}
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(Number(e.target.value))}
              size="small"
              sx={{ mb: 2 }}
            >
              {templates.map((tpl) => (
                <MenuItem key={tpl.id} value={tpl.id}>
                  {tpl.name} ({tpl.type})
                </MenuItem>
              ))}
            </TextField>

            {selectedTemplate && (
              <Card className="gap-0 py-0 p-3 bg-[action.hover]">
                <span className="cn-text-caption text-muted-foreground">
                  {t('messaging.send.preview')}
                </span>
                <h6 className="cn-text-subtitle2 mb-[0.35em]">
                  {selectedTemplate.subject}
                </h6>
                <Divider sx={{ my: 1 }} />
                <p className="cn-text-body2 whitespace-pre-wrap">
                  {selectedTemplate.body.length > 300
                    ? selectedTemplate.body.substring(0, 300) + '...'
                    : selectedTemplate.body}
                </p>
              </Card>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button
          variant="contained"
          startIcon={sending ? <Spinner className="size-4" /> : <Send />}
          onClick={handleSend}
          disabled={sending || !selectedTemplateId || success}
        >
          {sending ? t('common.processing') : t('messaging.send.send')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
