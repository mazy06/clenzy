import React, { useState } from 'react';
import { Button, Spinner } from './ui';
import { cn } from '../utils/cn';
import {
  PhotoCamera as PhotoCameraIcon,
  Download as DownloadIcon,
  Delete as DeleteIcon,
} from '../icons';
import PhotoLightbox from './PhotoLightbox';

// ============================================================
// PhotoGallery — Galerie de photos avec lightbox intégré
// ============================================================

export interface PhotoGalleryProps {
  photos: string[];
  /** Parallel array of photo database IDs (same order as photos) */
  photoIds?: number[];
  columns?: number;
  maxDisplay?: number;
  emptyMessage?: string;
  showDownload?: boolean;
  /** Called with the photo's database ID when user clicks delete */
  onDelete?: (photoId: number) => void;
  /** The photo ID currently being deleted (shows spinner) */
  deletingPhotoId?: number | null;
}

const PhotoGallery: React.FC<PhotoGalleryProps> = ({
  photos,
  photoIds,
  columns = 3,
  maxDisplay,
  emptyMessage = 'Aucune photo disponible',
  showDownload = false,
  onDelete,
  deletingPhotoId,
}) => {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Ouvrir le lightbox sur une photo
  const handlePhotoClick = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  // Télécharger une photo
  const handleDownload = (url: string, index: number) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `photo-${index + 1}`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // État vide
  if (photos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
        <span className="inline-flex mb-1.5 text-faint"><PhotoCameraIcon size={48} strokeWidth={1.5} /></span>
        <p className="text-xs text-muted-foreground">
          {emptyMessage}
        </p>
      </div>
    );
  }

  // Déterminer les photos à afficher
  const hasOverflow = maxDisplay !== undefined && photos.length > maxDisplay;
  const displayPhotos = hasOverflow ? photos.slice(0, maxDisplay) : photos;
  const overflowCount = hasOverflow ? photos.length - maxDisplay! : 0;

  const canDelete = onDelete && photoIds && photoIds.length === photos.length;

  return (
    <div>
      {/* Le nombre de colonnes vient des props : valeur d'execution, donc un
          style inline — Tailwind n'emet ses classes qu'a la compilation. */}
      <div
        className="grid w-full gap-2"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {displayPhotos.map((photoUrl, index) => {
          const isLastWithOverflow = hasOverflow && index === displayPhotos.length - 1;
          const photoId = photoIds?.[index];
          const isDeleting = deletingPhotoId != null && photoId === deletingPhotoId;

          return (
            <div
              key={`gallery-${photoId ?? index}`}
              className={cn(
                'group relative cursor-pointer overflow-hidden rounded-md',
                isDeleting && 'opacity-50 pointer-events-none',
              )}
              onClick={() => handlePhotoClick(index)}
            >
              {/* Le survol se dit par l'opacite : un `scale()` deplacerait la mise
                  en page et la campagne l'interdit. */}
              <img
                src={photoUrl}
                alt={`Aperçu ${index + 1}`}
                loading="lazy"
                className="h-[120px] w-full object-cover transition-opacity duration-200 ease-out group-hover:opacity-90"
              />

              {/* Loading overlay when deleting */}
              {isDeleting && (
                <div className="absolute inset-0 flex items-center justify-center bg-card/60">
                  <Spinner className="size-6" />
                </div>
              )}

              {/* Overlay "+N more" sur la dernière photo */}
              {isLastWithOverflow && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                  <span className="text-sm font-semibold tabular-nums text-white">
                    +{overflowCount}
                  </span>
                </div>
              )}

              {/* Action bar (delete + download) */}
              {!isLastWithOverflow && (canDelete || showDownload) && (
                <div className="absolute inset-x-0 top-0 z-[3] flex justify-end gap-0.5 bg-gradient-to-b from-black/50 to-transparent p-1 opacity-0 transition-opacity duration-200 ease-out group-hover:opacity-100">
                  {canDelete && photoId != null && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Supprimer la photo ${index + 1}`}
                      className="text-white hover:bg-white/15 hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(photoId);
                      }}
                    >
                      <DeleteIcon size={20} strokeWidth={1.75} />
                    </Button>
                  )}
                  {showDownload && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Télécharger la photo ${index + 1}`}
                      className="text-white hover:bg-white/15 hover:text-white"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownload(photoUrl, index);
                      }}
                    >
                      <DownloadIcon size={20} strokeWidth={1.75} />
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Lightbox */}
      <PhotoLightbox
        open={lightboxOpen}
        photos={photos}
        initialIndex={lightboxIndex}
        onClose={() => setLightboxOpen(false)}
      />
    </div>
  );
};

export default PhotoGallery;
