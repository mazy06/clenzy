import React from 'react';
import { Badge } from '../../components/ui';
import {
  Sync as SyncIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  CleaningServices as CleaningIcon,
} from '../../icons';
import type { AirbnbListingMapping } from '../../services/api/airbnbApi';
import type { Property } from '../../services/api/propertiesApi';

/** Gabarit de carte partage par les sections Airbnb : hairline sur surface de panneau. */
const CARD_CLASS = 'border border-border bg-card rounded-xl p-3';

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
  <div className={CARD_CLASS}>
    <p className="text-sm font-semibold tracking-tight mb-1.5">
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
  </div>
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
  // Teinte vive pour l'icone et la bordure, `-soft` pour le fond pastel (cf. §2.4).
  const statusColor = syncOk ? 'var(--bui-success)' : listing.syncEnabled ? 'var(--bui-warning)' : 'var(--bui-muted-foreground)';
  const statusSoft = syncOk ? 'var(--bui-success-soft)' : listing.syncEnabled ? 'var(--bui-warning-soft)' : 'var(--bui-field)';

  return (
    <div className="border rounded-lg p-[7.5px]" style={{ borderColor: `color-mix(in srgb, ${statusColor} 30%, transparent)`, backgroundColor: statusSoft }}>
      <div className="flex items-center gap-0.5 mb-0.5">
        <span className="inline-flex" style={{ color: statusColor }}>
          <StatusIcon size={14} strokeWidth={1.75} />
        </span>
        <p className="text-xs font-semibold">
          {propertyName}
        </p>
      </div>
      <p className="text-2xs text-muted-foreground">
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
