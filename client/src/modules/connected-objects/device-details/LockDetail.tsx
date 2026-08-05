
import AccessCodeSection from '../components/AccessCodeSection';
import { Card } from '../../../components/ui';
import { DEVICE_KINDS } from '../deviceRegistry';
import type { ConnectedDevice } from '../types';

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 py-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-semibold text-foreground text-end">{value}</span>
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
      <Card className="gap-0 py-0 p-3">
        <h6 className="text-xs font-semibold mb-0.5">Code d'accès</h6>
        <AccessCodeSection deviceId={device.id} />
      </Card>

      <Card className="gap-0 py-0 p-3">
        <h6 className="text-xs font-semibold mb-1.5">Informations</h6>
        <InfoRow label="Type" value={meta.singular} />
        <InfoRow label="Marque" value={device.provider !== 'UNKNOWN' ? device.provider : '—'} />
        <InfoRow label="Logement" value={device.propertyName} />
        <InfoRow label="Pièce" value={device.roomName ?? '—'} />
      </Card>
    </div>
  );
}
