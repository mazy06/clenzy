import React from 'react';
import { cn } from '../../utils/cn';
import StatusChip from '../../components/StatusChip';
import { Paper, Tooltip, IconButton } from '@mui/material';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui';
import type { NavigateFunction } from 'react-router-dom';
import { Visibility, Edit, BroomFill, Power, Delete, Business } from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import ChannexHealthBadge from '../settings/components/ChannexHealthBadge';
import ThemedTooltip from '../../components/ThemedTooltip';
import { Money } from '../../components/Money';
import MissingContractChip from './MissingContractChip';
import { estimateCleaningDuration, formatDuration } from './PropertyCard';
import { toPropertyDetails } from './propertyDetailsMapper';
import { LIST_PAPER_SX, LIST_ROWS_PER_PAGE_OPTIONS, FIELD_TOKENS, FIELD_CHIP_CLASS, propertyGradientCss } from './propertiesListConstants';
import type { PropertyListItem } from '../../hooks/usePropertiesList';
import type { ChannexMappingDto } from '../../services/api/channexApi';
import {
  getPropertyStatusLabel,
  getPropertyStatusHex,
  getPropertyTypeLabel,
  getPropertyTypeHex,
  getCleaningFrequencyLabel,
  getCleaningFrequencyHex,
} from '../../utils/statusUtils';
import PagePagination from '../../components/PagePagination';

interface PropertiesTableViewProps {
  properties: PropertyListItem[];
  totalCount: number;
  page: number;
  rowsPerPage: number;
  onPageChange: (page: number) => void;
  onRowsPerPageChange: (rows: number) => void;
  channexMappings: Map<number, ChannexMappingDto>;
  /** Coûts de ménage estimés (vrai estimateur backend), clé = propertyId. */
  cleaningEstimates: Record<number, number>;
  canManageContracts: boolean;
  missingContractIds: Set<number>;
  /** Clic sur le badge « Contrat manquant » : ouvre la modal de contrat préselectionnée. */
  onMissingContractClick: (propertyId: number) => void;
  onToggleStatus: (property: PropertyListItem) => void;
  onDelete: (property: PropertyListItem) => void;
  navigate: NavigateFunction;
}

