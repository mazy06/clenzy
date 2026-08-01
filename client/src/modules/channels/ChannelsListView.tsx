import React from 'react';
import { cn } from '../../utils/cn';
import StatusChip, { STATUS_TONES } from '../../components/StatusChip';
import { Spinner } from '../../components/ui';
import { Button } from '../../components/ui';
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
import { STATUS_CHIP_TOKENS, STATUS_CHIP_CLASS, channelSoftBg } from './channelsPageConstants';

/** Report en classes de `OVERLINE_SX` (la constante vit dans un .ts partage). */
const OVERLINE_CLASS = 'text-[10.5px] font-bold text-[var(--faint)] uppercase tracking-[0.06em]';

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
  // Report de `CARD_SX` sans son `p: 2` (surcharge `p: 0` a l'appel) : hairline
  // --line, surface --card, r14, aucune ombre.
  <div className="mb-[9px] overflow-hidden rounded-[14px] border border-solid border-[var(--line)] bg-[var(--card)]">
    {/* Table header */}
    <div className="grid grid-cols-[110px_1.6fr_0.8fr_1fr_1.4fr] gap-3 px-3 py-[7.5px] border-[var(--line)] bg-[var(--surface-2)]" style={{ borderBottom: '1px solid' }}>
      <p className={cn(OVERLINE_CLASS, 'cn-text-body1')}>
        Logo
      </p>
      <p className={cn(OVERLINE_CLASS, 'cn-text-body1')}>
        Nom
      </p>
      <p className={cn(OVERLINE_CLASS, 'cn-text-body1')}>
        Segment
      </p>
      <p className={cn(OVERLINE_CLASS, 'cn-text-body1')}>
        Statut
      </p>
      <p className={cn(OVERLINE_CLASS, 'cn-text-body1 text-right')}>
        Action
      </p>
    </div>

    {/* Rows */}
    {channels.map((ota, idx) => {
      const isAirbnb = ota.id === 'airbnb';
      const isOtaChannel = (ota.id as string) in CHANNEL_BACKEND_MAP;
      const otaStatus = isOtaChannel ? getOtaStatus(ota.id as ChannelId) : undefined;
      const connected = isAirbnb ? isConnected : isOtaChannel ? isOtaConnected(ota.id as ChannelId) : false;
      const loading = isAirbnb ? connectionLoading : isOtaChannel ? otaConnectionsLoading : false;

      return (
        <div className={cn('grid grid-cols-[110px_1.6fr_0.8fr_1fr_1.4fr] gap-3 px-3 py-[9px] items-center border-[var(--line)] hover:bg-[var(--hover)]', ota.available ? 'opacity-100' : 'opacity-60')} style={{ borderBottom: idx < channels.length - 1 ? '1px solid' : 'none', transition: 'background 0.15s' }} key={ota.id}>
          {/* Pastille logo — surface douce tokenisée, marque conservée sur le logo */}
          <div className="h-[40px] w-[96px] flex items-center justify-center rounded-[10px]" style={{ backgroundColor: channelSoftBg(ota.id) }}>
            {ota.logo ? (
              <img className="h-[22px] max-w-[76px] object-contain" src={ota.logo} alt={ota.name} />
            ) : (
              <p className="cn-text-body1 text-[0.75rem] font-bold tracking-[-0.02em]" style={{ fontFamily: 'var(--font-display)', color: ota.brandColor }}>
                {ota.name}
              </p>
            )}
          </div>

          {/* Channel name */}
          <div className="min-w-0">
            <p className="cn-text-body1 font-[family-name:var(--font-display)] text-[0.875rem] font-semibold text-[var(--ink)]">
              {ota.name}
            </p>
          </div>

          {/* Segment B2B / B2C — chips -soft tokenisés */}
          <div>
            <StatusChip
              icon={ota.segment === 'B2C'
                ? <PeopleIcon size={14} strokeWidth={1.75} />
                : <BusinessIcon size={14} strokeWidth={1.75} />
              }
              label={ota.segment}
              tokens={ota.segment === 'B2C' ? STATUS_TONES.info : STATUS_CHIP_TOKENS.muted}
              className={STATUS_CHIP_CLASS}
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
                  <StatusChip
                    icon={<CheckCircleIcon size={14} strokeWidth={1.75} />}
                    label={statusLabel}
                    tokens={isError ? STATUS_CHIP_TOKENS.err : STATUS_CHIP_TOKENS.ok} className={STATUS_CHIP_CLASS}
                  />
                );
              }
              if (ota.available) {
                return (
                  <StatusChip
                    label={t('channels.ota.disconnected')}
                    tokens={STATUS_CHIP_TOKENS.warn} className={STATUS_CHIP_CLASS}
                  />
                );
              }
              return (
                <StatusChip
                  label={t('channels.ota.comingSoon')}
                  tokens={STATUS_CHIP_TOKENS.muted} className={STATUS_CHIP_CLASS}
                />
              );
            })()}
          </div>

          {/* Action */}
          <div className="text-end">
            {ota.available && !connected && (
              <Button
                size="sm"
                onClick={isAirbnb ? onAirbnbConnect : isOtaChannel ? () => onOtaConnect(ota) : undefined}
                disabled={(isAirbnb && connectPending) || loading}
              >
                <LinkIcon size={'0.75rem'} strokeWidth={1.75} />
                {(isAirbnb && connectPending)
                  ? <Spinner className="size-3" />
                  : `Connecter ${ota.name}`
                }
              </Button>
            )}
            {ota.available && connected && (
              // `destructive` et non `outline` : deconnecter un canal coupe la
              // synchronisation — l'encre --err du kit porte cet avertissement.
              <Button
                size="sm"
                variant="destructive"
                onClick={isAirbnb ? onAirbnbDisconnect : isOtaChannel ? () => onOtaDisconnectRequest(ota) : undefined}
                disabled={(isAirbnb && disconnectPending) || disconnectingChannelId === ota.id}
              >
                <LinkOffIcon size={'0.75rem'} strokeWidth={1.75} />
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
        </div>
      );
    })}
  </div>
);

export default ChannelsListView;
