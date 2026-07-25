import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import {
  BedDoubleIcon,
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
import g1 from '../assets/guests/g1.jpg';
import g2 from '../assets/guests/g2.jpg';
import g3 from '../assets/guests/g3.jpg';
import g4 from '../assets/guests/g4.jpg';
import g5 from '../assets/guests/g5.jpg';
import g6 from '../assets/guests/g6.jpg';
import g7 from '../assets/guests/g7.jpg';
import g8 from '../assets/guests/g8.jpg';
import g9 from '../assets/guests/g9.jpg';
import g10 from '../assets/guests/g10.jpg';
import g11 from '../assets/guests/g11.jpg';
import g12 from '../assets/guests/g12.jpg';
import { Cursor, useReducedMotion, useScriptedCursor, useTimeline } from './mockupKit';

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
const PROP_W = 176;
const DAY_W = 74;
const ROW_H = 54;
const HEADER_H = 52;
const BAR_H = 36;
const BAR_TOP = 9;
/* Lignes vides de remplissage, comme le planning quand la page contient moins
   de logements que la hauteur disponible — elles donnent aussi la place
   qu'exige la fiche logement ouverte. */
const FILLER_ROWS = 3;
const DAYS = 14;
const DESIGN_WIDTH = PROP_W + DAYS * DAY_W;

/* Seuils de repli de la brique — valeurs de planning/constants.ts:112-114.
   Au-dessus : prix en pilule icône + montant ; entre les deux : icône seule ;
   en dessous : le prix bascule dans le « +N ». La pilule de tarif prestation
   n'apparaît qu'à partir de BAR_FEE_PILL_MIN. */
const BAR_PRICE_AMOUNT_MIN = 150;
const BAR_PRICE_INLINE_MIN = 104;
const BAR_FEE_PILL_MIN = 184;
/* Seuils d'affichage des éléments de gauche (PlanningBar). */
const BAR_AVATAR_MIN = 90;
const BAR_NAME_MIN = 40;
const BAR_CHANNEL_MIN = 60;

/** Palette « Signature » du planning, portée localement : le site marketing
    n'expose que les tokens --bui-*, pas ceux de l'application. */
const TOKENS = {
  '--pl-card': '#FFFFFF',
  '--pl-surface2': '#FBFCFC',
  '--pl-line': '#E7ECEF',
  '--pl-line2': '#DDE3E7',
  '--pl-ink': '#15242D',
  '--pl-body': '#3B4951',
  '--pl-muted': '#67757C',
  '--pl-faint': '#98A4AB',
  '--pl-accent': '#5453D6',
  '--pl-accent-soft': 'rgba(84,83,214,.10)',
  '--pl-we': '#F8FAFB',
  '--pl-field': '#EFF2F4',
  '--pl-err': '#E5484D',
} as CSSProperties;

const STATUS = {
  confirmed: '#3E9C80',
  pending: '#C28A52',
  checked_in: '#4F86C6',
  checked_out: '#9A7FA3',
};

const CHANNELS = {
  airbnb: { label: 'Airbnb', color: '#E0735A', logo: airbnbLogo },
  booking: { label: 'Booking.com', color: '#4A6B9A', logo: bookingLogo },
  direct: { label: 'Direct', color: '#5453D6', logo: null },
};

/* ─── Données de la grille ──────────────────────────────────────────────────── */

const PROPERTIES = [
  /* Portefeuille réparti sur le pays — un seul bien à Marrakech, comme demandé.
     Les noms suivent le quartier ou le repère local de chaque ville. */
  { name: 'Riad Bab Doukkala', city: 'Fès · Médina', count: 4 },
  { name: 'Duplex Anfa Place', city: 'Casablanca · Anfa', count: 3 },
  { name: 'Villa Founty', city: 'Agadir · Founty', count: 5 },
  { name: 'Appart. Guéliz', city: 'Marrakech · Guéliz', count: 3 },
  { name: 'Dar Bab Bhar', city: 'Rabat · Kasbah des Oudayas', count: 4 },
  { name: 'Studio Malabata', city: 'Tanger · Malabata', count: 2 },
];

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
  /** Photo du voyageur affichée dans la brique. */
  photo: string;
}

const RESAS: Resa[] = [
  /* Statuts conformes à `computeEffectiveStatus` du planning : le mauve
     (check-out) n'existe QUE dans le passé, le bleu (check-in) uniquement à
     cheval sur aujourd'hui, et le futur est vert (réglé) ou orange (à régler). */
  // Passé — départs effectués (mauve)
  { id: 'r1', photo: g1, row: 0, start: 0, nights: 2, status: 'checked_out', guest: 'Hans Müller', channel: 'airbnb', price: 4800, paid: true },
  { id: 'r11', photo: g11, row: 5, start: 0, nights: 2, status: 'checked_out', guest: 'Sophie Dubois', channel: 'direct', price: 8200, paid: true },
  // En cours — à cheval sur aujourd'hui (bleu)
  { id: 'r3', photo: g3, row: 1, start: 1, nights: 4, status: 'checked_in', guest: 'Carlos García', channel: 'airbnb', price: 3200, paid: true },
  { id: 'r7', photo: g7, row: 3, start: 2, nights: 7, status: 'checked_in', guest: 'Ahmed Bennani', channel: 'direct', price: 9800, paid: true, maintenance: true },
  // À venir, réglées (vert)
  { id: 'r4', photo: g4, row: 1, start: 8, nights: 6, status: 'confirmed', guest: 'Anna Kowalski', channel: 'direct', price: 7100, paid: true, cleaning: { fee: 400, paid: false } },
  { id: 'r5', photo: g5, row: 2, start: 5, nights: 4, status: 'confirmed', guest: 'Luca Rossi', channel: 'booking', price: 6400, paid: true, cleaning: { fee: 450, paid: false } },
  { id: 'r9', photo: g9, row: 4, start: 4, nights: 4, status: 'confirmed', guest: 'Mia Andersson', channel: 'airbnb', price: 4400, paid: true, cleaning: { fee: 350, paid: true } },
  { id: 'r10', photo: g10, row: 4, start: 11, nights: 3, status: 'confirmed', guest: 'Nadia Alami', channel: 'airbnb', price: 3900, paid: true },
  { id: 'r8', photo: g8, row: 3, start: 10, nights: 4, status: 'confirmed', guest: 'Julia Wagner', channel: 'booking', price: 6900, paid: true },
  // À venir, à régler (orange)
  { id: 'r2', photo: g2, row: 0, start: 9, nights: 5, status: 'pending', guest: 'Kenji Sato', channel: 'booking', price: 5600, paid: false, missingInfo: true },
  /* Départ au jour 11 : `r5` est étirée de 2 nuits par la chorégraphie (5→11).
     Toute date antérieure la ferait chevaucher — ce que le planning refuserait. */
  { id: 'r6', photo: g6, row: 2, start: 11, nights: 3, status: 'pending', guest: 'Dounia B.', channel: 'airbnb', price: 5200, paid: false },
  { id: 'r12', photo: g12, row: 5, start: 8, nights: 3, status: 'pending', guest: 'Tom Lefèvre', channel: 'booking', price: 3600, paid: false },
];

