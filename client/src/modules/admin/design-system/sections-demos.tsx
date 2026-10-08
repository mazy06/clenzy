import { useDemoLanguage } from './demoLanguage';
import { lazy, Suspense, useState } from 'react';
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
} from '../../../icons/glyphs';
import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts';
import { Badge, Button, Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui';
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '../../../components/ui/chart';
import PageHeader from '../../../components/baitly/PageHeader';
import TeamCard from '../../../components/baitly/TeamCard';
import AppUpdateBanner from '../../../components/baitly/AppUpdateBanner';
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
import { interventionsDemoText } from './interventionsDemoMessages';
import {
  CalendarIcon,
  ChevronDownIcon,
  DownloadIcon,
  FilterIcon,
  MapPinIcon,
  MinusIcon,
  NavigationIcon,
  RefreshCwIcon,
  SearchIcon,
} from '../../../icons/glyphs';
import mapSaudiArabia from '../../../assets/map/osm-arabian-peninsula.jpg';
import mapMorocco from '../../../assets/map/osm-morocco.jpg';
/* Vignettes dediees : les images de `assets/images` sont des PNG de 2 Mo,
   et plusieurs partagent le meme contenu — trois missions y recevaient la
   meme image. Celles-ci pesent 8 Ko et montrent trois logements distincts. */
import thumbApartment from '../../../assets/demo/stay-apartment.jpg';
import thumbVilla from '../../../assets/demo/stay-villa.jpg';
import thumbLoft from '../../../assets/demo/stay-terrace.jpg';

// This gallery-only demo uses authenticated preferences. Public projections must
// not initialize that runtime merely by importing the interventions example.
const PWAInstallBanner = lazy(() => import('../../../components/baitly/PWAInstallBanner'));

/** Une vignette et un ton par type de mission — trois logements distincts. */
const MISSION_KINDS = {
  cleaning: { thumb: thumbApartment, icon: <BrushIcon className="size-3" /> },
  maintenance: { thumb: thumbLoft, icon: <WrenchIcon className="size-3" /> },
  checkin: { thumb: thumbVilla, icon: <LogInIcon className="size-3" /> },
};

/** Le ton de la pastille suit le sens de l'etat, pas son rang. */
const MISSION_STATUS_TONES = { pending: 'warn', late: 'err', done: 'ok' } as const;

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

/**
 * Fonds de carte par marche, avec leurs marqueurs. Les positions sont
 * CALCULEES depuis les coordonnees des villes et la fenetre de tuiles de
 * chaque image — une goutte posee a vue tomberait dans la mer.
 *
 * <p>Peninsule arabique : zoom 5, x 18-21, y 12-14.
 * Maroc : zoom 7, x 60-63, y 50-52.</p>
 */
const MAPS = {
  sa: {
    image: mapSaudiArabia,
    pins: [
      { x: 53.7, y: 57.7 }, // Riyad
      { x: 37.1, y: 68.1 }, // Djeddah
      { x: 61.3, y: 52.1 }, // Dammam
      { x: 44.5, y: 78.4 }, // Abha
      { x: 38.0, y: 58.5 }, // Medine
    ],
  },
  ma: {
    image: mapMorocco,
    pins: [
      { x: 29.0, y: 71.2 }, // Marrakech
      { x: 32.5, y: 43.9 }, // Casablanca
      { x: 55.6, y: 37.4 }, // Fes
      { x: 14.7, y: 87.9 }, // Agadir
      { x: 48.4, y: 12.2 }, // Tanger
    ],
  },
};

/**
 * Le marche montre suit la langue du document : arabe et anglais pour le
 * marche d'ouverture, francais pour le Maroc — les memes couples que le jeu
 * de donnees de demonstration.
 */
function currentMap(lang: string) {
  return lang === 'fr' ? MAPS.ma : MAPS.sa;
}

/**
 * Cadre de carte. Le fond est une image de tuiles OpenStreetMap, servie en
 * local : la projection n'appelle aucun service de cartographie, ce qui lui
 * evite une cle d'API et un aller-retour reseau depuis une page marketing.
 */
function DemoMapCanvas() {
  const m = interventionsDemoText(useDemoLanguage());
  const map = currentMap(useDemoLanguage());
  return (
    <div className="relative h-full min-h-[380px] overflow-hidden rounded-xl border border-border">
      <img
        src={map.image}
        alt=""
        className="absolute inset-0 size-full object-cover"
        /* PAS de `loading="lazy"` : la projection est rendue sous un ancetre
           en `transform: scale()`, et le navigateur n'y voit jamais l'image
           entrer dans la fenetre — elle restait vide indefiniment. */
      />

      {map.pins.map((pin, index) => (
        <span
          key={index}
          data-demo-pin={index}
          className="absolute -translate-x-1/2 -translate-y-full"
          style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
        >
          <MapPinIcon weight="filled" className="size-7 text-[#2F6BE0] drop-shadow-[0_2px_3px_rgba(21,36,45,.35)]" />
        </span>
      ))}

      {/* Commandes de zoom — meme empilement que le cadre reel. */}
      <div className="absolute end-3 top-3 flex flex-col overflow-hidden rounded-md border border-border bg-card shadow-sm">
        <span className="flex size-8 items-center justify-center border-b border-border text-muted-foreground">
          <PlusIcon className="size-4" />
        </span>
        <span className="flex size-8 items-center justify-center border-b border-border text-muted-foreground">
          <MinusIcon className="size-4" />
        </span>
        <span className="flex size-8 items-center justify-center text-muted-foreground">
          <NavigationIcon className="size-3.5" />
        </span>
      </div>

      <span className="absolute bottom-1.5 start-2 rounded bg-white/75 px-1.5 py-0.5 text-[10px] text-[#3C5163]">
        {m.mapAttribution}
      </span>
    </div>
  );
}

export function BInterventionsSectionDemo() {
  const m = interventionsDemoText(useDemoLanguage());
  const [search, setSearch] = useState('');

  return (
    <div className="flex flex-col gap-3">
      {/* Le titre porte le SELECTEUR d'ecran, et la recherche est unique et
          globale — la refonte d'en-tete de l'application. */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
          <WrenchIcon className="size-4" />
        </span>
        <h2 className="m-0 text-xl font-semibold tracking-tight">{m.title}</h2>
        <span className="text-border">│</span>
        <span className="flex items-center gap-1 text-lg text-muted-foreground">
          {m.title} <ChevronDownIcon className="size-4" />
        </span>
        <div className="ms-auto flex items-center gap-1.5">
          <label className="flex h-9 w-[260px] items-center gap-2 rounded-full border border-border bg-card px-3">
            <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={m.searchOrCommand}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <kbd className="shrink-0 text-2xs text-muted-foreground">⌘K</kbd>
          </label>
          {[FilterIcon, DownloadIcon, RefreshCwIcon, PlusIcon].map((Icon, index) => (
            <span key={index} className="flex size-9 items-center justify-center rounded-lg text-muted-foreground">
              <Icon className="size-4" />
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.25fr_1fr]">
        <DemoMapCanvas />

        {/* Panneau des missions de la zone visible. */}
        <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <p className="m-0 text-sm font-semibold">
              {m.inThisZone.replace('{count}', '214')}
            </p>
          </div>
          <div className="flex flex-col divide-y divide-border">
            {m.missions.map((mission, index) => (
              <div key={mission.title} data-demo-mission={index} className="flex flex-col gap-2 p-4">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="m-0 truncate text-sm font-semibold">{mission.title}</p>
                    <p className="m-0 flex items-center gap-1 truncate text-xs text-muted-foreground">
                      {MISSION_KINDS[mission.kind].icon} {mission.subtitle}
                    </p>
                  </div>
                  <ChevronRightIcon className="cn-rtl-flip mt-0.5 size-4 shrink-0 text-muted-foreground" />
                </div>

                <div className="flex items-center gap-3">
                  <img
                    src={MISSION_KINDS[mission.kind].thumb}
                    alt=""
                    className="size-11 shrink-0 rounded-lg bg-muted object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="m-0 truncate text-xs font-medium">{mission.propertyName}</p>
                    <p className="m-0 truncate text-2xs text-muted-foreground">{mission.address}</p>
                  </div>
                  <div className="min-w-0 shrink-0 text-end">
                    <p className="m-0 text-2xs text-muted-foreground">{m.team}</p>
                    <p className="m-0 truncate text-2xs font-medium">{mission.team}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-2xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <CalendarIcon className="size-3" /> {mission.date}
                  </span>
                  <span className="flex items-center gap-1">
                    <ClockIcon className="size-3" /> {mission.slot}
                  </span>
                  <span className="ms-auto flex items-center gap-1.5">
                    <StatusChip
                      tone={MISSION_STATUS_TONES[mission.status]}
                      label={m.statusLabels[mission.status]}
                      size="sm"
                    />
                    <StatusChip
                      tone={mission.priority === 'high' ? 'warn' : 'neutral'}
                      label={m.priorityLabels[mission.priority]}
                      size="sm"
                    />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
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
  return <Suspense fallback={null}><PWAInstallBanner forceVisible /></Suspense>;
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
                <span className={cn('text-2xs font-medium whitespace-nowrap', step.state === 'current' ? 'text-warning-ink' : 'text-foreground')}>
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
            <div className="flex justify-between text-success-ink">
              <span>Acompte reçu (3 juil.)</span>
              <span className="tabular-nums">−<Money value={372} decimals={0} /></span>
            </div>
            <div className="flex justify-between font-semibold text-warning-ink">
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