/** Vue liste : tableau dense des propriétés + pagination. */
const PropertiesTableView: React.FC<PropertiesTableViewProps> = ({
  properties, totalCount, page, rowsPerPage, onPageChange, onRowsPerPageChange,
  channexMappings, cleaningEstimates, canManageContracts, missingContractIds, onMissingContractClick,
  onToggleStatus, onDelete, navigate,
}) => {
  const { t } = useTranslation();

  return (
    <Paper
      sx={{
        ...LIST_PAPER_SX,
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div className="flex-1 overflow-hidden">
        <Table className="table-fixed w-full">
          <TableHeader>
            {/* .pr-lhead — entête overline sur surface sur-élevée (h42) ; seuls le
                fond, la hauteur et le py:0 s'ecartent du primitif. */}
            <TableRow className="bg-[var(--surface-2)] h-[42px]">
              <TableHead className="w-[28%] py-0">Nom</TableHead>
              <TableHead className="w-[11%] py-0">Type</TableHead>
              <TableHead className="w-[20%] py-0">Caractéristiques</TableHead>
              <TableHead className="w-[18%] py-0">Commodités</TableHead>
              <TableHead className="w-[13%] py-0">Ménage</TableHead>
              <TableHead className="w-[10%] py-0 text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {properties.map((property) => {
              const details = toPropertyDetails(property);
              const price = cleaningEstimates[Number(property.id)];
              const duration = estimateCleaningDuration(details);
              // .pr-lrow:hover → fond accent doux, plus soutenu que le --hover du primitif
              return (
                <TableRow
                  key={property.id}
                  className="cursor-pointer hover:bg-[var(--accent-soft)] motion-reduce:transition-none"
                  onClick={() => navigate(`/properties/${property.id}`)}
                >
                  <TableCell className="py-1.5 pe-1.5">
                    <div className="flex items-center min-w-0 gap-2">
                      {/* .pr-lthumb — vignette dégradé déterministe + icône immeuble (photo en overlay si dispo) */}
                      <div
                        className="w-11 h-11 rounded-[11px] shrink-0 flex items-center justify-center text-[rgba(255,255,255,.8)]"
                        style={{
                          background: propertyGradientCss(property.id || property.name),
                          ...(property.photoUrls && property.photoUrls.length > 0
                            ? {
                                backgroundImage: `linear-gradient(rgba(0,0,0,0.10), rgba(0,0,0,0.30)), url(${property.photoUrls[0]}), ${propertyGradientCss(property.id || property.name)}`,
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                              }
                            : {}),
                        }}
                      >
                        <Business size={20} strokeWidth={1.75} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center min-w-0 gap-1">
                          <p className="cn-text-body2 font-[family-name:var(--font-display)] font-semibold text-[14px] text-[var(--ink)] tracking-[-.01em] min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
                            {property.name}
                          </p>
                          {/* Quick Win #4 : badge sante Channex (visible si mapping present) */}
                          {channexMappings.get(Number(property.id)) && (
                            <ChannexHealthBadge
                              mapping={channexMappings.get(Number(property.id)) ?? null}
                              size={9}
                              variant="dot"
                              onClick={() => navigate('/settings?tab=integrations')}
                            />
                          )}
                          {canManageContracts && missingContractIds.has(Number(property.id)) && (
                            <MissingContractChip
                              onClick={(e) => { e.stopPropagation(); onMissingContractClick(Number(property.id)); }}
                            />
                          )}
                        </div>
                        {/* .pr-lci — localisation (ville) sous le nom */}
                        <p className="cn-text-body1 text-[11.5px] text-[var(--muted)] overflow-hidden text-ellipsis whitespace-nowrap mt-[1px]">
                          {property.city}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {(() => { const c = getPropertyTypeHex(property.type); return (
                    <StatusChip color={c} label={getPropertyTypeLabel(property.type, t)} />
                    ); })()}
                  </TableCell>
                  <TableCell>
                    <p className="cn-text-body2 text-muted-foreground text-[0.78rem] overflow-hidden text-ellipsis whitespace-nowrap">
                      {property.bedrooms} ch. · {property.bathrooms} sdb · {property.squareMeters ?? 0} m² · {property.guests} voy.
                    </p>
                  </TableCell>
                  <TableCell>
                    {property.amenities && property.amenities.length > 0 ? (
                      <div className="flex gap-0.5 flex-nowrap items-center min-w-0">
                        {property.amenities.slice(0, 2).map((amenity) => (
                          <StatusChip
                            key={amenity}
                            tokens={FIELD_TOKENS}
                            label={t(`properties.amenities.items.${amenity}`)}
                            className={cn(FIELD_CHIP_CLASS, 'min-w-0 shrink truncate')}
                          />
                        ))}
                        {property.amenities.length > 2 && (
                          <ThemedTooltip
                            title={
                              <div className="flex flex-wrap gap-0.5">
                                {property.amenities.map((a) => (
                                  <StatusChip
                                    key={a}
                                    tokens={FIELD_TOKENS}
                                    label={t(`properties.amenities.items.${a}`)}
                                    className={cn(FIELD_CHIP_CLASS, 'h-[20px]')}
                                  />
                                ))}
                              </div>
                            }
                            arrow
                            placement="top"
                          >
                            <StatusChip tone="neutral" label={`+${property.amenities.length - 2}`} className="shrink-0 cursor-default tabular-nums" />
                          </ThemedTooltip>
                        )}
                      </div>
                    ) : (
                      <p className="cn-text-body2 text-muted-foreground">—</p>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {(() => { const freq = property.cleaningFrequency || 'ON_DEMAND'; return (
                        <Tooltip title={`Ménage auto : ${getCleaningFrequencyLabel(freq, t)}`}>
                          <span className="inline-flex shrink-0" style={{ color: getCleaningFrequencyHex(freq) }}>
                            <BroomFill size={16} />
                          </span>
                        </Tooltip>
                      ); })()}
                      {price != null ? (
                        <div className="min-w-0">
                          <p className="cn-text-body2 font-[family-name:var(--font-display)] font-semibold text-[13px] leading-[1.2] text-[var(--ink)] tabular-nums">
                            <Money value={price} from="EUR" decimals={0} />
                          </p>
                          {duration != null && (
                            <span className="cn-text-caption text-muted-foreground text-[0.68rem]">
                              ~{formatDuration(duration)}
                            </span>
                          )}
                        </div>
                      ) : (
                        <p className="cn-text-body2 text-muted-foreground text-[0.82rem]">—</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    {(() => { const sc = getPropertyStatusHex(property.status); return (
                      <Tooltip title={`${getPropertyStatusLabel(property.status, t)} — cliquer pour ${property.status === 'active' ? 'désactiver' : 'activer'}`}>
                        <IconButton
                          size="small"
                          onClick={(e) => { e.stopPropagation(); onToggleStatus(property); }}
                          sx={{ color: sc, mr: 0.25 }}
                        >
                          <Power size={16} strokeWidth={2} />
                        </IconButton>
                      </Tooltip>
                    ); })()}
                    <Tooltip title="Détails">
                      <IconButton
                        size="small"
                        onClick={(e) => { e.stopPropagation(); navigate(`/properties/${property.id}`); }}
                      >
                        <Visibility size={18} strokeWidth={1.75} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Modifier">
                      <IconButton
                        size="small"
                        onClick={(e) => { e.stopPropagation(); navigate(`/properties/${property.id}/edit`); }}
                      >
                        <Edit size={18} strokeWidth={1.75} />
                      </IconButton>
                    </Tooltip>
                    {canManageContracts ? (
                      <Tooltip title="Supprimer">
                        <IconButton
                          size="small"
                          onClick={(e) => { e.stopPropagation(); onDelete(property); }}
                          sx={{ color: 'error.main' }}
                        >
                          <Delete size={18} strokeWidth={1.75} />
                        </IconButton>
                      </Tooltip>
                    ) : null}
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
        rowsPerPageOptions={LIST_ROWS_PER_PAGE_OPTIONS}
        onRowsPerPageChange={(rows) => onRowsPerPageChange(rows)}
      />
    </Paper>
  );
};

export default PropertiesTableView;
