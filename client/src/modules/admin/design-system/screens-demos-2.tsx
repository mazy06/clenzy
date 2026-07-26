import { useState, type ReactNode } from 'react';
import {
  BadgePercentIcon,
  BanknoteIcon,
  BarChart3Icon,
  BotIcon,
  BuildingIcon,
  CameraIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DownloadIcon,
  FileSignatureIcon,
  FileTextIcon,
  GlobeIcon,
  InfoIcon,
  LandmarkIcon,
  LinkIcon,
  MapPinIcon,
  MessageCircleIcon,
  PuzzleIcon,
  RocketIcon,
  ScaleIcon,
  ShieldCheckIcon,
  TagIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  UploadIcon,
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
  NativeSelect,
  NativeSelectOption,
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
// Étapes calquées sur le vrai parcours (config/onboardingConfig.ts : org, fiscal,
// paiement, intégrations…) + besoins métier : légal entreprise (mentions factures
// NF/CGI), profil fiscal (fiscalProfileApi), taxe de séjour communale
// (TouristTaxSection), encaissement par pays (Stripe absent au Maroc → CMI),
// versements (PayoutMethodEditDialog : Open Banking / SEPA / Wise), contrat de
// gestion (4 modèles d'encaissement + e-signature) et étape Add-ons (contenu à
// arbitrer plus tard — facturés en supplément).

/* Bifurcation « Démarrage » : partir de zéro OU importer l'existant (étude
   analyse-concurrentielle/43-import-migration-pms.md — 4 canaux d'import :
   exports natifs OTA, preset PMS, connexion API, Excel générique). */
const WIZARD_STEP_LABELS: Record<string, string> = {
  start: 'Démarrage',
  import: 'Import',
  org: 'Organisation',
  company: 'Entreprise',
  fiscal: 'Fiscalité',
  property: 'Logement & taxes',
  payments: 'Encaissements',
  contract: 'Contrat',
  team: 'Équipe',
  channels: 'Canaux',
  notifications: 'Notifications',
  addons: 'Add-ons',
};

const IMPORT_PMS_PRESETS = [
  'Superhote',
  'Smoobu',
  'Guesty',
  'Hostaway',
  'Beds24',
  'OwnerRez',
  'Hospitable',
  'Lodgify',
  'Smily (BookingSync)',
  'Amenitiz',
  'Elloha',
  'Autre…',
];

/** Carte-option sélectionnable (provider de paiement, modèle de contrat…). */
function ChoiceCard({
  title,
  description,
  selected,
  disabled,
  badge,
  onClick,
}: {
  title: string;
  description: string;
  selected?: boolean;
  disabled?: boolean;
  badge?: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex flex-col gap-1 rounded-lg border p-3 text-start transition-colors',
        selected ? 'border-primary bg-primary-soft' : 'border-border hover:border-primary/40',
        disabled && 'cursor-not-allowed opacity-55 hover:border-border',
      )}
    >
      <span className="flex w-full items-center gap-2">
        <span
          className={cn(
            'inline-flex size-3.5 shrink-0 items-center justify-center rounded-full border',
            selected ? 'border-primary bg-primary' : 'border-input',
          )}
        >
          {selected && <span className="size-1.5 rounded-full bg-primary-foreground" />}
        </span>
        <span className="text-sm font-medium">{title}</span>
        <span className="ms-auto">{badge}</span>
      </span>
      <span className="ps-5.5 text-xs leading-snug text-muted-foreground">{description}</span>
    </button>
  );
}

const ADDONS = [
  { icon: BotIcon, title: 'Assistant IA avancé', description: 'Agents autonomes, vision, crédits IA étendus.' },
  { icon: CameraIcon, title: 'Objets connectés', description: 'Vidéosurveillance, serrures, capteurs de bruit.' },
  { icon: GlobeIcon, title: 'Site de réservation', description: 'Booking engine + galerie de templates + domaine.' },
  { icon: MessageCircleIcon, title: 'Messagerie WhatsApp', description: 'Conversations et alertes via l’API Meta.' },
  { icon: TrendingUpIcon, title: 'Yield automatique', description: 'Ajustements tarifaires pilotés par les agents.' },
  { icon: BarChart3Icon, title: 'Market data', description: 'Comps de marché et benchmarks concurrentiels.' },
];

