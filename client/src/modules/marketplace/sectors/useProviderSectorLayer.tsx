import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Layers } from '../../../icons/glyphs';
import { sectorBounds, type SectorGeometry, type SectorMode, type SectorOverlay } from '../../../components/map/sectorLayer';
import type { MapBounds } from '../../../components/BaitlyPropertyMap';
import { useTranslation } from '../../../hooks/useTranslation';
import { sectorMapApi } from '../../../services/api/sectorMapApi';
import ProviderSectorPanel from './ProviderSectorPanel';
import { withFocusedProvider } from './withFocusedProvider';
import { sectorContainsPoint, sectorProvidersInArea, smallestSectorAtPoint } from '../../../components/map/sectorHitTest';
import type { MapPoint } from '../../properties/map-views/baitlyMapContext';

export interface ProviderSectorLayer {
  /** Calque à passer à la carte ; null tant qu'il est éteint ou en chargement. */
  overlay: SectorOverlay | null;
  /** Bouton-icône d'activation, à empiler avec les outils de la carte. */
  tool: ReactNode;
  /** Colonne des prestataires de la zone visible ; null tant que le calque est éteint. */
  panel: ReactNode;
  /** Logement → couverture du prestataire survolé, puis sélectionné, sinon de tous ; null si éteint. */
  coverage: Map<number, number[]> | null;
  /** Emprise du secteur sélectionné, pour y recadrer la carte ; null sans sélection. */
  focusBounds: [number, number, number, number] | null;
  /**
   * Sélectionne le prestataire dont le compte PMS est `userId` (celui d'une prestation du jour
   * choisi dans une fiche logement) ; null, ou un intervenant hors catalogue, efface la sélection.
   */
  focusProviderUser: (userId: number | null) => void;
  selectedArea: SectorGeometry | null;
  clearArea: () => void;
  allCoverage: Map<number, number[]> | null;
}

/**
 * Calque « Secteurs des prestataires » de la carte des logements, allumé d'office : il montre
 * les secteurs des prestataires qui couvrent au moins un logement, la liste de ceux qui
 * entrent dans la zone visible, et l'anneau des épingles passe en couvert / non couvert.
 * Choisir un prestataire cadre son secteur ; le chevron ouvre son aperçu séparément.
 */
