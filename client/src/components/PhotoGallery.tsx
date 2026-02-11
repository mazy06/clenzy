import React, { useState } from 'react';
import {
  Box,
  Typography,
  ImageList,
  ImageListItem,
  ImageListItemBar,
  IconButton,
} from '@mui/material';
import {
  PhotoCamera as PhotoCameraIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import PhotoLightbox from './PhotoLightbox';

// ============================================================
// PhotoGallery — Galerie de photos avec lightbox intégré
// ============================================================

export interface PhotoGalleryProps {
  photos: string[];
  columns?: number;
  maxDisplay?: number;
  emptyMessage?: string;
  showDownload?: boolean;
}

const PhotoGallery: React.FC<PhotoGalleryProps> = ({
  photos,
  columns = 3,
  maxDisplay,
  emptyMessage = 'Aucune photo disponible',
  showDownload = false,
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
        <PhotoCameraIcon sx={{ fontSize: 48, mb: 1, opacity: 0.5 }} />
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

  return (
    <Box>
      <ImageList cols={columns} gap={8} sx={{ width: '100%', height: 'auto' }}>
        {displayPhotos.map((photoUrl, index) => {
          const isLastWithOverflow = hasOverflow && index === displayPhotos.length - 1;

          return (
            <ImageListItem
              key={`gallery-${index}`}
              sx={{
                cursor: 'pointer',
                overflow: 'hidden',
                borderRadius: 1,
                position: 'relative',
                '&:hover img': {
                  transform: 'scale(1.05)',
                },
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

              {/* Overlay "+N more" sur la dernière photo */}
              {isLastWithOverflow && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    bgcolor: 'rgba(0, 0, 0, 0.6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Typography
                    variant="h6"
                    sx={{ color: 'white', fontWeight: 700 }}
                  >
                    +{overflowCount}
                  </Typography>
                </Box>
              )}

              {/* Bouton de téléchargement */}
              {showDownload && !isLastWithOverflow && (
                <ImageListItemBar
                  sx={{
                    background:
                      'linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0) 100%)',
                  }}
                  position="top"
                  actionPosition="right"
                  actionIcon={
                    <IconButton
                      size="small"
                      sx={{ color: 'white' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownload(photoUrl, index);
                      }}
                    >
                      <DownloadIcon fontSize="small" />
                    </IconButton>
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