export function BOnboardingSectionDemo() {
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<'scratch' | 'migrate'>('scratch');
  const [importSource, setImportSource] = useState<'ota' | 'pms' | 'api' | 'excel'>('ota');
  const [vatRegistered, setVatRegistered] = useState(true);
  const [payoutMethod, setPayoutMethod] = useState<'open-banking' | 'sepa' | 'wise'>('open-banking');
  const [pspProvider, setPspProvider] = useState<'payzone' | 'youcan' | 'stripe'>('payzone');
  const [contractModel, setContractModel] = useState('CONCIERGE_COLLECTS');
  const steps = [
    'start',
    ...(mode === 'migrate' ? ['import'] : []),
    'org',
    'company',
    'fiscal',
    'property',
    'payments',
    'contract',
    'team',
    'channels',
    'notifications',
    'addons',
  ];
  const current = steps[Math.min(step, steps.length - 1)];
  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_270px]">
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Bienvenue sur Baitly"
          subtitle={`${steps.length} étapes pour encaisser votre première réservation en toute conformité`}
          iconBadge={<RocketIcon />}
          showBackButton={false}
          className="mb-0"
        />
        <div className="flex flex-col gap-2">
          <div className="flex items-center">
            {steps.map((key, index) => (
              <div key={key} className={cn('flex items-center', index > 0 && 'flex-1')}>
                {index > 0 && (
                  <div className={cn('h-px flex-1', index <= step ? 'bg-primary' : 'bg-border')} />
                )}
                {/* Ligne allégée : numéros seuls, le libellé n'apparaît que sur
                    l'étape active (title natif au survol pour les autres). */}
                <button
                  type="button"
                  onClick={() => setStep(index)}
                  title={WIZARD_STEP_LABELS[key]}
                  className="flex items-center gap-1.5 px-1"
                >
                  <span
                    className={cn(
                      'inline-flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors',
                      index < step && 'bg-primary/15 text-primary',
                      index === step && 'bg-primary text-primary-foreground ring-4 ring-primary/20',
                      index > step && 'bg-muted text-muted-foreground'
                    )}
                  >
                    {index < step ? <CheckIcon className="size-3.5" /> : index + 1}
                  </span>
                  {index === step && (
                    <span className="text-xs font-medium whitespace-nowrap text-foreground">
                      {WIZARD_STEP_LABELS[key]}
                    </span>
                  )}
                </button>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <Progress className="flex-1" value={((step + 1) / steps.length) * 100} />
            <span className="text-xs whitespace-nowrap text-muted-foreground tabular-nums">
              Étape {step + 1}/{steps.length}
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          {current === 'start' && (
            <div className="flex flex-col gap-3">
              <h4 className="m-0 text-sm font-semibold">Comment démarrez-vous ?</h4>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <ChoiceCard
                  title="Je pars de zéro"
                  description="Première mise en gestion : nous configurons tout pas à pas, votre premier logement est en ligne en quelques minutes."
                  selected={mode === 'scratch'}
                  onClick={() => setMode('scratch')}
                />
                <ChoiceCard
                  title="J'ai déjà un historique à récupérer"
                  description="Vous venez d'un autre PMS ou gérez via les extranets Airbnb/Booking + Excel : importez logements, réservations passées et voyageurs avant de configurer."
                  selected={mode === 'migrate'}
                  badge={<Badge variant="info">Recommandé si vous migrez</Badge>}
                  onClick={() => setMode('migrate')}
                />
              </div>
              {mode === 'migrate' && (
                <Alert>
                  <InfoIcon />
                  <AlertTitle>Exportez avant de résilier votre ancien outil</AlertTitle>
                  <AlertDescription>
                    Aucun PMS ne fournit vos données après la coupure d'accès. Nous vous donnons la
                    checklist d'export exacte pour votre outil à l'étape suivante.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {current === 'import' && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <h4 className="m-0 text-sm font-semibold">D'où viennent vos données ?</h4>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <ChoiceCard
                    title="Extranets Airbnb / Booking.com"
                    description="CSV « Historique des transactions » Airbnb et XLS « Réservations » Booking, tels quels — colonnes reconnues automatiquement."
                    selected={importSource === 'ota'}
                    badge={<Badge variant="success">Le plus courant</Badge>}
                    onClick={() => setImportSource('ota')}
                  />
                  <ChoiceCard
                    title="Export d'un PMS concurrent"
                    description="Fichier réservations exporté de votre ancien outil, mapping de colonnes pré-câblé par PMS."
                    selected={importSource === 'pms'}
                    onClick={() => setImportSource('pms')}
                  />
                  <ChoiceCard
                    title="Connexion API directe"
                    description="Beds24, OwnerRez, Smoobu, Hostaway, iGMS, Tokeet, Smily : saisissez votre clé API, on récupère tout."
                    selected={importSource === 'api'}
                    onClick={() => setImportSource('api')}
                  />
                  <ChoiceCard
                    title="Tableur Excel / Google Sheets"
                    description="Votre suivi maison : téléchargez notre modèle ou uploadez votre fichier et mappez les colonnes."
                    selected={importSource === 'excel'}
                    onClick={() => setImportSource('excel')}
                  />
                </div>
              </div>

              {importSource === 'pms' && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="ob-import-pms">Votre ancien PMS</FieldLabel>
                    <NativeSelect id="ob-import-pms" defaultValue="Superhote">
                      {IMPORT_PMS_PRESETS.map((pms) => (
                        <NativeSelectOption key={pms} value={pms}>
                          {pms}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                    <FieldDescription>
                      Guide « où cliquer pour exporter » fourni pour chaque outil — certains envoient
                      le fichier par email (Superhote, Guesty…).
                    </FieldDescription>
                  </Field>
                </div>
              )}
              {importSource === 'api' && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="ob-import-api-pms">PMS connecté</FieldLabel>
                    <NativeSelect id="ob-import-api-pms" defaultValue="Beds24">
                      {['Beds24', 'OwnerRez', 'Smoobu', 'Hostaway', 'iGMS', 'Tokeet', 'Smily (BookingSync)'].map((pms) => (
                        <NativeSelectOption key={pms} value={pms}>
                          {pms}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="ob-import-key">Clé API</FieldLabel>
                    <Input id="ob-import-key" placeholder="Collez la clé générée dans votre PMS" />
                  </Field>
                </div>
              )}

              {importSource !== 'api' && (
                <button
                  type="button"
                  className="flex flex-col items-center gap-1.5 rounded-lg border border-dashed border-input p-6 text-center transition-colors hover:border-primary/50"
                >
                  <UploadIcon className="size-5 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    Déposez vos fichiers ici (CSV, XLS, XLSX)
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {importSource === 'ota'
                      ? 'Airbnb : Historique des transactions · Booking : Réservations + Relevés de réservations'
                      : importSource === 'excel'
                        ? 'Ou téléchargez d’abord le modèle Baitly (colonnes : logement, voyageur, dates, canal, montant)'
                        : 'Le fichier reçu par email de votre ancien PMS fonctionne tel quel'}
                  </span>
                </button>
              )}

              {/* Aperçu simulé du résultat d'import */}
              <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
                <p className="m-0 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Aperçu de l'import
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">3 logements</Badge>
                  <Badge variant="secondary">412 réservations · 2023 → 2026</Badge>
                  <Badge variant="secondary">287 voyageurs</Badge>
                  <Badge variant="warning">12 doublons ignorés (code de confirmation)</Badge>
                </div>
                <p className="m-0 text-xs text-muted-foreground">
                  Les données importées ne déclenchent aucune automatisation (messages, frais,
                  facturation). Votre historique alimente immédiatement les rapports et le yield.
                </p>
              </div>

              <Alert>
                <InfoIcon />
                <AlertTitle>Ce qui ne peut pas être importé</AlertTitle>
                <AlertDescription>
                  Historique de messages et avis (aucun outil ne les exporte) ; les emails voyageurs
                  OTA sont des alias. Vos réservations futures arriveront automatiquement à la
                  connexion des canaux (étape Canaux), avis et note conservés.
                </AlertDescription>
              </Alert>
            </div>
          )}

          {current === 'org' && (
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="ob-org">Nom de votre conciergerie</FieldLabel>
                <Input id="ob-org" placeholder="Ex. Médina Stays" />
              </Field>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field>
                  <FieldLabel htmlFor="ob-country">Pays d'exploitation</FieldLabel>
                  <NativeSelect id="ob-country" defaultValue="MA">
                    <NativeSelectOption value="MA">Maroc</NativeSelectOption>
                    <NativeSelectOption value="FR">France</NativeSelectOption>
                    <NativeSelectOption value="AE">Émirats arabes unis</NativeSelectOption>
                    <NativeSelectOption value="SA">Arabie saoudite</NativeSelectOption>
                  </NativeSelect>
                </Field>
                <Field>
                  <FieldLabel htmlFor="ob-city">Ville principale</FieldLabel>
                  <Input id="ob-city" placeholder="Marrakech" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="ob-currency">Devise</FieldLabel>
                  <NativeSelect id="ob-currency" defaultValue="MAD">
                    <NativeSelectOption value="MAD">MAD — dirham</NativeSelectOption>
                    <NativeSelectOption value="EUR">EUR — euro</NativeSelectOption>
                    <NativeSelectOption value="USD">USD — dollar</NativeSelectOption>
                  </NativeSelect>
                </Field>
              </div>
              <FieldDescription>
                Le pays et la ville préconfigurent fuseau horaire, devise, provider d'encaissement et
                barème de taxe de séjour.
              </FieldDescription>
            </FieldGroup>
          )}

          {current === 'company' && (
            <FieldGroup>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="ob-legal-name">Raison sociale</FieldLabel>
                  <Input id="ob-legal-name" placeholder="Médina Stays SARL" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="ob-legal-form">Forme juridique</FieldLabel>
                  <NativeSelect id="ob-legal-form" defaultValue="SARL">
                    <NativeSelectOption value="SARL">SARL</NativeSelectOption>
                    <NativeSelectOption value="SARL_AU">SARL AU</NativeSelectOption>
                    <NativeSelectOption value="SAS">SAS</NativeSelectOption>
                    <NativeSelectOption value="AUTO">Auto-entrepreneur</NativeSelectOption>
                  </NativeSelect>
                </Field>
                <Field>
                  <FieldLabel htmlFor="ob-ice">ICE (identifiant commun de l'entreprise)</FieldLabel>
                  <Input id="ob-ice" placeholder="0015 6398 4000 012" />
                  <FieldDescription>SIRET pour une société française.</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="ob-rc">Registre de commerce (RC)</FieldLabel>
                  <Input id="ob-rc" placeholder="RC 123456 — Marrakech" />
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="ob-hq">Adresse du siège social</FieldLabel>
                <Input id="ob-hq" placeholder="12 rue Ibn Toumert, Guéliz, Marrakech" />
              </Field>
              <Field>
                <FieldLabel htmlFor="ob-rep">Représentant légal</FieldLabel>
                <Input id="ob-rep" placeholder="Nom et prénom du gérant" />
              </Field>
              <Alert>
                <ScaleIcon />
                <AlertTitle>Mentions légales des factures</AlertTitle>
                <AlertDescription>
                  Ces informations figurent sur vos factures et contrats (conformité NF / CGI). Elles
                  restent modifiables dans Paramètres → Organisation.
                </AlertDescription>
              </Alert>
            </FieldGroup>
          )}

          {current === 'fiscal' && (
            <FieldGroup>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="ob-regime">Régime fiscal</FieldLabel>
                  <NativeSelect id="ob-regime" defaultValue="STANDARD">
                    <NativeSelectOption value="STANDARD">Réel standard</NativeSelectOption>
                    <NativeSelectOption value="MICRO_ENTERPRISE">Micro-entreprise</NativeSelectOption>
                    <NativeSelectOption value="SIMPLIFIED">Réel simplifié</NativeSelectOption>
                  </NativeSelect>
                </Field>
                <Field>
                  <FieldLabel htmlFor="ob-taxid">Identifiant fiscal (IF)</FieldLabel>
                  <Input id="ob-taxid" placeholder="45678912" />
                </Field>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="m-0 text-sm font-medium">Assujetti à la TVA</p>
                  <p className="m-0 text-xs text-muted-foreground">
                    Active la TVA sur les factures et le suivi déclaratif.
                  </p>
                </div>
                <Switch checked={vatRegistered} onCheckedChange={setVatRegistered} />
              </div>
              {vatRegistered && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="ob-vat">Numéro de TVA</FieldLabel>
                    <Input id="ob-vat" placeholder="MA-TVA-889924" />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="ob-vat-freq">Fréquence de déclaration</FieldLabel>
                    <NativeSelect id="ob-vat-freq" defaultValue="QUARTERLY">
                      <NativeSelectOption value="MONTHLY">Mensuelle</NativeSelectOption>
                      <NativeSelectOption value="QUARTERLY">Trimestrielle</NativeSelectOption>
                    </NativeSelect>
                  </Field>
                </div>
              )}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="ob-prefix">Préfixe de facturation</FieldLabel>
                  <Input id="ob-prefix" placeholder="FA" defaultValue="FA" />
                  <FieldDescription>Numérotation séquentielle inaltérable (NF).</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="ob-inv-lang">Langue des factures</FieldLabel>
                  <NativeSelect id="ob-inv-lang" defaultValue="fr">
                    <NativeSelectOption value="fr">Français</NativeSelectOption>
                    <NativeSelectOption value="en">Anglais</NativeSelectOption>
                    <NativeSelectOption value="ar">Arabe</NativeSelectOption>
                  </NativeSelect>
                </Field>
              </div>
            </FieldGroup>
          )}

          {current === 'property' && (
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
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="ob-prop">Nom du logement</FieldLabel>
                    <Input id="ob-prop" placeholder="Riad Yasmine" />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="ob-price">Prix de base par nuit</FieldLabel>
                    <Input id="ob-price" placeholder="800 MAD" />
                  </Field>
                </div>
                <Field>
                  <FieldLabel htmlFor="ob-address">Adresse du logement</FieldLabel>
                  <Input id="ob-address" placeholder="Derb Sidi Bouloukat 27, Médina" />
                </Field>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <Field>
                    <FieldLabel htmlFor="ob-commune">Commune</FieldLabel>
                    <Input id="ob-commune" placeholder="Marrakech" />
                    <FieldDescription>Détermine le barème de taxe de séjour.</FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="ob-type">Type</FieldLabel>
                    <NativeSelect id="ob-type" defaultValue="riad">
                      <NativeSelectOption value="riad">Riad</NativeSelectOption>
                      <NativeSelectOption value="villa">Villa</NativeSelectOption>
                      <NativeSelectOption value="apt">Appartement</NativeSelectOption>
                    </NativeSelect>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="ob-class">Classement</FieldLabel>
                    <NativeSelect id="ob-class" defaultValue="none">
                      <NativeSelectOption value="none">Non classé</NativeSelectOption>
                      <NativeSelectOption value="3">3 étoiles</NativeSelectOption>
                      <NativeSelectOption value="4">4 étoiles</NativeSelectOption>
                      <NativeSelectOption value="5">5 étoiles</NativeSelectOption>
                    </NativeSelect>
                  </Field>
                </div>
              </FieldGroup>
              <Alert>
                <MapPinIcon />
                <AlertTitle>Barème communal détecté — Marrakech</AlertTitle>
                <AlertDescription>
                  Taxe de séjour : 7 MAD / nuitée / personne (surtaxe régionale incluse), exonération
                  moins de 12 ans. Ajustable dans Paramètres → Taxe de séjour, barème par logement
                  possible.
                </AlertDescription>
              </Alert>
            </div>
          )}

          {current === 'payments' && (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <h4 className="m-0 text-sm font-semibold">Encaissement des voyageurs</h4>
                <p className="m-0 text-xs text-muted-foreground">
                  Provider proposé selon votre pays d'exploitation.
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <ChoiceCard
                    title="PayZone / CMI"
                    description="Cartes marocaines et internationales, encaissement en MAD."
                    selected={pspProvider === 'payzone'}
                    badge={<Badge variant="success">Recommandé Maroc</Badge>}
                    onClick={() => setPspProvider('payzone')}
                  />
                  <ChoiceCard
                    title="YouCan Pay"
                    description="Alternative locale, onboarding rapide."
                    selected={pspProvider === 'youcan'}
                    onClick={() => setPspProvider('youcan')}
                  />
                  <ChoiceCard
                    title="Stripe"
                    description="Indisponible pour les sociétés marocaines."
                    disabled
                    badge={<Badge variant="outline">Hors Maroc</Badge>}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <h4 className="m-0 text-sm font-semibold">Versements — vos coordonnées bancaires</h4>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <ChoiceCard
                    title="Open Banking"
                    description="Virement SEPA automatique via PSD2, validation SCA tous les 90 jours."
                    selected={payoutMethod === 'open-banking'}
                    badge={<Badge variant="info">Recommandé</Badge>}
                    onClick={() => setPayoutMethod('open-banking')}
                  />
                  <ChoiceCard
                    title="Virement SEPA"
                    description="Saisie manuelle IBAN + BIC + titulaire (RIB)."
                    selected={payoutMethod === 'sepa'}
                    onClick={() => setPayoutMethod('sepa')}
                  />
                  <ChoiceCard
                    title="Wise"
                    description="Multi-devises, utile hors zone SEPA."
                    selected={payoutMethod === 'wise'}
                    onClick={() => setPayoutMethod('wise')}
                  />
                </div>
                {payoutMethod !== 'open-banking' && (
                  <div className="mt-1 grid grid-cols-1 gap-4 sm:grid-cols-[2fr_1fr]">
                    <Field>
                      <FieldLabel htmlFor="ob-iban">IBAN</FieldLabel>
                      <Input id="ob-iban" placeholder="MA64 0011 5190 0000 1205 0000 6789" />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="ob-bic">BIC</FieldLabel>
                      <Input id="ob-bic" placeholder="BMCEMAMC" />
                    </Field>
                    <Field className="sm:col-span-2">
                      <FieldLabel htmlFor="ob-holder">Titulaire du compte</FieldLabel>
                      <Input id="ob-holder" placeholder="Médina Stays SARL" />
                    </Field>
                  </div>
                )}
                {payoutMethod === 'open-banking' && (
                  <Alert>
                    <LandmarkIcon />
                    <AlertTitle>Connexion bancaire sécurisée</AlertTitle>
                    <AlertDescription>
                      Vous serez redirigé vers votre banque pour autoriser les virements (SCA). Aucun
                      identifiant bancaire n'est stocké par Baitly.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </div>
          )}

          {current === 'contract' && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <h4 className="m-0 text-sm font-semibold">Modèle d'encaissement du contrat</h4>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <ChoiceCard
                    title="La conciergerie encaisse"
                    description="Vous encaissez tout et reversez le net au propriétaire."
                    selected={contractModel === 'CONCIERGE_COLLECTS'}
                    onClick={() => setContractModel('CONCIERGE_COLLECTS')}
                  />
                  <ChoiceCard
                    title="Le propriétaire encaisse"
                    description="Le propriétaire encaisse, vous facturez votre commission."
                    selected={contractModel === 'OWNER_COLLECTS'}
                    onClick={() => setContractModel('OWNER_COLLECTS')}
                  />
                  <ChoiceCard
                    title="Exploitation directe"
                    description="Vous exploitez vos propres biens, pas de reversement."
                    selected={contractModel === 'DIRECT'}
                    onClick={() => setContractModel('DIRECT')}
                  />
                  <ChoiceCard
                    title="Co-hôte OTA"
                    description="Répartition à la source par le canal (Airbnb split)."
                    selected={contractModel === 'OTA_COHOST_SPLIT'}
                    onClick={() => setContractModel('OTA_COHOST_SPLIT')}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="ob-commission">Commission de gestion (%)</FieldLabel>
                  <Input id="ob-commission" placeholder="20" />
                  <FieldDescription>
                    Facturée au propriétaire avec facture de commission conforme.
                  </FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="ob-owner-mail">Email du propriétaire</FieldLabel>
                  <Input id="ob-owner-mail" placeholder="m.alaoui@example.com" />
                </Field>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div className="flex items-center gap-2.5">
                  <FileSignatureIcon className="size-4 text-muted-foreground" />
                  <div>
                    <p className="m-0 text-sm font-medium">Envoyer pour signature électronique</p>
                    <p className="m-0 text-xs text-muted-foreground">
                      Mandat de gestion signé en ligne, certificat de preuve joint au PDF.
                    </p>
                  </div>
                </div>
                <Switch defaultChecked />
              </div>
            </div>
          )}

          {current === 'channels' && (
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
              <Alert>
                <InfoIcon />
                <AlertTitle>Channel manager</AlertTitle>
                <AlertDescription>
                  Tarifs et disponibilités synchronisés en continu (ARI). D'autres canaux sont
                  disponibles via Channex dans Distribution → Channels.
                </AlertDescription>
              </Alert>
            </div>
          )}

          {current === 'team' && (
            <div className="flex flex-col gap-4">
              <p className="m-0 text-sm text-muted-foreground">
                Invitez vos équipes terrain — chacun reçoit un accès limité à son rôle.
              </p>
              <div className="flex flex-col gap-2.5">
                {[
                  { email: 'fatima@medina-stays.ma', role: 'housekeeper' },
                  { email: 'youssef@medina-stays.ma', role: 'technician' },
                ].map((invite, index) => (
                  <div key={invite.email} className="grid grid-cols-1 gap-2 sm:grid-cols-[2fr_1fr]">
                    <Input defaultValue={invite.email} aria-label={`Email invité ${index + 1}`} />
                    <NativeSelect defaultValue={invite.role} aria-label={`Rôle invité ${index + 1}`}>
                      <NativeSelectOption value="housekeeper">Ménage</NativeSelectOption>
                      <NativeSelectOption value="technician">Technicien</NativeSelectOption>
                      <NativeSelectOption value="supervisor">Superviseur</NativeSelectOption>
                    </NativeSelect>
                  </div>
                ))}
              </div>
              <Button size="sm" variant="outline" className="self-start">
                Ajouter une invitation
              </Button>
              <Alert>
                <InfoIcon />
                <AlertTitle>Accès par rôle</AlertTitle>
                <AlertDescription>
                  Le personnel de ménage ne voit que ses missions (planning, checklist, preuve
                  photo) ; les techniciens gèrent leurs tarifs travaux. Étape ignorable — vous
                  pourrez inviter plus tard depuis Paramètres → Organisation.
                </AlertDescription>
              </Alert>
            </div>
          )}

          {current === 'notifications' && (
            <div className="flex flex-col gap-3">
              {[
                {
                  title: 'Notifications par email',
                  description: 'Nouvelle réservation, annulation, échec de paiement.',
                  checked: true,
                },
                {
                  title: 'WhatsApp (API Meta)',
                  description: 'Alertes bruit, arrivées du jour, messages voyageurs.',
                  checked: true,
                },
                {
                  title: 'Push mobile',
                  description: 'Application Baitly terrain (ménage, interventions).',
                  checked: false,
                },
              ].map((channel) => (
                <div
                  key={channel.title}
                  className="flex items-center justify-between rounded-lg border border-border p-3"
                >
                  <div>
                    <p className="m-0 text-sm font-medium">{channel.title}</p>
                    <p className="m-0 text-xs text-muted-foreground">{channel.description}</p>
                  </div>
                  <Switch defaultChecked={channel.checked} />
                </div>
              ))}
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="m-0 text-sm font-medium">Messagerie voyageur</p>
                  <p className="m-0 text-xs text-muted-foreground">
                    Confirmation, instructions d'arrivée, message post-séjour — personnalisables
                    dans Documents → Messages.
                  </p>
                </div>
                <Badge variant="success">3 modèles prêts</Badge>
              </div>
            </div>
          )}

          {current === 'addons' && (
            <div className="flex flex-col gap-4">
              <Alert>
                <PuzzleIcon />
                <AlertTitle>Add-ons facturés en supplément</AlertTitle>
                <AlertDescription>
                  Le contenu et la tarification de chaque add-on seront arbitrés ultérieurement —
                  cette étape réserve leur emplacement dans le parcours. Activables à tout moment
                  depuis Paramètres → Abonnement.
                </AlertDescription>
              </Alert>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {ADDONS.map((addon) => (
                  <div key={addon.title} className="flex flex-col gap-2 rounded-lg border border-border p-3">
                    <div className="flex items-center gap-2">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary">
                        <addon.icon className="size-4" />
                      </span>
                      <span className="text-sm font-medium">{addon.title}</span>
                    </div>
                    <p className="m-0 flex-1 text-xs leading-snug text-muted-foreground">
                      {addon.description}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        <span className="font-semibold tabular-nums">—</span> /mois
                        <Badge variant="outline" className="ms-2">À définir</Badge>
                      </span>
                      <Switch disabled />
                    </div>
                  </div>
                ))}
              </div>
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
          {step < steps.length - 1 ? (
            <Button size="sm" onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))}>
              Suivant <ChevronRightIcon className="cn-rtl-flip" />
            </Button>
          ) : (
            <Button size="sm">
              <RocketIcon /> Lancer mon PMS
            </Button>
          )}
        </div>
      </div>

      {/* Checklist de setup — reflet des étapes réelles (onboardingConfig) */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="m-0 mb-3 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          <ShieldCheckIcon className="size-3.5" /> Pour être 100 % prêt
        </h3>
        <div className="flex flex-col gap-2.5">
          {[
            ...(mode === 'migrate'
              ? [{ label: 'Importer votre historique', done: step > steps.indexOf('import') }]
              : []),
            { label: 'Créer votre organisation', done: step > steps.indexOf('org') },
            { label: 'Renseigner l’entreprise (ICE, RC)', done: step > steps.indexOf('company') },
            { label: 'Profil fiscal & TVA', done: step > steps.indexOf('fiscal') },
            { label: 'Logement + taxe de séjour', done: step > steps.indexOf('property') },
            { label: 'Encaissements & RIB', done: step > steps.indexOf('payments') },
            { label: 'Contrat de gestion signé', done: step > steps.indexOf('contract') },
            { label: 'Inviter votre équipe ménage', done: step > steps.indexOf('team') },
            { label: 'Connecter un canal', done: step > steps.indexOf('channels') },
            { label: 'Notifications & messagerie', done: step > steps.indexOf('notifications') },
          ].map((task) => (
            <div key={task.label} className="flex items-center gap-2 text-xs">
              <span
                className={cn(
                  'inline-flex size-4 shrink-0 items-center justify-center rounded-full',
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
          Vous pourrez terminer ces étapes plus tard depuis Paramètres — chaque étape y a son onglet
          (Organisation, Fiscalité, Paiements, Taxe de séjour, Intégrations).
        </p>
      </div>
    </div>
  );
}

// ─── Section — Portail propriétaire ──────────────────────────────────────────

const OWNER_PAYOUTS = [
  { period: 'Juillet 2026', gross: 84200, commission: 16840, net: 67360, status: 'warn' as const, statusLabel: 'À verser' },
  { period: 'Juin 2026', gross: 61800, commission: 12360, net: 49440, status: 'ok' as const, statusLabel: 'Versé' },
  { period: 'Mai 2026', gross: 57300, commission: 11460, net: 45840, status: 'ok' as const, statusLabel: 'Versé' },
];

const OWNER_REVENUE_CONFIG = {
  net: { label: 'Net propriétaire', color: 'var(--bui-chart-2)' },
} satisfies ChartConfig;

const OWNER_REVENUE_DATA = [
  { month: 'Février', net: 31200 },
  { month: 'Mars', net: 39800 },
  { month: 'Avril', net: 43900 },
  { month: 'Mai', net: 45840 },
  { month: 'Juin', net: 49440 },
  { month: 'Juillet', net: 67360 },
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
          Le versement de <Money value={67360} decimals={0} /> sera effectué le 5 août sur votre
          compte se terminant par 4412.
        </AlertDescription>
      </Alert>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile
          icon={<BanknoteIcon />}
          label="Net à verser (juillet)"
          value={<Money value={67360} decimals={0} />}
          iconClassName="text-success"
        />
        <StatTile icon={<BarChart3Icon />} label="Occupation (juillet)" value="78" unit="%" />
        <StatTile
          icon={<TrendingUpIcon />}
          label="Revenus 12 mois"
          value={<Money value={612400} decimals={0} />}
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
