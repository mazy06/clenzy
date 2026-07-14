import React, { useCallback, useRef, useState } from 'react';
import { Box, Typography, Tooltip } from '@mui/material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import PropertyPopover from './PropertyPopover';
import { propertiesApi } from '../../services/api/propertiesApi';
import type { PlanningProperty, DensityMode } from './types';

// Options de la requête performance — partagées entre le préchargement (survol)
// et la requête d'ouverture, source unique de la clé/queryFn.
const PERF_STALE_MS = 5 * 60 * 1000;
function perfQueryOptions(propertyId: number) {
  return {
    queryKey: ['property-performance', propertyId] as const,
    queryFn: () => propertiesApi.getPerformance(propertyId),
    staleTime: PERF_STALE_MS,
  };
}
import { Label as TagIcon, Wifi as ChannelIcon, ChevronDown } from '../../icons';
import type { ChannelSyncMap } from './hooks/usePlanningChannelSync';

// ─── Colonne logements (gauche, sticky) ──────────────────────────────────────
//
// Au clic sur le nom d'un logement → PropertyPopover (carte détaillée fusionnée :
// héro + type + adresse + propriétaire + stats + heures + fréquence ménage). Il
// n'y a plus de tooltip de survol séparé : tout est dans le popover au clic.
// Seul subsiste le petit tooltip de l'indicateur de sync canaux (wifi).

interface PlanningPropertyColumnProps {
  properties: PlanningProperty[];
  density: DensityMode;
  selectedPropertyId?: number | null;
  colWidth: number;
  /** Si fourni, affiche un drag handle sur le bord droit pour redimensionner. */
  onColWidthChange?: (width: number) => void;
  effectiveRowHeight: number;
  emptyRowCount?: number;
  reservationCountByProperty?: Map<number, number>;
  /** Nb de cartes HITL en attente par logement (pastille superviseur). */
  pendingCountByProperty?: Map<number, number>;
  channelSyncMap?: ChannelSyncMap;
  /** Superviseur d'agents : logement déployé (accordéon). */
  expandedPropertyId?: number | null;
  /** Si fourni, affiche un chevron d'accordéon par ligne. */
  onToggleExpanded?: (propertyId: number) => void;
  /** Hauteur du spacer inséré sous une ligne déployée (= hauteur accordéon). */
  accordionHeight?: number;
}

