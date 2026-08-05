import React from 'react';
import StatusChip from '../../components/StatusChip';
import {
  Button,
  Progress,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../components/ui';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui';
import type { NavigateFunction } from 'react-router-dom';
import { Visibility as VisibilityIcon, MoreVert } from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import type { Intervention } from './useInterventionsList';
import {
  getInterventionStatusLabel,
  getInterventionPriorityLabel,
  getInterventionTypeLabel,
} from '../../utils/statusUtils';
import { getStatusTokens, getPriorityTokens, getTypeTokens } from './interventionUtils';
import { stripPropertySuffix, formatDateShort, getProgress } from './interventionsListConstants';
import PagePagination from '../../components/PagePagination';

interface InterventionsTableViewProps {
  interventions: Intervention[];
  totalCount: number;
  page: number;
  rowsPerPage: number;
  onPageChange: (page: number) => void;
  onMenuOpen: (event: React.MouseEvent<HTMLElement>, intervention: Intervention) => void;
  containerRef: React.Ref<HTMLDivElement>;
  navigate: NavigateFunction;
}

/** Vue liste : tableau dense des interventions + pagination. */
const InterventionsTableView: React.FC<InterventionsTableViewProps> = ({
  interventions, totalCount, page, rowsPerPage, onPageChange, onMenuOpen, containerRef, navigate,
}) => {
  const { t } = useTranslation();

  return (
    <div
      ref={containerRef}
      className="flex flex-1 min-h-0 flex-col overflow-hidden rounded-xl border border-solid border-border bg-card shadow-none"
    >
      <div className="flex-1 overflow-hidden">
        <Table>
          <TableHeader>
            {/* Le gabarit du kit porte deja poids/taille/casse/filet : seuls
                l'interlettrage 0.06em et le nowrap etaient un ajout du sx. */}
            <TableRow className="[&>th]:tracking-[0.06em] [&>th]:whitespace-nowrap">
              <TableHead>Titre</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Propriété</TableHead>
              <TableHead>Assigné à</TableHead>
              <TableHead className="text-center">Statut</TableHead>
              <TableHead className="text-center">Priorité</TableHead>
              <TableHead className="text-center">Progression</TableHead>
              <TableHead>Planifié le</TableHead>
              <TableHead className="text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {interventions.map((intervention) => {
              if (!intervention?.id) return null;
              return (
                <TableRow
                  key={intervention.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/interventions/${intervention.id}`)}
                >
                  <TableCell>
                    <p className="text-[13px] font-semibold text-foreground">
                      {stripPropertySuffix(intervention.title, intervention.propertyName)}
                    </p>
                    <span className="text-[11px] text-muted-foreground">
                      {intervention.requestorName}
                    </span>
                  </TableCell>
                  <TableCell>
                    {(() => { const tk = getTypeTokens(intervention.type); return (
                    <StatusChip tokens={{ color: tk.color, bg: tk.bg }} label={getInterventionTypeLabel(intervention.type, t)} className="text-[0.62rem]" />
                    ); })()}
                  </TableCell>
                  <TableCell>
                    <p className="text-[13px] text-foreground">
                      {intervention.propertyName}
                    </p>
                    <span className="text-[11px] text-muted-foreground">
                      {intervention.propertyAddress}
                    </span>
                  </TableCell>
                  <TableCell>
                    <p className="text-[13px] text-foreground">
                      {intervention.assignedToName || '—'}
                    </p>
                    {intervention.assignedToType && (
                      <span className="text-[11px] text-muted-foreground">
                        {intervention.assignedToType === 'team' ? 'Équipe' : 'Utilisateur'}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {(() => { const tk = getStatusTokens(intervention.status); return (
                      <StatusChip tokens={{ color: tk.color, bg: tk.bg }} label={getInterventionStatusLabel(intervention.status, t)} className="text-[0.75rem] h-[24px]" />
                    ); })()}
                  </TableCell>
                  <TableCell className="text-center">
                    {(() => { const tk = getPriorityTokens(intervention.priority); return (
                      <StatusChip tokens={{ color: tk.color, bg: tk.bg }} label={getInterventionPriorityLabel(intervention.priority, t)} className="text-[0.75rem] h-[24px]" />
                    ); })()}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center gap-1 min-w-[80px]">
                      {/* La teinte de la barre depend de l'avancement : elle passe
                          par une custom property, une classe Tailwind ne pouvant
                          pas naitre d'une valeur calculee. */}
                      <Progress
                        value={getProgress(intervention)}
                        style={{
                          '--progress-tint':
                            getProgress(intervention) === 100 ? 'var(--bui-success)'
                              : getProgress(intervention) >= 50 ? 'var(--bui-info)' : 'var(--bui-warning)',
                        } as React.CSSProperties}
                        className="flex-1 h-1.5 rounded-full bg-muted [&>[data-slot=progress-indicator]]:rounded-full [&>[data-slot=progress-indicator]]:bg-[var(--progress-tint)]"
                      />
                      <span className="text-[11px] font-semibold text-foreground min-w-[28px] tabular-nums">
                        {getProgress(intervention)}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="text-[13px] text-foreground tabular-nums">
                      {formatDateShort(intervention.scheduledDate)}
                    </p>
                    {intervention.estimatedDurationHours > 0 && (
                      <span className="text-[11px] text-muted-foreground tabular-nums">
                        ~{intervention.estimatedDurationHours}h
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-center whitespace-nowrap">
                    {/* span intermediaire : TooltipTrigger asChild pose une ref DOM,
                        que le Button du kit (fonction, React 18) ne transmet pas. */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Détails"
                            onClick={(e) => { e.stopPropagation(); navigate(`/interventions/${intervention.id}`); }}
                          >
                            <VisibilityIcon size={18} strokeWidth={1.75} />
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>Détails</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Actions"
                            onClick={(e) => { e.stopPropagation(); onMenuOpen(e, intervention); }}
                          >
                            <MoreVert size={18} strokeWidth={1.75} />
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>Actions</TooltipContent>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <PagePagination
        count={totalCount}
        page={page}
        onPageChange={(p) => onPageChange(p)}
        rowsPerPage={rowsPerPage}
      />
    </div>
  );
};

export default InterventionsTableView;
