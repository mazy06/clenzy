import {
  CalendarClockIcon,
  GaugeIcon,
  PartyPopperIcon,
  ShieldCheckIcon,
  SnowflakeIcon,
  TagIcon,
  TrendingUpIcon,
} from 'lucide-react';
import { Badge, Button } from '../../../components/ui';
import MockupSlot from '../../../components/baitly/MockupSlot';
import {
  StoryBand,
  StoryFlow,
  StoryFooterCta,
  StoryHero,
  StoryNote,
  StoryPage,
  StoryPoints,
  StorySection,
  StorySeparator,
  StoryZones,
} from '../../../components/baitly/FeatureStory';

/**
 * Tarification — état vide « format long » du moteur de rendement.
 *
 * ⚠️ Aucun chiffre de performance n'est avancé. Le concurrent affiche
 * « +25 % de revenu par logement » ; nous n'avons pas cette mesure et l'inventer
 * serait une allégation mensongère. La seule démonstration chiffrée est
 * étiquetée « illustration du principe ».
 */

// ─── Schéma : la courbe du revenu ───────────────────────────────────────────

/**
 * L'enjeu du yield en une image : l'occupation baisse quand le prix monte, mais
 * le revenu passe par un maximum. C'est ce sommet qu'on cherche.
 */
function RevenueCurveSchema() {
  return (
    <svg
      viewBox="0 0 560 200"
      className="h-auto w-full"
      role="img"
      aria-label="Quand le prix par nuit augmente, le taux d'occupation baisse continûment tandis que le revenu passe par un maximum, situé à un prix intermédiaire."
    >
      <line x1="56" y1="172" x2="536" y2="172" className="stroke-border" strokeWidth="1" />
      <line x1="56" y1="16" x2="56" y2="172" className="stroke-border" strokeWidth="1" />

      <path
        d="M56 158 C 168 142, 208 48, 292 46 C 382 44, 432 108, 536 154 L536 172 L56 172 Z"
        className="fill-primary/10"
      />
      <path
        d="M56 36 C 196 54, 330 120, 536 164"
        className="stroke-muted-foreground"
        strokeWidth="2"
        strokeDasharray="5 4"
        fill="none"
      />
      <path
        d="M56 158 C 168 142, 208 48, 292 46 C 382 44, 432 108, 536 154"
        className="stroke-primary"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />

      <line
        x1="292"
        y1="46"
        x2="292"
        y2="172"
        className="stroke-primary/40"
        strokeWidth="1"
        strokeDasharray="4 4"
      />
      <circle cx="292" cy="46" r="11" className="fill-primary/20" />
      <circle cx="292" cy="46" r="5.5" className="fill-primary" />
      <circle cx="110" cy="150" r="4" className="fill-muted-foreground/60" />
      <circle cx="486" cy="141" r="4" className="fill-muted-foreground/60" />
    </svg>
  );
}

// ─── Schéma : la cascade de résolution du prix ──────────────────────────────

const PRICE_LEVELS = [
  { level: 1, name: 'Prix forcé sur une date', example: 'aucun', applies: false },
  { level: 2, name: 'Promotion active', example: 'aucune', applies: false },
  { level: 3, name: 'Grille saisonnière', example: 'Haute saison · 180 €', applies: true },
  { level: 4, name: 'Règle dernière minute', example: '−10 % à J−3', applies: false },
  { level: 5, name: 'Tarif de base', example: '140 €', applies: false },
  { level: 6, name: 'Prix du logement', example: '120 €', applies: false },
];

/** Six niveaux, le premier applicable l'emporte — c'est ce qui rend un prix explicable. */
function PriceCascadeSchema() {
  return (
    <ol className="m-0 flex list-none flex-col gap-1 p-0">
      {PRICE_LEVELS.map((level) => (
        <li
          key={level.level}
          className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
            level.applies ? 'border-primary/40 bg-primary-soft' : 'border-border bg-card opacity-70'
          }`}
        >
          <span
            className={`inline-flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums ${
              level.applies ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}
          >
            {level.level}
          </span>
          <span className="min-w-0 flex-1 text-sm font-medium text-foreground">{level.name}</span>
          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{level.example}</span>
          {level.applies && (
            <Badge variant="secondary" className="shrink-0">
              prix retenu
            </Badge>
          )}
        </li>
      ))}
    </ol>
  );
}

