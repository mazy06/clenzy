import { Paper } from '@mui/material';
import AccessCodeSection from '../components/AccessCodeSection';
import { DEVICE_KINDS } from '../deviceRegistry';
import type { ConnectedDevice } from '../types';

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 py-0.5">
      <span className="cn-text-caption text-muted-foreground">{label}</span>
      <span className="cn-text-caption font-semibold text-foreground text-end">{value}</span>
    </div>
  );
}

/**
 * Corps « serrure » du détail unifié. Mince : la carte du hub gère déjà
 * verrouillage / batterie / suppression. Ici : gestion du code d'accès + identité.
 */
export default function LockDetail({ device }: { device: ConnectedDevice }) {
  const meta = DEVICE_KINDS[device.kind];
  return (
    <div className="flex flex-col gap-3">
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 'var(--radius-lg)' }}>
        <h6 className="cn-text-subtitle2 mb-0.5 font-bold">Code d'accès</h6>
        <AccessCodeSection deviceId={device.id} />
      </Paper>

      <Paper variant="outlined" sx={{ p: 2, borderRadius: 'var(--radius-lg)' }}>
        <h6 className="cn-text-subtitle2 mb-1.5 font-bold">Informations</h6>
        <InfoRow label="Type" value={meta.singular} />
        <InfoRow label="Marque" value={device.provider !== 'UNKNOWN' ? device.provider : '—'} />
        <InfoRow label="Logement" value={device.propertyName} />
        <InfoRow label="Pièce" value={device.roomName ?? '—'} />
      </Paper>
    </div>
  );
}
