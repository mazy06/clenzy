import { useMutation, useQueryClient } from '@tanstack/react-query';
import StatusChip, { type StatusTone } from '../../../components/StatusChip';
import { Spinner } from '../../../components/ui';
import { Card } from '../../../components/ui';
import { Button } from '../../../components/ui';
import { useNotification } from '../../../hooks/useNotification';
import { useTranslation } from '../../../hooks/useTranslation';
import { Refresh } from '../../../icons';
import { environmentSensorsApi, type EnvironmentSensorDto } from '../../../services/api/environmentSensorsApi';
import BatteryIndicator from '../components/BatteryIndicator';
import { type ReactNode } from 'react';
import type { ConnectedDevice, DeviceStatusLevel } from '../types';
import { activeIntlLocale } from '../../../utils/activeLocale';

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
  return new Date(dt).toLocaleString(activeIntlLocale(), { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/**
 * Corps « capteur d'environnement » du détail unifié (temp/humidité, contact,
 * mouvement, fumée). Affiche l'état courant typé + batterie + horodatages, avec
 * un bouton de rafraîchissement (lecture Tuya à la demande). Écrit directement
 * sur `environmentSensorsApi`, dans le langage visuel du hub.
 */
export default function SensorDetail({ device }: { device: ConnectedDevice }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const sensor = device.raw as EnvironmentSensorDto;
  const { notify } = useNotification();

  const refresh = useMutation({
    mutationFn: () => environmentSensorsApi.refresh(device.id),
    onSuccess: () => {
      notify.success(t('connectedObjects.sensor.refreshed'));
      void qc.invalidateQueries({ queryKey: ['connected-objects'] });
    },
    onError: (e: unknown) => notify.error(e instanceof Error ? e.message : t('common.refreshError')),
  });

  // État principal typé (chip colorée — le seul endroit où la couleur porte un sens).
  const primary = (() => {
    switch (sensor.sensorType) {
      case 'CONTACT': {
        const label = t('connectedObjects.sensor.contact.label');
        if (sensor.contactOpen == null) return { label, node: <StatusChip pill tone={STATUS_LEVEL_TONES.unknown} label={t('connectedObjects.sensor.unknown')} /> };
        const open = sensor.contactOpen === true;
        return { label, node: <StatusChip pill tone={STATUS_LEVEL_TONES[open ? 'warning' : 'ok']} label={t(open ? 'connectedObjects.sensor.contact.open' : 'connectedObjects.sensor.contact.closed')} /> };
      }
      case 'MOTION': {
        const label = t('connectedObjects.sensor.motion.label');
        if (sensor.motionDetected == null) return { label, node: <StatusChip pill tone={STATUS_LEVEL_TONES.unknown} label={t('connectedObjects.sensor.unknown')} /> };
        const m = sensor.motionDetected === true;
        return { label, node: <StatusChip pill tone={STATUS_LEVEL_TONES[m ? 'warning' : 'ok']} label={t(m ? 'connectedObjects.sensor.motion.detected' : 'connectedObjects.sensor.motion.none')} /> };
      }
      case 'SMOKE': {
        const label = t('connectedObjects.sensor.smoke.label');
        if (sensor.smokeDetected == null) return { label, node: <StatusChip pill tone={STATUS_LEVEL_TONES.unknown} label={t('connectedObjects.sensor.unknown')} /> };
        const s = sensor.smokeDetected === true;
        return { label, node: <StatusChip pill tone={STATUS_LEVEL_TONES[s ? 'critical' : 'ok']} label={t(s ? 'connectedObjects.sensor.smoke.detected' : 'connectedObjects.sensor.smoke.none')} /> };
      }
      default:
        return null; // climate : pas de chip binaire, on montre les mesures
    }
  })();

  return (
    <div className="flex flex-col gap-3">
      <Card className="gap-0 py-0 p-3">
        <div className="flex justify-between items-center mb-1.5">
          <h6 className="text-xs font-semibold">{t('connectedObjects.sensor.state')}</h6>
          <Button
            size="sm"
            variant="outline"
            onClick={() => refresh.mutate()}
            disabled={refresh.isPending}
          >
            {refresh.isPending ? <Spinner className="size-[13px]" /> : <Refresh size={15} strokeWidth={1.75} />}
            {t('connectedObjects.sensor.refresh')}
          </Button>
        </div>

        {primary && <InfoRow label={primary.label} value={primary.node} />}
        {sensor.sensorType === 'TEMP_HUMIDITY' && (
          <>
            <InfoRow label={t('connectedObjects.sensor.temperature')} value={sensor.temperatureC != null ? `${sensor.temperatureC.toFixed(1)} °C` : '—'} />
            <InfoRow label={t('connectedObjects.sensor.humidity')} value={sensor.humidity != null ? `${sensor.humidity} %` : '—'} />
            {sensor.co2 != null && <InfoRow label={t('connectedObjects.sensor.co2')} value={`${sensor.co2} ppm`} />}
            {sensor.noiseDb != null && <InfoRow label={t('connectedObjects.sensor.noise')} value={`${sensor.noiseDb} dB`} />}
          </>
        )}
        <InfoRow
          label={t('connectedObjects.sensor.connection')}
          value={sensor.online == null
            ? t('connectedObjects.sensor.pending')
            : sensor.online ? t('connectedObjects.sensor.online') : t('connectedObjects.sensor.offline')}
        />
        {sensor.batteryLevel != null && (
          <InfoRow label={t('connectedObjects.sensor.battery')} value={<BatteryIndicator level={sensor.batteryLevel} />} />
        )}
        <InfoRow label={t('connectedObjects.sensor.lastMeasure')} value={fmt(sensor.lastSeenAt)} />
        {(sensor.sensorType === 'SMOKE' || sensor.sensorType === 'MOTION' || sensor.sensorType === 'CONTACT') && (
          <InfoRow label={t('connectedObjects.sensor.lastDetection')} value={fmt(sensor.lastEventAt)} />
        )}
      </Card>

      <Card className="gap-0 py-0 p-3">
        <h6 className="text-xs font-semibold mb-1.5">{t('connectedObjects.sensor.identity')}</h6>
        <InfoRow label={t('connectedObjects.sensor.room')} value={device.roomName || '—'} />
        <InfoRow label={t('connectedObjects.sensor.provider')} value={sensor.brand || '—'} />
        <InfoRow label={t('connectedObjects.sensor.property')} value={device.propertyName} />
      </Card>

      {(sensor.sensorType === 'SMOKE' || sensor.sensorType === 'MOTION') && (
        <span className="text-xs text-muted-foreground px-0.5">
          {t('connectedObjects.sensor.notifyHead')}{' '}
          {sensor.sensorType === 'SMOKE'
            ? t('connectedObjects.sensor.notifySmoke')
            : t('connectedObjects.sensor.notifyMotion')} {t('connectedObjects.sensor.notifyTail')}
        </span>
      )}
    </div>
  );
}
