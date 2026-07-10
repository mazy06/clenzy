import React, { useMemo } from 'react';
import { Box, TablePagination } from '@mui/material';
import type { NavigateFunction } from 'react-router-dom';
import PropertyCard from './PropertyCard';
import { toPropertyDetails } from './propertyDetailsMapper';
import { ITEMS_PER_PAGE, PAGINATION_SX } from './propertiesListConstants';
import type { PropertyListItem } from '../../hooks/usePropertiesList';
import type { ChannexMappingDto } from '../../services/api/channexApi';
import { usePropertyKpiSummaries } from '../../hooks/usePropertyKpiSummaries';

interface PropertiesGridViewProps {
  properties: PropertyListItem[];
  totalCount: number;
  page: number;
  onPageChange: (page: number) => void;
  channexMappings: Map<number, ChannexMappingDto>;
  /** Coûts de ménage estimés (vrai estimateur backend), clé = propertyId. */
  cleaningEstimates: Record<number, number>;
  onDelete: (property: PropertyListItem) => void;
  onDiagnose: (propertyId: number, propertyName: string) => void;
  canManageContracts: boolean;
  missingContractIds: Set<number>;
  /** Clic sur le badge « Contrat manquant » : ouvre la modal de contrat préselectionnée. */
  onMissingContractClick: (propertyId: number) => void;
  navigate: NavigateFunction;
}

/** Vue grille : cartes PropertyCard + pagination fixe. */
const PropertiesGridView: React.FC<PropertiesGridViewProps> = ({
  properties, totalCount, page, onPageChange, channexMappings, cleaningEstimates, onDelete, onDiagnose,
  canManageContracts, missingContractIds, onMissingContractClick, navigate,
}) => {
  // KPI opérationnels (occupation / ADR / revenu / statut / interventions) des
  // cartes visibles, en une seule requête batchée.
  const propertyIds = useMemo(() => properties.map((p) => Number(p.id)), [properties]);
  const kpiMap = usePropertyKpiSummaries(propertyIds);

  return (
  <>
    {/* .pr-grid — grille 4 colonnes (2 colonnes < 1100px), gap 16 */}
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '16px',
        '@media (max-width: 1100px)': { gridTemplateColumns: 'repeat(2, 1fr)' },
        '@media (max-width: 560px)': { gridTemplateColumns: '1fr' },
      }}
    >
      {properties.map((property) => (
        <PropertyCard
          key={property.id}
          property={toPropertyDetails(property)}
          kpi={kpiMap.get(Number(property.id))}
          cleaningEstimate={cleaningEstimates[Number(property.id)]}
          onEdit={() => navigate(`/properties/${property.id}/edit`)}
          onDelete={() => onDelete(property)}
          onView={() => navigate(`/properties/${property.id}`)}
          channexMapping={channexMappings.get(Number(property.id)) ?? null}
          onChannexBadgeClick={() => onDiagnose(Number(property.id), property.name)}
          missingContract={canManageContracts && missingContractIds.has(Number(property.id))}
          onMissingContractClick={() => onMissingContractClick(Number(property.id))}
        />
      ))}
    </Box>
    {totalCount > ITEMS_PER_PAGE && (
      <TablePagination
        component="div"
        count={totalCount}
        page={page}
        onPageChange={(_, p) => onPageChange(p)}
        rowsPerPage={ITEMS_PER_PAGE}
        rowsPerPageOptions={[ITEMS_PER_PAGE]}
        labelDisplayedRows={({ from, to, count }) => `${from}-${to} sur ${count}`}
        sx={PAGINATION_SX}
      />
    )}
  </>
  );
};

export default PropertiesGridView;
