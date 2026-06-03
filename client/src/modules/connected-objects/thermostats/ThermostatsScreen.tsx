import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Box, Typography, Button, Skeleton } from '@mui/material';
import { Thermostat, Add, Home } from '../../../icons';
import PageHeader from '../../../components/PageHeader';
import EmptyState from '../../../components/EmptyState';
import { useTranslation } from '../../../hooks/useTranslation';
import { thermostatsApi, type ThermostatDto } from '../../../services/api/thermostatsApi';
import AddDeviceWizard from '../components/AddDeviceWizard';
import ThermostatTile from './ThermostatTile';

const GRID = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 1.25 } as const;

/**
 * Écran de gestion des thermostats — branché sur le backend Tuya (CRUD + pilotage
 * de consigne). Groupé par logement.
 */
export default function ThermostatsScreen() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [actingId, setActingId] = useState<number | null>(null);

  const { data: thermostats = [], isLoading } = useQuery({
    queryKey: ['thermostats'],
    queryFn: () => thermostatsApi.getAll(),
    refetchInterval: 60_000,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['thermostats'] });

  const handleDelete = async (id: number) => {
    if (!window.confirm('Supprimer ce thermostat ?')) return;
    setActingId(id);
    try { await thermostatsApi.delete(id); await invalidate(); } finally { setActingId(null); }
  };

  const handleSetTarget = async (id: number, targetTempC: number) => {
    setActingId(id);
    try { await thermostatsApi.setTarget(id, targetTempC); await invalidate(); } finally { setActingId(null); }
  };

  const groups = useMemo(() => {
    const map = new Map<string, ThermostatDto[]>();
    for (const th of thermostats) {
      const key = th.propertyName || 'Sans logement';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(th);
    }
    return [...map.entries()];
  }, [thermostats]);

  const addButton = (
    <Button variant="contained" size="small" startIcon={<Add size={16} strokeWidth={2} />} onClick={() => setWizardOpen(true)}>
      Ajouter un thermostat
    </Button>
  );

  return (
    <Box>
      <PageHeader
        title={t('connectedObjects.thermostats.title', 'Thermostats')}
        subtitle={t('connectedObjects.thermostats.subtitle', 'Confort thermique des logements — pilotage Tuya.')}
        iconBadge={<Thermostat />}
        backPath="/connected-objects"
        backLabel={t('navigation.connectedObjects', 'Objets connectés')}
        actions={addButton}
      />

      {isLoading ? (
        <Box sx={GRID}>
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} variant="rounded" height={170} sx={{ borderRadius: 1.5 }} />)}
        </Box>
      ) : thermostats.length === 0 ? (
        <EmptyState
          icon={<Thermostat />}
          title="Aucun thermostat pour l'instant"
          description="Ajoutez un thermostat Tuya pour piloter le confort thermique de vos logements (température, consigne, mode)."
          action={addButton}
          tip="Le compte Tuya doit être relié dans Réglages → Services connectés."
        />
      ) : (
        groups.map(([propertyName, items]) => (
          <Box key={propertyName} sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.875 }}>
              <Box component="span" sx={{ color: 'text.secondary', display: 'inline-flex' }}><Home size={15} strokeWidth={1.75} /></Box>
              <Typography sx={{ fontWeight: 600, fontSize: '0.9375rem', color: 'text.primary' }}>{propertyName}</Typography>
              <Typography variant="caption" sx={{ color: 'text.disabled' }}>· {items.length} thermostat{items.length > 1 ? 's' : ''}</Typography>
            </Box>
            <Box sx={GRID}>
              {items.map((th) => (
                <ThermostatTile key={th.id} thermostat={th} onSetTarget={handleSetTarget} onDelete={handleDelete} acting={actingId === th.id} />
              ))}
            </Box>
          </Box>
        ))
      )}

      <AddDeviceWizard open={wizardOpen} onClose={() => setWizardOpen(false)} onAdded={invalidate} defaultKind="thermostat" />
    </Box>
  );
}
