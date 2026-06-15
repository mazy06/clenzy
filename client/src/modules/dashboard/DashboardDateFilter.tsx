import React from 'react';
import PeriodSegmented from '../../components/PeriodSegmented';

// ─── Types ──────────────────────────────────────────────────────────────────

export type DashboardPeriod = 'week' | 'month' | 'quarter' | 'year';

export interface DateFilterOption<T extends string = string> {
  value: T;
  label: string;
}

interface DashboardDateFilterProps<T extends string = string> {
  value: T;
  onChange: (value: T) => void;
  options: DateFilterOption<T>[];
}

// ─── Component ──────────────────────────────────────────────────────────────
//
// Sélecteur de période = options mutuellement exclusives (view-switcher) →
// délègue au segmented partagé (résolution §7 « chips vs segmented »). API
// inchangée pour les consommateurs (Dashboard, DashboardOverview, etc.).

function DashboardDateFilterInner<T extends string>({
  value,
  onChange,
  options,
}: DashboardDateFilterProps<T>) {
  return (
    <PeriodSegmented<T>
      value={value}
      onChange={onChange}
      options={options}
      ariaLabel="Période"
    />
  );
}

const DashboardDateFilter = React.memo(DashboardDateFilterInner) as typeof DashboardDateFilterInner;

export default DashboardDateFilter;
