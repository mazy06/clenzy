import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useId } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui';
import { Block, CleaningServices, Build, SwapHoriz, TrendingUp, Check } from '../../icons';
import {
  FirstUseStage,
  StageCard,
  StageFoot,
  StageRail,
  useStageScene,
  type RailStep,
} from '../../components/baitly/FirstUseStage';
import { STAGE_IMAGES } from '../../components/baitly/stageImages';
import {
  RESERVATION_STATUS_BAR_COLORS,
  RESERVATION_STATUS_BAR_INK,
  INTERVENTION_TYPE_TOKEN_COLORS,
  TODAY_LINE_COLOR,
} from './constants';
import airbnbLogo from '../../assets/logo/airbnb-logo-small.svg';
import bookingLogo from '../../assets/logo/booking-logo-small.svg';
import vrboLogo from '../../assets/logo/vrbo-logo-small.svg';
import airbnbPartner from '../../assets/channels/partners/airbnb-preferred-partner-2025.svg';
import bookingPartner from '../../assets/channels/partners/booking-premier-partner-2025.svg';
import vrboPartner from '../../assets/channels/partners/vrbo-elite-partner-2025.svg';
import expediaPartner from '../../assets/channels/partners/expedia-preferred-partner-2025.svg';
import './planningUrgency.css';
import './planningEmpty.css';

/**
 * État vide du Planning quand l'organisation n'a **encore aucun logement**.
 *
 * Distinct de l'état « le filtre ne laisse rien passer » (rendu par `EmptyState`
 * dans `PlanningPage`) : ici l'utilisateur n'a aucun filtre à corriger, il
 * découvre l'écran. Ce qui se vend est un **mécanisme** — une nuit vendue sur un
 * canal se ferme sur tous les autres — donc le message passe par le schéma :
 *
 *  - à droite, la vraie grille du planning (couleurs « Terre cuite »), qui joue
 *    la scène choisie dans le rail ;
 *  - en pied, le rail : quatre étapes, quatre illustrations, un mot chacune.
 *    Il remplace les anciens blocs « mécanisme », « garde-fous » et « services
 *    rendus », qui racontaient en trois sections ce que ces quatre vignettes
 *    montrent d'un coup d'œil ;
 *  - à gauche, la promesse en une phrase, les deux gestes attendus et les
 *    badges des partenaires de distribution (des images, pas un paragraphe).
 *
 * Chaque étape du rail pilote la grille : le défilement s'arrête dès que
 * l'utilisateur choisit lui-même une étape.
 */

// ─── Étapes — chacune pilote une scène de la grille ─────────────────────────

// Une étape ne porte que sa CLEF et son illustration : le libellé se lit dans
// `planning.empty.showcase.milestones.<clef>` au rendu.
const MILESTONES = [
  { key: 'sync', image: STAGE_IMAGES.channelSync },
  { key: 'move', image: STAGE_IMAGES.calendar },
  { key: 'ops', image: STAGE_IMAGES.cleaning },
  { key: 'money', image: STAGE_IMAGES.pricingSeasons },
] as const;

const CHANNEL_PARTNERS = [
  { name: 'Airbnb', badge: airbnbPartner, certification: 'Preferred Software Partner 2025' },
  { name: 'Booking.com', badge: bookingPartner, certification: 'Premier Connectivity Partner 2025' },
  { name: 'Vrbo', badge: vrboPartner, certification: 'Elite Partner 2025' },
  { name: 'Expedia', badge: expediaPartner, certification: 'Preferred Partner 2025' },
];

const CHANNEL_LOGOS = [airbnbLogo, bookingLogo, vrboLogo];

// ─── Grille de démonstration ────────────────────────────────────────────────

const DAY_COUNT = 12;
const WEEKEND_COLUMNS = new Set([5, 6]);
const TODAY_COLUMN = 7;

interface DemoStay {
  row: number;
  start: number;
  span: number;
  status: 'confirmed' | 'checked_in' | 'pending';
  logo: string;
  nights: string;
  /** Le séjour que l'étape « déplacer » fait glisser. */
  movable?: boolean;
}

const DEMO_STAYS: DemoStay[] = [
  { row: 0, start: 0, span: 4, status: 'checked_in', logo: airbnbLogo, nights: '4' },
  { row: 1, start: 5, span: 4, status: 'confirmed', logo: bookingLogo, nights: '4' },
  { row: 2, start: 2, span: 3, status: 'pending', logo: vrboLogo, nights: '3', movable: true },
];

/** Tarifs de démonstration : illustratifs, alignés sur la lecture du planning. */
const DEMO_PRICES = [128, 128, 145, 145, 160, 180, 180, 160, 145, 128, 128, 135];
const DEMO_OCCUPANCY = [0.62, 0.74, 0.81, 0.81, 0.9, 1, 1, 0.88, 0.7, 0.55, 0.48, 0.6];

const GRID_COLUMNS = { gridTemplateColumns: `repeat(${DAY_COUNT}, minmax(0, 1fr))` } as const;

