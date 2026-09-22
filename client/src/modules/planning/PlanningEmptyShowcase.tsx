import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useEffect, useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui';
import {
  AutoAwesome,
  Block,
  CleaningServices,
  Euro,
  Build,
  SwapHoriz,
  TrendingUp,
  Check,
} from '../../icons';
import {
  StoryPage,
  StorySection,
  StoryFlow,
  StoryPoints,
  StoryBand,
} from '../../components/baitly/FeatureStory';
import MockupSlot from '../../components/baitly/MockupSlot';
import Reveal from '../../components/baitly/Reveal';
import { usePrefersReducedMotion } from '../../components/baitly/ShowcaseCycler';
import {
  RESERVATION_STATUS_BAR_COLORS,
  RESERVATION_STATUS_BAR_INK,
  INTERVENTION_TYPE_TOKEN_COLORS,
  TODAY_LINE_COLOR,
  WEEKEND_CELL_BG,
  WEEKEND_HEADER_BG,
} from './constants';
import airbnbLogo from '../../assets/logo/airbnb-logo-small.svg';
import bookingLogo from '../../assets/logo/booking-logo-small.svg';
import vrboLogo from '../../assets/logo/vrbo-logo-small.svg';
import airbnbPartner from '../../assets/channels/partners/airbnb-preferred-partner-2025.svg';
import bookingPartner from '../../assets/channels/partners/booking-premier-partner-2025.svg';
import vrboPartner from '../../assets/channels/partners/vrbo-elite-partner-2025.svg';
import expediaPartner from '../../assets/channels/partners/expedia-preferred-partner-2025.svg';
import './planningEmpty.css';

/**
 * État vide du Planning quand l'organisation n'a **encore aucun logement**.
 *
 * Distinct de l'état « le filtre ne laisse rien passer » (rendu par `EmptyState`
 * dans `PlanningPage`) : ici l'utilisateur n'a aucun filtre à corriger, il
 * découvre l'écran. Et le planning fait partie des modules que `FeatureStory`
 * vise explicitement — ceux dont l'intérêt tient à un **mécanisme** (une nuit
 * vendue quelque part se referme partout) plutôt qu'à une phrase.
 *
 * Format long, mais **trois blocs seulement** : la promesse et sa démonstration,
 * le mécanisme, ce que la grille sait faire. Un écran vide qui demande cinq
 * défilements se lit comme une page marketing, pas comme un écran de travail —
 * et l'action se paie alors d'un aller-retour.
 *
 * Trois règles tiennent cette densité :
 * <ul>
 *   <li><b>Les actions passent avant les jalons.</b> « Ajouter un logement » est
 *       lisible sans défiler : c'est le geste attendu, il ne se mérite pas au
 *       bout d'un argumentaire. D'où l'absence de reprise en pied de page —
 *       répéter les mêmes boutons deux écrans plus bas ne fait qu'allonger.</li>
 *   <li><b>Un seul jalon est déplié.</b> Celui qui pilote la démonstration.
 *       Les trois autres se lisent en une ligne.</li>
 *   <li><b>Le garde-fou contient le mécanisme.</b> Les quatre étapes et la
 *       promesse « une nuit vendue est fermée partout » disaient la même chose
 *       dans deux blocs voisins : ils n'en font plus qu'un.</li>
 * </ul>
 *
 * L'animation n'est pas décorative : **chaque jalon pilote la démonstration**,
 * de sorte que chaque explication sous la grille montre sa scène au même instant.
 * Le défilement s'arrête dès que l'utilisateur choisit lui-même un jalon.
 *
 * La grille de démonstration emprunte les **vraies couleurs du planning**
 * (`constants.ts` : statuts « Terre cuite », teintes ménage / maintenance,
 * week-end, ligne du jour) : l'aperçu doit ressembler à l'écran qu'il annonce,
 * pas à une illustration générique.
 */

// ─── Jalons — chacun pilote une scène de la démonstration ───────────────────

