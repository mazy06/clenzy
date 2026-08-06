import React from 'react';
import StatusChip from '../../../components/StatusChip';

import {
  TrendingUp as TrendIcon,
  Warning as WarningIcon,
  Lightbulb as RecommendationIcon,
  ReportProblem as AnomalyIcon,
} from '../../../icons';

interface InsightItem {
  /** Type : ANOMALY | TREND | RECOMMENDATION | WARNING */
  type: string;
  /** Severity : LOW | MEDIUM | HIGH | CRITICAL */
  severity: string;
  title: string;
  description: string;
  recommendation?: string;
}

interface InsightsData {
  items?: InsightItem[];
  count?: number;
  propertyId?: number;
  from?: string;
  to?: string;
  title?: string;
}

interface InsightsWidgetProps {
  data: InsightsData;
}

/**
 * Widget de rendu pour {@code displayHint="insights"} — liste d'insights AI
 * strategiques retournes par {@code get_business_insights}.
 *
 * <p>Chaque insight est rendu comme une carte avec :
 * <ul>
 *   <li>Icone selon type (anomalie, tendance, recommandation, warning)</li>
 *   <li>Couleur selon severity (LOW = info, CRITICAL = error)</li>
 *   <li>Titre + description</li>
 *   <li>Recommandation actionnable en bloc separe (si fournie)</li>
 * </ul>
 *
 * <p>Design borderless avec bg tonal — aligne avec la directive design du chat.</p>
 */
export const InsightsWidget: React.FC<InsightsWidgetProps> = ({ data }) => {
  const items = data.items ?? [];

  if (items.length === 0) {
    return (
      <div className="mt-1.5 mb-2">
        <div className="p-4 rounded-xl bg-success-soft text-center">
          <p className="text-xs font-semibold text-success-ink">
            Aucun insight detecte — tout va bien sur cette propriete.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-1.5 mb-2 flex flex-col gap-1.5">
      {data.title && (
        <p className="block mb-0.5 text-2xs font-bold uppercase tracking-[.05em] text-faint">
          {data.title}
        </p>
      )}

      {items.map((item, idx) => (
        <InsightCard key={`insight-${idx}`} item={item} />
      ))}
    </div>
  );
};

// ─── InsightCard ──────────────────────────────────────────────────────────

const InsightCard: React.FC<{ item: InsightItem }> = ({ item }) => {
  const [sevColor, sevSoft] = severityColors(item.severity);
  const TypeIcon = typeIcon(item.type);

  return (
    <div className="p-2 rounded-xl border border-border bg-card">
      <div className="flex gap-1.5 items-start mb-1">
        <div className="w-[28px] h-[28px] rounded-lg flex items-center justify-center shrink-0 mt-[0.75px]" style={{ backgroundColor: sevSoft, color: sevColor }}>
          <TypeIcon size={16} strokeWidth={2} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 mb-0.5 flex-wrap">
            <p className="text-[13.5px] font-semibold text-foreground leading-[1.3]">
              {item.title}
            </p>
            <StatusChip size="sm" tokens={{ color: sevColor, bg: sevSoft }} label={humanizeSeverity(item.severity)} className="text-2xs tracking-[.04em] uppercase" />
          </div>
          <p className="text-xs leading-[1.5] text-muted-foreground">
            {item.description}
          </p>
        </div>
      </div>

      {/* Recommandation actionnable */}
      {item.recommendation && (
        <div className="ms-7 mt-1 px-2 py-1 rounded-lg bg-muted">
          <p className="block text-2xs font-bold uppercase tracking-[.05em] text-faint mb-0.5">
            Action recommandee
          </p>
          <p className="text-xs leading-[1.45] text-foreground">
            {item.recommendation}
          </p>
        </div>
      )}
    </div>
  );
};

// ─── Helpers ────────────────────────────────────────────────────────────────

type LucideIconComponent = React.ComponentType<{
  size?: number | string;
  strokeWidth?: number | string;
}>;

function typeIcon(type: string): LucideIconComponent {
  switch (type?.toUpperCase()) {
    case 'ANOMALY': return AnomalyIcon;
    case 'TREND': return TrendIcon;
    case 'RECOMMENDATION': return RecommendationIcon;
    case 'WARNING': return WarningIcon;
    default: return RecommendationIcon;
  }
}

function severityColors(severity: string): [string, string] {
  switch (severity?.toUpperCase()) {
    case 'CRITICAL': return ['var(--color-destructive-ink)', 'var(--color-destructive-soft)'];
    case 'HIGH': return ['var(--color-destructive-ink)', 'var(--color-destructive-soft)'];
    case 'MEDIUM': return ['var(--color-warning-ink)', 'var(--color-warning-soft)'];
    case 'LOW':
    default:
      return ['var(--color-info-ink)', 'var(--color-info-soft)'];
  }
}

function humanizeSeverity(severity: string): string {
  switch (severity?.toUpperCase()) {
    case 'CRITICAL': return 'Critique';
    case 'HIGH': return 'Eleve';
    case 'MEDIUM': return 'Moyen';
    case 'LOW': return 'Faible';
    default: return severity || 'Info';
  }
}
