import { useState } from 'react';
import {
  BatteryFullIcon,
  BatteryLowIcon,
  ChevronRightIcon,
  ClockIcon,
  ExpandIcon,
  FlameIcon,
  HomeIcon,
  KeyRoundIcon,
  LinkIcon,
  LockIcon,
  LockOpenIcon,
  MoreVerticalIcon,
  PlusIcon,
  RouterIcon,
  SaveIcon,
  ThermometerIcon,
  TrashIcon,
  VideoIcon,
  VideoOffIcon,
  Volume2Icon,
  WifiOffIcon,
} from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from 'recharts';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  Input,
  Label,
  NativeSelect,
  NativeSelectOption,
  Progress,
  Slider,
  Switch,
  Tabs,
  TabsList,
  TabsTrigger,
} from '../../../components/ui';
import PageHeader from '../../../components/baitly/PageHeader';
import StatTile from '../../../components/baitly/StatTile';
import StatusChip from '../../../components/baitly/StatusChip';
import GuestAvatar from '../../../components/baitly/GuestAvatar';
import { cn } from '../../../utils/cn';

/**
 * Projection — Objets connectés (domotique location courte durée) :
 * parc d'objets par logement, mur de vidéosurveillance, détail capteur de
 * bruit (seuils + créneaux + canaux) et serrure connectée (codes + journal).
 * Fidèle aux écrans réels « Objets connectés » ; galerie uniquement.
 */

// ─── Parc d'objets ───────────────────────────────────────────────────────────

interface DeviceCard {
  name: string;
  room: string;
  type: string;
  icon: React.ReactNode;
  online: boolean;
  metric?: React.ReactNode;
  battery?: number;
  alert?: string;
}

const DEVICES_BY_PROPERTY: Array<{ property: string; devices: DeviceCard[] }> = [
  {
    property: 'Riad Yasmine',
    devices: [
      { name: 'Serrure entrée', room: 'Porte principale', type: 'Serrure · Nuki', icon: <LockIcon />, online: true, metric: <span className="flex items-center gap-1"><LockIcon className="size-3" /> Verrouillée</span>, battery: 82 },
      { name: 'Capteur Noise', room: 'Patio', type: 'Capteur de bruit · Minut', icon: <Volume2Icon />, online: true, metric: <span className="tabular-nums">48 dB</span> },
      { name: 'Caméra entrée', room: 'Extérieur', type: 'Caméra · Tuya', icon: <VideoIcon />, online: true, metric: <span className="flex items-center gap-1"><span className="size-1.5 animate-pulse rounded-full bg-destructive" /> LIVE</span> },
      { name: 'Thermostat salon', room: 'Salon', type: 'Thermostat · Netatmo', icon: <ThermometerIcon />, online: true, metric: <span className="tabular-nums">22,5° → 21°</span> },
      { name: 'Détecteur de fumée', room: 'Cuisine', type: 'Sécurité · Tuya', icon: <FlameIcon />, online: true, metric: 'OK' },
    ],
  },
  {
    property: 'Appartement Duplex Marrakech',
    devices: [
      { name: 'Capteur Noise', room: 'Salon', type: 'Capteur de bruit · Minut', icon: <Volume2Icon />, online: false, alert: 'Hors ligne depuis 26 h' },
      { name: 'Serrure entrée', room: 'Porte palière', type: 'Serrure · Nuki', icon: <LockIcon />, online: true, metric: <span className="flex items-center gap-1"><LockIcon className="size-3" /> Verrouillée</span>, battery: 12 },
    ],
  },
];

