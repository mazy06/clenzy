import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Chip,
  Alert,
  CircularProgress,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle as CheckCircleIcon,
  ErrorOutline,
  Link as LinkIcon,
  LinkOff as LinkOffIcon,
  ArrowForward as ArrowRightIcon,
} from '../../../icons';
import { useDisconnectChannel } from '../../../hooks/useChannelConnections';
import { useAirbnbConnect } from '../../../hooks/useAirbnb';
import { CONNECTABLE_CHANNELS, type ChannelId, type ChannelConnectionStatus } from '../../../services/api/channelConnectionApi';
import type { AirbnbConnectionStatus } from '../../../services/api/airbnbApi';
import type { OtaChannel } from '../../../services/channels/otaChannels';
import IntegrationConfigDialog from './IntegrationConfigDialog';

/**
 * Modal d'information pour les OTAs dans la vitrine Integrations.
 *
 * <h2>3 cas geres</h2>
 * <ul>
 *   <li><b>Deja connecte</b> : affiche les data (property name, date) +
 *       bouton Deconnecter. Le user peut reconfigurer en cliquant
 *       "Modifier la connexion" (qui ouvre le ChannelConnectDialog).</li>
 *   <li><b>Airbnb non connecte</b> : CTA "Se connecter via Airbnb (OAuth)"
 *       qui declenche {@code useAirbnbConnect()}.</li>
 *   <li><b>Coming soon</b> : message "Bientot disponible" + lien vers la
 *       page Channels pour express d'interet.</li>
 * </ul>
 *
 * <h2>Cas non gere ici</h2>
 * <p>Le cas "form-connectable non connecte" (Booking, Expedia, Hotels.com,
 * Agoda, Vrbo, Abritel) est delegue au {@code ChannelConnectDialog} existant
 * qui contient deja la logique de formulaire + test de connexion. Le parent
 * (OtaShowcaseSection) route vers le bon dialog selon l'etat.</p>
 */

const ACCENT = '#4A9B8E';
const DANGER = '#C97A7A';
const NEUTRAL = '#8A8378';

