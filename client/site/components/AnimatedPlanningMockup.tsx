import SiteMoney from './SiteMoney';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type MutableRefObject,
} from 'react';
import {
  BedDoubleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  HomeIcon,
  LayoutGridIcon,
  SettingsIcon,
  WalletIcon,
  PauseIcon,
  PlayIcon,
  MoreVerticalIcon,
  MoonIcon,
  BuildingIcon,
  CalendarCheckIcon,
  CalendarIcon,
  ClockIcon,
  EyeIcon,
  GaugeIcon,
  GlobeIcon,
  LockIcon,
  MapPinIcon,
  PlusIcon,
  SearchIcon,
  UserIcon,
  UsersIcon,
  Volume2Icon,
  VolumeXIcon,
  XIcon,
} from 'lucide-react';
/* Icônes EXACTES de la brique planning (src/icons, corps Iconify embarqués). */
import {
  Label as TagIcon,
  BroomFill,
  CheckBold,
  CreditCardFill,
  MoroccanDirham,
  Warning,
  WrenchFill,
} from '../../src/icons';
import airbnbLogo from '../../src/assets/logo/airbnb-logo-small.svg';
import bookingLogo from '../../src/assets/logo/booking-logo-small.svg';
import GuestAvatar from '../../src/components/GuestAvatar';
import { getBarContentLayout } from '../../src/modules/planning/utils/barContentLayout';
import { BAR_FEE_PILL_MIN } from '../../src/modules/planning/constants';
import guest1 from '../assets/guests/g1.jpg';
import guest2 from '../assets/guests/g2.jpg';
import guest3 from '../assets/guests/g3.jpg';
import guest4 from '../assets/guests/g4.jpg';
import guest5 from '../assets/guests/g5.jpg';
import guest6 from '../assets/guests/g6.jpg';
import guest7 from '../assets/guests/g7.jpg';
import guest8 from '../assets/guests/g8.jpg';
import guest9 from '../assets/guests/g9.jpg';
import guest10 from '../assets/guests/g10.jpg';
import guest11 from '../assets/guests/g11.jpg';
import guest12 from '../assets/guests/g12.jpg';
import { Cursor, useScriptedCursor } from './mockupKit';
import { useBaitlyDemoVisibility } from './useBaitlyDemoVisibility';
import { useBaitlyPlanningTimeline } from './useBaitlyPlanningTimeline';
import { useDemoNarration } from './useDemoNarration';
import BaitlyPlanningCallout, {
  type PlanningAnnotation,
} from './BaitlyPlanningCallout';
import BaitlyMarkLogo from '../../src/components/BaitlyMarkLogo';
import { BAITLY_PLANNING_STATUS } from '../data/baitlyPlanningAppearance';
import { useSiteLanguage, type SiteLanguage } from '../lib/siteLanguage';
import { useSiteCurrency } from '../lib/siteCurrency';
import { demoDate, demoDateLabel, demoDigits, demoNumber, demoWeekend, DEMO_TODAY } from '../lib/planningDemoLocale';
import { PLANNING_MOCKUP_MESSAGES } from '../lib/messages/planningMockup';
import { SITE_PHOTOS } from '../data/baitlyPhotography';

const {
  planningRiad: propertyRiad,
  planningApartment: propertyApartment,
  planningVilla: propertyVilla,
  planningHouse: propertyHouse,
  planningCity: propertyTerrace,
} = SITE_PHOTOS;

/**
 * Mockup animé — écran Planning. Reproduit le design RÉEL du module
 * `client/src/modules/planning` (palette Signature, couleurs de statut,
 * géométrie des briques) plutôt qu'une projection de galerie : la grille est
 * rejouée ici pour pouvoir animer des gestes que l'écran statique ne montre pas.
 *
 * Gestes rejoués, choisis parmi les interactions réellement implémentées :
 *  1. filtre par canal (chip Airbnb) — les briques du canal s'estompent ;
 *  2. glisser une réservation sur une plage occupée → conflit rouge, drop refusé
 *     (protection anti-surbooking) ;
 *  3. déplacement valide de la même réservation ;
 *  4. étirement d'un séjour → le ménage se replanifie après le nouveau départ ;
 *  5. sélection de nuits libres → « 3 nuits » prêt à réserver.
 *
 * Conteneur à hauteur fixe → la page ne bouge jamais.
 * prefers-reduced-motion → grille statique, sans curseur.
 */

/* ─── Géométrie (miroir de planning/constants.ts) ───────────────────────────── */
export const PROP_W = 188;
export const DAY_W = 74;
export const ROW_H = 54;
export const HEADER_H = 44;
const BAR_H = 36;
const BAR_TOP = 9;
/* Lignes vides de remplissage, comme le planning quand la page contient moins
   de logements que la hauteur disponible — elles donnent aussi la place
   qu'exige la fiche logement ouverte. */
const FILLER_ROWS = 2;
export const DAYS = 14;
export const DESIGN_WIDTH = PROP_W + DAYS * DAY_W;
export const FRAME_WIDTH = DESIGN_WIDTH + 60; // Sidebar + grid gutters.
export const PROPERTY_PHOTOS = [
  propertyRiad,
  propertyApartment,
  propertyVilla,
  propertyTerrace,
  propertyHouse,
  SITE_PHOTOS.planningStudio,
];
export const PLANNING_FRAME_HEIGHT =
  50 + 57 + HEADER_H + (PROPERTY_PHOTOS.length + FILLER_ROWS) * ROW_H + 30 + 50 + 2;

/** Palette « Signature » du planning, portée localement : le site marketing
    n'expose que les tokens --bui-*, pas ceux de l'application. */
export const TOKENS = {
  '--pl-card': '#FCFDFD',
  '--pl-surface2': '#FBFCFC',
  '--pl-line': '#D5DFE8',
  '--pl-line2': '#D5DFE8',
  '--pl-ink': '#15242D',
  '--pl-body': '#3B4951',
  '--pl-muted': '#67757C',
  '--pl-faint': '#71818D',
  '--pl-accent': '#264672',
  '--pl-accent-soft': 'rgba(38,70,114,.10)',
  '--pl-we': '#F8FAFB',
  '--pl-field': '#EFF2F4',
  '--pl-err': '#E5484D',
} as CSSProperties;

const STATUS = {
  confirmed: BAITLY_PLANNING_STATUS.confirmed.background,
  pending: BAITLY_PLANNING_STATUS.pending.background,
  checked_in: BAITLY_PLANNING_STATUS.checked_in.background,
  checked_out: BAITLY_PLANNING_STATUS.checked_out.background,
};

const CHANNELS = {
  airbnb: { color: '#E0735A', logo: airbnbLogo },
  booking: { color: '#4A6B9A', logo: bookingLogo },
  direct: { color: '#264672', logo: null },
};

/* ─── Données de la grille ──────────────────────────────────────────────────── */

/* Nombre d'unites par logement. Les noms et les villes vivent dans
   `lib/messages/planningMockup.ts`, dans le meme ordre : le portefeuille de
   demonstration suit le marche de la langue. */
export const UNIT_COUNTS = [4, 3, 5, 3, 4, 2];

type Status = keyof typeof STATUS;
type Channel = keyof typeof CHANNELS;

interface Resa {
  id: string;
  row: number;
  start: number;
  nights: number;
  status: Status;
  guest: string;
  channel: Channel;
  price: number;
  paid: boolean;
  /** Ménage rattaché : montant de la prestation + son état de règlement. */
  cleaning?: { fee: number; paid: boolean };
  maintenance?: boolean;
  /** Fiche voyageur incomplète (e-mail manquant) → pastille d'alerte pulsée. */
  missingInfo?: boolean;
  /** Portrait illustratif local, partagé par les deux démonstrations. */
  photo?: string;
}

