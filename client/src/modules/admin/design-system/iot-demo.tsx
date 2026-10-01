import { useDemoLanguage } from './demoLanguage';
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
import { Badge, Button, Dialog, DialogContent, DialogTitle, Input, Label, NativeSelect, NativeSelectOption, Progress, Slider, Switch } from '../../../components/ui';
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '../../../components/ui/chart';
import PageHeader from '../../../components/baitly/PageHeader';
import StatTile from '../../../components/baitly/StatTile';
import StatusChip from '../../../components/baitly/StatusChip';
import { cn } from '../../../utils/cn';
import StatTileRow from '../../../components/baitly/StatTileRow';
import FilterChipRow from '../../../components/baitly/FilterChipRow';
import { iotDemoText, type IotDemoMessages } from './iotDemoMessages';

/**
 * Projection — Objets connectés (domotique location courte durée) :
 * parc d'objets par logement, mur de vidéosurveillance, détail capteur de
 * bruit (seuils + créneaux + canaux) et serrure connectée (codes + journal).
 * Fidèle aux écrans réels « Objets connectés » ; galerie uniquement.
 */

// ─── Parc d'objets ───────────────────────────────────────────────────────────

/**
 * Types d'objets du registre reel (`connected-objects/deviceRegistry`), avec
 * leurs couleurs de domaine — la projection filtre sur les memes.
 */
export type DemoKind = 'lock' | 'noise' | 'camera' | 'thermostat' | 'sensor';

const DEMO_KIND_ORDER: DemoKind[] = ['lock', 'noise', 'camera', 'thermostat', 'sensor'];

const DEMO_KIND_COLORS: Record<DemoKind, string> = {
  lock: '#7BA3C2',
  noise: '#4A9B8E',
  camera: '#C97A7A',
  thermostat: '#6B8A9A',
  sensor: '#D4A574',
};

interface DeviceCard {
  kind: DemoKind;
  name: string;
  room: string;
  type: string;
  icon: React.ReactNode;
  online: boolean;
  metric?: React.ReactNode;
  battery?: number;
  alert?: string;
}

/** Le parc de demonstration, dans la langue du document. */
function devicesByProperty(m: IotDemoMessages): Array<{ property: string; devices: DeviceCard[] }> {
  return [
    {
      property: m.properties[0],
      devices: [
        {
          kind: 'lock',
          name: m.deviceNames.entryLock,
          room: m.rooms.frontDoor,
          type: 'Nuki',
          icon: <LockIcon />,
          online: true,
          metric: (
            <span className="flex items-center gap-1">
              <LockIcon className="size-3" /> {m.locked}
            </span>
          ),
          battery: 82,
        },
        {
          kind: 'noise',
          name: m.deviceNames.noiseSensor,
          room: m.rooms.patio,
          type: 'Minut',
          icon: <Volume2Icon />,
          online: true,
          metric: <span className="tabular-nums">48 dB</span>,
        },
        {
          kind: 'camera',
          name: m.deviceNames.entryCamera,
          room: m.rooms.outside,
          type: 'Tuya',
          icon: <VideoIcon />,
          online: true,
          metric: (
            <span className="flex items-center gap-1">
              <span className="size-1.5 animate-pulse rounded-full bg-destructive" /> {m.live}
            </span>
          ),
        },
        {
          kind: 'thermostat',
          name: m.deviceNames.thermostat,
          room: m.rooms.lounge,
          type: 'Netatmo',
          icon: <ThermometerIcon />,
          online: true,
          metric: <span className="tabular-nums">22,5° → 21°</span>,
        },
        {
          kind: 'sensor',
          name: m.deviceNames.smokeDetector,
          room: m.rooms.kitchen,
          type: 'Tuya',
          icon: <FlameIcon />,
          online: true,
          metric: m.ok,
        },
      ],
    },
    {
      property: m.properties[1],
      devices: [
        {
          kind: 'noise',
          name: m.deviceNames.noiseSensor,
          room: m.rooms.lounge,
          type: 'Minut',
          icon: <Volume2Icon />,
          online: false,
          alert: m.offlineSince,
        },
        {
          kind: 'lock',
          name: m.deviceNames.entryLock,
          room: m.rooms.landingDoor,
          type: 'Nuki',
          icon: <LockIcon />,
          online: true,
          metric: (
            <span className="flex items-center gap-1">
              <LockIcon className="size-3" /> {m.locked}
            </span>
          ),
          battery: 12,
        },
      ],
    },
  ];
}

