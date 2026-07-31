import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '../../../components/ui';
import { Button, Chip, CircularProgress, Snackbar, Alert } from '@mui/material';
import { Refresh } from '../../../icons';
import { environmentSensorsApi, type EnvironmentSensorDto } from '../../../services/api/environmentSensorsApi';
import { STATUS_TOKENS } from '../deviceRegistry';
import BatteryIndicator from '../components/BatteryIndicator';
import { useState, type ReactNode } from 'react';
import type { ConnectedDevice, DeviceStatusLevel } from '../types';

// Pilule statut : texte couleur + fond `-soft` (tokens sémantiques Signature,
// mêmes niveaux que StatusPill — remplace l'ancien helper hex softChipSx).
const statusPillSx = (level: DeviceStatusLevel) => {
  const { color, soft } = STATUS_TOKENS[level];
  return {
    height: 22,
    fontSize: '0.6875rem',
    fontWeight: 600,
    backgroundColor: soft,
    color,
    border: 'none',
    borderRadius: 'var(--radius-pill)',
    '& .MuiChip-label': { px: 1 },
  } as const;
};

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between items-center gap-3 py-1">
      <span className="cn-text-caption text-muted-foreground">{label}</span>
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
  const [snack, setSnack] = useState<{ msg: string; severity: 'success' | 'error' } | null>(null);

  const refresh = useMutation({
    mutationFn: () => environmentSensorsApi.refresh(device.id),
    onSuccess: () => {
      setSnack({ msg: 'État rafraîchi', severity: 'success' });
      void qc.invalidateQueries({ queryKey: ['connected-objects'] });
    },
    onError: (e: unknown) => setSnack({ msg: e instanceof Error ? e.message : 'Échec du rafraîchissement', severity: 'error' }),
  });

  // État principal typé (chip colorée — le seul endroit où la couleur porte un sens).
  const primary = (() => {
    switch (sensor.sensorType) {
      case 'CONTACT': {
        if (sensor.contactOpen == null) return { label: 'État', node: <Chip size="small" label="Inconnu" sx={statusPillSx('unknown')} /> };
        const open = sensor.contactOpen === true;
        return { label: 'État', node: <Chip size="small" label={open ? 'Ouvert' : 'Fermé'} sx={statusPillSx(open ? 'warning' : 'ok')} /> };
      }
      case 'MOTION': {
        if (sensor.motionDetected == null) return { label: 'Mouvement', node: <Chip size="small" label="Inconnu" sx={statusPillSx('unknown')} /> };
        const m = sensor.motionDetected === true;
        return { label: 'Mouvement', node: <Chip size="small" label={m ? 'Détecté' : 'Aucun'} sx={statusPillSx(m ? 'warning' : 'ok')} /> };
      }
      case 'SMOKE': {
        if (sensor.smokeDetected == null) return { label: 'Fumée / vape', node: <Chip size="small" label="Inconnu" sx={statusPillSx('unknown')} /> };
        const s = sensor.smokeDetected === true;
        return { label: 'Fumée / vape', node: <Chip size="small" label={s ? 'Détectée' : 'Aucune'} sx={statusPillSx(s ? 'critical' : 'ok')} /> };
      }
      default:
        return null; // climate : pas de chip binaire, on montre les mesures
    }
  })();

  return (
    <div className="flex flex-col gap-3">
      <Card className="gap-0 py-0 p-3">
        <div className="flex justify-between items-center mb-1.5">
          <h6 className="cn-text-subtitle2 font-bold">État du capteur</h6>
          <Button
            size="small"
            variant="outlined"
            startIcon={refresh.isPending ? <CircularProgress size={13} color="inherit" /> : <Refresh size={15} strokeWidth={1.75} />}
            onClick={() => refresh.mutate()}
            disabled={refresh.isPending}
          >
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
        <h6 className="cn-text-subtitle2 font-bold mb-1.5">Identité</h6>
        <InfoRow label="Pièce" value={device.roomName || '—'} />
        <InfoRow label="Fournisseur" value={sensor.brand || '—'} />
        <InfoRow label="Logement" value={device.propertyName} />
      </Card>

      {(sensor.sensorType === 'SMOKE' || sensor.sensorType === 'MOTION') && (
        <span className="cn-text-caption text-muted-foreground px-0.5">
          Une notification est envoyée aux administrateurs et managers de l'organisation à chaque détection
          {sensor.sensorType === 'SMOKE' ? ' de fumée ou de vape' : ' de mouvement'} (avec anti-spam).
        </span>
      )}

      <Snackbar open={!!snack} autoHideDuration={3000} onClose={() => setSnack(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        {snack ? <Alert severity={snack.severity} variant="filled" onClose={() => setSnack(null)} sx={{ width: '100%' }}>{snack.msg}</Alert> : undefined}
      </Snackbar>
    </div>
  );
}