export const RESAS: Resa[] = [
  /* Statuts conformes à `computeEffectiveStatus` du planning : le mauve
     (check-out) n'existe QUE dans le passé, le bleu (check-in) uniquement à
     cheval sur aujourd'hui, et le futur est vert (réglé) ou orange (à régler). */
  // Passé — départs effectués (mauve)
  {
    id: 'r1',
    row: 0,
    start: 0,
    nights: 2,
    status: 'checked_out',
    guest: 'Hans Müller',
    photo: guest1,
    channel: 'airbnb',
    price: 4800,
    paid: true,
  },
  {
    id: 'r11',
    row: 5,
    start: 0,
    nights: 2,
    status: 'checked_out',
    guest: 'Sophie Dubois',
    photo: guest11,
    channel: 'direct',
    price: 8200,
    paid: true,
  },
  // En cours — à cheval sur aujourd'hui (bleu)
  {
    id: 'r3',
    row: 1,
    start: 1,
    nights: 4,
    status: 'checked_in',
    guest: 'Carlos García',
    photo: guest3,
    channel: 'airbnb',
    price: 3200,
    paid: true,
  },
  {
    id: 'r7',
    row: 3,
    start: 2,
    nights: 7,
    status: 'checked_in',
    guest: 'Ahmed Bennani',
    photo: guest6,
    channel: 'direct',
    price: 9800,
    paid: true,
    maintenance: true,
  },
  // À venir, réglées (vert)
  {
    id: 'r4',
    row: 1,
    start: 8,
    nights: 6,
    status: 'confirmed',
    guest: 'Anna Kowalski',
    photo: guest2,
    channel: 'direct',
    price: 7100,
    paid: true,
    cleaning: { fee: 400, paid: false },
  },
  {
    id: 'r5',
    row: 2,
    start: 5,
    nights: 4,
    status: 'confirmed',
    guest: 'Luca Rossi',
    photo: guest7,
    channel: 'booking',
    price: 6400,
    paid: true,
    cleaning: { fee: 450, paid: false },
  },
  {
    id: 'r9',
    row: 4,
    start: 4,
    nights: 4,
    status: 'confirmed',
    guest: 'Mia Andersson',
    photo: guest9,
    channel: 'airbnb',
    price: 4400,
    paid: true,
    cleaning: { fee: 350, paid: true },
  },
  {
    id: 'r10',
    row: 4,
    start: 11,
    nights: 3,
    status: 'confirmed',
    guest: 'Nadia Alami',
    photo: guest4,
    channel: 'airbnb',
    price: 3900,
    paid: true,
  },
  {
    id: 'r8',
    row: 3,
    start: 10,
    nights: 4,
    status: 'confirmed',
    guest: 'Julia Wagner',
    photo: guest8,
    channel: 'booking',
    price: 6900,
    paid: true,
  },
  // À venir, à régler (orange)
  {
    id: 'r2',
    row: 0,
    start: 9,
    nights: 5,
    status: 'pending',
    guest: 'Kenji Sato',
    photo: guest5,
    channel: 'booking',
    price: 5600,
    paid: false,
    missingInfo: true,
  },
  /* Départ au jour 11 : `r5` est étirée de 2 nuits par la chorégraphie (5→11).
     Toute date antérieure la ferait chevaucher — ce que le planning refuserait. */
  {
    id: 'r6',
    row: 2,
    start: 11,
    nights: 3,
    status: 'pending',
    guest: 'Dounia B.',
    photo: guest10,
    channel: 'airbnb',
    price: 5200,
    paid: false,
  },
  {
    id: 'r12',
    row: 5,
    start: 8,
    nights: 3,
    status: 'pending',
    guest: 'Tom Lefèvre',
    photo: guest12,
    channel: 'booking',
    price: 3600,
    paid: false,
  },
];

/** Réservation posée par la chorégraphie à l'issue du dialog de création.
    Directe et non encore réglée → « En attente » (orange), conforme à
    `computeEffectiveStatus` : le vert exige un paiement encaissé. */
const CREATED_RESA: Resa = {
  id: 'rn',
  row: 0,
  start: 5,
  nights: 3,
  status: 'pending',
  guest: 'Sarah Miller',
  channel: 'direct',
  price: 3750,
  paid: false,
};

/** Plage bloquée (indisponibilité manuelle) — bande hachurée, pas une brique. */
const BLOCKED = { row: 5, start: 3, nights: 4 };

/** Réservation annulée : brique fantôme hachurée, nom barré, avatar grisé. */
const CANCELLED: Resa = {
  id: 'rc',
  row: 1,
  start: 5,
  nights: 3,
  status: 'pending',
  guest: 'Elena Petrova',
  channel: 'booking',
  price: 2940,
  paid: false,
};

/** Prix par nuit affichés dans les cellules libres (par logement). */
const NIGHTLY = [1250, 980, 2100, 850, 1400, 720];

const FIRST_DOW = 4; // Mercredi 23 septembre 2026, samedi = index 0.
export const TODAY_INDEX = 3;

export const isWeekend = (day: number, language: SiteLanguage = 'fr') => demoWeekend(demoDate(day), language);


/** Montants fictifs synchronisés avec les autres démonstrations du site. */
function Amount({ value, size = 11 }: { value: number; size?: number }) {
  const { language } = useSiteLanguage();
  return (
    <SiteMoney
      value={value}
      from={language === 'ar' ? 'SAR' : 'MAD'}
      language={language}
      size={size + 2}
    />
  );
}

/* ─── Fragments d'interface ─────────────────────────────────────────────────── */

/** Pastille carrée blanche portant une icône (ménage, maintenance, canal). */
function BarBadge({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="flex size-[21px] shrink-0 items-center justify-center rounded-[7px] bg-white"
      style={{ boxShadow: '0 1px 2px rgba(0,0,0,.14)' }}
    >
      {children}
    </span>
  );
}

/** Raccourci : le texte de la maquette dans la langue du site. */
export function usePlanningText() {
  const { language } = useSiteLanguage();
  return PLANNING_MOCKUP_MESSAGES[language];
}

/* Voix off (Paul K, voir `lib/messages/planningMockupVoice.ts`) : un MP3 par
   étape et par langue. L'arabe n'a pas de voix et suit le rythme français. */