function DeviceCardView({ device }: { device: DeviceCard }) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2.5 rounded-xl border bg-card p-3.5',
        device.alert ? 'border-warning/40' : 'border-border'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              'relative inline-flex size-9 items-center justify-center rounded-lg [&>svg]:size-4',
              device.online ? 'bg-primary-soft text-primary' : 'bg-muted text-muted-foreground',
              device.online &&
                'after:absolute after:-end-0.5 after:-top-0.5 after:size-2 after:rounded-full after:bg-success after:ring-2 after:ring-card'
            )}
          >
            {device.icon}
          </span>
          <div className="min-w-0">
            <h4 className="m-0 truncate text-sm font-semibold text-foreground">{device.name}</h4>
            <p className="m-0 truncate text-xs text-muted-foreground">
              {device.room} · {device.type}
            </p>
          </div>
        </div>
        <Button size="icon-xs" variant="ghost" aria-label="Actions">
          <MoreVerticalIcon />
        </Button>
      </div>
      <div className="flex items-center gap-1.5">
        {device.online ? (
          <StatusChip tone="ok" label="En ligne" dot size="sm" />
        ) : (
          <StatusChip tone="err" label="Hors ligne" dot size="sm" />
        )}
        {device.battery !== undefined &&
          (device.battery <= 20 ? (
            <StatusChip tone="warn" label={`Batterie ${device.battery} %`} size="sm" icon={<BatteryLowIcon className="size-3" />} />
          ) : (
            <StatusChip tone="neutral" label={`${device.battery} %`} size="sm" icon={<BatteryFullIcon className="size-3" />} />
          ))}
        {device.alert && <span className="truncate text-2xs text-warning">{device.alert}</span>}
      </div>
      <div className="flex items-center justify-between border-t border-border pt-2.5">
        <span className="text-xs font-medium text-foreground">{device.metric ?? <span className="text-faint">—</span>}</span>
        <Button size="xs" variant="ghost" className="text-muted-foreground">
          Gérer <ChevronRightIcon className="cn-rtl-flip" />
        </Button>
      </div>
    </div>
  );
}

// ─── Vidéosurveillance ───────────────────────────────────────────────────────

const CAMERAS = [
  { name: 'Entrée principale', property: 'Riad Yasmine', online: true, motion: false },
  { name: 'Terrasse toit', property: 'Riad Yasmine', online: true, motion: true },
  { name: 'Porte palière', property: 'Duplex Marrakech', online: true, motion: false },
  { name: 'Jardin', property: 'Villa Palmeraie', online: false, motion: false },
];

/** Viewer principal — grande dalle plein cadre de la caméra sélectionnée. */
function CameraMainViewer({ camera }: { camera: (typeof CAMERAS)[number] }) {
  return (
    <div className="group/camera overflow-hidden rounded-xl border border-border bg-card">
      <div
        className={cn(
          'relative flex aspect-video w-full items-center justify-center',
          camera.online
            ? 'bg-[linear-gradient(160deg,#1B2A35_0%,#0A1120_70%)]'
            : 'bg-muted'
        )}
      >
          {camera.online ? (
            <>
              <VideoIcon className="size-16 text-white/20" />
              <span className="absolute start-3 top-3 flex items-center gap-1.5 rounded-md bg-black/50 px-2 py-1 text-xs font-semibold text-white">
                <span className="size-2 animate-pulse rounded-full bg-destructive" /> LIVE
              </span>
              {camera.motion && (
                <span className="absolute end-3 top-3">
                  <StatusChip tone="warn" label="Mouvement détecté" dot />
                </span>
              )}
              <span className="absolute start-3 bottom-3 rounded-md bg-black/50 px-2 py-1 text-xs text-white">
                <span className="font-semibold">{camera.name}</span>
                <span className="text-white/70"> · {camera.property}</span>
              </span>
              <span className="absolute end-3 bottom-3 flex items-center gap-1.5">
                <span className="rounded-md bg-black/50 px-2 py-1 text-xs text-white tabular-nums">
                  16:42:08
                </span>
                <Button size="icon-sm" variant="secondary" aria-label="Plein écran">
                  <ExpandIcon />
                </Button>
              </span>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <VideoOffIcon className="size-10" />
              <span className="text-sm font-medium">{camera.name} — Hors ligne</span>
              <Button size="xs" variant="outline">
                Relancer le flux
              </Button>
            </div>
          )}
      </div>
    </div>
  );
}

