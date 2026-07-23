import { useState } from 'react';
import {
  BellIcon,
  CalendarCheckIcon,
  EuroIcon,
  HomeIcon,
  LinkIcon,
  PercentIcon,
  PlusIcon,
  SearchXIcon,
  SettingsIcon,
  SparklesIcon,
  WrenchIcon,
} from 'lucide-react';
import { Button } from '../../../components/ui';
import { useUserPreference } from '../../../hooks/useUserPreference';
import PageHeader from '../../../components/baitly/PageHeader';
import StatTile from '../../../components/baitly/StatTile';
import EmptyState from '../../../components/baitly/EmptyState';
import FilterChipRow from '../../../components/baitly/FilterChipRow';
import PeriodSegmented from '../../../components/baitly/PeriodSegmented';
import StatusChip from '../../../components/baitly/StatusChip';
import { Money } from '../../../components/baitly/Money';
import ListSkeleton from '../../../components/baitly/ListSkeleton';
import HeaderSearchField from '../../../components/baitly/HeaderSearchField';
import GuestAvatar from '../../../components/baitly/GuestAvatar';
import ConfirmationModal from '../../../components/baitly/ConfirmationModal';
import FilterSearchBar from '../../../components/baitly/FilterSearchBar';
import DataFetchWrapper from '../../../components/baitly/DataFetchWrapper';
import HelpBanner from '../../../components/baitly/HelpBanner';
import HelpPopover from '../../../components/baitly/HelpPopover';
import ExportButton from '../../../components/baitly/ExportButton';
import LoadingStates from '../../../components/baitly/LoadingStates';
import PageTabs from '../../../components/baitly/PageTabs';
import DateRangePicker from '../../../components/baitly/DateRangePicker';
import ThemedTooltip from '../../../components/baitly/ThemedTooltip';

/**
 * Démos des primitives maison remasterisées (components/baitly/) — l'onglet
 * « Primitives Baitly » de la galerie. Chaque démo reproduit l'usage réel de
 * la primitive MUI d'origine, rendue avec le kit Baitly UI.
 */

export function BPageHeaderDemo() {
  return (
    <PageHeader
      title="Riad Yasmine"
      subtitle="6 chambres · Marrakech, Médina"
      iconBadge={<HomeIcon />}
      titleAdornment={<StatusChip tone="ok" label="Actif" dot />}
      backPath="#"
      actions={
        <>
          <Button variant="outline" size="sm">
            Exporter
          </Button>
          <Button size="sm">
            <PlusIcon /> Nouvelle réservation
          </Button>
        </>
      }
      className="mb-0"
    />
  );
}

export function BStatTileDemo() {
  return (
    <div className="grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3">
      <StatTile
        icon={<PercentIcon />}
        label="Occupation 30 j"
        value="84"
        unit="%"
        hint={
          <>
            <b>+8 pts</b> vs juin
          </>
        }
      />
      <StatTile
        icon={<EuroIcon />}
        label="Revenus du mois"
        value={<Money value={12480} decimals={0} />}
        iconClassName="text-success"
        hint="4 logements actifs"
      />
      <StatTile icon={<CalendarCheckIcon />} label="Réservations" value="27" loading />
    </div>
  );
}

export function BEmptyStateDemo() {
  return (
    <EmptyState
      icon={<SearchXIcon />}
      title="Aucune réservation trouvée"
      description="Aucune réservation ne correspond à ces filtres sur la période sélectionnée."
      action={<Button size="sm">Réinitialiser les filtres</Button>}
      secondaryAction={
        <Button size="sm" variant="ghost">
          Élargir la période
        </Button>
      }
      tip={
        <>
          <SparklesIcon className="me-1 inline size-3.5" /> Astuce : le filtre « Canal » se combine
          avec la recherche texte.
        </>
      }
      className="max-w-xl"
    />
  );
}

export function BFilterChipRowDemo() {
  const [channel, setChannel] = useState<string | ''>('');
  return (
    <FilterChipRow
      allLabel="Tous"
      allCount={42}
      value={channel}
      onChange={setChannel}
      options={[
        { value: 'direct', label: 'Direct', color: '#2563EB', count: 12 },
        { value: 'airbnb', label: 'Airbnb', color: '#FF5A5F', count: 18 },
        { value: 'booking', label: 'Booking', color: '#003580', count: 9 },
        { value: 'vrbo', label: 'Vrbo', color: '#14B8A6', count: 3 },
      ]}
    />
  );
}

