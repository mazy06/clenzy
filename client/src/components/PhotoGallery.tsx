import React, { useState } from 'react';
import {
  Box,
  Typography,
  ImageList,
  ImageListItem,
  ImageListItemBar,
  IconButton,
  CircularProgress,
} from '@mui/material';
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
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          py: 4,
          color: 'text.secondary',
        }}
      >
        <Box component="span" sx={{ display: 'inline-flex', mb: 1, opacity: 0.5 }}><PhotoCameraIcon size={48} strokeWidth={1.5} /></Box>
        <Typography variant="body2" color="text.secondary">
          {emptyMessage}
        </Typography>
      </Box>
    );
  }

  // Déterminer les photos à afficher
  const hasOverflow = maxDisplay !== undefined && photos.length > maxDisplay;
  const displayPhotos = hasOverflow ? photos.slice(0, maxDisplay) : photos;
  const overflowCount = hasOverflow ? photos.length - maxDisplay! : 0;

  const canDelete = onDelete && photoIds && photoIds.length === photos.length;

  return (
    <Box>
      <ImageList cols={columns} gap={8} sx={{ width: '100%', height: 'auto' }}>
        {displayPhotos.map((photoUrl, index) => {
          const isLastWithOverflow = hasOverflow && index === displayPhotos.length - 1;
          const photoId = photoIds?.[index];
          const isDeleting = deletingPhotoId != null && photoId === deletingPhotoId;

          return (
            <ImageListItem
              key={`gallery-${photoId ?? index}`}
              sx={{
                cursor: 'pointer',
                overflow: 'hidden',
                borderRadius: 1,
                position: 'relative',
                '&:hover img': {
                  transform: 'scale(1.05)',
                },
                '&:hover .photo-actions': {
                  opacity: 1,
                },
                ...(isDeleting && { opacity: 0.5, pointerEvents: 'none' }),
              }}
              onClick={() => handlePhotoClick(index)}
            >
              <img
                src={photoUrl}
                alt={`Photo ${index + 1}`}
                loading="lazy"
                style={{
                  width: '100%',
                  height: 120,
                  objectFit: 'cover',
                  transition: 'transform 0.2s ease',
                }}
              />

              {/* Loading overlay when deleting */}
              {isDeleting && (
                <Box sx={{
                  position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  bgcolor: 'rgba(255,255,255,0.6)',
                }}>
                  <CircularProgress size={24} />
                </Box>
              )}

              {/* Overlay "+N more" sur la dernière photo */}
              {isLastWithOverflow && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: 0, left: 0, right: 0, bottom: 0,
                    bgcolor: 'rgba(0, 0, 0, 0.6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Typography variant="h6" sx={{ color: 'white', fontWeight: 700 }}>
                    +{overflowCount}
                  </Typography>
                </Box>
              )}

              {/* Action bar (delete + download) */}
              {!isLastWithOverflow && (canDelete || showDownload) && (
                <ImageListItemBar
                  className="photo-actions"
                  sx={{
                    background: 'linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0) 100%)',
                    opacity: 0,
                    transition: 'opacity 0.2s ease',
                  }}
                  position="top"
                  actionPosition="right"
                  actionIcon={
                    <Box sx={{ display: 'flex', gap: 0.25 }}>
                      {canDelete && photoId != null && (
                        <IconButton
                          size="small"
                          sx={{ color: 'white', '&:hover': { color: 'error.light' } }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onDelete(photoId);
                          }}
                        >
                          <DeleteIcon size={20} strokeWidth={1.75} />
                        </IconButton>
                      )}
                      {showDownload && (
                        <IconButton
                          size="small"
                          sx={{ color: 'white' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownload(photoUrl, index);
                          }}
                        >
                          <DownloadIcon size={20} strokeWidth={1.75} />
                        </IconButton>
                      )}
                    </Box>
                  }
                />
              )}
            </ImageListItem>
          );
        })}
      </ImageList>

      {/* Lightbox */}
      <PhotoLightbox
        open={lightboxOpen}
        photos={photos}
        initialIndex={lightboxIndex}
        onClose={() => setLightboxOpen(false)}
      />
    </Box>
  );
};

export default PhotoGallery;