function DemoGrid({ scene }: { scene: number }) {
  const moved = scene === 1;

  return (
    <StageCard className="pl-empty-card">
      <div className="flex gap-2">
        {/* Colonne des logements — barres : rien à traduire, aucune fausse
            donnée crédible à maintenir (convention des aperçus Baitly). */}
        <div className="flex w-16 shrink-0 flex-col gap-3 pt-6 sm:w-20">
          {DEMO_STAYS.map((_, row) => (
            <div key={row} className="flex h-7 items-center gap-1.5">
              <span className="size-4 shrink-0 rounded-[4px] bg-[var(--ns-bar)]" />
              <span className="ns-bar flex-1" />
            </div>
          ))}
        </div>

        <div className="relative min-w-0 flex-1">
          {/* Entête des jours */}
          <div className="mb-1 grid gap-[3px]" style={GRID_COLUMNS}>
            {Array.from({ length: DAY_COUNT }).map((_, day) => (
              <div
                key={day}
                className={`rounded-[3px] py-0.5 text-center text-[9px] leading-none font-medium tabular-nums ${
                  WEEKEND_COLUMNS.has(day) ? 'bg-[var(--ns-wash-2)] text-[var(--ns-soft)]' : 'text-[var(--ns-muted)]'
                }`}
              >
                {day + 12}
              </div>
            ))}
          </div>

          {/* Rangées : fond de cellules + briques de séjour superposées */}
          <div className="flex flex-col gap-3">
            {DEMO_STAYS.map((stay) => (
              <div key={stay.row} className="grid h-7 gap-[3px]" style={GRID_COLUMNS}>
                {Array.from({ length: DAY_COUNT }).map((_, day) => (
                  <div
                    key={day}
                    className={`rounded-[3px] ${WEEKEND_COLUMNS.has(day) ? 'bg-[var(--ns-wash-2)]' : 'bg-[var(--ns-wash)]'}`}
                  />
                ))}

                {/* La brique. L'enrobage porte le déplacement, la brique son
                    entrée en scène — deux nœuds, sinon l'un écrase l'autre. */}
                <div
                  className="pl-empty-slide self-center"
                  style={
                    {
                      gridColumn: `${stay.start + 1} / span ${stay.span}`,
                      gridRow: 1,
                      '--span': stay.span,
                      '--shift': moved && stay.movable ? 4 : 0,
                    } as React.CSSProperties
                  }
                >
                  <div
                    className="pl-empty-bar flex h-6 items-center gap-1 rounded-[5px] px-1.5"
                    style={{
                      backgroundColor: RESERVATION_STATUS_BAR_COLORS[stay.status],
                      color: RESERVATION_STATUS_BAR_INK[stay.status],
                      animationDelay: `${stay.row * 120}ms`,
                    }}
                  >
                    <img
                      src={stay.logo}
                      alt=""
                      className={`size-3.5 shrink-0 rounded-[3px] bg-white object-contain p-px ${
                        scene === 0 ? 'pl-empty-halo' : ''
                      }`}
                    />
                    <span
                      className="h-1.5 min-w-0 flex-1 rounded-full"
                      style={{ backgroundColor: 'currentColor', opacity: 0.28 }}
                    />
                    <span className="text-[9px] leading-none font-semibold tabular-nums">
                      {stay.nights}n
                    </span>
                  </div>
                </div>

                {/* Interventions — sur la MÊME grille que les séjours, à la
                    nuit exacte : ménage au départ, maintenance sur une nuit
                    libre. */}
                {scene === 2 && stay.row === 0 && (
                  <span
                    className="pl-empty-pop flex size-5 items-center justify-center self-center justify-self-center rounded-full"
                    style={{
                      gridColumn: stay.start + stay.span + 1,
                      gridRow: 1,
                      backgroundColor: INTERVENTION_TYPE_TOKEN_COLORS.cleaning,
                      color: '#FFFFFF',
                    }}
                  >
                    <CleaningServices size={11} strokeWidth={2} />
                  </span>
                )}
                {scene === 2 && stay.row === 1 && (
                  <span
                    className="pl-empty-pop flex size-5 items-center justify-center self-center justify-self-center rounded-full"
                    style={{
                      gridColumn: 3,
                      gridRow: 1,
                      backgroundColor: INTERVENTION_TYPE_TOKEN_COLORS.maintenance,
                      color: '#FFFFFF',
                      animationDelay: '120ms',
                    }}
                  >
                    <Build size={11} strokeWidth={2} />
                  </span>
                )}

                {/* Tarifs des nuits libres — la lecture que le planning donne
                    sans changer d'écran. */}
                {scene === 3 && stay.row === 2 &&
                  DEMO_PRICES.map((price, day) =>
                    day < stay.start || day >= stay.start + stay.span ? (
                      <span
                        key={day}
                        className="pl-empty-rise self-center text-center text-[8px] leading-none font-medium tabular-nums text-[var(--ns-text)]"
                        style={{ gridColumn: day + 1, gridRow: 1, animationDelay: `${day * 35}ms` }}
                      >
                        {price}
                      </span>
                    ) : null,
                  )}
              </div>
            ))}
          </div>

          {/* Ligne du jour — le repère permanent de la grille réelle. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 w-0.5 rounded-full"
            style={{
              backgroundColor: TODAY_LINE_COLOR,
              insetInlineStart: `calc(${(TODAY_COLUMN * 100) / DAY_COUNT}% - 1px)`,
            }}
          />
        </div>
      </div>

      {/* Rangée d'occupation, en pied de grille comme dans le planning. */}
      <div className="mt-3 flex items-end gap-2 border-t border-[var(--ns-line)] pt-2">
        <span className="flex w-16 shrink-0 text-[var(--ns-muted)] sm:w-20" aria-hidden>
          <TrendingUp size={14} />
        </span>
        <div className="grid h-4 min-w-0 flex-1 items-end gap-[3px]" style={GRID_COLUMNS}>
          {DEMO_OCCUPANCY.map((rate, day) => (
            <span
              key={day}
              className="pl-empty-occ h-full rounded-[2px] bg-[var(--ns-blue)]"
              style={{
                transform: `scaleY(${scene === 3 ? rate : 0.12})`,
                opacity: scene === 3 ? 1 : 0.35,
                transitionDelay: `${day * 30}ms`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Renvoi vers les canaux — en logos cochés, pas en phrase. Toujours là
          (c'est le schéma : le calendrier alimente les canaux) ; il s'allume et
          se coche à l'étape du déplacement, quand il veut dire quelque chose. */}
      <div
        className="pl-empty-sync mt-4 flex items-center gap-2.5 rounded-xl border border-[var(--ns-line)] bg-[var(--ns-wash)] px-3 py-2"
      >
        <SwapHoriz
          size={16}
          strokeWidth={2}
          className={`transition-colors duration-300 ${moved ? 'text-[var(--ns-brass)]' : 'text-[var(--ns-faint)]'}`}
        />
        <span className="ns-bar flex-1" />
        {CHANNEL_LOGOS.map((logo, index) => (
          <span
            key={logo}
            className={`relative inline-flex transition-opacity duration-300 ${moved ? 'opacity-100' : 'opacity-60'}`}
          >
            <img src={logo} alt="" className="size-6 rounded-[6px] bg-white object-contain p-0.5" />
            {moved && (
              <span
                className="ns-pop absolute -end-1 -bottom-1 flex size-3.5 items-center justify-center rounded-full bg-[var(--ns-ok)] text-[var(--ns-on-ok)]"
                style={{ '--d': `${200 + index * 140}ms` } as React.CSSProperties}
              >
                <Check size={9} strokeWidth={3} />
              </span>
            )}
          </span>
        ))}
      </div>
    </StageCard>
  );
}

// ─── Écran ──────────────────────────────────────────────────────────────────

export interface PlanningEmptyShowcaseProps {
  /** Ouvre le choix de source d'import (iCal, Channex, canal direct). */
  onImport: () => void;
}

export default function PlanningEmptyShowcase({ onImport }: PlanningEmptyShowcaseProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const stage = useStageScene(MILESTONES.length, 4600);
  const id = useId();

  const steps: RailStep[] = MILESTONES.map(({ key, image }) => ({
    key,
    image,
    label: t(`planning.empty.showcase.milestones.${key}`),
  }));

  return (
    <div className="pl-empty-showcase mx-auto w-full max-w-6xl px-4 pt-5 pb-10 sm:px-6 sm:pt-7">
      <FirstUseStage
        headingId={`${id}-title`}
        icon={<Block size={14} strokeWidth={2} />}
        eyebrow={t('planning.empty.showcase.eyebrow')}
        title={t('planning.empty.showcase.title')}
        lede={t('planning.empty.showcase.lede')}
        actions={
          <>
            <Button size="lg" onClick={() => navigate('/properties/new')}>
              {t('planning.empty.showcase.addProperty', 'Ajouter un logement')}
            </Button>
            <Button size="lg" variant="outline" onClick={onImport}>
              {t('planning.empty.showcase.importChannel', 'Importer depuis un canal')}
            </Button>
          </>
        }
        extra={
          <ul className="ns-logos ns-logos--grid" aria-label={t('planning.empty.showcase.partnersLabel')}>
            {CHANNEL_PARTNERS.map((partner) => (
              <li key={partner.name}>
                <img
                  src={partner.badge}
                  alt={`${partner.name}, ${partner.certification}`}
                  width={110}
                  height={44}
                  decoding="async"
                />
              </li>
            ))}
          </ul>
        }
        visual={
          <div role="group" aria-label={t('planning.empty.showcase.demoLabel')}>
            <div className="relative select-none" aria-hidden>
              <DemoGrid scene={stage.scene} />
            </div>
          </div>
        }
        onVisualFocus={stage.takeOver}
        rail={<StageRail steps={steps} scene={stage} label={t('planning.empty.showcase.demoLabel')} />}
      />
      <StageFoot note={t('planning.empty.showcase.alreadyOnline')}>
        <button
          type="button"
          onClick={onImport}
          className="cursor-pointer rounded-sm bg-transparent p-0 font-medium text-primary underline underline-offset-4 outline-none transition-colors duration-200 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t('planning.empty.showcase.importWithCalendars')}
        </button>
      </StageFoot>
    </div>
  );
}
