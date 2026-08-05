import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Alert as UiAlert, AlertDescription, Button } from '../../components/ui';
import { TriangleAlert } from 'lucide-react';
import { Spinner } from '../../components/ui';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldLabel,
  Input,
} from '../../components/ui';
import { CheckCircle, Science } from '../../icons';
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
    // Pleine largeur plafonnee a 600 px. La croix de fermeture est celle du
    // primitif : un bouton d'icone dans le titre ferait doublon.
    <Dialog open={open} onOpenChange={(next) => { if (!next) handleClose(); }}>
      <DialogContent className="w-full sm:max-w-[600px]">
        {/* ─── Header — pastille logo (marque sur le logo, jamais en aplat/dégradé) ── */}
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 min-w-0 pe-8">
            {channel.logo && (
              <span className="inline-flex items-center justify-center h-[36px] px-2 rounded-lg bg-field shrink-0">
                <img className="h-[20px] object-contain" src={channel.logo} alt={channel.name} />
              </span>
            )}
            <span className="font-[family-name:var(--font-display)] text-base font-semibold text-foreground truncate">
              {t('channels.connect.title', { channel: channel.name })}
            </span>
          </DialogTitle>
        </DialogHeader>

        {/* ─── Content ─────────────────────────────────────────────── */}
        <div>
        <p className="text-sm text-muted-foreground mb-3">
          {t('channels.connect.description', { channel: channel.name })}
        </p>

        <div className="flex flex-col gap-3">
          {fields.map((credential) => (
            // L'identifiant derive de la cle du credential : stable et unique dans
            // la modale, contrairement a l'index de la boucle.
            <Field key={credential.key}>
              <FieldLabel htmlFor={`channel-cred-${credential.key}`}>{t(credential.labelKey)}</FieldLabel>
              <Input
                id={`channel-cred-${credential.key}`}
                type={credential.type}
                value={formData[credential.key] ?? ''}
                onChange={(e) => handleFieldChange(credential.key, e.target.value)}
                required={credential.required}
                placeholder={credential.placeholder}
                autoComplete="off"
              />
            </Field>
          ))}
        </div>

        {/* Test result */}
        {testResult && (
          <UiAlert variant={testResult.success ? 'success' : 'destructive'} className="mt-3 text-sm">
            {testResult.success ? <CheckCircle /> : <TriangleAlert />}
            <AlertDescription>
              {testResult.success
                ? t('channels.connect.testSuccess', { name: testResult.channelPropertyName ?? '' })
                : testResult.message}
            </AlertDescription>
          </UiAlert>
        )}

        {/* Error */}
        {error && (
          <UiAlert variant="destructive" className="mt-3 text-sm">
            <TriangleAlert />
            <AlertDescription>{error}</AlertDescription>
          </UiAlert>
        )}
        </div>

        {/* ─── Actions ─────────────────────────────────────────────── */}
        <DialogFooter className="sm:justify-start">
          <Button
            variant="outline"
            size="sm"
            onClick={handleTest}
            disabled={!isFormValid || testMutation.isPending || connectMutation.isPending}
          >
            {testMutation.isPending ? <Spinner className="size-3.5" /> : <Science />}
            {t('channels.connect.testConnection')}
          </Button>
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            disabled={connectMutation.isPending}
          >
            {t('common.cancel')}
          </Button>
          <Button
            size="sm"
            onClick={handleConnect}
            disabled={!isFormValid || connectMutation.isPending}
          >
            {connectMutation.isPending
              ? <Spinner className="size-4" />
              : t('channels.connect.connectButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