export function BPeriodSegmentedDemo() {
  const [period, setPeriod] = useState('30d');
  return (
    <PeriodSegmented
      value={period}
      onChange={setPeriod}
      ariaLabel="Période"
      options={[
        { value: '7d', label: '7 j' },
        { value: '30d', label: '30 j' },
        { value: '90d', label: '90 j' },
        { value: 'ytd', label: 'Année' },
      ]}
    />
  );
}

export function BStatusChipDemo() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <StatusChip tone="ok" label="Confirmée" dot />
      <StatusChip tone="warn" label="En attente" dot />
      <StatusChip tone="err" label="Annulée" dot />
      <StatusChip tone="info" label="Synchronisée" />
      <StatusChip tone="accent" label="Direct" />
      <StatusChip tone="neutral" label="Brouillon" />
      <StatusChip color="#FF5A5F" label="Airbnb" dot />
      <StatusChip tone="ok" label="Payée" size="sm" />
    </div>
  );
}

export function BMoneyDemo() {
  return (
    <div className="flex flex-col gap-2 text-sm text-foreground">
      <span>
        Total séjour : <Money value={1240.5} />
      </span>
      <span>
        Compact : <Money value={1240.5} compact />
      </span>
      <span>
        Sans décimales : <Money value={1240.5} decimals={0} />
      </span>
      <span className="text-muted-foreground">
        (La devise d'affichage suit la préférence utilisateur — glyphe MAD/SAR en icône.)
      </span>
    </div>
  );
}

export function BListSkeletonDemo() {
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <ListSkeleton rows={3} />
      <ListSkeleton rows={3} variant="card" />
      <ListSkeleton rows={3} variant="table" columns={5} />
    </div>
  );
}

export function BHeaderSearchFieldDemo() {
  const [query, setQuery] = useState('');
  return (
    <div className="max-w-sm">
      <HeaderSearchField value={query} onChange={setQuery} placeholder="Rechercher un logement…" />
    </div>
  );
}

export function BGuestAvatarDemo() {
  return (
    <div className="flex items-center gap-3">
      <GuestAvatar name="Amina Benali" size={40} />
      <GuestAvatar name="Karim El Fassi" size={32} />
      <GuestAvatar name="Sara" size={24} />
      <GuestAvatar name="John Smith" photoUrl="/broken-on-purpose.png" size={32} />
    </div>
  );
}

export function BFilterSearchBarDemo() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [view, setView] = useState<'grid' | 'list' | 'map'>('list');
  return (
    <FilterSearchBar
      searchTerm={search}
      onSearchChange={setSearch}
      searchPlaceholder="Rechercher une intervention…"
      filters={{
        status: {
          value: status,
          onChange: setStatus,
          label: 'Statut',
          options: [
            { value: 'all', label: 'Tous les statuts' },
            { value: 'pending', label: 'En attente' },
            { value: 'done', label: 'Terminées' },
          ],
        },
      }}
      counter={{ label: 'interventions', count: 12, singular: 'intervention', plural: 'interventions' }}
      viewToggle={{ mode: view, onChange: setView, modes: ['grid', 'list', 'map'] }}
    />
  );
}

export function BDataFetchWrapperDemo() {
  const [state, setState] = useState<'loading' | 'error' | 'ready'>('loading');
  return (
    <div className="flex max-w-xl flex-col gap-3">
      <PeriodSegmented
        value={state}
        onChange={(v) => setState(v as typeof state)}
        options={[
          { value: 'loading', label: 'Chargement' },
          { value: 'error', label: 'Erreur' },
          { value: 'ready', label: 'Prêt' },
        ]}
      />
      <DataFetchWrapper
        loading={state === 'loading'}
        error={state === 'error' ? 'Le serveur a répondu 500 sur /api/reservations.' : null}
        onRetry={() => setState('loading')}
        onClearError={() => setState('ready')}
        variant="skeleton"
        skeletonCount={3}
      >
        <div className="rounded-lg border border-border bg-card p-4 text-sm">
          27 réservations chargées.
        </div>
      </DataFetchWrapper>
    </div>
  );
}

export function BHelpBannerDemo() {
  // Le dismiss persiste en préférences backend (comportement réel) : on offre
  // un bouton de réaffichage pour que la démo reste utilisable.
  const [dismissed, setDismissed] = useUserPreference<boolean>('help.demo_design_system', false);
  return (
    <div className="flex flex-col gap-2">
      {dismissed && (
        <Button size="sm" variant="outline" className="self-start" onClick={() => setDismissed(false)}>
          Réafficher le bandeau
        </Button>
      )}
      <BHelpBannerInner />
    </div>
  );
}

