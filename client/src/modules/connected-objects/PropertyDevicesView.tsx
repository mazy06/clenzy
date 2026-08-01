import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Skeleton } from '@mui/material';
import { Button } from '../../components/ui';
import { Inventory2, Add, MonitorHeart, WifiOff, BatteryAlert, GridView, ChevronLeft } from '../../icons';
import PageHeader from '../../components/PageHeader';
import StatTile from '../../components/StatTile';
import EmptyState from '../../components/EmptyState';
import { useConnectedObjects } from './useConnectedObjects';
import DeviceCard from './components/DeviceCard';
import AddDeviceWizard from './components/AddDeviceWizard';
import type { DeviceAction } from './types';

const GRID = 'grid grid-cols-[repeat(auto-fill,_minmax(248px,_1fr))] gap-1.5';

export default function PropertyDevicesView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const propertyId = Number(id);
  const { devices, loading, act, actingUid, refetch } = useConnectedObjects();
  const [wizardOpen, setWizardOpen] = useState(false);

  const propertyDevices = useMemo(() => devices.filter((d) => d.propertyId === propertyId), [devices, propertyId]);
  const propertyName = propertyDevices[0]?.propertyName ?? 'Logement';

  // Groupement par pièce (axe secondaire au sein d'un logement).
  const rooms = useMemo(() => {
    const map = new Map<string, typeof propertyDevices>();
    for (const d of propertyDevices) {
      const key = d.roomName || '__none__';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(d);
    }
    return [...map.entries()].sort((a, b) => (a[0] === '__none__' ? 1 : b[0] === '__none__' ? -1 : a[0].localeCompare(b[0])));
  }, [propertyDevices]);

  const kpis = useMemo(() => ({
    total: propertyDevices.length,
    online: propertyDevices.filter((d) => d.online).length,
    offline: propertyDevices.filter((d) => !d.online).length,
    lowBattery: propertyDevices.filter((d) => d.battery != null && d.battery <= 20).length,
  }), [propertyDevices]);

  const handleAction = (uid: string, action: DeviceAction) => {
    if (action === 'lock' || action === 'unlock') { void act(uid, action); return; }
    const dev = devices.find((d) => d.uid === uid);
    if (dev) navigate(`/connected-objects/device/${dev.kind}/${dev.id}`);
  };

  return (
    <div>
      <PageHeader
        title={propertyName}
        subtitle="Objets connectés de ce logement"
        iconBadge={<Inventory2 />}
        backPath="/connected-objects"
        backLabel="Objets connectés"
        actions={
          <Button size="sm" onClick={() => setWizardOpen(true)}>
            <Add size={16} strokeWidth={2} />
            Ajouter un objet
          </Button>
        }
      />

      <div className="grid grid-cols-[repeat(auto-fit,_minmax(140px,_1fr))] gap-1.5 mb-[9px]">
        <StatTile icon={<Inventory2 />} label="Objets" value={kpis.total} color="#6B8A9A" loading={loading} />
        <StatTile icon={<MonitorHeart />} label="En ligne" value={kpis.online} color="#4A9B8E" loading={loading} />
        <StatTile icon={<WifiOff />} label="Hors ligne" value={kpis.offline} color="#9CA3AF" loading={loading} />
        <StatTile icon={<BatteryAlert />} label="Batterie faible" value={kpis.lowBattery} color="#D4A574" loading={loading} />
      </div>

      {loading ? (
        <div className={GRID}>
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} variant="rounded" height={132} sx={{ borderRadius: 'var(--radius-lg)' }} />)}
        </div>
      ) : propertyDevices.length === 0 ? (
        <EmptyState
          icon={<Inventory2 />}
          title="Aucun objet dans ce logement"
          description="Ajoutez une serrure, un capteur sonore ou un point de remise des clés pour ce logement."
          action={<Button variant="outline" onClick={() => setWizardOpen(true)}><Add size={16} strokeWidth={2} />Ajouter un objet</Button>}
        />
      ) : (
        rooms.map(([room, list]) => (
          <div className="mb-3" key={room}>
            <div className="flex items-center gap-1 mb-1.5">
              <span className="text-muted-foreground inline-flex">
                <GridView size={15} strokeWidth={1.75} />
              </span>
              <p className="cn-text-body1 font-semibold text-[0.9375rem] text-foreground">
                {room === '__none__' ? 'Sans pièce attribuée' : room}
              </p>
              <span className="cn-text-caption text-muted-foreground opacity-60">· {list.length}</span>
            </div>
            <div className={GRID}>
              {list.map((d) => <DeviceCard key={d.uid} device={d} onAction={handleAction} acting={actingUid === d.uid} />)}
            </div>
          </div>
        ))
      )}

      <AddDeviceWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onAdded={() => { void refetch(); }}
        defaultPropertyId={propertyId}
      />
      {/* Lien retour secondaire pour les écrans étroits */}
      <Button variant="ghost" size="sm" onClick={() => navigate('/connected-objects')} className="mt-1.5 text-[var(--muted)]">
        <ChevronLeft size={16} strokeWidth={1.75} />
        Tous les objets
      </Button>
    </div>
  );
}
