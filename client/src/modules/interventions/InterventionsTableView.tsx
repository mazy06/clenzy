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
      className="border border-solid border-[var(--line)] rounded-[14px] bg-[var(--card)] flex-1 min-h-0 flex flex-col overflow-hidden"
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
                    <p className="cn-text-body2 font-semibold text-[0.82rem]">
                      {stripPropertySuffix(intervention.title, intervention.propertyName)}
                    </p>
                    <span className="cn-text-caption text-muted-foreground text-[0.68rem]">
                      {intervention.requestorName}
                    </span>
                  </TableCell>
                  <TableCell>
                    {(() => { const tk = getTypeTokens(intervention.type); return (
                    <StatusChip tokens={{ color: tk.color, bg: tk.bg }} label={getInterventionTypeLabel(intervention.type, t)} className="text-[0.62rem]" />
                    ); })()}
                  </TableCell>
                  <TableCell>
                    <p className="cn-text-body2 text-[0.82rem]">
                      {intervention.propertyName}
                    </p>
                    <span className="cn-text-caption text-muted-foreground text-[0.68rem]">
                      {intervention.propertyAddress}
                    </span>
                  </TableCell>
                  <TableCell>
                    <p className="cn-text-body2 text-[0.82rem]">
                      {intervention.assignedToName || '—'}
                    </p>
                    {intervention.assignedToType && (
                      <span className="cn-text-caption text-muted-foreground text-[0.68rem]">
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
                            getProgress(intervention) === 100 ? 'var(--ok)'
                              : getProgress(intervention) >= 50 ? 'var(--info)' : 'var(--warn)',
                        } as React.CSSProperties}
                        className="flex-1 h-1.5 rounded-full bg-[var(--hover)] [&>[data-slot=progress-indicator]]:rounded-full [&>[data-slot=progress-indicator]]:bg-[var(--progress-tint)]"
                      />
                      <span className="cn-text-caption font-semibold text-[0.68rem] min-w-[28px] tabular-nums">
                        {getProgress(intervention)}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="cn-text-body2 text-[0.82rem]">
                      {formatDateShort(intervention.scheduledDate)}
                    </p>
                    {intervention.estimatedDurationHours > 0 && (
                      <span className="cn-text-caption text-muted-foreground text-[0.68rem]">
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