function BHelpBannerInner() {
  return (
    <HelpBanner
      storageKey="demo_design_system_help"
      title="Comment fonctionne la synchronisation ?"
      description="Trois briques collaborent pour garder vos calendriers à jour."
      steps={[
        { icon: <LinkIcon />, title: 'Connexion', description: 'Chaque canal est relié via Intégrations.' },
        { icon: <BellIcon />, title: 'Webhooks', description: 'Les réservations arrivent en temps réel.' },
        { icon: <WrenchIcon />, title: 'Réconciliation', description: 'Un contrôle nocturne corrige les écarts.' },
      ]}
    />
  );
}

export function BHelpPopoverDemo() {
  return (
    <div className="flex items-center gap-4">
      <HelpPopover
        title="Taux d'occupation"
        description="Nuits réservées ÷ nuits ouvertes à la vente sur la période."
        steps={[
          { icon: <PercentIcon />, title: 'Inclut', description: 'réservations confirmées et blocs propriétaire.' },
          { icon: <SettingsIcon />, title: 'Exclut', description: 'jours fermés à la vente.' },
        ]}
      />
      <HelpPopover title="Aide" description="Version avec libellé visible." label="Comprendre ce calcul" />
    </div>
  );
}

export function BExportButtonDemo() {
  const data = [
    { id: 'RES-1042', property: 'Riad Yasmine', total: 1240 },
    { id: 'RES-1043', property: 'Duplex Guéliz', total: 380 },
  ];
  const columns = [
    { key: 'id', label: 'Référence' },
    { key: 'property', label: 'Logement' },
    { key: 'total', label: 'Total (€)' },
  ];
  return (
    <div className="flex flex-wrap items-center gap-3">
      <ExportButton data={data} columns={columns} fileName="reservations-demo" />
      <ExportButton data={data} columns={columns} fileName="reservations-demo" variant="menu" />
      <ExportButton data={data} columns={columns} fileName="reservations-demo" variant="icon" />
      <ExportButton data={[]} columns={columns} fileName="reservations-demo" />
    </div>
  );
}

export function BLoadingStatesDemo() {
  const [state, setState] = useState<'loading' | 'user-loading' | 'permissions-loading' | 'error-loading'>('loading');
  return (
    <div className="flex max-w-xl flex-col gap-3">
      <PeriodSegmented
        value={state}
        onChange={(v) => setState(v as typeof state)}
        options={[
          { value: 'loading', label: 'App' },
          { value: 'user-loading', label: 'Profil' },
          { value: 'permissions-loading', label: 'Permissions' },
          { value: 'error-loading', label: 'Erreur' },
        ]}
      />
      <div className="rounded-lg border border-border bg-card">
        <LoadingStates
          state={state}
          error="Impossible de joindre le serveur d'authentification."
          onRetry={() => setState('loading')}
        />
      </div>
    </div>
  );
}

export function BPageTabsDemo() {
  const [tab, setTab] = useState(0);
  return (
    <div className="flex flex-col gap-2">
      <PageTabs
        value={tab}
        onChange={setTab}
        options={[
          { label: 'Détails', icon: <HomeIcon className="size-4" /> },
          { label: 'Réservations', badge: 12 },
          { label: 'Interventions', badge: 3, badgeColor: 'warning' },
          { label: 'Facturation' },
          { label: 'Admin', hidden: true },
        ]}
        inlineActions={
          <Button size="sm" variant="outline">
            <PlusIcon /> Créer
          </Button>
        }
      />
      <p className="m-0 text-sm text-muted-foreground">Onglet actif : {tab}</p>
    </div>
  );
}

export function BDateRangePickerDemo() {
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  return (
    <DateRangePicker
      startDate={start}
      endDate={end}
      onChangeStart={setStart}
      onChangeEnd={setEnd}
      isFrench
      label="Période du rapport"
    />
  );
}

export function BThemedTooltipDemo() {
  return (
    <div className="flex items-center gap-3">
      <ThemedTooltip title="Synchroniser maintenant">
        <Button variant="outline">Survole-moi</Button>
      </ThemedTooltip>
      <ThemedTooltip title="Affiché à droite" side="right">
        <Button variant="ghost">Côté droit</Button>
      </ThemedTooltip>
    </div>
  );
}

export function BConfirmationModalDemo() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  return (
    <>
      <Button variant="destructive" onClick={() => setOpen(true)}>
        Supprimer le logement…
      </Button>
      <ConfirmationModal
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={() => {
          setLoading(true);
          setTimeout(() => {
            setLoading(false);
            setOpen(false);
          }, 1200);
        }}
        title="Supprimer le Riad Yasmine ?"
        message="Les réservations passées sont conservées, mais le logement disparaîtra du planning et des canaux connectés."
        severity="error"
        confirmText="Supprimer"
        loading={loading}
      />
    </>
  );
}
