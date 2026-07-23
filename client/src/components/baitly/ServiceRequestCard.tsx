import * as React from 'react';
import { CalendarClockIcon, MapPinIcon, MoreVerticalIcon, TimerIcon, UserIcon } from 'lucide-react';
import { Button, Card } from '../ui';
import StatusChip from './StatusChip';
import GuestAvatar from './GuestAvatar';
import { Money } from './Money';
import { cn } from '../../utils/cn';

/**
 * Baitly — remaster de components/ServiceRequestCard.tsx (MUI, 421 lignes).
 * Carte d'intervention : type, titre, logement, échéance, coût, assigné,
 * statut/priorité en chips teintés par les couleurs fournies.
 * Même contrat structurel que l'original (typage local des champs utilisés).
 */
export interface ServiceRequestCardData {
  id: number | string;
  title: string;
  type: string;
  status: string;
  priority: string;
  propertyName?: string;
  propertyAddress?: string;
  propertyCity?: string;
  dueDate?: string;
  estimatedCost?: number | null;
  estimatedDuration?: number | null;
  assignedToName?: string | null;
  requestorName?: string | null;
}

export interface ServiceRequestCardProps {
  request: ServiceRequestCardData;
  onMenuOpen?: (event: React.MouseEvent<HTMLElement>, request: ServiceRequestCardData) => void;
  typeIcons: Record<string, React.ReactElement>;
  statuses: Array<{ value: string; label: string }>;
  priorities: Array<{ value: string; label: string }>;
  statusColors: Record<string, string>;
  priorityColors: Record<string, string>;
  className?: string;
}

const labelOf = (options: Array<{ value: string; label: string }>, value: string) =>
  options.find((o) => o.value === value)?.label ?? value;

export default function ServiceRequestCard({
  request,
  onMenuOpen,
  typeIcons,
  statuses,
  priorities,
  statusColors,
  priorityColors,
  className,
}: ServiceRequestCardProps) {
  return (
    <Card className={cn('gap-3 py-4', className)}>
      <div className="flex items-start justify-between gap-2 px-4">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary [&>svg]:size-4">
            {typeIcons[request.type] ?? <TimerIcon />}
          </span>
          <div className="min-w-0">
            <h3 className="m-0 truncate text-sm font-semibold text-foreground">{request.title}</h3>
            {request.propertyName && (
              <p className="m-0 mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                <MapPinIcon className="size-3 shrink-0" />
                <span className="truncate">
                  {request.propertyName}
                  {request.propertyCity ? ` · ${request.propertyCity}` : ''}
                </span>
              </p>
            )}
          </div>
        </div>
        {onMenuOpen && (
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label="Actions"
            onClick={(event) => onMenuOpen(event, request)}
          >
            <MoreVerticalIcon />
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 px-4">
        <StatusChip
          color={statusColors[request.status]}
          label={labelOf(statuses, request.status)}
          dot
          size="sm"
        />
        <StatusChip
          color={priorityColors[request.priority]}
          label={labelOf(priorities, request.priority)}
          size="sm"
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border px-4 pt-3 text-xs text-muted-foreground">
        {request.dueDate && (
          <span className="flex items-center gap-1">
            <CalendarClockIcon className="size-3.5" />
            {request.dueDate}
          </span>
        )}
        {request.estimatedDuration != null && (
          <span className="flex items-center gap-1 tabular-nums">
            <TimerIcon className="size-3.5" />
            {request.estimatedDuration} min
          </span>
        )}
        {request.estimatedCost != null && (
          <span className="font-semibold text-foreground tabular-nums">
            <Money value={request.estimatedCost} decimals={0} />
          </span>
        )}
        {request.assignedToName ? (
          <span className="ms-auto flex items-center gap-1.5">
            <GuestAvatar name={request.assignedToName} size={20} />
            {request.assignedToName}
          </span>
        ) : (
          <span className="ms-auto flex items-center gap-1 text-faint">
            <UserIcon className="size-3.5" /> Non assignée
          </span>
        )}
      </div>
    </Card>
  );
}
