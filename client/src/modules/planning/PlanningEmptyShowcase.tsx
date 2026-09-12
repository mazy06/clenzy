import * as React from 'react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Skeleton } from '../../components/ui';
import {
  AutoAwesome,
  Block,
  CleaningServices,
  Euro,
  Build,
  SwapHoriz,
  TrendingUp,
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
 * de sorte que ce qui est promis à gauche est montré à droite au même instant.
 * Le défilement s'arrête dès que l'utilisateur choisit lui-même un jalon.
 *
 * La grille de démonstration emprunte les **vraies couleurs du planning**
 * (`constants.ts` : statuts « Terre cuite », teintes ménage / maintenance,
 * week-end, ligne du jour) : l'aperçu doit ressembler à l'écran qu'il annonce,
 * pas à une illustration générique.
 */

// ─── Jalons — chacun pilote une scène de la démonstration ───────────────────

const MILESTONES = [
  {
    key: 'sync',
    label: 'Tous vos canaux sur une seule grille',
    detail:
      'Airbnb, Booking.com, Vrbo et tout flux iCal se déversent ici. Le canal d’origine se lit en bout de séjour.',
  },
  {
    key: 'move',
    label: 'Déplacez un séjour, les canaux suivent',
    detail:
      'Glissez la brique sur d’autres nuits : les disponibilités repartent vers chaque canal connecté.',
  },
  {
    key: 'ops',
    label: 'Le ménage s’intercale entre deux séjours',
    detail:
      'Ménages, maintenances et blocages vivent sur la même grille que les réservations, pas dans un autre écran.',
  },
  {
    key: 'money',
    label: 'Prix par nuit et occupation, sous les yeux',
    detail:
      'Le tarif de chaque nuit libre et le taux d’occupation du jour s’affichent sans quitter le planning.',
  },
] as const;

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
  const moved = scene === 1;

  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
      <div className="flex gap-2">
        {/* Colonne des logements — squelettes : rien à traduire, aucune fausse
            donnée crédible à maintenir (convention des aperçus Baitly). */}
        <div className="flex w-20 shrink-0 flex-col gap-2 pt-6">
          {DEMO_STAYS.map((_, row) => (
            <div key={row} className="flex h-6 items-center gap-1.5">
              <span className="size-4 shrink-0 rounded-[4px] bg-muted" />
              <Skeleton className="h-2 flex-1" />
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
              left: `calc(${(TODAY_COLUMN * 100) / DAY_COUNT}% - 1px)`,
            }}
          />
        </div>
      </div>

      {/* Rangée d'occupation, en pied de grille comme dans le planning. */}
      <div className="mt-3 flex items-end gap-2 border-t border-border pt-2">
        <span className="w-20 shrink-0 text-[9px] leading-none font-medium text-muted-foreground">
          Occupation
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
      {moved && (
        <p className="pl-empty-pop m-0 mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-2.5 py-1 text-[10px] font-medium text-primary">
          <SwapHoriz size={12} strokeWidth={2} />
          Disponibilités renvoyées à Airbnb, Booking.com et Vrbo
        </p>
      )}
    </div>
  );
}

// ─── Écran ──────────────────────────────────────────────────────────────────

export interface PlanningEmptyShowcaseProps {
  /** Ouvre le choix de source d'import (iCal, Channex, canal direct). */
  onImport: () => void;
}

