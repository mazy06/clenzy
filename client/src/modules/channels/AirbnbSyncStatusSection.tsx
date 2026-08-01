import React from 'react';
import { Badge } from '../../components/ui';
import { Paper } from '@mui/material';
import {
  Sync as SyncIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  CleaningServices as CleaningIcon,
} from '../../icons';
import type { AirbnbListingMapping } from '../../services/api/airbnbApi';
import type { Property } from '../../services/api/propertiesApi';
import { CARD_SX } from './channelsPageConstants';

interface AirbnbSyncStatusSectionProps {
  listings: AirbnbListingMapping[];
  properties: Property[];
  dateLocale: string;
  t: (key: string, options?: Record<string, unknown>) => string;
}

/** Section 3 : Statut sync par propriété (Channel Manager vue hôte). */
const AirbnbSyncStatusSection: React.FC<AirbnbSyncStatusSectionProps> = ({
  listings,
  properties,
  dateLocale,
  t,
}) => (
  <Paper sx={{ ...CARD_SX }}>
    <p className="cn-text-body1 text-[0.875rem] font-bold mb-1.5">
      {t('channels.syncStatus.title')}
    </p>
    <div className="grid grid-cols-[1fr] min-[600px]:grid-cols-[1fr_1fr] min-[900px]:grid-cols-[1fr_1fr_1fr] gap-1.5">
      {listings.map((listing) => {
        const property = properties.find((p) => p.id === listing.propertyId);
        return (
          <SyncStatusCard
            key={listing.id}
            listing={listing}
            propertyName={property?.name ?? `Propriété #${listing.propertyId}`}
            t={t}
            dateLocale={dateLocale}
          />
        );
      })}
    </div>
  </Paper>
);

export default AirbnbSyncStatusSection;

// ─── Sub-components ──────────────────────────────────────────────────────────

function SyncStatusCard({
  listing,
  propertyName,
  t,
  dateLocale,
}: {
  listing: AirbnbListingMapping;
  propertyName: string;
  t: (key: string, options?: Record<string, unknown>) => string;
  dateLocale: string;
}) {
  const syncOk = listing.syncEnabled && listing.lastSyncAt;
  const StatusIcon = syncOk ? CheckCircleIcon : listing.syncEnabled ? WarningIcon : ErrorIcon;
  const statusColor = syncOk ? 'var(--ok)' : listing.syncEnabled ? 'var(--warn)' : 'var(--muted)';
  const statusSoft = syncOk ? 'var(--ok-soft)' : listing.syncEnabled ? 'var(--warn-soft)' : 'var(--field)';

  return (
    <div className="border border-solid rounded-[10px] p-[7.5px]" style={{ borderColor: `color-mix(in srgb, ${statusColor} 30%, transparent)`, backgroundColor: statusSoft }}>
      <div className="flex items-center gap-0.5 mb-0.5">
        <span className="inline-flex" style={{ color: statusColor }}>
          <StatusIcon size={14} strokeWidth={1.75} />
        </span>
        <p className="cn-text-body1 text-[0.75rem] font-semibold">
          {propertyName}
        </p>
      </div>
      <p className="cn-text-body1 text-[0.625rem] text-muted-foreground">
        {listing.syncEnabled ? t('channels.syncStatus.syncOn') : t('channels.syncStatus.syncOff')}
        {listing.lastSyncAt && ` · ${t('channels.syncStatus.lastSync')}: ${new Date(listing.lastSyncAt).toLocaleString(dateLocale)}`}
      </p>
      <div className="flex gap-0.5 mt-0.5">
        {listing.syncEnabled && <Badge variant="success" className="text-[0.5625rem] h-[18px]">{<><SyncIcon size={'0.625rem'} strokeWidth={1.75} /> Sync</>}</Badge>}
        {listing.autoCreateInterventions && <Badge variant="info" className="text-[0.5625rem] h-[18px]">{<><CleaningIcon size={'0.625rem'} strokeWidth={1.75} /> Auto</>}</Badge>}
      </div>
    </div>
  );
}
