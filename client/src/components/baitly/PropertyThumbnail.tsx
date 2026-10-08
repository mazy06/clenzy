import { useState } from 'react';
import { resolveMediaUrl } from '../../config/api';

/** Real property photography only; initials remain readable when no photo is available. */
export function PropertyThumbnail({ name, src }: { name: string; src?: string | null }) {
  const [failedSrc, setFailedSrc] = useState<string>();
  const url = src ? resolveMediaUrl(src) : undefined;
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => Array.from(part)[0]).join('');
  return <span className="bui-property-thumbnail" aria-hidden="true">
    {url && url !== failedSrc
      ? <img src={url} alt="" width={38} height={38} loading="lazy" decoding="async" onError={() => setFailedSrc(url)} />
      : initials}
  </span>;
}
