import { useState, useRef } from 'react';
import { Box, Tabs, Tab, Button, Chip, Alert } from '@mui/material';
import { Settings, History, Save, VolumeUp } from '../../../icons';
import NoiseMonitorChart from '../../dashboard/NoiseMonitorChart';
import NoiseAlertConfigPanel, {
  type ActiveThresholds,
  type NoiseAlertConfigHandle,
} from '../../dashboard/NoiseAlertConfigPanel';
import NoiseAlertHistory from '../../dashboard/NoiseAlertHistory';
import EmptyState from '../../../components/EmptyState';
import { useNoiseDeviceDetail } from '../useNoiseDeviceDetail';
import type { ConnectedDevice } from '../types';

/**
 * Corps « bruit » du détail unifié : monitoring (courbe live scopée au capteur) +
 * sous-onglets Configuration (seuils du logement) / Historique (alertes du logement).
 * Réutilise les composants riches existants ; jette le chrome (offers/stepper/liste).
 */
export default function NoiseDetail({ device }: { device: ConnectedDevice }) {
  const { data, combinedChartData, loading } = useNoiseDeviceDetail(device);
  const [activeThresholds, setActiveThresholds] = useState<ActiveThresholds | null>(null);
  const [subTab, setSubTab] = useState(0);
  const configRef = useRef<NoiseAlertConfigHandle>(null);
  const [, forceRefresh] = useState(0);
  const propertyId = device.propertyId;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Monitoring */}
      <Box sx={{ minHeight: 380, display: 'flex' }}>
        <NoiseMonitorChart
          data={data}
          combinedChartData={combinedChartData}
          activeThresholds={activeThresholds}
          loading={loading}
        />
      </Box>

      {/* Configuration | Historique */}
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
              {configRef.current?.hasError && (
                <Alert severity="error" sx={{ py: 0, px: 1, fontSize: '0.6875rem' }}>Erreur</Alert>
              )}
              {configRef.current?.isSaved && (
                <Chip label="Sauvegardé" size="small" color="success" variant="outlined" sx={{ fontSize: '0.6875rem', height: 22 }} />
              )}
              <Button
                variant="contained"
                size="small"
                startIcon={<Save size={14} strokeWidth={1.75} />}
                onClick={() => { configRef.current?.save(); forceRefresh((v) => v + 1); }}
                disabled={!configRef.current?.canSave || configRef.current?.isSaving}
                sx={{ textTransform: 'none', fontSize: '0.75rem', fontWeight: 600 }}
              >
                {configRef.current?.isSaving ? 'Sauvegarde...' : 'Sauvegarder'}
              </Button>
            </Box>
          )}
        </Box>

        <Box sx={{ pt: 2 }}>
          {subTab === 0 && (
            propertyId != null ? (
              <NoiseAlertConfigPanel ref={configRef} propertyIds={[propertyId]} onThresholdsChange={setActiveThresholds} />
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
