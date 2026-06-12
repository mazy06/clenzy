import { useParams, useNavigate } from 'react-router-dom';
import { Box, Button, Skeleton } from '@mui/material';
import { MonitorHeart, BatteryAlert, ChevronRight } from '../../icons';
import PageHeader from '../../components/PageHeader';
import StatTile from '../../components/StatTile';
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
      <Box>
        <Skeleton variant="rounded" height={64} sx={{ mb: 2, borderRadius: 'var(--radius-lg)' }} />
        <Skeleton variant="rounded" height={360} sx={{ borderRadius: 'var(--radius-lg)' }} />
      </Box>
    );
  }

  if (!device) {
    return (
      <Box>
        <PageHeader title="Objet introuvable" backPath={HUB_PATH} backLabel="Objets connectés" />
        <EmptyState
          icon={<ChevronRight />}
          title="Objet introuvable"
          description="Cet objet connecté n'existe plus ou n'est pas accessible."
          action={<Button variant="outlined" onClick={() => navigate(HUB_PATH)}>Retour aux objets connectés</Button>}
        />
      </Box>
    );
  }

  const meta = DEVICE_KINDS[device.kind];
  const subtitle = [device.propertyName, device.roomName, meta.singular].filter(Boolean).join(' · ');

  return (
    <Box>
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
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 1, mb: 2 }}>
          <StatTile
            icon={<MonitorHeart />}
            label="Connexion"
            value={device.online ? 'En ligne' : device.statusLevel === 'unknown' ? 'En attente' : 'Hors ligne'}
            color={device.online ? '#4A9B8E' : '#9CA3AF'}
          />
          {device.battery != null && (
            <StatTile icon={<BatteryAlert />} label="Batterie" value={`${device.battery}%`} color="#D4A574" />
          )}
          {device.primaryMetric && (
            <StatTile icon={meta.icon()} label={device.primaryMetric.label} value={device.primaryMetric.value} color={meta.color} />
          )}
        </Box>
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
              variant="outlined"
              endIcon={<ChevronRight size={16} strokeWidth={1.75} />}
              onClick={() => navigate(LEGACY_ROUTE[device.kind]!)}
            >
              Ouvrir la gestion
            </Button>
          }
        />
      )}
    </Box>
  );
}
