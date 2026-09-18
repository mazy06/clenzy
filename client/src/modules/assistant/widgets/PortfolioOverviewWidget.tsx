import React from 'react';
import StatusChip from '../../../components/StatusChip';
import StatTile from '../../../components/baitly/StatTile';
import StatTileRow from '../../../components/baitly/StatTileRow';
import { Progress } from '../../../components/ui';
import { cn } from '../../../utils/cn';
import {
  TrendingUp as TrendUpIcon,
  TrendingDown as TrendDownIcon,
  LocationCity as CityIcon,
  Warning as WarningIcon,
  Home as PropertyIcon,
  Euro as RevenueIcon,
  Percent as OccupancyIcon,
  Bed as NightIcon,
} from '../../../icons';

interface TopPerformer {
  id: number;
  name: string;
  city?: string;
  revenue: number;
  occupancy: number; // 0..1
  reservations: number;
}

interface UnderPerformer {
  id: number;
  name: string;
  city?: string;
  occupancy: number; // 0..1
  reservations: number;
  reason: string;
  recommendation: string;
}

interface Pattern {
  type: string;
  severity: string; // LOW | MEDIUM | HIGH | CRITICAL
  title: string;
  description: string;
  items?: string[];
}

interface PortfolioOverviewData {
  title?: string;
  daysBack?: number;
  from?: string;
  to?: string;
  totalProperties?: number;
  activeProperties?: number;
  totalRevenue?: number;
  avgOccupancy?: number; // 0..1
  avgADR?: number;
  topPerformers?: TopPerformer[];
  underPerformers?: UnderPerformer[];
  patterns?: Pattern[];
}

interface PortfolioOverviewWidgetProps {
  data: PortfolioOverviewData;
}

/**
 * Widget de rendu pour {@code displayHint="portfolio_overview"} — vue d'ensemble
 * cross-property generee par le tool {@code analyze_portfolio}.
 *
 * <p>Trois sections empilees verticalement :
 * <ol>
 *   <li>Bandeau de 4 chiffres ({@code StatTileRow compact}) : totalProperties /
 *       totalRevenue / avgOccupancy / avgADR</li>
 *   <li>Top performers : 3 cartes compactes avec barre d'occupation</li>
 *   <li>Sous-performants : liste avec raison + recommandation inline</li>
 *   <li>Patterns detectes : items avec icone par type + chip severity</li>
 * </ol>
 *
 * <p>Habillage Baitly UI : sur-titres en petites capitales, valeurs en
 * {@code tabular-nums}, fonds sémantiques {@code -soft}.</p>
 *
 * <p><b>Deux tons de texte sur pastel, pas trois.</b> Les blocs teintés
 * portaient trois niveaux — {@code text-foreground}, {@code muted-foreground},
 * {@code text-faint} — mais la palette n'en supporte que deux sur un aplat
 * {@code -soft}. Mesuré en clair, le pastel étant composité sur
 * {@code --background} : {@code text-faint} plafonne entre 1,98:1 et 2,07:1 et
 * {@code muted-foreground} entre 4,25:1 et 4,43:1 — les deux sous le seuil AA
 * du petit texte. Le secondaire est donc un ton DÉRIVÉ de l'encre de page,
 * {@code text-foreground/70}, mesuré de 4,96:1 à 6,38:1 sur les quatre pastels
 * et dans les deux thèmes ; le primaire garde {@code text-foreground} (11,8:1
 * à 12,8:1) et le chiffre sémantique son {@code -ink} (4,89:1 à 7,84:1).
 * {@code text-faint} n'a aucun fond qui le fasse passer, pas même
 * {@code --background} en clair (2,30:1) : il a quitté ce fichier.</p>
 *
 * <p><b>Les chiffres du haut font exception</b> : ils montent le primitif
 * partage {@code baitly/StatTile}, qui pose ses tuiles sur {@code --card} et
 * n'admet pas de fond semantique. La tuile locale qui vivait ici teintait le
 * fond ({@code -soft} composite sur {@code --background}, le fil etant rendu
 * hors bulle) et titrait en {@code text-faint} : 2,06:1 en clair, 3,79:1 en
 * sombre — sous le seuil AA dans les deux themes, et pour les trois etats. Le
 * fond pastel faisait en outre retomber le hint a 4,41:1, la regression meme
 * que l'assombrissement de {@code --bui-muted-foreground} avait corrigee. Sur
 * {@code --card}, libelle et hint remontent a 5,17:1 en clair, 6,65:1 en
 * sombre. L'etat d'occupation passe a l'icone — cf. {@link occupancyTone}.</p>
 */
