import React from 'react';
import { Alert, AlertDescription } from '../../components/ui';
import { TriangleAlert } from 'lucide-react';
import type { AirbnbConnectionStatus } from '../../services/api/airbnbApi';

// Logo import (utilise dans la section "connecte" Airbnb)
import airbnbLogoSmall from '../../assets/logo/airbnb-logo-small.svg';

interface AirbnbConnectionDetailsProps {
  connectionStatus: AirbnbConnectionStatus;
  dateLocale: string;
  t: (key: string, options?: Record<string, unknown>) => string;
}

/** Panneau de détails de connexion Airbnb (affiché quand connecté). */
const AirbnbConnectionDetails: React.FC<AirbnbConnectionDetailsProps> = ({
  connectionStatus,
  dateLocale,
  t,
}) => (
  // Report en classes de `CARD_SX` + mb: 1.5 (p: 2 = 12 px, mb: 1.5 = 9 px).
  <div className="border border-solid border-[var(--line)] bg-[var(--card)] rounded-[14px] p-3 mb-[9px] shadow-none">
    <div className="flex items-center gap-1.5 mb-2">
      <img className="h-[18px]" src={airbnbLogoSmall} alt="Airbnb" />
      <p className="cn-text-body1 text-[0.875rem] font-bold">
        {t('channels.airbnb.connectedSince')}
      </p>
    </div>
    <div className="flex gap-4 flex-wrap">
      <DetailItem label={t('channels.airbnb.userId')} value={connectionStatus.airbnbUserId ?? '—'} />
      <DetailItem
        label={t('channels.airbnb.connectedSince')}
        value={connectionStatus.connectedAt ? new Date(connectionStatus.connectedAt).toLocaleDateString(dateLocale) : '—'}
      />
      <DetailItem
        label={t('channels.airbnb.lastSync')}
        value={connectionStatus.lastSyncAt ? new Date(connectionStatus.lastSyncAt).toLocaleString(dateLocale) : '—'}
      />
      <DetailItem
        label={t('channels.airbnb.linkedListings')}
        value={String(connectionStatus.linkedListingsCount)}
      />
      {connectionStatus.errorMessage && (
        <Alert variant="warning" className="text-[0.75rem] py-0 w-full">
          <TriangleAlert />
          <AlertDescription>{connectionStatus.errorMessage}</AlertDescription>
        </Alert>
      )}
    </div>
  </div>
);

export default AirbnbConnectionDetails;

// ─── Sub-components ──────────────────────────────────────────────────────────

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="cn-text-body1 text-[10.5px] text-[var(--faint)] font-bold uppercase tracking-[0.06em]">
        {label}
      </p>
      <p className="cn-text-body1 text-[0.8125rem] font-semibold tabular-nums">
        {value}
      </p>
    </div>
  );
}
