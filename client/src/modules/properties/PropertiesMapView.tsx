import React from 'react';
import StatusChip from '../../components/StatusChip';
import { Box, Paper, Tooltip, IconButton } from '@mui/material';
import type { NavigateFunction } from 'react-router-dom';
import { Home, LocationOn, Visibility } from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import ChannexHealthBadge from '../settings/components/ChannexHealthBadge';
import MissingContractChip from './MissingContractChip';
import { MapboxPropertyMap } from '../../components/MapboxPropertyMap';
import { Money } from '../../components/Money';
import type { PropertyMarker, MapBounds } from '../../components/MapboxPropertyMap';
import type { PropertyListItem } from '../../hooks/usePropertiesList';
import type { ChannexMappingDto } from '../../services/api/channexApi';
import {
  getPropertyStatusLabel,
  getPropertyTypeLabel,
  getPropertyTypeHex,
} from '../../utils/statusUtils';
import { LIST_PAPER_SX, propertyStatusTokens } from './propertiesListConstants';

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
          <div className="h-[400px] flex flex-col items-center justify-center gap-1.5">
            <span className="inline-flex text-muted-foreground opacity-50"><Home size={36} strokeWidth={1.5} /></span>
            <p className="cn-text-body2 text-muted-foreground text-[0.8125rem]">
              Aucune propriété avec coordonnées GPS
            </p>
            <span className="cn-text-caption text-muted-foreground text-[0.6875rem]">
              Les coordonnées sont ajoutées automatiquement lors de la saisie de l'adresse
            </span>
          </div>
        )}
      </Paper>

      {/* Liste scrollable en dessous */}
      {mapMarkers.length > 0 && (
        <div className="mt-2 flex-1 min-h-0 flex flex-col">
          <h6 className="cn-text-subtitle2 mb-1.5 text-[12.5px] font-semibold text-[var(--muted)] shrink-0 tabular-nums">
            {viewportProperties.length} {viewportProperties.length > 1 ? 'propriétés' : 'propriété'} dans la zone visible
          </h6>

          {viewportProperties.length === 0 ? (
            <Paper sx={{ ...LIST_PAPER_SX, p: 2, textAlign: 'center' }}>
              <p className="cn-text-body2 text-muted-foreground text-[0.8125rem]">
                Aucune propriété dans cette zone. Déplacez ou dézoomez la carte.
              </p>
            </Paper>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-1.5 pe-0.5">
              {viewportProperties.map((property) => {
                const typeColor = getPropertyTypeHex(property.type);
                return (
                  <Paper
                    key={property.id}
                    sx={{
                      ...LIST_PAPER_SX,
                      p: 1.5,
                      cursor: 'pointer',
                      transition: 'border-color .14s, box-shadow .14s',
                      flexShrink: 0,
                      '&:hover': {
                        borderColor: 'var(--line-2)',
                        boxShadow: 'var(--shadow-card)',
                      },
                    }}
                    onClick={() => navigate(`/properties/${property.id}`)}
                  >
                    <div className="flex items-center gap-2">
                      {/* Nom + adresse */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 min-w-0">
                          <p className="cn-text-body2 font-semibold text-[0.84rem] overflow-hidden text-ellipsis whitespace-nowrap min-w-0">
                            {property.name}
                          </p>
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
                        </div>
                        <div className="flex items-center gap-0.5 mt-0.5">
                          <span className="inline-flex text-muted-foreground shrink-0"><LocationOn size={13} strokeWidth={1.75} /></span>
                          <span className="cn-text-caption text-muted-foreground text-[0.72rem] overflow-hidden text-ellipsis whitespace-nowrap">
                            {property.address}, {property.city}
                          </span>
                        </div>
                      </div>

                      {/* Type + Statut chips */}
                      <div className="flex items-center gap-0.5 shrink-0">
                        <StatusChip color={typeColor} label={getPropertyTypeLabel(property.type, t)} />
                        <StatusChip tokens={propertyStatusTokens(property.status)} label={getPropertyStatusLabel(property.status, t)} />
                      </div>

                      {/* Prix + Action */}
                      <div className="flex items-center gap-2 shrink-0">
                        {property.nightlyPrice > 0 && (
                          <p className="cn-text-body2 font-[var(--font-display)] font-semibold text-[13.5px] whitespace-nowrap text-[var(--ink)] tabular-nums">
                            <Money value={property.nightlyPrice} from="EUR" decimals={0} />
                            <span className="cn-text-caption text-muted-foreground text-[0.68rem]">
                              /nuit
                            </span>
                          </p>
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
                      </div>
                    </div>
                  </Paper>
                );
              })}
            </div>
          )}
        </div>
      )}
    </Box>
  );
};

export default PropertiesMapView;
