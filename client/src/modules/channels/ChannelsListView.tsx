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
import { CARD_SX } from './channelsPageConstants';

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
      borderColor: 'divider',
      bgcolor: 'action.hover',
    }}>
      <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        Logo
      </Typography>
      <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        Nom
      </Typography>
      <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        Segment
      </Typography>
      <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        Statut
      </Typography>
      <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right' }}>
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
            borderColor: 'divider',
            opacity: ota.available ? 1 : 0.6,
            transition: 'background 0.15s',
            '&:hover': { bgcolor: 'action.hover' },
          }}
        >
          {/* Logo column (big) */}
          <Box
            sx={{
              height: 48,
              width: 96,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-start',
              pl: 1.25,
            }}
          >
            {ota.logo ? (
              <Box
                component="img"
                src={ota.logo}
                alt={ota.name}
                sx={{ height: 28, maxWidth: 80, objectFit: 'contain' }}
              />
            ) : (
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 800, color: ota.brandColor, letterSpacing: '-0.02em' }}>
                {ota.name}
              </Typography>
            )}
          </Box>

          {/* Channel name */}
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, color: 'text.primary' }}>
              {ota.name}
            </Typography>
          </Box>

          {/* Segment B2B / B2C */}
          <Box>
            {(() => {
              const segHex = ota.segment === 'B2C' ? '#0288d1' : '#ED6C02';
              return (
                <Chip
                  icon={ota.segment === 'B2C'
                    ? <PeopleIcon size={14} strokeWidth={1.75} color={segHex} />
                    : <BusinessIcon size={14} strokeWidth={1.75} color={segHex} />
                  }
                  label={ota.segment}
                  size="small"
                  sx={{
                    backgroundColor: `${segHex}18`,
                    color: segHex,
                    border: `1px solid ${segHex}40`,
                    borderRadius: '6px',
                    fontWeight: 600,
                    fontSize: '0.75rem',
                    height: 24,
                    '& .MuiChip-label': { px: 0.75 },
                  }}
                />
              );
            })()}
          </Box>

          {/* Status */}
          <Box>
            {(() => {
              if (loading) return <CircularProgress size={14} />;
              if (connected) {
                const hex = '#4A9B8E';
                return (
                  <Chip
                    icon={<CheckCircleIcon size={14} strokeWidth={1.75} color={hex} />}
                    label={otaStatus?.status ?? (isAirbnb ? connectionStatus?.status ?? 'ACTIVE' : 'ACTIVE')}
                    size="small"
                    sx={{
                      backgroundColor: `${hex}18`,
                      color: hex,
                      border: `1px solid ${hex}40`,
                      borderRadius: '6px',
                      fontWeight: 600,
                      fontSize: '0.75rem',
                      height: 24,
                      '& .MuiChip-label': { px: 0.75 },
                    }}
                  />
                );
              }
              if (ota.available) {
                const hex = '#ED6C02';
                return (
                  <Chip
                    label={t('channels.ota.disconnected')}
                    size="small"
                    sx={{
                      backgroundColor: `${hex}18`,
                      color: hex,
                      border: `1px solid ${hex}40`,
                      borderRadius: '6px',
                      fontWeight: 600,
                      fontSize: '0.75rem',
                      height: 24,
                      '& .MuiChip-label': { px: 0.75 },
                    }}
                  />
                );
              }
              const hex = '#757575';
              return (
                <Chip
                  label={t('channels.ota.comingSoon')}
                  size="small"
                  sx={{
                    backgroundColor: `${hex}18`,
                    color: hex,
                    border: `1px solid ${hex}40`,
                    borderRadius: '6px',
                    fontWeight: 600,
                    fontSize: '0.75rem',
                    height: 24,
                    '& .MuiChip-label': { px: 0.75 },
                  }}
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
                sx={{
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  px: 1.5,
                  py: 0.4,
                  minHeight: 28,
                  backgroundColor: ota.brandColor,
                  '&:hover': { backgroundColor: ota.brandColor, filter: 'brightness(0.9)' },
                }}
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
                sx={{ fontSize: '0.6875rem', px: 1.5, py: 0.4, minHeight: 28 }}
              >
                {((isAirbnb && disconnectPending) || disconnectingChannelId === ota.id)
                  ? <CircularProgress size={12} />
                  : `Déconnecter ${ota.name}`
                }
              </Button>
            )}
            {!ota.available && (
              <Typography sx={{ fontSize: '0.6875rem', color: 'text.disabled', fontStyle: 'italic' }}>
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
