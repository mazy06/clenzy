import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
  alpha,
  useTheme,
} from '@mui/material';
import { CheckCircle, ErrorOutline, Close, Refresh } from '../../../icons';
import { useTranslation } from '../../../hooks/useTranslation';
import {
  whatsAppConfigApi,
  type OpenWaStatus,
} from '../../../services/api/whatsAppConfigApi';

/**
 * Dialog modal pour scanner un QR code et provisionner une session OpenWA.
 *
 * <h2>Flow utilisateur</h2>
 * <ol>
 *   <li>User clique "Scanner le QR code" dans WhatsAppProviderConfigSection</li>
 *   <li>Le Dialog ouvre, appelle POST /api/whatsapp/openwa/session (cree la
 *       session sur l'instance OpenWA partagee + persist les credentials chiffres)</li>
 *   <li>Affiche l'image QR (GET /api/whatsapp/openwa/qr) avec instructions FR</li>
 *   <li>Polling status toutes les 2s (GET /api/whatsapp/openwa/status)</li>
 *   <li>Quand status=connected : affiche succes, ferme apres 2s, callback {@link onSuccess}</li>
 *   <li>Quand status=failed : affiche erreur, propose retry (regenere QR)</li>
 * </ol>
 *
 * <h2>Annulation</h2>
 * Si l'user ferme le Dialog avant la connexion, on garde la session cree
 * (volontaire — il pourra rouvrir le Dialog pour reprendre le scan). Pour
 * vraiment annuler, il faut un bouton "Annuler la session" qui appelle
 * DELETE /api/whatsapp/openwa/session.
 */
export interface OpenWaQrScanDialogProps {
  open: boolean;
  onClose: () => void;
  /** Callback appele quand la session est connectee avec succes. Le parent
   *  doit refresh la config pour voir le sessionId + hasOpenwaApiKey. */
  onSuccess: () => void;
}

const POLL_INTERVAL_MS = 2000;
const QR_REFRESH_MS = 30_000; // WhatsApp regen un QR toutes les ~20-30s

