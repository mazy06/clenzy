import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  AlertDescription,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Spinner,
} from '../../../components/ui';
import { CheckCircle, ErrorOutline, Refresh } from '../../../icons';
import { cn } from '../../../utils/cn';
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

  const [creating, setCreating] = useState(false);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [status, setStatus] = useState<OpenWaStatus>('not_configured');
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Refs pour les timers (cleanup au close du Dialog ou success)
  const pollTimerRef = useRef<number | null>(null);
  const qrRefreshTimerRef = useRef<number | null>(null);
  const onSuccessRef = useRef(onSuccess);
  useEffect(() => {
    onSuccessRef.current = onSuccess;
  }, [onSuccess]);

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
        <div className="flex flex-col items-center gap-3 py-6">
          <Spinner className="size-8" />
          <p className="text-xs text-muted-foreground">
            {t('settings.whatsapp.qr.creating', 'Création de la session sur l\'instance OpenWA…')}
          </p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col gap-3 py-3">
          <Alert variant="destructive">
            <ErrorOutline size={20} />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button variant="outline" size="sm" onClick={handleRetry}>
            <Refresh size={14} />
            {t('common.retry', 'Réessayer')}
          </Button>
        </div>
      );
    }

    if (status === 'connected') {
      return (
        <div className="flex flex-col items-center gap-3 py-6">
          {/* Pastille illustrative : la teinte vive est ici a sa place (aplat +
              icone decorative), le titre porte le sens. */}
          <div className="size-[72px] rounded-full flex items-center justify-center text-success bg-success-soft">
            <CheckCircle size={40} />
          </div>
          <div className="text-center">
            <h6 className="text-sm font-semibold tracking-tight mb-0.5">
              {t('settings.whatsapp.qr.connected', 'WhatsApp connecté')}
            </h6>
            {phoneNumber && (
              <p className="text-xs text-muted-foreground tabular-nums">
                {phoneNumber}
              </p>
            )}
          </div>
        </div>
      );
    }

    if (status === 'failed') {
      return (
        <div className="flex flex-col gap-3 py-3">
          <Alert variant="destructive">
            <ErrorOutline size={20} />
            <AlertDescription>
              {t('settings.whatsapp.qr.failed',
                "L'authentification WhatsApp a échoué. Le compte est peut-être banni ou nécessite une vérification 2FA.")}
            </AlertDescription>
          </Alert>
          <Button variant="outline" size="sm" onClick={handleRetry}>
            <Refresh size={14} />
            {t('common.retry', 'Réessayer')}
          </Button>
        </div>
      );
    }

    // qr_pending ou disconnected
    return (
      <div className="flex flex-col items-center gap-[15px]">
        {qrImage ? (
          // Fond blanc franc, et non une surface teintee : la zone de silence
          // d'un QR code doit rester du blanc pur pour rester lisible par les
          // scanners, en clair comme en sombre.
          <div className="p-[15px] bg-white rounded-2xl border border-solid border-border">
            <img className="block size-[240px]" src={qrImage} alt="QR code WhatsApp" />
          </div>
        ) : (
          <div className="w-[240px] h-[240px] flex items-center justify-center">
            <Spinner className="size-7" />
          </div>
        )}
        <div className="flex flex-col gap-0.5 text-center max-w-[360px]">
          <h6 className="text-sm font-semibold tracking-tight">
            {t('settings.whatsapp.qr.title', 'Scannez avec WhatsApp')}
          </h6>
          <span className="text-xs text-muted-foreground">
            {t('settings.whatsapp.qr.instructions',
              "Ouvrez WhatsApp sur votre téléphone → Paramètres → Appareils connectés → Connecter un appareil")}
          </span>
        </div>
        {/* L'attente du scan est un etat transitoire : encre `-ink` (le libelle
            est du texte), neutre tant que l'initialisation n'est pas finie. */}
        <div className={cn(
          'flex items-center gap-1.5',
          status === 'qr_pending' ? 'text-warning-ink' : 'text-muted-foreground',
        )}>
          <Spinner className="size-3" />
          <span className="text-xs">
            {status === 'qr_pending'
              ? t('settings.whatsapp.qr.waiting', 'En attente du scan…')
              : t('settings.whatsapp.qr.pending', 'Initialisation…')}
          </span>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      {/* La croix de fermeture est rendue par DialogContent : l'IconButton
          pose a la main dans le titre faisait doublon. */}
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{t('settings.whatsapp.qr.dialogTitle', 'Connexion OpenWA')}</DialogTitle>
        </DialogHeader>
        {renderBody()}
        {status !== 'connected' && (
          <DialogFooter>
            <Button variant="ghost" onClick={onClose}>{t('common.close', 'Fermer')}</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
