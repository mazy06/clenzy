import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Alert as UiAlert, AlertDescription } from '../../components/ui';
import { TriangleAlert } from 'lucide-react';
import { Spinner } from '../../components/ui';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Alert, IconButton } from '@mui/material';
import { Close, CheckCircle, Science } from '../../icons';
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
      {/* ─── Header — pastille logo (marque sur le logo, jamais en aplat/dégradé) ── */}
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1.5,
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          {channel.logo && (
            <div className="inline-flex items-center justify-center h-[36px] px-2 rounded-[10px] bg-[var(--field)] shrink-0">
              <img className="h-[20px] object-contain" src={channel.logo} alt={channel.name} />
            </div>
          )}
          <p className="cn-text-body1 font-[family-name:var(--font-display)] text-[1rem] font-semibold text-[var(--ink)]">
            {t('channels.connect.title', { channel: channel.name })}
          </p>
        </div>
        <IconButton onClick={handleClose} size="small" aria-label={t('common.close')}>
          <Close fontSize="small" />
        </IconButton>
      </DialogTitle>

      {/* ─── Content ─────────────────────────────────────────────── */}
      <DialogContent sx={{ pt: 2.5, pb: 1 }}>
        <p className="cn-text-body1 text-[0.8125rem] text-muted-foreground mb-3">
          {t('channels.connect.description', { channel: channel.name })}
        </p>

        <div className="flex flex-col gap-3">
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
        </div>

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
          <UiAlert variant="destructive" className="mt-3 text-[0.8125rem]">
            <TriangleAlert />
            <AlertDescription>{error}</AlertDescription>
          </UiAlert>
        )}
      </DialogContent>

      {/* ─── Actions ─────────────────────────────────────────────── */}
      <DialogActions sx={{ px: 2.5, pb: 2, gap: 1 }}>
        <Button
          variant="outlined"
          size="small"
          startIcon={testMutation.isPending ? <Spinner className="size-3.5" /> : <Science />}
          onClick={handleTest}
          disabled={!isFormValid || testMutation.isPending || connectMutation.isPending}
        >
          {t('channels.connect.testConnection')}
        </Button>
        <div className="flex-1" />
        <Button
          onClick={handleClose}
          size="small"
          disabled={connectMutation.isPending}
        >
          {t('common.cancel')}
        </Button>
        <Button
          variant="contained"
          size="small"
          onClick={handleConnect}
          disabled={!isFormValid || connectMutation.isPending}
        >
          {connectMutation.isPending
            ? <Spinner className="size-4" />
            : t('channels.connect.connectButton')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