/** Réservation posée par la chorégraphie à l'issue du dialog de création.
    Directe et non encore réglée → « En attente » (orange), conforme à
    `computeEffectiveStatus` : le vert exige un paiement encaissé. */
const CREATED_RESA: Resa = {
  id: 'rn', photo: g5, row: 0, start: 5, nights: 3, status: 'pending',
  guest: 'Sarah Miller', channel: 'direct', price: 3750, paid: false,
};

/** Plage bloquée (indisponibilité manuelle) — bande hachurée, pas une brique. */
const BLOCKED = { row: 5, start: 3, nights: 4, reason: 'Travaux salle de bain' };

/** Réservation annulée : brique fantôme hachurée, nom barré, avatar grisé. */
const CANCELLED: Resa = {
  id: 'rc', photo: g8, row: 1, start: 5, nights: 3, status: 'pending',
  guest: 'Elena Petrova', channel: 'booking', price: 2940, paid: false,
};

/** Prix par nuit affichés dans les cellules libres (par logement). */
const NIGHTLY = [1250, 980, 2100, 850, 1400, 720];

const DAY_LABELS = ['SAM', 'DIM', 'LUN', 'MAR', 'MER', 'JEU', 'VEN'];
const FIRST_DOW = 5; // la grille commence un jeudi
const TODAY_INDEX = 3;

const isWeekend = (day: number) => {
  const dow = (FIRST_DOW + day) % 7;
  return dow === 0 || dow === 1; // SAM / DIM
};

/** Numéro du jour, avec bascule sur septembre : août compte 31 jours. */
const FIRST_DAY = 23;
const AUGUST_DAYS = 31;
const dayNumber = (day: number) => ((FIRST_DAY + day - 1) % AUGUST_DAYS) + 1;

const fmt = (value: number) => value.toLocaleString('fr-FR');

/**
 * Montant en dirhams. Le composant `Money` de l'application rend MAD en ICÔNE
 * (jamais le code « MAD ») — on reprend le même glyphe `MoroccanDirham`, sans
 * embarquer le contexte devise ni MUI dans le site.
 */
