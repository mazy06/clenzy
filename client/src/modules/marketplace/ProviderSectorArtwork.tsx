import { PROVIDER_SECTOR_IMAGES } from './providerSectorImages';

/** Vignette décorative : le libellé adjacent porte déjà le nom du métier. */
export default function ProviderSectorArtwork({ code }: { code: string }) {
  return <img src={PROVIDER_SECTOR_IMAGES[code] ?? PROVIDER_SECTOR_IMAGES.OTHER}
    alt="" width={28} height={28} loading="lazy" decoding="async"
    className="size-7 shrink-0 object-contain" />;
}
