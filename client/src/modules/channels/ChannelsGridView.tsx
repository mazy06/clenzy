import React from 'react';
import {
  Box,
  Typography,
  Button,
  Chip,
  CircularProgress,
} from '@mui/material';
import {
  LinkOff as LinkOffIcon,
  Link as LinkIcon,
  CheckCircle as CheckCircleIcon,
} from '../../icons';
import type { AirbnbConnectionStatus } from '../../services/api/airbnbApi';
import { CHANNEL_BACKEND_MAP } from '../../services/api/channelConnectionApi';
import type { ChannelId, ChannelConnectionStatus } from '../../services/api/channelConnectionApi';
import { OTA_CHANNELS, type OtaChannel } from '../../services/channels/otaChannels';
import { OTA_CARD_SX, OTA_CARD_CONTENT_SX } from './channelsPageConstants';

interface ChannelsGridViewProps {
  isConnected: boolean;
  connectionStatus: AirbnbConnectionStatus | null;
  connectionLoading: boolean;
  otaConnectionsLoading: boolean;
  isOtaConnected: (id: ChannelId) => boolean;
  getOtaStatus: (id: ChannelId) => ChannelConnectionStatus | undefined;
  connectPending: boolean;
  disconnectPending: boolean;
  disconnectingChannelId: string | null;
  onAirbnbConnect: () => void;
  onAirbnbDisconnect: () => void;
  onOtaConnect: (ota: OtaChannel) => void;
  onOtaDisconnectRequest: (ota: OtaChannel) => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}

/** Vue grille : catalogue des OTAs sous forme de cartes. */
const ChannelsGridView: React.FC<ChannelsGridViewProps> = ({
  isConnected,
  connectionStatus,
  connectionLoading,
  otaConnectionsLoading,
  isOtaConnected,
  getOtaStatus,
  connectPending,
  disconnectPending,
  disconnectingChannelId,
  onAirbnbConnect,
  onAirbnbDisconnect,
  onOtaConnect,
  onOtaDisconnectRequest,
  t,
}) => (
  <Box sx={{
    display: 'grid',
    gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(3, 1fr)' },
    gap: 1.5,
    mb: 1.5,
  }}>
    {OTA_CHANNELS.map((ota) => {
      const isAirbnb = ota.id === 'airbnb';
      const isOtaChannel = (ota.id as string) in CHANNEL_BACKEND_MAP;
      const otaStatus = isOtaChannel ? getOtaStatus(ota.id as ChannelId) : undefined;

      return (
        <OtaChannelCard
          key={ota.id}
          channel={ota}
          isConnected={isAirbnb ? isConnected : isOtaChannel ? isOtaConnected(ota.id as ChannelId) : false}
          connectionStatus={isAirbnb ? connectionStatus : otaStatus ? { status: otaStatus.status } : null}
          connectionLoading={isAirbnb ? connectionLoading : isOtaChannel ? otaConnectionsLoading : false}
          onConnect={isAirbnb ? onAirbnbConnect : isOtaChannel ? () => onOtaConnect(ota) : undefined}
          onDisconnect={isAirbnb ? onAirbnbDisconnect : isOtaChannel ? () => onOtaDisconnectRequest(ota) : undefined}
          connecting={isAirbnb ? connectPending : false}
          disconnecting={isAirbnb ? disconnectPending : disconnectingChannelId === ota.id}
          t={t}
        />
      );
    })}
  </Box>
);

export default ChannelsGridView;

// ─── Sub-components ──────────────────────────────────────────────────────────

function OtaLogo({ channel }: { channel: OtaChannel }) {
  if (channel.logo) {
    return (
      <Box
        component="img"
        src={channel.logo}
        alt={channel.name}
        sx={{
          height: 30,
          objectFit: 'contain',
          maxWidth: 130,
          position: 'relative',
          zIndex: 2,
        }}
      />
    );
  }

  return (
    <Typography
      sx={{
        fontSize: '1.25rem',
        fontWeight: 800,
        color: channel.brandColor,
        letterSpacing: '-0.02em',
        lineHeight: 1,
        position: 'relative',
        zIndex: 2,
      }}
    >
      {channel.name}
    </Typography>
  );
}

