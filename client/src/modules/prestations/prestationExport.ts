import { convertServiceRequest } from '../../hooks/useServiceRequestsList';
import type { ExportColumn } from '../../utils/exportUtils';
import { activeIntlLocale } from '../../utils/activeLocale';
import type { PrestationRow } from './prestationFilters';

export interface PrestationExportRecord {
  kind: string;
  id: number | string;
  title: string;
  status: string;
  priority: string;
  propertyName: string;
  assignedToName: string;
  date: string;
}

/** Une ligne plate par prestation, quel que soit son type. */
export function toPrestationExportRecord(row: PrestationRow): PrestationExportRecord {
  if (row.kind === 'intervention') {
    const item = row.item;
    return { kind: 'Intervention', id: item.id, title: item.title, status: item.status, priority: item.priority,
      propertyName: item.propertyName, assignedToName: item.assignedToName ?? '', date: item.scheduledDate ?? '' };
  }
  const request = convertServiceRequest(row.item);
  return { kind: 'Demande', id: request.id, title: request.title, status: request.status, priority: request.priority,
    propertyName: request.propertyName, assignedToName: request.assignedToName ?? '', date: request.dueDate };
}

const formatDate = (value: string) => value ? new Date(value).toLocaleDateString(activeIntlLocale()) : '';

export const prestationExportColumns: ExportColumn[] = [
  { key: 'kind', label: 'Type' },
  { key: 'id', label: 'ID' },
  { key: 'title', label: 'Titre' },
  { key: 'status', label: 'Statut' },
  { key: 'priority', label: 'Priorité' },
  { key: 'propertyName', label: 'Logement' },
  { key: 'assignedToName', label: 'Intervenant' },
  { key: 'date', label: 'Date', formatter: formatDate },
];