const PLANNING_CLIPS = import.meta.glob('../assets/voice/planning-demo/*/*.mp3', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;
const planningClipUrl = (language: SiteLanguage, step: number) =>
  PLANNING_CLIPS[
    `../assets/voice/planning-demo/${language}/${String(step).padStart(2, '0')}.mp3`
  ];

/**
 * Repères de la voix off, en ms depuis le début de chaque étape : instant où la
 * voix nomme le geste (fin du silence précédent, mesuré par `ffmpeg
 * silencedetect`), `end` = fin de la phrase. Régénérer un clip impose de
 * remesurer ses repères.
 */
const PLANNING_VOICE_CUES: Record<'fr' | 'en', Record<string, number>[]> = {
  fr: [
    { click: 3000, panel: 4535, end: 9870 },
    { hide: 2040, show: 6630, end: 8400 },
    { drag: 700, refuse: 3890, back: 6130, end: 8100 },
    { drag: 3260, drop: 5100, end: 6670 },
    { stretch: 1880, cleaning: 4230, end: 6960 },
    { open: 3000, type: 4860, save: 6450, done: 7730, end: 8900 },
    { select: 2310, end: 5230 },
    { search: 2400, pick: 4330, create: 6380, end: 7850 },
    { bar: 890, occupancy: 3480, end: 7120 },
  ],
  en: [
    { click: 3200, panel: 4800, end: 9760 },
    { hide: 1780, show: 5600, end: 7640 },
    { drag: 700, refuse: 3880, back: 5870, end: 8080 },
    { drag: 2700, drop: 4290, end: 6020 },
    { stretch: 1970, cleaning: 4210, end: 6330 },
    { open: 2750, type: 4580, save: 5690, done: 6590, end: 7860 },
    { select: 1960, end: 4610 },
    { search: 2590, pick: 4260, create: 5820, end: 7010 },
    { bar: 1320, occupancy: 3470, end: 7280 },
  ],
};
/** Le cadre précède légèrement le mot : l'œil est sur l'élément quand la voix le nomme. */
const FRAME_LEAD_MS = 300;
/** Silence entre deux étapes : le cadre s'efface avec la fin de la phrase. */
const STEP_GAP_MS = 600;
/** Le curseur scripté met environ 800 ms à rejoindre sa cible (mockupKit). */
const CURSOR_TRAVEL_MS = 750;

/** Pastille du canal d'origine : logo officiel, ou globe pour le direct. */
function ChannelBadge({ channel }: { channel: Channel }) {
  const { logo } = CHANNELS[channel];
  const label = usePlanningText().channels[channel];
  return (
    <BarBadge>
      {logo ? (
        <img src={logo} alt="" className="size-[13px] object-contain" />
      ) : (
        <GlobeIcon
          className="size-[13px]"
          style={{ color: 'var(--pl-accent)' }}
          aria-label={label}
        />
      )}
    </BarBadge>
  );
}

export default function AnimatedPlanningMockup() {
  const [cycle, setCycle] = useState(0);
  const [paused, setPaused] = useState(false);
  const [scene, setScene] = useState(0);
  const [annotation, setAnnotation] = useState<PlanningAnnotation | null>(null);
  /* Voix active à la première lecture, coupée d'office après la première
     boucle (la démo continue de tourner), comme la démo de l'accueil. Si le
     navigateur refuse la lecture sonore sans geste, la voix démarre au
     premier clic ou à la première touche sur la page. */
  const [voiceOn, setVoiceOn] = useState(true);
  const [voiceBlocked, setVoiceBlocked] = useState(false);
  const [voiceHint, setVoiceHint] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const { visibilityRef, active, reduced } = useBaitlyDemoVisibility();
  const m = usePlanningText();
  const { language, direction } = useSiteLanguage();
  const playing = active && !paused;
  const voiceAudible = voiceOn && !voiceBlocked;
  const voice = useDemoNarration(
    planningClipUrl,
    language,
    voiceAudible && playing,
    () => setVoiceBlocked(true),
  );
  const hasVoice = Boolean(planningClipUrl(language, 0));
  const voiceOnRef = useRef(voiceOn);
  voiceOnRef.current = voiceOn;
  const loops = useRef(0);

  useEffect(() => {
    if (!voiceBlocked) return;
    const unlock = (event: Event) => {
      // Le bouton de voix gère lui-même son clic.
      if ((event.target as Element | null)?.closest?.('[data-voice-toggle]')) return;
      setVoiceBlocked(false);
    };
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', unlock, true);
    return () => {
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('keydown', unlock, true);
    };
  }, [voiceBlocked]);

  const toggleVoice = () => {
    setVoiceHint(false);
    if (voiceAudible) {
      setVoiceOn(false);
      return;
    }
    setVoiceBlocked(false);
    setVoiceOn(true);
  };

  return (
    <div ref={visibilityRef}>
      <div className="bpm-demo-controls">
        <span>
          <i aria-hidden="true" />
          {m.demo} ·{' '}
          {annotation ? m.guide.steps[annotation.step].title : m.scenes[scene]}
        </span>
        {!reduced && (
          <span className="bpm-demo-buttons">
            {hasVoice && (
              <button
                type="button"
                data-voice-toggle
                data-attention={voiceHint || voiceBlocked || undefined}
                aria-pressed={voiceAudible}
                onClick={toggleVoice}
              >
                {voiceAudible ? <Volume2Icon /> : <VolumeXIcon />}
                {voiceAudible ? m.voiceOff : m.voiceOn}
              </button>
            )}
            <button
              type="button"
              aria-pressed={paused}
              onClick={() => setPaused((value) => !value)}
            >
              {paused ? <PlayIcon /> : <PauseIcon />}
              {paused ? m.play : m.pause}
            </button>
          </span>
        )}
      </div>
      <div className="bpm-planning-stage" ref={stageRef} data-guided={!reduced}>
        <div
          className="bpm-planning-scroll"
          dir={direction}
          tabIndex={0}
          role="region"
          aria-label={m.demo}
        >
          <PlanningScene
            key={language + cycle}
            active={playing}
            reduced={reduced}
            clockRef={voice.clockRef}
            onNarrate={voice.narrate}
            onSceneChange={setScene}
            onAnnotationChange={setAnnotation}
            onCycleEnd={() => {
              loops.current += 1;
              if (loops.current === 1 && voiceOnRef.current) {
                setVoiceOn(false);
                setVoiceHint(true);
              }
              setCycle((current) => current + 1);
              setScene(0);
              setAnnotation(null);
              voice.reset();
            }}
          />
        </div>
        {annotation && !reduced && (
          <BaitlyPlanningCallout
            key={annotation.step}
            annotation={annotation}
            stageRef={stageRef}
            active={playing}
          />
        )}
      </div>
    </div>
  );
}

export function PlanningScene({
  onCycleEnd,
  active,
  reduced,
  clockRef,
  onNarrate,
  onSceneChange,
  onAnnotationChange,
}: {
  onCycleEnd: () => void;
  active: boolean;
  reduced: boolean;
  clockRef: MutableRefObject<() => number>;
  onNarrate: (step: number) => void;
  onSceneChange: (scene: number) => void;
  onAnnotationChange: (annotation: PlanningAnnotation | null) => void;
}) {
  const { language, direction } = useSiteLanguage();
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const bodyRef = useRef<HTMLDivElement>(null);
  /* Coin supérieur de début de grille, exprimé dans le repère du conteneur
     externe : sert à replacer les info-bulles hors du cadre rogné. */
  const [gridOrigin, setGridOrigin] = useState({ x: 0, y: 0 });
  const { cursor, moveTo, park, hide } = useScriptedCursor(containerRef, direction);

  /* État piloté par la chorégraphie */
  const [mutedChannel, setMutedChannel] = useState<Channel | null>(null);
  const [dragging, setDragging] = useState<{
    id: string;
    shift: number;
    conflict: boolean;
  } | null>(null);
  const [moved, setMoved] = useState<Record<string, number>>({});
  const [extended, setExtended] = useState<Record<string, number>>({});
  const [selection, setSelection] = useState<{
    row: number;
    start: number;
    nights: number;
  } | null>(null);
  /* Fiche voyageur : panneau ouvert, e-mail en cours de saisie, alerte levée. */
  const [guestPanel, setGuestPanel] = useState(false);
  const [email, setEmail] = useState('');
  const [infoFilled, setInfoFilled] = useState(false);
  /* Suite de la sélection : dialog pré-rempli, puis réservation créée. */
  const [createDialog, setCreateDialog] = useState(false);
  const [created, setCreated] = useState(false);
  /* Popover de logement (PropertyPopover) ouvert au clic sur la ligne. */
  const [propertyOpen, setPropertyOpen] = useState(false);
  /* Recherche de voyageur dans le dialog : saisie puis sélection. */
  const [guestQuery, setGuestQuery] = useState('');
  const [guestPicked, setGuestPicked] = useState(false);

  useLayoutEffect(() => {
    const measure = () => {
      const width = containerRef.current?.clientWidth ?? FRAME_WIDTH;
      setScale(width / FRAME_WIDTH);
      const c = containerRef.current;
      const b = bodyRef.current;
      if (c && b) {
        const cr = c.getBoundingClientRect();
        const br = b.getBoundingClientRect();
        setGridOrigin({ x: direction === 'rtl' ? cr.right - br.right : br.left - cr.left, y: br.top - cr.top });
      }
    };
    measure();
    /* Deuxième passe : la première pose l'échelle, la géométrie ne vaut qu'après. */
    const raf = requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', measure);
    };
  }, [scale, direction]);

  const find = (selector: string) =>
    containerRef.current?.querySelector<HTMLElement>(selector) ?? null;

  const narrated = useRef(-1);
  const explain = (step: number, target: string) => {
    onAnnotationChange({ step, target });
    if (narrated.current !== step) {
      narrated.current = step;
      onNarrate(step);
    }
    const element = find(target);
    const scroll = containerRef.current?.closest<HTMLElement>(
      '.bpm-planning-scroll',
    );
    if (element && scroll && scroll.scrollWidth > scroll.clientWidth) {
      const rect = element.getBoundingClientRect();
      const viewport = scroll.getBoundingClientRect();
      // Pan only horizontally, so each action stays visible on a small screen.
      scroll.scrollTo({
        left:
          scroll.scrollLeft +
          rect.left -
          viewport.left +
          rect.width / 2 -
          viewport.width / 2,
        behavior: 'smooth',
      });
    }
  };

  clockRef.current = useBaitlyPlanningTimeline(active, (at) => {
    const cues = PLANNING_VOICE_CUES[language === 'en' ? 'en' : 'fr'];
    let t = 900;
    at(t, park);
    t += 600;

    /** Une étape = une phrase de voix off. `cue(nom)` = instant où la voix
        nomme le geste ; le cadre s'efface quand la voix se tait. */
    const step = (index: number, script: (cue: (name: string) => number) => void) => {
      const begin = t;
      const timings = cues[index];
      script((name) => begin + Math.max(0, timings[name] - FRAME_LEAD_MS));
      t = begin + timings.end;
      at(t, () => onAnnotationChange(null));
      t += STEP_GAP_MS;
    };
    /** Le curseur part assez tôt pour arriver au moment du geste. */
    const reach = (when: number, selector: string) =>
      at(Math.max(0, when - CURSOR_TRAVEL_MS), () => moveTo(find(selector)));

    // 0 — La fiche du logement, ouverte sans quitter le planning.
    step(0, (cue) => {
      at(t, () => explain(0, '[data-prop-index="3"]'));
      reach(cue('click'), '[data-prop-index="3"]');
      at(cue('click'), () => setPropertyOpen(true));
      at(cue('panel'), () => explain(0, '[data-planning-panel="property"]'));
    });
    at(t - STEP_GAP_MS, () => setPropertyOpen(false));

    // 1 — Masquer Airbnb, puis tout réafficher.
    step(1, (cue) => {
      at(t, () => {
        onSceneChange(1);
        explain(1, '[data-chip="airbnb"]');
        moveTo(find('[data-chip="airbnb"]'));
      });
      at(cue('hide'), () => setMutedChannel('airbnb'));
      at(cue('show'), () => setMutedChannel(null));
    });

    // 2 — Glisser sur des dates prises : le conflit apparaît, le séjour revient.
    step(2, (cue) => {
      at(t, () => {
        onSceneChange(2);
        explain(2, '[data-bar="r9"]');
        moveTo(find('[data-bar="r9"]'));
      });
      const from = cue('drag');
      const span = cue('refuse') - from;
      for (let k = 1; k <= 6; k += 1) {
        at(from + (span * k) / 6, () => {
          setDragging({ id: 'r9', shift: k, conflict: k >= 4 });
          moveTo(find('[data-bar="r9"]'));
        });
      }
      at(cue('back'), () => setDragging(null));
    });

    // 3 — Sur des dates libres, le séjour de Mia se décale de deux jours.
    step(3, (cue) => {
      at(t, () => {
        onSceneChange(3);
        explain(3, '[data-bar="r9"]');
        moveTo(find('[data-bar="r9"]'));
      });
      const from = cue('drag');
      const span = cue('drop') - from;
      for (let k = 1; k <= 2; k += 1) {
        at(from + (span * k) / 3, () => {
          setDragging({ id: 'r9', shift: k, conflict: false });
          moveTo(find('[data-bar="r9"]'));
        });
      }
      at(cue('drop'), () => {
        setDragging(null);
        setMoved((state) => ({ ...state, r9: 2 }));
      });
    });

    // 4 — Prolonger le séjour de Luca de deux nuits.
    step(4, (cue) => {
      at(t, () => {
        explain(4, '[data-bar="r5"]');
        moveTo(find('[data-resize="r5"]'));
      });
      for (let k = 1; k <= 2; k += 1) {
        at(cue('stretch') + 200 + (k - 1) * 450, () => {
          setExtended((state) => ({ ...state, r5: k }));
          moveTo(find('[data-resize="r5"]'));
        });
      }
    });

    // 5 — Compléter la fiche de Kenji : ouvrir, saisir l'e-mail, enregistrer.
    const MAIL = 'k.sato@mail.jp';
    step(5, (cue) => {
      at(t, () => {
        onSceneChange(4);
        explain(5, '[data-bar="r2"]');
      });
      reach(cue('open'), '[data-fix="r2"]');
      at(cue('open'), () => setGuestPanel(true));
      at(cue('open') + 100, () => explain(5, '[data-planning-panel="guest"]'));
      reach(cue('type'), '[data-email-field]');
      const typing = Math.min(MAIL.length * 55, cue('save') - cue('type') - CURSOR_TRAVEL_MS);
      for (let i = 1; i <= MAIL.length; i += 1) {
        at(cue('type') + (typing * i) / MAIL.length, () => setEmail(MAIL.slice(0, i)));
      }
      reach(cue('save'), '[data-email-save]');
      at(cue('done'), () => setInfoFilled(true));
    });
    at(t - STEP_GAP_MS, () => setGuestPanel(false));

    // 6 — Sélectionner trois nuits libres.
    step(6, (cue) => {
      at(t, () => {
        onSceneChange(5);
        explain(6, '[data-cell="0-5"]');
        moveTo(find('[data-cell="0-5"]'));
      });
      for (let k = 1; k <= 3; k += 1) {
        at(cue('select') + (k - 1) * 300, () => {
          setSelection({ row: 0, start: 5, nights: k });
          moveTo(find('[data-cell="0-' + (5 + k - 1) + '"]'));
        });
      }
      at(cue('select') + 700, () => explain(6, '[data-planning-selection]'));
    });

    // 7 — Rechercher Sarah, la sélectionner, créer la réservation.
    const Q = 'Sarah';
    step(7, (cue) => {
      at(t, () => setCreateDialog(true));
      at(t + 100, () => explain(7, '[data-planning-panel="create"]'));
      reach(cue('search'), '[data-guest-field]');
      for (let i = 1; i <= Q.length; i += 1) {
        at(cue('search') + i * 150, () => setGuestQuery(Q.slice(0, i)));
      }
      reach(cue('pick'), '[data-guest-result]');
      at(cue('pick'), () => setGuestPicked(true));
      reach(cue('create'), '[data-create]');
      at(cue('create'), () => {
        onAnnotationChange(null);
        setCreateDialog(false);
        setSelection(null);
        setCreated(true);
      });
    });

    // 8 — La réservation apparaît, l'occupation se met à jour.
    step(8, (cue) => {
      at(t, () => {
        hide();
        explain(8, '[data-bar="rn"]');
      });
      at(cue('occupancy'), () => explain(8, '.bpm-occupancy'));
    });
    at(t + 900, onCycleEnd);
  });

  const m = usePlanningText();
  const properties = m.properties;
  const gridWidth = DAYS * DAY_W;
  const bodyHeight = (properties.length + FILLER_ROWS) * ROW_H;

  const frameHeight = PLANNING_FRAME_HEIGHT;
  const occupancy = Array.from({ length: DAYS }, (_, day) => {
    const occupied = new Set(
      [...RESAS, ...(created ? [CREATED_RESA] : [])]
        .filter((r) => {
          const start = r.start + (moved[r.id] ?? 0);
          return day >= start && day < start + r.nights + (extended[r.id] ?? 0);
        })
        .map((r) => r.row),
    );
    return Math.round((occupied.size / properties.length) * 100);
  });

  return (
    <div
      className="relative bpm-planning-canvas"
      lang={language}
      dir={direction}
      ref={containerRef}
      style={{ ...TOKENS, height: frameHeight * scale }}
    >
      <div
        className="relative"
        style={{
          width: FRAME_WIDTH,
          height: frameHeight,
          transform: 'scale(' + scale + ')',
          transformOrigin: direction === 'rtl' ? 'top right' : 'top left',
        }}
        role="img"
        aria-label={m.windowTitle}
      >
        <aside className="bpm-planning-sidebar" aria-hidden="true">
          <div className="bpm-planning-brand" data-playing={active}>
            <BaitlyMarkLogo variant="mark" size={32} tone="dark" />
          </div>
          <LayoutGridIcon />
          <HomeIcon />
          <span>
            <CalendarIcon />
          </span>
          <WrenchFill size={18} />
          <WalletIcon />
          <UsersIcon />
          <BuildingIcon />
          <SettingsIcon />
        </aside>
        <div className="bpm-planning-main">
          <Toolbar mutedChannel={mutedChannel} />
          <div className="bpm-planning-grid">
            <div className="relative flex" style={{ width: DESIGN_WIDTH }}>
              {/* Colonne logements */}
              <div style={{ width: PROP_W, flexShrink: 0 }}>
                <div
                  className="flex items-center px-4"
                  style={{
                    height: HEADER_H,
                    background: 'var(--pl-surface2)',
                    borderBottom: '1px solid var(--pl-line)',
                    borderInlineEnd: '1px solid var(--pl-line)',
                  }}
                >
                  <span
                    className="text-[10.5px] font-bold tracking-[.05em] uppercase tabular-nums"
                    style={{ color: 'var(--pl-faint)' }}
                  >
                    {demoNumber(properties.length, language)} {m.propertiesLabel}
                  </span>
                </div>
                {properties.map((property, index) => (
                  <div
                    key={property.name}
                    data-prop={property.name}
                    data-prop-index={index}
                    className="bpm-property"
                    style={{
                      height: ROW_H,
                      borderBottom: '1px solid var(--pl-line)',
                      borderInlineEnd: '1px solid var(--pl-line)',
                      background: 'var(--pl-card)',
                    }}
                  >
                    <img src={PROPERTY_PHOTOS[index]} alt="" loading="lazy" />
                    <div>
                      <strong>{property.name}</strong>
                      <span>{property.city.split(' · ')[0]}</span>
                    </div>
                    <span className="bpm-property-count">
                      <b>{demoNumber(UNIT_COUNTS[index] + 8, language)}</b>
                      <small>
                        <TagIcon size={10} />
                        {demoNumber(UNIT_COUNTS[index], language)}
                      </small>
                    </span>
                    <ChevronDownIcon
                      size={12}
                      style={{
                        width: 12,
                        height: 12,
                        color: 'var(--pl-muted)',
                      }}
                    />
                  </div>
                ))}
                {Array.from({ length: FILLER_ROWS }, (_, i) => (
                  <div
                    key={`fill-${i}`}
                    style={{ height: ROW_H, background: 'var(--pl-card)' }}
                  />
                ))}
              </div>

              {/* Grille */}
              <div className="relative" style={{ width: gridWidth }}>
                <DateHeaders />
                <div
                  ref={bodyRef}
                  className="relative"
                  style={{ height: bodyHeight }}
                >
                  {properties.map((property, row) => (
                    <Row key={property.name} row={row} selection={selection} />
                  ))}
                  {Array.from({ length: FILLER_ROWS }, (_, i) => (
                    <div
                      key={`grid-fill-${i}`}
                      className="absolute inset-x-0"
                      style={{
                        top: (properties.length + i) * ROW_H,
                        height: ROW_H,
                        backgroundImage: `repeating-linear-gradient(to ${direction === 'rtl' ? 'left' : 'right'}, transparent 0 ${
                          DAY_W - 1
                        }px, var(--pl-line) ${DAY_W - 1}px ${DAY_W}px)`,
                      }}
                    />
                  ))}

                  {[...RESAS, ...(created ? [CREATED_RESA] : [])].map(
                    (resa) => (
                      <Bar
                        key={resa.id}
                        resa={resa}
                        muted={mutedChannel === resa.channel}
                        shift={
                          (moved[resa.id] ?? 0) +
                          (dragging?.id === resa.id ? dragging.shift : 0)
                        }
                        extra={extended[resa.id] ?? 0}
                        dragging={dragging?.id === resa.id}
                        conflict={dragging?.id === resa.id && dragging.conflict}
                        infoFilled={infoFilled}
                      />
                    ),
                  )}

                  {/* Fiche voyageur à compléter — panneau ancré sous la brique */}
                  <BlockedBand />
                  <CancelledBar />

                  {/* Trait « maintenant » */}
                  <div
                    className="pointer-events-none absolute top-0 bottom-0 w-[2px]"
                    style={{
                      insetInlineStart: TODAY_INDEX * DAY_W + DAY_W * 0.42,
                      background: 'var(--pl-err)',
                      zIndex: 6,
                    }}
                  >
                    <span
                      className="absolute size-[10px] rounded-full"
                      style={{
                        top: -1,
                        left: -4,
                        background: 'var(--pl-err)',
                        boxShadow:
                          '0 0 0 3px color-mix(in srgb, #E5484D 25%, transparent)',
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="bpm-occupancy">
              <span style={{ width: PROP_W }}>{m.occupancyLabel}</span>
              <div>
                {occupancy.map((value, index) => (
                  <small
                    key={index}
                    style={{
                      width: DAY_W,
                      background: isWeekend(index, language) ? 'var(--pl-we)' : undefined,
                    }}
                  >
                    {demoNumber(value / 100, language, { style: 'percent', maximumFractionDigits: 0 })}
                  </small>
                ))}
              </div>
            </div>
          </div>
          <div className="bpm-planning-pagination">
            <span>{m.pageRange}</span>
            <ChevronLeftIcon className="bpm-directional-icon" size={14} />
            {m.previous}
            <strong>{demoNumber(1, language)}</strong>
            {m.next}
            <ChevronRightIcon className="bpm-directional-icon" size={14} />
          </div>
        </div>
      </div>

      {/* Info-bulles : hors du cadre rogné, au-dessus de tout (z-50). */}
      {guestPanel && (
        <Overlay
          origin={gridOrigin}
          scale={scale}
          gx={9 * DAY_W + DAY_W * 0.42}
          gy={ROW_H - 2}
        >
          <GuestPanel email={email} saved={infoFilled} />
        </Overlay>
      )}
      {createDialog && (
        <Overlay
          origin={gridOrigin}
          scale={scale}
          gx={5 * DAY_W + DAY_W * 0.42}
          gy={ROW_H - 2}
        >
          <CreateDialog query={guestQuery} picked={guestPicked} />
        </Overlay>
      )}
      {/* Fiche logement : remonte au-dessus de l'en-tête de grille, comme le
          popover réel qui flotte sur la barre d'outils (le héro photo la rend
          plus haute que la grille). */}
      {propertyOpen && (
        <Overlay origin={gridOrigin} scale={scale} gx={12} gy={-HEADER_H - 56}>
          <PropertyPopover />
        </Overlay>
      )}

      {!reduced && <Cursor cursor={cursor} />}
    </div>
  );
}

/* ─── Barre d'outils ────────────────────────────────────────────────────────── */

export function Toolbar({
  mutedChannel,
  agentAsk,
}: {
  mutedChannel: Channel | null;
  /** Constellation ouverte : le champ du header s'adresse aux agents et la
      légende migre dans la modale de filtres (comme PlanningPage). */
  agentAsk?: string;
}) {
  const m = usePlanningText();
  const { language } = useSiteLanguage();
  const chip = (active: boolean): CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 11.5,
    fontWeight: 600,
    lineHeight: 1,
    padding: '5px 10px',
    borderRadius: 8,
    minHeight: 27,
    color: 'var(--pl-body)',
    background: 'var(--pl-card)',
    border: '1px solid var(--pl-line2)',
    opacity: active ? 1 : 0.4,
    transition: 'opacity .16s cubic-bezier(.16,1,.3,1)',
  });

  return (
    <div>
      <div className="bpm-planning-header">
        <span className="bpm-planning-heading">
          <CalendarIcon />
          {m.title}
        </span>
        <span className="bpm-planning-nav">
          <ChevronLeftIcon className="bpm-directional-icon" size={15} />
        </span>
        <strong className="text-[14px] font-semibold">{demoDateLabel(DEMO_TODAY, language, { month: 'long', year: 'numeric' })}</strong>
        <span className="bpm-planning-nav">
          <ChevronRightIcon className="bpm-directional-icon" size={15} />
        </span>
        <span style={chip(true)}>
          <CalendarCheckIcon size={13} />
          {m.today}
        </span>
        <span
          className="flex items-center gap-0.5 rounded-[10px] p-[3px]"
          style={{
            background: 'var(--pl-field)',
            border: '1px solid var(--pl-line2)',
          }}
        >
          {m.zooms.map((zoom, index) => (
            <span
              key={zoom}
              className="rounded-[7px] px-[10px] py-[4px] text-[11px] font-semibold"
              style={
                index === 1
                  ? {
                      background: 'var(--pl-card)',
                      color: 'var(--pl-ink)',
                      boxShadow: '0 1px 3px rgba(21,36,45,.10)',
                    }
                  : { color: 'var(--pl-muted)' }
              }
            >
              {zoom}
            </span>
          ))}
        </span>
        <span className="bpm-planning-search" data-agent-ask={agentAsk ? true : undefined}>
          <SearchIcon size={14} />
          {agentAsk ?? m.search}
          {agentAsk && <kbd dir="ltr">⌘K</kbd>}
        </span>
        <BuildingIcon size={15} />
        <MoreVerticalIcon size={15} />
      </div>
      {!agentAsk && <div className="bpm-planning-filters">
        {(Object.keys(CHANNELS) as Channel[]).map((channel) => (
          <span
            key={channel}
            data-chip={channel}
            style={chip(mutedChannel !== channel)}
          >
            {CHANNELS[channel].logo ? (
              <img
                src={CHANNELS[channel].logo!}
                alt=""
                className="size-[15px] object-contain"
              />
            ) : (
              <GlobeIcon
                className="size-[15px]"
                style={{ color: 'var(--pl-accent)' }}
              />
            )}
            <bdi>{m.channels[channel]}</bdi>
          </span>
        ))}
        {(
          [
            [m.statuses.confirmed, STATUS.confirmed],
            [m.statuses.pending, STATUS.pending],
            [m.statuses.checkedIn, STATUS.checked_in],
            [m.statuses.checkedOut, STATUS.checked_out],
          ] as const
        ).map(([label, color]) => (
          <span key={label} style={chip(true)}>
            <span
              className="size-[9px] rounded-[3px]"
              style={{ background: color }}
            />
            {label}
          </span>
        ))}
        <span style={chip(true)}>
          <span
            className="size-[9px] rounded-[3px]"
            style={{ background: '#98a5ad' }}
          />
          {m.cancelled}
        </span>
        <span style={chip(true)}>
          <BroomFill size={16} style={{ color: '#2F9E8D' }} />
          <WrenchFill size={15} style={{ color: '#4F86C6' }} />
          {m.interventions}
        </span>
      </div>}
    </div>
  );
}

