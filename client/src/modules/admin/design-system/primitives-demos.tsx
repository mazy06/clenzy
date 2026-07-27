import { useState } from 'react';
import {
  BellIcon,
  BrushCleaningIcon,
  CalendarCheckIcon,
  EuroIcon,
  HomeIcon,
  InboxIcon,
  LinkIcon,
  PercentIcon,
  PlusIcon,
  RocketIcon,
  SearchXIcon,
  SettingsIcon,
  SparklesIcon,
  TrendingUpIcon,
  WrenchIcon,
} from 'lucide-react';
import {
  Badge,
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from '../../../components/ui';
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
import CornerRibbon from '../../../components/baitly/CornerRibbon';
import SettingSentence from '../../../components/baitly/SettingSentence';
import OptionalSection from '../../../components/baitly/OptionalSection';
import ChannelBadges from '../../../components/baitly/ChannelBadges';
import OnboardingChecklist from '../../../components/baitly/OnboardingChecklist';
import OnboardingDock from '../../../components/baitly/OnboardingDock';
import ShowcaseEmpty from '../../../components/baitly/ShowcaseEmpty';
import airbnbLogo from '../../../assets/logo/airbnb-logo-small.svg';
import bookingLogo from '../../../assets/logo/booking-logo-small.svg';
import vrboLogo from '../../../assets/logo/vrbo-logo-small.svg';
import abritelLogo from '../../../assets/logo/abritel-logo-small.svg';
import agodaLogo from '../../../assets/logo/agoda-logo-small.svg';

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

// ─── Vague « teardown » — primitives issues de l'audit concurrentiel ─────────
// Voir analyse-concurrentielle/46-teardown-guesty-produit.md §2.

export function BCornerRibbonDemo() {
  return (
    <div className="grid max-w-3xl gap-4 sm:grid-cols-3">
      {(
        [
          { tone: 'promo', label: '-50 %', title: 'Offre annuelle', body: 'Engagement 12 mois, deux mois offerts.' },
          { tone: 'exclusive', label: 'Exclusif', title: 'Partenaire Baitly', body: 'Tarif négocié pour les comptes Baitly.' },
          { tone: 'new', label: 'Nouveau', title: 'Serrures connectées', body: 'Codes d’accès générés à la réservation.' },
        ] as const
      ).map((item) => (
        <div
          key={item.tone}
          className="relative overflow-hidden rounded-xl border border-border bg-card p-4 pt-10"
        >
          <CornerRibbon label={item.label} tone={item.tone} />
          <div className="text-sm font-semibold text-foreground">{item.title}</div>
          <p className="m-0 mt-1 text-xs text-muted-foreground">{item.body}</p>
        </div>
      ))}
    </div>
  );
}

export function BSettingSentenceDemo() {
  const [status, setStatus] = useState('inconnu');
  const [days, setDays] = useState('5');
  const [threshold, setThreshold] = useState('80');
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <SettingSentence
        label="Statut de ménage"
        description="Appliqué à tous les logements de l’organisation."
      >
        Marquer le logement
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="inconnu">inconnu</SelectItem>
            <SelectItem value="à nettoyer">à nettoyer</SelectItem>
          </SelectContent>
        </Select>
        après
        <Input
          type="number"
          value={days}
          onChange={(e) => setDays(e.target.value)}
          className="w-16 text-center tabular-nums"
        />
        jours sans séjour.
      </SettingSentence>

      <SettingSentence label="Alerte de tarification">
        Me prévenir quand l’occupation des 30 prochains jours passe sous
        <Input
          type="number"
          value={threshold}
          onChange={(e) => setThreshold(e.target.value)}
          className="w-16 text-center tabular-nums"
        />
        %.
      </SettingSentence>

      <SettingSentence label="Règle désactivée" disabled>
        Bloquer les arrivées le
        <Select value="dimanche">
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="dimanche">dimanche</SelectItem>
          </SelectContent>
        </Select>
        en haute saison.
      </SettingSentence>
    </div>
  );
}