export const PortfolioOverviewWidget: React.FC<PortfolioOverviewWidgetProps> = ({ data }) => {
  const total = data.totalProperties ?? 0;
  const active = data.activeProperties ?? 0;
  const revenue = data.totalRevenue ?? 0;
  const occupancy = data.avgOccupancy ?? 0;
  const adr = data.avgADR ?? 0;
  const topPerformers = data.topPerformers ?? [];
  const underPerformers = data.underPerformers ?? [];
  const patterns = data.patterns ?? [];
  const { icon: OccupancyStateIcon, iconClassName: occupancyInk } = occupancyTone(occupancy);

  if (total === 0) {
    return (
      <div className="mt-1.5 mb-2">
        <div className="p-4 rounded-xl bg-warning-soft text-center">
          <p className="text-xs font-semibold text-warning-ink">
            Aucune propriete dans le portefeuille — ajoute-en une pour commencer.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-1.5 mb-2 flex flex-col gap-2">
      {data.title && (
        <p className="block text-2xs font-bold uppercase tracking-[.05em] text-muted-foreground">
          {data.title}
        </p>
      )}

      {/* Section 1 : 4 stat tiles */}
      <StatTileRow compact>
        <StatTile
          icon={<PropertyIcon />}
          label="Proprietes"
          value={String(total)}
          hint={active === total ? `${active} actives` : `${active}/${total} actives`}
        />
        <StatTile
          icon={<RevenueIcon />}
          label="Revenus"
          value={formatCurrency(revenue)}
          hint={`${data.daysBack ?? 30}j`}
        />
        <StatTile
          icon={<OccupancyStateIcon />}
          iconClassName={occupancyInk}
          label="Occupation"
          value={`${Math.round(occupancy * 100)}%`}
          hint="moyenne portfolio"
        />
        <StatTile
          icon={<NightIcon />}
          label="ADR moyen"
          value={formatCurrency(adr)}
          hint="par nuit reservee"
        />
      </StatTileRow>

      {/* Section 2 : Top performers */}
      {topPerformers.length > 0 && (
        <div>
          <SectionHeader
            label="Top performers"
            icon={<TrendUpIcon size={14} />}
            color="var(--color-success-ink)"
          />
          {/* md MUI = 900px. Le nombre de colonnes ne vaut que 1, 2 ou 3 : on enumere les
              classes plutot que de les construire (Tailwind compile en scannant le source). */}
          <div
            className={cn(
              'grid grid-cols-[1fr] gap-1.5',
              topPerformers.length === 1
                ? 'min-[900px]:grid-cols-[repeat(1,1fr)]'
                : topPerformers.length === 2
                  ? 'min-[900px]:grid-cols-[repeat(2,1fr)]'
                  : 'min-[900px]:grid-cols-[repeat(3,1fr)]',
            )}
          >
            {topPerformers.slice(0, 3).map((p) => (
              <TopPerformerCard key={p.id} performer={p} />
            ))}
          </div>
        </div>
      )}

      {/* Section 3 : Sous-performants */}
      {underPerformers.length > 0 && (
        <div>
          <SectionHeader
            label={`Sous-performants (${underPerformers.length})`}
            icon={<TrendDownIcon size={14} />}
            color="var(--color-warning-ink)"
          />
          <div className="flex flex-col gap-1">
            {underPerformers.map((p) => (
              <UnderPerformerRow key={p.id} performer={p} />
            ))}
          </div>
        </div>
      )}

      {/* Section 4 : Patterns detectes */}
      {patterns.length > 0 && (
        <div>
          <SectionHeader
            label="Patterns detectes"
            icon={<WarningIcon size={14} />}
            color="var(--color-destructive-ink)"
          />
          <div className="flex flex-col gap-1">
            {patterns.map((pat, idx) => (
              <PatternRow key={`${pat.type}-${idx}`} pattern={pat} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Sous-composants ─────────────────────────────────────────────────────────

const SectionHeader: React.FC<{
  label: string;
  icon: React.ReactNode;
  color: string;
}> = ({ label, icon, color }) => (
  <div className="flex items-center gap-0.5 mb-1">
    <div className="inline-flex" style={{ color }}>{icon}</div>
    {/* `color` est une prop : sa valeur n'existe qu'a l'execution, donc style
        inline (comme l'icone au-dessus) et non classe Tailwind. */}
    <p
      className="text-2xs font-bold uppercase tracking-[.05em]"
      style={{ color }}
    >
      {label}
    </p>
  </div>
);

const TopPerformerCard: React.FC<{ performer: TopPerformer }> = ({ performer }) => {
  const occupancyPct = Math.round(performer.occupancy * 100);

  return (
    <div className="px-2 py-1.5 rounded-lg bg-success-soft">
      <p className="text-[13.5px] font-semibold text-foreground whitespace-nowrap overflow-hidden text-ellipsis">
        {performer.name}
      </p>
      {performer.city && (
        <p className="block text-foreground/70 text-xs">
          {performer.city}
        </p>
      )}
      <div className="flex items-baseline gap-1 mt-0.5">
        <p className="text-[1rem] font-semibold tabular-nums text-success-ink">
          {formatCurrency(performer.revenue)}
        </p>
        <p className="text-foreground/70 text-xs">
          {performer.reservations} resa
        </p>
      </div>
      <div className="mt-1">
        <Progress
          value={occupancyPct}
          className="h-1 rounded-[2px] bg-[color-mix(in_srgb,var(--color-success-ink)_14%,transparent)] [&>[data-slot=progress-indicator]]:rounded-[2px] [&>[data-slot=progress-indicator]]:bg-[var(--color-success-ink)]"
        />
        <p className="block text-2xs mt-0.5 text-foreground/70 tabular-nums">
          Occupation {occupancyPct}%
        </p>
      </div>
    </div>
  );
};

const UnderPerformerRow: React.FC<{ performer: UnderPerformer }> = ({ performer }) => {
  return (
    <div className="px-2 py-1.5 rounded-lg bg-warning-soft flex gap-1.5 items-start">
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5">
          <p className="text-[13.5px] font-semibold text-foreground">
            {performer.name}
          </p>
          {performer.city && (
            <p className="text-foreground/70 text-xs">
              {performer.city}
            </p>
          )}
        </div>
        <p className="block text-warning-ink text-xs font-semibold mt-0.5">
          {performer.reason}
        </p>
        <p className="block text-foreground/70 text-xs italic mt-0.5">
          → {performer.recommendation}
        </p>
      </div>
      <p className="text-[0.85rem] font-semibold tabular-nums text-warning-ink whitespace-nowrap">
        {Math.round(performer.occupancy * 100)}%
      </p>
    </div>
  );
};

const PatternRow: React.FC<{ pattern: Pattern }> = ({ pattern }) => {
  const [sevColor, sevSoft] = severityColors(pattern.severity);
  const Icon = patternIcon(pattern.type);

  return (
    <div className="px-[7.5px] py-1.5 rounded-lg flex gap-1.5 items-start" style={{ backgroundColor: sevSoft }}>
      <div className="inline-flex mt-[0.75px]" style={{ color: sevColor }}>
        <Icon size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 mb-0.5">
          <p className="text-[13.5px] font-semibold text-foreground">
            {pattern.title}
          </p>
          <StatusChip size="sm" tokens={{ color: sevColor, bg: 'var(--color-card)' }} label={pattern.severity} className="text-2xs tracking-[.04em] uppercase" />
        </div>
        <p className="block text-foreground/70 text-xs">
          {pattern.description}
        </p>
        {pattern.items && pattern.items.length > 0 && (
          <p className="block text-foreground/70 text-xs mt-0.5">
            {pattern.items.join(' · ')}
          </p>
        )}
      </div>
    </div>
  );
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const currencyFormatter = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

function severityColors(severity: string): [string, string] {
  switch (severity?.toUpperCase()) {
    case 'CRITICAL':
    case 'HIGH':
      return ['var(--color-destructive-ink)', 'var(--color-destructive-soft)'];
    case 'MEDIUM':
      return ['var(--color-warning-ink)', 'var(--color-warning-soft)'];
    case 'LOW':
    default:
      return ['var(--color-info-ink)', 'var(--color-info-soft)'];
  }
}

// Type d'icone Lucide : on s'aligne sur les exports lucide-react (ForwardRef
// avec props variees) sans tenter de retyper localement.
type IconComponent = typeof TrendDownIcon;

/**
 * Etat d'occupation porte par la FORME de l'icone autant que par sa couleur.
 *
 * <p>En bandeau compact le {@code hint} se replie en infobulle native : la
 * teinte resterait le SEUL signal de l'etat, invisible tant que le curseur ne
 * passe pas, et indistinct pour un daltonisme. La fleche, elle, se lit sans
 * couleur.</p>
 *
 * <p>Encres {@code -ink} plutot que teintes vives : mesure sur {@code --card}
 * en clair, {@code text-success} plafonne a 2,42:1 et {@code text-warning} a
 * 2,17:1, contre 5,73:1 et 6,63:1 pour les encres. Une icone qui PORTE un sens
 * releve du seuil 3:1 (WCAG 1.4.11), que la teinte vive n'atteint pas — celle-ci
 * reste reservee aux icones decoratives, ou le libelle dit deja tout.</p>
 */
function occupancyTone(occupancy: number): { icon: IconComponent; iconClassName?: string } {
  if (occupancy >= 0.7) return { icon: TrendUpIcon, iconClassName: 'text-success-ink' };
  if (occupancy < 0.5) return { icon: TrendDownIcon, iconClassName: 'text-warning-ink' };
  return { icon: OccupancyIcon };
}

function patternIcon(type: string): IconComponent {
  switch (type) {
    case 'CITY_SATISFACTION_LOW':
      return CityIcon;
    case 'HIGH_CANCELLATION_RATE':
      return TrendDownIcon;
    default:
      return WarningIcon;
  }
}
