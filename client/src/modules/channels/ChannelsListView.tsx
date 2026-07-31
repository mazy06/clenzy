import React from 'react';
import { Spinner } from '../../components/ui';
import { Box, Paper, Typography, Button, Chip } from '@mui/material';
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
              <img className="h-[22px] max-w-[76px] object-contain" src={ota.logo} alt={ota.name} />
            ) : (
              <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: '0.75rem', fontWeight: 700, color: ota.brandColor, letterSpacing: '-0.02em' }}>
                {ota.name}
              </Typography>
            )}
          </Box>

          {/* Channel name */}
          <div className="min-w-0">
            <p className="cn-text-body1 font-[var(--font-display)] text-[0.875rem] font-semibold text-[var(--ink)]">
              {ota.name}
            </p>
          </div>

          {/* Segment B2B / B2C — chips -soft tokenisés */}
          <div>
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
          </div>

          {/* Status — connecté --ok / à configurer --warn / bientôt muted */}
          <div>
            {(() => {
              if (loading) return <Spinner className="size-3.5" />;
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
          </div>

          {/* Action */}
          <div className="text-end">
            {ota.available && !connected && (
              <Button
                size="small"
                variant="contained"
                startIcon={<LinkIcon size={'0.75rem'} strokeWidth={1.75} />}
                onClick={isAirbnb ? onAirbnbConnect : isOtaChannel ? () => onOtaConnect(ota) : undefined}
                disabled={(isAirbnb && connectPending) || loading}
              >
                {(isAirbnb && connectPending)
                  ? <Spinner className="size-3" />
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
                  ? <Spinner className="size-3" />
                  : `Déconnecter ${ota.name}`
                }
              </Button>
            )}
            {!ota.available && (
              <p className="cn-text-body1 text-[0.71875rem] text-[var(--faint)]">
                {t('channels.ota.comingSoon')}
              </p>
            )}
          </div>
        </Box>
      );
    })}
  </Paper>
);

export default ChannelsListView;
