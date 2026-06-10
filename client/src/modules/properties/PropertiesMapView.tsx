import React from 'react';
import { Box, Paper, Typography, Chip, Tooltip, IconButton } from '@mui/material';
import type { NavigateFunction } from 'react-router-dom';
import { Home, LocationOn, Visibility } from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import ChannexHealthBadge from '../settings/components/ChannexHealthBadge';
import MissingContractChip from './MissingContractChip';
import { MapboxPropertyMap } from '../../components/MapboxPropertyMap';
import type { PropertyMarker, MapBounds } from '../../components/MapboxPropertyMap';
import type { PropertyListItem } from '../../hooks/usePropertiesList';
import type { ChannexMappingDto } from '../../services/api/channexApi';
import {
  getPropertyStatusLabel,
  getPropertyStatusHex,
  getPropertyTypeLabel,
  getPropertyTypeHex,
} from '../../utils/statusUtils';
import { LIST_PAPER_SX } from './propertiesListConstants';

interface PropertiesMapViewProps {
  mapMarkers: PropertyMarker[];
  viewportProperties: PropertyListItem[];
  channexMappings: Map<number, ChannexMappingDto>;
  onBoundsChange: (bounds: MapBounds) => void;
  onDiagnose: (propertyId: number, propertyName: string) => void;
  canManageContracts: boolean;
  missingContractIds: Set<number>;
  /** Clic sur le badge « Contrat manquant » : ouvre la modal de contrat préselectionnée. */
  onMissingContractClick: (propertyId: number) => void;
  navigate: NavigateFunction;
}

/** Vue carte : carte fixe en haut + liste scrollable des propriétés du viewport. */
const PropertiesMapView: React.FC<PropertiesMapViewProps> = ({
  mapMarkers, viewportProperties, channexMappings, onBoundsChange, onDiagnose,
  canManageContracts, missingContractIds, onMissingContractClick, navigate,
}) => {
  const { t } = useTranslation();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 140px)', minHeight: 500 }}>
      {/* Carte fixe en haut */}
      <Paper sx={{ ...LIST_PAPER_SX, p: 0, overflow: 'hidden', flexShrink: 0 }}>
        {mapMarkers.length > 0 ? (
          <MapboxPropertyMap
            properties={mapMarkers}
            height={400}
            onMarkerClick={(marker) => {
              if (marker.id) navigate(`/properties/${marker.id}`);
            }}
            onBoundsChange={onBoundsChange}
          />
        ) : (
          <Box sx={{ height: 400, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
            <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary', opacity: 0.5 }}><Home size={36} strokeWidth={1.5} /></Box>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem' }}>
              Aucune propriété avec coordonnées GPS
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6875rem' }}>
              Les coordonnées sont ajoutées automatiquement lors de la saisie de l'adresse
            </Typography>
          </Box>
        )}
      </Paper>

      {/* Liste scrollable en dessous */}
      {mapMarkers.length > 0 && (
        <Box sx={{ mt: 1.5, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <Typography
            variant="subtitle2"
            sx={{ mb: 1, fontSize: '0.8125rem', fontWeight: 600, color: 'text.secondary', flexShrink: 0 }}
          >
            {viewportProperties.length} {viewportProperties.length > 1 ? 'propriétés' : 'propriété'} dans la zone visible
          </Typography>

          {viewportProperties.length === 0 ? (
            <Paper sx={{ ...LIST_PAPER_SX, p: 2, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem' }}>
                Aucune propriété dans cette zone. Déplacez ou dézoomez la carte.
              </Typography>
            </Paper>
          ) : (
            <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1, pr: 0.5 }}>
              {viewportProperties.map((property) => {
                const statusColor = getPropertyStatusHex(property.status);
                const typeColor = getPropertyTypeHex(property.type);
                return (
                  <Paper
                    key={property.id}
                    sx={{
                      ...LIST_PAPER_SX,
                      p: 1.5,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      flexShrink: 0,
                      '&:hover': {
                        borderColor: 'primary.main',
                        bgcolor: 'action.hover',
                      },
                    }}
                    onClick={() => navigate(`/properties/${property.id}`)}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      {/* Nom + adresse */}
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
                          <Typography
                            variant="body2"
                            fontWeight={600}
                            sx={{ fontSize: '0.84rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}
                          >
                            {property.name}
                          </Typography>
                          {/* Quick Win #4 : badge sante Channex */}
                          {channexMappings.get(Number(property.id)) && (
                            <ChannexHealthBadge
                              mapping={channexMappings.get(Number(property.id)) ?? null}
                              size={9}
                              variant="dot"
                              onClick={() => onDiagnose(Number(property.id), property.name)}
                            />
                          )}
                          {canManageContracts && missingContractIds.has(Number(property.id)) && (
                            <MissingContractChip
                              onClick={(e) => { e.stopPropagation(); onMissingContractClick(Number(property.id)); }}
                            />
                          )}
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
                          <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary', flexShrink: 0 }}><LocationOn size={13} strokeWidth={1.75} /></Box>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ fontSize: '0.72rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          >
                            {property.address}, {property.city}
                          </Typography>
                        </Box>
                      </Box>

                      {/* Type + Statut chips */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                        <Chip
                          label={getPropertyTypeLabel(property.type, t)}
                          size="small"
                          sx={{
                            backgroundColor: `${typeColor}18`,
                            color: typeColor,
                            border: `1px solid ${typeColor}40`,
                            borderRadius: '6px',
                            fontWeight: 600,
                            fontSize: '0.68rem',
                            height: 22,
                            '& .MuiChip-label': { px: 0.75 },
                          }}
                        />
                        <Chip
                          label={getPropertyStatusLabel(property.status, t)}
                          size="small"
                          sx={{
                            backgroundColor: `${statusColor}18`,
                            color: statusColor,
                            border: `1px solid ${statusColor}40`,
                            borderRadius: '6px',
                            fontWeight: 600,
                            fontSize: '0.68rem',
                            height: 22,
                            '& .MuiChip-label': { px: 0.75 },
                          }}
                        />
                      </Box>

                      {/* Prix + Action */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexShrink: 0 }}>
                        {property.nightlyPrice > 0 && (
                          <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.84rem', whiteSpace: 'nowrap' }}>
                            {property.nightlyPrice}€
                            <Typography component="span" variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
                              /nuit
                            </Typography>
                          </Typography>
                        )}
                        <Tooltip title="Détails">
                          <IconButton
                            size="small"
                            onClick={(e) => { e.stopPropagation(); navigate(`/properties/${property.id}`); }}
                            sx={{ p: 0.5 }}
                          >
                            <Visibility size={16} strokeWidth={1.75} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>
                  </Paper>
                );
              })}
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
};

export default PropertiesMapView;