// Les jalons ne portent que leur CLEF : libellé et détail se lisent dans
// `planning.empty.showcase.milestones.<clef>.*` au rendu.
const MILESTONE_KEYS = ['sync', 'move', 'ops', 'money'] as const;
const CHANNEL_PARTNERS = [
  { name: 'Airbnb', badge: airbnbPartner, certification: 'Preferred Software Partner 2025' },
  { name: 'Booking.com', badge: bookingPartner, certification: 'Premier Connectivity Partner 2025' },
  { name: 'Vrbo', badge: vrboPartner, certification: 'Elite Partner 2025' },
  { name: 'Expedia', badge: expediaPartner, certification: 'Preferred Partner 2025' },
];

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
  /** Le séjour que le jalon « glisser-déposer » déplace. */
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

function DemoGrid({ scene }: { scene: number }) {
  const { t } = useTranslation();
  const moved = scene === 1;

  return (
    <div className="rounded-xl border border-border bg-card p-3 sm:p-4">
      <div className="flex gap-2">
        {/* Colonne des logements — squelettes : rien à traduire, aucune fausse
            donnée crédible à maintenir (convention des aperçus Baitly). */}
        <div className="flex w-20 shrink-0 flex-col gap-2 pt-6">
          {DEMO_STAYS.map((_, row) => (
            <div key={row} className="flex h-6 items-center gap-1.5">
              <span className="size-4 shrink-0 rounded-[4px] bg-muted" />
              <span className="h-2 flex-1 rounded-full bg-muted" />
            </div>
          ))}
        </div>

        <div className="relative min-w-0 flex-1">
          {/* Entête des jours */}
          <div className="mb-1 grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${DAY_COUNT}, minmax(0, 1fr))` }}>
            {Array.from({ length: DAY_COUNT }).map((_, day) => (
              <div
                key={day}
                className="rounded-[3px] py-0.5 text-center text-[9px] leading-none font-medium tabular-nums text-muted-foreground"
                style={WEEKEND_COLUMNS.has(day) ? { backgroundColor: WEEKEND_HEADER_BG } : undefined}
              >
                {day + 12}
              </div>
            ))}
          </div>

          {/* Rangées : fond de cellules + briques de séjour superposées */}
          <div className="flex flex-col gap-2">
            {DEMO_STAYS.map((stay) => (
              <div
                key={stay.row}
                className="grid h-6 gap-[3px]"
                style={{ gridTemplateColumns: `repeat(${DAY_COUNT}, minmax(0, 1fr))` }}
              >
                {Array.from({ length: DAY_COUNT }).map((_, day) => (
                  <div
                    key={day}
                    className="rounded-[3px] bg-muted/50"
                    style={WEEKEND_COLUMNS.has(day) ? { backgroundColor: WEEKEND_CELL_BG } : undefined}
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
                    className="pl-empty-bar flex h-5 items-center gap-1 rounded-[4px] px-1"
                    style={{
                      backgroundColor: RESERVATION_STATUS_BAR_COLORS[stay.status],
                      color: RESERVATION_STATUS_BAR_INK[stay.status],
                      animationDelay: `${stay.row * 120}ms`,
                    }}
                  >
                    <img
                      src={stay.logo}
                      alt=""
                      className={`size-3.5 shrink-0 rounded-[3px] bg-card object-contain p-px ${
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
                      color: 'var(--bui-card)',
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
                      color: 'var(--bui-card)',
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
                        className="pl-empty-rise self-center text-center text-[8px] leading-none font-medium tabular-nums text-muted-foreground"
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
      <div className="mt-3 flex items-end gap-2 border-t border-border pt-2">
        <span className="w-20 shrink-0 text-[9px] leading-none font-medium text-muted-foreground">
          {t('planning.grid.occupancy', 'Occupation')}
        </span>
        <div
          className="grid h-4 min-w-0 flex-1 items-end gap-[3px]"
          style={{ gridTemplateColumns: `repeat(${DAY_COUNT}, minmax(0, 1fr))` }}
        >
          {DEMO_OCCUPANCY.map((rate, day) => (
            <span
              key={day}
              className="pl-empty-occ h-full rounded-[2px] bg-primary"
              style={{
                transform: `scaleY(${scene === 3 ? rate : 0.12})`,
                opacity: scene === 3 ? 1 : 0.35,
                transitionDelay: `${day * 30}ms`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Confirmation du renvoi vers les canaux — n'apparaît qu'au jalon du
          déplacement, au moment où elle veut dire quelque chose. */}
      <div className="pl-empty-sync-note mt-3">
        <p className={`m-0 flex items-center gap-1.5 text-xs font-medium text-foreground transition-opacity duration-200 ${moved ? 'opacity-100' : 'opacity-0'}`}>
          <SwapHoriz size={12} strokeWidth={2} />
          {t('planning.empty.showcase.pushedBack')}
        </p>
      </div>
    </div>
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
  const reducedMotion = usePrefersReducedMotion();
  const [active, setActive] = useState(0);
  const [touched, setTouched] = useState(false);
  const demoId = useId();

  useEffect(() => {
    if (touched || reducedMotion) return;
    const id = window.setInterval(
      () => setActive((current) => (current + 1) % MILESTONE_KEYS.length),
      4600,
    );
    return () => window.clearInterval(id);
  }, [touched, reducedMotion]);

  const select = (index: number) => {
    setTouched(true);
    setActive(index);
  };

  return (
    <div className="pl-empty-showcase mx-auto w-full max-w-6xl px-4 pt-5 pb-10 sm:px-6 sm:pt-7">
      <StoryPage className="gap-10 sm:gap-12">
        {/* ── Accroche : la promesse et l'action à gauche, la démonstration à
            droite. Pas de hauteur minimale : le bloc doit finir au-dessus de
            la ligne de flottaison, pas l'occuper de force. ── */}
        <section className="pl-empty-intro grid items-start gap-8">
          <div className="min-w-0">
            <Reveal>
              <h2 className="cn-font-heading m-0 text-2xl leading-tight font-semibold text-balance text-foreground sm:text-3xl xl:text-4xl">
                {t('planning.empty.showcase.title')}
              </h2>
            </Reveal>

            <Reveal delay={70}>
              <p className="m-0 mt-4 max-w-prose text-base leading-relaxed text-muted-foreground">
                {t('planning.empty.showcase.lede')}
              </p>
            </Reveal>

            {/* Les actions d'abord : le geste attendu ne se mérite pas au bout
                d'un argumentaire. */}
            <Reveal delay={130}>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Button size="lg" onClick={() => navigate('/properties/new')}>
                  {t('planning.empty.showcase.addProperty', 'Ajouter un logement')}
                </Button>
                <Button size="lg" variant="outline" onClick={onImport}>
                  {t('planning.empty.showcase.importChannel', 'Importer depuis un canal')}
                </Button>
              </div>
            </Reveal>

            <Reveal delay={180}>
              <p className="m-0 mt-3 text-sm text-muted-foreground">
                {t('planning.empty.showcase.alreadyOnline')}{' '}
                <button
                  type="button"
                  onClick={onImport}
                  className="cursor-pointer rounded-sm bg-transparent p-0 font-medium text-primary underline underline-offset-4 outline-none transition-colors duration-200 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {t('planning.empty.showcase.importWithCalendars')}
                </button>
              </p>
            </Reveal>

            <section className="mt-7 border-t border-border pt-5" aria-labelledby={`${demoId}-channels`}>
              <h3 id={`${demoId}-channels`} className="m-0 text-base font-semibold text-foreground">
                {t('planning.empty.showcase.channelsTitle')}
              </h3>
              <p className="m-0 mt-2 text-sm leading-relaxed text-muted-foreground">
                {t('planning.empty.showcase.channelsDescription')}
              </p>
              <ul className="pl-empty-partners m-0 mt-4 grid list-none grid-cols-2 gap-3 p-0" aria-label={t('planning.empty.showcase.partnersLabel')}>
                {CHANNEL_PARTNERS.map((partner) => (
                  <li key={partner.name} className="min-w-0">
                    <img
                      src={partner.badge}
                      alt={`${partner.name}, ${partner.certification}`}
                      width={110}
                      height={44}
                      className="block h-auto w-full"
                      decoding="async"
                    />
                  </li>
                ))}
              </ul>
              <p className="m-0 mt-4 flex items-start gap-2 text-sm leading-relaxed text-muted-foreground">
                <Check size={16} className="mt-0.5 shrink-0" aria-hidden />
                <span>{t('planning.empty.showcase.icalNote')}</span>
              </p>
            </section>
          </div>

          <div className="min-w-0" role="group" aria-label={t('planning.empty.showcase.demoLabel')}>
            <p className="m-0 mb-3 text-xs font-medium text-muted-foreground">
              {t('planning.empty.showcase.demoLabel')}
            </p>
            <div id={demoId} className="rounded-2xl bg-muted/60 p-3 select-none sm:p-4" aria-hidden>
              <MockupSlot
                brief="Quatre scènes pilotées par les étapes sous le planning : canaux réunis, déplacement d'un séjour, interventions entre deux séjours, tarifs et occupation."
                poster={<DemoGrid scene={active} />}
              />
            </div>

            <ol className="m-0 mt-4 flex list-none flex-col gap-1 p-0">
              {MILESTONE_KEYS.map((milestoneKey, index) => {
                const selected = index === active;
                return (
                  <li key={milestoneKey}>
                      <button
                        type="button"
                        aria-current={selected || undefined}
                        aria-expanded={selected}
                        aria-controls={`${demoId}-step-${index}`}
                        onClick={() => select(index)}
                        className={`flex w-full cursor-pointer items-start gap-3 rounded-lg px-3 py-2.5 text-start outline-none transition-colors duration-200 hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 ${
                          selected ? 'bg-accent' : ''
                        }`}
                      >
                        <span
                          className={`mt-px inline-flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums transition-colors duration-200 ${
                            selected
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {index + 1}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-foreground">
                            {t(`planning.empty.showcase.milestones.${milestoneKey}.label`)}
                          </span>
                          <span id={`${demoId}-step-${index}`} className="pl-empty-detail" hidden={!selected}>
                            <span className="block pt-1 text-sm text-muted-foreground">
                              {t(`planning.empty.showcase.milestones.${milestoneKey}.detail`)}
                            </span>
                          </span>
                        </span>
                      </button>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        {/* ── Le mécanisme ET son garde-fou : un seul bloc. Les quatre étapes
            démontrent la promesse qui les surplombe, les garanties la
            referment. ── */}
        <StoryBand
          eyebrow={{
            icon: <Block size={16} strokeWidth={1.85} />,
            label: t('planning.empty.showcase.noDoubleBooking'),
          }}
          title={t('planning.empty.showcase.bandTitle')}
          lede={t('planning.empty.showcase.bandLede')}
          guarantees={[
            t('planning.empty.showcase.guarantees.twoWay'),
            t('planning.empty.showcase.guarantees.channels'),
            t('planning.empty.showcase.guarantees.noDouble'),
            t('planning.empty.showcase.guarantees.history'),
          ]}
        >
          <StoryFlow
            steps={(['announce', 'decide', 'propagate', 'operate'] as const).map((step) => ({
              label: t(`planning.empty.showcase.flow.${step}.label`),
              text: t(`planning.empty.showcase.flow.${step}.text`),
            }))}
          />
        </StoryBand>

        {/* ── Les services rendus par la grille — trois colonnes sur grand
            écran : six points sur deux colonnes ajoutaient un écran entier. ── */}
        <StorySection
          title={t('planning.empty.showcase.sectionTitle')}
          lede={t('planning.empty.showcase.sectionLede')}
        >
          <StoryPoints
            className="lg:grid-cols-3"
            items={[
              { icon: <SwapHoriz />, key: 'drag' },
              { icon: <CleaningServices />, key: 'ops' },
              { icon: <Euro />, key: 'price' },
              { icon: <Block />, key: 'block' },
              { icon: <TrendingUp />, key: 'occupancy' },
              { icon: <AutoAwesome />, key: 'agents' },
            ].map(({ icon, key }) => ({
              icon,
              title: t(`planning.empty.showcase.points.${key}.title`),
              text: t(`planning.empty.showcase.points.${key}.text`),
            }))}
          />
        </StorySection>
      </StoryPage>
    </div>
  );
}