export default function PlanningEmptyShowcase({ onImport }: PlanningEmptyShowcaseProps) {
  const navigate = useNavigate();
  const reducedMotion = usePrefersReducedMotion();
  const [active, setActive] = useState(0);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (touched || reducedMotion) return;
    const id = window.setInterval(
      () => setActive((current) => (current + 1) % MILESTONES.length),
      4600,
    );
    return () => window.clearInterval(id);
  }, [touched, reducedMotion]);

  const select = (index: number) => {
    setTouched(true);
    setActive(index);
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-2 pb-10 sm:px-6">
      <StoryPage className="gap-10 sm:gap-12">
        {/* ── Accroche : la promesse et l'action à gauche, la démonstration à
            droite. Pas de hauteur minimale : le bloc doit finir au-dessus de
            la ligne de flottaison, pas l'occuper de force. ── */}
        <section className="grid items-start gap-8 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:gap-12">
          <div className="min-w-0">
            <Reveal>
              <h2 className="cn-font-heading m-0 text-3xl leading-tight font-semibold text-balance text-foreground sm:text-4xl">
                Un seul calendrier pour tous vos logements et tous vos canaux
              </h2>
            </Reveal>

            <Reveal delay={70}>
              <p className="m-0 mt-3 text-base text-muted-foreground">
                Les disponibilités se synchronisent dans les deux sens avec Airbnb, Booking.com et
                les autres. Plus de double réservation.
              </p>
            </Reveal>

            {/* Les actions d'abord : le geste attendu ne se mérite pas au bout
                d'un argumentaire. */}
            <Reveal delay={130}>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Button size="lg" onClick={() => navigate('/properties/new')}>
                  Ajouter un logement
                </Button>
                <Button size="lg" variant="outline" onClick={onImport}>
                  Importer depuis un canal
                </Button>
              </div>
            </Reveal>

            <Reveal delay={180}>
              <p className="m-0 mt-3 text-sm text-muted-foreground">
                Vos biens sont déjà en ligne ailleurs&nbsp;?{' '}
                <button
                  type="button"
                  onClick={onImport}
                  className="cursor-pointer bg-transparent p-0 font-medium text-primary underline underline-offset-4"
                >
                  Importez-les avec leurs calendriers
                </button>
              </p>
            </Reveal>

            {/* Jalons — seul l'actif est déplié : quatre détails empilés
                poussaient la démonstration hors de l'écran. */}
            <ul className="m-0 mt-6 flex list-none flex-col gap-0.5 border-t border-border p-0 pt-4">
              {MILESTONES.map((milestone, index) => {
                const selected = index === active;
                return (
                  <li key={milestone.key}>
                    <Reveal delay={230 + index * 60}>
                      <button
                        type="button"
                        aria-current={selected || undefined}
                        aria-expanded={selected}
                        onClick={() => select(index)}
                        className={`flex w-full cursor-pointer items-start gap-3 rounded-lg px-3 py-2.5 text-start outline-none transition-colors duration-200 hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 ${
                          selected ? 'bg-accent' : ''
                        }`}
                      >
                        <span
                          className={`mt-px inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold tabular-nums transition-colors duration-200 ${
                            selected
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {index + 1}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-foreground">
                            {milestone.label}
                          </span>
                          <span className="pl-empty-detail" data-open={selected}>
                            <span>
                              <span className="block pt-1 text-sm text-muted-foreground">
                                {milestone.detail}
                              </span>
                            </span>
                          </span>
                        </span>
                      </button>
                    </Reveal>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* La démonstration reste dans le champ pendant que les jalons
              défilent : collée en haut sur grand écran. */}
          <Reveal delay={260} className="min-w-0 lg:sticky lg:top-4">
            <div aria-hidden className="rounded-2xl bg-muted/60 p-4 select-none sm:p-5">
              <MockupSlot
                brief="Quatre séquences enchaînables, une par jalon : (1) les séjours se posent sur la grille, le logo du canal d'origine pulse en bout de brique ; (2) une brique est glissée sur d'autres nuits et les disponibilités repartent vers les canaux ; (3) un ménage s'intercale au départ et une maintenance se pose sur une nuit libre ; (4) les tarifs des nuits libres et la bande d'occupation montent. Chaque séquence doit pouvoir être jouée seule, à la demande du jalon sélectionné."
                poster={<DemoGrid scene={active} />}
              />
            </div>
          </Reveal>
        </section>

        {/* ── Le mécanisme ET son garde-fou : un seul bloc. Les quatre étapes
            démontrent la promesse qui les surplombe, les garanties la
            referment. ── */}
        <StoryBand
          eyebrow={{ icon: <Block size={16} strokeWidth={1.85} />, label: 'Plus de double réservation' }}
          title="Une nuit vendue est fermée partout, dans la minute"
          lede="Le calendrier fait foi : une réservation entrante ferme les mêmes nuits sur tous les autres canaux, sans que personne ait à y penser."
          guarantees={[
            'Synchronisation dans les deux sens',
            'Airbnb, Booking.com, Vrbo et tout flux iCal',
            'Aucune double saisie de disponibilité',
            'Historique des échanges avec chaque canal',
          ]}
        >
          <StoryFlow
            steps={[
              { label: '1 · Le canal annonce', text: 'Airbnb, Booking.com, Vrbo ou un flux iCal remonte la réservation.' },
              { label: '2 · Le calendrier tranche', text: 'Les nuits vendues passent en indisponible dans Baitly.' },
              { label: '3 · Les canaux suivent', text: 'La fermeture repart vers tous les autres canaux connectés.' },
              { label: '4 · L’exploitation s’enclenche', text: 'Ménage, arrivée et départ se placent sur les bonnes dates.' },
            ]}
          />
        </StoryBand>

        {/* ── Les services rendus par la grille — trois colonnes sur grand
            écran : six points sur deux colonnes ajoutaient un écran entier. ── */}
        <StorySection
          title="Ce que la grille sait faire"
          lede="Tout se règle depuis le planning : c’est l’écran où l’on passe la journée, il n’a pas à renvoyer ailleurs."
        >
          <StoryPoints
            className="lg:grid-cols-3"
            items={[
              {
                icon: <SwapHoriz />,
                title: 'Glisser-déposer un séjour',
                text: 'Déplacez ou allongez une réservation à la souris ; les canaux sont mis à jour derrière.',
              },
              {
                icon: <CleaningServices />,
                title: 'Ménages et maintenances',
                text: 'Les interventions se posent sur la même grille, à la nuit exacte, et s’assignent à une équipe.',
              },
              {
                icon: <Euro />,
                title: 'Tarif de chaque nuit',
                text: 'Prix et minimum de nuits s’affichent dans les cellules libres, modifiables sur place.',
              },
              {
                icon: <Block />,
                title: 'Blocage de dates',
                text: 'Fermez une période pour travaux ou usage personnel : la fermeture part sur tous les canaux.',
              },
              {
                icon: <TrendingUp />,
                title: 'Occupation du jour',
                text: 'Une bande en pied de grille donne le taux d’occupation, jour après jour, sur le portefeuille.',
              },
              {
                icon: <AutoAwesome />,
                title: 'Actions à valider',
                text: 'Les propositions des agents remontent sur la ligne du logement concerné, prêtes à accepter ou refuser.',
              },
            ]}
          />
        </StorySection>
      </StoryPage>
    </div>
  );
}
