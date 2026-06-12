import { useRef, useState } from 'react';
import { Box, Tabs, Tab, Button, Chip, Alert } from '@mui/material';
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
import { NOISE_THRESHOLDS } from '../../../hooks/useNoiseMonitoring';
import type { ConnectedDevice } from '../types';

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
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
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
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={subTab}
            onChange={(_, v) => setSubTab(v)}
            sx={{ minHeight: 36, '& .MuiTab-root': { minHeight: 36, textTransform: 'none', fontSize: '0.8125rem', fontWeight: 600, py: 0.5 } }}
          >
            <Tab icon={<Settings size={16} strokeWidth={1.75} />} iconPosition="start" label="Configuration" />
            <Tab icon={<History size={16} strokeWidth={1.75} />} iconPosition="start" label="Historique" />
          </Tabs>

          {subTab === 0 && propertyId != null && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: 0.5 }}>
              {configStatus.hasError && (
                <Alert severity="error" sx={{ py: 0, px: 1, fontSize: '0.6875rem' }}>Erreur</Alert>
              )}
              {configStatus.isSaved && (
                <Chip
                  label="Sauvegardé"
                  size="small"
                  sx={{ fontSize: '0.6875rem', height: 22, fontWeight: 600, bgcolor: 'var(--ok-soft)', color: 'var(--ok)', borderRadius: 'var(--radius-pill)' }}
                />
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
            </Box>
          )}
        </Box>

        <Box sx={{ pt: 2 }}>
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
        </Box>
      </Box>
    </Box>
  );
}