const statusChipSx = (color: string) => ({
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

interface OtaInfoDialogProps {
  ota: OtaChannel | null;
  open: boolean;
  onClose: () => void;
  /** Statut de connexion existant (form-based OTAs). */
  channelStatus?: ChannelConnectionStatus | null;
  /** Statut Airbnb (OAuth). */
  airbnbStatus?: AirbnbConnectionStatus | null;
  /** Callback pour switcher vers le formulaire de modification. */
  onEditConnection?: (ota: OtaChannel) => void;
}

export default function OtaInfoDialog({
  ota,
  open,
  onClose,
  channelStatus,
  airbnbStatus,
  onEditConnection,
}: OtaInfoDialogProps) {
  const navigate = useNavigate();
  const disconnectMutation = useDisconnectChannel();
  const airbnbConnectMutation = useAirbnbConnect();
  const [actionError, setActionError] = useState<string | null>(null);

  if (!ota) return null;

  const isAirbnb = ota.id === 'airbnb';
  const isFormConnectable = CONNECTABLE_CHANNELS.includes(ota.id as ChannelId);
  const isAirbnbConnected = isAirbnb && !!airbnbStatus?.connected;
  const isChannelConnected = isFormConnectable && !!channelStatus?.connected;
  const isConnected = isAirbnbConnected || isChannelConnected;

  const handleDisconnect = async () => {
    if (!isFormConnectable) return;
    setActionError(null);
    try {
      await disconnectMutation.mutateAsync(ota.id as ChannelId);
      onClose();
    } catch (err) {
      setActionError((err as Error).message ?? 'Erreur lors de la déconnexion.');
    }
  };

  const handleAirbnbConnect = () => {
    setActionError(null);
    airbnbConnectMutation.mutate(undefined, {
      onError: (err: Error) => setActionError(err.message ?? 'Erreur OAuth Airbnb.'),
    });
  };

  return (
    <IntegrationConfigDialog open={open} onClose={onClose}>
      <Paper
        elevation={0}
        sx={{
          borderRadius: '12px',
          border: '1px solid',
          borderColor: 'divider',
          boxShadow: 'none',
          overflow: 'hidden',
        }}
      >
        {/* Header — meme format que les autres cards d'integration */}
        <Box
          sx={{
            px: 2,
            py: 1.75,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 1.5,
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: '10px',
              backgroundColor: ota.logo ? 'transparent' : ota.brandColor,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              flexShrink: 0,
            }}
            aria-hidden="true"
          >
            {ota.logo ? (
              <Box
                component="img"
                src={ota.logo}
                alt=""
                sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
              />
            ) : (
              <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff' }}>
                {ota.name.slice(0, 2).toUpperCase()}
              </Typography>
            )}
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
              <Typography sx={{ fontSize: '0.92rem', fontWeight: 600 }}>{ota.name}</Typography>
              <Chip
                label={ota.segment}
                size="small"
                sx={{
                  height: 18,
                  fontSize: '0.62rem',
                  fontWeight: 600,
                  bgcolor: `${ACCENT}14`,
                  color: ACCENT,
                  border: `1px solid ${ACCENT}33`,
                  '& .MuiChip-label': { px: 0.625 },
                }}
              />
            </Box>
            <Typography sx={{ fontSize: '0.74rem', color: 'text.secondary', mt: 0.5 }}>
              {isAirbnb ? 'Connexion OAuth2 native' : isFormConnectable ? 'Connexion via formulaire (API ou iCal)' : 'Intégration en cours de développement'}
            </Typography>
          </Box>
          <Box sx={{ flexShrink: 0 }}>
            {isConnected ? (
              <Chip
                icon={<CheckCircleIcon size={11} strokeWidth={2} />}
                label="Connecté"
                size="small"
                sx={statusChipSx(ACCENT)}
              />
            ) : (
              <Chip
                icon={<ErrorOutline size={11} strokeWidth={2} />}
                label={ota.available ? 'Non connecté' : 'Bientôt'}
                size="small"
                sx={statusChipSx(NEUTRAL)}
              />
            )}
          </Box>
        </Box>

        {/* Body */}
        <Box sx={{ p: 2 }}>
          {/* ─── Cas 1 : Coming soon ─────────────────────────────────── */}
          {!ota.available && (
            <Alert
              severity="info"
              variant="outlined"
              sx={{ borderRadius: '8px', fontSize: '0.78rem' }}
            >
              L'intégration {ota.name} est en cours de développement. La page <strong>Channels</strong> permet d'exprimer votre intérêt et de suivre la disponibilité.
            </Alert>
          )}

          {/* ─── Cas 2 : Deja connecte (form OTA ou Airbnb) ─────────── */}
          {ota.available && isConnected && (
            <Box>
              <Alert
                severity="success"
                variant="outlined"
                icon={<CheckCircleIcon size={16} strokeWidth={2} />}
                sx={{ borderRadius: '8px', fontSize: '0.78rem', mb: 1.5 }}
              >
                Cette intégration est <strong>active</strong>. Vous pouvez gérer la connexion ici ou depuis l'onglet Channels.
              </Alert>

              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.25, mb: 1.5 }}>
                {isChannelConnected && channelStatus && (
                  <>
                    {channelStatus.externalPropertyId && (
                      <Box>
                        <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>Property ID</Typography>
                        <Typography sx={{ fontSize: '0.82rem', fontWeight: 500 }}>{channelStatus.externalPropertyId}</Typography>
                      </Box>
                    )}
                    {channelStatus.connectedAt && (
                      <Box>
                        <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>Connecté depuis</Typography>
                        <Typography sx={{ fontSize: '0.82rem', fontWeight: 500 }}>
                          {new Date(channelStatus.connectedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </Typography>
                      </Box>
                    )}
                    {channelStatus.lastSyncAt && (
                      <Box>
                        <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>Dernière sync</Typography>
                        <Typography sx={{ fontSize: '0.82rem', fontWeight: 500 }}>
                          {new Date(channelStatus.lastSyncAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </Typography>
                      </Box>
                    )}
                  </>
                )}
                {isAirbnbConnected && airbnbStatus && (
                  <>
                    {airbnbStatus.connectedAt && (
                      <Box>
                        <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>Connecté depuis</Typography>
                        <Typography sx={{ fontSize: '0.82rem', fontWeight: 500 }}>
                          {new Date(airbnbStatus.connectedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </Typography>
                      </Box>
                    )}
                  </>
                )}
              </Box>

              {/* Actions */}
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {isFormConnectable && onEditConnection && (
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<LinkIcon size={14} strokeWidth={2} />}
                    onClick={() => onEditConnection(ota)}
                    sx={{
                      textTransform: 'none',
                      fontWeight: 600,
                      fontSize: '0.78rem',
                      borderRadius: '8px',
                      borderColor: 'divider',
                      color: 'text.primary',
                      '&:hover': { borderColor: `${ACCENT}66`, backgroundColor: `${ACCENT}0F`, color: ACCENT },
                    }}
                  >
                    Modifier la connexion
                  </Button>
                )}
                {isFormConnectable && (
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={disconnectMutation.isPending ? <CircularProgress size={12} /> : <LinkOffIcon size={14} strokeWidth={2} />}
                    onClick={handleDisconnect}
                    disabled={disconnectMutation.isPending}
                    sx={{
                      textTransform: 'none',
                      fontWeight: 600,
                      fontSize: '0.78rem',
                      borderRadius: '8px',
                      borderColor: 'divider',
                      color: 'text.primary',
                      '&:hover': { borderColor: `${DANGER}66`, backgroundColor: `${DANGER}0F`, color: DANGER },
                    }}
                  >
                    {disconnectMutation.isPending ? 'Déconnexion...' : `Déconnecter ${ota.name}`}
                  </Button>
                )}
                <Button
                  variant="text"
                  size="small"
                  endIcon={<ArrowRightIcon size={14} strokeWidth={2} />}
                  onClick={() => navigate('/channels')}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 600,
                    fontSize: '0.78rem',
                    color: 'text.secondary',
                    '&:hover': { color: ACCENT },
                  }}
                >
                  Gérer dans Channels
                </Button>
              </Box>
            </Box>
          )}

          {/* ─── Cas 3 : Airbnb non connecte (OAuth) ─────────────────── */}
          {ota.available && isAirbnb && !isConnected && (
            <Box>
              <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary', mb: 1.5 }}>
                Airbnb utilise un flow OAuth2 natif. Vous serez redirigé vers Airbnb pour autoriser l'accès à votre compte.
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={airbnbConnectMutation.isPending ? <CircularProgress size={12} sx={{ color: '#fff' }} /> : <LinkIcon size={14} strokeWidth={2} />}
                  onClick={handleAirbnbConnect}
                  disabled={airbnbConnectMutation.isPending}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 600,
                    fontSize: '0.78rem',
                    borderRadius: '8px',
                    bgcolor: ACCENT,
                    color: '#fff',
                    boxShadow: 'none',
                    '&:hover': { bgcolor: ACCENT, filter: 'brightness(0.94)' },
                  }}
                >
                  {airbnbConnectMutation.isPending ? 'Redirection...' : 'Se connecter via Airbnb'}
                </Button>
                <Button
                  variant="text"
                  size="small"
                  endIcon={<ArrowRightIcon size={14} strokeWidth={2} />}
                  onClick={() => navigate('/channels')}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 600,
                    fontSize: '0.78rem',
                    color: 'text.secondary',
                  }}
                >
                  Détails dans Channels
                </Button>
              </Box>
            </Box>
          )}

          {actionError && (
            <Alert severity="error" sx={{ mt: 1.5, borderRadius: '8px', fontSize: '0.78rem' }}>
              {actionError}
            </Alert>
          )}
        </Box>
      </Paper>
    </IntegrationConfigDialog>
  );
}
