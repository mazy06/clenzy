import React from 'react';
import { Grid, TablePagination } from '@mui/material';
import type { NavigateFunction } from 'react-router-dom';
import PropertyCard from './PropertyCard';
import { toPropertyDetails } from './propertyDetailsMapper';
import { ITEMS_PER_PAGE, PAGINATION_SX } from './propertiesListConstants';
import type { PropertyListItem } from '../../hooks/usePropertiesList';
import type { ChannexMappingDto } from '../../services/api/channexApi';

interface PropertiesGridViewProps {
  properties: PropertyListItem[];
  totalCount: number;
  page: number;
  onPageChange: (page: number) => void;
  channexMappings: Map<number, ChannexMappingDto>;
  onDelete: (property: PropertyListItem) => void;
  onDiagnose: (propertyId: number, propertyName: string) => void;
  canManageContracts: boolean;
  missingContractIds: Set<number>;
  navigate: NavigateFunction;
}

/** Vue grille : cartes PropertyCard + pagination fixe. */
const PropertiesGridView: React.FC<PropertiesGridViewProps> = ({
  properties, totalCount, page, onPageChange, channexMappings, onDelete, onDiagnose,
  canManageContracts, missingContractIds, navigate,
}) => (
  <>
    <Grid container spacing={1.5}>
      {properties.map((property) => (
        <Grid item xs={12} md={6} lg={4} key={property.id}>
          <PropertyCard
            property={toPropertyDetails(property)}
            onEdit={() => navigate(`/properties/${property.id}/edit`)}
            onDelete={() => onDelete(property)}
            onView={() => navigate(`/properties/${property.id}`)}
            channexMapping={channexMappings.get(Number(property.id)) ?? null}
            onChannexBadgeClick={() => onDiagnose(Number(property.id), property.name)}
            missingContract={canManageContracts && missingContractIds.has(Number(property.id))}
            onMissingContractClick={() => navigate('/contracts')}
          />
        </Grid>
      ))}
    </Grid>
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

export default PropertiesGridView;
