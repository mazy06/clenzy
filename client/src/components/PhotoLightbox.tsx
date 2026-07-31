import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, IconButton } from '@mui/material';
import {
  Close as CloseIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
} from '../icons';

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
      <div className="absolute top-[0px] start-[0px] end-[0px] flex justify-between items-center p-3 z-[10]">
        <p className="cn-text-body1 text-[white] font-semibold">
          {currentIndex + 1} / {photos.length}
        </p>
        <IconButton onClick={onClose} sx={{ color: 'white' }}>
          <CloseIcon size={24} strokeWidth={1.75} />
        </IconButton>
      </div>

      {/* Image principale */}
      <div className="flex items-center justify-center w-full h-full px-12 py-12">
        <img
          src={photos[currentIndex]}
          alt={`Aperçu ${currentIndex + 1}`}
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
          }}
        />
      </div>

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
          <ChevronLeftIcon size={36} strokeWidth={1.75} />
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
          <ChevronRightIcon size={36} strokeWidth={1.75} />
        </IconButton>
      )}
    </Dialog>
  );
};

export default PhotoLightbox;
