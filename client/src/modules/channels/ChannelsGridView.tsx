import React from 'react';
import StatusChip, { STATUS_TONES } from '../../components/StatusChip';
import { Spinner } from '../../components/ui';
import { Button } from '@mui/material';
import { cn } from '../../utils/cn';
import {
  LinkOff as LinkOffIcon,
  Link as LinkIcon,
  CheckCircle as CheckCircleIcon,
} from '../../icons';
import type { AirbnbConnectionStatus } from '../../services/api/airbnbApi';
import { CHANNEL_BACKEND_MAP } from '../../services/api/channelConnectionApi';
import type { ChannelId, ChannelConnectionStatus } from '../../services/api/channelConnectionApi';
import { type OtaChannel } from '../../services/channels/otaChannels';
import { STATUS_CHIP_TOKENS, STATUS_CHIP_CLASS, channelSoftBg } from './channelsPageConstants';

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
  <div className="grid grid-cols-[1fr] min-[600px]:grid-cols-[1fr_1fr] min-[900px]:grid-cols-[repeat(3,_1fr)] gap-[9px] mb-[9px]">
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
  </div>
);

export default ChannelsGridView;

// ─── Sub-components ──────────────────────────────────────────────────────────

/**
 * Pastille logo : surface douce tokenisée (--airbnb-soft / --booking-soft /
 * --field) — la couleur de MARQUE est conservée sur le logo lui-même.
 */
function OtaLogo({ channel }: { channel: OtaChannel }) {
  return (
    <div className="inline-flex items-center justify-center h-[44px] px-[9px] rounded-[10px] shrink-0" style={{ backgroundColor: channelSoftBg(channel.id) }}>
      {channel.logo ? (
        <img className="h-[24px] object-contain max-w-[120px]" src={channel.logo} alt={channel.name} />
      ) : (
        <p className="cn-text-body1 text-[1rem] font-bold tracking-[-0.02em] leading-[1]" style={{ fontFamily: 'var(--font-display)', color: channel.brandColor }}>
          {channel.name}
        </p>
      )}
    </div>
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
    <div
      className={cn(
        'flex flex-col overflow-hidden rounded-[14px] bg-[var(--card)] cursor-default',
        'border border-solid border-[var(--line)] hover:border-[var(--line-2)]',
        'transition-[border-color] duration-[180ms] ease-[cubic-bezier(.16,1,.3,1)]',
        isAvailable ? 'opacity-100' : 'opacity-60',
      )}
    >
      {/* Entête : pastille logo (marque) + chip de statut -soft */}
      <div className="flex items-center justify-between gap-[6px] px-[15px] py-3 border-b border-solid border-b-[var(--line)]">
        <OtaLogo channel={channel} />
        {connectionLoading && isAvailable ? (
          <Spinner className="size-3.5 text-[var(--muted)]" />
        ) : isAvailable && isConnected ? (
          <StatusChip
            label={connectionStatus?.status ?? 'ACTIVE'}
            tokens={isError ? STATUS_CHIP_TOKENS.err : STATUS_CHIP_TOKENS.ok} className={STATUS_CHIP_CLASS}
            icon={<CheckCircleIcon size={12} strokeWidth={1.75} />}
          />
        ) : isAvailable ? (
          <StatusChip
            label={t('channels.ota.disconnected')}
            tokens={STATUS_CHIP_TOKENS.warn} className={STATUS_CHIP_CLASS}
          />
        ) : (
          <StatusChip
            label={t('channels.ota.comingSoon')}
            tokens={STATUS_CHIP_TOKENS.muted} className={STATUS_CHIP_CLASS}
          />
        )}
      </div>

      {/* Card content */}
      <div className="flex flex-col flex-1 gap-[9px] p-[15px]">
        {/* Channel name */}
        <p className="cn-text-body1 font-[var(--font-display)] text-[0.875rem] font-semibold text-[var(--ink)]">
          {channel.name}
        </p>

        {/* Description */}
        <p className="cn-text-body1 text-[0.71875rem] text-[var(--muted)] leading-[1.5] flex-1 min-h-[32px]">
          {t(channel.descriptionKey)}
        </p>

        {/* Action button */}
        <div className="mt-auto flex justify-end">
          {isAvailable && !isConnected && (
            <Button
              size="small"
              variant="contained"
              startIcon={<LinkIcon size={'0.8rem'} strokeWidth={1.75} />}
              onClick={onConnect}
              disabled={connecting || connectionLoading}
            >
              {connecting ? <Spinner className="size-3" /> : `Connecter ${channel.name}`}
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
              {disconnecting ? <Spinner className="size-3" /> : `Déconnecter ${channel.name}`}
            </Button>
          )}
          {!isAvailable && (
            <Button size="small" variant="outlined" disabled>
              {t('channels.ota.comingSoon')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
