import React from 'react';
import { alpha } from '@mui/material/styles';
import { Box, Paper, Typography, Chip } from '@mui/material';
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
    <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, mb: 1 }}>
      {t('channels.syncStatus.title')}
    </Typography>
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }, gap: 1 }}>
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
    </Box>
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
  const statusColor = syncOk ? '#4A9B8E' : listing.syncEnabled ? '#D4A574' : '#9e9e9e';

  return (
    <Box
      sx={{
        border: '1px solid',
        borderColor: alpha(statusColor, 0.35),
        borderRadius: 1,
        p: 1.25,
        bgcolor: alpha(statusColor, 0.04),
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
        <Box component="span" sx={{ display: 'inline-flex', color: statusColor }}>
          <StatusIcon size={14} strokeWidth={1.75} />
        </Box>
        <Typography sx={{ fontSize: '0.75rem', fontWeight: 600 }}>
          {propertyName}
        </Typography>
      </Box>
      <Typography sx={{ fontSize: '0.625rem', color: 'text.secondary' }}>
        {listing.syncEnabled ? t('channels.syncStatus.syncOn') : t('channels.syncStatus.syncOff')}
        {listing.lastSyncAt && ` · ${t('channels.syncStatus.lastSync')}: ${new Date(listing.lastSyncAt).toLocaleString(dateLocale)}`}
      </Typography>
      <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
        {listing.syncEnabled && <Chip label={<><SyncIcon size={'0.625rem'} strokeWidth={1.75} /> Sync</>} size="small" sx={{ fontSize: '0.5625rem', height: 18 }} color="success" variant="outlined" />}
        {listing.autoCreateInterventions && <Chip label={<><CleaningIcon size={'0.625rem'} strokeWidth={1.75} /> Auto</>} size="small" sx={{ fontSize: '0.5625rem', height: 18 }} color="info" variant="outlined" />}
      </Box>
    </Box>
  );
}
