import { createContext, useContext, type ReactNode } from 'react';
import { Button, Tooltip, TooltipContent, TooltipTrigger } from '../../../components/ui';
import { MapPin } from '../../../icons/glyphs';
import { useTranslation } from '../../../hooks/useTranslation';

export const MapRowInteractions = createContext<{
  highlight: (id: number | null) => void; locate: (id: number) => void;
  selectedId: number | null; highlightedId: number | null;
} | null>(null);

const MapRowFocus = createContext<(() => void) | undefined>(undefined);
export function useMapRowFocus() { return useContext(MapRowFocus); }

/** Action compacte, indépendante du déclencheur d’aperçu du logement. */
export function MapLocateButton({ propertyId }: { propertyId: number }) {
  const interaction = useContext(MapRowInteractions);
  const { t } = useTranslation();
  if (!interaction) return null;
  const label = t('mapPilot.locate', 'Localiser sur la carte');
  return <Tooltip><TooltipTrigger asChild>
    <Button size="icon" variant="ghost" className="relative z-10 size-7 shrink-0 cursor-pointer"
      aria-label={label} onClick={() => interaction.locate(propertyId)}>
      <MapPin className="size-3.5" aria-hidden />
    </Button>
  </TooltipTrigger><TooltipContent>{label}</TooltipContent></Tooltip>;
}

/** Pont liste ↔ carte, sans intercepter les liens de détail ni les actions métier. */
export function MapLinkedRow({ propertyId, children, showLocate = true }: { propertyId?: number; children: ReactNode; showLocate?: boolean }) {
  const interaction = useContext(MapRowInteractions);
  const { t } = useTranslation();
  if (!interaction || propertyId == null) return <>{children}</>;
  const active = interaction.highlightedId === propertyId || interaction.selectedId === propertyId;
  return <div data-map-row-property={propertyId} data-map-row-active={active || undefined}
    className="relative min-w-0 data-[map-row-active=true]:bg-muted"
    onMouseEnter={() => interaction.highlight(propertyId)} onMouseLeave={() => interaction.highlight(null)}
    onFocusCapture={() => interaction.highlight(propertyId)}
    onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) interaction.highlight(null); }}>
    <MapRowFocus.Provider value={() => interaction.locate(propertyId)}>{children}</MapRowFocus.Provider>
    {showLocate && <div className="flex justify-end px-3 pb-2">
      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => interaction.locate(propertyId)}>
        <MapPin className="size-3.5" />{t('mapPilot.locate', 'Localiser sur la carte')}
      </Button>
    </div>}
  </div>;
}
