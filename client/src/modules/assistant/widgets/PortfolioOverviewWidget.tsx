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
 * <p>Pattern « Signature » : tokens var(--…), labels overline 10.5px
 * {@code --faint}, valeurs display tabular-nums, fonds {@code -soft}.</p>
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
        <div className="p-4 rounded-[12px] bg-[var(--warn-soft)] text-center">
          <p className="cn-text-body1 text-[12.5px] font-semibold text-[var(--warn)]">
            Aucune propriete dans le portefeuille — ajoute-en une pour commencer.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-1.5 mb-2 flex flex-col gap-2">
      {data.title && (
        <p className="cn-text-body1 block text-[10.5px] font-bold uppercase tracking-[.05em] text-[var(--faint)]">
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
            color="var(--ok)"
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
            color="var(--warn)"
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
            color="var(--err)"
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
    accent === 'positive' ? 'var(--ok-soft)'
    : accent === 'negative' ? 'var(--warn-soft)'
    : 'var(--field)';

  return (
    <div className="px-[7.5px] py-1.5 rounded-[10px]" style={{ backgroundColor: tileBg }}>
      <p className="cn-text-body1 block text-[var(--faint)] text-[10.5px] font-bold uppercase tracking-[.05em] mb-0.5">
        {label}
      </p>
      <p className="cn-text-body1 font-[family-name:var(--font-display)] text-[1.15rem] font-semibold leading-[1.2] tabular-nums text-[var(--ink)] tracking-[-0.01em]">
        {value}
      </p>
      {hint && (
        <p className="cn-text-body1 block text-[var(--muted)] text-[10.5px] mt-0.5">
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
      className="cn-text-body1 text-[10.5px] font-bold uppercase tracking-[.05em]"
      style={{ color }}
    >
      {label}
    </p>
  </div>
);

const TopPerformerCard: React.FC<{ performer: TopPerformer }> = ({ performer }) => {
  const occupancyPct = Math.round(performer.occupancy * 100);

  return (
    <div className="px-2 py-1.5 rounded-[10px] bg-[var(--ok-soft)]">
      <p className="cn-text-body1 text-[13.5px] font-semibold text-[var(--ink)] whitespace-nowrap overflow-hidden text-ellipsis">
        {performer.name}
      </p>
      {performer.city && (
        <p className="cn-text-body1 block text-[var(--muted)] text-[11.5px]">
          {performer.city}
        </p>
      )}
      <div className="flex items-baseline gap-1 mt-0.5">
        <p className="cn-text-body1 font-[family-name:var(--font-display)] text-[1rem] font-semibold tabular-nums text-[var(--ok)]">
          {formatCurrency(performer.revenue)}
        </p>
        <p className="cn-text-body1 text-[var(--faint)] text-[11.5px]">
          {performer.reservations} resa
        </p>
      </div>
      <div className="mt-1">
        <Progress
          value={occupancyPct}
          className="h-1 rounded-[2px] bg-[color-mix(in_srgb,var(--ok)_14%,transparent)] [&>[data-slot=progress-indicator]]:rounded-[2px] [&>[data-slot=progress-indicator]]:bg-[var(--ok)]"
        />
        <p className="cn-text-body1 block text-[10.5px] mt-0.5 text-[var(--muted)] tabular-nums">
          Occupation {occupancyPct}%
        </p>
      </div>
    </div>
  );
};

const UnderPerformerRow: React.FC<{ performer: UnderPerformer }> = ({ performer }) => {
  return (
    <div className="px-2 py-1.5 rounded-[10px] bg-[var(--warn-soft)] flex gap-1.5 items-start">
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5">
          <p className="cn-text-body1 text-[13.5px] font-semibold text-[var(--ink)]">
            {performer.name}
          </p>
          {performer.city && (
            <p className="cn-text-body1 text-[var(--muted)] text-[11.5px]">
              {performer.city}
            </p>
          )}
        </div>
        <p className="cn-text-body1 block text-[var(--warn)] text-[11.5px] font-semibold mt-0.5">
          {performer.reason}
        </p>
        <p className="cn-text-body1 block text-[var(--muted)] text-[11.5px] italic mt-0.5">
          → {performer.recommendation}
        </p>
      </div>
      <p className="cn-text-body1 font-[family-name:var(--font-display)] text-[0.85rem] font-semibold tabular-nums text-[var(--warn)] whitespace-nowrap">
        {Math.round(performer.occupancy * 100)}%
      </p>
    </div>
  );
};

const PatternRow: React.FC<{ pattern: Pattern }> = ({ pattern }) => {
  const [sevColor, sevSoft] = severityColors(pattern.severity);
  const Icon = patternIcon(pattern.type);

  return (
    <div className="px-[7.5px] py-1.5 rounded-[10px] flex gap-1.5 items-start" style={{ backgroundColor: sevSoft }}>
      <div className="inline-flex mt-[0.75px]" style={{ color: sevColor }}>
        <Icon size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 mb-0.5">
          <p className="cn-text-body1 text-[13.5px] font-semibold text-[var(--ink)]">
            {pattern.title}
          </p>
          <StatusChip size="sm" tokens={{ color: sevColor, bg: 'var(--card)' }} label={pattern.severity} className="text-[10.5px] tracking-[.04em] uppercase" />
        </div>
        <p className="cn-text-body1 block text-[var(--muted)] text-[11.5px]">
          {pattern.description}
        </p>
        {pattern.items && pattern.items.length > 0 && (
          <p className="cn-text-body1 block text-[var(--faint)] text-[11.5px] mt-0.5">
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
      return ['var(--err)', 'var(--err-soft)'];
    case 'MEDIUM':
      return ['var(--warn)', 'var(--warn-soft)'];
    case 'LOW':
    default:
      return ['var(--info)', 'var(--info-soft)'];
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
