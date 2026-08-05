import { useMutation, useQueryClient } from '@tanstack/react-query';
import StatusChip, { type StatusTone } from '../../../components/StatusChip';
import { Spinner } from '../../../components/ui';
import { Card } from '../../../components/ui';
import { Button } from '../../../components/ui';
import { useNotification } from '../../../hooks/useNotification';
import { Refresh } from '../../../icons';
import { environmentSensorsApi, type EnvironmentSensorDto } from '../../../services/api/environmentSensorsApi';
import BatteryIndicator from '../components/BatteryIndicator';
import { type ReactNode } from 'react';
import type { ConnectedDevice, DeviceStatusLevel } from '../types';

/**
 * Niveau de statut d'appareil → ton sémantique de la primitive. La table des
 * tons porte le couple encre `-ink` / fond `-soft` conforme AA ; un niveau
 * hors ligne ou inconnu n'est pas une couleur, c'est du neutre.
 */
const STATUS_LEVEL_TONES: Record<DeviceStatusLevel, StatusTone> = {
  ok: 'ok',
  warning: 'warn',
  critical: 'err',
  offline: 'neutral',
  unknown: 'neutral',
};

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between items-center gap-3 py-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="font-semibold text-foreground text-end tabular-nums">{value}</div>
    </div>
  );
}

function fmt(dt: string | null): string {
  if (!dt) return '—';
  return new Date(dt).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/**
 * Corps « capteur d'environnement » du détail unifié (temp/humidité, contact,
 * mouvement, fumée). Affiche l'état courant typé + batterie + horodatages, avec
 * un bouton de rafraîchissement (lecture Tuya à la demande). Écrit directement
 * sur `environmentSensorsApi`, dans le langage visuel du hub.
 */
export default function SensorDetail({ device }: { device: ConnectedDevice }) {
  const qc = useQueryClient();
  const sensor = device.raw as EnvironmentSensorDto;
  const { notify } = useNotification();

  const refresh = useMutation({
    mutationFn: () => environmentSensorsApi.refresh(device.id),
    onSuccess: () => {
      notify.success('État rafraîchi');
      void qc.invalidateQueries({ queryKey: ['connected-objects'] });
    },
    onError: (e: unknown) => notify.error(e instanceof Error ? e.message : 'Échec du rafraîchissement'),
  });

  // État principal typé (chip colorée — le seul endroit où la couleur porte un sens).
  const primary = (() => {
    switch (sensor.sensorType) {
      case 'CONTACT': {
        if (sensor.contactOpen == null) return { label: 'État', node: <StatusChip pill tone={STATUS_LEVEL_TONES.unknown} label="Inconnu" /> };
        const open = sensor.contactOpen === true;
        return { label: 'État', node: <StatusChip pill tone={STATUS_LEVEL_TONES[open ? 'warning' : 'ok']} label={open ? 'Ouvert' : 'Fermé'} /> };
      }
      case 'MOTION': {
        if (sensor.motionDetected == null) return { label: 'Mouvement', node: <StatusChip pill tone={STATUS_LEVEL_TONES.unknown} label="Inconnu" /> };
        const m = sensor.motionDetected === true;
        return { label: 'Mouvement', node: <StatusChip pill tone={STATUS_LEVEL_TONES[m ? 'warning' : 'ok']} label={m ? 'Détecté' : 'Aucun'} /> };
      }
      case 'SMOKE': {
        if (sensor.smokeDetected == null) return { label: 'Fumée / vape', node: <StatusChip pill tone={STATUS_LEVEL_TONES.unknown} label="Inconnu" /> };
        const s = sensor.smokeDetected === true;
        return { label: 'Fumée / vape', node: <StatusChip pill tone={STATUS_LEVEL_TONES[s ? 'critical' : 'ok']} label={s ? 'Détectée' : 'Aucune'} /> };
      }
      default:
        return null; // climate : pas de chip binaire, on montre les mesures
    }
  })();

  return (
    <div className="flex flex-col gap-3">
      <Card className="gap-0 py-0 p-3">
        <div className="flex justify-between items-center mb-1.5">
          <h6 className="text-xs font-semibold">État du capteur</h6>
          <Button
            size="sm"
            variant="outline"
            onClick={() => refresh.mutate()}
            disabled={refresh.isPending}
          >
            {refresh.isPending ? <Spinner className="size-[13px]" /> : <Refresh size={15} strokeWidth={1.75} />}
            Rafraîchir
          </Button>
        </div>

        {primary && <InfoRow label={primary.label} value={primary.node} />}
        {sensor.sensorType === 'TEMP_HUMIDITY' && (
          <>
            <InfoRow label="Température" value={sensor.temperatureC != null ? `${sensor.temperatureC.toFixed(1)} °C` : '—'} />
            <InfoRow label="Humidité" value={sensor.humidity != null ? `${sensor.humidity} %` : '—'} />
            {sensor.co2 != null && <InfoRow label="CO₂" value={`${sensor.co2} ppm`} />}
            {sensor.noiseDb != null && <InfoRow label="Bruit" value={`${sensor.noiseDb} dB`} />}
          </>
        )}
        <InfoRow
          label="Connexion"
          value={sensor.online == null ? 'En attente' : sensor.online ? 'En ligne' : 'Hors ligne'}
        />
        {sensor.batteryLevel != null && (
          <InfoRow label="Batterie" value={<BatteryIndicator level={sensor.batteryLevel} />} />
        )}
        <InfoRow label="Dernière mesure" value={fmt(sensor.lastSeenAt)} />
        {(sensor.sensorType === 'SMOKE' || sensor.sensorType === 'MOTION' || sensor.sensorType === 'CONTACT') && (
          <InfoRow label="Dernière détection" value={fmt(sensor.lastEventAt)} />
        )}
      </Card>

      <Card className="gap-0 py-0 p-3">
        <h6 className="text-xs font-semibold mb-1.5">Identité</h6>
        <InfoRow label="Pièce" value={device.roomName || '—'} />
        <InfoRow label="Fournisseur" value={sensor.brand || '—'} />
        <InfoRow label="Logement" value={device.propertyName} />
      </Card>

      {(sensor.sensorType === 'SMOKE' || sensor.sensorType === 'MOTION') && (
        <span className="text-xs text-muted-foreground px-0.5">
          Une notification est envoyée aux administrateurs et managers de l'organisation à chaque détection
          {sensor.sensorType === 'SMOKE' ? ' de fumée ou de vape' : ' de mouvement'} (avec anti-spam).
        </span>
      )}
    </div>
  );
}
