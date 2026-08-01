import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogTitle, Button } from './ui';
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
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      {/* Plein ecran : la peau du primitif (largeur bornee, rayon, anneau,
          padding) est entierement neutralisee ici. */}
      <DialogContent
        className="max-w-none w-screen h-screen rounded-none p-0 ring-0 bg-[rgba(0,0,0,0.95)] block"
        showCloseButton={false}
      >
        {/* Barre supérieure : compteur + bouton fermer. Le compteur porte le
            DialogTitle : le primitif exige un titre accessible, et c'est la
            seule etiquette que la visionneuse possede. */}
        <div className="absolute top-[0px] start-[0px] end-[0px] flex justify-between items-center p-3 z-[10]">
          <DialogTitle className="cn-text-body1 text-[white] font-semibold">
            {currentIndex + 1} / {photos.length}
          </DialogTitle>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Fermer"
            onClick={onClose}
            className="text-[#FFFFFF] hover:bg-[rgba(255,255,255,0.2)] hover:text-[#FFFFFF]"
          >
            <CloseIcon size={24} strokeWidth={1.75} />
          </Button>
        </div>

        {/* Image principale */}
        <div className="flex items-center justify-center w-full h-full px-12 py-12">
          <img
            src={photos[currentIndex]}
            alt={`Aperçu ${currentIndex + 1}`}
            className="max-w-full max-h-full object-contain"
          />
        </div>

        {/* Flèche gauche */}
        {photos.length > 1 && (
          <Button
            variant="ghost"
            size="icon-lg"
            aria-label="Photo précédente"
            onClick={handlePrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-[#FFFFFF] bg-[rgba(255,255,255,0.1)] hover:bg-[rgba(255,255,255,0.2)] hover:text-[#FFFFFF]"
          >
            <ChevronLeftIcon size={36} strokeWidth={1.75} />
          </Button>
        )}

        {/* Flèche droite */}
        {photos.length > 1 && (
          <Button
            variant="ghost"
            size="icon-lg"
            aria-label="Photo suivante"
            onClick={handleNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-[#FFFFFF] bg-[rgba(255,255,255,0.1)] hover:bg-[rgba(255,255,255,0.2)] hover:text-[#FFFFFF]"
          >
            <ChevronRightIcon size={36} strokeWidth={1.75} />
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PhotoLightbox;
