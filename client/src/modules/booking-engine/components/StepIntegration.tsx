import React, { useCallback, useState } from 'react';
import {
  Box, Paper, Typography, Button, TextField, MenuItem,
  Switch, FormControlLabel, CircularProgress,
  IconButton, Tooltip, InputAdornment, Dialog, DialogTitle,
  DialogContent, DialogContentText, DialogActions, Chip,
} from '@mui/material';
import {
  ContentCopy, Refresh, VpnKey, Visibility, VisibilityOff,
  Code, Preview, Widgets,
} from '../../../icons';
import { useTranslation } from '../../../hooks/useTranslation';
import type { BookingEngineConfig, BookingEngineConfigUpdate } from '../../../services/api/bookingEngineApi';
import SectionPaper from './SectionPaper';

// ─── Types ──────────────────────────────────────────────────────────────────

interface StepIntegrationProps {
  config: BookingEngineConfig | null;
  isCreate: boolean;
  name: string;
  toggleEnabled: boolean;
  isTogglingPending: boolean;
  isRegeneratingKey: boolean;
  onNameChange: (name: string) => void;
  onFormChange: (field: keyof BookingEngineConfigUpdate, value: unknown) => void;
  onToggle: (enabled: boolean) => void;
  onRegenerateKey: () => void;
  onCopyKey: () => void;
  onOpenPreview: () => void;
  onSnackbar: (message: string, severity: 'success' | 'error') => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

const StepIntegration: React.FC<StepIntegrationProps> = ({
  config,
  isCreate,
  name,
  toggleEnabled,
  isTogglingPending,
  isRegeneratingKey,
  onNameChange,
  onFormChange,
  onToggle,
  onRegenerateKey,
  onCopyKey,
  onOpenPreview,
  onSnackbar,
}) => {
  const { t } = useTranslation();
  const [showApiKey, setShowApiKey] = useState(false);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);

  const apiKey = config?.apiKey || '';
  const baseUrl = window.location.origin;

  const embedCode = `<!-- Clenzy Booking Engine -->
<div id="clenzy-booking-engine" data-api-key="${apiKey}"></div>
<script src="${baseUrl}/sdk/booking-engine.js" async></script>`;

  const iframeCode = `<iframe
  src="${baseUrl}/booking/${apiKey}"
  width="100%" height="800"
  frameborder="0"
  allow="payment"
  style="border: none; border-radius: 8px;">
</iframe>`;

  const copyToClipboard = useCallback(
    (text: string, _label?: string) => {
      navigator.clipboard.writeText(text).then(() => {
        onSnackbar(t('bookingEngine.keyCopied'), 'success');
      });
    },
    [onSnackbar],
  );

