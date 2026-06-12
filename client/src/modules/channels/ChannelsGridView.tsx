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
import { type OtaChannel } from '../../services/channels/otaChannels';
import { OTA_CARD_SX, OTA_CARD_CONTENT_SX, STATUS_CHIP_SX, channelSoftBg } from './channelsPageConstants';

interface ChannelsGridViewProps {
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

/** Vue grille : catalogue des OTAs sous forme de cartes. */
const ChannelsGridView: React.FC<ChannelsGridViewProps> = ({
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
  <Box sx={{
    display: 'grid',
    gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(3, 1fr)' },
    gap: 1.5,
    mb: 1.5,
  }}>
    {channels.map((ota) => {
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

/**
 * Pastille logo : surface douce tokenisée (--airbnb-soft / --booking-soft /
 * --field) — la couleur de MARQUE est conservée sur le logo lui-même.
 */
function OtaLogo({ channel }: { channel: OtaChannel }) {
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: 44,
        px: 1.5,
        borderRadius: '10px',
        bgcolor: channelSoftBg(channel.id),
        flexShrink: 0,
      }}
    >
      {channel.logo ? (
        <Box
          component="img"
          src={channel.logo}
          alt={channel.name}
          sx={{ height: 24, objectFit: 'contain', maxWidth: 120 }}
        />
      ) : (
        <Typography
          sx={{
            fontFamily: 'var(--font-display)',
            fontSize: '1rem',
            fontWeight: 700,
            color: channel.brandColor,
            letterSpacing: '-0.02em',
            lineHeight: 1,
          }}
        >
          {channel.name}
        </Typography>
      )}
    </Box>
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

  const isError = (connectionStatus?.status ?? '').toUpperCase() === 'ERROR';

  return (
    <Box
      sx={{
        ...OTA_CARD_SX,
        opacity: isAvailable ? 1 : 0.6,
      }}
    >
      {/* Entête : pastille logo (marque) + chip de statut -soft */}
      <Box
        sx={{
          px: 2.5,
          py: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          borderBottom: '1px solid',
          borderBottomColor: 'var(--line)',
        }}
      >
        <OtaLogo channel={channel} />
        {connectionLoading && isAvailable ? (
          <CircularProgress size={14} sx={{ color: 'var(--muted)' }} />
        ) : isAvailable && isConnected ? (
          <Chip
            label={connectionStatus?.status ?? 'ACTIVE'}
            size="small"
            sx={isError ? STATUS_CHIP_SX.err : STATUS_CHIP_SX.ok}
            icon={<CheckCircleIcon size={12} strokeWidth={1.75} />}
          />
        ) : isAvailable ? (
          <Chip
            label={t('channels.ota.disconnected')}
            size="small"
            sx={STATUS_CHIP_SX.warn}
          />
        ) : (
          <Chip
            label={t('channels.ota.comingSoon')}
            size="small"
            sx={STATUS_CHIP_SX.muted}
          />
        )}
      </Box>

      {/* Card content */}
      <Box sx={OTA_CARD_CONTENT_SX}>
        {/* Channel name */}
        <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: '0.875rem', fontWeight: 600, color: 'var(--ink)' }}>
          {channel.name}
        </Typography>

        {/* Description */}
        <Typography sx={{
          fontSize: '0.71875rem',
          color: 'var(--muted)',
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
            >
              {disconnecting ? <CircularProgress size={12} /> : `Déconnecter ${channel.name}`}
            </Button>
          )}
          {!isAvailable && (
            <Button size="small" variant="outlined" disabled>
              {t('channels.ota.comingSoon')}
            </Button>
          )}
        </Box>
      </Box>
    </Box>
  );
}
