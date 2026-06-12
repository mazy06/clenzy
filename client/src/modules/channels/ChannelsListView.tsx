import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Chip,
  CircularProgress,
} from '@mui/material';
import {
  LinkOff as LinkOffIcon,
  Link as LinkIcon,
  CheckCircle as CheckCircleIcon,
  People as PeopleIcon,
  Business as BusinessIcon,
} from '../../icons';
import type { AirbnbConnectionStatus } from '../../services/api/airbnbApi';
import { CHANNEL_BACKEND_MAP } from '../../services/api/channelConnectionApi';
import type { ChannelId, ChannelConnectionStatus } from '../../services/api/channelConnectionApi';
import { type OtaChannel } from '../../services/channels/otaChannels';
import { CARD_SX, STATUS_CHIP_SX, OVERLINE_SX, channelSoftBg } from './channelsPageConstants';

interface ChannelsListViewProps {
  isConnected: boolean;
  connectionStatus: AirbnbConnectionStatus | null;
  connectionLoading: boolean;
  otaConnectionsLoading: boolean;
  isOtaConnected: (id: ChannelId) => boolean;
  getOtaStatus: (id: ChannelId) => ChannelConnectionStatus | undefined;
  channels: OtaChannel[];
  connectPending: boolean;
  disconnectPending: boolean;
  disconnectingChannelId: string | null;
  onAirbnbConnect: () => void;
  onAirbnbDisconnect: () => void;
  onOtaConnect: (ota: OtaChannel) => void;
  onOtaDisconnectRequest: (ota: OtaChannel) => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}

