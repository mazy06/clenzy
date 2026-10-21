import { useEffect, useId, useState } from 'react';
import type { Map } from 'maplibre-gl';
import { MapPin } from '../../icons/glyphs';
import { Button, Popover, PopoverContent, PopoverTrigger } from '../ui';
import { useTranslation } from '../../hooks/useTranslation';
import { DEFAULT_MAP_PLACES, MAP_PLACE_CATEGORIES, mapPlacesFilter, type MapPlaceCategory } from './baitlyMapPlaceCategories';
import { useMapPanelState } from './MapCardCoordinator';

/** Affichage temporaire des lieux utiles, conservé pendant les déplacements et changements de thème. */
const CATEGORY_IMAGES: Record<MapPlaceCategory, string> = {
  transport: 'train_station', groceries: 'supermarket', restaurants: 'restaurant', cafes: 'cafe',
  health: 'pharmacy', culture: 'museum', nature: 'park', services: 'post_office',
};

export default function BaitlyMapPlaces({ map, mode = 'light' }: { map: Map; mode?: 'light' | 'dark' }) {
  const { t } = useTranslation();
  const id = useId();
  const [selected, setSelected] = useState<MapPlaceCategory[]>(DEFAULT_MAP_PLACES);
  const [streetNames, setStreetNames] = useState(true);
  const [open, setOpen] = useMapPanelState();
  useEffect(() => {
    const apply = () => {
      for (const layer of ['pois', 'world-pois']) {
        if (map.getLayer(layer)) map.setFilter(layer, mapPlacesFilter(selected));
      }
      for (const prefix of ['', 'world-']) {
        for (const name of ['roads_labels_minor', 'roads_labels_major']) {
          const layer = `${prefix}${name}`;
          if (map.getLayer(layer)) map.setLayoutProperty(layer, 'visibility', streetNames ? 'visible' : 'none');
        }
      }
    };
    apply();
    map.on('style.load', apply);
    return () => { map.off('style.load', apply); };
  }, [map, selected, streetNames]);
  const label = t('baitlyMap.places.title', 'Lieux utiles');
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild>
      <button type="button" className="baitly-map-tool" aria-label={label} title={label} data-active={selected.length > 0 || undefined}>
        <MapPin size={18} aria-hidden />
      </button>
    </PopoverTrigger>
    <PopoverContent side="bottom" align="center" sideOffset={10} collisionPadding={12}
      className="w-80 max-w-[calc(100vw-24px)] overflow-y-auto p-3" style={{ maxHeight: 'min(580px, var(--radix-popover-content-available-height))' }} aria-labelledby={`${id}-title`}
      onCloseAutoFocus={event => event.preventDefault()}>
      <div className="flex items-baseline justify-between gap-2 pb-2">
        <h3 id={`${id}-title`} className="m-0 text-sm font-semibold">{label}</h3>
        <span className="text-xs tabular-nums text-muted-foreground">{selected.length}/{MAP_PLACE_CATEGORIES.length}</span>
      </div>
      <div className="flex flex-wrap gap-2 border-b border-border pb-3">
        <Button variant="outline" size="sm" onClick={() => setSelected(MAP_PLACE_CATEGORIES.map(c => c.id))}>
          {t('baitlyMap.places.showAll', 'Tout afficher')}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setSelected([])}>
          {t('baitlyMap.places.hideAll', 'Tout masquer')}
        </Button>
      </div>
      <fieldset className="m-0 border-0 p-0 py-1">
        <legend className="sr-only">{label}</legend>
        {MAP_PLACE_CATEGORIES.map(category => <label key={category.id}
          className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-md px-2 py-2 text-sm transition-colors duration-150 hover:bg-muted motion-reduce:transition-none">
          <span className="flex min-w-0 items-center gap-3">
            <img src={`/baitly/map-places/${mode}/${CATEGORY_IMAGES[category.id]}.svg`} alt="" aria-hidden className="size-6 shrink-0" />
            <span>{t(`baitlyMap.places.${category.id}`, category.label)}</span>
          </span>
          <input type="checkbox" checked={selected.includes(category.id)} className="size-4 shrink-0 cursor-pointer accent-[var(--bui-navy)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            onChange={event => setSelected(current => event.target.checked ? [...current, category.id] : current.filter(value => value !== category.id))} />
        </label>)}
      </fieldset>
      <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 border-t border-border px-2 py-3 text-sm">
        <span className="flex min-w-0 items-center gap-3">
          <img src={`/baitly/map-places/${mode}/street_names.svg`} alt="" aria-hidden className="size-6 shrink-0" />
          <span>{t('baitlyMap.places.streetNames', 'Noms des rues')}</span>
        </span>
        <input type="checkbox" checked={streetNames} onChange={event => setStreetNames(event.target.checked)}
          className="size-4 shrink-0 cursor-pointer accent-[var(--bui-navy)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" />
      </label>
      <p className="m-0 border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
        {t('baitlyMap.places.zoomHint', 'Zoomez pour voir les lieux détaillés. Leur présence dépend des données OpenStreetMap disponibles.')}
      </p>
    </PopoverContent>
  </Popover>;
}
