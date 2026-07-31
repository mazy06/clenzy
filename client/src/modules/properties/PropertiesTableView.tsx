import React from 'react';
import {
  Box, Paper, Typography, Chip, Tooltip, IconButton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, } from '@mui/material';
import type { NavigateFunction } from 'react-router-dom';
import { Visibility, Edit, BroomFill, Power, Delete, Business } from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import ChannexHealthBadge from '../settings/components/ChannexHealthBadge';
import ThemedTooltip from '../../components/ThemedTooltip';
import { Money } from '../../components/Money';
import MissingContractChip from './MissingContractChip';
import { estimateCleaningDuration, formatDuration } from './PropertyCard';
import { toPropertyDetails } from './propertyDetailsMapper';
import { LIST_PAPER_SX, LIST_ROWS_PER_PAGE_OPTIONS, softDataChipSx, FIELD_CHIP_SX, propertyGradientCss } from './propertiesListConstants';
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
      <TableContainer sx={{ flex: 1, overflow: 'hidden' }}>
        <Table size="small" sx={{ tableLayout: 'fixed', width: '100%' }}>
          <TableHead>
            <TableRow
              sx={{
                // .pr-lhead — entête overline sur surface sur-élevée (h42)
                '& th': {
                  fontWeight: 700,
                  fontSize: '10.5px',
                  letterSpacing: '.05em',
                  textTransform: 'uppercase',
                  color: 'var(--faint)',
                  bgcolor: 'var(--surface-2)',
                  height: 42,
                  py: 0,
                  borderBottom: '1px solid var(--line)',
                  whiteSpace: 'nowrap',
                },
              }}
            >
              <TableCell sx={{ width: '28%' }}>Nom</TableCell>
              <TableCell sx={{ width: '11%' }}>Type</TableCell>
              <TableCell sx={{ width: '20%' }}>Caractéristiques</TableCell>
              <TableCell sx={{ width: '18%' }}>Commodités</TableCell>
              <TableCell sx={{ width: '13%' }}>Ménage</TableCell>
              <TableCell align="center" sx={{ width: '10%' }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {properties.map((property) => {
              const details = toPropertyDetails(property);
              const price = cleaningEstimates[Number(property.id)];
              const duration = estimateCleaningDuration(details);
              return (
                <TableRow
                  key={property.id}
                  hover
                  sx={{
                    cursor: 'pointer',
                    '& td': { borderBottom: '1px solid var(--line)', fontSize: '12.5px' },
                    // .pr-lrow:hover → fond accent doux (transition douce, pas de scale)
                    transition: 'background-color .12s',
                    '&:hover': { bgcolor: 'var(--accent-soft)' },
                    '&:last-child td': { borderBottom: 0 },
                    '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
                  }}
                  onClick={() => navigate(`/properties/${property.id}`)}
                >
                  <TableCell sx={{ py: 1, pr: 1 }}>
                    <div className="flex items-center min-w-0 gap-2">
                      {/* .pr-lthumb — vignette dégradé déterministe + icône immeuble (photo en overlay si dispo) */}
                      <Box
                        sx={{
                          width: 44,
                          height: 44,
                          borderRadius: '11px',
                          flexShrink: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'rgba(255,255,255,.8)',
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
                      </Box>
                      <div className="min-w-0">
                        <div className="flex items-center min-w-0 gap-1">
                          <p className="cn-text-body2 font-[var(--font-display)] font-semibold text-[14px] text-[var(--ink)] tracking-[-.01em] min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
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
                        <Typography
                          sx={{
                            fontSize: '11.5px',
                            color: 'var(--muted)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            mt: '1px',
                          }}
                        >
                          {property.city}
                        </Typography>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {(() => { const c = getPropertyTypeHex(property.type); return (
                    <Chip
                      label={getPropertyTypeLabel(property.type, t)}
                      size="small"
                      sx={{ ...softDataChipSx(c), '& .MuiChip-label': { px: 1 } }}
                    />
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
                          <Chip
                            key={amenity}
                            label={t(`properties.amenities.items.${amenity}`)}
                            size="small"
                            sx={{
                              ...FIELD_CHIP_SX,
                              minWidth: 0,
                              flexShrink: 1,
                              '& .MuiChip-label': {
                                px: 1,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                display: 'block',
                              },
                            }}
                          />
                        ))}
                        {property.amenities.length > 2 && (
                          <ThemedTooltip
                            title={
                              <div className="flex flex-wrap gap-0.5">
                                {property.amenities.map((a) => (
                                  <Chip
                                    key={a}
                                    label={t(`properties.amenities.items.${a}`)}
                                    size="small"
                                    sx={{ ...FIELD_CHIP_SX, height: 20, '& .MuiChip-label': { px: 1 } }}
                                  />
                                ))}
                              </div>
                            }
                            arrow
                            placement="top"
                          >
                            <Chip
                              label={`+${property.amenities.length - 2}`}
                              size="small"
                              sx={{ color: 'var(--muted)', bgcolor: 'var(--hover)', border: 'none', flexShrink: 0, '& .MuiChip-label': { px: 1 }, cursor: 'default' }}
                            />
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
                          <Box component="span" sx={{ display: 'inline-flex', color: getCleaningFrequencyHex(freq), flexShrink: 0 }}>
                            <BroomFill size={16} />
                          </Box>
                        </Tooltip>
                      ); })()}
                      {price != null ? (
                        <div className="min-w-0">
                          <p className="cn-text-body2 font-[var(--font-display)] font-semibold text-[13px] leading-[1.2] text-[var(--ink)] tabular-nums">
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
                  <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
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
      </TableContainer>
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
