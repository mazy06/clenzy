import { useEffect, useState } from 'react';
import { resolveMediaUrl } from '../../config/api';
import { providerSectorImage } from './providerSectorImages';
import '../../components/catalog/baitlyDirectory.css';

/** Photo et illustration occupent la même boîte, y compris en cas d'erreur réseau. */
export default function ProviderMedia({ name, url, categoryCodes }: {
  name: string; url?: string | null; categoryCodes: string[];
}) {
  const src = resolveMediaUrl(url);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const photo = !!src && !failed;
  return <div className="baitly-provider-media" data-photo={photo}>
    <img src={photo ? src : providerSectorImage(categoryCodes)} alt={photo ? name : ''}
      loading="lazy" decoding="async" onError={photo ? () => setFailed(true) : undefined} />
  </div>;
}
