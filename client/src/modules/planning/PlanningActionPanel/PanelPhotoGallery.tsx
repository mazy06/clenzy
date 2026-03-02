import React, { useState } from 'react';
import {
  Box,
  Typography,
  Dialog,
  IconButton,
  Chip,
} from '@mui/material';
import {
  Close,
  ChevronLeft,
  ChevronRight,
  PhotoLibrary,
} from '@mui/icons-material';

interface PanelPhotoGalleryProps {
  photos: string[];
  label: string;
  maxVisible?: number;
}

const PanelPhotoGallery: React.FC<PanelPhotoGalleryProps> = ({
  photos,
  label,
  maxVisible = 4,
}) => {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  if (photos.length === 0) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, py: 1 }}>
        <PhotoLibrary sx={{ fontSize: 14, color: 'text.disabled' }} />
        <Typography sx={{ fontSize: '0.6875rem', color: 'text.secondary', fontStyle: 'italic' }}>
          Aucune photo — {label}
        </Typography>
      </Box>
    );
  }

  const visible = photos.slice(0, maxVisible);
  const extra = photos.length - maxVisible;

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.75 }}>
        <PhotoLibrary sx={{ fontSize: 14, color: 'primary.main' }} />
        <Typography sx={{ fontSize: '0.6875rem', fontWeight: 600 }}>
          {label}
        </Typography>
        <Chip label={photos.length} size="small" sx={{ fontSize: '0.5625rem', height: 18, ml: 'auto' }} />
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 0.5,
          mb: 1,
        }}
      >
        {visible.map((url, i) => (
          <Box
            key={i}
            onClick={() => { setLightboxIndex(i); setLightboxOpen(true); }}
            sx={{
              position: 'relative',
              width: '100%',
              paddingTop: '75%',
              borderRadius: 1,
              overflow: 'hidden',
              cursor: 'pointer',
              border: '1px solid',
              borderColor: 'divider',
              '&:hover': { opacity: 0.85 },
            }}
          >
            <Box
              component="img"
              src={url}
              alt={`${label} ${i + 1}`}
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
            {/* "+N" overlay on last visible */}
            {i === maxVisible - 1 && extra > 0 && (
              <Box
                sx={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'rgba(0,0,0,0.5)',
                }}
              >
                <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '1rem' }}>
                  +{extra}
                </Typography>
              </Box>
            )}
          </Box>
        ))}
      </Box>

      {/* Lightbox dialog */}
      <Dialog
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        maxWidth={false}
        PaperProps={{
          sx: {
            backgroundColor: 'rgba(0,0,0,0.95)',
            maxWidth: '90vw',
            maxHeight: '90vh',
            p: 0,
            overflow: 'hidden',
          },
        }}
      >
        <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 400, minHeight: 300 }}>
          <IconButton
            onClick={() => setLightboxOpen(false)}
            sx={{ position: 'absolute', top: 8, right: 8, color: '#fff', zIndex: 2 }}
          >
            <Close />
          </IconButton>

          {photos.length > 1 && (
            <>
              <IconButton
                onClick={() => setLightboxIndex((p) => (p > 0 ? p - 1 : photos.length - 1))}
                sx={{ position: 'absolute', left: 8, color: '#fff', zIndex: 2 }}
              >
                <ChevronLeft />
              </IconButton>
              <IconButton
                onClick={() => setLightboxIndex((p) => (p < photos.length - 1 ? p + 1 : 0))}
                sx={{ position: 'absolute', right: 8, color: '#fff', zIndex: 2 }}
              >
                <ChevronRight />
              </IconButton>
            </>
          )}

          <Box
            component="img"
            src={photos[lightboxIndex]}
            alt={`${label} ${lightboxIndex + 1}`}
            sx={{ maxWidth: '85vw', maxHeight: '85vh', objectFit: 'contain' }}
          />

          <Typography sx={{ position: 'absolute', bottom: 12, color: '#fff', fontSize: '0.75rem' }}>
            {lightboxIndex + 1} / {photos.length}
          </Typography>
        </Box>
      </Dialog>
    </>
  );
};

export default PanelPhotoGallery;