  const handleConfirmRegenerate = useCallback(() => {
    setConfirmRegenerate(false);
    onRegenerateKey();
  }, [onRegenerateKey]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      {/* Name + Toggle + API Key */}
      <SectionPaper icon={<Box component="span" sx={{ display: 'inline-flex', color: 'primary.main' }}><VpnKey size={20} strokeWidth={1.75} /></Box>} titleKey="bookingEngine.sections.statusApiKey">
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 1.5, alignItems: { md: 'center' } }}>
          <TextField
            size="small"
            label={t('bookingEngine.fields.name')}
            value={name}
            onChange={(e) => {
              onNameChange(e.target.value);
              onFormChange('name', e.target.value);
            }}
            placeholder={t('bookingEngine.fields.namePlaceholder')}
            sx={{ minWidth: 180 }}
          />
          {!isCreate && (
            <>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={toggleEnabled}
                      onChange={(e) => onToggle(e.target.checked)}
                      disabled={isTogglingPending}
                      color="success"
                    />
                  }
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" fontWeight={600}>{t('bookingEngine.fields.enabled')}</Typography>
                      <Chip
                        size="small"
                        label={toggleEnabled ? t('bookingEngine.status.active') : t('bookingEngine.status.inactive')}
                        color={toggleEnabled ? 'success' : 'default'}
                        sx={{ fontSize: '0.7rem', height: 22 }}
                      />
                    </Box>
                  }
                />
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <TextField
                  fullWidth
                  size="small"
                  label={t('bookingEngine.fields.apiKey')}
                  value={config?.apiKey ?? ''}
                  type={showApiKey ? 'text' : 'password'}
                  InputProps={{
                    readOnly: true,
                    endAdornment: (
                      <InputAdornment position="end">
                        <Tooltip title={showApiKey ? t('common.hide') : t('common.show')}>
                          <IconButton size="small" onClick={() => setShowApiKey(!showApiKey)}>
                            {showApiKey ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={t('bookingEngine.fields.copyKey')}>
                          <IconButton size="small" onClick={onCopyKey}>
                            <ContentCopy fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </InputAdornment>
                    ),
                  }}
                />
              </Box>
              <Button
                variant="outlined"
                color="warning"
                size="small"
                startIcon={isRegeneratingKey ? <CircularProgress size={14} /> : <Refresh />}
                onClick={() => setConfirmRegenerate(true)}
                disabled={isRegeneratingKey}
                sx={{ textTransform: 'none', fontWeight: 600, whiteSpace: 'nowrap' }}
              >
                {t('bookingEngine.fields.regenerateKey')}
              </Button>
            </>
          )}
        </Box>
      </SectionPaper>

      {isCreate && (
        <Paper sx={{ p: 2, bgcolor: 'warning.main', color: 'warning.contrastText', borderRadius: 2 }}>
          <Typography variant="body2">
            {t('bookingEngine.integration.saveFirst', "Sauvegardez d'abord votre configuration pour obtenir le code d'intégration.")}
          </Typography>
        </Paper>
      )}

      {!isCreate && (
        <>
          {/* Script embed */}
          <SectionPaper icon={<Code size={20} strokeWidth={1.75} color='#4CAF50' />} titleKey="bookingEngine.sections.embedCode">
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              {t('bookingEngine.integration.embedHint', "Copiez ce code et collez-le dans votre site web, à l'endroit où vous souhaitez afficher le moteur de réservation.")}
            </Typography>
            <CodeBlock code={embedCode} onCopy={() => copyToClipboard(embedCode, 'Code embed')} />
          </SectionPaper>

          {/* iframe alternative */}
          <SectionPaper icon={<Widgets size={20} strokeWidth={1.75} color='#2196F3' />} titleKey="bookingEngine.sections.iframeEmbed">
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              {t('bookingEngine.integration.iframeHint', "Alternative : intégrez via un iframe si vous ne souhaitez pas charger le SDK JavaScript.")}
            </Typography>
            <CodeBlock code={iframeCode} onCopy={() => copyToClipboard(iframeCode, 'Code iframe')} />
          </SectionPaper>

          {/* Preview button */}
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
            <Button
              variant="contained"
              startIcon={<Preview />}
              onClick={onOpenPreview}
              sx={{ px: 4, py: 1.25, borderRadius: 2, textTransform: 'none', fontSize: '0.9375rem', fontWeight: 600 }}
            >
              {t('bookingEngine.actions.preview', 'Aperçu en temps réel')}
            </Button>
          </Box>
        </>
      )}

      {/* Confirm regenerate dialog */}
      <Dialog open={confirmRegenerate} onClose={() => setConfirmRegenerate(false)} maxWidth="xs">
        <DialogTitle>{t('bookingEngine.fields.regenerateKey')}</DialogTitle>
        <DialogContent>
          <DialogContentText>{t('bookingEngine.fields.regenerateConfirm')}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmRegenerate(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleConfirmRegenerate} color="warning" variant="contained">{t('common.confirm')}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

// ─── Code Block (internal helper) ───────────────────────────────────────────

interface CodeBlockProps {
  code: string;
  onCopy: () => void;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ code, onCopy }) => (
  <Box sx={{
    bgcolor: '#1E1E1E', color: '#D4D4D4', borderRadius: 1.5, p: 2,
    fontFamily: '"Fira Code", "Consolas", monospace', fontSize: '0.8125rem', whiteSpace: 'pre-wrap',
    wordBreak: 'break-all', position: 'relative', lineHeight: 1.6, border: '1px solid #333',
  }}>
    {code}
    <IconButton
      size="small"
      onClick={onCopy}
      sx={{ position: 'absolute', top: 8, right: 8, color: 'grey.400', '&:hover': { color: '#fff' } }}
    >
      <ContentCopy size={16} strokeWidth={1.75} />
    </IconButton>
  </Box>
);

StepIntegration.displayName = 'StepIntegration';

export default StepIntegration;
