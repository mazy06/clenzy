import React, { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Chip,
  CircularProgress,
  Alert,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  ErrorOutline,
  Link as LinkIcon,
  LinkOff as LinkOffIcon,
} from '../../../icons';
import ProviderLogo, { type ProviderId } from './ProviderLogos';

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

const ACCENT = '#4A9B8E';
const NEUTRAL = '#8A8378';

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

const buildStatusChipSx = (color: string) => ({
  height: 22,
  fontSize: '0.6875rem',
  fontWeight: 600,
  letterSpacing: '0.01em',
  borderRadius: '6px',
  px: 0.25,
  backgroundColor: `${color}14`,
  color,
  border: `1px solid ${color}33`,
  '& .MuiChip-icon': { color: `${color} !important`, ml: '6px', mr: '-2px' },
  '& .MuiChip-label': { px: 0.875 },
});

export default function OAuthProviderCard({
  providerId,
  label,
  description,
  api,
  labels = {},
}: OAuthProviderCardProps) {
  const [status, setStatus] = useState<OAuthCardStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [notConfigured, setNotConfigured] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const s = await api.getStatus();
      setStatus(s);
      setNotConfigured(false);
    } catch (err) {
      const httpStatus = (err as { status?: number } | null)?.status;
      if (httpStatus === 404) {
        // Feature flag OFF — backend bean conditionnel non instancie
        setNotConfigured(true);
      } else {
        setStatus({ connected: false });
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
      <Paper
        elevation={0}
        sx={{ borderRadius: '12px', border: '1px solid', borderColor: 'divider', boxShadow: 'none', p: 3, display: 'flex', justifyContent: 'center' }}
      >
        <CircularProgress size={28} sx={{ color: ACCENT }} />
      </Paper>
    );
  }

  const isConnected = !!status?.connected;
  const isError = status?.status === 'ERROR';

  const statusChip = notConfigured ? (
    <Chip
      icon={<ErrorOutline size={11} strokeWidth={2} />}
      label={labels.notConfigured ?? 'Non configuré'}
      size="small"
      sx={buildStatusChipSx(NEUTRAL)}
    />
  ) : isError ? (
    <Chip
      icon={<ErrorOutline size={11} strokeWidth={2} />}
      label="Erreur"
      size="small"
      sx={buildStatusChipSx('#C97A7A')}
    />
  ) : isConnected ? (
    <Chip
      icon={<CheckCircleIcon size={11} strokeWidth={2} />}
      label="Connecté"
      size="small"
      sx={buildStatusChipSx(ACCENT)}
    />
  ) : (
    <Chip
      icon={<ErrorOutline size={11} strokeWidth={2} />}
      label="Non connecté"
      size="small"
      sx={buildStatusChipSx(NEUTRAL)}
    />
  );

  return (
    <Paper
      elevation={0}
      sx={{
        borderRadius: '12px',
        border: '1px solid',
        borderColor: 'divider',
        boxShadow: 'none',
        overflow: 'hidden',
        transition: 'border-color 200ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 200ms cubic-bezier(0.22, 1, 0.36, 1)',
        '&:hover': {
          borderColor: `${ACCENT}40`,
          boxShadow: '0 1px 2px rgba(45, 55, 72, 0.04), 0 4px 12px rgba(45, 55, 72, 0.06)',
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          px: 2,
          py: 1.75,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 1.5,
          borderBottom: isConnected ? '1px solid' : undefined,
          borderColor: 'divider',
        }}
      >
        <ProviderLogo provider={providerId} size={40} muted={notConfigured} />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography sx={{ fontSize: '0.875rem', fontWeight: 600 }}>{label}</Typography>
            {statusChip}
          </Box>
          <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', mt: 0.25 }}>
            {description}
          </Typography>
        </Box>
      </Box>

      {/* Body */}
      <Box sx={{ px: 2, py: 1.75 }}>
        {notConfigured ? (
          <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>
            {labels.notConfiguredHelp ??
              `${label} n'est pas configuré sur cet environnement. Contactez l'administrateur Clenzy pour activer l'intégration.`}
          </Typography>
        ) : isConnected ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {status?.connectedAt && (
              <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>
                <strong>Connecté le :</strong>{' '}
                {new Date(status.connectedAt).toLocaleString('fr-FR')}
              </Typography>
            )}
            {status?.scopes && (
              <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>
                <strong>Scopes :</strong> {status.scopes}
              </Typography>
            )}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 0.5 }}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<LinkOffIcon size={14} strokeWidth={2} />}
                onClick={() => setDisconnectOpen(true)}
                disabled={actionLoading}
                sx={{
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '0.78rem',
                  borderRadius: '8px',
                  py: 0.625,
                  px: 1.5,
                }}
              >
                {labels.disconnect ?? 'Déconnecter'}
              </Button>
            </Box>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="contained"
              size="small"
              startIcon={<LinkIcon size={14} strokeWidth={2} />}
              onClick={handleConnect}
              disabled={actionLoading}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.78rem',
                bgcolor: ACCENT,
                color: '#fff',
                borderRadius: '8px',
                py: 0.625,
                px: 1.5,
                boxShadow: 'none',
                '&:hover': { bgcolor: ACCENT, filter: 'brightness(0.94)' },
              }}
            >
              {actionLoading ? <CircularProgress size={14} sx={{ color: '#fff' }} /> : (labels.connect ?? `Se connecter via ${label}`)}
            </Button>
          </Box>
        )}

        {message && (
          <Alert
            severity={message.type}
            variant="outlined"
            sx={{ mt: 1.5, borderRadius: '8px', fontSize: '0.75rem', py: 0.25 }}
            onClose={() => setMessage(null)}
          >
            {message.text}
          </Alert>
        )}
      </Box>

      {/* Dialog confirmation */}
      <Dialog open={disconnectOpen} onClose={() => setDisconnectOpen(false)}>
        <DialogTitle sx={{ fontSize: '1rem', fontWeight: 600 }}>
          {labels.confirmDisconnect ?? `Déconnecter ${label} ?`}
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ fontSize: '0.85rem' }}>
            {labels.confirmDisconnectMessage ??
              `Cette action révoquera le token et déconnectera ${label} de votre organisation. Vous pourrez vous reconnecter à tout moment.`}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDisconnectOpen(false)} disabled={actionLoading} sx={{ textTransform: 'none' }}>
            {labels.cancel ?? 'Annuler'}
          </Button>
          <Button
            onClick={handleDisconnect}
            color="error"
            variant="contained"
            disabled={actionLoading}
            sx={{ textTransform: 'none', boxShadow: 'none' }}
          >
            {actionLoading ? <CircularProgress size={14} sx={{ color: '#fff' }} /> : (labels.confirm ?? 'Déconnecter')}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
