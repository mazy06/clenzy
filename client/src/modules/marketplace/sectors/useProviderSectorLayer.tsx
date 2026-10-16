import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Layers } from '../../../icons/glyphs';
import { sectorBounds, type SectorMode, type SectorOverlay } from '../../../components/map/sectorLayer';
import type { MapBounds } from '../../../components/BaitlyPropertyMap';
import { useTranslation } from '../../../hooks/useTranslation';
import { sectorMapApi } from '../../../services/api/sectorMapApi';
import ProviderSectorPanel from './ProviderSectorPanel';
import { withFocusedProvider } from './withFocusedProvider';

export interface ProviderSectorLayer {
  /** Calque à passer à la carte ; null tant qu'il est éteint ou en chargement. */
  overlay: SectorOverlay | null;
  /** Bouton-icône d'activation, à empiler avec les outils de la carte. */
  tool: ReactNode;
  /** Colonne des prestataires de la zone visible ; null tant que le calque est éteint. */
  panel: ReactNode;
  /** Logement → prestataires qui le couvrent (le seul sélectionné s'il y en a un) ; null si éteint. */
  coverage: Map<number, number[]> | null;
  /** Emprise du secteur sélectionné, pour y recadrer la carte ; null sans sélection. */
  focusBounds: [number, number, number, number] | null;
  /**
   * Sélectionne le prestataire dont le compte PMS est `userId` (celui d'une prestation du jour
   * choisi dans une fiche logement) ; null, ou un intervenant hors catalogue, efface la sélection.
   */
  focusProviderUser: (userId: number | null) => void;
}

/**
 * Calque « Secteurs des prestataires » de la carte des logements, allumé d'office : il montre
 * les secteurs des prestataires qui couvrent au moins un logement, la liste de ceux qui
 * entrent dans la zone visible, et l'anneau des épingles passe en couvert / non couvert.
 * L'éteindre rend à la carte l'anneau du planning du jour. Choisir un prestataire recadre
 * la carte sur son secteur.
 */
/** `ready` : faux tant que l'écran n'a pas fait son premier rendu (calque secondaire, différé). */
export function useProviderSectorLayer(bounds: MapBounds | null, ready = true): ProviderSectorLayer {
  const { t } = useTranslation();
  // Allumé d'office : les prestataires et leurs secteurs font partie de la lecture de la carte.
  const [enabled, setEnabled] = useState(true);
  const [mode, setMode] = useState<SectorMode>('merged');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  // Compte de l'intervenant d'une prestation (jour choisi dans une fiche logement).
  const [focusUserId, setFocusUserId] = useState<number | null>(null);
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

  const overlay = useMemo<SectorOverlay | null>(() => data ? {
    providers: data.providers.map((p) => ({ id: p.providerId, geometry: p.geometry })),
    merged: data.merged,
    mode,
    highlightedProviderId: hoveredId ?? selectedId,
  } : null, [data, mode, hoveredId, selectedId]);

  const coverage = useMemo(() => data
    ? new Map(data.properties.map((p) => [p.id,
      selectedId == null ? p.coveredBy : p.coveredBy.filter((id) => id === selectedId)]))
    : null, [data, selectedId]);

  const focusBounds = useMemo(() => {
    const geometry = data?.providers.find((p) => p.providerId != null && p.providerId === selectedId)?.geometry;
    return geometry ? sectorBounds(geometry) : null;
  }, [data, selectedId]);

  const toggle = () => {
    setEnabled((on) => !on);
    setFocusUserId(null);
    setSelectedId(null);
    setHoveredId(null);
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
      data={data}
      isLoading={query.isLoading}
      isError={query.isError}
      bounds={bounds}
      mode={mode}
      onModeChange={setMode}
      selectedId={selectedId}
      // Sélectionner un prestataire, c'est vouloir voir SON secteur : vue par prestataire.
      onSelect={(id) => { setFocusUserId(null); setSelectedId(id); if (id != null) setMode('byProvider'); }}
      onHover={setHoveredId}
    />
  ) : null;

  const focusProviderUser = useCallback((userId: number | null) => {
    setFocusUserId(userId);
    setHoveredId(null);
    setSelectedId(null);
    if (userId != null) setMode('byProvider');
  }, []);

  return { overlay, tool, panel, coverage, focusBounds, focusProviderUser };
}
