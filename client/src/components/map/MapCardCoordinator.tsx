import { createContext, useContext, useMemo, useRef, type ReactNode } from 'react';

type ClaimCard = (close: () => void) => () => void;
const MapCardContext = createContext<ClaimCard>(() => () => {});

/** Une seule fiche à la fois dans cette carte, y compris celles portées par un portail. */
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
