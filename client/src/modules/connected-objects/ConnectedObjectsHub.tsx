import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
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

const PROVIDER_LABELS: Record<string, string> = {
  MINUT: 'Minut', TUYA: 'Tuya', NUKI: 'Nuki', KEYNEST: 'KeyNest', CLENZY_KEYVAULT: 'KeyVault',
};

// Types « à venir » disposant d'un écran d'aperçu (Phase 2, UI-first).
const PREVIEW_ROUTES: Partial<Record<DeviceKind, string>> = {
  camera: '/connected-objects/cameras',
  thermostat: '/connected-objects/thermostats',
};

interface ConnectedObjectsHubProps {
  /**
   * Mode « embedded » : le hub est rendu comme onglet de {@link PropertiesPage}
   * (4e tab, conceptuellement lie aux biens). Dans ce mode il ne rend PAS son
   * propre {@code PageHeader} ; le bouton « Ajouter un objet » est porte dans le
   * slot actions du parent via React Portal.
   */
  embedded?: boolean;
  actionsContainer?: HTMLElement | null;
}

export default function ConnectedObjectsHub({
  embedded = false,
  actionsContainer,
}: ConnectedObjectsHubProps = {}) {
  const navigate = useNavigate();
  const theme = useTheme();
  const { groups, devices, kpis, providers, loading, act, actingUid, refetch } = useConnectedObjects();
  const [kindFilter, setKindFilter] = useState<DeviceKind | ''>('');
  const [wizardOpen, setWizardOpen] = useState(false);

  // Services reliés : statut réel des providers (backend), repli présence sinon.
  // On masque le bruit (provider ni connecté ni porteur d'objets).
  const visibleProviders = providers.filter((p) => p.connected || p.deviceCount > 0);
  // Au moins un service relié → l'invite passe de « connecter un service » à « ajouter un objet ».
  const hasConnectedService = providers.some((p) => p.connected);

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

  const handleAction = (uid: string, action: DeviceAction) => {
    if (action === 'lock' || action === 'unlock') {
      void act(uid, action);
      return;
    }
    // « Gérer » / clic sur la carte → détail unifié de l'objet.
    const dev = devices.find((d) => d.uid === uid);
    if (dev) navigate(`/connected-objects/device/${dev.kind}/${dev.id}`);
  };

  // Action « Ajouter un objet » : rendue dans le PageHeader propre (standalone)
  // ou portee dans le slot actions du parent (embedded, cf. PropertiesPage).
  const headerAction = (
    <Button variant="contained" size="small" startIcon={<Add size={16} strokeWidth={2} />} onClick={() => setWizardOpen(true)}>
      Ajouter un objet
    </Button>
  );

  return (
    <Box>
      {!embedded && (
        <PageHeader
          title="Objets connectés"
          subtitle="Supervisez et pilotez vos serrures, capteurs et clés, logement par logement."
          iconBadge={<Inventory2 />}
          backPath="/dashboard"
          backLabel="Tableau de bord"
          actions={headerAction}
        />
      )}
      {embedded && actionsContainer ? createPortal(headerAction, actionsContainer) : null}

      {/* Bandeau de connexion — pont vers les Settings */}
      <Paper variant="outlined" sx={{ p: 1, mb: 1.5, borderRadius: 1.5, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', mr: 0.5 }}>
          Services reliés
        </Typography>
        {visibleProviders.length === 0 && !loading ? (
          <Typography variant="caption" sx={{ color: 'text.disabled' }}>Aucun service relié pour l'instant.</Typography>
        ) : (
          visibleProviders.map((p) => {
            const c = p.connected ? theme.palette.success.main : theme.palette.warning.main;
            return (
              <Tooltip key={p.provider} title={p.connected ? 'Connecté' : 'Déconnecté — à reconnecter dans les intégrations'} arrow>
                <Chip
                  size="small"
                  label={`${PROVIDER_LABELS[p.provider] ?? p.provider} · ${p.deviceCount}`}
                  sx={{ height: 24, bgcolor: alpha(c, 0.1), color: c, fontWeight: 600, border: '1px solid', borderColor: alpha(c, 0.25) }}
                />
              </Tooltip>
            );
          })
        )}
        <Button variant="text" size="small" endIcon={<ChevronRight size={14} strokeWidth={1.75} />} onClick={() => navigate('/settings?tab=integrations')} sx={{ ml: 'auto', color: 'text.secondary' }}>
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
          description={hasConnectedService
            ? "Vos services sont reliés — ajoutez vos serrures, caméras, capteurs et points de remise : ils apparaîtront ici, regroupés par logement."
            : "Reliez un service (Nuki, Minut, Tuya, KeyNest…) puis ajoutez vos serrures, capteurs et points de remise — ils apparaîtront ici, regroupés par logement."}
          action={hasConnectedService
            ? <Button variant="contained" startIcon={<Add size={16} strokeWidth={2} />} onClick={() => setWizardOpen(true)}>Ajouter un objet</Button>
            : <Button variant="outlined" startIcon={<Add size={16} strokeWidth={2} />} onClick={() => navigate('/settings?tab=integrations')}>Connecter un service</Button>}
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
              const previewRoute = PREVIEW_ROUTES[k];
              return (
                <Tooltip key={k} title={previewRoute ? `Aperçu — ${meta.label} (Phase 2)` : 'À venir'} arrow>
                  <Paper
                    variant="outlined"
                    onClick={previewRoute ? () => navigate(previewRoute) : undefined}
                    sx={{
                      px: 1.25, py: 0.875, borderRadius: 1.5, borderStyle: 'dashed',
                      display: 'inline-flex', alignItems: 'center', gap: 0.875,
                      opacity: previewRoute ? 1 : 0.7,
                      cursor: previewRoute ? 'pointer' : 'default',
                      transition: 'border-color 200ms, background-color 200ms',
                      ...(previewRoute && { '&:hover': { borderColor: meta.color, bgcolor: alpha(meta.color, 0.05) } }),
                    }}
                  >
                    <Box component="span" sx={{ color: meta.color, display: 'inline-flex' }}>{meta.icon(16)}</Box>
                    <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>{meta.label}</Typography>
                    {previewRoute ? (
                      <>
                        <Chip size="small" label="Aperçu" sx={{ height: 18, fontSize: '0.65rem', bgcolor: alpha(meta.color, 0.15), color: meta.color, fontWeight: 700 }} />
                        <Box component="span" sx={{ color: 'text.disabled', display: 'inline-flex' }}><ChevronRight size={14} strokeWidth={1.75} /></Box>
                      </>
                    ) : (
                      <Chip size="small" label="Bientôt" sx={{ height: 18, fontSize: '0.65rem' }} />
                    )}
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