/** `ready` : faux tant que l'écran n'a pas fait son premier rendu (calque secondaire, différé). */
export function useProviderSectorLayer(bounds: MapBounds | null, ready = true, options?: {
  point: MapPoint | MapPoint[] | null; onPointChange: (point: MapPoint | MapPoint[] | null) => void;
  mode: SectorMode; onModeChange: (mode: SectorMode) => void;
}): ProviderSectorLayer {
  const { t } = useTranslation();
  // Allumé d'office : les prestataires et leurs secteurs font partie de la lecture de la carte.
  const [enabled, setEnabled] = useState(true);
  const [localMode, setLocalMode] = useState<SectorMode>('byProvider');
  const mode = options?.mode ?? localMode;
  const setMode = (next: SectorMode) => { setLocalMode(next); options?.onModeChange(next); };
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [areaProviderIds, setAreaProviderIds] = useState<number[] | null>(null);
  const [selectedAreas, setSelectedAreas] = useState<{ geometry: SectorGeometry; point?: MapPoint; ids: number[] }[]>([]);
  const selectedAreaGeometry = useMemo<SectorGeometry | null>(() => {
    if (!selectedAreas.length) return null;
    if (selectedAreas.length === 1) return selectedAreas[0].geometry;
    return { type: 'MultiPolygon', coordinates: selectedAreas.flatMap(area => area.geometry.type === 'Polygon' ? [area.geometry.coordinates] : area.geometry.coordinates) };
  }, [selectedAreas]);
  // Compte de l'intervenant d'une prestation (jour choisi dans une fiche logement).
  const [focusUserId, setFocusUserId] = useState<number | null>(null);
  const onPointChange = options?.onPointChange;
  const selectArea = useCallback((ids: number[] | null, geometry?: SectorGeometry | null, point?: MapPoint | null) => {
    const key = geometry ? JSON.stringify(geometry) : null;
    const next = geometry && ids?.length
      ? selectedAreas.some(area => JSON.stringify(area.geometry) === key)
        ? selectedAreas.filter(area => JSON.stringify(area.geometry) !== key)
        : [...selectedAreas, { geometry, point: point ?? undefined, ids }]
      : [];
    setSelectedAreas(next);
    // Une union de zones filtre les listes avec un OU, sans doublonner les prestataires.
    const providerIds = next.length ? [...new Set(next.flatMap(area => area.ids))] : geometry ? [] : ids ?? [];
    setAreaProviderIds(providerIds.length ? providerIds : null);
    setFocusUserId(null);
    setSelectedId(null);
    setHoveredId(null);
    const points = next.flatMap(area => area.point ? [area.point] : []);
    onPointChange?.(points.length === 1 ? points[0] : points.length ? points : null);
  }, [onPointChange, selectedAreas]);
  const query = useQuery({
    queryKey: ['sector-map', 'relevant'],
    queryFn: () => sectorMapApi.relevant(),
    enabled: enabled && ready,
    staleTime: 5 * 60_000,
  });
  // Un intervenant qui ne couvre aucun logement n'est pas dans la liste : on lit son secteur à part.
  const focusListed = focusUserId != null && !!query.data?.providers.some((p) => p.userId === focusUserId);
  const focused = useQuery({
    queryKey: ['sector-map', 'user', focusUserId],
    queryFn: () => sectorMapApi.providerOfUser(focusUserId!),
    enabled: enabled && focusUserId != null && !!query.data && !focusListed,
    staleTime: 5 * 60_000,
    retry: false,
  });
  const data = useMemo(() => enabled && query.data
    ? withFocusedProvider(query.data, focusUserId != null && !focusListed ? focused.data : undefined)
    : undefined, [enabled, query.data, focused.data, focusUserId, focusListed]);

  // Dès que le prestataire de l'intervenant est connu, il est sélectionné.
  useEffect(() => {
    if (focusUserId == null || !data) return;
    const provider = data.providers.find((p) => p.userId === focusUserId);
    if (provider?.providerId != null) setSelectedId(provider.providerId);
  }, [data, focusUserId]);

  const providerContours = useMemo(() => data?.providers.map((p) => ({ id: p.providerId, geometry: p.geometry })) ?? [], [data]);
  const point = options?.point;
  const pointKey = JSON.stringify(point ?? null);
  useEffect(() => {
    if (!point) { setAreaProviderIds(null); setSelectedAreas([]); return; }
    if (!data) return;
    const points = Array.isArray(point) ? point : [point];
    const seen = new Set<string>();
    const areas = points.flatMap(point => {
      const geometry = smallestSectorAtPoint(providerContours, point.lng, point.lat);
      if (!geometry || seen.has(JSON.stringify(geometry))) return [];
      seen.add(JSON.stringify(geometry));
      return [{ geometry, point, ids: sectorProvidersInArea(providerContours, geometry) }];
    });
    setSelectedAreas(areas);
    const ids = [...new Set(areas.flatMap(area => sectorProvidersInArea(providerContours, area.geometry)))];
    setAreaProviderIds(ids.length ? ids : null);
  }, [pointKey, data, providerContours]);
  const overlay = useMemo<SectorOverlay | null>(() => data ? {
    providers: providerContours,
    merged: data.merged,
    mode,
    highlightedProviderId: hoveredId,
    selectedProviderId: selectedId,
    selectedAreaGeometry,
    onAreaSelect: selectArea,
  } : null, [data, providerContours, mode, hoveredId, selectedId, selectedAreaGeometry, selectArea]);

  const visibleProviderId = hoveredId ?? selectedId;
  const coverageData = data ?? query.data;
  const allCoverage = useMemo(() => coverageData ? new Map(coverageData.properties.map(p => [p.id, p.coveredBy])) : null, [coverageData]);
  const coverage = useMemo(() => data
    ? new Map(data.properties.map((p) => [p.id,
      visibleProviderId == null ? p.coveredBy : p.coveredBy.filter((id) => id === visibleProviderId)]))
    : null, [data, visibleProviderId]);

  const focusBounds = useMemo(() => {
    // Le clic dans la liste ouvre l'aperçu à sa place, sans changer le cadrage
    // et donc les candidats visibles. Le recadrage reste utile depuis une prestation.
    const geometry = data?.providers.find((p) => p.providerId != null && p.providerId === selectedId)?.geometry;
    return geometry ? sectorBounds(geometry) : null;
  }, [data, selectedId, focusUserId]);

  const toggle = () => {
    setEnabled((on) => !on);
    setFocusUserId(null);
    setSelectedId(null);
    setHoveredId(null);
    setAreaProviderIds(null);
    setSelectedAreas([]);
    onPointChange?.(null);
  };
  const label = t('sectorMap.layer', 'Secteurs des prestataires');
  const tool = (
    <button type="button" aria-pressed={enabled} onClick={toggle}
      className="baitly-map-tool" aria-label={label} title={label}>
      <Layers size={18} aria-hidden="true" />
    </button>
  );

  const panel = enabled ? (
    <ProviderSectorPanel
      data={data && selectedAreaGeometry ? { ...data, properties: data.properties.filter(property =>
        property.longitude != null && property.latitude != null && sectorContainsPoint(selectedAreaGeometry, property.longitude, property.latitude)) } : data}
      isLoading={query.isLoading}
      isError={query.isError}
      bounds={bounds}
      mode={mode}
      onModeChange={(next) => { setMode(next); selectArea(null); }}
      areaProviderIds={areaProviderIds}
      selectedAreaCount={selectedAreas.length}
      onClearAreaFilter={() => selectArea(null)}
      selectedId={selectedId}
      // Sélectionner un prestataire, c'est vouloir voir SON secteur : vue par prestataire.
      onSelect={(id) => { setFocusUserId(null); setHoveredId(null); setSelectedId(id); if (id != null) setMode('byProvider'); }}
      onHover={setHoveredId}
    />
  ) : null;

  const focusProviderUser = useCallback((userId: number | null) => {
    setFocusUserId(userId);
    setHoveredId(null);
    setSelectedId(null);
    if (userId != null) { setLocalMode('byProvider'); options?.onModeChange('byProvider'); }
  }, [options?.onModeChange]);

  return { overlay, tool, panel, coverage, focusBounds, focusProviderUser,
    selectedArea: selectedAreaGeometry, clearArea: () => selectArea(null), allCoverage };
}