function Amount({ value, size = 11 }: { value: number; size?: number }) {
  /* Montant et glyphe forment un bloc insécable : rendus en frères libres, le
     symbole se retrouvait renvoyé à la ligne dès que le conteneur se resserrait. */
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
      {fmt(value)}
      <MoroccanDirham size={size + 2} style={{ marginInlineStart: 2 }} />
    </span>
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

/** Pastille du canal d'origine : logo officiel, ou globe pour le direct. */
function ChannelBadge({ channel }: { channel: Channel }) {
  const { logo, label } = CHANNELS[channel];
  return (
    <BarBadge>
      {logo ? (
        <img src={logo} alt="" className="size-[13px] object-contain" />
      ) : (
        <GlobeIcon className="size-[13px]" style={{ color: '#5453D6' }} aria-label={label} />
      )}
    </BarBadge>
  );
}

export default function AnimatedPlanningMockup() {
  const [cycle, setCycle] = useState(0);
  return <PlanningScene key={cycle} onCycleEnd={() => setCycle((current) => current + 1)} />;
}

function PlanningScene({ onCycleEnd }: { onCycleEnd: () => void }) {
  const reduced = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const bodyRef = useRef<HTMLDivElement>(null);
  /* Coin haut-gauche du corps de grille, exprimé dans le repère du conteneur
     externe : sert à replacer les info-bulles hors du cadre rogné. */
  const [gridOrigin, setGridOrigin] = useState({ x: 0, y: 0 });
  const { cursor, moveTo, park, hide } = useScriptedCursor(containerRef);

  /* État piloté par la chorégraphie */
  const [mutedChannel, setMutedChannel] = useState<Channel | null>(null);
  const [dragging, setDragging] = useState<{ id: string; shift: number; conflict: boolean } | null>(null);
  const [moved, setMoved] = useState<Record<string, number>>({});
  const [extended, setExtended] = useState<Record<string, number>>({});
  const [selection, setSelection] = useState<{ row: number; start: number; nights: number } | null>(null);
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
      const width = containerRef.current?.clientWidth ?? DESIGN_WIDTH;
      setScale(Math.min(1, width / DESIGN_WIDTH));
      const c = containerRef.current;
      const b = bodyRef.current;
      if (c && b) {
        const cr = c.getBoundingClientRect();
        const br = b.getBoundingClientRect();
        setGridOrigin({ x: br.left - cr.left, y: br.top - cr.top });
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
  }, [scale]);

  const find = (selector: string) =>
    containerRef.current?.querySelector<HTMLElement>(selector) ?? null;

  useTimeline(!reduced, (at) => {
    let t = 900;
    at(t, park);

    /* 0. Clic sur un logement → fiche enrichie (PropertyPopover). */
    t += 1000;
    at(t, () => moveTo(find('[data-prop="Appart. Guéliz"]')));
    t += 900;
    at(t, () => setPropertyOpen(true));
    t += 4200;
    at(t, () => setPropertyOpen(false));

    /* 1. Filtre canal : on éteint Airbnb, puis on le rallume. */
    t += 1200;
    at(t, () => moveTo(find('[data-chip="airbnb"]')));
    t += 1000;
    at(t, () => setMutedChannel('airbnb'));
    t += 2400;
    at(t, () => setMutedChannel(null));

    /* 2. Glisser « Mia Andersson » sur la plage de « Nadia Alami » → refusé. */
    t += 1000;
    at(t, () => moveTo(find('[data-bar="r9"]')));
    t += 900;
    for (let step = 1; step <= 9; step += 1) {
      at(t + step * 110, () => {
        setDragging({ id: 'r9', photo: g9, shift: step, conflict: step >= 6 });
        moveTo(find('[data-bar="r9"]'), step * DAY_W * 0.55);
      });
    }
    t += 9 * 110 + 900;
    at(t, () => setDragging(null)); // drop refusé : la brique revient

    /* 3. Déplacement valide de 2 jours. */
    t += 1400;
    for (let step = 1; step <= 2; step += 1) {
      at(t + step * 220, () => setDragging({ id: 'r9', photo: g9, shift: step, conflict: false }));
    }
    t += 2 * 220 + 700;
    at(t, () => {
      setDragging(null);
      setMoved((state) => ({ ...state, r9: 2 }));
    });

    /* 4. Étirer « Luca Rossi » : le ménage suit le nouveau départ. */
    t += 1300;
    at(t, () => moveTo(find('[data-resize="r5"]')));
    t += 900;
    for (let step = 1; step <= 2; step += 1) {
      at(t + step * 420, () => {
        setExtended((state) => ({ ...state, r5: step }));
        moveTo(find('[data-resize="r5"]'));
      });
    }
    t += 2 * 420 + 1400;

    /* 5. Fiche voyageur incomplète : on clique l'alerte, on saisit l'e-mail,
          l'alerte s'éteint. */
    const MAIL = 'k.sato@mail.jp';
    t += 1200;
    at(t, () => moveTo(find('[data-fix="r2"]')));
    t += 950;
    at(t, () => setGuestPanel(true));
    t += 700;
    at(t, () => moveTo(find('[data-email-field]')));
    t += 500;
    for (let i = 1; i <= MAIL.length; i += 1) {
      at(t + i * 55, () => setEmail(MAIL.slice(0, i)));
    }
    t += MAIL.length * 55 + 500;
    at(t, () => moveTo(find('[data-email-save]')));
    t += 800;
    at(t, () => setInfoFilled(true));
    t += 1600;
    at(t, () => setGuestPanel(false));

    /* 6. Sélection de nuits libres sur un logement vide. */
    t += 700;
    at(t, () => moveTo(find('[data-cell="0-5"]')));
    t += 800;
    for (let step = 1; step <= 3; step += 1) {
      at(t + step * 300, () => {
        setSelection({ row: 0, start: 5, nights: step });
        moveTo(find(`[data-cell="0-${5 + step - 1}"]`));
      });
    }
    t += 3 * 300 + 700;
    at(t, () => setCreateDialog(true));
    // Recherche du voyageur, caractère par caractère, puis sélection.
    const Q = 'Sarah';
    t += 700;
    at(t, () => moveTo(find('[data-guest-field]')));
    t += 500;
    for (let i = 1; i <= Q.length; i += 1) {
      at(t + i * 150, () => setGuestQuery(Q.slice(0, i)));
    }
    t += Q.length * 150 + 700;
    at(t, () => moveTo(find('[data-guest-result]')));
    t += 900;
    at(t, () => setGuestPicked(true));

    t += 1200;
    at(t, () => moveTo(find('[data-create]')));
    t += 1000;
    at(t, () => {
      setCreateDialog(false);
      setSelection(null);
      setCreated(true);
    });
    t += 2400;

    /* Respiration finale avant de rejouer. */
    t += 900;
    at(t, hide);
    at(t + 3000, () => {
      setMoved({});
      setExtended({});
      setInfoFilled(false);
      setEmail('');
      setCreated(false);
      setGuestQuery('');
      setGuestPicked(false);
    });
    at(t + 4200, onCycleEnd);
  });

  const gridWidth = DAYS * DAY_W;
  const bodyHeight = (PROPERTIES.length + FILLER_ROWS) * ROW_H;

  return (
    <div className="relative" ref={containerRef} style={TOKENS}>
      <div className="hero-grid absolute -inset-8 -z-10" aria-hidden />
      <div
        className="shadow-brand overflow-hidden rounded-xl border"
        style={{ borderColor: 'var(--pl-line)', background: 'var(--pl-card)' }}
      >
        {/* Barre fenêtre */}
        <div
          className="flex items-center gap-1.5 border-b px-4 py-2.5"
          style={{ borderColor: 'var(--pl-line)' }}
        >
          <span className="size-2.5 rounded-full" style={{ background: 'var(--pl-line2)' }} />
          <span className="size-2.5 rounded-full" style={{ background: 'var(--pl-line2)' }} />
          <span className="size-2.5 rounded-full" style={{ background: 'var(--pl-line2)' }} />
          <span className="ms-3 text-xs" style={{ color: 'var(--pl-muted)' }}>
            app.baitly — Planning
          </span>
        </div>

        <div
          className="origin-top-left"
          style={{ width: DESIGN_WIDTH, transform: `scale(${scale})`, height: (HEADER_H + bodyHeight + 96) * scale }}
        >
          <Toolbar mutedChannel={mutedChannel} />

          <div className="relative flex" style={{ width: DESIGN_WIDTH }}>
            {/* Colonne logements */}
            <div style={{ width: PROP_W, flexShrink: 0 }}>
              <div
                className="flex items-center px-4"
                style={{
                  height: HEADER_H,
                  background: 'var(--pl-surface2)',
                  borderBottom: '1px solid var(--pl-line)',
                  borderRight: '1px solid var(--pl-line)',
                }}
              >
                <span
                  className="text-[10.5px] font-bold tracking-[.05em] uppercase tabular-nums"
                  style={{ color: 'var(--pl-faint)' }}
                >
                  {PROPERTIES.length} logements
                </span>
              </div>
              {PROPERTIES.map((property) => (
                <div
                  key={property.name}
                  data-prop={property.name}
                  className="flex flex-col justify-center px-4"
                  style={{
                    height: ROW_H,
                    borderBottom: '1px solid var(--pl-line)',
                    borderRight: '1px solid var(--pl-line)',
                    background: 'var(--pl-card)',
                  }}
                >
                  <span
                    className="flex items-center gap-1.5 truncate text-[12.5px] font-semibold"
                    style={{ color: 'var(--pl-ink)', letterSpacing: '-0.01em' }}
                  >
                    {property.name}
                    <span
                      className="flex items-center gap-0.5 text-[10px] font-semibold tabular-nums"
                      style={{ color: 'var(--pl-faint)' }}
                    >
                      <TagIcon size={10} strokeWidth={1.75} />
                      {property.count}
                    </span>
                  </span>
                  <span className="truncate text-[10.5px]" style={{ color: 'var(--pl-muted)' }}>
                    {property.city}
                  </span>
                </div>
              ))}
              {Array.from({ length: FILLER_ROWS }, (_, i) => (
                <div key={`fill-${i}`} style={{ height: ROW_H, background: 'var(--pl-card)' }} />
              ))}
            </div>

            {/* Grille */}
            <div className="relative" style={{ width: gridWidth }}>
              <DateHeaders />
              <div ref={bodyRef} className="relative" style={{ height: bodyHeight }}>
                {PROPERTIES.map((property, row) => (
                  <Row key={property.name} row={row} selection={selection} />
                ))}
                {Array.from({ length: FILLER_ROWS }, (_, i) => (
                  <div
                    key={`grid-fill-${i}`}
                    className="absolute inset-x-0"
                    style={{
                      top: (PROPERTIES.length + i) * ROW_H,
                      height: ROW_H,
                      backgroundImage:
                        `repeating-linear-gradient(to right, transparent 0 ${DAY_W - 1}px, var(--pl-line) ${DAY_W - 1}px ${DAY_W}px)`,
                    }}
                  />
                ))}

                {[...RESAS, ...(created ? [CREATED_RESA] : [])].map((resa) => (
                  <Bar
                    key={resa.id}
                    resa={resa}
                    muted={mutedChannel === resa.channel}
                    shift={(moved[resa.id] ?? 0) + (dragging?.id === resa.id ? dragging.shift : 0)}
                    extra={extended[resa.id] ?? 0}
                    dragging={dragging?.id === resa.id}
                    conflict={dragging?.id === resa.id && dragging.conflict}
                    infoFilled={infoFilled}
                  />
                ))}

                {/* Fiche voyageur à compléter — panneau ancré sous la brique */}
                <BlockedBand />
                <CancelledBar />

                {/* Trait « maintenant » */}
                <div
                  className="pointer-events-none absolute top-0 bottom-0 w-[2px]"
                  style={{ left: TODAY_INDEX * DAY_W + DAY_W * 0.42, background: 'var(--pl-err)', zIndex: 6 }}
                >
                  <span
                    className="absolute size-[10px] rounded-full"
                    style={{
                      top: -1,
                      left: -4,
                      background: 'var(--pl-err)',
                      boxShadow: '0 0 0 3px color-mix(in srgb, #E5484D 25%, transparent)',
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Pagination */}
          <div
            className="flex items-center justify-center gap-4 text-[11.5px] font-semibold tabular-nums"
            style={{ height: 32, borderTop: '1px solid var(--pl-line)', color: 'var(--pl-ink)' }}
          >
            <span>Page 1 / 2</span>
            <span className="text-[10.5px] font-normal" style={{ color: 'var(--pl-muted)' }}>
              1-6 sur 10 logements
            </span>
          </div>
        </div>
      </div>

      {/* Info-bulles : hors du cadre rogné, au-dessus de tout (z-50). */}
      {guestPanel && (
        <Overlay origin={gridOrigin} scale={scale} gx={9 * DAY_W + DAY_W * 0.42} gy={ROW_H - 2}>
          <GuestPanel email={email} saved={infoFilled} />
        </Overlay>
      )}
      {createDialog && (
        <Overlay origin={gridOrigin} scale={scale} gx={5 * DAY_W + DAY_W * 0.42} gy={ROW_H - 2}>
          <CreateDialog query={guestQuery} picked={guestPicked} />
        </Overlay>
      )}
      {propertyOpen && (
        <Overlay origin={gridOrigin} scale={scale} gx={12} gy={-HEADER_H + 4}>
          <PropertyPopover />
        </Overlay>
      )}

      {!reduced && <Cursor cursor={cursor} />}
    </div>
  );
}

/* ─── Barre d'outils ────────────────────────────────────────────────────────── */

function Toolbar({ mutedChannel }: { mutedChannel: Channel | null }) {
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
    <div className="flex flex-col gap-2 px-3 py-2.5">
      <div className="flex items-center justify-center gap-2">
        <span
          className="text-[15px] font-semibold"
          style={{ color: 'var(--pl-ink)', fontFamily: 'var(--font-heading, inherit)' }}
        >
          Août 2026
        </span>
        <span style={chip(true)}>
          <CalendarCheckIcon className="size-[13px]" style={{ color: 'var(--pl-accent)' }} />
          Aujourd'hui
        </span>
        <span
          className="flex items-center gap-0.5 rounded-[10px] p-[3px]"
          style={{ background: 'var(--pl-field)', border: '1px solid var(--pl-line2)' }}
        >
          {['Semaine', 'Quinzaine', 'Mois'].map((zoom) => (
            <span
              key={zoom}
              className="rounded-[7px] px-[13px] py-[6px] text-[12px] font-semibold"
              style={
                zoom === 'Quinzaine'
                  ? { background: 'var(--pl-card)', color: 'var(--pl-ink)', boxShadow: '0 1px 3px rgba(21,36,45,.10)' }
                  : { color: 'var(--pl-muted)' }
              }
            >
              {zoom}
            </span>
          ))}
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-1.5">
        {(Object.keys(CHANNELS) as Channel[]).map((channel) => (
          <span key={channel} data-chip={channel} style={chip(mutedChannel !== channel)}>
            {CHANNELS[channel].logo ? (
              <img src={CHANNELS[channel].logo!} alt="" className="size-[15px] object-contain" />
            ) : (
              <GlobeIcon className="size-[15px]" style={{ color: 'var(--pl-accent)' }} />
            )}
            {CHANNELS[channel].label}
          </span>
        ))}
        {(
          [
            ['Confirmée', STATUS.confirmed],
            ['En attente', STATUS.pending],
            ['Check-in', STATUS.checked_in],
            ['Check-out', STATUS.checked_out],
          ] as const
        ).map(([label, color]) => (
          <span key={label} style={chip(true)}>
            <span className="size-[9px] rounded-[3px]" style={{ background: color }} />
            {label}
          </span>
        ))}
        <span style={chip(true)}>
          <BroomFill size={16} style={{ color: '#2F9E8D' }} />
          <WrenchFill size={15} style={{ color: '#4F86C6' }} />
          Interventions
        </span>
      </div>
    </div>
  );
}