const PlanningPropertyColumn: React.FC<PlanningPropertyColumnProps> = React.memo(({
  properties,
  density,
  selectedPropertyId,
  colWidth,
  onColWidthChange,
  effectiveRowHeight,
  emptyRowCount = 0,
  reservationCountByProperty,
  pendingCountByProperty,
  channelSyncMap,
  expandedPropertyId = null,
  onToggleExpanded,
  accordionHeight = 600,
}) => {
  // ── Popover logement (maquette) : ouvert au clic sur le nom ──────────────
  const [popover, setPopover] = useState<{ anchorEl: HTMLElement; propertyId: number } | null>(null);
  const popoverProperty = popover
    ? properties.find((p) => p.id === popover.propertyId) ?? null
    : null;

  // Le parent orchestre la donnée du popover : il précharge au survol, récupère
  // la performance du logement ouvert, et ne monte le popover QUE lorsque tout
  // est prêt → PropertyPopover est présentationnel et rend tout en une fois.
  const isMock = propertiesApi.isMockMode();
  const queryClient = useQueryClient();
  const prefetchPerformance = useCallback((propertyId: number) => {
    if (isMock) return;
    queryClient.prefetchQuery(perfQueryOptions(propertyId));
  }, [queryClient, isMock]);

  const perfQuery = useQuery({
    ...perfQueryOptions(popover?.propertyId ?? 0),
    enabled: !!popover && !isMock,
    retry: false,
  });
  // Prêt à afficher : logement trouvé ET (mode démo OU perf résolue). Avec le
  // préchargement au survol, la perf est déjà en cache → prêt instantanément.
  const perfReady = !!popover && (isMock || perfQuery.isFetched);
  // ── Drag handle pour redimensionner la colonne ───────────────────────────
  const resizeStartRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const [isResizing, setIsResizing] = useState(false);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!onColWidthChange) return;
    e.preventDefault();
    e.stopPropagation();
    resizeStartRef.current = { startX: e.clientX, startWidth: colWidth };
    setIsResizing(true);

    const handleMove = (ev: MouseEvent) => {
      const start = resizeStartRef.current;
      if (!start) return;
      const delta = ev.clientX - start.startX;
      onColWidthChange(start.startWidth + delta);
    };

    const handleUp = () => {
      resizeStartRef.current = null;
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [colWidth, onColWidthChange]);


  return (
    <Box
      sx={{
        position: 'sticky',
        left: 0,
        zIndex: 10,
        width: colWidth,
        minWidth: colWidth,
        flexShrink: 0,
        // Le fond + la bordure droite (séparation 2 colonnes) ne sont PLUS sur la
        // racine : sinon ils courent sur toute la hauteur, y compris la zone vide
        // sous le dernier logement. Ils sont portés par le wrapper des lignes de
        // propriété ci-dessous → sous les logements = espace vide uniforme.
      }}
    >
      {/* Colonne visible (fond + bordure droite) bornée aux lignes de propriété :
          la séparation 2 colonnes s'arrête au dernier logement. position:relative
          → la poignée de resize (height:100%) est bornée à CETTE zone (les lignes)
          et NON à la hauteur totale — sinon sa ligne verte de hover/resig courait
          en pleine hauteur dans le vide (effet « 2 colonnes »). */}
      <Box sx={{ position: 'relative', backgroundColor: 'var(--card)', borderRight: '1px solid var(--line)' }}>
      {/* Drag handle pour redimensionner la colonne (bord droit).
          Hit-area de 6px, visuel discret sauf au hover/drag ; borné aux lignes. */}
      {onColWidthChange && (
        <Box
          onMouseDown={handleResizeMouseDown}
          role="separator"
          aria-label="Redimensionner la colonne logements"
          aria-orientation="vertical"
          sx={{
            position: 'absolute',
            top: 0,
            right: -3, // chevauche legerement la grille pour faciliter la prise
            width: 6,
            height: '100%',
            cursor: 'col-resize',
            zIndex: 11,
            // Ligne verticale visible uniquement au hover ou pendant le drag.
            '&::after': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 2,
              width: 2,
              height: '100%',
              backgroundColor: isResizing
                ? 'var(--accent)'
                : 'transparent',
              transition: 'background-color 150ms ease',
            },
            '&:hover::after': {
              backgroundColor: isResizing
                ? 'var(--accent)'
                : 'color-mix(in srgb, var(--accent) 55%, transparent)',
            },
          }}
        />
      )}
      {properties.map((property) => {
        const reservationCount = reservationCountByProperty?.get(property.id) ?? 0;
        const pendingCount = pendingCountByProperty?.get(property.id) ?? 0;
        const subtitle = property.city || property.address || '';
        const sync = channelSyncMap?.get(property.id);
        // Color du wifi : vert si tout sync, ambre si partiel, rouge si zero
        const syncColor = sync && sync.total > 0
          ? sync.synced === sync.total
            ? 'var(--ok)'
            : sync.synced > 0 ? 'var(--warn)' : 'var(--err)'
          : 'var(--faint)';
        return (
          <React.Fragment key={property.id}>
          <Box
            onClick={(e) => setPopover({ anchorEl: e.currentTarget, propertyId: property.id })}
            onMouseEnter={() => prefetchPerformance(property.id)}
            sx={{
              position: 'relative',
              height: effectiveRowHeight,
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 0,
              px: 0,
              cursor: 'pointer',
              borderBottom: '1px solid var(--line)',
              // Spec .pl-name : fond plat var(--card) (pas de zebra)
              backgroundColor: selectedPropertyId === property.id || popover?.propertyId === property.id
                ? 'var(--accent-soft)'
                : 'var(--card)',
              transition: 'background-color 0.15s ease',
              '&:hover': {
                backgroundColor: 'var(--hover)',
              },
            }}
          >
            {/* Bloc texte (spec .pl-name : padding 0 16px, colonne centrée) :
                nom + ville dessous. Le count de reservations en cours reste
                visible en pastille discrete inline a cote du nom. */}
            <Box
              sx={{
                flex: 1,
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 0.125,
                px: '16px',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.625, minWidth: 0 }}>
                {/* Box component=span : evite l'heritage du variant body1 du
                    Typography (le theme MUI a des fontSize responsive en
                    media-query qui peuvent surcharger sx en breakpoint large). */}
                {/* Spec .pl-name .nm : 12.5px fw600 var(--ink), 1 ligne ellipsis */}
                <Box
                  component="span"
                  sx={{
                    fontSize: density === 'compact' ? '11.5px' : '12.5px',
                    fontWeight: 600,
                    color: 'var(--ink)',
                    lineHeight: 1.25,
                    letterSpacing: '-0.01em',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    minWidth: 0,
                  }}
                >
                  {property.name}
                </Box>
                {/* Reservations en cours / a venir : pastille inline discrete */}
                {reservationCount > 0 && (
                  <Box
                    component="span"
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 0.25,
                      flexShrink: 0,
                      color: 'var(--faint)',
                    }}
                  >
                    <TagIcon size={10} strokeWidth={1.75} />
                    <Box
                      component="span"
                      sx={{
                        fontSize: '0.625rem',
                        fontWeight: 600,
                        lineHeight: 1,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {reservationCount}
                    </Box>
                  </Box>
                )}
                {/* Cartes HITL en attente : pastille ambre numérotée (attire l'œil) */}
                {pendingCount > 0 && (
                  <Box
                    component="span"
                    aria-label={`${pendingCount} action(s) à valider`}
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      minWidth: 16,
                      height: 16,
                      px: '4px',
                      borderRadius: '8px',
                      bgcolor: 'var(--warn, #A97C2E)',
                      color: '#fff',
                      fontSize: '0.625rem',
                      fontWeight: 700,
                      lineHeight: 1,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {pendingCount > 99 ? '99+' : pendingCount}
                  </Box>
                )}
              </Box>
              {/* Spec .pl-name .ci : 10.5px var(--muted) */}
              {subtitle && (
                <Box
                  component="span"
                  sx={{
                    fontSize: density === 'compact' ? '9.5px' : '10.5px',
                    fontWeight: 400,
                    color: 'var(--muted)',
                    lineHeight: 1.2,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    display: 'block',
                  }}
                >
                  {subtitle}
                </Box>
              )}
            </Box>
            {/* Chevron d'accordéon Superviseur (gated par le rôle côté parent) */}
            {onToggleExpanded && (
              <Box
                role="button"
                aria-label="Superviseur d'agents"
                aria-expanded={expandedPropertyId === property.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleExpanded(property.id);
                }}
                sx={{
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 26,
                  height: 26,
                  mr: '8px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  color: expandedPropertyId === property.id ? 'var(--accent)' : 'var(--muted)',
                  transform: expandedPropertyId === property.id ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.2s ease, color 0.15s, background-color 0.15s',
                  '&:hover': { backgroundColor: 'var(--hover)', color: 'var(--accent)' },
                }}
              >
                <ChevronDown size={16} strokeWidth={2} />
              </Box>
            )}
            {/* Indicateur en bas-droite : sync canaux (wifi) */}
            {sync && sync.total > 0 && (
              <Box
                sx={{
                  position: 'absolute',
                  right: 6,
                  bottom: 4,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.75,
                  pointerEvents: 'none',
                }}
              >
                <Tooltip
                  title={`${sync.synced} sur ${sync.total} canaux synchronises (sync < 24h)`}
                  placement="top"
                  arrow
                >
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.25,
                      color: syncColor,
                      pointerEvents: 'auto',
                    }}
                  >
                    <ChannelIcon size={11} strokeWidth={1.75} />
                    <Box
                      component="span"
                      sx={{
                        fontSize: '0.5625rem',
                        fontWeight: 600,
                        color: 'inherit',
                        lineHeight: 1,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {sync.synced}/{sync.total}
                    </Box>
                  </Box>
                </Tooltip>
              </Box>
            )}
          </Box>
          {/* Spacer d'alignement : compense la hauteur de l'accordéon côté grille.
              Fond = base SOMBRE de la constellation (et non var(--bg)) : le panneau
              constellation (position:sticky, tiré à gauche par ml) met une frame à
              se caler ; sans ça, la zone colonne de gauche flashait en clair une
              fraction de seconde (« droite avant gauche »). Ici elle est déjà
              sombre = raccord invisible avec la constellation. */}
          {expandedPropertyId === property.id && (
            <Box sx={{ height: accordionHeight, borderBottom: '1px solid var(--line)', backgroundColor: '#0c0e2a' }} />
          )}
          </React.Fragment>
        );
      })}
      </Box>
      {/* Zone vide sous le dernier logement : transparente, SANS bordure droite
          → pas de « 2 colonnes », juste un espace vide (aligné sur la grille,
          dont les lignes de remplissage sont aussi transparentes). */}
      {Array.from({ length: emptyRowCount }, (_, i) => (
        <Box
          key={`empty-${i}`}
          sx={{ height: effectiveRowHeight, backgroundColor: 'transparent' }}
        />
      ))}

      {/* Popover logement (clic sur le nom) — monté seulement quand la perf est
          prête → il s'affiche complet, en une fois (pas de rendu progressif). */}
      {popover && popoverProperty && perfReady && (
        <PropertyPopover
          anchorEl={popover.anchorEl}
          property={popoverProperty}
          performance={isMock ? null : (perfQuery.data ?? null)}
          onClose={() => setPopover(null)}
        />
      )}
    </Box>
  );
});

PlanningPropertyColumn.displayName = 'PlanningPropertyColumn';
export default PlanningPropertyColumn;
