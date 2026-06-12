import React from 'react';
import {
  Box, Paper, Typography, Chip, Tooltip, IconButton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination,
} from '@mui/material';
import type { NavigateFunction } from 'react-router-dom';
import { Visibility, Edit, Sanitizer, Power, Delete } from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import ChannexHealthBadge from '../settings/components/ChannexHealthBadge';
import ThemedTooltip from '../../components/ThemedTooltip';
import { PropertyImageCarousel } from '../../components/PropertyImageCarousel';
import MissingContractChip from './MissingContractChip';
import { estimateCleaningPrice, estimateCleaningDuration, formatDuration } from './PropertyCard';
import { toPropertyDetails } from './propertyDetailsMapper';
import { LIST_PAPER_SX, LIST_ROWS_PER_PAGE_OPTIONS, softDataChipSx, FIELD_CHIP_SX } from './propertiesListConstants';
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

interface PropertiesTableViewProps {
  properties: PropertyListItem[];
  totalCount: number;
  page: number;
  rowsPerPage: number;
  onPageChange: (page: number) => void;
  onRowsPerPageChange: (rows: number) => void;
  channexMappings: Map<number, ChannexMappingDto>;
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
  channexMappings, canManageContracts, missingContractIds, onMissingContractClick,
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
                '& th': {
                  fontWeight: 700,
                  fontSize: '10.5px',
                  letterSpacing: '.05em',
                  textTransform: 'uppercase',
                  color: 'var(--faint)',
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
              const price = estimateCleaningPrice(details);
              const duration = estimateCleaningDuration(details);
              return (
                <TableRow
                  key={property.id}
                  hover
                  sx={{
                    cursor: 'pointer',
                    '& td': { borderBottom: '1px solid var(--line)', fontSize: '12.5px' },
                    '&:hover': { bgcolor: 'var(--hover)' },
                    '&:last-child td': { borderBottom: 0 },
                  }}
                  onClick={() => navigate(`/properties/${property.id}`)}
                >
                  <TableCell sx={{ p: 0, pr: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
                      <PropertyImageCarousel photoUrls={property.photoUrls} alt={property.name} />
                      <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 0, pl: 1.25, gap: 0.75 }}>
                        <Typography
                          variant="body2"
                          fontWeight={600}
                          sx={{
                            fontSize: '0.82rem',
                            minWidth: 0,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {property.name}
                        </Typography>
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
                      </Box>
                    </Box>
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
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        fontSize: '0.78rem',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {property.bedrooms} ch. · {property.bathrooms} sdb · {property.squareMeters ?? 0} m² · {property.guests} voy.
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {property.amenities && property.amenities.length > 0 ? (
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'nowrap', alignItems: 'center', minWidth: 0 }}>
                        {property.amenities.slice(0, 2).map((amenity, i) => (
                          <Chip
                            key={i}
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
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                {property.amenities.map((a, i) => (
                                  <Chip
                                    key={i}
                                    label={t(`properties.amenities.items.${a}`)}
                                    size="small"
                                    sx={{ ...FIELD_CHIP_SX, height: 20, '& .MuiChip-label': { px: 1 } }}
                                  />
                                ))}
                              </Box>
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
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary">—</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      {(() => { const freq = property.cleaningFrequency || 'ON_DEMAND'; return (
                        <Tooltip title={`Ménage auto : ${getCleaningFrequencyLabel(freq, t)}`}>
                          <Box component="span" sx={{ display: 'inline-flex', color: getCleaningFrequencyHex(freq), flexShrink: 0 }}>
                            <Sanitizer size={16} strokeWidth={1.75} />
                          </Box>
                        </Tooltip>
                      ); })()}
                      {price != null ? (
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" sx={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '13px', lineHeight: 1.2, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
                            {price}€
                          </Typography>
                          {duration != null && (
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
                              ~{formatDuration(duration)}
                            </Typography>
                          )}
                        </Box>
                      ) : (
                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.82rem' }}>—</Typography>
                      )}
                    </Box>
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
      <TablePagination
        component="div"
        count={totalCount}
        page={page}
        onPageChange={(_, p) => onPageChange(p)}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={(e) => onRowsPerPageChange(parseInt(e.target.value, 10))}
        rowsPerPageOptions={LIST_ROWS_PER_PAGE_OPTIONS}
        labelRowsPerPage="Lignes par page"
        labelDisplayedRows={({ from, to, count }) => `${from}-${to} sur ${count}`}
        sx={{ flexShrink: 0, borderTop: '1px solid var(--line)', '& .MuiTablePagination-displayedRows': { fontVariantNumeric: 'tabular-nums' } }}
      />
    </Paper>
  );
};

export default PropertiesTableView;