/* ─── En-tête de dates ──────────────────────────────────────────────────────── */

function DateHeaders() {
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
            className="flex flex-col items-center justify-center gap-px"
            style={{
              width: DAY_W,
              borderRight: day === DAYS - 1 ? undefined : '1px solid var(--pl-line)',
              background: isWeekend(day) ? '#F2F6F7' : undefined,
            }}
          >
            <span
              className="text-[9.5px] leading-none font-bold tracking-[.04em] uppercase"
              style={{ color: today ? 'var(--pl-accent)' : 'var(--pl-faint)' }}
            >
              {DAY_LABELS[(FIRST_DOW + day) % 7]}
            </span>
            {today ? (
              <span
                className="mt-0.5 flex size-6 items-center justify-center rounded-lg text-[14px] font-semibold tabular-nums"
                style={{ background: 'var(--pl-accent)', color: '#FFF' }}
              >
                {dayNumber(day)}
              </span>
            ) : (
              <span
                className="text-[14px] font-semibold tabular-nums"
                style={{ color: 'var(--pl-body)' }}
              >
                {dayNumber(day)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Ligne de grille ───────────────────────────────────────────────────────── */

function Row({
  row,
  selection,
}: {
  row: number;
  selection: { row: number; start: number; nights: number } | null;
}) {
  return (
    <div
      className="absolute inset-x-0"
      style={{ top: row * ROW_H, height: ROW_H, borderBottom: '1px solid var(--pl-line)' }}
    >
      {Array.from({ length: DAYS }, (_, day) => (
        <div
          key={day}
          data-cell={`${row}-${day}`}
          className="absolute top-0 bottom-0 flex items-center justify-center"
          style={{
            left: day * DAY_W,
            width: DAY_W,
            borderRight: '1px solid var(--pl-line)',
            background: day === TODAY_INDEX
              ? 'color-mix(in srgb, #5453D6 6%, transparent)'
              : isWeekend(day)
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
        </div>
      ))}

      {/* Sélection de nuits libres */}
      {selection?.row === row && (
        <div
          className="absolute rounded-[9px]"
          style={{
            left: selection.start * DAY_W + DAY_W * 0.42,
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
            {selection.nights} nuit{selection.nights > 1 ? 's' : ''}
          </span>
        </div>
      )}
    </div>
  );
}

/* ─── Fiche voyageur à compléter ────────────────────────────────────────────── */

/** Panneau ancré sous la réservation « Kenji Sato » (ligne 0, jour 9). */
function GuestPanel({ email, saved }: { email: string; saved: boolean }) {
  return (
    <div
      className="rounded-[11px] p-3"
      style={{
        width: 246,
        background: 'var(--pl-card)',
        border: '1px solid var(--pl-line2)',
        boxShadow: '0 22px 50px -16px rgba(21,36,45,.40)',
      }}
    >
      <p className="text-[11px] font-semibold" style={{ color: 'var(--pl-ink)' }}>
        Fiche voyageur · Kenji Sato
      </p>
      <p className="mt-0.5 flex items-center gap-1 text-[10.5px]" style={{ color: '#C28A52' }}>
        <Warning size={12} strokeWidth={2} /> E-mail manquant — fiche police incomplète
      </p>
      <div
        data-email-field
        className="mt-2 flex h-[28px] items-center rounded-[8px] px-2 text-[11px]"
        style={{
          background: 'var(--pl-field)',
          border: '1px solid var(--pl-line2)',
          color: email ? 'var(--pl-ink)' : 'var(--pl-faint)',
        }}
      >
        {email || 'adresse e-mail'}
        {!saved && email && (
          <span className="ms-px inline-block h-[13px] w-px animate-pulse" style={{ background: 'var(--pl-accent)' }} />
        )}
      </div>
      <div className="mt-2 flex items-center justify-end gap-2">
        {saved ? (
          <span className="flex items-center gap-1 text-[10.5px] font-semibold" style={{ color: '#3E9C80' }}>
            <CheckBold size={11} /> Fiche complétée
          </span>
        ) : (
          <span
            data-email-save
            className="rounded-[8px] px-2.5 py-1 text-[11px] font-semibold"
            style={{ background: 'var(--pl-accent)', color: '#FFF' }}
          >
            Enregistrer
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
  return (
    <div
      className="absolute"
      style={{ left: origin.x + gx * scale, top: origin.y + gy * scale, zIndex: 50 }}
    >
      {children}
    </div>
  );
}

/* ─── Plage bloquée & réservation annulée ───────────────────────────────────── */

/** Bande hachurée pleine hauteur de ligne (PlanningBlockedBand) : pas de brique
    colorée, un cadenas et le libellé « Bloqué » quand la place le permet. */
function BlockedBand() {
  const width = BLOCKED.nights * DAY_W;
  return (
    <div
      className="absolute flex items-center justify-center gap-1.5"
      style={{
        left: BLOCKED.start * DAY_W,
        width,
        top: BLOCKED.row * ROW_H + 1,
        height: ROW_H - 2,
        background: 'color-mix(in srgb, var(--pl-muted) 8%, var(--pl-card))',
        backgroundImage:
          'repeating-linear-gradient(45deg, color-mix(in srgb, var(--pl-muted) 16%, transparent) 0 1px, transparent 1px 7px)',
        boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--pl-muted) 14%, transparent)',
        zIndex: 2,
      }}
      title={BLOCKED.reason}
    >
      <LockIcon className="size-3" style={{ color: 'var(--pl-muted)' }} />
      <span className="text-[11px] font-semibold" style={{ color: 'var(--pl-muted)' }}>
        Bloqué
      </span>
    </div>
  );
}

/** Brique annulée : fond hachuré, bordure tiretée, nom barré, avatar désaturé,
    et le petit bouton rond de masquage en haut à droite. */
function CancelledBar() {
  const left = CANCELLED.start * DAY_W + DAY_W * 0.42;
  const width = CANCELLED.nights * DAY_W - DAY_W * 0.17;
  return (
    <div
      className="absolute flex items-center gap-[7px] overflow-visible"
      style={{
        left,
        width,
        top: CANCELLED.row * ROW_H + BAR_TOP,
        height: BAR_H,
        borderRadius: 9,
        background: 'var(--pl-surface2)',
        backgroundImage:
          'repeating-linear-gradient(135deg, color-mix(in srgb, var(--pl-muted) 22%, transparent) 0 1.5px, transparent 1.5px 8px)',
        border: '1.5px dashed var(--pl-line2)',
        padding: '0 7px 0 5px',
        zIndex: 3,
      }}
    >
      <span
        className="flex size-[26px] shrink-0 items-center justify-center overflow-hidden rounded-full"
        style={{ border: '1.5px solid var(--pl-line2)' }}
      >
        <img
          src={CANCELLED.photo}
          alt=""
          className="size-full object-cover"
          style={{ filter: 'grayscale(1)', opacity: 0.6 }}
        />
      </span>
      <span className="flex min-w-0 flex-col leading-[1.2]" style={{ color: 'var(--pl-muted)' }}>
        <span className="text-[9.5px] font-semibold opacity-85">Annulée</span>
        <span className="truncate text-[12px] font-semibold line-through">{CANCELLED.guest}</span>
      </span>
      {/* Bouton de masquage (hideFromPlanning) */}
      <span
        className="absolute flex size-4 items-center justify-center rounded-full"
        style={{ top: -6, right: -6, background: 'var(--pl-muted)', color: '#FFF' }}
      >
        <XIcon className="size-2.5" />
      </span>
    </div>
  );
}

/* ─── Fiche logement (PropertyPopover) ──────────────────────────────────────── */

/** Reprend la fiche ouverte au clic sur un logement : identité, capacités,
    horaires, puis le bloc Performance 90 j (score, RevPAN, occupation, marge). */
function PropertyPopover() {
  const tile = (icon: React.ReactNode, label: string, value: React.ReactNode, accent = false) => (
    <div
      className="flex-1 rounded-[10px] px-2.5 py-1.5"
      style={{
        border: `1px solid ${accent ? 'color-mix(in srgb, #3E9C80 45%, transparent)' : 'var(--pl-line2)'}`,
        background: accent ? 'color-mix(in srgb, #3E9C80 8%, transparent)' : 'transparent',
      }}
    >
      <p
        className="flex items-center gap-1 text-[9px] font-bold tracking-[.04em] uppercase"
        style={{ color: accent ? '#3E9C80' : 'var(--pl-muted)' }}
      >
        {icon}
        {label}
      </p>
      <p
        className="mt-0.5 text-[15px] font-semibold tabular-nums"
        style={{ color: accent ? '#3E9C80' : 'var(--pl-ink)' }}
      >
        {value}
      </p>
    </div>
  );

  const stat = (label: string, value: React.ReactNode, tone?: string) => (
    <div className="flex items-center justify-between text-[11px]">
      <span style={{ color: 'var(--pl-muted)' }}>{label}</span>
      <span className="font-semibold tabular-nums" style={{ color: tone ?? 'var(--pl-ink)' }}>
        {value}
      </span>
    </div>
  );

  return (
    <div
      className="rounded-[14px] p-3"
      style={{
        width: 292,
        background: 'var(--pl-card)',
        border: '1px solid var(--pl-line2)',
        boxShadow: '0 22px 50px -16px rgba(21,36,45,.40)',
      }}
    >
      {/* Héro : vignette + nom */}
      <div
        className="flex flex-col items-center gap-1.5 rounded-[10px] px-3 py-2.5"
        style={{ background: 'var(--pl-field)' }}
      >
        <BuildingIcon className="size-5" style={{ color: 'var(--pl-faint)' }} />
        <p className="text-[14px] font-semibold" style={{ color: 'var(--pl-ink)' }}>
          Appartement Duplex Guéliz
        </p>
      </div>

      <div className="mt-2 flex flex-col gap-1 border-b pb-2" style={{ borderColor: 'var(--pl-line)' }}>
        <span
          className="w-fit rounded-[6px] px-2 py-0.5 text-[9.5px] font-bold tracking-[.04em] uppercase"
          style={{ background: 'var(--pl-field)', color: 'var(--pl-muted)' }}
        >
          Apartment
        </span>
        <p className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--pl-body)' }}>
          <MapPinIcon className="size-3.5 shrink-0" style={{ color: 'var(--pl-faint)' }} />
          Rue Yougoslavie, Guéliz, Marrakech
        </p>
        <p className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--pl-body)' }}>
          <UserIcon className="size-3.5 shrink-0" style={{ color: 'var(--pl-faint)' }} />
          Toufik Mazy
        </p>
      </div>

      {/* Capacités */}
      <div className="mt-2 flex gap-2">
        {tile(<UsersIcon className="size-3" />, 'Voyageurs max', 6)}
        {tile(<BedDoubleIcon className="size-3" />, 'Nuits min.', 2)}
      </div>
      <div className="mt-2 flex">
        {tile(<MoroccanDirham size={12} />, 'Prix / nuit', <Amount value={850} size={13} />, true)}
      </div>

      <div className="mt-2 flex flex-col gap-1 border-b pb-2" style={{ borderColor: 'var(--pl-line)' }}>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]" style={{ color: 'var(--pl-body)' }}>
          <span className="flex items-center gap-1">
            <ClockIcon className="size-3.5" style={{ color: 'var(--pl-faint)' }} />
            Check-in <b style={{ color: 'var(--pl-ink)' }}>15:00</b>
          </span>
          <span className="flex items-center gap-1">
            <ClockIcon className="size-3.5" style={{ color: '#C28A52' }} />
            Check-out <b style={{ color: 'var(--pl-ink)' }}>11:00</b>
          </span>
        </p>
        <p className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--pl-body)' }}>
          <CalendarIcon className="size-3.5 shrink-0" style={{ color: 'var(--pl-faint)' }} />
          Fréquence ménage : <b style={{ color: 'var(--pl-ink)' }}>Après chaque séjour</b>
        </p>
      </div>

      {/* Performance 90 jours */}
      <p
        className="mt-2 flex items-center gap-1.5 text-[9.5px] font-bold tracking-[.04em] uppercase"
        style={{ color: 'var(--pl-muted)' }}
      >
        <GaugeIcon className="size-3.5" /> Performance · 90 j
      </p>
      <div className="mt-1.5 flex items-center justify-between text-[11px]">
        <span style={{ color: 'var(--pl-muted)' }}>Score</span>
        <span className="font-bold tabular-nums" style={{ color: '#C28A52' }}>
          64/100
        </span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full" style={{ background: 'var(--pl-field)' }}>
        <div className="h-full rounded-full" style={{ width: '64%', background: '#C28A52' }} />
      </div>
      <div className="mt-1.5 flex flex-col gap-0.5">
        {stat('RevPAN', <Amount value={548} size={10} />)}
        {stat("Taux d'occupation", '64 %')}
        {stat('Revenu total', <Amount value={49320} size={10} />)}
        {stat('Marge nette', '86 %', '#3E9C80')}
      </div>

      <div className="mt-2 flex gap-2">
        <span
          className="flex flex-1 items-center justify-center gap-1.5 rounded-[9px] py-1.5 text-[11px] font-semibold"
          style={{ border: '1px solid var(--pl-line2)', color: 'var(--pl-body)' }}
        >
          <XIcon className="size-3.5" /> Fermer
        </span>
        <span
          className="flex flex-1 items-center justify-center gap-1.5 rounded-[9px] py-1.5 text-[11px] font-semibold"
          style={{ border: '1px solid var(--pl-accent)', color: 'var(--pl-accent)' }}
        >
          <EyeIcon className="size-3.5" /> Voir la fiche
        </span>
      </div>
    </div>
  );
}

/* ─── Dialog de création ────────────────────────────────────────────────────── */

/** Reprend ce que `ReservationDialog` pré-remplit depuis un drag-to-select :
    logement verrouillé, dates, nuits, prix/nuit et heures d'arrivée/départ. */
function CreateDialog({ query, picked }: { query: string; picked: boolean }) {
  const line = (label: string, value: React.ReactNode) => (
    <div className="flex items-center justify-between gap-3">
      <span style={{ color: 'var(--pl-muted)' }}>{label}</span>
      <span className="font-semibold tabular-nums" style={{ color: 'var(--pl-ink)' }}>
        {value}
      </span>
    </div>
  );
  return (
    <div
      className="rounded-[11px] p-3.5"
      style={{
        width: 268,
        background: 'var(--pl-card)',
        border: '1px solid var(--pl-line2)',
        boxShadow: '0 22px 50px -16px rgba(21,36,45,.40)',
      }}
    >
      <p className="text-[12px] font-semibold" style={{ color: 'var(--pl-ink)' }}>
        Nouvelle réservation
      </p>
      <p className="mt-0.5 text-[10.5px]" style={{ color: 'var(--pl-muted)' }}>
        Riad Bab Doukkala · Fès · Médina
      </p>
      <div className="mt-2.5 flex flex-col gap-1.5 text-[11px]">
        {line('Séjour', '28 → 31 août')}
        {line('Nuits', '3')}
        {line('Prix / nuit', <Amount value={1250} size={10} />)}
        {line('Arrivée / départ', '15:00 · 11:00')}
        <div
          className="mt-1 flex items-center justify-between gap-3 border-t pt-2 text-[12px]"
          style={{ borderColor: 'var(--pl-line)' }}
        >
          <span style={{ color: 'var(--pl-muted)' }}>Total</span>
          <span className="font-bold tabular-nums" style={{ color: 'var(--pl-ink)' }}>
            <Amount value={3750} size={11} />
          </span>
        </div>
      </div>
      {/* Voyageur : recherche dans le carnet, ou création à la volée. */}
      <div className="mt-2.5 border-t pt-2.5" style={{ borderColor: 'var(--pl-line)' }}>
        <p className="text-[9.5px] font-bold tracking-[.04em] uppercase" style={{ color: 'var(--pl-muted)' }}>
          Voyageur
        </p>
        <div
          data-guest-field
          className="mt-1.5 flex h-[28px] items-center gap-1.5 rounded-[8px] px-2 text-[11px]"
          style={{ background: 'var(--pl-field)', border: '1px solid var(--pl-line2)', color: 'var(--pl-ink)' }}
        >
          <SearchIcon className="size-3.5" style={{ color: 'var(--pl-faint)' }} />
          <span style={{ color: query ? 'var(--pl-ink)' : 'var(--pl-faint)' }}>
            {query || 'Rechercher un voyageur…'}
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
            border: `1px solid ${picked ? 'color-mix(in srgb, #5453D6 30%, transparent)' : 'var(--pl-line2)'}`,
          }}
        >
          <img src={g5} alt="" className="size-6 shrink-0 rounded-full object-cover" />
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="text-[11px] font-semibold" style={{ color: 'var(--pl-ink)' }}>
              Sarah Miller
            </span>
            <span className="truncate text-[10px]" style={{ color: 'var(--pl-muted)' }}>
              sarah.miller@mail.com · 3 séjours
            </span>
          </span>
          {picked && (
            <CheckBold size={12} style={{ color: 'var(--pl-accent)', marginInlineStart: 'auto' }} />
          )}
        </div>
        )}
        <p className="mt-1.5 flex items-center gap-1 text-[10px]" style={{ color: 'var(--pl-accent)' }}>
          <PlusIcon className="size-3" /> Créer un nouveau voyageur
        </p>
      </div>

      <div className="mt-3 flex items-center justify-end gap-2">
        <span className="text-[11px]" style={{ color: 'var(--pl-muted)' }}>
          Annuler
        </span>
        <span
          data-create
          className="rounded-[8px] px-3 py-1.5 text-[11px] font-semibold"
          style={{ background: 'var(--pl-accent)', color: '#FFF' }}
        >
          Créer la réservation
        </span>
      </div>
    </div>
  );
}

/* ─── Brique de réservation ─────────────────────────────────────────────────── */

function Bar({
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
  const nights = resa.nights + extra;
  const left = (resa.start + shift) * DAY_W + DAY_W * 0.42;
  const width = nights * DAY_W - DAY_W * 0.17;
  const color = STATUS[resa.status];
  const initials = resa.guest
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2);

  /* ── Repli de la brique (logique de PlanningBar) ─────────────────────────
     Priorité : nom > prix > tarif de prestation > logos. Ce qui ne tient pas
     n'est pas tronqué : il est compté dans la pastille « +N », qui garantit
     qu'aucun élément ne déborde ni ne chevauche. */
  const showAvatar = width > BAR_AVATAR_MIN;
  const showName = width > BAR_NAME_MIN;
  const priceAmount = width >= BAR_PRICE_AMOUNT_MIN; // icône + montant
  const priceInline = width >= BAR_PRICE_INLINE_MIN; // icône seule
  const priceFolded = !priceInline; // → « +N »
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

  /* Nombre de slots disponibles, puis répartition affiché / replié : on garde
     toujours une place pour la pastille « +N » quand il y a du surplus. */
  const slots = width > (priceInline ? 220 : 175) ? 2 : 1;
  const shown = indicators.length <= slots ? indicators : indicators.slice(0, Math.max(0, slots - 1));
  const hiddenCount = indicators.length - shown.length;

  const channelFolded = width <= BAR_CHANNEL_MIN;
  const foldedTotal = hiddenCount + (priceFolded ? 1 : 0) + (channelFolded ? 1 : 0);

  return (
    <>
      <div
        data-bar={resa.id}
        className={`absolute flex items-center gap-[7px] overflow-hidden${
          resa.missingInfo && !infoFilled && !muted ? ' pl-urgent' : ''
        }`}
        style={{
          ['--pl-bc' as string]: color,
          left,
          width,
          top: resa.row * ROW_H + BAR_TOP,
          height: BAR_H,
          borderRadius: 9,
          background: color,
          color: '#FFF',
          padding: '0 7px 0 5px',
          zIndex: dragging ? 8 : 3,
          opacity: muted ? 0.12 : dragging ? 0.85 : 1,
          boxShadow: conflict
            ? '0 0 0 2px var(--pl-err), 0 8px 18px -8px rgba(229,72,77,.6)'
            : dragging
              ? '0 10px 22px -10px rgba(21,36,45,.55)'
              : undefined,
          transition:
            'left .22s cubic-bezier(.16,1,.3,1), width .22s cubic-bezier(.16,1,.3,1), opacity .18s ease-out, box-shadow .18s ease-out',
        }}
      >
        {/* Avatar voyageur : photo, initiales en repli (comme GuestAvatar). */}
        {showAvatar && (
          <span
            className="flex size-[26px] shrink-0 items-center justify-center overflow-hidden rounded-full text-[9.5px] font-bold"
            style={{ border: '1.5px solid rgba(255,255,255,.55)', background: 'rgba(255,255,255,.22)' }}
          >
            {resa.photo ? (
              <img src={resa.photo} alt="" className="size-full object-cover" loading="lazy" />
            ) : (
              initials
            )}
          </span>
        )}

        {showName && (
          <span className="flex min-w-0 flex-col leading-[1.2]">
            <span className="text-[9.5px] font-semibold opacity-85">{nights} nuits</span>
            <span className="truncate text-[12px] font-semibold">{resa.guest}</span>
          </span>
        )}

        <span className="ms-auto flex shrink-0 items-center gap-[5px]">
          {/* Prix du séjour : montant si la place le permet, sinon icône seule. */}
          {priceInline && (
            <span
              className="flex h-[21px] items-center gap-1 rounded-[7px] text-[11px] font-bold tabular-nums"
              style={{
                padding: priceAmount ? '0 8px' : '0 6px',
                ...(resa.paid
                  ? { background: 'rgba(0,0,0,.20)', color: '#FFF', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.22)' }
                  : { background: '#FFF', color: '#B25A2A', boxShadow: '0 1px 2px rgba(0,0,0,.14)' }),
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

          {shown.map((indicator) => indicator.node)}

          {/* Pastille de repli : tout ce qui n'avait pas la place. */}
          {foldedTotal > 0 && (
            <span
              className="flex size-[21px] shrink-0 items-center justify-center rounded-[7px] text-[10px] font-bold tabular-nums"
              style={{ background: 'rgba(255,255,255,.9)', color: '#15242D' }}
            >
              +{foldedTotal}
            </span>
          )}

          {!channelFolded && <ChannelBadge channel={resa.channel} />}
        </span>

        {/* Poignée d'étirement (bord droit) */}
        <span
          data-resize={resa.id}
          className="absolute top-0 right-0 bottom-0 w-2"
          style={{ cursor: 'col-resize' }}
        />
      </div>

    </>
  );
}
