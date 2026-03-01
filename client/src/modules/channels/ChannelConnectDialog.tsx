import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Button,
  TextField,
  Alert,
  CircularProgress,
  Typography,
  IconButton,
} from '@mui/material';
import { Close, CheckCircle, Science } from '@mui/icons-material';
import { useTranslation } from '../../hooks/useTranslation';
import { useConnectChannel, useTestChannelConnection } from '../../hooks/useChannelConnections';
import {
  CHANNEL_BACKEND_MAP,
  CHANNEL_CREDENTIAL_FIELDS,
} from '../../services/api/channelConnectionApi';
import type { ChannelId, ChannelConnectionTestResult } from '../../services/api/channelConnectionApi';

// ─── Types ───────────────────────────────────────────────────────────────────

interface OtaChannel {
  id: string;
  name: string;
  brandColor: string;
  brandGradient: string;
  logo: string | null;
}

interface ChannelConnectDialogProps {
  open: boolean;
  channel: OtaChannel;
  onClose: () => void;
  onConnected: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ChannelConnectDialog({ open, channel, onClose, onConnected }: ChannelConnectDialogProps) {
  const { t } = useTranslation();
  const connectMutation = useConnectChannel();
  const testMutation = useTestChannelConnection();

  const backendChannel = CHANNEL_BACKEND_MAP[channel.id as ChannelId] ?? '';
  const fields = useMemo(
    () => CHANNEL_CREDENTIAL_FIELDS[backendChannel] ?? [],
    [backendChannel],
  );

  const [formData, setFormData] = useState<Record<string, string>>({});
  const [testResult, setTestResult] = useState<ChannelConnectionTestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reset form state when channel changes (defensive — component is currently unmounted on close)
  useEffect(() => {
    setFormData({});
    setTestResult(null);
    setError(null);
    connectMutation.reset();
    testMutation.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel.id]);

  const handleFieldChange = useCallback((key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    setTestResult(null);
    setError(null);
  }, []);

  const isFormValid = useMemo(
    () => fields.filter((f) => f.required).every((f) => formData[f.key]?.trim()),
    [fields, formData],
  );

  const handleTest = useCallback(async () => {
    setTestResult(null);
    setError(null);
    testMutation.mutate(
      { channelId: channel.id as ChannelId, request: { credentials: formData } },
      {
        onSuccess: (result) => setTestResult(result),
        onError: (err: Error) => setError(t('channels.connect.testFailed', { error: err.message ?? t('common.unknownError') })),
      },
    );
  }, [channel.id, formData, testMutation, t]);

  const handleConnect = useCallback(async () => {
    setError(null);
    connectMutation.mutate(
      { channelId: channel.id as ChannelId, request: { credentials: formData } },
      {
        onSuccess: () => onConnected(),
        onError: (err: Error) => setError(t('channels.connect.errorConnecting', { channel: channel.name }) + (err.message ? ` (${err.message})` : '')),
      },
    );
  }, [channel.id, channel.name, formData, connectMutation, onConnected, t]);

  const handleClose = useCallback(() => {
    if (!connectMutation.isPending) {
      setFormData({});
      setTestResult(null);
      setError(null);
      connectMutation.reset();
      testMutation.reset();
      onClose();
    }
  }, [connectMutation, testMutation, onClose]);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      {/* ─── Header ──────────────────────────────────────────────── */}
      <DialogTitle
        sx={{
          background: channel.brandGradient,
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          py: 1.5,
          px: 2.5,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {channel.logo && (
            <Box
              component="img"
              src={channel.logo}
              alt={channel.name}
              sx={{ height: 24, objectFit: 'contain', filter: 'brightness(1.05) drop-shadow(0 1px 2px rgba(0,0,0,0.3))' }}
            />
          )}
          <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700 }}>
            {t('channels.connect.title', { channel: channel.name })}
          </Typography>
        </Box>
        <IconButton onClick={handleClose} size="small" aria-label={t('common.close')} sx={{ color: 'rgba(255,255,255,0.8)' }}>
          <Close fontSize="small" />
        </IconButton>
      </DialogTitle>

      {/* ─── Content ─────────────────────────────────────────────── */}
      <DialogContent sx={{ pt: 2.5, pb: 1 }}>
        <Typography sx={{ fontSize: '0.8125rem', color: 'text.secondary', mb: 2 }}>
          {t('channels.connect.description', { channel: channel.name })}
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {fields.map((field) => (
            <TextField
              key={field.key}
              label={t(field.labelKey)}
              type={field.type}
              value={formData[field.key] ?? ''}
              onChange={(e) => handleFieldChange(field.key, e.target.value)}
              required={field.required}
              placeholder={field.placeholder}
              size="small"
              fullWidth
              autoComplete="off"
            />
          ))}
        </Box>

        {/* Test result */}
        {testResult && (
          <Alert
            severity={testResult.success ? 'success' : 'error'}
            icon={testResult.success ? <CheckCircle fontSize="small" /> : undefined}
            sx={{ mt: 2, fontSize: '0.8125rem' }}
          >
            {testResult.success
              ? t('channels.connect.testSuccess', { name: testResult.channelPropertyName ?? '' })
              : testResult.message}
          </Alert>
        )}

        {/* Error */}
        {error && (
          <Alert severity="error" sx={{ mt: 2, fontSize: '0.8125rem' }}>
            {error}
          </Alert>
        )}
      </DialogContent>

      {/* ─── Actions ─────────────────────────────────────────────── */}
      <DialogActions sx={{ px: 2.5, pb: 2, gap: 1 }}>
        <Button
          variant="outlined"
          size="small"
          startIcon={testMutation.isPending ? <CircularProgress size={14} color="inherit" /> : <Science />}
          onClick={handleTest}
          disabled={!isFormValid || testMutation.isPending || connectMutation.isPending}
          sx={{ fontSize: '0.8125rem', textTransform: 'none' }}
        >
          {t('channels.connect.testConnection')}
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button
          onClick={handleClose}
          size="small"
          disabled={connectMutation.isPending}
          sx={{ fontSize: '0.8125rem', textTransform: 'none' }}
        >
          {t('common.cancel')}
        </Button>
        <Button
          variant="contained"
          size="small"
          onClick={handleConnect}
          disabled={!isFormValid || connectMutation.isPending}
          sx={{
            fontSize: '0.8125rem',
            textTransform: 'none',
            backgroundColor: channel.brandColor,
            '&:hover': { backgroundColor: channel.brandColor, filter: 'brightness(0.9)' },
          }}
        >
          {connectMutation.isPending
            ? <CircularProgress size={16} color="inherit" />
            : t('channels.connect.connectButton')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