/** Vue liste : catalogue des OTAs sous forme de tableau dense. */
const ChannelsListView: React.FC<ChannelsListViewProps> = ({
  isConnected,
  connectionStatus,
  connectionLoading,
  otaConnectionsLoading,
  isOtaConnected,
  getOtaStatus,
  channels,
  connectPending,
  disconnectPending,
  disconnectingChannelId,
  onAirbnbConnect,
  onAirbnbDisconnect,
  onOtaConnect,
  onOtaDisconnectRequest,
  t,
}) => (
  <Paper sx={{ ...CARD_SX, mb: 1.5, p: 0, overflow: 'hidden' }}>
    {/* Table header */}
    <Box sx={{
      display: 'grid',
      gridTemplateColumns: '110px 1.6fr 0.8fr 1fr 1.4fr',
      gap: 2,
      px: 2,
      py: 1.25,
      borderBottom: '1px solid',
      borderColor: 'var(--line)',
      bgcolor: 'var(--surface-2)',
    }}>
      <Typography sx={OVERLINE_SX}>
        Logo
      </Typography>
      <Typography sx={OVERLINE_SX}>
        Nom
      </Typography>
      <Typography sx={OVERLINE_SX}>
        Segment
      </Typography>
      <Typography sx={OVERLINE_SX}>
        Statut
      </Typography>
      <Typography sx={{ ...OVERLINE_SX, textAlign: 'right' }}>
        Action
      </Typography>
    </Box>

    {/* Rows */}
    {channels.map((ota, idx) => {
      const isAirbnb = ota.id === 'airbnb';
      const isOtaChannel = (ota.id as string) in CHANNEL_BACKEND_MAP;
      const otaStatus = isOtaChannel ? getOtaStatus(ota.id as ChannelId) : undefined;
      const connected = isAirbnb ? isConnected : isOtaChannel ? isOtaConnected(ota.id as ChannelId) : false;
      const loading = isAirbnb ? connectionLoading : isOtaChannel ? otaConnectionsLoading : false;

      return (
        <Box
          key={ota.id}
          sx={{
            display: 'grid',
            gridTemplateColumns: '110px 1.6fr 0.8fr 1fr 1.4fr',
            gap: 2,
            px: 2,
            py: 1.5,
            alignItems: 'center',
            borderBottom: idx < channels.length - 1 ? '1px solid' : 'none',
            borderColor: 'var(--line)',
            opacity: ota.available ? 1 : 0.6,
            transition: 'background 0.15s',
            '&:hover': { bgcolor: 'var(--hover)' },
          }}
        >
          {/* Pastille logo — surface douce tokenisée, marque conservée sur le logo */}
          <Box
            sx={{
              height: 40,
              width: 96,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '10px',
              bgcolor: channelSoftBg(ota.id),
            }}
          >
            {ota.logo ? (
              <Box
                component="img"
                src={ota.logo}
                alt={ota.name}
                sx={{ height: 22, maxWidth: 76, objectFit: 'contain' }}
              />
            ) : (
              <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: '0.75rem', fontWeight: 700, color: ota.brandColor, letterSpacing: '-0.02em' }}>
                {ota.name}
              </Typography>
            )}
          </Box>

          {/* Channel name */}
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: '0.875rem', fontWeight: 600, color: 'var(--ink)' }}>
              {ota.name}
            </Typography>
          </Box>

          {/* Segment B2B / B2C — chips -soft tokenisés */}
          <Box>
            <Chip
              icon={ota.segment === 'B2C'
                ? <PeopleIcon size={14} strokeWidth={1.75} />
                : <BusinessIcon size={14} strokeWidth={1.75} />
              }
              label={ota.segment}
              size="small"
              sx={ota.segment === 'B2C'
                ? { ...STATUS_CHIP_SX.muted, backgroundColor: 'var(--info-soft)', color: 'var(--info)', '& .MuiChip-icon': { color: 'var(--info)' } }
                : STATUS_CHIP_SX.muted}
            />
          </Box>

          {/* Status — connecté --ok / à configurer --warn / bientôt muted */}
          <Box>
            {(() => {
              if (loading) return <CircularProgress size={14} />;
              if (connected) {
                const statusLabel = otaStatus?.status ?? (isAirbnb ? connectionStatus?.status ?? 'ACTIVE' : 'ACTIVE');
                const isError = String(statusLabel).toUpperCase() === 'ERROR';
                return (
                  <Chip
                    icon={<CheckCircleIcon size={14} strokeWidth={1.75} />}
                    label={statusLabel}
                    size="small"
                    sx={isError ? STATUS_CHIP_SX.err : STATUS_CHIP_SX.ok}
                  />
                );
              }
              if (ota.available) {
                return (
                  <Chip
                    label={t('channels.ota.disconnected')}
                    size="small"
                    sx={STATUS_CHIP_SX.warn}
                  />
                );
              }
              return (
                <Chip
                  label={t('channels.ota.comingSoon')}
                  size="small"
                  sx={STATUS_CHIP_SX.muted}
                />
              );
            })()}
          </Box>

          {/* Action */}
          <Box sx={{ textAlign: 'right' }}>
            {ota.available && !connected && (
              <Button
                size="small"
                variant="contained"
                startIcon={<LinkIcon size={'0.75rem'} strokeWidth={1.75} />}
                onClick={isAirbnb ? onAirbnbConnect : isOtaChannel ? () => onOtaConnect(ota) : undefined}
                disabled={(isAirbnb && connectPending) || loading}
              >
                {(isAirbnb && connectPending)
                  ? <CircularProgress size={12} color="inherit" />
                  : `Connecter ${ota.name}`
                }
              </Button>
            )}
            {ota.available && connected && (
              <Button
                size="small"
                variant="outlined"
                color="error"
                startIcon={<LinkOffIcon size={'0.75rem'} strokeWidth={1.75} />}
                onClick={isAirbnb ? onAirbnbDisconnect : isOtaChannel ? () => onOtaDisconnectRequest(ota) : undefined}
                disabled={(isAirbnb && disconnectPending) || disconnectingChannelId === ota.id}
              >
                {((isAirbnb && disconnectPending) || disconnectingChannelId === ota.id)
                  ? <CircularProgress size={12} />
                  : `Déconnecter ${ota.name}`
                }
              </Button>
            )}
            {!ota.available && (
              <Typography sx={{ fontSize: '0.71875rem', color: 'var(--faint)' }}>
                {t('channels.ota.comingSoon')}
              </Typography>
            )}
          </Box>
        </Box>
      );
    })}
  </Paper>
);

export default ChannelsListView;