export function BOptionalSectionDemo() {
  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <OptionalSection
        title="Planification de l’envoi"
        description="Restreindre l’envoi à certains jours de la semaine."
        addLabel="Définir un calendrier"
      >
        <div className="flex flex-wrap gap-2">
          {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((day) => (
            <Badge key={day} variant="outline">
              {day}
            </Badge>
          ))}
        </div>
      </OptionalSection>

      <OptionalSection
        title="Conditions"
        description="N’envoyer que si la réservation correspond aux critères."
        addLabel="Ajouter une condition"
        help={
          <a href="#" onClick={(e) => e.preventDefault()} className="text-primary underline underline-offset-4">
            Comment ça marche ?
          </a>
        }
        defaultOpen
      >
        <div className="rounded-lg border border-border bg-card p-3 text-sm text-muted-foreground">
          Canal = <span className="font-medium text-foreground">Direct</span> · Durée ≥{' '}
          <span className="font-medium text-foreground">3 nuits</span>
        </div>
      </OptionalSection>
    </div>
  );
}

const DEMO_CHANNELS = [
  { key: 'airbnb', label: 'Airbnb', logo: airbnbLogo, connected: true, hint: 'synchronisé il y a 4 min' },
  { key: 'booking', label: 'Booking.com', logo: bookingLogo, connected: true },
  { key: 'vrbo', label: 'Vrbo', logo: vrboLogo },
  { key: 'abritel', label: 'Abritel', logo: abritelLogo },
  { key: 'agoda', label: 'Agoda', logo: agodaLogo },
];

export function BChannelBadgesDemo() {
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-muted-foreground">Taille md · dans le flux</span>
        <ChannelBadges channels={DEMO_CHANNELS} />
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-muted-foreground">Taille sm · repliée au-delà de 3</span>
        <ChannelBadges channels={DEMO_CHANNELS} size="sm" max={3} />
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-muted-foreground">Superposée sur un média</span>
        <div className="relative w-full max-w-sm overflow-hidden rounded-xl">
          <div className="aspect-[16/9] w-full bg-gradient-to-br from-primary-soft to-muted" />
          <div className="absolute top-3 end-3">
            <ChannelBadges channels={DEMO_CHANNELS} size="sm" max={4} overlay />
          </div>
          <span className="absolute bottom-3 start-3 rounded-full bg-foreground/75 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-background uppercase">
            Publié
          </span>
        </div>
      </div>
    </div>
  );
}

export function BOnboardingChecklistDemo() {
  return (
    <OnboardingChecklist
      className="max-w-5xl"
      actions={
        <>
          <Button variant="outline" size="sm">
            Voir le tutoriel
          </Button>
          <Button variant="outline" size="sm">
            Centre d’aide
          </Button>
        </>
      }
      groups={[
        {
          key: 'channels',
          title: 'Connecter vos canaux',
          media: <LinkIcon />,
          steps: [
            { key: 'account', title: 'Créer votre compte Baitly', state: 'done' },
            {
              key: 'property',
              title: 'Ajouter un premier logement',
              description:
                'Baitly a besoin d’au moins un logement pour ouvrir le planning et la tarification.',
              duration: '≈ 3 min',
              action: { label: 'Ajouter un logement' },
              onSkip: () => {},
            },
            {
              key: 'ical',
              title: 'Importer un calendrier iCal',
              description: 'Reprenez vos réservations existantes sans double saisie.',
              duration: '≈ 2 min',
              action: { label: 'Importer un iCal' },
              onSkip: () => {},
            },
          ],
        },
        {
          key: 'revenue',
          title: 'Optimiser vos revenus',
          media: <TrendingUpIcon />,
          steps: [
            {
              key: 'pricing',
              title: 'Définir vos tarifs de base',
              description: 'Le moteur de prix part de ce tarif pour construire ses recommandations.',
              duration: '≈ 5 min',
              action: { label: 'Définir les tarifs' },
            },
            {
              key: 'yield',
              title: 'Activer les recommandations tarifaires',
              badge: <Badge variant="secondary">Offre Pro</Badge>,
              state: 'locked',
              description: 'Disponible à partir de l’offre Pro.',
              action: { label: 'Comparer les offres' },
            },
          ],
        },
        {
          key: 'ops',
          title: 'Automatiser l’exploitation',
          media: <BrushCleaningIcon />,
          steps: [
            {
              key: 'messages',
              title: 'Automatiser vos messages voyageurs',
              description: 'Confirmation, instructions d’arrivée, relance d’avis.',
              duration: '≈ 4 min',
              action: { label: 'Créer une automatisation' },
              onSkip: () => {},
            },
            {
              key: 'cleaning',
              title: 'Planifier le ménage entre deux séjours',
              duration: '≈ 3 min',
              action: { label: 'Configurer le ménage' },
              onSkip: () => {},
            },
          ],
        },
      ]}
    />
  );
}

