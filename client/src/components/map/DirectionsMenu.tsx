import { useState, type ReactElement } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui';
import { MapIcon, OpenInNew } from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import { directionsLinks, type DirectionsTarget } from '../../utils/directions';
import { BaitlyPropertyMap } from '../BaitlyPropertyMap';

interface DirectionsMenuProps {
  target: DirectionsTarget & { label: string };
  /** Bouton déclencheur (le menu s'y accroche, il garde son style). */
  children: ReactElement;
}

/**
 * « Itinéraire » : voir le lieu sur la carte Baitly, ou lancer le guidage dans
 * l'application GPS de son choix (Plans, Google Maps, Waze). Remplace les liens
 * qui imposaient Google Maps.
 */
export function DirectionsMenu({ target, children }: DirectionsMenuProps) {
  const { t } = useTranslation();
  const [mapOpen, setMapOpen] = useState(false);
  const links = directionsLinks(target);
  if (!links) return null;
  const hasCoords = typeof target.lat === 'number' && typeof target.lng === 'number';

  const apps: Array<{ key: keyof typeof links; label: string }> = [
    { key: 'appleMaps', label: t('baitlyMap.directions.appleMaps', 'Plans') },
    { key: 'googleMaps', label: t('baitlyMap.directions.googleMaps', 'Google Maps') },
    { key: 'waze', label: t('baitlyMap.directions.waze', 'Waze') },
  ];

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-52">
          {hasCoords ? (
            <>
              <DropdownMenuItem className="cursor-pointer" onSelect={() => setMapOpen(true)}>
                <MapIcon size={15} aria-hidden />
                {t('baitlyMap.directions.viewOnMap', 'Voir sur la carte Baitly')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          ) : null}
          <DropdownMenuLabel className="text-2xs font-medium text-muted-foreground">
            {t('baitlyMap.directions.navigateWith', 'Itinéraire avec')}
          </DropdownMenuLabel>
          {apps.map((app) => (
            <DropdownMenuItem key={app.key} asChild className="cursor-pointer">
              <a href={links[app.key]} target="_blank" rel="noopener noreferrer">
                <OpenInNew size={14} aria-hidden />
                {app.label}
              </a>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {hasCoords ? (
        <Dialog open={mapOpen} onOpenChange={setMapOpen}>
          <DialogContent className="max-w-3xl gap-3 p-3 sm:p-4">
            <DialogTitle className="pe-8 text-sm">{target.label}</DialogTitle>
            {mapOpen ? (
              <BaitlyPropertyMap
                properties={[{ lat: target.lat as number, lng: target.lng as number, name: target.label, type: 'property' }]}
                center={[target.lng as number, target.lat as number]}
                zoom={15}
                height={420}
              />
            ) : null}
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}
