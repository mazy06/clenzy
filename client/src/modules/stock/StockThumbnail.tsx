import { useState } from 'react';
import { resolveItemVisual } from './itemVisual';
import './stock-catalog.css';

export interface StockVisual {
  name: string;
  catalogKey?: string | null;
  photoUrl?: string | null;
}

/** Photo personnelle, puis catalogue, puis emballage générique. Aucune URL distante. */
export function StockThumbnail({ name, catalogKey, photoUrl, size = 64 }: StockVisual & { size?: number }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const entry = resolveItemVisual(catalogKey, name);
  const image = entry?.image ?? { src: '/images/stock/consumables.webp', slot: 15 };
  const grid = image.grid ?? 4;
  const step = grid > 1 ? 100 / (grid - 1) : 0;
  const photo = photoUrl && /^data:image\/(jpeg|png|webp);base64,/.test(photoUrl) && photoUrl !== failedUrl ? photoUrl : null;
  return <span className="baitly-stock-thumbnail" aria-hidden="true" data-catalog-key={entry?.key ?? 'custom'}
    style={{ width: size, height: size, backgroundImage: `url(${image.src})`,
      backgroundSize: `${grid * 100}% ${grid * 100}%`,
      backgroundPosition: `${image.slot % grid * step}% ${Math.floor(image.slot / grid) * step}%` }}>
    {photo && <img src={photo} alt="" loading="lazy" decoding="async" onError={() => setFailedUrl(photo)} />}
  </span>;
}
