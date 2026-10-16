import { useId, useRef, useState } from 'react';
import { Home, LocationOn } from '../icons';
import { resolveMediaUrl } from '../config/api';
import { Field, FieldLabel, Skeleton } from './ui';
import { InputGroupAddon } from './ui/input-group';
import { Combobox, ComboboxInput, ComboboxContent, ComboboxEmpty, ComboboxItem, ComboboxList } from './ui/combobox';
import './baitlyVisualSelect.css';

export interface BaitlyPropertyOption { id: number; name: string; city?: string; coverPhotoUrl?: string; photoUrls?: string[] }
export const baitlyPropertyLabel = (property: BaitlyPropertyOption) =>
  [property.name, property.city?.trim()].filter(Boolean).join(' | ');

function PropertyPicture({ property }: { property: BaitlyPropertyOption | null }) {
  const src = resolveMediaUrl(property?.coverPhotoUrl || property?.photoUrls?.[0]);
  const [failedSource, setFailedSource] = useState<string | undefined>();
  return <span className="baitly-visual-select__picture" aria-hidden="true">
    {src && src !== failedSource ? <img src={src} alt="" decoding="async" onError={() => setFailedSource(src)} />
      : property ? <Home size={20} /> : <LocationOn size={20} />}
  </span>;
}

/** Le nom et la ville constituent aussi le texte recherché et annoncé au clavier. */
export default function BaitlyPropertySelect({ properties, value, onChange, label, allPlaces, empty, disabled, loading }: {
  properties: BaitlyPropertyOption[]; value: string; onChange: (value: string) => void;
  label: string; allPlaces: string; empty: string; disabled?: boolean; loading?: boolean;
}) {
  const id = useId();
  const anchor = useRef<HTMLDivElement>(null);
  const all = { id: 0, name: allPlaces };
  const items = [all, ...properties];
  const selected = properties.find(item => String(item.id) === value) ?? (value ? { id: Number(value), name: value } : all);
  return <Field className="baitly-visual-select">
    <div className="baitly-visual-select__label"><FieldLabel htmlFor={id}>{label}</FieldLabel></div>
    {loading ? <Skeleton className="h-14 w-full" /> : <Combobox items={items} value={selected} disabled={disabled}
      itemToStringLabel={baitlyPropertyLabel}
      isItemEqualToValue={(a, b) => a?.id === b?.id}
      onValueChange={(item: BaitlyPropertyOption | null) => { if (item) onChange(item.id ? String(item.id) : ''); }}>
      <div ref={anchor} className="baitly-visual-select__anchor"><ComboboxInput id={id} className="baitly-visual-select__control w-full" disabled={disabled}>
        <InputGroupAddon align="inline-start"><PropertyPicture property={selected.id ? selected : null} /></InputGroupAddon>
      </ComboboxInput></div>
      <ComboboxContent anchor={anchor} sideOffset={0} className="baitly-visual-select__popup">
        <ComboboxEmpty>{empty}</ComboboxEmpty>
        <ComboboxList>{(item: BaitlyPropertyOption) => <ComboboxItem key={item.id} value={item} className="baitly-visual-select__option cursor-pointer">
          <PropertyPicture property={item.id ? item : null} />
          <span className="baitly-visual-select__text">{item.name}{item.city?.trim() && <><span className="baitly-visual-select__pipe"> | </span><span className="baitly-visual-select__city">{item.city}</span></>}</span>
        </ComboboxItem>}</ComboboxList>
      </ComboboxContent>
    </Combobox>}
  </Field>;
}