// ─── Schéma : avant / après sur un mois ─────────────────────────────────────

const FLAT_MONTH = Array.from({ length: 30 }, (_, index) => ({
  booked: index % 3 !== 2,
  height: 52,
}));

const TUNED_MONTH = Array.from({ length: 30 }, (_, index) => {
  const weekend = index % 7 === 5 || index % 7 === 6;
  const lastMinute = index < 4;
  return { booked: index % 8 !== 7, height: weekend ? 78 : lastMinute ? 38 : 56 };
});

function MonthBars({
  nights,
  tone,
}: {
  nights: Array<{ booked: boolean; height: number }>;
  tone: 'flat' | 'tuned';
}) {
  return (
    <div className="flex h-24 items-end gap-[3px]">
      {nights.map((night, index) => (
        <div
          key={index}
          className={`flex-1 rounded-[2px] ${
            !night.booked ? 'bg-muted' : tone === 'tuned' ? 'bg-primary' : 'bg-muted-foreground/40'
          }`}
          style={{ height: `${night.height}%` }}
        />
      ))}
    </div>
  );
}

// ─── Écran ──────────────────────────────────────────────────────────────────

export function BPricingYieldEmptyProjectionDemo() {
  return (
    <StoryPage>
      <StoryHero
        eyebrow={{ icon: <TagIcon />, label: 'Tarification dynamique' }}
        title="Le bon prix n’est ni le plus haut, ni le plus bas."
        lede="Un tarif figé laisse forcément de l’argent quelque part : sur les nuits qui se vendent trop facilement, ou sur celles qui ne se vendent pas. Baitly ajuste le prix nuit par nuit et repousse le résultat vers tous vos canaux."
        actions={
          <>
            <Button size="lg">Définir un tarif de base</Button>
            <Button size="lg" variant="ghost">
              Voir comment un prix est construit
            </Button>
          </>
        }
        note="Il faut au moins un logement avec un tarif de base pour activer le moteur."
        aside={
          <MockupSlot
            brief="Le curseur de prix se déplace le long de l'axe : la courbe d'occupation descend, la courbe de revenu monte puis redescend, et le repère vient se caler sur le sommet. Doit se lire sans texte."
            poster={<RevenueCurveSchema />}
          />
        }
      />

      <StorySection
        title="Pourquoi un prix figé coûte de l’argent"
        lede="Quand le prix monte, l’occupation baisse — c’est mécanique. Le revenu, lui, ne suit pas la même pente : il monte, atteint un sommet, puis redescend. Tout l’enjeu est de se tenir près de ce sommet, nuit après nuit."
      >
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-center">
          <div className="rounded-xl border border-border bg-card p-5">
            <RevenueCurveSchema />
            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
              <span>← prix plus bas</span>
              <span>prix plus haut →</span>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-4 text-xs">
              <span className="flex items-center gap-2 text-muted-foreground">
                <span className="inline-block h-0.5 w-6 rounded-full bg-primary" />
                Revenu
              </span>
              <span className="flex items-center gap-2 text-muted-foreground">
                <span className="inline-block w-6 border-t-2 border-dashed border-muted-foreground" />
                Taux d’occupation
              </span>
            </div>
          </div>

          <StoryZones
            items={[
              {
                tag: 'Prix trop bas',
                text: 'Le calendrier se remplit vite, et chaque nuit vendue l’est en dessous de ce que le marché acceptait.',
              },
              {
                tag: 'Sommet',
                text: 'Assez cher pour que chaque nuit rapporte, assez accessible pour que le calendrier se remplisse. C’est la cible.',
                highlight: true,
              },
              {
                tag: 'Prix trop haut',
                text: 'Les nuits restent libres. Une nuit invendue ne se rattrape jamais : elle a une date d’expiration.',
              },
            ]}
          />
        </div>
      </StorySection>

      <StorySeparator />

      <StorySection
        title="Ce que ça change sur un mois"
        lede="À gauche, un tarif identique toutes les nuits. À droite, le même mois avec un prix qui monte le week-end et cède du terrain sur les nuits proches restées libres."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Tarif figé</span>
              <span className="text-xs text-muted-foreground tabular-nums">20 nuits vendues</span>
            </div>
            <MonthBars nights={FLAT_MONTH} tone="flat" />
          </div>
          <div className="rounded-xl border border-primary/40 bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">Prix ajusté nuit par nuit</span>
              <span className="text-xs text-muted-foreground tabular-nums">26 nuits vendues</span>
            </div>
            <MonthBars nights={TUNED_MONTH} tone="tuned" />
          </div>
        </div>
        <StoryNote>
          Illustration du principe : la hauteur d’une barre représente le prix de la nuit, une barre
          grise une nuit restée libre. Les gains réels dépendent de votre marché — Baitly ne promet
          pas un pourcentage.
        </StoryNote>
      </StorySection>

      <StorySeparator />

      <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center">
        <div className="min-w-0">
          <h3 className="cn-font-heading m-0 text-xl font-semibold text-foreground">
            D’où vient un prix, exactement
          </h3>
          <p className="m-0 mt-3 text-sm text-muted-foreground">
            Six niveaux sont examinés dans l’ordre ; <strong>le premier qui s’applique l’emporte</strong>.
            C’est ce qui rend chaque prix explicable : sur n’importe quelle nuit, vous pouvez
            remonter au niveau qui l’a décidé.
          </p>
          <p className="m-0 mt-3 text-sm text-muted-foreground">
            Dans l’exemple ci-contre, aucune date n’est forcée et aucune promotion n’est active :
            c’est donc la grille saisonnière qui donne le prix, avant même que le tarif de base ne
            soit consulté.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <PriceCascadeSchema />
        </div>
      </section>

      <StorySeparator />

      <StorySection title="Sur quoi le moteur s’appuie">
        <StoryPoints
          items={[
            {
              icon: <SnowflakeIcon />,
              title: 'Saisonnalité',
              text: 'Des grilles par période, appliquées à l’avance sur tout le calendrier.',
            },
            {
              icon: <CalendarClockIcon />,
              title: 'Dernière minute',
              text: 'Une nuit encore libre à J−3 vaut mieux vendue moins cher que pas vendue.',
            },
            {
              icon: <PartyPopperIcon />,
              title: 'Événements locaux',
              text: 'Un salon ou un festival déplace la demande sur quelques nuits précises.',
            },
            {
              icon: <GaugeIcon />,
              title: 'Rythme de remplissage',
              text: 'Si un mois se remplit plus lentement que d’habitude, le prix doit réagir.',
            },
          ]}
        />
      </StorySection>

      <StorySeparator />

      <StoryBand
        eyebrow={{ icon: <ShieldCheckIcon />, label: 'Garde-fous' }}
        title="Aucun prix n’est modifié sans votre accord"
        lede="Le moteur propose, vous tranchez. Chaque suggestion arrive sous forme de carte, avec la raison qui l’a déclenchée et une simulation sur deux mois. L’automatisation complète reste une option, que vous activez logement par logement."
        guarantees={[
          'Prix plancher et plafond par logement',
          'Aucune proposition deux fois de suite sur la même période',
          'Historique de chaque décision, conservé',
        ]}
      >
        <StoryFlow
          steps={[
            { label: 'Signal détecté', text: 'remplissage en retard sur un mois' },
            { label: 'Proposition', text: 'carte avec la raison et la simulation' },
            { label: 'Votre décision', text: 'appliquer, ajuster ou ignorer' },
            { label: 'Diffusion', text: 'le prix repart vers tous les canaux' },
          ]}
        />
      </StoryBand>

      <StoryFooterCta
        icon={<TrendingUpIcon />}
        title="Commencer par le tarif de base"
        text="C’est le seul réglage obligatoire : tout le reste se construit par-dessus."
        actions={
          <>
            <Button>Définir un tarif de base</Button>
            <Button variant="outline">Importer une grille existante</Button>
          </>
        }
      />
    </StoryPage>
  );
}