function DeviceCardView({ device, onOpen }: { device: DeviceCard; onOpen?: () => void }) {
  const m = iotDemoText(useDemoLanguage());
  return (
    <div
      onClick={onOpen}
      data-demo-device={device.kind}
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : undefined}
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
          <StatusChip tone="ok" label={m.kpi.online} dot size="sm" />
        ) : (
          <StatusChip tone="err" label={m.kpi.offline} dot size="sm" />
        )}
        {device.battery !== undefined &&
          (device.battery <= 20 ? (
            <StatusChip tone="warn" label={`${m.kpi.lowBattery} ${device.battery} %`} size="sm" icon={<BatteryLowIcon className="size-3" />} />
          ) : (
            <StatusChip tone="neutral" label={`${device.battery} %`} size="sm" icon={<BatteryFullIcon className="size-3" />} />
          ))}
        {device.alert && <span className="truncate text-2xs text-warning-ink">{device.alert}</span>}
      </div>
      <div className="flex items-center justify-between border-t border-border pt-2.5">
        <span className="text-xs font-medium text-foreground">{device.metric ?? <span className="text-faint">—</span>}</span>
        <Button size="xs" variant="ghost" className="text-muted-foreground">
          {m.manage} <ChevronRightIcon className="cn-rtl-flip" />
        </Button>
      </div>
    </div>
  );
}

// ─── Vidéosurveillance ───────────────────────────────────────────────────────

const CAMERAS = [
  { nameIndex: 0, property: 'Riad Yasmine', online: true, motion: false },
  { nameIndex: 1, property: 'Riad Yasmine', online: true, motion: true },
  { nameIndex: 2, property: 'Duplex Marrakech', online: true, motion: false },
  { nameIndex: 3, property: 'Villa Palmeraie', online: false, motion: false },
];