export function BShowcaseEmptyDemo() {
  return (
    <ShowcaseEmpty
      className="max-w-5xl"
      eyebrow={{ icon: <InboxIcon />, label: 'Messagerie unifiée' }}
      title="Répondez à vos voyageurs de tous les canaux depuis une seule boîte"
      description="Connectez un canal de distribution pour commencer à recevoir les messages dans Baitly."
      action={<Button>Connecter un canal</Button>}
      fallback={
        <>
          Pas encore de canal connecté ?{' '}
          <a href="#" onClick={(e) => e.preventDefault()}>
            Créer une réservation directe
          </a>
        </>
      }
      preview={
        <div className="flex flex-col gap-2">
          {[
            { name: 'Amina B.', logo: airbnbLogo, active: true },
            { name: 'Lucas M.', logo: bookingLogo },
            { name: 'Sofia R.', logo: vrboLogo },
          ].map((row) => (
            <div
              key={row.name}
              className={`flex items-center gap-3 rounded-lg border p-3 ${
                row.active ? 'border-primary/40 bg-card' : 'border-transparent bg-card/60'
              }`}
            >
              <img src={row.logo} alt="" className="size-5 shrink-0 object-contain" />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="text-xs font-medium text-foreground">{row.name}</span>
                {/* Convention : le texte secondaire des aperçus reste en Skeleton
                    — rien à traduire, aucune fausse donnée crédible à maintenir. */}
                <Skeleton className="h-2 w-3/4" />
              </div>
            </div>
          ))}
        </div>
      }
    />
  );
}

/** Fixture courte : la démo montre les ÉTATS du dock, pas le parcours réel
 *  (celui-ci est dans l'onglet Projections › Onboarding › « Dock persistant »). */
const DOCK_DEMO_GROUPS = [
  {
    key: 'account',
    title: 'Ouvrir votre compte',
    media: <RocketIcon />,
    steps: [
      { key: 'profile', title: 'Compléter votre profil', state: 'done' as const },
      {
        key: 'property',
        title: 'Créer votre premier logement',
        description: 'Baitly a besoin d’un logement pour ouvrir le planning et la tarification.',
        duration: '≈ 5 min',
        action: { label: 'Créer un logement' },
        onSkip: () => {},
      },
    ],
  },
  {
    key: 'revenue',
    title: 'Vendre et encaisser',
    media: <TrendingUpIcon />,
    steps: [
      {
        key: 'pricing',
        title: 'Définir votre tarification',
        duration: '≈ 5 min',
        action: { label: 'Définir les tarifs' },
      },
      {
        key: 'booking_engine',
        title: 'Publier votre site de réservation',
        state: 'locked' as const,
        badge: <Badge variant="secondary">Add-on</Badge>,
        description: 'Disponible avec l’add-on Site de réservation.',
        action: { label: 'Découvrir l’add-on' },
      },
    ],
  },
];

const DOCK_DEMO_GROUPS_DONE = DOCK_DEMO_GROUPS.map((group) => ({
  ...group,
  steps: group.steps.map((step) => ({ ...step, state: 'done' as const })),
}));

export function BOnboardingDockDemo() {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-3">
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-muted-foreground">Replié</span>
        <OnboardingDock floating={false} groups={DOCK_DEMO_GROUPS} onDismiss={() => {}} />
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-muted-foreground">Déplié</span>
        <OnboardingDock floating={false} groups={DOCK_DEMO_GROUPS} defaultOpen onDismiss={() => {}} />
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-muted-foreground">Terminé</span>
        <OnboardingDock
          floating={false}
          groups={DOCK_DEMO_GROUPS_DONE}
          defaultOpen
          onDismiss={() => {}}
          completion="Votre compte est opérationnel : logement publié, tarifs actifs et canal connecté."
        />
      </div>
    </div>
  );
}