/** Vignette cliquable — ouvre le flux en grand dans une modale. */
function CameraThumbnail({
  camera,
  onOpen,
}: {
  camera: (typeof CAMERAS)[number];
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Agrandir ${camera.name}`}
      className="group/thumb cursor-pointer overflow-hidden rounded-xl border border-border bg-card text-start transition-shadow outline-none hover:shadow-md focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <div
        className={cn(
          'relative flex aspect-video w-full items-center justify-center',
          camera.online
            ? 'bg-[linear-gradient(160deg,#1B2A35_0%,#0A1120_70%)]'
            : 'bg-muted'
        )}
      >
          {camera.online ? (
            <>
              <VideoIcon className="size-7 text-white/25" />
              <span className="absolute start-2 top-2 flex items-center gap-1.5 rounded-md bg-black/50 px-1.5 py-0.5 text-2xs font-semibold text-white">
                <span className="size-1.5 animate-pulse rounded-full bg-destructive" /> LIVE
              </span>
              {camera.motion && (
                <span className="absolute end-2 top-2">
                  <StatusChip tone="warn" label="Mouvement" dot size="sm" />
                </span>
              )}
              <span className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-opacity group-hover/thumb:bg-black/25 group-hover/thumb:opacity-100">
                <span className="flex items-center gap-1.5 rounded-md bg-black/60 px-2 py-1 text-xs font-medium text-white">
                  <ExpandIcon className="size-3.5" /> Agrandir
                </span>
              </span>
            </>
          ) : (
            <div className="flex flex-col items-center gap-1 text-muted-foreground">
              <VideoOffIcon className="size-6" />
              <span className="text-2xs font-medium">Hors ligne</span>
            </div>
          )}
      </div>
      <div className="flex items-center justify-between gap-2 p-2.5">
        <div className="min-w-0">
          <div className="truncate text-xs font-semibold text-foreground">{camera.name}</div>
          <div className="truncate text-2xs text-muted-foreground">{camera.property}</div>
        </div>
        {camera.online ? (
          <StatusChip tone="ok" label="En ligne" dot size="sm" />
        ) : (
          <StatusChip tone="err" label="Hors ligne" dot size="sm" />
        )}
      </div>
    </button>
  );
}

// ─── Détail capteur de bruit ─────────────────────────────────────────────────

const NOISE_CONFIG = {
  db: { label: 'Niveau sonore (dB)', color: 'var(--bui-chart-1)' },
} satisfies ChartConfig;

const NOISE_DATA = [
  { hour: '00:00', db: 38 },
  { hour: '02:00', db: 35 },
  { hour: '04:00', db: 33 },
  { hour: '06:00', db: 36 },
  { hour: '08:00', db: 45 },
  { hour: '10:00', db: 52 },
  { hour: '12:00', db: 55 },
  { hour: '14:00', db: 49 },
  { hour: '16:00', db: 51 },
  { hour: '18:00', db: 58 },
  { hour: '20:00', db: 63 },
  { hour: '22:00', db: 71 },
  { hour: '23:40', db: 76 },
];

function NoiseSensorDetail() {
  const [warningLevel, setWarningLevel] = useState([70]);
  const [criticalLevel, setCriticalLevel] = useState([85]);
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={<RouterIcon />} label="Connexion" value="En ligne" iconClassName="text-success" hint="signal fort · MàJ il y a 40 s" />
        <StatTile icon={<Volume2Icon />} label="Niveau actuel" value="48" unit="dB" hint="calme" />
        <StatTile icon={<Volume2Icon />} label="Moyenne 24 h" value="42" unit="dB" />
        <StatTile icon={<Volume2Icon />} label="Pic 24 h" value="76" unit="dB" iconClassName="text-warning" hint="hier à 23 h 41" />
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-2 flex items-center justify-between">
          <h4 className="m-0 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Niveau sonore — dernières 24 h
          </h4>
          <span className="text-2xs text-muted-foreground">
            <span className="me-3 text-warning">— seuil avertissement 70 dB</span>
            <span className="text-destructive">— seuil critique 85 dB</span>
          </span>
        </div>
        <ChartContainer config={NOISE_CONFIG} className="h-48 w-full">
          <AreaChart accessibilityLayer data={NOISE_DATA} margin={{ left: 0, right: 12 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="hour" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis domain={[20, 100]} tickLine={false} axisLine={false} width={30} />
            <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
            <ReferenceLine y={70} stroke="var(--bui-warning)" strokeDasharray="4 4" />
            <ReferenceLine y={85} stroke="var(--bui-destructive)" strokeDasharray="4 4" />
            <Area dataKey="db" type="monotone" fill="var(--color-db)" fillOpacity={0.35} stroke="var(--color-db)" />
          </AreaChart>
        </ChartContainer>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h4 className="m-0 text-sm font-semibold text-foreground">Configuration des alertes bruit</h4>
          <div className="flex items-center gap-2">
            <Label htmlFor="iot-alerts" className="text-xs text-muted-foreground">
              Alertes activées
            </Label>
            <Switch id="iot-alerts" defaultChecked />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.3fr_1fr]">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h5 className="m-0 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Créneaux horaires
              </h5>
              <Button size="xs" variant="ghost" className="text-muted-foreground">
                <PlusIcon /> Ajouter
              </Button>
            </div>
            {[
              { label: 'Jour', start: '07:00', end: '22:00' },
              { label: 'Nuit', start: '22:00', end: '07:00' },
            ].map((slot) => (
              <div key={slot.label} className="flex items-end gap-2 rounded-lg border border-border p-2.5">
                <div className="flex-1">
                  <Label className="mb-1 text-2xs text-muted-foreground">Label</Label>
                  <Input defaultValue={slot.label} className="h-8" />
                </div>
                <div className="w-24">
                  <Label className="mb-1 text-2xs text-muted-foreground">Début</Label>
                  <Input type="time" defaultValue={slot.start} className="h-8" />
                </div>
                <div className="w-24">
                  <Label className="mb-1 text-2xs text-muted-foreground">Fin</Label>
                  <Input type="time" defaultValue={slot.end} className="h-8" />
                </div>
                <Button size="icon-sm" variant="ghost" className="text-destructive" aria-label={`Supprimer ${slot.label}`}>
                  <TrashIcon />
                </Button>
              </div>
            ))}
            <div className="grid grid-cols-1 gap-4 pt-1 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <span className="text-xs text-foreground">
                  Seuil avertissement : <b className="text-warning tabular-nums">{warningLevel[0]} dB</b>
                </span>
                <Slider value={warningLevel} onValueChange={setWarningLevel} min={40} max={100} step={1} />
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-xs text-foreground">
                  Seuil critique : <b className="text-destructive tabular-nums">{criticalLevel[0]} dB</b>
                </span>
                <Slider value={criticalLevel} onValueChange={setCriticalLevel} min={40} max={100} step={1} />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <h5 className="m-0 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Canaux de notification
            </h5>
            {[
              { label: 'In-app', on: true },
              { label: 'Email', on: true },
              { label: 'Message voyageur (WhatsApp)', on: false },
            ].map((channel) => (
              <div key={channel.label} className="flex items-center justify-between gap-2">
                <span className="text-sm text-foreground">{channel.label}</span>
                <Switch defaultChecked={channel.on} aria-label={channel.label} />
              </div>
            ))}
            <div className="mt-1 flex items-center justify-between gap-2 border-t border-border pt-3">
              <Label htmlFor="iot-cooldown" className="text-sm text-foreground">
                Cooldown entre alertes
              </Label>
              <NativeSelect id="iot-cooldown" defaultValue="30" className="w-28">
                <NativeSelectOption value="15">15 min</NativeSelectOption>
                <NativeSelectOption value="30">30 min</NativeSelectOption>
                <NativeSelectOption value="60">1 h</NativeSelectOption>
              </NativeSelect>
            </div>
            <Button size="sm" className="mt-auto self-end">
              <SaveIcon /> Sauvegarder
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Détail serrure connectée ────────────────────────────────────────────────

function SmartLockDetail() {
  const [locked, setLocked] = useState(true);
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-5">
          <span
            className={cn(
              'inline-flex size-16 items-center justify-center rounded-full',
              locked ? 'bg-success-soft text-success' : 'bg-warning-soft text-warning'
            )}
          >
            {locked ? <LockIcon className="size-7" /> : <LockOpenIcon className="size-7" />}
          </span>
          <div className="text-center">
            <div className="text-sm font-semibold text-foreground">{locked ? 'Verrouillée' : 'Déverrouillée'}</div>
            <div className="text-xs text-muted-foreground">Serrure entrée · Riad Yasmine · Nuki Smart Lock 4</div>
          </div>
          <Button
            size="sm"
            variant={locked ? 'outline' : 'default'}
            onClick={() => setLocked((v) => !v)}
          >
            {locked ? (
              <>
                <LockOpenIcon /> Déverrouiller
              </>
            ) : (
              <>
                <LockIcon /> Verrouiller
              </>
            )}
          </Button>
          <div className="w-full border-t border-border pt-3">
            <div className="mb-1 flex items-center justify-between text-2xs text-muted-foreground">
              <span>Batterie</span>
              <span className="tabular-nums">82 %</span>
            </div>
            <Progress value={82} />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="m-0 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              <KeyRoundIcon className="size-3.5" /> Codes d'accès actifs
            </h4>
            <Button size="xs" variant="ghost" className="text-muted-foreground">
              <PlusIcon /> Générer
            </Button>
          </div>
          <div className="flex flex-col gap-2.5">
            <div className="rounded-lg border border-border p-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-foreground">Amina Benali</span>
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-primary tabular-nums">4482</code>
              </div>
              <div className="mt-0.5 text-2xs text-muted-foreground">RES-1042 · valide du 12 au 19 août, 11 h</div>
            </div>
            <div className="rounded-lg border border-border p-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-foreground">Équipe ménage</span>
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-primary tabular-nums">7091</code>
              </div>
              <div className="mt-0.5 text-2xs text-muted-foreground">Permanent · 09 h → 17 h uniquement</div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <h4 className="m-0 mb-3 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            <ClockIcon className="size-3.5" /> Journal des accès
          </h4>
          <div className="flex flex-col gap-2.5">
            {[
              { who: 'Amina Benali', what: 'Ouverture par code guest', time: '15:02', icon: <LockOpenIcon /> , tone: 'text-success bg-success-soft' },
              { who: 'Auto', what: 'Verrouillage automatique (3 min)', time: '15:05', icon: <LockIcon />, tone: 'text-info bg-info-soft' },
              { who: 'Fatima Zahra', what: 'Ouverture code ménage', time: '11:12', icon: <LockOpenIcon />, tone: 'text-success bg-success-soft' },
              { who: 'Système', what: 'Code guest RES-1039 expiré', time: 'hier', icon: <KeyRoundIcon />, tone: 'text-muted-foreground bg-muted' },
            ].map((event, index) => (
              <div key={index} className="flex items-center gap-2.5">
                <span className={cn('inline-flex size-6 shrink-0 items-center justify-center rounded-full [&>svg]:size-3', event.tone)}>
                  {event.icon}
                </span>
                <div className="min-w-0 flex-1 text-xs">
                  <span className="font-medium text-foreground">{event.who}</span>{' '}
                  <span className="text-muted-foreground">— {event.what}</span>
                </div>
                <span className="shrink-0 text-2xs text-faint tabular-nums">{event.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Section complète ────────────────────────────────────────────────────────

export function BIotSectionDemo() {
  const [tab, setTab] = useState('fleet');
  const [selectedCamera, setSelectedCamera] = useState<number | null>(null);
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Objets connectés"
        subtitle="Domotique de vos logements : accès, bruit, vidéo, énergie"
        iconBadge={<RouterIcon />}
        titleAdornment={<Badge variant="warning">1 alerte</Badge>}
        showBackButton={false}
        className="mb-0"
        actions={
          <>
            <Button size="sm" variant="outline">
              <LinkIcon /> Connecter Netatmo
            </Button>
            <Button size="sm" variant="ghost" className="text-muted-foreground">
              Gérer les intégrations <ChevronRightIcon className="cn-rtl-flip" />
            </Button>
          </>
        }
      />

      {/* Services reliés */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5">
        <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Services reliés
        </span>
        <StatusChip tone="ok" label="Tuya · 3" size="sm" />
        <StatusChip tone="ok" label="Minut · 2" size="sm" />
        <StatusChip tone="ok" label="Nuki · 2" size="sm" />
        <StatusChip tone="neutral" label="Netatmo — non connecté" size="sm" />
      </div>

      {/* KPIs parc */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile icon={<RouterIcon />} label="Objets" value="9" hint="sur 3 logements" />
        <StatTile icon={<RouterIcon />} label="En ligne" value="7" unit="/ 9" iconClassName="text-success" hint="78 % du parc" />
        <StatTile icon={<WifiOffIcon />} label="Hors ligne" value="2" iconClassName="text-destructive" hint="Duplex : capteur bruit 26 h" />
        <StatTile icon={<Volume2Icon />} label="Alertes (24 h)" value="1" iconClassName="text-warning" hint="bruit 76 dB à 23 h 41" />
        <StatTile icon={<BatteryLowIcon />} label="Batterie faible" value="1" iconClassName="text-warning" hint="Serrure Duplex : 12 %" />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList variant="line">
          <TabsTrigger value="fleet">Parc d'objets</TabsTrigger>
          <TabsTrigger value="cameras">Vidéosurveillance</TabsTrigger>
          <TabsTrigger value="noise">Capteur de bruit</TabsTrigger>
          <TabsTrigger value="lock">Serrure connectée</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === 'fleet' && (
        <div className="flex flex-col gap-5">
          {DEVICES_BY_PROPERTY.map((group) => (
            <div key={group.property} className="flex flex-col gap-2.5">
              <h3 className="m-0 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <HomeIcon className="size-4 text-muted-foreground" /> {group.property}
                <span className="text-xs font-normal text-muted-foreground">
                  · {group.devices.length} objet{group.devices.length > 1 ? 's' : ''}
                </span>
              </h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {group.devices.map((device) => (
                  <DeviceCardView key={`${group.property}-${device.name}-${device.room}`} device={device} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'cameras' && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {CAMERAS.map((camera, index) => (
              <CameraThumbnail
                key={`${camera.property}-${camera.name}`}
                camera={camera}
                onOpen={() => setSelectedCamera(index)}
              />
            ))}
          </div>
          <Dialog open={selectedCamera !== null} onOpenChange={(open) => !open && setSelectedCamera(null)}>
            <DialogContent className="sm:max-w-3xl">
              {selectedCamera !== null && (
                <>
                  <DialogTitle className="sr-only">
                    {CAMERAS[selectedCamera].name} — flux vidéo
                  </DialogTitle>
                  <CameraMainViewer camera={CAMERAS[selectedCamera]} />
                </>
              )}
            </DialogContent>
          </Dialog>
          <div className="rounded-xl border border-border bg-card p-4">
            <h4 className="m-0 mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Détections récentes
            </h4>
            <div className="flex flex-col gap-2.5">
              {[
                { camera: 'Terrasse toit', what: 'Mouvement détecté', time: 'il y a 4 min', tone: 'warn' as const },
                { camera: 'Entrée principale', what: 'Personne détectée — arrivée guest', time: '15:02', tone: 'ok' as const },
                { camera: 'Jardin', what: 'Caméra hors ligne', time: 'il y a 3 h', tone: 'err' as const },
              ].map((event, index) => (
                <div key={index} className="flex items-center gap-2.5 text-xs">
                  <StatusChip tone={event.tone} label={event.camera} dot size="sm" />
                  <span className="min-w-0 flex-1 truncate text-foreground">{event.what}</span>
                  <span className="shrink-0 text-2xs text-faint">{event.time}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="m-0 text-2xs text-muted-foreground">
            Caméras extérieures et parties communes uniquement — les flux intérieurs sont interdits en location courte durée.
          </p>
        </div>
      )}

      {tab === 'noise' && <NoiseSensorDetail />}
      {tab === 'lock' && <SmartLockDetail />}

      {tab === 'lock' && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <GuestAvatar name="Amina Benali" size={20} />
          Le code guest est envoyé automatiquement à J-1 via le template « Instructions de check-in ».
        </div>
      )}
    </div>
  );
}
