import type { SectorMap } from '../../../services/api/sectorMapApi';

/**
 * Ajoute à la carte des secteurs le prestataire d'une prestation quand il n'y figure pas
 * (il ne couvre aucun logement, ou aucune zone déclarée). Il est ajouté en fin de liste pour
 * ne pas décaler la teinte des autres secteurs ; la colonne le remonte en tête une fois sélectionné.
 */
export function withFocusedProvider(data: SectorMap, focused: SectorMap | undefined): SectorMap {
  const missing = (focused?.providers ?? []).filter((extra) =>
    !data.providers.some((p) => p.providerId === extra.providerId));
  if (missing.length === 0 || !focused) return data;
  const extraIds = new Set(missing.map((p) => p.providerId));
  const coveredBy = new Map(focused.properties.map((p) => [p.id, p.coveredBy.filter((id) => extraIds.has(id))]));
  return {
    ...data,
    providers: [...data.providers, ...missing],
    properties: data.properties.map((p) => ({ ...p, coveredBy: [...p.coveredBy, ...(coveredBy.get(p.id) ?? [])] })),
  };
}
