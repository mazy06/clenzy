import { useCallback, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Skeleton } from '../../../components/ui';
import { Thermostat, Add, Home } from '../../../icons';
import PageHeader from '../../../components/PageHeader';
import EmptyState from '../../../components/EmptyState';
import { useTranslation } from '../../../hooks/useTranslation';
import { thermostatsApi, type ThermostatDto } from '../../../services/api/thermostatsApi';
import AddDeviceWizard from '../components/AddDeviceWizard';
import ThermostatTile from './ThermostatTile';
import ConfirmationModal from '../../../components/ConfirmationModal';

const GRID_CLS = 'grid grid-cols-[repeat(auto-fill,_minmax(240px,_1fr))] gap-[7.5px]';

/**
 * Écran de gestion des thermostats — branché sur le backend Tuya (CRUD + pilotage
 * de consigne). Groupé par logement.
 */
export default function ThermostatsScreen() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [actingId, setActingId] = useState<number | null>(null);
  // Suppression : thermostat en attente de confirmation (modal réutilisable) + état en cours.
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data: thermostats = [], isLoading } = useQuery({
    queryKey: ['thermostats'],
    queryFn: () => thermostatsApi.getAll(),
    refetchInterval: 60_000,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['thermostats'] });

  const requestDelete = useCallback((id: number) => setPendingDeleteId(id), []);

  const pendingThermostat = useMemo(
    () => thermostats.find((th) => th.id === pendingDeleteId) ?? null,
    [thermostats, pendingDeleteId],
  );

  const confirmDelete = useCallback(async () => {
    if (pendingDeleteId == null) return;
    setDeleting(true);
    try {
      await thermostatsApi.delete(pendingDeleteId);
      await qc.invalidateQueries({ queryKey: ['thermostats'] });
      setPendingDeleteId(null);
    } finally {
      setDeleting(false);
    }
  }, [pendingDeleteId, qc]);

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
    <Button size="sm" onClick={() => setWizardOpen(true)}>
      <Add size={16} strokeWidth={2} />
      Ajouter un thermostat
    </Button>
  );

  return (
    <div>
      <PageHeader
        title={t('connectedObjects.thermostats.title', 'Thermostats')}
        subtitle={t('connectedObjects.thermostats.subtitle', 'Confort thermique des logements — pilotage Tuya.')}
        iconBadge={<Thermostat />}
        backPath="/connected-objects"
        backLabel={t('navigation.connectedObjects', 'Objets connectés')}
        actions={addButton}
      />

      {isLoading ? (
        <div className={GRID_CLS}>
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[170px] rounded-xl" />)}
        </div>
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
          <div className="mb-3" key={propertyName}>
            <div className="flex items-center gap-1 mb-1.5">
              <span className="text-muted-foreground inline-flex"><Home size={15} strokeWidth={1.75} /></span>
              <p className="text-sm font-semibold tracking-tight text-foreground">{propertyName}</p>
              <span className="text-xs text-muted-foreground opacity-60 tabular-nums">· {items.length} thermostat{items.length > 1 ? 's' : ''}</span>
            </div>
            <div className={GRID_CLS}>
              {items.map((th) => (
                <ThermostatTile key={th.id} thermostat={th} onSetTarget={handleSetTarget} onDelete={requestDelete} acting={actingId === th.id || (deleting && pendingDeleteId === th.id)} />
              ))}
            </div>
          </div>
        ))
      )}

      <AddDeviceWizard open={wizardOpen} onClose={() => setWizardOpen(false)} onAdded={invalidate} defaultKind="thermostat" />

      <ConfirmationModal
        open={pendingDeleteId != null}
        onClose={() => setPendingDeleteId(null)}
        onConfirm={confirmDelete}
        title="Supprimer le thermostat"
        message={pendingThermostat
          ? `Supprimer définitivement le thermostat « ${pendingThermostat.name} » ? Cette action est irréversible.`
          : 'Supprimer définitivement ce thermostat ? Cette action est irréversible.'}
        confirmText="Supprimer"
        severity="error"
        loading={deleting}
      />
    </div>
  );
}