export default function OpenWaQrScanDialog({
  open,
  onClose,
  onSuccess,
}: OpenWaQrScanDialogProps) {
  const { t } = useTranslation();
  const theme = useTheme();

  const [creating, setCreating] = useState(false);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [status, setStatus] = useState<OpenWaStatus>('not_configured');
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Refs pour les timers (cleanup au close du Dialog ou success)
  const pollTimerRef = useRef<number | null>(null);
  const qrRefreshTimerRef = useRef<number | null>(null);
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;

  // Cleanup helper utilise par close, success, error
  const cleanup = () => {
    if (pollTimerRef.current) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (qrRefreshTimerRef.current) {
      window.clearInterval(qrRefreshTimerRef.current);
      qrRefreshTimerRef.current = null;
    }
  };

  // Initialisation : a l'ouverture, on cree la session (idempotent backend),
  // puis on demarre le polling + auto-refresh du QR.
  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setError(null);
    setQrImage(null);
    setStatus('not_configured');
    setPhoneNumber(null);

    const init = async () => {
      try {
        setCreating(true);
        await whatsAppConfigApi.createOpenWaSession();
        if (cancelled) return;

        // Charger le QR initial
        await refreshQr();
        if (cancelled) return;

        // Demarrer polling status
        pollTimerRef.current = window.setInterval(() => {
          void pollStatus();
        }, POLL_INTERVAL_MS);

        // Auto-refresh du QR toutes les 30s (au cas ou WhatsApp le regen)
        qrRefreshTimerRef.current = window.setInterval(() => {
          void refreshQr();
        }, QR_REFRESH_MS);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : t('settings.whatsapp.qr.errorCreate',
            "Impossible de creer la session OpenWA. Vérifie que le container est demarre."));
        }
      } finally {
        if (!cancelled) setCreating(false);
      }
    };

    void init();
    return () => {
      cancelled = true;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const refreshQr = async () => {
    try {
      const resp = await whatsAppConfigApi.getOpenWaQr();
      setQrImage(resp.qr);
    } catch (e) {
      // 404 = session deja connectee (status devrait passer a `connected` au prochain poll)
      const status = (e as { status?: number })?.status;
      if (status !== 404) {
        setError(e instanceof Error ? e.message : 'QR indisponible');
      }
    }
  };

  const pollStatus = async () => {
    try {
      const resp = await whatsAppConfigApi.getOpenWaStatus();
      setStatus(resp.status);
      if (resp.phoneNumber) setPhoneNumber(resp.phoneNumber);

      // Etats terminaux : on stoppe le polling
      if (resp.status === 'connected') {
        cleanup();
        // Laisse 1.5s a l'user pour voir le succes, puis ferme + callback
        window.setTimeout(() => {
          onSuccessRef.current();
        }, 1500);
      } else if (resp.status === 'failed') {
        cleanup();
      }
    } catch {
      // Silent : un poll qui echoue n'est pas critique, on retry au tick suivant
    }
  };

  const handleRetry = async () => {
    setError(null);
    setStatus('not_configured');
    cleanup();
    // Recree la session (delete + create cote backend, sinon on garde la meme
    // sessionId mais on relance le QR)
    try {
      await whatsAppConfigApi.deleteOpenWaSession();
      await whatsAppConfigApi.createOpenWaSession();
      await refreshQr();
      pollTimerRef.current = window.setInterval(() => void pollStatus(), POLL_INTERVAL_MS);
      qrRefreshTimerRef.current = window.setInterval(() => void refreshQr(), QR_REFRESH_MS);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Retry impossible');
    }
  };

  // ─── Rendu ────────────────────────────────────────────────────────

  const renderBody = () => {
    if (creating) {
      return (
        <Stack alignItems="center" spacing={2} sx={{ py: 4 }}>
          <CircularProgress size={32} />
          <Typography variant="body2" color="text.secondary">
            {t('settings.whatsapp.qr.creating', 'Création de la session sur l\'instance OpenWA…')}
          </Typography>
        </Stack>
      );
    }

    if (error) {
      return (
        <Stack spacing={2} sx={{ py: 2 }}>
          <Alert severity="error" icon={<ErrorOutline size={20} />}>
            {error}
          </Alert>
          <Button variant="outlined" startIcon={<Refresh size={14} />} onClick={handleRetry} size="small">
            {t('common.retry', 'Réessayer')}
          </Button>
        </Stack>
      );
    }

    if (status === 'connected') {
      return (
        <Stack alignItems="center" spacing={2} sx={{ py: 4 }}>
          <Box sx={{
            width: 72, height: 72, borderRadius: '50%',
            bgcolor: alpha(theme.palette.success.main, 0.12),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: theme.palette.success.main,
          }}>
            <CheckCircle size={40} />
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
              {t('settings.whatsapp.qr.connected', 'WhatsApp connecté')}
            </Typography>
            {phoneNumber && (
              <Typography variant="body2" color="text.secondary">
                {phoneNumber}
              </Typography>
            )}
          </Box>
        </Stack>
      );
    }

    if (status === 'failed') {
      return (
        <Stack spacing={2} sx={{ py: 2 }}>
          <Alert severity="error" icon={<ErrorOutline size={20} />}>
            {t('settings.whatsapp.qr.failed',
              "L'authentification WhatsApp a échoué. Le compte est peut-être banni ou nécessite une vérification 2FA.")}
          </Alert>
          <Button variant="outlined" startIcon={<Refresh size={14} />} onClick={handleRetry} size="small">
            {t('common.retry', 'Réessayer')}
          </Button>
        </Stack>
      );
    }

    // qr_pending ou disconnected
    return (
      <Stack alignItems="center" spacing={2.5}>
        {qrImage ? (
          <Box sx={{
            p: 2.5,
            bgcolor: '#fff',
            borderRadius: 2,
            border: `1px solid ${alpha(theme.palette.text.primary, 0.08)}`,
          }}>
            <Box
              component="img"
              src={qrImage}
              alt="QR code WhatsApp"
              sx={{ display: 'block', width: 240, height: 240 }}
            />
          </Box>
        ) : (
          <Box sx={{ width: 240, height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CircularProgress size={28} />
          </Box>
        )}
        <Stack spacing={0.5} sx={{ textAlign: 'center', maxWidth: 360 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            {t('settings.whatsapp.qr.title', 'Scannez avec WhatsApp')}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t('settings.whatsapp.qr.instructions',
              "Ouvrez WhatsApp sur votre téléphone → Paramètres → Appareils connectés → Connecter un appareil")}
          </Typography>
        </Stack>
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 1,
          color: status === 'qr_pending' ? 'warning.main' : 'text.secondary',
        }}>
          <CircularProgress size={12} thickness={5} color={status === 'qr_pending' ? 'warning' : 'inherit'} />
          <Typography variant="caption">
            {status === 'qr_pending'
              ? t('settings.whatsapp.qr.waiting', 'En attente du scan…')
              : t('settings.whatsapp.qr.pending', 'Initialisation…')}
          </Typography>
        </Box>
      </Stack>
    );
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>{t('settings.whatsapp.qr.dialogTitle', 'Connexion OpenWA')}</span>
        <IconButton onClick={onClose} size="small" aria-label="close">
          <Close size={18} />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        {renderBody()}
      </DialogContent>
      {status !== 'connected' && (
        <DialogActions>
          <Button onClick={onClose}>{t('common.close', 'Fermer')}</Button>
        </DialogActions>
      )}
    </Dialog>
  );
}
