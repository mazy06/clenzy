import React, { useCallback, useEffect, useRef, useState } from 'react';
import StatusChip from '../../../components/StatusChip';
import { Spinner } from '../../../components/ui';
import { Card } from '../../../components/ui';
import {
  Alert,
  AlertAction,
  AlertDescription,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../../components/ui';
import { X } from 'lucide-react';
import { Button } from '../../../components/ui';
import {
  CheckCircle as CheckCircleIcon,
  ErrorOutline,
  Link as LinkIcon,
  LinkOff as LinkOffIcon,
} from '../../../icons';
import ProviderLogo, { type ProviderId } from './ProviderLogos';
import ServiceTooltip from './ServiceTooltip';

/**
 * Card generique pour les providers de signature electronique en OAuth2
 * (Pennylane, DocuSign, ...).
 *
 * <h2>Contrat</h2>
 * Le composant ne connait pas l'API concrete du provider. Il prend en parametre
 * un {@link OAuthApiAdapter} qui expose 3 methodes (connect / disconnect /
 * getStatus). C'est l'application du Dependency Inversion Principle cote
 * frontend : la card depend d'une abstraction, pas d'un client concret.
 *
 * <h2>Etats geres</h2>
 * <ul>
 *   <li>Loading initial (premier fetch du status)</li>
 *   <li>Non configure (404 sur /status — feature flag OFF cote backend)</li>
 *   <li>Non connecte (status.connected = false)</li>
 *   <li>Connecte (status.connected = true) — affiche connectedAt + scopes</li>
 *   <li>Erreur (status.status = ERROR)</li>
 * </ul>
 */

const ACCENT = 'var(--ok)';
const NEUTRAL = 'var(--muted)';

export interface OAuthCardStatus {
  connected: boolean;
  connectedAt?: string;
  scopes?: string;
  status?: string;
  errorMessage?: string;
}

export interface OAuthApiAdapter {
  connect(): Promise<{ authorization_url?: string; status: string; message?: string }>;
  disconnect(): Promise<void>;
  getStatus(): Promise<OAuthCardStatus>;
}

interface OAuthProviderCardProps {
  /** Identifiant logo + couleur (cf. ProviderLogos.tsx). */
  providerId: ProviderId;
  /** Nom commercial affiche dans le header. */
  label: string;
  /** Phrase descriptive sous le titre. */
  description: string;
  /** Adapter API : injecte ses methodes pour decoupler la card du client concret. */
  api: OAuthApiAdapter;
  /** Notifie le parent du statut de connexion (load / connect / disconnect). */
  onStatusChange?: (connected: boolean) => void;
  /** Action secondaire optionnelle (icône) rendue à gauche du bouton d'action principal. */
  secondaryAction?: React.ReactNode;
  /** Clé SERVICE_TOOLTIPS : enveloppe la zone descriptive d'un tooltip riche (détails du service). */
  serviceTooltipId?: string;
  /** Désactive le bouton de connexion (ex: prérequis manquant) ; le motif est porté par le tooltip. */
  mainActionDisabled?: boolean;
  /** Motif de désactivation affiché en tooltip sur le bouton de connexion. */
  mainActionDisabledReason?: string;
  /** Texte i18n eventuel (fallback inline si absent). */
  labels?: {
    connectedAt?: string;
    scopes?: string;
    connect?: string;
    disconnect?: string;
    confirmDisconnect?: string;
    confirmDisconnectMessage?: string;
    cancel?: string;
    confirm?: string;
    notConfigured?: string;
    notConfiguredHelp?: string;
  };
}


export default function OAuthProviderCard({
  providerId,
  label,
  description,
  api,
  onStatusChange,
  secondaryAction,
  mainActionDisabled,
  mainActionDisabledReason,
  serviceTooltipId,
  labels = {},
}: OAuthProviderCardProps) {
  const [status, setStatus] = useState<OAuthCardStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [notConfigured, setNotConfigured] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Pattern "latest callback ref" : evite la boucle de render quand le
  // parent passe une arrow function inline (la reference change a chaque
  // render -> effet relance -> setState -> re-render -> boucle infinie).
  const onStatusChangeRef = useRef(onStatusChange);
  useEffect(() => { onStatusChangeRef.current = onStatusChange; }, [onStatusChange]);

  const loadStatus = useCallback(async () => {
    try {
      const s = await api.getStatus();
      setStatus(s);
      setNotConfigured(false);
      onStatusChangeRef.current?.(!!s.connected);
    } catch (err) {
      const httpStatus = (err as { status?: number } | null)?.status;
      if (httpStatus === 404) {
        // Feature flag OFF — backend bean conditionnel non instancie
        setNotConfigured(true);
        onStatusChangeRef.current?.(false);
      } else {
        setStatus({ connected: false });
        onStatusChangeRef.current?.(false);
      }
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  const handleConnect = async () => {
    setActionLoading(true);
    setMessage(null);
    try {
      const result = await api.connect();
      if (result.authorization_url) {
        window.location.href = result.authorization_url;
      } else if (result.status === 'already_connected') {
        await loadStatus();
      }
    } catch {
      setMessage({ type: 'error', text: `Impossible de se connecter à ${label}.` });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setActionLoading(true);
    try {
      await api.disconnect();
      setStatus({ connected: false });
      onStatusChangeRef.current?.(false);
      setDisconnectOpen(false);
      setMessage({ type: 'success', text: `${label} déconnecté.` });
    } catch {
      setMessage({ type: 'error', text: `Erreur lors de la déconnexion de ${label}.` });
    } finally {
      setActionLoading(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Card className="gap-0 py-0 border-border p-4 flex justify-center">
        <Spinner className="size-7 text-[var(--ok)]" />
      </Card>
    );
  }

  const isConnected = !!status?.connected;
  const isError = status?.status === 'ERROR';

  const statusChip = notConfigured ? (
    <StatusChip color={NEUTRAL} label={labels.notConfigured ?? 'Non configuré'} icon={<ErrorOutline size={11} strokeWidth={2} />} />
  ) : isError ? (
    <StatusChip color={'var(--err)'} label="Erreur" icon={<ErrorOutline size={11} strokeWidth={2} />} />
  ) : isConnected ? (
    <StatusChip color={ACCENT} label="Connecté" icon={<CheckCircleIcon size={11} strokeWidth={2} />} />
  ) : (
    <StatusChip color={NEUTRAL} label="Non connecté" icon={<ErrorOutline size={11} strokeWidth={2} />} />
  );

  const connectTooltip = mainActionDisabled
    ? (mainActionDisabledReason ?? `Action indisponible pour ${label}.`)
    : (labels.connect ?? `Se connecter via ${label}`);

  // Bouton d'action principal en icône seule (libellé porté par le tooltip).
  // Le <span> reste : un bouton desactive n'emet pas d'evenement de pointeur,
  // le tooltip ne s'ouvrirait jamais si le declencheur etait le bouton lui-meme.
  const mainAction = notConfigured ? null : isConnected ? (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setDisconnectOpen(true)}
            disabled={actionLoading}
            aria-label={labels.disconnect ?? `Déconnecter ${label}`}
            className="text-[var(--muted)] hover:bg-[var(--err-soft)] hover:text-[var(--err)]"
          >
            <LinkOffIcon size={16} strokeWidth={2} />
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>{labels.disconnect ?? `Déconnecter ${label}`}</TooltipContent>
    </Tooltip>
  ) : (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleConnect}
            disabled={actionLoading || mainActionDisabled}
            aria-label={connectTooltip}
            className="text-[var(--ok)] hover:bg-[var(--ok-soft)] hover:text-[var(--ok)]"
          >
            {actionLoading
              ? <Spinner className="size-4 text-[var(--ok)]" />
              : <LinkIcon size={16} strokeWidth={2} />}
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>{connectTooltip}</TooltipContent>
    </Tooltip>
  );

  // Zone descriptive (logo + titre + statut + description). C'est l'ancre du tooltip riche du service,
  // tenue à l'écart des boutons (frères) pour qu'aucun tooltip ne s'imbrique.
  const infoZone = (
    <div className="flex items-start gap-2 flex-1 min-w-0">
      <ProviderLogo provider={providerId} size={40} muted={notConfigured} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="cn-text-body1 text-[0.875rem] font-semibold">{label}</p>
          {statusChip}
        </div>
        <p className="cn-text-body1 truncate text-[0.72rem] text-muted-foreground mt-0.5">
          {description}
        </p>
      </div>
    </div>
  );

  return (
    <Card className="gap-0 overflow-hidden py-0 transition-colors duration-200 hover:border-[color-mix(in_srgb,var(--ok)_25%,transparent)]">
      {/* Carte compacte : zone descriptive (tooltip riche du service) + actions en icônes à droite. */}
      <div className="px-3 py-2.5 flex items-start gap-1.5">
        {serviceTooltipId ? (
          <ServiceTooltip providerId={serviceTooltipId} name={label}>{infoZone}</ServiceTooltip>
        ) : (
          infoZone
        )}
        <div className="flex items-center gap-0.5 shrink-0">
          {secondaryAction}
          {mainAction}
        </div>
      </div>

      {message && (
        <div className="px-3 pb-[9px] mt-[-3px]">
          <Alert variant={message.type === 'success' ? 'success' : 'destructive'} className="text-[0.75rem]">
            <AlertDescription>{message.text}</AlertDescription>
            <AlertAction>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Fermer le message"
                onClick={() => setMessage(null)}
              >
                <X size={14} strokeWidth={2} />
              </Button>
            </AlertAction>
          </Alert>
        </div>
      )}

      {/* Dialog confirmation */}
      <Dialog open={disconnectOpen} onOpenChange={(next) => !next && setDisconnectOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{labels.confirmDisconnect ?? `Déconnecter ${label} ?`}</DialogTitle>
            <DialogDescription>
              {labels.confirmDisconnectMessage ??
                `Cette action révoquera le token et déconnectera ${label} de votre organisation. Vous pourrez vous reconnecter à tout moment.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisconnectOpen(false)} disabled={actionLoading}>
              {labels.cancel ?? 'Annuler'}
            </Button>
            <Button
              onClick={handleDisconnect}
              variant="destructive"
              disabled={actionLoading}
            >
              {actionLoading ? <Spinner className="size-3.5" /> : (labels.confirm ?? 'Déconnecter')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
