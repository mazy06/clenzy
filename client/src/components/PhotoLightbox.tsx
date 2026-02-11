import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  Box,
  IconButton,
  Typography,
} from '@mui/material';
import {
  Close as CloseIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
} from '@mui/icons-material';

// ============================================================
// PhotoLightbox — Visionneuse plein écran pour les photos
// ============================================================

export interface PhotoLightboxProps {
  open: boolean;
  photos: string[];
  initialIndex?: number;
  onClose: () => void;
}

const PhotoLightbox: React.FC<PhotoLightboxProps> = ({
  open,
  photos,
  initialIndex = 0,
  onClose,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  // Réinitialiser l'index quand le lightbox s'ouvre
  useEffect(() => {
    if (open) {
      setCurrentIndex(initialIndex);
    }
  }, [open, initialIndex]);

  // Navigation vers la photo précédente
  const handlePrev = useCallback(() => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : photos.length - 1));
  }, [photos.length]);

  // Navigation vers la photo suivante
  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev < photos.length - 1 ? prev + 1 : 0));
  }, [photos.length]);

  // Navigation clavier
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft':
          handlePrev();
          break;
        case 'ArrowRight':
          handleNext();
          break;
        case 'Escape':
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, handlePrev, handleNext, onClose]);

  if (photos.length === 0) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen
      PaperProps={{
        sx: {
          bgcolor: 'rgba(0, 0, 0, 0.95)',
        },
      }}
    >
      {/* Barre supérieure : compteur + bouton fermer */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          p: 2,
          zIndex: 10,
        }}
      >
        <Typography variant="body1" sx={{ color: 'white', fontWeight: 600 }}>
          {currentIndex + 1} / {photos.length}
        </Typography>
        <IconButton onClick={onClose} sx={{ color: 'white' }}>
          <CloseIcon />
        </IconButton>
      </Box>

      {/* Image principale */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          px: 8,
          py: 8,
        }}
      >
        <img
          src={photos[currentIndex]}
          alt={`Photo ${currentIndex + 1}`}
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
          }}
        />
      </Box>

      {/* Flèche gauche */}
      {photos.length > 1 && (
        <IconButton
          onClick={handlePrev}
          sx={{
            position: 'absolute',
            left: 16,
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'white',
            bgcolor: 'rgba(255, 255, 255, 0.1)',
            '&:hover': {
              bgcolor: 'rgba(255, 255, 255, 0.2)',
            },
          }}
        >
          <ChevronLeftIcon sx={{ fontSize: 36 }} />
        </IconButton>
      )}

      {/* Flèche droite */}
      {photos.length > 1 && (
        <IconButton
          onClick={handleNext}
          sx={{
            position: 'absolute',
            right: 16,
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'white',
            bgcolor: 'rgba(255, 255, 255, 0.1)',
            '&:hover': {
              bgcolor: 'rgba(255, 255, 255, 0.2)',
            },
          }}
        >
          <ChevronRightIcon sx={{ fontSize: 36 }} />
        </IconButton>
      )}
    </Dialog>
  );
};

export default PhotoLightbox;