function OtaChannelCard({
  channel,
  isConnected,
  connectionStatus,
  connectionLoading,
  onConnect,
  onDisconnect,
  connecting,
  disconnecting,
  t,
}: {
  channel: OtaChannel;
  isConnected: boolean;
  connectionStatus: { status?: string | null } | null;
  connectionLoading: boolean;
  onConnect?: () => void;
  onDisconnect?: () => void;
  connecting: boolean;
  disconnecting: boolean;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  const isAvailable = channel.available;

  return (
    <Box
      sx={{
        ...OTA_CARD_SX,
        opacity: isAvailable ? 1 : 0.7,
        '&:hover': isAvailable
          ? OTA_CARD_SX['&:hover']
          : { borderColor: 'grey.300' },
      }}
    >
      {/* Brand header with logo + status — top accent stripe, neutral bg */}
      <Box
        sx={{
          position: 'relative',
          bgcolor: 'background.paper',
          opacity: isAvailable ? 1 : 0.6,
          px: 2.5,
          py: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: 56,
          borderTop: '3px solid',
          borderTopColor: channel.brandColor,
          borderBottom: '1px solid',
          borderBottomColor: 'divider',
        }}
      >
        <OtaLogo channel={channel} />
        {connectionLoading && isAvailable ? (
          <CircularProgress size={14} sx={{ color: channel.brandColor }} />
        ) : isAvailable && isConnected ? (
          <Chip
            label={connectionStatus?.status ?? 'ACTIVE'}
            size="small"
            sx={{
              fontSize: '0.5625rem',
              height: 20,
              backgroundColor: '#10b98115',
              color: '#10b981',
              fontWeight: 700,
              border: '1px solid #10b98140',
            }}
            icon={<CheckCircleIcon size={12} strokeWidth={1.75} color="#10b981" />}
          />
        ) : isAvailable ? (
          <Chip
            label={t('channels.ota.disconnected')}
            size="small"
            sx={{
              fontSize: '0.5625rem',
              height: 20,
              fontWeight: 600,
              backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
              color: 'text.secondary',
              border: '1px solid',
              borderColor: 'divider',
            }}
          />
        ) : (
          <Chip
            label={t('channels.ota.comingSoon')}
            size="small"
            sx={{
              fontSize: '0.5625rem',
              height: 20,
              fontWeight: 600,
              backgroundColor: `${channel.brandColor}14`,
              color: channel.brandColor,
              border: `1px solid ${channel.brandColor}30`,
            }}
          />
        )}
      </Box>

      {/* Card content */}
      <Box sx={OTA_CARD_CONTENT_SX}>
        {/* Channel name */}
        <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: 'text.primary' }}>
          {channel.name}
        </Typography>

        {/* Description */}
        <Typography sx={{
          fontSize: '0.6875rem',
          color: 'text.secondary',
          lineHeight: 1.5,
          flex: 1,
          minHeight: 32,
        }}>
          {t(channel.descriptionKey)}
        </Typography>

        {/* Action button */}
        <Box sx={{ mt: 'auto', display: 'flex', justifyContent: 'flex-end' }}>
          {isAvailable && !isConnected && (
            <Button
              size="small"
              variant="contained"
              startIcon={<LinkIcon size={'0.8rem'} strokeWidth={1.75} />}
              onClick={onConnect}
              disabled={connecting || connectionLoading}
              sx={{
                fontSize: '0.6875rem',
                fontWeight: 600,
                px: 2,
                py: 0.5,
                minHeight: 30,
                backgroundColor: channel.brandColor,
                '&:hover': {
                  backgroundColor: channel.brandColor,
                  filter: 'brightness(0.9)',
                },
              }}
            >
              {connecting ? <CircularProgress size={12} color="inherit" /> : `Connecter ${channel.name}`}
            </Button>
          )}
          {isAvailable && isConnected && (
            <Button
              size="small"
              variant="outlined"
              color="error"
              startIcon={<LinkOffIcon size={'0.8rem'} strokeWidth={1.75} />}
              onClick={onDisconnect}
              disabled={disconnecting}
              sx={{ fontSize: '0.6875rem', px: 2, py: 0.5, minHeight: 30 }}
            >
              {disconnecting ? <CircularProgress size={12} /> : `Déconnecter ${channel.name}`}
            </Button>
          )}
          {!isAvailable && (
            <Button
              size="small"
              variant="outlined"
              disabled
              sx={{
                fontSize: '0.6875rem',
                fontWeight: 600,
                px: 2,
                py: 0.5,
                minHeight: 30,
                borderColor: 'grey.200',
                color: 'text.disabled',
              }}
            >
              {t('channels.ota.comingSoon')}
            </Button>
          )}
        </Box>
      </Box>
    </Box>
  );
}
