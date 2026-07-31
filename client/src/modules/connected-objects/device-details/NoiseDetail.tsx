import { useRef, useState } from 'react';
import { Badge } from '../../../components/ui';
import { Alert, AlertDescription } from '../../../components/ui';
import { TriangleAlert } from 'lucide-react';
import { Box, Button } from '@mui/material';
import { Settings, History, Save, VolumeUp, Wifi, WifiOff, TrendingUp, ArrowUpward } from '../../../icons';
import NoiseMonitorChart from '../../dashboard/NoiseMonitorChart';
import NoiseAlertConfigPanel, {
  type ActiveThresholds,
  type NoiseAlertConfigHandle,
  type NoiseAlertConfigStatus,
} from '../../dashboard/NoiseAlertConfigPanel';
import NoiseAlertHistory from '../../dashboard/NoiseAlertHistory';
import EmptyState from '../../../components/EmptyState';
import StatTile from '../../../components/StatTile';
import { useNoiseDeviceDetail } from '../useNoiseDeviceDetail';
import { NOISE_THRESHOLDS } from '../../../hooks/noiseMonitoring';
import type { ConnectedDevice } from '../types';
import PageTabs from '../../../components/PageTabs';

const NEUTRAL = '#9CA3AF';

/** Accent d'un niveau sonore selon les seuils Clenzy (vert calme → ambre → corail). */
function levelAccent(level: number): string {
  if (level <= NOISE_THRESHOLDS.normal) return '#4A9B8E';
  if (level <= NOISE_THRESHOLDS.warning) return '#D4A574';
  return '#C97A7A';
}

/**
 * Corps « bruit » du détail unifié, réorganisé pour la lecture d'un capteur unique :
 *  1. Bandeau de lecture live (Connexion · Niveau actuel · Moyenne · Pic) — donne du
 *     sens immédiat même hors ligne (valeurs « — » tant qu'aucune mesure n'est remontée).
 *  2. Courbe de monitoring pleine largeur, TOUJOURS amorcée (axes + seuils visibles).
 *  3. Sous-onglets Configuration (seuils du logement) / Historique (alertes), avec un
 *     bouton « Sauvegarder » piloté par l'état réel du panneau (pas de lecture de ref en render).
 * Réutilise les composants riches existants en variante `device`/`embedded`.
 */
export default function NoiseDetail({ device }: { device: ConnectedDevice }) {
  const { data, combinedChartData, loading } = useNoiseDeviceDetail(device);
  const [activeThresholds, setActiveThresholds] = useState<ActiveThresholds | null>(null);
  const [subTab, setSubTab] = useState(0);
  const configRef = useRef<NoiseAlertConfigHandle>(null);
  const [configStatus, setConfigStatus] = useState<NoiseAlertConfigStatus>({
    canSave: false,
    isSaving: false,
    isSaved: false,
    hasError: false,
  });
  const propertyId = device.propertyId;

  const sensor = data.properties[0];
  const hasData = combinedChartData.length > 0;
  const reading = (level: number) => (hasData ? `${level} dB` : '—');
  const connectionLabel = device.online
    ? 'En ligne'
    : device.statusLevel === 'unknown'
      ? 'En attente'
      : 'Hors ligne';

  return (
    <div className="flex flex-col gap-3">
      {/* 1. Lecture live du capteur — remplace la tuile « Connexion » orpheline */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 1 }}>
        <StatTile
          icon={device.online ? <Wifi /> : <WifiOff />}
          label="Connexion"
          value={connectionLabel}
          color={device.online ? '#4A9B8E' : NEUTRAL}
        />
        <StatTile
          icon={<VolumeUp />}
          label="Niveau actuel"
          value={reading(sensor?.currentLevel ?? 0)}
          color={hasData ? levelAccent(sensor?.currentLevel ?? 0) : NEUTRAL}
        />
        <StatTile
          icon={<TrendingUp />}
          label="Moyenne 24 h"
          value={reading(sensor?.averageLevel ?? 0)}
          color="#6B8A9A"
        />
        <StatTile
          icon={<ArrowUpward />}
          label="Pic 24 h"
          value={reading(sensor?.maxLevel ?? 0)}
          color={hasData ? levelAccent(sensor?.maxLevel ?? 0) : NEUTRAL}
        />
      </Box>

      {/* 2. Monitoring — pleine largeur, hauteur fixe pour amorcer le graphique */}
      <Box sx={{ width: '100%', height: { xs: 320, md: 380 } }}>
        <NoiseMonitorChart
          variant="device"
          data={data}
          combinedChartData={combinedChartData}
          activeThresholds={activeThresholds}
          loading={loading}
        />
      </Box>

      {/* 3. Configuration | Historique */}
      <div>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: 1, borderColor: 'divider' }}>
          <PageTabs
            options={[
              { label: 'Configuration', icon: <Settings /> },
              { label: 'Historique', icon: <History /> },
            ]}
            value={subTab}
            onChange={setSubTab}
            size="compact"
            mb={0}
            trail={false}
          />

          {subTab === 0 && propertyId != null && (
            <div className="flex items-center gap-1.5 pe-0.5">
              {configStatus.hasError && (
                <Alert variant="destructive" className="py-0 px-1.5 text-[0.6875rem]">
                  <TriangleAlert />
                  <AlertDescription>Erreur</AlertDescription>
                </Alert>
              )}
              {configStatus.isSaved && (
                <Badge variant="secondary" className="text-[0.6875rem] h-[22px] font-semibold bg-[var(--ok-soft)] text-[var(--ok)] rounded-[var(--radius-pill)]">Sauvegardé</Badge>
              )}
              <Button
                variant="contained"
                size="small"
                startIcon={<Save size={14} strokeWidth={1.75} />}
                onClick={() => configRef.current?.save()}
                disabled={!configStatus.canSave || configStatus.isSaving}
              >
                {configStatus.isSaving ? 'Sauvegarde…' : 'Sauvegarder'}
              </Button>
            </div>
          )}
        </Box>

        <div className="pt-3">
          {subTab === 0 && (
            propertyId != null ? (
              <NoiseAlertConfigPanel
                ref={configRef}
                propertyIds={[propertyId]}
                embedded
                onThresholdsChange={setActiveThresholds}
                onStatusChange={setConfigStatus}
              />
            ) : (
              <EmptyState
                icon={<VolumeUp />}
                title="Aucun logement associé"
                description="Associez ce capteur à un logement pour configurer les seuils d'alerte."
              />
            )
          )}
          {subTab === 1 && <NoiseAlertHistory propertyId={propertyId ?? undefined} />}
        </div>
      </div>
    </div>
  );
}
