import * as React from 'react';
import type { DashboardRow, DropSide } from '../../hooks/useDashboardLayout';
import { DashboardWidgetState } from './DashboardWidgetState';
import { useTranslation } from '../../hooks/useTranslation';
import { dashboardRowHeight, dashboardWidgetMinWidth } from './dashboardWidgetSizing';
import './dashboardLayout.css';

const DashboardWidgetEditor = React.lazy(() => import('./DashboardWidgetEditor'));

export interface DashboardWidgetEntry {
  /** Identifiant stable, persisté dans les préférences. Ne jamais le renommer. */
  id: string;
  /** Nom lisible — libellés d'accessibilité et mode édition. */
  label: string;
  node: React.ReactNode;
}

export interface DashboardWidgetGridProps {
  widgets: DashboardWidgetEntry[];
  rows: DashboardRow[];
  editing: boolean;
  /** Sur petit écran, les poignées sont remplacées par une composition adaptée. */
  stacked: boolean;
  onMoveNextTo: (draggedId: string, targetId: string, side?: DropSide) => void;
  onMoveToOwnRow: (draggedId: string, rowIndex: number) => void;
  onShiftWithinRow: (id: string, delta: -1 | 1) => void;
  onRowSizes: (rowIndex: number, sizes: number[]) => void;
  /** Retire la tuile de l'écran. Le sélecteur sait la remettre. */
  onRemove: (id: string) => void;
}

/** CSS owns read-mode geometry; the drag/resize bundle is loaded only when requested. */
export default function DashboardWidgetGrid(props: DashboardWidgetGridProps) {
  const { t } = useTranslation();
  if (props.editing) return <React.Suspense fallback={<DashboardWidgetState title={t('dashboard.layout.customize', 'Personnaliser')} />}>
    <DashboardWidgetEditor {...props} />
  </React.Suspense>;
  const byId = new Map(props.widgets.map((widget) => [widget.id, widget]));
  return <div className="db-layout">
    {props.rows.map((row) => {
      const entries = row.ids.flatMap((id, index) => byId.has(id) ? [{ widget: byId.get(id)!, size: row.sizes?.[index] ?? 1 }] : []);
      if (!entries.length) return null;
      return <div key={row.ids.join('|')} className="db-layout-row" data-count={entries.length}
        style={{ '--db-row-height': dashboardRowHeight(entries.map(({ widget }) => widget.id)) } as React.CSSProperties}>
        {entries.map(({ widget, size }) => <div key={widget.id} className="db-widget" data-widget-id={widget.id}
          style={{ '--db-min-width': `${dashboardWidgetMinWidth(widget.id)}px`, '--db-weight': size } as React.CSSProperties}>
          <div className="db-widget-content" role="region" aria-label={widget.label} tabIndex={0}>{widget.node}</div>
        </div>)}
      </div>;
    })}
  </div>;
}
