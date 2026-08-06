import React from 'react';
import StatusChip from '../../../components/StatusChip';
import { Progress } from '../../../components/ui';
import { cn } from '../../../utils/cn';
import {
  TrendingUp as TrendUpIcon,
  TrendingDown as TrendDownIcon,
  LocationCity as CityIcon,
  Warning as WarningIcon,
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
 *   <li>4 stat tiles : totalProperties / totalRevenue / avgOccupancy / avgADR</li>
 *   <li>Top performers : 3 cartes compactes avec barre d'occupation</li>
 *   <li>Sous-performants : liste avec raison + recommandation inline</li>
 *   <li>Patterns detectes : items avec icone par type + chip severity</li>
 * </ol>
 *
 * <p>Habillage Baitly UI : sur-titres en petites capitales {@code text-faint},
 * valeurs en {@code tabular-nums}, fonds sémantiques {@code -soft}.</p>
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
        <p className="block text-2xs font-bold uppercase tracking-[.05em] text-faint">
          {data.title}
        </p>
      )}

      {/* Section 1 : 4 stat tiles */}
      <div className="grid grid-cols-[repeat(2,_1fr)] min-[900px]:grid-cols-[repeat(4,_1fr)] gap-1.5">
        <StatTile
          label="Proprietes"
          value={String(total)}
          hint={active === total ? `${active} actives` : `${active}/${total} actives`}
        />
        <StatTile
          label="Revenus"
          value={formatCurrency(revenue)}
          hint={`${data.daysBack ?? 30}j`}
        />
        <StatTile
          label="Occupation"
          value={`${Math.round(occupancy * 100)}%`}
          hint="moyenne portfolio"
          accent={occupancy >= 0.7 ? 'positive' : occupancy < 0.5 ? 'negative' : 'neutral'}
        />
        <StatTile
          label="ADR moyen"
          value={formatCurrency(adr)}
          hint="par nuit reservee"
        />
      </div>

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

const StatTile: React.FC<{
  label: string;
  value: string;
  hint?: string;
  accent?: 'positive' | 'negative' | 'neutral';
}> = ({ label, value, hint, accent = 'neutral' }) => {
  const tileBg =
    accent === 'positive' ? 'var(--color-success-soft)'
    : accent === 'negative' ? 'var(--color-warning-soft)'
    : 'var(--color-muted)';

  return (
    <div className="px-[7.5px] py-1.5 rounded-lg" style={{ backgroundColor: tileBg }}>
      <p className="block text-faint text-2xs font-bold uppercase tracking-[.05em] mb-0.5">
        {label}
      </p>
      <p className="text-[1.15rem] font-semibold leading-[1.2] tabular-nums text-foreground tracking-[-0.01em]">
        {value}
      </p>
      {hint && (
        <p className="block text-muted-foreground text-2xs mt-0.5">
          {hint}
        </p>
      )}
    </div>
  );
};

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
        <p className="block text-muted-foreground text-xs">
          {performer.city}
        </p>
      )}
      <div className="flex items-baseline gap-1 mt-0.5">
        <p className="text-[1rem] font-semibold tabular-nums text-success-ink">
          {formatCurrency(performer.revenue)}
        </p>
        <p className="text-faint text-xs">
          {performer.reservations} resa
        </p>
      </div>
      <div className="mt-1">
        <Progress
          value={occupancyPct}
          className="h-1 rounded-[2px] bg-[color-mix(in_srgb,var(--color-success-ink)_14%,transparent)] [&>[data-slot=progress-indicator]]:rounded-[2px] [&>[data-slot=progress-indicator]]:bg-[var(--color-success-ink)]"
        />
        <p className="block text-2xs mt-0.5 text-muted-foreground tabular-nums">
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
            <p className="text-muted-foreground text-xs">
              {performer.city}
            </p>
          )}
        </div>
        <p className="block text-warning-ink text-xs font-semibold mt-0.5">
          {performer.reason}
        </p>
        <p className="block text-muted-foreground text-xs italic mt-0.5">
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
        <p className="block text-muted-foreground text-xs">
          {pattern.description}
        </p>
        {pattern.items && pattern.items.length > 0 && (
          <p className="block text-faint text-xs mt-0.5">
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
