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

/** Entete de colonne : surtitre de l'echelle Baitly UI. */
const OVERLINE_CLASS = 'text-2xs font-semibold uppercase tracking-wide text-muted-foreground';

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
  <div className="mb-[9px] overflow-hidden rounded-xl border border-border bg-card">
    {/* Table header */}
    <div className="grid grid-cols-[110px_1.6fr_0.8fr_1fr_1.4fr] gap-3 px-3 py-[7.5px] border-b border-border bg-muted">
      <p className={OVERLINE_CLASS}>
        Logo
      </p>
      <p className={OVERLINE_CLASS}>
        Nom
      </p>
      <p className={OVERLINE_CLASS}>
        Segment
      </p>
      <p className={OVERLINE_CLASS}>
        Statut
      </p>
      <p className={cn(OVERLINE_CLASS, 'text-end')}>
        Action
      </p>
    </div>

    {/* Rows */}
    {channels.map((ota) => {
      const isAirbnb = ota.id === 'airbnb';
      const isOtaChannel = (ota.id as string) in CHANNEL_BACKEND_MAP;
      const otaStatus = isOtaChannel ? getOtaStatus(ota.id as ChannelId) : undefined;
      const connected = isAirbnb ? isConnected : isOtaChannel ? isOtaConnected(ota.id as ChannelId) : false;
      const loading = isAirbnb ? connectionLoading : isOtaChannel ? otaConnectionsLoading : false;

      return (
        <div className={cn('grid grid-cols-[110px_1.6fr_0.8fr_1fr_1.4fr] gap-3 px-3 py-[9px] items-center border-b border-border last:border-b-0 transition-colors duration-150 motion-reduce:transition-none hover:bg-muted', ota.available ? 'opacity-100' : 'opacity-60')} key={ota.id}>
          {/* Pastille logo — surface douce tokenisée, marque conservée sur le logo */}
          <div className="h-[40px] w-[96px] flex items-center justify-center rounded-[10px]" style={{ backgroundColor: channelSoftBg(ota.id) }}>
            {ota.logo ? (
              <img className="h-[22px] max-w-[76px] object-contain" src={ota.logo} alt={ota.name} />
            ) : (
              <p className="text-xs font-bold tracking-[-0.02em]" style={{ fontFamily: 'var(--font-display)', color: ota.brandColor }}>
                {ota.name}
              </p>
            )}
          </div>

          {/* Channel name */}
          <div className="min-w-0">
            <p className="font-[family-name:var(--font-display)] text-sm font-semibold text-foreground">
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

          {/* Status — connecté success / à configurer warning / bientôt muted */}
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
              // synchronisation — l'encre destructive du kit porte cet avertissement.
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
              <p className="text-xs text-faint">
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
