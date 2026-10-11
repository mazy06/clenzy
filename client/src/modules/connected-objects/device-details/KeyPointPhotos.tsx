import { useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Spinner } from '../../../components/ui';
import { AddPhotoAlternate, Close } from '../../../icons';
import { useNotification } from '../../../hooks/useNotification';
import { useTranslation } from '../../../hooks/useTranslation';
import { keyExchangeApi, type KeyExchangePointPhotoDto } from '../../../services/api/keyExchangeApi';
import { toApiMediaUrl } from '../../../utils/mediaUrl';

/** Doit rester aligné sur la limite serveur (KeyExchangePointPhotoRegistry). */
const MAX_PHOTOS = 6;

/**
 * Photos de l'emplacement exact d'un point de remise : ce que voient le voyageur
 * et l'intervenant dans la fiche de la carte pour trouver la boîte ou le comptoir.
 */
export default function KeyPointPhotos({ pointId, photos }: { pointId: number; photos: KeyExchangePointPhotoDto[] }) {
  const { t } = useTranslation();
  const { notify } = useNotification();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ['key-exchange-points'] });

  const upload = useMutation({
    mutationFn: (files: File[]) => keyExchangeApi.uploadPointPhotos(pointId, files),
    onSuccess: () => {
      notify.success(t('connectedObjects.keybox.photosUploaded'));
      void refresh();
    },
    onError: (e: unknown) => notify.error(e instanceof Error ? e.message : t('connectedObjects.keybox.photosFailed')),
  });

  const remove = useMutation({
    mutationFn: (photoId: number) => keyExchangeApi.deletePointPhoto(pointId, photoId),
    onSuccess: () => {
      notify.success(t('connectedObjects.keybox.photoRemoved'));
      void refresh();
    },
    onError: (e: unknown) => notify.error(e instanceof Error ? e.message : t('connectedObjects.keybox.photosFailed')),
  });

  const room = MAX_PHOTOS - photos.length;

  return (
    <Card className="gap-2 p-3 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h6 className="m-0 text-xs font-semibold">{t('connectedObjects.keybox.locationPhotos')}</h6>
          <p className="m-0 mt-0.5 text-2xs text-muted-foreground">{t('connectedObjects.keybox.locationPhotosHint')}</p>
        </div>
        <span className="shrink-0 text-2xs tabular-nums text-muted-foreground">
          {photos.length} / {MAX_PHOTOS}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {photos.map((photo) => (
          <div key={photo.id} className="group relative aspect-square overflow-hidden rounded-md border border-border bg-muted">
            <img src={toApiMediaUrl(photo.url)} alt="" className="size-full object-cover" loading="lazy" />
            <button
              type="button"
              aria-label={t('connectedObjects.keybox.removePhoto')}
              disabled={remove.isPending}
              onClick={() => remove.mutate(photo.id)}
              className="absolute end-1 top-1 grid size-6 cursor-pointer place-items-center rounded-full bg-card/90 text-foreground opacity-0 shadow-sm transition-opacity duration-150 group-hover:opacity-100 focus-visible:opacity-100"
            >
              <Close size={13} />
            </button>
          </div>
        ))}
        {room > 0 ? (
          <Button
            type="button"
            variant="outline"
            className="aspect-square h-auto cursor-pointer flex-col gap-1 border-dashed text-2xs text-muted-foreground"
            disabled={upload.isPending}
            onClick={() => inputRef.current?.click()}
          >
            {upload.isPending ? <Spinner className="size-4" /> : <AddPhotoAlternate size={18} />}
            {t('connectedObjects.keybox.addPhotos')}
          </Button>
        ) : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        className="hidden"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []).slice(0, room);
          event.target.value = '';
          if (files.length > 0) upload.mutate(files);
        }}
      />
    </Card>
  );
}