/** Viewer principal — grande dalle plein cadre de la caméra sélectionnée. */
function CameraMainViewer({ camera }: { camera: (typeof CAMERAS)[number] }) {
  const m = iotDemoText(useDemoLanguage());
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
                  <StatusChip tone="warn" label={m.cameras.motionDetected} dot />
                </span>
              )}
              <span className="absolute start-3 bottom-3 rounded-md bg-black/50 px-2 py-1 text-xs text-white">
                <span className="font-semibold">{m.cameras.names[camera.nameIndex]}</span>
                <span className="text-white/70"> · {camera.property}</span>
              </span>
              <span className="absolute end-3 bottom-3 flex items-center gap-1.5">
                <span className="rounded-md bg-black/50 px-2 py-1 text-xs text-white tabular-nums">
                  16:42:08
                </span>
                <Button size="icon-sm" variant="secondary" aria-label={m.cameras.fullscreen}>
                  <ExpandIcon />
                </Button>
              </span>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <VideoOffIcon className="size-10" />
              <span className="text-sm font-medium">{m.cameras.names[camera.nameIndex]} — Hors ligne</span>
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
  const m = iotDemoText(useDemoLanguage());
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Agrandir ${m.cameras.names[camera.nameIndex]}`}
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
                  <StatusChip tone="warn" label={m.cameras.motion} dot size="sm" />
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
          <div className="truncate text-xs font-semibold text-foreground">{m.cameras.names[camera.nameIndex]}</div>
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

/**
 * Mur de videosurveillance — l'ecran de detail d'une camera dans
 * l'application. Ouvert ici depuis une carte, comme le hub ouvre sa page.
 */
function CameraWall() {
  const m = iotDemoText(useDemoLanguage());
  const [selected, setSelected] = useState<number | null>(null);
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {CAMERAS.map((camera, index) => (
          <CameraThumbnail
            key={`${camera.property}-${m.cameras.names[camera.nameIndex]}`}
            camera={camera}
            onOpen={() => setSelected(index)}
          />
        ))}
      </div>
      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="sm:max-w-3xl">
          {selected !== null && (
            <>
              <DialogTitle className="sr-only">{m.cameras.names[CAMERAS[selected].nameIndex]}</DialogTitle>
              <CameraMainViewer camera={CAMERAS[selected]} />
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

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
  const m = iotDemoText(useDemoLanguage());
  const [warningLevel, setWarningLevel] = useState([70]);
  const [criticalLevel, setCriticalLevel] = useState([85]);
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={<RouterIcon />} label={m.noise.connection} value={m.kpi.online} iconClassName="text-success" hint={m.noise.signalHint} />
        <StatTile icon={<Volume2Icon />} label={m.noise.current} value="48" unit="dB" hint={m.noise.calm} />
        <StatTile icon={<Volume2Icon />} label={m.noise.average24} value="42" unit="dB" />
        <StatTile icon={<Volume2Icon />} label={m.noise.peak24} value="76" unit="dB" iconClassName="text-warning" hint={m.noise.peakHint} />
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-2 flex items-center justify-between">
          <h4 className="m-0 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Niveau sonore — dernières 24 h
          </h4>
          <span className="text-2xs text-muted-foreground">
            <span className="me-3 text-warning-ink">— seuil avertissement 70 dB</span>
            <span className="text-destructive">{m.noise.criticalThreshold}</span>
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
          <h4 className="m-0 text-sm font-semibold text-foreground">{m.noise.configTitle}</h4>
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
              { label: m.noise.day, start: '07:00', end: '22:00' },
              { label: m.noise.night, start: '22:00', end: '07:00' },
            ].map((slot) => (
              <div key={slot.label} className="flex items-end gap-2 rounded-lg border border-border p-2.5">
                <div className="flex-1">
                  <Label className="mb-1 text-2xs text-muted-foreground">{m.noise.slotLabel}</Label>
                  <Input defaultValue={slot.label} className="h-8" />
                </div>
                <div className="w-24">
                  <Label className="mb-1 text-2xs text-muted-foreground">{m.noise.start}</Label>
                  <Input type="time" defaultValue={slot.start} className="h-8" />
                </div>
                <div className="w-24">
                  <Label className="mb-1 text-2xs text-muted-foreground">{m.noise.end}</Label>
                  <Input type="time" defaultValue={slot.end} className="h-8" />
                </div>
                <Button size="icon-sm" variant="ghost" className="text-destructive" aria-label={`${m.noise.remove} ${slot.label}`}>
                  <TrashIcon />
                </Button>
              </div>
            ))}
            <div className="grid grid-cols-1 gap-4 pt-1 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <span className="text-xs text-foreground">
                  Seuil avertissement : <b className="text-warning-ink tabular-nums">{warningLevel[0]} dB</b>
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
              { label: m.noise.inApp, on: true },
              { label: m.noise.email, on: true },
              { label: m.noise.guestMessage, on: false },
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
  const m = iotDemoText(useDemoLanguage());
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
            <div className="text-sm font-semibold text-foreground">{locked ? m.locked : m.unlocked}</div>
            <div className="text-xs text-muted-foreground">{m.lockDetail.subtitle}</div>
          </div>
          <Button
            size="sm"
            variant={locked ? 'outline' : 'default'}
            onClick={() => setLocked((v) => !v)}
            /* Repere de la maquette animee : il suit l'ETAT de la serrure, pas
               le libelle — qui change avec la langue. */
            data-demo-action={locked ? 'unlock' : 'lock'}
          >
            {locked ? (
              <>
                <LockOpenIcon /> {m.unlock}
              </>
            ) : (
              <>
                <LockIcon /> {m.lock}
              </>
            )}
          </Button>
          <div className="w-full border-t border-border pt-3">
            <div className="mb-1 flex items-center justify-between text-2xs text-muted-foreground">
              <span>{m.lockDetail.battery}</span>
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
                <span className="text-sm font-medium text-foreground">{m.lockDetail.guestName}</span>
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-primary tabular-nums">4482</code>
              </div>
              <div className="mt-0.5 text-2xs text-muted-foreground">{m.lockDetail.guestCode}</div>
            </div>
            <div className="rounded-lg border border-border p-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-foreground">{m.lockDetail.cleaningTeam}</span>
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-primary tabular-nums">7091</code>
              </div>
              <div className="mt-0.5 text-2xs text-muted-foreground">{m.lockDetail.cleaningWindow}</div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <h4 className="m-0 mb-3 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            <ClockIcon className="size-3.5" /> Journal des accès
          </h4>
          <div className="flex flex-col gap-2.5">
            {[
              { ...m.lockDetail.journal[0], icon: <LockOpenIcon />, tone: 'text-success bg-success-soft' },
              { ...m.lockDetail.journal[1], icon: <LockIcon />, tone: 'text-info bg-info-soft' },
              { ...m.lockDetail.journal[2], icon: <LockOpenIcon />, tone: 'text-success bg-success-soft' },
              { ...m.lockDetail.journal[3], icon: <KeyRoundIcon />, tone: 'text-muted-foreground bg-muted' },
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
  const m = iotDemoText(useDemoLanguage());
  /* L'ecran reel filtre par TYPE d'objet et ouvre le detail depuis une carte.
     `detail` rejoue cette seconde partie sans quitter la projection. */
  const [kindFilter, setKindFilter] = useState<DemoKind | ''>('');
  const [detail, setDetail] = useState<'noise' | 'lock' | 'camera' | null>(null);

  const groups = devicesByProperty(m);
  const allDevices = groups.flatMap((group) => group.devices);
  const filteredGroups = kindFilter
    ? groups.flatMap((group) => {
        const devices = group.devices.filter((device) => device.kind === kindFilter);
        return devices.length > 0 ? [{ ...group, devices }] : [];
      })
    : groups;

  const online = allDevices.filter((device) => device.online).length;
  const offline = allDevices.length - online;
  const lowBattery = allDevices.filter((d) => d.battery != null && d.battery <= 20).length;
  const alerts = allDevices.filter((device) => device.alert).length;

  const kindsPresent = DEMO_KIND_ORDER.filter((kind) => allDevices.some((d) => d.kind === kind));

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={m.title}
        subtitle={m.subtitle}
        iconBadge={<RouterIcon />}
        showBackButton={false}
        className="mb-0"
        actions={
          <Button size="sm">
            <PlusIcon /> {m.addDevice}
          </Button>
        }
      />

      {/* Bandeau des services relies — pont vers les reglages. Le compteur
          porte la graisse : c'est la donnee qu'on vient lire, pas le nom. */}
      <div className="flex flex-row flex-wrap items-center gap-x-2 gap-y-1.5 rounded-xl border border-border bg-card p-1.5">
        <span className="text-2xs font-semibold tracking-wide text-muted-foreground uppercase">
          {m.linkedServices}
        </span>
        {([
          ['Tuya', 3, true],
          ['Minut', 2, true],
          ['Nuki', 2, true],
          ['Netatmo', 0, false],
        ] as const).map(([name, count, connected]) => (
          <StatusChip
            key={name}
            tone={connected ? 'ok' : 'warn'}
            size="sm"
            label={
              <span className="inline-flex items-center gap-1">
                {!connected && <WifiOffIcon className="size-3" />}
                <span>{name}</span>
                <span className="font-semibold tabular-nums">{count}</span>
              </span>
            }
          />
        ))}
        <Button variant="outline" size="sm" className="ms-auto">
          {m.connectNetatmo}
        </Button>
        <Button variant="ghost" size="sm" className="ms-1.5 text-muted-foreground">
          {m.manageIntegrations} <ChevronRightIcon className="cn-rtl-flip" />
        </Button>
      </div>

      {/* Cinq tuiles, comme l'ecran : la teinte ne porte que sur l'icone, et
          seulement la ou elle dit quelque chose. */}
      <StatTileRow compact>
        <StatTile icon={<RouterIcon />} label={m.kpi.devices} value={String(allDevices.length)} />
        <StatTile
          icon={<RouterIcon />}
          label={m.kpi.online}
          value={String(online)}
          unit={`/ ${allDevices.length}`}
          iconClassName="text-success"
          hint={`${Math.round((online / allDevices.length) * 100)} ${m.kpi.fleetShare}`}
        />
        <StatTile icon={<WifiOffIcon />} label={m.kpi.offline} value={String(offline)} iconClassName={offline > 0 ? 'text-destructive' : undefined} />
        <StatTile icon={<Volume2Icon />} label={m.kpi.alerts} value={String(alerts)} iconClassName={alerts > 0 ? 'text-warning' : undefined} />
        <StatTile icon={<BatteryLowIcon />} label={m.kpi.lowBattery} value={String(lowBattery)} iconClassName={lowBattery > 0 ? 'text-warning' : undefined} />
      </StatTileRow>

      {/* Filtre par type — ce qui a remplace les onglets. */}
      {/* Le conteneur porte le repere : `FilterChipRow` est une primitive
          partagee, on ne lui ajoute pas d'attribut pour une demonstration.
          L'ordre des puces est deterministe — « tous », puis DEMO_KIND_ORDER. */}
      <div data-demo-filters>
      <FilterChipRow<DemoKind>
        value={kindFilter}
        onChange={(value) => { setKindFilter(value); setDetail(null); }}
        allLabel={m.allDevices}
        allCount={allDevices.length}
        options={kindsPresent.map((kind) => ({
          value: kind,
          label: m.kinds[kind],
          color: DEMO_KIND_COLORS[kind],
          count: allDevices.filter((device) => device.kind === kind).length,
        }))}
      />
      </div>

      {filteredGroups.map((group) => (
        <div key={group.property} className="flex flex-col gap-2.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <div className="group flex w-fit items-center gap-[4.5px]">
              <span className="inline-flex text-muted-foreground">
                <HomeIcon className="size-4" />
              </span>
              <p className="text-[0.9375rem] font-semibold text-foreground">{group.property}</p>
              <span className="text-xs text-muted-foreground opacity-60">
                · {m.deviceCount(group.devices.length)}
              </span>
              <span className="ms-0.5 inline-flex text-muted-foreground opacity-60">
                <ChevronRightIcon className="cn-rtl-flip size-4" />
              </span>
            </div>
            {/* Le digicode appartient au LOGEMENT, pas a chaque serrure : une
                seule pastille par groupe, et seulement s'il porte une serrure. */}
            {group.devices.some((device) => device.kind === 'lock') && (
              <StatusChip
                tone="neutral"
                size="sm"
                label={
                  <span className="inline-flex items-center gap-1">
                    <KeyRoundIcon className="size-3" />
                    <span>{m.accessCode}</span>
                    <span className="font-semibold tabular-nums">4821</span>
                  </span>
                }
              />
            )}
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,_minmax(248px,_1fr))] gap-1.5">
            {group.devices.map((device) => (
              <DeviceCardView
                key={`${group.property}-${device.name}-${device.room}`}
                device={device}
                onOpen={() => setDetail(
                  device.kind === 'noise' ? 'noise' : device.kind === 'lock' ? 'lock' : device.kind === 'camera' ? 'camera' : null,
                )}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Detail d'objet — un ECRAN a part dans l'application, ouvert ici sous
          la grille pour que la projection tienne dans un seul cadre. */}
      {detail === 'noise' && <NoiseSensorDetail />}
      {detail === 'lock' && <SmartLockDetail />}
      {detail === 'camera' && <CameraWall />}
    </div>
  );
}
