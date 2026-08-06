import { useParams, useNavigate } from 'react-router-dom';
import { Skeleton } from '../../components/ui';
import { Button } from '../../components/ui';
import { MonitorHeart, BatteryAlert, ChevronRight } from '../../icons';
import PageHeader from '../../components/PageHeader';
import StatTile from '../../components/baitly/StatTile';
import EmptyState from '../../components/EmptyState';
import StatusPill from './components/StatusPill';
import { DEVICE_KINDS } from './deviceRegistry';
import { useConnectedObjects } from './useConnectedObjects';
import NoiseDetail from './device-details/NoiseDetail';
import LockDetail from './device-details/LockDetail';
import KeyboxDetail from './device-details/KeyboxDetail';
import SensorDetail from './device-details/SensorDetail';
import type { DeviceKind } from './types';

const SENSOR_KINDS: DeviceKind[] = ['climate', 'contact', 'motion', 'smoke'];

// `DEVICE_KINDS[].color` reste un hex : il alimente aussi `iconBadgeColor` du
// PageHeader. Cette table donne l'equivalent Baitly UI pour l'icone de tuile.
const DEVICE_ICON_CLASSES: Record<string, string> = {
  '#7BA3C2': 'text-info',
  '#4A9B8E': 'text-success',
  '#D4A574': 'text-warning',
  '#C97A7A': 'text-destructive',
  '#6B8A9A': 'text-primary',
};

const deviceIconClass = (hex: string): string => DEVICE_ICON_CLASSES[hex] ?? 'text-primary';

const HUB_PATH = '/properties?tab=connected-objects';

// Caméra / thermostat : aperçus Phase 2 (UI-first) — on garde un lien vers l'écran
// aperçu tant que le corps unifié n'est pas fait. Retirés/intégrés ultérieurement.
const LEGACY_ROUTE: Partial<Record<DeviceKind, string>> = {
  camera: '/connected-objects/cameras',
  thermostat: '/connected-objects/thermostats',
};

/**
 * Détail unifié d'un objet connecté : `/connected-objects/device/:kind/:id`.
 * Un seul shell cohérent (PageHeader + résumé StatTile) + un corps par type,
 * remplaçant les anciens écrans de gestion par type.
 */
export default function DeviceDetail() {
  const { kind, id } = useParams<{ kind: string; id: string }>();
  const navigate = useNavigate();
  const { devices, loading } = useConnectedObjects();
  const device = devices.find((d) => d.kind === kind && d.id === Number(id));

  if (loading && !device) {
    return (
      <div>
        <Skeleton className="h-16 w-full mb-3 rounded-[var(--radius-lg)]" />
        <Skeleton className="h-[360px] w-full rounded-[var(--radius-lg)]" />
      </div>
    );
  }

  if (!device) {
    return (
      <div>
        <PageHeader title="Objet introuvable" backPath={HUB_PATH} backLabel="Objets connectés" />
        <EmptyState
          icon={<ChevronRight />}
          title="Objet introuvable"
          description="Cet objet connecté n'existe plus ou n'est pas accessible."
          action={<Button variant="outline" onClick={() => navigate(HUB_PATH)}>Retour aux objets connectés</Button>}
        />
      </div>
    );
  }

  const meta = DEVICE_KINDS[device.kind];
  const subtitle = [device.propertyName, device.roomName, meta.singular].filter(Boolean).join(' · ');

  return (
    <div>
      <PageHeader
        title={device.name}
        subtitle={subtitle}
        iconBadge={meta.icon()}
        iconBadgeColor={meta.color}
        titleAdornment={<StatusPill level={device.statusLevel} label={device.statusLabel} pulse={device.online} />}
        backPath={HUB_PATH}
        backLabel="Objets connectés"
      />

      {/* Résumé compact (pas de carte-dans-carte). Les capteurs de bruit fournissent
          leur propre bandeau de lecture live (Niveau actuel / Moyenne / Pic) dans
          NoiseDetail — on évite ainsi une rangée générique « Connexion » orpheline. */}
      {device.kind !== 'noise' && (
        <div className="grid grid-cols-[repeat(auto-fit,_minmax(140px,_1fr))] gap-1.5 mb-3">
          <StatTile
            icon={<MonitorHeart />}
            label="Connexion"
            value={device.online ? 'En ligne' : device.statusLevel === 'unknown' ? 'En attente' : 'Hors ligne'}
            iconClassName={device.online ? 'text-success' : 'text-muted-foreground'}
          />
          {device.battery != null && (
            <StatTile icon={<BatteryAlert />} label="Batterie" value={`${device.battery}%`} iconClassName="text-warning" />
          )}
          {device.primaryMetric && (
            <StatTile icon={meta.icon()} label={device.primaryMetric.label} value={device.primaryMetric.value} iconClassName={deviceIconClass(meta.color)} />
          )}
        </div>
      )}

      {/* Corps spécifique au type */}
      {device.kind === 'noise' && <NoiseDetail device={device} />}
      {device.kind === 'lock' && <LockDetail device={device} />}
      {device.kind === 'keybox' && <KeyboxDetail device={device} />}
      {SENSOR_KINDS.includes(device.kind) && <SensorDetail device={device} />}
      {LEGACY_ROUTE[device.kind] && (
        <EmptyState
          icon={meta.icon(28)}
          title="Gestion détaillée"
          description="La gestion avancée de cet objet est en cours d'intégration dans cette vue."
          action={
            <Button
              variant="outline"
              onClick={() => navigate(LEGACY_ROUTE[device.kind]!)}
            >
              Ouvrir la gestion
              <ChevronRight size={16} strokeWidth={1.75} />
            </Button>
          }
        />
      )}
    </div>
  );
}
