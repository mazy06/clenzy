import { createContext, useContext, type ReactNode } from 'react';

/** Les fiches mobiles vivent dans la feuille, sans recouvrir les contrôles de carte. */
export interface MapSheetSlot {
  detailHost: HTMLElement | null;
  detailOpen: boolean;
  openDetail: () => void;
  closeDetail: () => void;
}

const MapSheetContext = createContext<MapSheetSlot | null>(null);

export function MapSheetProvider({ value, children }: { value: MapSheetSlot | null; children: ReactNode }) {
  return <MapSheetContext.Provider value={value}>{children}</MapSheetContext.Provider>;
}

export const useMapSheet = () => useContext(MapSheetContext);
