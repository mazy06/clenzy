/** Geometry is independent of the amount of data and never persisted as a preference. */
export function dashboardWidgetMinWidth(id: string): number {
  switch (id) {
    case 'kpis':
    case 'operational-kpis': return 640;
    case 'upcoming-arrivals': return 800;
    case 'revenue-split': return 520;
    case 'today-operations':
    case 'action-items': return 400;
    case 'revenue-by-channel':
    case 'occupancy-by-property': return 320;
    default: return 384;
  }
}

/** Only compact summaries keep their natural height, when they occupy a whole row. */
export function dashboardRowHeight(ids: string[]): string {
  return ids.every((id) => ['kpis', 'operational-kpis', 'field-compliance'].includes(id))
    ? 'auto'
    : '28rem';
}
