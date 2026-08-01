import { useMemo, useState } from 'react';
import { cn } from '../../utils/cn';
import StatusChip from '../../components/StatusChip';
import { Badge } from '../../components/ui';
import { Alert as BuiAlert, AlertDescription, AlertAction, Button as BuiButton } from '../../components/ui';
import { Info, X } from 'lucide-react';
import { Card } from '../../components/ui';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Box, Skeleton, Paper, Tooltip, alpha, Snackbar } from '@mui/material';
import { Inventory2, Add, MonitorHeart, WifiOff, BatteryAlert, Warning, Home, ChevronRight } from '../../icons';
import PageHeader from '../../components/PageHeader';
import StatTile from '../../components/StatTile';
import EmptyState from '../../components/EmptyState';
import FilterChipRow from '../../components/FilterChipRow';
import { useConnectedObjects } from './useConnectedObjects';
import { DEVICE_KINDS, DEVICE_KIND_ORDER } from './deviceRegistry';
import DeviceCard from './components/DeviceCard';
import AddDeviceWizard from './components/AddDeviceWizard';
import { netatmoApi } from '../../services/api/netatmoApi';
import type { DeviceAction, DeviceKind } from './types';

const GRID = 'grid grid-cols-[repeat(auto-fill,_minmax(248px,_1fr))] gap-1.5';

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
  const { groups, devices, kpis, providers, loading, act, actingUid, refetch } = useConnectedObjects();
  const [kindFilter, setKindFilter] = useState<DeviceKind | ''>('');
  const [wizardOpen, setWizardOpen] = useState(false);

  // Services reliés : statut réel des providers (backend), repli présence sinon.
  // On masque le bruit (provider ni connecté ni porteur d'objets).
  const visibleProviders = providers.filter((p) => p.connected || p.deviceCount > 0);
  // Au moins un service relié → l'invite passe de « connecter un service » à « ajouter un objet ».
  const hasConnectedService = providers.some((p) => p.connected);

  // Netatmo = modèle par-hôte : chaque hôte connecte SON compte depuis le hub (l'onglet
  // Intégrations est réservé aux SUPER_ADMIN/MANAGER). La config de l'app reste admin.
  const netatmoConnected = providers.some((p) => p.provider === 'NETATMO' && p.connected);
  const [connectMsg, setConnectMsg] = useState<string | null>(null);
  const connectNetatmo = async () => {
    try {
      const res = await netatmoApi.connect();
      if (res.authorization_url) { window.location.href = res.authorization_url; return; }
      if (res.status === 'already_connected') { void refetch(); }
    } catch {
      setConnectMsg("Netatmo n'est pas encore activé par l'administrateur (clé API à configurer dans les Intégrations).");
    }
  };

  // Types présents → options du filtre.
  const kindsPresent = useMemo(() => {
    const set = new Set(devices.map((d) => d.kind));
    return DEVICE_KIND_ORDER.filter((k) => set.has(k));
  }, [devices]);

  const filteredGroups = useMemo(() => {
    if (!kindFilter) return groups;
    return groups.flatMap((g) => {
      const devices = g.devices.filter((d) => d.kind === kindFilter);
      return devices.length > 0 ? [{ ...g, devices }] : [];
    });
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
    <BuiButton size="sm" onClick={() => setWizardOpen(true)}>
      <Add size={16} strokeWidth={2} />
      Ajouter un objet
    </BuiButton>
  );

  return (
    <div>
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
      <Card className="gap-0 py-0 p-1.5 mb-2 border-[var(--line)] flex items-center gap-1.5 flex-wrap">
        <span className="cn-text-caption text-[var(--faint)] font-bold text-[10.5px] uppercase tracking-[0.06em] me-0.5">
          Services reliés
        </span>
        {visibleProviders.length === 0 && !loading ? (
          <span className="cn-text-caption text-muted-foreground opacity-60">Aucun service relié pour l'instant.</span>
        ) : (
          visibleProviders.map((p) => {
            // Statut -soft : connecté = --ok, à reconnecter = --warn (tokens thémables)
            const tokens = p.connected
              ? { color: 'var(--ok)', soft: 'var(--ok-soft)' }
              : { color: 'var(--warn)', soft: 'var(--warn-soft)' };
            return (
              <Tooltip key={p.provider} title={p.connected ? 'Connecté' : 'Déconnecté — à reconnecter dans les intégrations'} arrow>
                {/* Tooltip pose une ref sur son enfant, que StatusChip ne transmet pas
                    (React 18, composant fonction) : sans ce span, l'infobulle ne s'ancre pas. */}
                <span className="inline-flex">
                  <StatusChip tokens={{ color: tokens.color, bg: tokens.soft }} label={`${PROVIDER_LABELS[p.provider] ?? p.provider} · ${p.deviceCount}`} className="h-[24px] tabular-nums" />
                </span>
              </Tooltip>
            );
          })
        )}
        {/* Action du bandeau, pas de l'ecran : `outline` pour ne pas concurrencer
            « Ajouter un objet » qui reste l'action principale de la page. */}
        {!netatmoConnected && (
          <BuiButton variant="outline" size="sm" onClick={() => { void connectNetatmo(); }} className="ms-auto">
            Connecter Netatmo
          </BuiButton>
        )}
        <BuiButton
          variant="ghost"
          size="sm"
          onClick={() => navigate('/settings?tab=integrations')}
          className={cn('text-[var(--muted)]', netatmoConnected ? 'ms-auto' : 'ms-1.5')}
        >
          Gérer les intégrations
          <ChevronRight size={14} strokeWidth={1.75} />
        </BuiButton>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-[repeat(auto-fit,_minmax(140px,_1fr))] gap-1.5 mb-[9px]">
        <StatTile icon={<Inventory2 />} label="Objets" value={kpis.total} color="#6B8A9A" loading={loading} />
        <StatTile icon={<MonitorHeart />} label="En ligne" value={kpis.online} color="#4A9B8E" loading={loading} hint={kpis.total ? `${Math.round((kpis.online / kpis.total) * 100)}%` : undefined} />
        <StatTile icon={<WifiOff />} label="Hors ligne" value={kpis.offline} color="#9CA3AF" loading={loading} />
        <StatTile icon={<Warning />} label="Alertes" value={kpis.alerts} color="#C97A7A" loading={loading} />
        <StatTile icon={<BatteryAlert />} label="Batterie faible" value={kpis.lowBattery} color="#D4A574" loading={loading} />
      </div>

      {/* Filtre par type */}
      {kindsPresent.length > 1 && (
        <div className="mb-2">
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
        </div>
      )}

      {/* Contenu : grille groupée par logement */}
      {loading ? (
        <div className={GRID}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" height={132} sx={{ borderRadius: 'var(--radius-lg)' }} />
          ))}
        </div>
      ) : filteredGroups.length === 0 ? (
        <EmptyState
          icon={<Inventory2 />}
          title="Aucun objet connecté pour l'instant"
          description={hasConnectedService
            ? "Vos services sont reliés — ajoutez vos serrures, caméras, capteurs et points de remise : ils apparaîtront ici, regroupés par logement."
            : "Reliez un service (Nuki, Minut, Tuya, KeyNest…) puis ajoutez vos serrures, capteurs et points de remise — ils apparaîtront ici, regroupés par logement."}
          action={hasConnectedService
            ? <BuiButton onClick={() => setWizardOpen(true)}><Add size={16} strokeWidth={2} />Ajouter un objet</BuiButton>
            : <BuiButton variant="outline" onClick={() => navigate('/settings?tab=integrations')}><Add size={16} strokeWidth={2} />Connecter un service</BuiButton>}
          tip="Un seul écran pour tout superviser : verrouillage à distance, niveau sonore, batteries et codes de clés."
        />
      ) : (
        filteredGroups.map((group) => (
          <div className="mb-3" key={group.propertyId ?? 'none'}>
            <Box
              onClick={group.propertyId != null ? () => navigate(`/connected-objects/property/${group.propertyId}`) : undefined}
              sx={{
                display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.875,
                cursor: group.propertyId != null ? 'pointer' : 'default',
                width: 'fit-content',
                '&:hover .co-prop-name': { color: group.propertyId != null ? 'var(--accent)' : 'text.primary' },
              }}
            >
              <span className="text-muted-foreground inline-flex">
                <Home size={15} strokeWidth={1.75} />
              </span>
              <p className="cn-text-body1 co-prop-name font-semibold text-[0.9375rem] text-[var(--ink)]" style={{ transition: 'color 150ms' }}>{group.propertyName}</p>
              <span className="cn-text-caption text-muted-foreground opacity-60">· {group.devices.length} objet{group.devices.length > 1 ? 's' : ''}</span>
              {group.propertyId != null && (
                <span className="text-muted-foreground opacity-60 inline-flex ms-0.5">
                  <ChevronRight size={15} strokeWidth={1.75} />
                </span>
              )}
            </Box>
            <div className={GRID}>
              {group.devices.map((d) => (
                <DeviceCard key={d.uid} device={d} onAction={handleAction} acting={actingUid === d.uid} />
              ))}
            </div>
          </div>
        ))
      )}

      {/* Types à venir (caméras, thermostats) — place réservée */}
      {comingSoon.length > 0 && (
        <div className="mt-1.5">
          <span className="cn-text-caption text-[var(--faint)] font-bold text-[10.5px] uppercase tracking-[0.06em] block mb-1">
            Bientôt disponible
          </span>
          <div className="flex gap-1.5 flex-wrap">
            {comingSoon.map((k) => {
              const meta = DEVICE_KINDS[k];
              const previewRoute = PREVIEW_ROUTES[k];
              return (
                <Tooltip key={k} title={previewRoute ? `Aperçu — ${meta.label} (Phase 2)` : 'À venir'} arrow>
                  <Paper
                    variant="outlined"
                    onClick={previewRoute ? () => navigate(previewRoute) : undefined}
                    sx={{
                      px: 1.25, py: 0.875, borderRadius: 'var(--radius-md)', borderStyle: 'dashed',
                      display: 'inline-flex', alignItems: 'center', gap: 0.875,
                      opacity: previewRoute ? 1 : 0.7,
                      cursor: previewRoute ? 'pointer' : 'default',
                      transition: 'border-color 200ms, background-color 200ms',
                      ...(previewRoute && { '&:hover': { borderColor: meta.color, bgcolor: alpha(meta.color, 0.05) } }),
                    }}
                  >
                    <span className="inline-flex" style={{ color: meta.color }}>{meta.icon(16)}</span>
                    <p className="cn-text-body2 text-muted-foreground font-medium">{meta.label}</p>
                    {previewRoute ? (
                      <>
                        <StatusChip size="sm" tokens={{ color: meta.color, bg: alpha(meta.color, 0.15) }} label="Aperçu" className="text-[0.65rem]" />
                        <span className="text-muted-foreground opacity-60 inline-flex"><ChevronRight size={14} strokeWidth={1.75} /></span>
                      </>
                    ) : (
                      <Badge variant="secondary" className="h-[18px] text-[0.65rem]">Bientôt</Badge>
                    )}
                  </Paper>
                </Tooltip>
              );
            })}
          </div>
        </div>
      )}

      <AddDeviceWizard open={wizardOpen} onClose={() => setWizardOpen(false)} onAdded={() => { void refetch(); }} />

      <Snackbar open={!!connectMsg} autoHideDuration={6000} onClose={() => setConnectMsg(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        {connectMsg ? <BuiAlert variant="info" className="w-full">
          <Info />
          <AlertDescription>{connectMsg}</AlertDescription>
          <AlertAction>
            <BuiButton variant="ghost" size="icon-xs" aria-label="Fermer" onClick={() => setConnectMsg(null)}>
              <X />
            </BuiButton>
          </AlertAction>
        </BuiAlert> : undefined}
      </Snackbar>
    </div>
  );
}
