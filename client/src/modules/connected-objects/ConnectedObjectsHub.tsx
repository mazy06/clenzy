import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Button, Skeleton, Paper, Chip, Tooltip, alpha, useTheme } from '@mui/material';
import { Inventory2, Add, MonitorHeart, WifiOff, BatteryAlert, Warning, Home, ChevronRight } from '../../icons';
import PageHeader from '../../components/PageHeader';
import StatTile from '../../components/StatTile';
import EmptyState from '../../components/EmptyState';
import FilterChipRow from '../../components/FilterChipRow';
import { useConnectedObjects } from './useConnectedObjects';
import { DEVICE_KINDS, DEVICE_KIND_ORDER } from './deviceRegistry';
import DeviceCard from './components/DeviceCard';
import AddDeviceWizard from './components/AddDeviceWizard';
import type { DeviceAction, DeviceKind } from './types';

const GRID = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(248px, 1fr))', gap: 1 } as const;

export default function ConnectedObjectsHub() {
  const navigate = useNavigate();
  const theme = useTheme();
  const { groups, devices, kpis, loading, act, actingUid, refetch } = useConnectedObjects();
  const [kindFilter, setKindFilter] = useState<DeviceKind | ''>('');
  const [wizardOpen, setWizardOpen] = useState(false);

  // Providers réellement présents (pont visuel vers les Settings).
  const providers = useMemo(() => {
    const map = new Map<string, number>();
    devices.forEach((d) => map.set(d.provider, (map.get(d.provider) ?? 0) + 1));
    return [...map.entries()].filter(([p]) => p !== 'UNKNOWN');
  }, [devices]);

  // Types présents → options du filtre.
  const kindsPresent = useMemo(() => {
    const set = new Set(devices.map((d) => d.kind));
    return DEVICE_KIND_ORDER.filter((k) => set.has(k));
  }, [devices]);

  const filteredGroups = useMemo(() => {
    if (!kindFilter) return groups;
    return groups
      .map((g) => ({ ...g, devices: g.devices.filter((d) => d.kind === kindFilter) }))
      .filter((g) => g.devices.length > 0);
  }, [groups, kindFilter]);

  const comingSoon = DEVICE_KIND_ORDER.filter((k) => !DEVICE_KINDS[k].available);

  // Routes de gestion avancée par type de service (vues riches issues des anciens
  // onglets dashboard, désormais sous le Hub).
  const MANAGE_ROUTE_BY_KIND: Partial<Record<DeviceKind, string>> = {
    noise: '/connected-objects/noise',
    lock: '/connected-objects/locks',
    keybox: '/connected-objects/keys',
  };

  const handleAction = (uid: string, action: DeviceAction) => {
    if (action === 'lock' || action === 'unlock') {
      void act(uid, action);
      return;
    }
    // « Gérer » → écran de gestion avancée du service correspondant.
    const kind = devices.find((d) => d.uid === uid)?.kind;
    navigate((kind && MANAGE_ROUTE_BY_KIND[kind]) || '/connected-objects');
  };

  return (
    <Box>
      <PageHeader
        title="Objets connectés"
        subtitle="Supervisez et pilotez vos serrures, capteurs et clés, logement par logement."
        iconBadge={<Inventory2 />}
        backPath="/dashboard"
        backLabel="Tableau de bord"
        actions={
          <Button variant="contained" size="small" startIcon={<Add size={16} strokeWidth={2} />} onClick={() => setWizardOpen(true)}>
            Ajouter un objet
          </Button>
        }
      />

      {/* Bandeau de connexion — pont vers les Settings */}
      <Paper variant="outlined" sx={{ p: 1, mb: 1.5, borderRadius: 1.5, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', mr: 0.5 }}>
          Services reliés
        </Typography>
        {providers.length === 0 && !loading ? (
          <Typography variant="caption" sx={{ color: 'text.disabled' }}>Aucun service relié pour l'instant.</Typography>
        ) : (
          providers.map(([provider, count]) => (
            <Chip
              key={provider}
              size="small"
              label={`${provider.charAt(0) + provider.slice(1).toLowerCase()} · ${count}`}
              sx={{ height: 24, bgcolor: alpha(theme.palette.success.main, 0.1), color: 'success.dark', fontWeight: 600, border: '1px solid', borderColor: alpha(theme.palette.success.main, 0.25) }}
            />
          ))
        )}
        <Button variant="text" size="small" endIcon={<ChevronRight size={14} strokeWidth={1.75} />} onClick={() => navigate('/settings')} sx={{ ml: 'auto', color: 'text.secondary' }}>
          Gérer les intégrations
        </Button>
      </Paper>

      {/* KPIs */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 1, mb: 1.5 }}>
        <StatTile icon={<Inventory2 />} label="Objets" value={kpis.total} color="#6B8A9A" loading={loading} />
        <StatTile icon={<MonitorHeart />} label="En ligne" value={kpis.online} color="#4A9B8E" loading={loading} hint={kpis.total ? `${Math.round((kpis.online / kpis.total) * 100)}%` : undefined} />
        <StatTile icon={<WifiOff />} label="Hors ligne" value={kpis.offline} color="#9CA3AF" loading={loading} />
        <StatTile icon={<Warning />} label="Alertes" value={kpis.alerts} color="#C97A7A" loading={loading} />
        <StatTile icon={<BatteryAlert />} label="Batterie faible" value={kpis.lowBattery} color="#D4A574" loading={loading} />
      </Box>

      {/* Filtre par type */}
      {kindsPresent.length > 1 && (
        <Box sx={{ mb: 1.5 }}>
          <FilterChipRow<DeviceKind>
            value={kindFilter}
            onChange={setKindFilter}
            allLabel="Tous les objets"
            allColor="#6B8A9A"
            allCount={devices.length}
            options={kindsPresent.map((k) => ({
              value: k,
              label: DEVICE_KINDS[k].label,
              color: DEVICE_KINDS[k].color,
              count: devices.filter((d) => d.kind === k).length,
            }))}
          />
        </Box>
      )}

      {/* Contenu : grille groupée par logement */}
      {loading ? (
        <Box sx={GRID}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" height={132} sx={{ borderRadius: 1.5 }} />
          ))}
        </Box>
      ) : filteredGroups.length === 0 ? (
        <EmptyState
          icon={<Inventory2 />}
          title="Aucun objet connecté pour l'instant"
          description="Reliez un service (Nuki, Minut, Tuya, KeyNest…) puis ajoutez vos serrures, capteurs et points de remise — ils apparaîtront ici, regroupés par logement."
          action={<Button variant="outlined" startIcon={<Add size={16} strokeWidth={2} />} onClick={() => navigate('/settings')}>Connecter un service</Button>}
          tip="Un seul écran pour tout superviser : verrouillage à distance, niveau sonore, batteries et codes de clés."
        />
      ) : (
        filteredGroups.map((group) => (
          <Box key={group.propertyId ?? 'none'} sx={{ mb: 2 }}>
            <Box
              onClick={group.propertyId != null ? () => navigate(`/connected-objects/property/${group.propertyId}`) : undefined}
              sx={{
                display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.875,
                cursor: group.propertyId != null ? 'pointer' : 'default',
                width: 'fit-content',
                '&:hover .co-prop-name': { color: group.propertyId != null ? 'primary.main' : 'text.primary' },
              }}
            >
              <Box component="span" sx={{ color: 'text.secondary', display: 'inline-flex' }}>
                <Home size={15} strokeWidth={1.75} />
              </Box>
              <Typography className="co-prop-name" sx={{ fontWeight: 600, fontSize: '0.9375rem', color: 'text.primary', transition: 'color 150ms' }}>{group.propertyName}</Typography>
              <Typography variant="caption" sx={{ color: 'text.disabled' }}>· {group.devices.length} objet{group.devices.length > 1 ? 's' : ''}</Typography>
              {group.propertyId != null && (
                <Box component="span" sx={{ color: 'text.disabled', display: 'inline-flex', ml: 0.25 }}>
                  <ChevronRight size={15} strokeWidth={1.75} />
                </Box>
              )}
            </Box>
            <Box sx={GRID}>
              {group.devices.map((d) => (
                <DeviceCard key={d.uid} device={d} onAction={handleAction} acting={actingUid === d.uid} />
              ))}
            </Box>
          </Box>
        ))
      )}

      {/* Types à venir (caméras, thermostats) — place réservée */}
      {comingSoon.length > 0 && (
        <Box sx={{ mt: 1 }}>
          <Typography variant="caption" sx={{ color: 'text.disabled', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', mb: 0.75 }}>
            Bientôt disponible
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {comingSoon.map((k) => {
              const meta = DEVICE_KINDS[k];
              return (
                <Tooltip key={k} title={k === 'camera' ? 'Streaming vidéo en direct — Phase 2' : 'À venir'} arrow>
                  <Paper variant="outlined" sx={{ px: 1.25, py: 0.875, borderRadius: 1.5, borderStyle: 'dashed', display: 'inline-flex', alignItems: 'center', gap: 0.875, opacity: 0.7 }}>
                    <Box component="span" sx={{ color: meta.color, display: 'inline-flex' }}>{meta.icon(16)}</Box>
                    <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>{meta.label}</Typography>
                    <Chip size="small" label="Bientôt" sx={{ height: 18, fontSize: '0.65rem' }} />
                  </Paper>
                </Tooltip>
              );
            })}
          </Box>
        </Box>
      )}

      <AddDeviceWizard open={wizardOpen} onClose={() => setWizardOpen(false)} onAdded={() => { void refetch(); }} />
    </Box>
  );
}