/* ─── En-tête de dates ──────────────────────────────────────────────────────── */

export function DateHeaders() {
  const dayLabels = usePlanningText().dayLabels;
  const { language } = useSiteLanguage();
  return (
    <div
      className="flex"
      style={{
        height: HEADER_H,
        background: 'var(--pl-surface2)',
        borderBottom: '1px solid var(--pl-line)',
      }}
    >
      {Array.from({ length: DAYS }, (_, day) => {
        const today = day === TODAY_INDEX;
        return (
          <div
            key={day}
            data-date-index={day}
            className="flex flex-col items-center justify-center gap-px"
            style={{
              width: DAY_W,
              borderInlineEnd:
                day === DAYS - 1 ? undefined : '1px solid var(--pl-line)',
              background: isWeekend(day, language) ? '#F2F6F7' : undefined,
            }}
          >
            <span
              className="text-[9.5px] leading-none font-bold tracking-[.04em] uppercase"
              style={{ color: today ? 'var(--pl-accent)' : 'var(--pl-faint)' }}
            >
              {dayLabels[(FIRST_DOW + day) % 7]}
            </span>
            {today ? (
              <span
                className="mt-0.5 flex size-6 items-center justify-center rounded-lg text-[14px] font-semibold tabular-nums"
                style={{ background: 'var(--pl-accent)', color: '#FFF' }}
              >
                {demoDateLabel(demoDate(day), language, { day: 'numeric' })}
              </span>
            ) : (
              <span
                className="text-[14px] font-semibold tabular-nums"
                style={{ color: 'var(--pl-body)' }}
              >
                {demoDateLabel(demoDate(day), language, { day: 'numeric' })}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Ligne de grille ───────────────────────────────────────────────────────── */

export function Row({
  row,
  selection,
}: {
  row: number;
  selection: { row: number; start: number; nights: number } | null;
}) {
  const { nightOne, nightMany } = usePlanningText();
  const { language } = useSiteLanguage();
  return (
    <div
      className="absolute inset-x-0"
      style={{
        top: row * ROW_H,
        height: ROW_H,
        borderBottom: '1px solid var(--pl-line)',
      }}
    >
      {Array.from({ length: DAYS }, (_, day) => (
        <div
          key={day}
          data-cell={`${row}-${day}`}
          className="absolute top-0 bottom-0 flex items-center justify-center"
          style={{
            insetInlineStart: day * DAY_W,
            width: DAY_W,
            borderInlineEnd: '1px solid var(--pl-line)',
            background:
              day === TODAY_INDEX
                ? 'color-mix(in srgb, #264672 5%, transparent)'
                : isWeekend(day, language)
                  ? 'var(--pl-we)'
                  : undefined,
          }}
        >
          <span
            className="flex items-center text-[11px] font-medium tabular-nums opacity-80"
            style={{ color: 'var(--pl-muted)' }}
          >
            <Amount value={NIGHTLY[row]} size={9} />
          </span>
          <span
            className="absolute bottom-1 end-1 flex items-center gap-px text-[8px]"
            style={{ color: 'var(--pl-faint)', opacity: 0.65 }}
          >
            <MoonIcon size={8} style={{ width: 8, height: 8 }} />
            {demoNumber((row % 2) + 1, language)}
          </span>
        </div>
      ))}

      {/* Sélection de nuits libres */}
      {selection?.row === row && (
        <div
          data-planning-selection
          className="absolute rounded-[9px]"
          style={{
            insetInlineStart: selection.start * DAY_W + DAY_W * 0.42,
            width: selection.nights * DAY_W - DAY_W * 0.17,
            top: BAR_TOP,
            height: BAR_H,
            background: 'color-mix(in srgb, #4A9B8E 25%, transparent)',
            border: '1.5px solid color-mix(in srgb, #4A9B8E 60%, transparent)',
            boxShadow: '0 2px 8px color-mix(in srgb, #4A9B8E 25%, transparent)',
            zIndex: 4,
          }}
        >
          <span
            className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold"
            style={{ color: '#1F5F55' }}
          >
            {demoNumber(selection.nights, language)} {selection.nights > 1 ? nightMany : nightOne}
          </span>
        </div>
      )}
    </div>
  );
}

/* ─── Fiche voyageur à compléter ────────────────────────────────────────────── */

/** Panneau ancré sous la réservation « Kenji Sato » (ligne 0, jour 9). */
function GuestPanel({ email, saved }: { email: string; saved: boolean }) {
  const m = usePlanningText().guestPanel;
  return (
    <div
      data-planning-panel="guest"
      className="rounded-[11px] p-3"
      style={{
        width: 246,
        background: 'var(--pl-card)',
        border: '1px solid var(--pl-line2)',
        boxShadow: '0 22px 50px -16px rgba(21,36,45,.40)',
      }}
    >
      <p
        className="text-[11px] font-semibold"
        style={{ color: 'var(--pl-ink)' }}
      >
        {m.title} · <bdi>Kenji Sato</bdi>
      </p>
      <p
        className="mt-0.5 flex items-center gap-1 text-[10.5px]"
        style={{ color: '#C28A52' }}
      >
        <Warning size={12} strokeWidth={2} /> {m.missingEmail}
      </p>
      <div
        data-email-field
        dir={email ? 'ltr' : undefined}
        className="mt-2 flex h-[28px] items-center rounded-[8px] px-2 text-[11px]"
        style={{
          background: 'var(--pl-field)',
          border: '1px solid var(--pl-line2)',
          color: email ? 'var(--pl-ink)' : 'var(--pl-faint)',
        }}
      >
        {email || m.email}
        {!saved && email && (
          <span
            className="ms-px inline-block h-[13px] w-px animate-pulse"
            style={{ background: 'var(--pl-accent)' }}
          />
        )}
      </div>
      <div className="mt-2 flex items-center justify-end gap-2">
        {saved ? (
          <span
            className="flex items-center gap-1 text-[10.5px] font-semibold"
            style={{ color: '#3E9C80' }}
          >
            <CheckBold size={11} /> {m.completed}
          </span>
        ) : (
          <span
            data-email-save
            className="rounded-[8px] px-2.5 py-1 text-[11px] font-semibold"
            style={{ background: 'var(--pl-accent)', color: '#FFF' }}
          >
            {m.save}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Calque des info-bulles. Elles vivent DANS le conteneur externe, pas dans la
 * carte : celle-ci est rognée (`overflow-hidden`) et met son contenu à
 * l'échelle, ce qui coupait en deux toute bulle plus haute que le cadre.
 * On convertit donc les coordonnées de la grille vers le repère externe.
 */
function Overlay({
  origin,
  scale,
  gx,
  gy,
  children,
}: {
  origin: { x: number; y: number };
  scale: number;
  /** Position dans le repère de la grille (px non mis à l'échelle). */
  gx: number;
  gy: number;
  children: React.ReactNode;
}) {
  const { direction } = useSiteLanguage();
  return (
    <div
      className="absolute"
      style={{
        insetInlineStart: origin.x + gx * scale,
        top: origin.y + gy * scale,
        zIndex: 50,
        /* Le panneau suit l'échelle de la grille : sinon il garde sa taille
           pleine sur un planning réduit et paraît disproportionné. */
        transform: `scale(${scale})`,
        transformOrigin: direction === 'rtl' ? 'top right' : 'top left',
      }}
    >
      {children}
    </div>
  );
}

/* ─── Plage bloquée & réservation annulée ───────────────────────────────────── */

/** Bande hachurée pleine hauteur de ligne (PlanningBlockedBand) : pas de brique
    colorée, un cadenas et le libellé « Bloqué » quand la place le permet. */
export function BlockedBand() {
  const m = usePlanningText();
  const width = BLOCKED.nights * DAY_W;
  return (
    <div
      className="absolute flex items-center justify-center gap-1.5"
      style={{
        insetInlineStart: BLOCKED.start * DAY_W,
        width,
        top: BLOCKED.row * ROW_H + 1,
        height: ROW_H - 2,
        background: 'color-mix(in srgb, var(--pl-muted) 8%, var(--pl-card))',
        backgroundImage:
          'repeating-linear-gradient(45deg, color-mix(in srgb, var(--pl-muted) 16%, transparent) 0 1px, transparent 1px 7px)',
        boxShadow:
          'inset 0 0 0 1px color-mix(in srgb, var(--pl-muted) 14%, transparent)',
        zIndex: 2,
      }}
      title={m.blockedReason}
    >
      <LockIcon className="size-3" style={{ color: 'var(--pl-muted)' }} />
      <span
        className="text-[11px] font-semibold"
        style={{ color: 'var(--pl-muted)' }}
      >
        {m.blocked}
      </span>
    </div>
  );
}

/** Brique annulée : fond hachuré, bordure tiretée, nom barré, avatar désaturé,
    et le petit bouton rond de masquage en haut à droite. */
export function CancelledBar() {
  const label = usePlanningText().cancelled;
  const left = CANCELLED.start * DAY_W + DAY_W * 0.42;
  const width = CANCELLED.nights * DAY_W - DAY_W * 0.17;
  return (
    <div
      className="absolute flex items-center gap-[7px] overflow-visible"
      style={{
        insetInlineStart: left,
        width,
        top: CANCELLED.row * ROW_H + BAR_TOP,
        height: BAR_H,
        borderRadius: 9,
        background: 'var(--pl-surface2)',
        backgroundImage:
          'repeating-linear-gradient(135deg, color-mix(in srgb, var(--pl-muted) 22%, transparent) 0 1.5px, transparent 1.5px 8px)',
        border: '1.5px dashed var(--pl-line2)',
        paddingBlock: 0,
        paddingInline: '5px 7px',
        zIndex: 3,
      }}
    >
      <span
        className="flex size-[26px] shrink-0 items-center justify-center overflow-hidden rounded-full"
        style={{ border: '1.5px solid var(--pl-line2)' }}
      >
        <span className="text-[10px]" style={{ color: 'var(--pl-muted)' }}>
          EP
        </span>
      </span>
      <span
        className="flex min-w-0 flex-col leading-[1.2]"
        style={{ color: 'var(--pl-muted)' }}
      >
        <span className="text-[9.5px] font-semibold opacity-85">{label}</span>
        <span className="truncate text-[12px] font-semibold line-through">
          <bdi>{CANCELLED.guest}</bdi>
        </span>
      </span>
      {/* Bouton de masquage (hideFromPlanning) */}
      <span
        className="absolute flex size-4 items-center justify-center rounded-full"
        style={{
          top: -6,
          insetInlineEnd: -6,
          background: 'var(--pl-muted)',
          color: '#FFF',
        }}
      >
        <XIcon className="size-2.5" />
      </span>
    </div>
  );
}

/* ─── Fiche logement (PropertyPopover) ──────────────────────────────────────── */

/** Reprend la fiche ouverte au clic sur un logement : identité, capacités,
    horaires, puis le bloc Performance 90 j (score, RevPAN, occupation, marge). */
/**
 * Fiche logement — reprend `src/modules/planning/PropertyPopover.tsx` : carte de
 * 270 px, photos du logement en héro (nom en blanc sur un voile, compteur du
 * carrousel), type, adresse, propriétaire, quatre pastilles (voyageurs, nuits
 * min., prix mis en avant, ménage), horaires, fréquence de ménage, performance
 * sur 90 jours et pied « Fermer » / « Voir la fiche ».
 */
function PropertyPopover() {
  const { language } = useSiteLanguage();
  const t = usePlanningText();
  const m = t.property;
  const LABEL = 9;
  const BODY = 11;

  const pill = (
    icon: React.ReactNode,
    label: string,
    value: React.ReactNode,
    highlight = false,
  ) => (
    <div
      className="min-w-0 rounded-[8px] p-[5px]"
      style={{
        border: `1px solid ${highlight ? '#3E9C80' : 'var(--pl-line2)'}`,
        background: highlight
          ? 'color-mix(in srgb, #3E9C80 10%, transparent)'
          : 'color-mix(in srgb, var(--pl-ink) 2.5%, transparent)',
      }}
    >
      <p
        className="mb-[2px] flex items-center gap-[4px] leading-none font-bold tracking-[.3px] uppercase"
        style={{ fontSize: LABEL, color: highlight ? '#3E9C80' : 'var(--pl-muted)' }}
      >
        {icon}
        {label}
      </p>
      <p
        className="text-[11.5px] leading-[1.2] font-semibold tabular-nums"
        style={{ color: highlight ? '#3E9C80' : 'var(--pl-ink)' }}
      >
        {value}
      </p>
    </div>
  );

  const row = (label: string, value: React.ReactNode, tone?: string) => (
    <div className="flex items-baseline justify-between">
      <span style={{ fontSize: LABEL, color: 'var(--pl-muted)' }}>{label}</span>
      <span
        className="font-bold tabular-nums"
        style={{ fontSize: BODY, color: tone ?? 'var(--pl-ink)' }}
      >
        {value}
      </span>
    </div>
  );

  const section = { borderTop: '1px solid var(--pl-line2)' };

  return (
    <div
      data-planning-panel="property"
      className="overflow-hidden rounded-[14px]"
      style={{
        width: 270,
        background: 'var(--pl-card)',
        border: '1px solid var(--pl-line2)',
        boxShadow: '0 22px 50px -16px rgba(21,36,45,.40)',
      }}
    >
      {/* Héro : photo du logement, nom sur un voile dégradé, compteur. */}
      <div className="relative m-2.5 h-[132px] overflow-hidden rounded-[10px]">
        <img
          src={PROPERTY_PHOTOS[3]}
          alt=""
          className="size-full object-cover"
          loading="lazy"
        />
        <span className="absolute end-2 top-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white tabular-nums">
          <bdi dir="ltr">{demoDigits('1 / 4', language)}</bdi>
        </span>
        <div
          className="absolute inset-x-0 bottom-0 h-[56px]"
          style={{
            background: 'linear-gradient(to top, rgba(0,0,0,0.74), rgba(0,0,0,0))',
          }}
        />
        <span className="absolute start-[10px] end-[10px] bottom-[10px] truncate text-[13px] leading-[1.25] font-bold text-white">
          {t.properties[3].name}
        </span>
      </div>

      {/* Type, adresse, propriétaire */}
      <div className="flex flex-col gap-1.5 px-3.5 py-2" style={section}>
        <span
          className="w-fit rounded-full px-2 py-0.5 text-[9px] font-semibold capitalize"
          style={{
            background: 'color-mix(in srgb, var(--pl-accent) 12%, transparent)',
            color: 'var(--pl-accent)',
          }}
        >
          {m.type}
        </span>
        <p className="flex items-start gap-1" style={{ fontSize: BODY, color: 'var(--pl-muted)' }}>
          <MapPinIcon className="mt-px size-[11px] shrink-0" />
          {m.address}
        </p>
        <p className="flex items-center gap-1" style={{ fontSize: BODY, color: 'var(--pl-muted)' }}>
          <UserIcon className="size-[11px] shrink-0" />
          {t.owner}
        </p>
      </div>

      {/* Pastilles, horaires, ménage */}
      <div className="px-3.5 py-2.5" style={section}>
        <div className="grid grid-cols-2 gap-1.5">
          {pill(<UsersIcon className="size-[11px]" />, m.maxGuests, demoNumber(6, language))}
          {pill(<BedDoubleIcon className="size-[11px]" />, m.minNights, demoNumber(2, language))}
          {pill(
            <MoroccanDirham size={11} />,
            m.nightlyPrice,
            <Amount value={850} size={10} />,
            true,
          )}
          {pill(
            <BroomFill size={11} />,
            m.cleaning,
            <Amount value={250} size={10} />,
          )}
        </div>
        <p
          className="mt-1.5 flex flex-wrap items-center gap-[7px]"
          style={{ fontSize: BODY, color: 'var(--pl-muted)' }}
        >
          <span className="flex items-center gap-1">
            <ClockIcon className="size-[11px]" style={{ color: '#3E9C80' }} />
            {m.checkIn} <b dir="ltr" style={{ color: 'var(--pl-ink)' }}>{demoDigits('15:00', language)}</b>
          </span>
          <span className="flex items-center gap-1">
            <ClockIcon className="size-[11px]" style={{ color: '#C28A52' }} />
            {m.checkOut} <b dir="ltr" style={{ color: 'var(--pl-ink)' }}>{demoDigits('11:00', language)}</b>
          </span>
        </p>
        <p
          className="mt-[4px] flex items-center gap-1"
          style={{ fontSize: BODY, color: 'var(--pl-muted)' }}
        >
          <CalendarIcon className="size-[11px] shrink-0" />
          {m.cleaningFrequency}{' '}
          <b style={{ color: 'var(--pl-ink)' }}>{m.cleaningValue}</b>
        </p>
      </div>

      {/* Performance 90 jours */}
      <div className="px-3.5 py-2.5" style={section}>
        <p
          className="mb-2 flex items-center gap-[5px] font-bold tracking-[.3px] uppercase"
          style={{ fontSize: LABEL, color: 'var(--pl-muted)' }}
        >
          <GaugeIcon className="size-[11px]" style={{ color: 'var(--pl-ink)' }} />
          {m.performance}
        </p>
        <div className="mb-0.5 flex justify-between">
          <span style={{ fontSize: LABEL, color: 'var(--pl-muted)' }}>{m.score}</span>
          <span className="font-bold tabular-nums" style={{ fontSize: BODY, color: '#C28A52' }}>
            <bdi dir="ltr">{demoDigits('64/100', language)}</bdi>
          </span>
        </div>
        <div
          className="mb-2.5 h-1 w-full overflow-hidden rounded-[2px]"
          style={{ background: 'var(--pl-line2)' }}
        >
          <div className="h-full rounded-[2px]" style={{ width: '64%', background: '#C28A52' }} />
        </div>
        <div className="flex flex-col gap-0.5">
          {row(m.revpan, <Amount value={548} size={10} />)}
          {row(m.occupancy, demoNumber(0.64, language, { style: 'percent' }))}
          {row(m.totalRevenue, <Amount value={49320} size={10} />)}
          {row(m.netMargin, demoNumber(0.86, language, { style: 'percent' }), '#3E9C80')}
        </div>
      </div>

      {/* Pied : « Voir la fiche » est l'action principale. */}
      <div className="flex gap-1.5 px-3.5 py-2.5" style={section}>
        <span
          className="flex flex-1 items-center justify-center gap-1 rounded-[8px] py-1.5 text-[11px] font-semibold"
          style={{ border: '1px solid var(--pl-line2)', color: 'var(--pl-body)' }}
        >
          <XIcon className="size-[13px]" /> {m.close}
        </span>
        <span
          className="flex flex-1 items-center justify-center gap-1 rounded-[8px] py-1.5 text-[11px] font-semibold text-white"
          style={{ background: 'var(--pl-accent)' }}
        >
          <EyeIcon className="size-[13px]" /> {m.openRecord}
        </span>
      </div>
    </div>
  );
}

/* ─── Dialog de création ────────────────────────────────────────────────────── */

/** Reprend ce que `ReservationDialog` pré-remplit depuis un drag-to-select :
    logement verrouillé, dates, nuits, prix/nuit et heures d'arrivée/départ. */
function CreateDialog({ query, picked }: { query: string; picked: boolean }) {
  const { language } = useSiteLanguage();
  const t = usePlanningText();
  const m = t.create;
  const line = (label: string, value: React.ReactNode) => (
    <div className="flex items-center justify-between gap-3">
      <span style={{ color: 'var(--pl-muted)' }}>{label}</span>
      <span
        className="font-semibold tabular-nums"
        style={{ color: 'var(--pl-ink)' }}
      >
        {value}
      </span>
    </div>
  );
  return (
    <div
      data-planning-panel="create"
      className="rounded-[11px] p-3.5"
      style={{
        width: 268,
        background: 'var(--pl-card)',
        border: '1px solid var(--pl-line2)',
        boxShadow: '0 22px 50px -16px rgba(21,36,45,.40)',
      }}
    >
      <p
        className="text-[12px] font-semibold"
        style={{ color: 'var(--pl-ink)' }}
      >
        {m.title}
      </p>
      <p className="mt-0.5 text-[10.5px]" style={{ color: 'var(--pl-muted)' }}>
        {t.createProperty}
      </p>
      <div className="mt-2.5 flex flex-col gap-1.5 text-[11px]">
        {line(m.stay, m.stayValue)}
        {line(m.nights, demoNumber(3, language))}
        {line(m.nightlyPrice, <Amount value={1250} size={10} />)}
        {line(m.arrivalDeparture, <bdi dir="ltr">{demoDigits('15:00 · 11:00', language)}</bdi>)}
        <div
          className="mt-1 flex items-center justify-between gap-3 border-t pt-2 text-[12px]"
          style={{ borderColor: 'var(--pl-line)' }}
        >
          <span style={{ color: 'var(--pl-muted)' }}>{m.total}</span>
          <span
            className="font-bold tabular-nums"
            style={{ color: 'var(--pl-ink)' }}
          >
            <Amount value={3750} size={11} />
          </span>
        </div>
      </div>
      {/* Voyageur : recherche dans le carnet, ou création à la volée. */}
      <div
        className="mt-2.5 border-t pt-2.5"
        style={{ borderColor: 'var(--pl-line)' }}
      >
        <p
          className="text-[9.5px] font-bold tracking-[.04em] uppercase"
          style={{ color: 'var(--pl-muted)' }}
        >
          {m.guest}
        </p>
        <div
          data-guest-field
          className="mt-1.5 flex h-[28px] items-center gap-1.5 rounded-[8px] px-2 text-[11px]"
          style={{
            background: 'var(--pl-field)',
            border: '1px solid var(--pl-line2)',
            color: 'var(--pl-ink)',
          }}
        >
          <SearchIcon
            className="size-3.5"
            style={{ color: 'var(--pl-faint)' }}
          />
          <span style={{ color: query ? 'var(--pl-ink)' : 'var(--pl-faint)' }}>
            {query ? <bdi>{query}</bdi> : t.searchGuest}
          </span>
        </div>
        {/* Le carnet ne répond qu'à partir de 3 caractères — sinon la fiche
            complète surgirait dès la première lettre, avant même qu'on ait
            saisi quoi que ce soit de discriminant. */}
        {query.length >= 3 && (
          <div
            data-guest-result
            className="mt-1.5 flex items-center gap-2 rounded-[8px] p-1.5"
            style={{
              background: picked ? 'var(--pl-accent-soft)' : 'transparent',
              border: `1px solid ${
                picked
                  ? 'color-mix(in srgb, var(--pl-accent) 30%, transparent)'
                  : 'var(--pl-line2)'
              }`,
            }}
          >
            <span
              className="flex size-6 shrink-0 items-center justify-center rounded-full text-[10px]"
              style={{
                background: 'var(--pl-accent-soft)',
                color: 'var(--pl-accent)',
              }}
              aria-hidden="true"
            >
              SM
            </span>
            <span className="flex min-w-0 flex-col leading-tight">
              <span
                className="text-[11px] font-semibold"
                style={{ color: 'var(--pl-ink)' }}
              >
                <bdi>Sarah Miller</bdi>
              </span>
              <span
                className="truncate text-[10px]"
                style={{ color: 'var(--pl-muted)' }}
              >
                <bdi dir="ltr">sarah.miller@mail.com</bdi> · {t.guestPanel.previousStays}
              </span>
            </span>
            {picked && (
              <CheckBold
                size={12}
                style={{ color: 'var(--pl-accent)', marginInlineStart: 'auto' }}
              />
            )}
          </div>
        )}
        <p
          className="mt-1.5 flex items-center gap-1 text-[10px]"
          style={{ color: 'var(--pl-accent)' }}
        >
          <PlusIcon className="size-3" /> {m.newGuest}
        </p>
      </div>

      <div className="mt-3 flex items-center justify-end gap-2">
        <span className="text-[11px]" style={{ color: 'var(--pl-muted)' }}>
          {m.cancel}
        </span>
        <span
          data-create
          className="rounded-[8px] px-3 py-1.5 text-[11px] font-semibold"
          style={{ background: 'var(--pl-accent)', color: '#FFF' }}
        >
          {m.submit}
        </span>
      </div>
    </div>
  );
}

/* ─── Brique de réservation ─────────────────────────────────────────────────── */

export function Bar({
  resa,
  muted,
  shift,
  extra,
  dragging,
  conflict,
  infoFilled,
}: {
  resa: Resa;
  muted: boolean;
  shift: number;
  extra: number;
  dragging: boolean;
  conflict: boolean;
  /** La fiche voyageur vient d'être complétée → l'alerte s'éteint. */
  infoFilled: boolean;
}) {
  const { nightOne, nightMany } = usePlanningText();
  const { language, direction } = useSiteLanguage();
  const { currency } = useSiteCurrency();
  const nameRef = useRef<HTMLSpanElement>(null);
  const [measuredFold, setMeasuredFold] = useState({ key: '', level: 0 });
  const nights = resa.nights + extra;
  const left = resa.start * DAY_W + DAY_W * (15 / 24);
  // Comme computeBarLayout : le budget s'arrête au dernier jour visible,
  // sinon les pastilles de droite seraient coupées par le bord de la grille.
  const width = Math.min(
    nights * DAY_W - DAY_W * (4 / 24),
    DAYS * DAY_W - left - shift * DAY_W,
  );
  const color = STATUS[resa.status];
  const layoutKey = [width, resa.guest, resa.price, resa.paid, resa.cleaning?.fee,
    resa.cleaning?.paid, resa.maintenance, resa.missingInfo, infoFilled, language, currency].join('|');
  const feeAsPill = width >= BAR_FEE_PILL_MIN;

  /* Indicateurs candidats à la zone droite, dans l'ordre du planning. */
  const indicators: { key: string; node: React.ReactNode }[] = [];
  if (resa.missingInfo && !infoFilled) {
    indicators.push({
      key: 'miss',
      node: (
        <span data-fix={resa.id} key="miss">
          <BarBadge>
            <Warning size={13} strokeWidth={2} style={{ color: '#C28A52' }} />
          </BarBadge>
        </span>
      ),
    });
  }
  if (resa.cleaning) {
    indicators.push({
      key: 'cleaning',
      node: feeAsPill ? (
        <span
          key="cleaning"
          className="flex h-[21px] shrink-0 items-center gap-1 rounded-[7px] bg-white ps-[5px] pe-[7px] text-[10.5px] font-bold tabular-nums"
          style={{ color: '#15242D', boxShadow: '0 1px 2px rgba(0,0,0,.14)' }}
        >
          <BroomFill size={13} style={{ color: '#2F9E8D' }} />
          <Amount value={resa.cleaning.fee} size={10} />
          {resa.cleaning.paid ? (
            <CheckBold size={10} style={{ color: '#3E9C80' }} />
          ) : (
            <CreditCardFill size={11} style={{ color: '#C9803F' }} />
          )}
        </span>
      ) : (
        <BarBadge key="cleaning">
          <BroomFill size={13} style={{ color: '#2F9E8D' }} />
        </BarBadge>
      ),
    });
  }
  if (resa.maintenance) {
    indicators.push({
      key: 'maint',
      node: (
        <BarBadge key="maint">
          <WrenchFill size={13} style={{ color: '#4F86C6' }} />
        </BarBadge>
      ),
    });
  }

  const {
    foldLevel,
    showAvatar,
    showLabel: showName,
    priceAmountVisible: priceAmount,
    priceInline,
    showBadgeGroup,
    shownIndicatorCount,
    channelFolded,
    overflowCount: foldedTotal,
  } = getBarContentLayout({
    width,
    height: BAR_H,
    guestName: resa.guest,
    hasPrice: resa.price > 0,
    hasChannel: true,
    indicatorCount: indicators.length,
    minimumFoldLevel: measuredFold.key === layoutKey ? measuredFold.level : 0,
  });
  const shown = indicators.slice(0, shownIndicatorCount);
  const missingInfoFolded = indicators.slice(shownIndicatorCount).some((item) => item.key === 'miss');

  // Le mockup change de devise et de police selon la langue. Le même palier
  // de repli est avancé si les dimensions réelles dépassent le budget du PMS.
  // clientWidth/scrollWidth restent justes même dans le moniteur en perspective.
  useLayoutEffect(() => {
    const name = nameRef.current;
    if (!name || foldLevel >= 3) return;
    let disposed = false;
    const measure = () => {
      if (!disposed && name.scrollWidth > name.clientWidth + 1) {
        setMeasuredFold({ key: layoutKey, level: foldLevel + 1 });
      }
    };
    measure();
    void name.ownerDocument.fonts?.ready.then(measure);
    return () => { disposed = true; };
  }, [foldLevel, layoutKey]);

  return (
    <>
      <div
        data-bar={resa.id}
        data-fold-level={foldLevel}
        className={`absolute flex items-center gap-[7px] overflow-hidden${
          resa.missingInfo && !infoFilled && !muted ? ' pl-urgent' : ''
        }`}
        style={{
          ['--pl-bc' as string]: color,
          insetInlineStart: left,
          transform: 'translateX(' + (direction === 'rtl' ? -1 : 1) * shift * DAY_W + 'px)',
          width,
          top: resa.row * ROW_H + BAR_TOP,
          height: BAR_H,
          borderRadius: 9,
          background: color,
          color: BAITLY_PLANNING_STATUS[resa.status].foreground,
          paddingBlock: 0,
          paddingInline: '5px 7px',
          zIndex: dragging ? 8 : 3,
          opacity: muted ? 0.12 : dragging ? 0.85 : 1,
          boxShadow: conflict
            ? '0 0 0 2px var(--pl-err), 0 8px 18px -8px rgba(229,72,77,.6)'
            : dragging
              ? '0 10px 22px -10px rgba(21,36,45,.55)'
              : undefined,
          transition:
            'transform .22s cubic-bezier(.16,1,.3,1), opacity .18s ease-out, box-shadow .18s ease-out',
        }}
      >
        {showAvatar && (
          <GuestAvatar
            name={resa.guest}
            photoUrl={resa.photo}
            size={26}
            sx={{
              border: '1.5px solid rgba(255,255,255,.55)',
              background: 'rgba(255,255,255,.22)',
              fontSize: 9.5,
            }}
          />
        )}

        {showName && (
          <span className="bpm-reservation-copy flex min-w-0 flex-1 flex-col leading-[1.2]">
            <span className="truncate text-[9.5px] font-semibold opacity-85">
              {demoNumber(nights, language)} {nights > 1 ? nightMany : nightOne}
            </span>
            <span ref={nameRef} data-guest-name className="truncate text-[12px] font-semibold">
              <bdi>{resa.guest}</bdi>
            </span>
          </span>
        )}

        <span className="ms-auto flex shrink-0 items-center gap-[5px]">
          {/* Prix du séjour : montant si la place le permet, sinon icône seule. */}
          {priceInline && (
            <span
              data-bar-price
              className="flex h-[21px] shrink-0 items-center gap-1 rounded-[7px] text-[11px] font-bold whitespace-nowrap tabular-nums"
              style={{
                padding: priceAmount ? '0 8px' : '0 6px',
                ...(resa.paid
                  ? {
                      background:
                        resa.status === 'checked_out' ||
                        resa.status === 'pending'
                          ? 'rgba(252,250,247,.4)'
                          : 'rgba(38,24,12,.2)',
                      color: BAITLY_PLANNING_STATUS[resa.status].foreground,
                      boxShadow: 'inset 0 0 0 1px rgba(252,252,250,.3)',
                    }
                  : {
                      background: '#FFF',
                      color: '#B25A2A',
                      boxShadow: '0 1px 2px rgba(0,0,0,.14)',
                    }),
              }}
            >
              {resa.paid ? (
                <CheckBold size={12} />
              ) : (
                <CreditCardFill size={13} style={{ color: '#C9803F' }} />
              )}
              {priceAmount && <Amount value={resa.price} />}
            </span>
          )}

          {showBadgeGroup && shown.map((indicator) => indicator.node)}

          {/* Pastille de repli : tout ce qui n'avait pas la place. */}
          {showBadgeGroup && foldedTotal > 0 && (
            <span
              data-bar-overflow
              data-fix={missingInfoFolded ? resa.id : undefined}
              className="flex size-[21px] shrink-0 items-center justify-center rounded-[7px] text-[10px] font-bold tabular-nums"
              style={{ background: 'rgba(255,255,255,.9)', color: '#15242D' }}
            >
              <bdi dir="ltr">+{demoNumber(foldedTotal, language)}</bdi>
            </span>
          )}

          {!channelFolded && <ChannelBadge channel={resa.channel} />}
        </span>

        {/* Poignée d'étirement au bord de fin du séjour, à gauche en RTL. */}
        <span
          data-resize={resa.id}
          className="absolute top-0 end-0 bottom-0 w-2"
          style={{ cursor: 'col-resize' }}
        />
      </div>
    </>
  );
}
