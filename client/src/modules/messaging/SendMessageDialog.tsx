import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Typography,
  Alert,
  CircularProgress,
  Box,
  Paper,
  Divider,
} from '@mui/material';
import { Send } from '@mui/icons-material';
import { useTranslation } from '../../hooks/useTranslation';
import {
  guestMessagingApi,
  type MessageTemplate,
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
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (open) {
      loadTemplates();
      setSelectedTemplateId('');
      setError(null);
      setSuccess(false);
    }
  }, [open]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const data = await guestMessagingApi.getTemplates();
      setTemplates(data.filter((tpl) => tpl.isActive));
    } catch (err) {
      setError(t('messaging.send.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  const handleSend = async () => {
    if (!selectedTemplateId) return;

    try {
      setSending(true);
      setError(null);
      await guestMessagingApi.sendMessage({
        reservationId,
        templateId: Number(selectedTemplateId),
      });
      setSuccess(true);
      onSent?.();
      setTimeout(() => onClose(), 1500);
    } catch (err) {
      setError(t('messaging.send.error'));
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('messaging.send.title')}</DialogTitle>
      <DialogContent>
        {guestName && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t('messaging.send.sendTo')}: <strong>{guestName}</strong>
          </Typography>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {t('messaging.send.success')}
          </Alert>
        )}

        {loading ? (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress size={32} />
          </Box>
        ) : (
          <>
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
              <Paper variant="outlined" sx={{ p: 2, bgcolor: 'action.hover' }}>
                <Typography variant="caption" color="text.secondary">
                  {t('messaging.send.preview')}
                </Typography>
                <Typography variant="subtitle2" gutterBottom>
                  {selectedTemplate.subject}
                </Typography>
                <Divider sx={{ my: 1 }} />
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                  {selectedTemplate.body.length > 300
                    ? selectedTemplate.body.substring(0, 300) + '...'
                    : selectedTemplate.body}
                </Typography>
              </Paper>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button
          variant="contained"
          startIcon={sending ? <CircularProgress size={16} color="inherit" /> : <Send />}
          onClick={handleSend}
          disabled={sending || !selectedTemplateId || success}
        >
          {sending ? t('common.processing') : t('messaging.send.send')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
