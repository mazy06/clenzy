import { createContext, useContext, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';

type ClaimCard = (close: () => void) => () => void;
const MapCardContext = createContext<ClaimCard>(() => () => {});

/** Une seule fiche ou panneau à la fois dans cette carte, y compris ceux portés par un portail. */
export function MapCardCoordinator({ children }: { children: ReactNode }) {
  const active = useRef<{ close: () => void } | null>(null);
  const claim = useMemo<ClaimCard>(() => close => {
    const previous = active.current;
    const next = { close };
    active.current = next;
    previous?.close();
    return () => { if (active.current === next) active.current = null; };
  }, []);
  return <MapCardContext.Provider value={claim}>{children}</MapCardContext.Provider>;
}

export const useMapCardClaim = () => useContext(MapCardContext);

/** Même arbitrage pour les filtres React et les fiches MapLibre. */
export function useMapPanelState() {
  const [open, setOpen] = useState(false);
  const claim = useMapCardClaim();
  useLayoutEffect(() => {
    if (open) return claim(() => setOpen(false));
  }, [open, claim]);
  return [open, setOpen] as const;
}
