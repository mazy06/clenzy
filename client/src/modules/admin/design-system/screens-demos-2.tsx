import { useState } from 'react';
import {
  BadgePercentIcon,
  BanknoteIcon,
  BarChart3Icon,
  BuildingIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DownloadIcon,
  FileTextIcon,
  InfoIcon,
  LinkIcon,
  RocketIcon,
  ShieldCheckIcon,
  TagIcon,
  TrendingDownIcon,
  TrendingUpIcon,
} from 'lucide-react';
import { Area, AreaChart, CartesianGrid, Pie, PieChart, XAxis } from 'recharts';
import type { DateRange } from 'react-day-picker';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Calendar,
  CalendarDayButton,
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  Input,
  Progress,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../components/ui';
import PageHeader from '../../../components/baitly/PageHeader';
import StatTile from '../../../components/baitly/StatTile';
import StatusChip from '../../../components/baitly/StatusChip';
import PeriodSegmented from '../../../components/baitly/PeriodSegmented';
import ExportButton from '../../../components/baitly/ExportButton';
import { Money } from '../../../components/baitly/Money';
import { cn } from '../../../utils/cn';

/**
 * Projections d'écrans PMS (vague 6, enrichies) — galerie uniquement.
 */

// ─── Section — Tarification ──────────────────────────────────────────────────

