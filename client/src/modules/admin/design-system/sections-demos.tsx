import { useState } from 'react';
import {
  BanknoteIcon,
  BrushIcon,
  CalendarSyncIcon,
  ChevronRightIcon,
  CircleCheckIcon,
  ClockIcon,
  MessageSquareIcon,
  LogInIcon,
  LogOutIcon,
  SparklesIcon,
  StarIcon,
  TrendingUpIcon,
  TriangleAlertIcon,
  CalendarCheckIcon,
  EuroIcon,
  HomeIcon,
  PercentIcon,
  PlusIcon,
  WrenchIcon,
} from 'lucide-react';
import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts';
import {
  Badge,
  Button,
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../components/ui';
import PageHeader from '../../../components/baitly/PageHeader';
import TeamCard from '../../../components/baitly/TeamCard';
import AppUpdateBanner from '../../../components/baitly/AppUpdateBanner';
import PWAInstallBanner from '../../../components/baitly/PWAInstallBanner';
import AiCreditsPaywall from '../../../components/baitly/AiCreditsPaywall';
import HubScreenSwitcher from '../../../components/baitly/HubScreenSwitcher';
import StatusChip from '../../../components/baitly/StatusChip';
import GuestAvatar from '../../../components/baitly/GuestAvatar';
import ConfirmationModal from '../../../components/baitly/ConfirmationModal';
import { NAVIGATION_HUBS } from '../../../config/navigationHubs';
import StatTile from '../../../components/baitly/StatTile';
import PeriodSegmented from '../../../components/baitly/PeriodSegmented';
import FilterSearchBar from '../../../components/baitly/FilterSearchBar';
import RevenueByChannelCard from '../../../components/baitly/RevenueByChannelCard';
import ServiceRequestCard from '../../../components/baitly/ServiceRequestCard';
import DescriptionNotesDisplay from '../../../components/baitly/DescriptionNotesDisplay';
import OfflineBanner from '../../../components/baitly/OfflineBanner';
import { Money } from '../../../components/baitly/Money';
import { cn } from '../../../utils/cn';
import FilterChipRow from '../../../components/baitly/FilterChipRow';

/**
 * Démos « sections d'écran » : des morceaux de PMS composés UNIQUEMENT de
 * primitives Baitly UI — l'aperçu du rendu cible de la migration.
 */

// ─── Composants vague 3 (démos unitaires) ────────────────────────────────────

export function BRevenueByChannelCardDemo() {
  const [period, setPeriod] = useState('30d');
  return (
    <RevenueByChannelCard
      className="max-w-md"
      headerAction={
        <PeriodSegmented
          value={period}
          onChange={setPeriod}
          options={[
            { value: '30d', label: '30 j' },
            { value: '90d', label: '90 j' },
          ]}
        />
      }
      channels={[
        { name: 'Airbnb', pct: 46, amount: 5740, color: '#FF5A5F', comparePct: 41 },
        { name: 'Direct', pct: 28, amount: 3495, color: '#2563EB', comparePct: 31 },
        { name: 'Booking', pct: 19, amount: 2371, color: '#003580', comparePct: 19 },
        { name: 'Vrbo', pct: 7, amount: 874, color: '#14B8A6', comparePct: 9 },
      ]}
    />
  );
}

export function BServiceRequestCardDemo() {
  return (
    <div className="grid max-w-3xl gap-3 sm:grid-cols-2">
      <ServiceRequestCard
        request={{
          id: 'SR-482',
          title: 'Ménage complet après check-out',
          type: 'CLEANING',
          status: 'PENDING',
          priority: 'HIGH',
          propertyName: 'Riad Yasmine',
          propertyCity: 'Marrakech',
          dueDate: '19 août, 11:00',
          estimatedDuration: 150,
          estimatedCost: 45,
          assignedToName: 'Fatima Zahra',
        }}
        onMenuOpen={() => {}}
        typeIcons={{ CLEANING: <BrushIcon />, MAINTENANCE: <WrenchIcon /> }}
        statuses={[
          { value: 'PENDING', label: 'En attente' },
          { value: 'DONE', label: 'Terminée' },
        ]}
        priorities={[
          { value: 'HIGH', label: 'Haute' },
          { value: 'NORMAL', label: 'Normale' },
        ]}
        statusColors={{ PENDING: '#D4A574', DONE: '#14B8A6' }}
        priorityColors={{ HIGH: '#C97A7A', NORMAL: '#7BA3C2' }}
      />
      <ServiceRequestCard
        request={{
          id: 'SR-483',
          title: 'Fuite robinet salle de bain',
          type: 'MAINTENANCE',
          status: 'DONE',
          priority: 'NORMAL',
          propertyName: 'Duplex Guéliz',
          propertyCity: 'Marrakech',
          dueDate: '21 août',
          estimatedCost: 120,
          assignedToName: null,
        }}
        onMenuOpen={() => {}}
        typeIcons={{ CLEANING: <BrushIcon />, MAINTENANCE: <WrenchIcon /> }}
        statuses={[
          { value: 'PENDING', label: 'En attente' },
          { value: 'DONE', label: 'Terminée' },
        ]}
        priorities={[
          { value: 'HIGH', label: 'Haute' },
          { value: 'NORMAL', label: 'Normale' },
        ]}
        statusColors={{ PENDING: '#D4A574', DONE: '#14B8A6' }}
        priorityColors={{ HIGH: '#C97A7A', NORMAL: '#7BA3C2' }}
      />
    </div>
  );
}

export function BDescriptionNotesDemo() {
  return (
    <div className="max-w-xl">
      <DescriptionNotesDisplay
        variant="cleaning"
        description="Riad de 6 chambres autour d'un patio central avec bassin. Accès par la ruelle Derb Dekkak, porte en bois clouté."
        notes={'* Changer le linge des 6 chambres\n* Vider et nettoyer le bassin du patio\n* Réapprovisionner le thé et les dattes\nLes produits sont dans le placard sous l\'escalier.'}
      />
    </div>
  );
}

export function BOfflineBannerDemo() {
  return <OfflineBanner forceVisible />;
}

// ─── Sections d'écran ────────────────────────────────────────────────────────

export function BDashboardSectionDemo() {
  const [period, setPeriod] = useState('30d');
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Dashboard"
        subtitle="Mercredi 23 juillet · 4 logements actifs"
        iconBadge={<HomeIcon />}
        titleAdornment={<Badge variant="warning">3 à traiter</Badge>}
        showBackButton={false}
        className="mb-0"
        actions={
          <>
            <PeriodSegmented
              value={period}
              onChange={setPeriod}
              options={[
                { value: '7d', label: '7 j' },
                { value: '30d', label: '30 j' },
                { value: '90d', label: '90 j' },
              ]}
            />
            <Button size="sm">
              <PlusIcon /> Réservation
            </Button>
          </>
        }
      />

      {/* Rangée KPI */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <StatTile icon={<PercentIcon />} label="Occupation" value="84" unit="%" hint={<><b>+8 pts</b> vs période préc.</>} />
        <StatTile icon={<EuroIcon />} label="Revenus" value={<Money value={12480} decimals={0} />} iconClassName="text-success" hint={<><b>+15 %</b> vs période préc.</>} />
        <StatTile icon={<TrendingUpIcon />} label="ADR" value={<Money value={118} decimals={0} />} hint="prix moyen par nuit vendue" />
        <StatTile icon={<BanknoteIcon />} label="RevPAR" value={<Money value={99} decimals={0} />} hint="revenu par nuit disponible" />
        <StatTile icon={<CalendarCheckIcon />} label="Réservations" value="27" hint="dont 6 arrivées cette semaine" />
        <StatTile icon={<StarIcon />} label="Note moyenne" value="4,8" unit="/5" iconClassName="text-warning" hint="52 avis sur la période" />
      </div>

      {/* Graphiques */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="cn-font-heading m-0 text-[15px] font-semibold tracking-tight text-foreground">
              Revenus — 6 derniers mois
            </h3>
            <span className="text-xs text-muted-foreground">
              Direct <span className="mx-1 inline-block size-2 rounded-[3px] bg-chart-1 align-middle" /> · OTA
              <span className="ms-1 inline-block size-2 rounded-[3px] bg-chart-2 align-middle" />
            </span>
          </div>
          <ChartContainer config={DASHBOARD_REVENUE_CONFIG} className="h-52 w-full">
            <BarChart accessibilityLayer data={DASHBOARD_REVENUE_DATA}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="month" tickLine={false} tickMargin={8} axisLine={false} tickFormatter={(v: string) => v.slice(0, 3)} />
              <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
              <Bar dataKey="direct" stackId="a" fill="var(--color-direct)" radius={[0, 0, 4, 4]} />
              <Bar dataKey="ota" stackId="a" fill="var(--color-ota)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </div>
        <BRevenueByChannelCardInline />
      </div>

      {/* Opérations du jour */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="m-0 mb-3 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            <LogInIcon className="size-3.5 text-success" /> Arrivées aujourd'hui (2)
          </h3>
          <div className="flex flex-col gap-2.5">
            {[
              { guest: 'Amina Benali', property: 'Riad Yasmine', time: '15:00', channel: 'Airbnb', color: '#FF5A5F', note: 'Lit bébé demandé' },
              { guest: 'John Smith', property: 'Duplex Guéliz', time: '17:30', channel: 'Direct', color: '#2563EB', note: 'Check-in autonome' },
            ].map((arrival) => (
              <div key={arrival.guest} className="flex items-center gap-2.5">
                <GuestAvatar name={arrival.guest} size={30} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-medium text-foreground">{arrival.guest}</span>
                    <StatusChip color={arrival.color} label={arrival.channel} size="sm" />
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {arrival.property} · {arrival.note}
                  </div>
                </div>
                <span className="shrink-0 text-sm font-semibold text-foreground tabular-nums">{arrival.time}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="m-0 mb-3 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            <LogOutIcon className="size-3.5 text-info" /> Départs aujourd'hui (1)
          </h3>
          <div className="flex items-center gap-2.5">
            <GuestAvatar name="Lea Martin" size={30} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-foreground">Lea Martin</div>
              <div className="truncate text-xs text-muted-foreground">Villa Palmeraie · caution à libérer</div>
            </div>
            <span className="shrink-0 text-sm font-semibold text-foreground tabular-nums">11:00</span>
          </div>
          <Button size="xs" variant="outline" className="mt-3">
            Libérer la caution
          </Button>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="m-0 mb-3 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            <BrushIcon className="size-3.5 text-primary" /> Ménages du jour (2)
          </h3>
          <div className="flex flex-col gap-2.5">
            {[
              { property: 'Villa Palmeraie', assignee: 'Fatima Zahra', window: '11:00 → 15:00', tone: 'warn' as const, label: 'En cours' },
              { property: 'Riad Yasmine', assignee: 'Khadija Mansouri', window: 'avant 15:00', tone: 'neutral' as const, label: 'Planifié' },
            ].map((cleaning) => (
              <div key={cleaning.property} className="flex items-center gap-2.5">
                <GuestAvatar name={cleaning.assignee} size={30} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-foreground">{cleaning.property}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {cleaning.assignee} · {cleaning.window}
                  </div>
                </div>
                <StatusChip tone={cleaning.tone} label={cleaning.label} dot size="sm" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* À traiter + occupation par logement */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="m-0 mb-3 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            <TriangleAlertIcon className="size-3.5 text-warning" /> À traiter (3)
          </h3>
          <div className="flex flex-col">
            {[
              { icon: <BanknoteIcon />, accent: 'text-warning bg-warning-soft', title: 'Solde à percevoir — RES-1042', detail: <>Amina Benali · reste <b className="text-foreground"><Money value={868} decimals={0} /></b> avant l'arrivée</>, action: 'Encaisser' },
              { icon: <StarIcon />, accent: 'text-info bg-info-soft', title: 'Avis 3★ sans réponse — Duplex Guéliz', detail: '« Appartement propre mais wifi capricieux » · Booking, il y a 2 j', action: 'Répondre' },
              { icon: <CalendarSyncIcon />, accent: 'text-destructive bg-destructive-soft', title: 'Calendrier Vrbo désynchronisé', detail: 'Villa Palmeraie · dernier succès il y a 26 h', action: 'Resynchroniser' },
            ].map((task, index) => (
              <div key={task.title} className={cn('flex items-center gap-3 py-2.5', index > 0 && 'border-t border-border')}>
                <span className={cn('inline-flex size-8 shrink-0 items-center justify-center rounded-lg [&>svg]:size-4', task.accent)}>
                  {task.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-foreground">{task.title}</div>
                  <div className="truncate text-xs text-muted-foreground">{task.detail}</div>
                </div>
                <Button size="xs" variant="outline" className="shrink-0">
                  {task.action}
                </Button>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="m-0 mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Occupation par logement
          </h3>
          <div className="flex flex-col gap-2.5">
            {[
              { property: 'Riad Yasmine', pct: 84 },
              { property: 'Duplex Guéliz', pct: 71 },
              { property: 'Villa Palmeraie', pct: 54 },
              { property: 'Appartement Maârif', pct: 38 },
            ].map((row) => (
              <div key={row.property} className="flex items-center gap-2.5">
                <span className="w-32 truncate text-xs font-medium text-foreground">{row.property}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-field">
                  <div
                    className={cn('h-full rounded-full', row.pct >= 70 ? 'bg-success' : row.pct >= 50 ? 'bg-primary' : 'bg-warning')}
                    style={{ width: `${row.pct}%` }}
                  />
                </div>
                <span className="w-9 shrink-0 text-end text-xs text-muted-foreground tabular-nums">{row.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Prochaines arrivées (7 jours) */}
      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <h3 className="cn-font-heading m-0 text-[15px] font-semibold tracking-tight text-foreground">
            Prochaines arrivées (7 jours)
          </h3>
          <Button size="xs" variant="ghost" className="text-muted-foreground">
            Tout le planning <ChevronRightIcon className="cn-rtl-flip" />
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Guest</TableHead>
              <TableHead>Logement</TableHead>
              <TableHead>Arrivée</TableHead>
              <TableHead className="text-end">Nuits</TableHead>
              <TableHead>Canal</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-end">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[
              { guest: 'Amina Benali', property: 'Riad Yasmine', date: 'Ven. 25 juil.', nights: 7, channel: 'Airbnb', color: '#FF5A5F', tone: 'warn' as const, status: 'Solde dû', total: 1240 },
              { guest: 'John Smith', property: 'Duplex Guéliz', date: 'Sam. 26 juil.', nights: 2, channel: 'Direct', color: '#2563EB', tone: 'ok' as const, status: 'Payée', total: 380 },
              { guest: 'Lea Martin', property: 'Villa Palmeraie', date: 'Dim. 27 juil.', nights: 5, channel: 'Booking', color: '#003580', tone: 'ok' as const, status: 'Payée', total: 2150 },
              { guest: 'Karim El Fassi', property: 'Appartement Maârif', date: 'Mar. 29 juil.', nights: 3, channel: 'Vrbo', color: '#14B8A6', tone: 'neutral' as const, status: 'Confirmée', total: 510 },
            ].map((row) => (
              <TableRow key={row.guest} className="cursor-pointer">
                <TableCell>
                  <span className="flex items-center gap-2">
                    <GuestAvatar name={row.guest} size={24} />
                    <span className="font-medium">{row.guest}</span>
                  </span>
                </TableCell>
                <TableCell>{row.property}</TableCell>
                <TableCell>{row.date}</TableCell>
                <TableCell className="text-end tabular-nums">{row.nights}</TableCell>
                <TableCell>
                  <StatusChip color={row.color} label={row.channel} dot size="sm" />
                </TableCell>
                <TableCell>
                  <StatusChip tone={row.tone} label={row.status} dot size="sm" />
                </TableCell>
                <TableCell className="text-end tabular-nums">
                  <Money value={row.total} decimals={0} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

const DASHBOARD_REVENUE_CONFIG = {
  direct: { label: 'Direct', color: 'var(--bui-chart-1)' },
  ota: { label: 'OTA', color: 'var(--bui-chart-2)' },
} satisfies ChartConfig;

const DASHBOARD_REVENUE_DATA = [
  { month: 'Février', direct: 2100, ota: 3800 },
  { month: 'Mars', direct: 2900, ota: 4600 },
  { month: 'Avril', direct: 3200, ota: 5100 },
  { month: 'Mai', direct: 3000, ota: 4800 },
  { month: 'Juin', direct: 3900, ota: 5600 },
  { month: 'Juillet', direct: 4600, ota: 6900 },
];

function BRevenueByChannelCardInline() {
  return (
    <RevenueByChannelCard
      channels={[
        { name: 'Airbnb', pct: 46, amount: 5740, color: '#FF5A5F' },
        { name: 'Direct', pct: 28, amount: 3495, color: '#2563EB' },
        { name: 'Booking', pct: 19, amount: 2371, color: '#003580' },
        { name: 'Vrbo', pct: 7, amount: 874, color: '#14B8A6' },
      ]}
    />
  );
}

export function BInterventionsSectionDemo() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [type, setType] = useState<string | ''>('');
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Interventions"
        subtitle="Ménage, maintenance et check-in/out · 4 logements"
        iconBadge={<WrenchIcon />}
        titleAdornment={<Badge variant="warning">3 en retard</Badge>}
        showBackButton={false}
        className="mb-0"
        actions={
          <>
            <Button size="sm" variant="outline">
              Planifier la semaine
            </Button>
            <Button size="sm">
              <PlusIcon /> Nouvelle intervention
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile icon={<TriangleAlertIcon />} label="En retard" value="3" iconClassName="text-destructive" hint={<><b>SR-471</b> depuis 2 jours</>} />
        <StatTile icon={<ClockIcon />} label="Aujourd'hui" value="5" hint="2 ménages · 2 check-in · 1 maintenance" />
        <StatTile icon={<CircleCheckIcon />} label="Terminées (7 j)" value="18" iconClassName="text-success" hint={<><b>2 h 10</b> de durée moyenne</>} />
      </div>

      <FilterSearchBar
        searchTerm={search}
        onSearchChange={setSearch}
        searchPlaceholder="Rechercher une intervention…"
        filters={{
          status: {
            value: status,
            onChange: setStatus,
            options: [
              { value: 'all', label: 'Tous les statuts' },
              { value: 'late', label: 'En retard' },
              { value: 'pending', label: 'En attente' },
              { value: 'inprogress', label: 'En cours' },
              { value: 'done', label: 'Terminées' },
            ],
          },
        }}
        counter={{ label: 'interventions', count: 12, singular: 'intervention', plural: 'interventions' }}
      />

      <FilterChipRow
        allLabel="Tous types"
        allCount={12}
        value={type}
        onChange={setType}
        options={[
          { value: 'cleaning', label: 'Ménage', color: '#2563EB', count: 6 },
          { value: 'maintenance', label: 'Maintenance', color: '#D4A574', count: 3 },
          { value: 'checkin', label: 'Check-in/out', color: '#14B8A6', count: 3 },
        ]}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <ServiceRequestCard
          request={{
            id: 'SR-482',
            title: 'Ménage complet après check-out',
            type: 'CLEANING',
            status: 'PENDING',
            priority: 'HIGH',
            propertyName: 'Riad Yasmine',
            propertyCity: 'Marrakech',
            dueDate: '19 août, 11:00',
            estimatedDuration: 150,
            estimatedCost: 45,
            assignedToName: 'Fatima Zahra',
          }}
          onMenuOpen={() => {}}
          typeIcons={SR_TYPE_ICONS}
          statuses={SR_STATUSES}
          priorities={SR_PRIORITIES}
          statusColors={SR_STATUS_COLORS}
          priorityColors={SR_PRIORITY_COLORS}
        />
        <ServiceRequestCard
          request={{
            id: 'SR-471',
            title: 'Fuite robinet salle de bain',
            type: 'MAINTENANCE',
            status: 'LATE',
            priority: 'HIGH',
            propertyName: 'Duplex Guéliz',
            propertyCity: 'Marrakech',
            dueDate: '21 juil. (dépassé)',
            estimatedCost: 120,
            assignedToName: null,
          }}
          onMenuOpen={() => {}}
          typeIcons={SR_TYPE_ICONS}
          statuses={SR_STATUSES}
          priorities={SR_PRIORITIES}
          statusColors={SR_STATUS_COLORS}
          priorityColors={SR_PRIORITY_COLORS}
        />
        <ServiceRequestCard
          request={{
            id: 'SR-485',
            title: 'Check-in accompagné — arrivée tardive',
            type: 'CHECKIN',
            status: 'DONE',
            priority: 'NORMAL',
            propertyName: 'Villa Palmeraie',
            propertyCity: 'Marrakech',
            dueDate: '22 juil., 21:30',
            estimatedDuration: 30,
            assignedToName: 'Youssef Alami',
          }}
          onMenuOpen={() => {}}
          typeIcons={SR_TYPE_ICONS}
          statuses={SR_STATUSES}
          priorities={SR_PRIORITIES}
          statusColors={SR_STATUS_COLORS}
          priorityColors={SR_PRIORITY_COLORS}
        />
      </div>

      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious href="#" text="Précédent" />
          </PaginationItem>
          <PaginationItem>
            <PaginationLink href="#" isActive>
              1
            </PaginationLink>
          </PaginationItem>
          <PaginationItem>
            <PaginationLink href="#">2</PaginationLink>
          </PaginationItem>
          <PaginationItem>
            <PaginationNext href="#" text="Suivant" />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}

const SR_TYPE_ICONS = { CLEANING: <BrushIcon />, MAINTENANCE: <WrenchIcon />, CHECKIN: <LogInIcon /> };
const SR_STATUSES = [
  { value: 'PENDING', label: 'En attente' },
  { value: 'LATE', label: 'En retard' },
  { value: 'DONE', label: 'Terminée' },
];
const SR_PRIORITIES = [
  { value: 'HIGH', label: 'Haute' },
  { value: 'NORMAL', label: 'Normale' },
];
const SR_STATUS_COLORS = { PENDING: '#D4A574', LATE: '#C97A7A', DONE: '#14B8A6' };
const SR_PRIORITY_COLORS = { HIGH: '#C97A7A', NORMAL: '#7BA3C2' };

// ─── Vague 4 ─────────────────────────────────────────────────────────────────

export function BTeamCardDemo() {
  return (
    <div className="grid max-w-3xl gap-3 sm:grid-cols-2">
      <TeamCard
        team={{
          id: 1,
          name: 'Équipe ménage Médina',
          description: 'Riads et appartements du centre historique de Marrakech.',
          interventionType: 'CLEANING',
          status: 'active',
          members: [
            { id: 1, firstName: 'Fatima', lastName: 'Zahra' },
            { id: 2, firstName: 'Khadija', lastName: 'Mansouri' },
            { id: 3, firstName: 'Salma', lastName: 'Idrissi' },
            { id: 4, firstName: 'Nora', lastName: 'B.' },
            { id: 5, firstName: 'Imane', lastName: 'T.' },
          ],
          totalInterventions: 248,
          lastIntervention: '21 juil.',
        }}
        activeInterventionsCount={3}
        onMenuOpen={() => {}}
      />
      <TeamCard
        team={{
          id: 2,
          name: 'Maintenance Guéliz',
          description: 'Plomberie, électricité et petits travaux.',
          interventionType: 'MAINTENANCE',
          status: 'maintenance',
          members: [{ id: 6, firstName: 'Youssef', lastName: 'Alami' }],
          totalInterventions: 57,
          lastIntervention: '18 juil.',
        }}
        onMenuOpen={() => {}}
      />
    </div>
  );
}

export function BAppUpdateBannerDemo() {
  return <AppUpdateBanner forceVisible />;
}

export function BPWAInstallBannerDemo() {
  return <PWAInstallBanner forceVisible />;
}

export function BAiCreditsPaywallDemo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <SparklesIcon /> Simuler crédits épuisés
      </Button>
      <AiCreditsPaywall open={open} onClose={() => setOpen(false)} balanceMillicredits={1250} />
    </>
  );
}

export function BHubScreenSwitcherDemo() {
  const hub = NAVIGATION_HUBS[0];
  const tabs = hub.tabs.slice(0, 4);
  return (
    <div className="flex items-center gap-3">
      <HubScreenSwitcher
        identity={{ kind: 'switcher', hub, tabs, activeTabPath: tabs[0]?.path ?? '' }}
      />
      <HubScreenSwitcher
        identity={{
          kind: 'single',
          iconKey: '/dashboard',
          translationKey: 'nav.dashboard',
          fallbackLabel: 'Tableau de bord',
        }}
      />
    </div>
  );
}

// ─── Section — Fiche réservation ─────────────────────────────────────────────

export function BReservationDetailSectionDemo() {
  const [cancelOpen, setCancelOpen] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="RES-1042 — Amina Benali"
        subtitle="Riad Yasmine · 12 → 19 août · 7 nuits · 4 voyageurs"
        iconBadge={<CalendarCheckIcon />}
        titleAdornment={<Badge variant="success">Confirmée</Badge>}
        backPath="#"
        className="mb-0"
        actions={
          <>
            <Button size="sm" variant="outline">
              Modifier
            </Button>
            <Button size="sm" variant="destructive" onClick={() => setCancelOpen(true)}>
              Annuler
            </Button>
          </>
        }
      />

      {/* Cycle de vie du séjour */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center">
          {[
            { label: 'Créée', detail: '2 juil.', state: 'done' },
            { label: 'Acompte 30 %', detail: '3 juil.', state: 'done' },
            { label: 'Solde', detail: 'avant le 5 août', state: 'current' },
            { label: 'Arrivée', detail: '12 août, 15:00', state: 'todo' },
            { label: 'Départ', detail: '19 août, 11:00', state: 'todo' },
          ].map((step, index) => (
            <div key={step.label} className={cn('flex items-center', index > 0 && 'flex-1')}>
              {index > 0 && (
                <div className={cn('h-px flex-1', step.state === 'done' || step.state === 'current' ? 'bg-primary' : 'bg-border')} />
              )}
              <div className="flex flex-col items-center gap-1 px-2 text-center">
                <span
                  className={cn(
                    'inline-flex size-5 items-center justify-center rounded-full',
                    step.state === 'done' && 'bg-primary text-primary-foreground',
                    step.state === 'current' && 'bg-warning-soft text-warning ring-4 ring-warning/15',
                    step.state === 'todo' && 'bg-muted text-muted-foreground'
                  )}
                >
                  {step.state === 'done' ? <CircleCheckIcon className="size-3" /> : <span className="size-1.5 rounded-full bg-current" />}
                </span>
                <span className={cn('text-2xs font-medium whitespace-nowrap', step.state === 'current' ? 'text-warning' : 'text-foreground')}>
                  {step.label}
                </span>
                <span className="text-2xs whitespace-nowrap text-muted-foreground">{step.detail}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="m-0 mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Guest
          </h3>
          <div className="flex items-center gap-3">
            <GuestAvatar name="Amina Benali" size={40} />
            <div className="min-w-0 text-sm">
              <div className="flex items-center gap-1.5 font-semibold text-foreground">
                Amina Benali <StatusChip tone="accent" label="Fidèle · 4 séjours" size="sm" />
              </div>
              <div className="text-xs text-muted-foreground">amina@exemple.ma · +212 6 12 34 56 78</div>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <Button size="xs" variant="outline">
              <MessageSquareIcon /> Message
            </Button>
            <Button size="xs" variant="ghost">
              Voir la fiche
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="m-0 mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Détail financier
          </h3>
          <div className="flex flex-col gap-1.5 text-xs">
            <div className="flex justify-between text-muted-foreground">
              <span>7 nuits × 160 €</span>
              <span className="tabular-nums"><Money value={1120} decimals={0} /></span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Frais de ménage</span>
              <span className="tabular-nums"><Money value={80} decimals={0} /></span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Taxe de séjour (4 pers.)</span>
              <span className="tabular-nums"><Money value={40} decimals={0} /></span>
            </div>
            <div className="mt-1 flex justify-between border-t border-border pt-1.5 text-sm font-semibold text-foreground">
              <span>Total</span>
              <span className="tabular-nums"><Money value={1240} decimals={0} /></span>
            </div>
            <div className="flex justify-between text-success">
              <span>Acompte reçu (3 juil.)</span>
              <span className="tabular-nums">−<Money value={372} decimals={0} /></span>
            </div>
            <div className="flex justify-between font-semibold text-warning">
              <span>Solde dû avant le 5 août</span>
              <span className="tabular-nums"><Money value={868} decimals={0} /></span>
            </div>
          </div>
          <Button size="xs" className="mt-3">
            <BanknoteIcon /> Encaisser le solde
          </Button>
        </div>

        <div className="flex flex-col gap-3">
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="m-0 mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Canal
            </h3>
            <StatusChip color="#FF5A5F" label="Airbnb" dot />
            <p className="m-0 mt-2 text-xs text-muted-foreground">
              Synchronisée il y a 12 min. Modifications de dates côté canal.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="m-0 mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Interventions liées
            </h3>
            <div className="flex flex-col gap-2 text-xs">
              <div className="flex items-center gap-2">
                <BrushIcon className="size-3.5 text-primary" />
                <span className="flex-1 text-foreground">Ménage avant arrivée</span>
                <StatusChip tone="neutral" label="12 août" size="sm" />
              </div>
              <div className="flex items-center gap-2">
                <BrushIcon className="size-3.5 text-primary" />
                <span className="flex-1 text-foreground">Ménage après départ</span>
                <StatusChip tone="neutral" label="19 août" size="sm" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.2fr_1fr]">
        <DescriptionNotesDisplay
          variant="cleaning"
          notes={'* Check-in autonome : code boîte à clés 4482\n* Prévoir lit bébé (demandé par le guest)\nArrivée estimée 16 h.'}
        />
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="m-0 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Derniers messages
            </h3>
            <Button size="xs" variant="ghost" className="text-muted-foreground">
              Ouvrir la conversation <ChevronRightIcon className="cn-rtl-flip" />
            </Button>
          </div>
          <div className="flex flex-col gap-2 text-xs">
            <div className="flex items-start gap-2">
              <GuestAvatar name="Amina Benali" size={20} />
              <p className="m-0 rounded-lg bg-muted px-2.5 py-1.5 text-foreground">
                À quelle heure pouvons-nous arriver vendredi ?
              </p>
            </div>
            <div className="flex items-start justify-end gap-2">
              <p className="m-0 rounded-lg bg-primary-soft px-2.5 py-1.5 text-foreground">
                Dès 15 h — le lit bébé sera installé 🙂
              </p>
            </div>
          </div>
        </div>
      </div>

      <ConfirmationModal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={() => setCancelOpen(false)}
        title="Annuler la réservation ?"
        message="Le séjour du 12 au 19 août sera annulé et le guest notifié. Cette action est irréversible."
        severity="error"
        confirmText="Confirmer l'annulation"
      />
    </div>
  );
}