export function BPricingSectionDemo() {
  const [range, setRange] = useState<DateRange | undefined>();
  const hasSelection = !!(range?.from && range?.to);
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Tarification — Riad Yasmine"
        subtitle="Prix de base 80 € · week-end 120 € · 2 saisons actives"
        iconBadge={<TagIcon />}
        showBackButton={false}
        className="mb-0"
        actions={
          <Button size="sm" variant="outline">
            Règles de yield
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile icon={<TrendingUpIcon />} label="ADR (30 j)" value={<Money value={94} decimals={0} />} hint={<><b>+6 €</b> vs mois précédent</>} />
        <StatTile icon={<BanknoteIcon />} label="Prix plancher" value={<Money value={68} decimals={0} />} hint="jamais franchi par le yield" />
        <StatTile icon={<TagIcon />} label="Séjour minimum" value="2" unit="nuits" hint="3 nuits en haute saison" />
      </div>

      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[auto_1fr]">
        <div className="flex flex-col gap-2">
          <Calendar
            mode="range"
            selected={range}
            onSelect={setRange}
            numberOfMonths={1}
            className="rounded-lg border shadow-sm [--cell-size:2.75rem]"
            formatters={{
              formatMonthDropdown: (date) => date.toLocaleString('fr-FR', { month: 'long' }),
            }}
            components={{
              DayButton: ({ children, modifiers, day, ...props }) => {
                const isWeekend = day.date.getDay() === 0 || day.date.getDay() === 6;
                return (
                  <CalendarDayButton day={day} modifiers={modifiers} {...props}>
                    {children}
                    {!modifiers.outside && <span>{isWeekend ? '120 €' : '80 €'}</span>}
                  </CalendarDayButton>
                );
              },
            }}
          />
          {hasSelection ? (
            <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary-soft p-2">
              <span className="flex-1 text-xs text-foreground">
                {range?.from?.toLocaleDateString('fr-FR')} → {range?.to?.toLocaleDateString('fr-FR')}
              </span>
              <Input className="h-8 w-24" placeholder="Prix (€)" />
              <Button size="sm">Appliquer</Button>
            </div>
          ) : (
            <p className="m-0 text-xs text-muted-foreground">
              Sélectionne une plage pour poser un override de prix.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="m-0 mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Saisons
            </h3>
            <div className="flex flex-col gap-2">
              {[
                { name: 'Haute saison été', dates: '1 juil. → 31 août', price: 140, tone: 'warn' as const },
                { name: 'Fêtes de fin d\'année', dates: '20 déc. → 5 janv.', price: 160, tone: 'accent' as const },
              ].map((season) => (
                <div key={season.name} className="flex items-center gap-3 rounded-lg border border-border p-2.5">
                  <StatusChip tone={season.tone} label={season.name} size="sm" />
                  <span className="flex-1 text-xs text-muted-foreground">{season.dates}</span>
                  <span className="text-sm font-semibold text-foreground tabular-nums">
                    <Money value={season.price} decimals={0} />
                    <span className="font-normal text-muted-foreground"> /nuit</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="m-0 mb-3 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              <BadgePercentIcon className="size-3.5" /> Promotions actives
            </h3>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3 rounded-lg border border-border p-2.5">
                <Badge variant="success">−15 %</Badge>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium text-foreground">Early bird — réservation à J-60</div>
                  <div className="text-2xs text-muted-foreground">Tous canaux · 12 réservations générées</div>
                </div>
                <Switch defaultChecked aria-label="Early bird" />
              </div>
              <div className="flex items-center gap-3 rounded-lg border border-border p-2.5">
                <Badge variant="success">−10 %</Badge>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium text-foreground">Long séjour — 7 nuits et plus</div>
                  <div className="text-2xs text-muted-foreground">Direct uniquement · 4 réservations générées</div>
                </div>
                <Switch defaultChecked aria-label="Long séjour" />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="m-0 mb-3 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              <TrendingUpIcon className="size-3.5" /> Yield automatique
            </h3>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm">
                  <div className="font-medium text-foreground">Baisse dernière minute</div>
                  <div className="text-xs text-muted-foreground">−15 % si invendu à J-3 · plancher 68 € respecté</div>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm">
                  <div className="font-medium text-foreground">Hausse forte demande</div>
                  <div className="text-xs text-muted-foreground">+10 % si occupation &gt; 85 % · cooldown 14 j</div>
                </div>
                <Switch />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Section — Rapports ──────────────────────────────────────────────────────

const REPORT_OCCUPANCY = [
  { month: 'Février', occupancy: 46 },
  { month: 'Mars', occupancy: 58 },
  { month: 'Avril', occupancy: 64 },
  { month: 'Mai', occupancy: 61 },
  { month: 'Juin', occupancy: 72 },
  { month: 'Juillet', occupancy: 84 },
];

const REPORT_OCCUPANCY_CONFIG = {
  occupancy: { label: 'Occupation', color: 'var(--bui-chart-1)' },
} satisfies ChartConfig;

const REPORT_CHANNELS_CONFIG = {
  reservations: { label: 'Réservations' },
  airbnb: { label: 'Airbnb', color: 'var(--bui-chart-2)' },
  direct: { label: 'Direct', color: 'var(--bui-chart-1)' },
  booking: { label: 'Booking', color: 'var(--bui-chart-3)' },
} satisfies ChartConfig;

const REPORT_CHANNELS = [
  { channel: 'airbnb', reservations: 124, fill: 'var(--color-airbnb)' },
  { channel: 'direct', reservations: 86, fill: 'var(--color-direct)' },
  { channel: 'booking', reservations: 97, fill: 'var(--color-booking)' },
];

const REPORT_ROWS = [
  { property: 'Riad Yasmine', nights: 186, occupancy: '84 %', adr: 118, revenue: 21948 },
  { property: 'Duplex Guéliz', nights: 142, occupancy: '71 %', adr: 64, revenue: 9088 },
  { property: 'Villa Palmeraie', nights: 98, occupancy: '54 %', adr: 210, revenue: 20580 },
];

export function BReportsSectionDemo() {
  const [period, setPeriod] = useState('6m');
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Rapports"
        subtitle="Performance du portefeuille"
        iconBadge={<BarChart3Icon />}
        showBackButton={false}
        className="mb-0"
        actions={
          <>
            <PeriodSegmented
              value={period}
              onChange={setPeriod}
              options={[
                { value: '3m', label: '3 mois' },
                { value: '6m', label: '6 mois' },
                { value: '12m', label: '12 mois' },
              ]}
            />
            <ExportButton
              data={REPORT_ROWS}
              columns={[
                { key: 'property', label: 'Logement' },
                { key: 'nights', label: 'Nuits' },
                { key: 'revenue', label: 'Revenus' },
              ]}
              fileName="rapport-performance"
              variant="icon"
            />
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={<BarChart3Icon />} label="RevPAR" value={<Money value={99} decimals={0} />} hint={<><b>+11 %</b> vs période préc.</>} />
        <StatTile icon={<TrendingUpIcon />} label="ADR" value={<Money value={121} decimals={0} />} hint={<><b>+4 €</b> vs période préc.</>} />
        <StatTile icon={<BanknoteIcon />} label="Revenus" value={<Money value={51616} decimals={0} />} iconClassName="text-success" hint="6 derniers mois" />
        <StatTile icon={<TrendingDownIcon />} label="Taux d'annulation" value="4,2" unit="%" iconClassName="text-warning" hint="13 annulations sur 307" />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex items-center gap-3 rounded-xl border border-success/30 bg-success-soft/40 p-3">
          <span className="inline-flex size-9 items-center justify-center rounded-lg bg-success-soft text-success">
            <TrendingUpIcon className="size-4" />
          </span>
          <div className="min-w-0 text-sm">
            <div className="font-semibold text-foreground">Meilleure progression : Riad Yasmine</div>
            <div className="text-xs text-muted-foreground">+18 % de RevPAR — porté par le yield week-end</div>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-warning/30 bg-warning-soft/40 p-3">
          <span className="inline-flex size-9 items-center justify-center rounded-lg bg-warning-soft text-warning">
            <TrendingDownIcon className="size-4" />
          </span>
          <div className="min-w-0 text-sm">
            <div className="font-semibold text-foreground">À surveiller : Villa Palmeraie</div>
            <div className="text-xs text-muted-foreground">54 % d'occupation — envisager une baisse ciblée en semaine</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="m-0 mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Taux d'occupation
          </h3>
          <ChartContainer config={REPORT_OCCUPANCY_CONFIG} className="h-48 w-full">
            <AreaChart accessibilityLayer data={REPORT_OCCUPANCY} margin={{ left: 12, right: 12 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(value: string) => value.slice(0, 3)}
              />
              <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
              <Area
                dataKey="occupancy"
                type="natural"
                fill="var(--color-occupancy)"
                fillOpacity={0.4}
                stroke="var(--color-occupancy)"
              />
            </AreaChart>
          </ChartContainer>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="m-0 mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Réservations par canal
          </h3>
          <ChartContainer config={REPORT_CHANNELS_CONFIG} className="mx-auto aspect-square max-h-48">
            <PieChart>
              <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
              <Pie data={REPORT_CHANNELS} dataKey="reservations" nameKey="channel" innerRadius={48} />
            </PieChart>
          </ChartContainer>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Logement</TableHead>
            <TableHead className="text-end">Nuits vendues</TableHead>
            <TableHead className="text-end">Occupation</TableHead>
            <TableHead className="text-end">ADR</TableHead>
            <TableHead className="text-end">Revenus</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {REPORT_ROWS.map((row) => (
            <TableRow key={row.property}>
              <TableCell className="font-medium">{row.property}</TableCell>
              <TableCell className="text-end tabular-nums">{row.nights}</TableCell>
              <TableCell className="text-end tabular-nums">{row.occupancy}</TableCell>
              <TableCell className="text-end tabular-nums">
                <Money value={row.adr} decimals={0} />
              </TableCell>
              <TableCell className="text-end tabular-nums">
                <Money value={row.revenue} decimals={0} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={4}>Total portefeuille</TableCell>
            <TableCell className="text-end font-semibold tabular-nums">
              <Money value={51616} decimals={0} />
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
}

// ─── Section — Onboarding (wizard) ───────────────────────────────────────────

const WIZARD_STEPS = ['Organisation', 'Premier logement', 'Canaux'];

export function BOnboardingSectionDemo() {
  const [step, setStep] = useState(0);
  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_260px]">
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Bienvenue sur Baitly"
          subtitle="3 étapes pour mettre votre premier logement en ligne"
          iconBadge={<RocketIcon />}
          showBackButton={false}
          className="mb-0"
        />
        <div className="flex flex-col gap-2">
          <div className="flex items-center">
            {WIZARD_STEPS.map((label, index) => (
              <div key={label} className={cn('flex items-center', index > 0 && 'flex-1')}>
                {index > 0 && (
                  <div className={cn('h-px flex-1', index <= step ? 'bg-primary' : 'bg-border')} />
                )}
                <div className="flex items-center gap-2 px-2">
                  <span
                    className={cn(
                      'inline-flex size-6 items-center justify-center rounded-full text-xs font-semibold',
                      index < step && 'bg-primary text-primary-foreground',
                      index === step && 'bg-primary text-primary-foreground ring-4 ring-primary/20',
                      index > step && 'bg-muted text-muted-foreground'
                    )}
                  >
                    {index < step ? <CheckIcon className="size-3.5" /> : index + 1}
                  </span>
                  <span
                    className={cn(
                      'text-xs font-medium whitespace-nowrap',
                      index === step ? 'text-foreground' : 'text-muted-foreground'
                    )}
                  >
                    {label}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <Progress value={((step + 1) / WIZARD_STEPS.length) * 100} />
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          {step === 0 && (
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="ob-org">Nom de votre conciergerie</FieldLabel>
                <Input id="ob-org" placeholder="Ex. Médina Stays" />
              </Field>
              <Field>
                <FieldLabel htmlFor="ob-city">Ville principale</FieldLabel>
                <Input id="ob-city" placeholder="Marrakech" />
                <FieldDescription>Sert à préconfigurer fuseau, devise et taxes.</FieldDescription>
              </Field>
            </FieldGroup>
          )}
          {step === 1 && (
            <div className="flex flex-col gap-4">
              <Alert>
                <InfoIcon />
                <AlertTitle>Gagnez du temps</AlertTitle>
                <AlertDescription>
                  Importez votre annonce Airbnb : photos, description et tarifs seront préremplis.
                </AlertDescription>
              </Alert>
              <Button size="sm" variant="outline" className="self-start">
                <LinkIcon /> Importer depuis Airbnb
              </Button>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="ob-prop">Nom du logement</FieldLabel>
                  <Input id="ob-prop" placeholder="Riad Yasmine" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="ob-price">Prix de base par nuit (€)</FieldLabel>
                  <Input id="ob-price" placeholder="80" />
                </Field>
              </FieldGroup>
            </div>
          )}
          {step === 2 && (
            <div className="flex flex-col gap-2.5">
              {[
                { name: 'Airbnb', color: '#FF5A5F', connected: true },
                { name: 'Booking.com', color: '#003580', connected: false },
                { name: 'Vrbo', color: '#14B8A6', connected: false },
              ].map((channel) => (
                <div key={channel.name} className="flex items-center gap-3 rounded-lg border border-border p-3">
                  <StatusChip color={channel.color} label={channel.name} dot />
                  <span className="flex-1" />
                  {channel.connected ? (
                    <Badge variant="success">Connecté</Badge>
                  ) : (
                    <Button size="xs" variant="outline">
                      <LinkIcon /> Connecter
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            disabled={step === 0}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
          >
            <ChevronLeftIcon className="cn-rtl-flip" /> Précédent
          </Button>
          {step < WIZARD_STEPS.length - 1 ? (
            <Button size="sm" onClick={() => setStep((s) => Math.min(WIZARD_STEPS.length - 1, s + 1))}>
              Suivant <ChevronRightIcon className="cn-rtl-flip" />
            </Button>
          ) : (
            <Button size="sm">
              <RocketIcon /> Lancer mon PMS
            </Button>
          )}
        </div>
      </div>

      {/* Checklist de setup */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="m-0 mb-3 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          <ShieldCheckIcon className="size-3.5" /> Pour être 100 % prêt
        </h3>
        <div className="flex flex-col gap-2.5">
          {[
            { label: 'Créer votre organisation', done: step > 0 },
            { label: 'Ajouter un logement', done: step > 1 },
            { label: 'Connecter un canal', done: false },
            { label: 'Configurer les paiements', done: false },
            { label: 'Inviter votre équipe ménage', done: false },
          ].map((task) => (
            <div key={task.label} className="flex items-center gap-2 text-xs">
              <span
                className={cn(
                  'inline-flex size-4 items-center justify-center rounded-full',
                  task.done ? 'bg-success text-white' : 'border border-border text-transparent'
                )}
              >
                <CheckIcon className="size-2.5" />
              </span>
              <span className={task.done ? 'text-muted-foreground line-through' : 'text-foreground'}>
                {task.label}
              </span>
            </div>
          ))}
        </div>
        <p className="m-0 mt-3 text-2xs text-muted-foreground">
          Vous pourrez terminer ces étapes plus tard depuis Paramètres.
        </p>
      </div>
    </div>
  );
}

// ─── Section — Portail propriétaire ──────────────────────────────────────────

const OWNER_PAYOUTS = [
  { period: 'Juillet 2026', gross: 8420, commission: 1684, net: 6736, status: 'warn' as const, statusLabel: 'À verser' },
  { period: 'Juin 2026', gross: 6180, commission: 1236, net: 4944, status: 'ok' as const, statusLabel: 'Versé' },
  { period: 'Mai 2026', gross: 5730, commission: 1146, net: 4584, status: 'ok' as const, statusLabel: 'Versé' },
];

const OWNER_REVENUE_CONFIG = {
  net: { label: 'Net propriétaire', color: 'var(--bui-chart-2)' },
} satisfies ChartConfig;

const OWNER_REVENUE_DATA = [
  { month: 'Février', net: 3120 },
  { month: 'Mars', net: 3980 },
  { month: 'Avril', net: 4390 },
  { month: 'Mai', net: 4584 },
  { month: 'Juin', net: 4944 },
  { month: 'Juillet', net: 6736 },
];

export function BOwnerPortalSectionDemo() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Espace propriétaire"
        subtitle="Villa Palmeraie · M. Alaoui"
        iconBadge={<BuildingIcon />}
        showBackButton={false}
        className="mb-0"
      />
      <Alert className="max-w-2xl">
        <InfoIcon />
        <AlertTitle>Relevé de juillet disponible</AlertTitle>
        <AlertDescription>
          Le versement de 6 736 € sera effectué le 5 août sur votre compte se terminant par 4412.
        </AlertDescription>
      </Alert>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile
          icon={<BanknoteIcon />}
          label="Net à verser (juillet)"
          value={<Money value={6736} decimals={0} />}
          iconClassName="text-success"
        />
        <StatTile icon={<BarChart3Icon />} label="Occupation (juillet)" value="78" unit="%" />
        <StatTile
          icon={<TrendingUpIcon />}
          label="Revenus 12 mois"
          value={<Money value={61240} decimals={0} />}
          hint={<><b>+12 %</b> vs année précédente</>}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="m-0 mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Net propriétaire — 6 derniers mois
          </h3>
          <ChartContainer config={OWNER_REVENUE_CONFIG} className="h-44 w-full">
            <AreaChart accessibilityLayer data={OWNER_REVENUE_DATA} margin={{ left: 12, right: 12 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(value: string) => value.slice(0, 3)}
              />
              <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
              <Area dataKey="net" type="natural" fill="var(--color-net)" fillOpacity={0.4} stroke="var(--color-net)" />
            </AreaChart>
          </ChartContainer>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="m-0 mb-3 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            <FileTextIcon className="size-3.5" /> Relevés mensuels
          </h3>
          <div className="flex flex-col gap-2">
            {['Relevé juillet 2026', 'Relevé juin 2026', 'Relevé mai 2026'].map((statement) => (
              <div key={statement} className="flex items-center gap-2.5 rounded-lg border border-border p-2.5">
                <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">{statement}</span>
                <Button size="icon-xs" variant="ghost" aria-label={`Télécharger ${statement}`}>
                  <DownloadIcon />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Période</TableHead>
            <TableHead className="text-end">Brut</TableHead>
            <TableHead className="text-end">Commission (20 %)</TableHead>
            <TableHead className="text-end">Net propriétaire</TableHead>
            <TableHead>Statut</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {OWNER_PAYOUTS.map((payout) => (
            <TableRow key={payout.period}>
              <TableCell className="font-medium">{payout.period}</TableCell>
              <TableCell className="text-end tabular-nums">
                <Money value={payout.gross} decimals={0} />
              </TableCell>
              <TableCell className="text-end text-muted-foreground tabular-nums">
                −<Money value={payout.commission} decimals={0} />
              </TableCell>
              <TableCell className="text-end font-semibold tabular-nums">
                <Money value={payout.net} decimals={0} />
              </TableCell>
              <TableCell>
                <StatusChip tone={payout.status} label={payout.statusLabel} dot size="sm" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
