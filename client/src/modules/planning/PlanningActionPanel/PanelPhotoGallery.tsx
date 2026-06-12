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
} from '../../../icons';

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
        <Box component="span" sx={{ display: 'inline-flex', color: 'var(--faint)' }}><PhotoLibrary size={14} strokeWidth={1.75} /></Box>
        <Typography sx={{ fontSize: '0.6875rem', color: 'var(--muted)', fontStyle: 'italic' }}>
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
        <Box component="span" sx={{ display: 'inline-flex', color: 'var(--accent)' }}><PhotoLibrary size={14} strokeWidth={1.75} /></Box>
        <Typography sx={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--ink)' }}>
          {label}
        </Typography>
        <Chip
          label={photos.length}
          size="small"
          sx={{ height: 18, ml: 'auto', backgroundColor: 'var(--field)', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums', '& .MuiChip-label': { px: 0.75 } }}
        />
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
              borderRadius: '10px',
              overflow: 'hidden',
              cursor: 'pointer',
              border: '1px solid var(--line)',
              transition: 'opacity .15s, border-color .15s',
              '&:hover': { opacity: 0.85, borderColor: 'var(--line-2)' },
              '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
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
                  backgroundColor: 'rgba(21,36,45,.55)',
                }}
              >
                <Typography sx={{ color: 'var(--on-accent)', fontWeight: 600, fontSize: '1rem', fontFamily: 'var(--font-display)', fontVariantNumeric: 'tabular-nums' }}>
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
            backgroundColor: 'rgba(21,36,45,.96)',
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
            aria-label="Fermer"
            sx={{ position: 'absolute', top: 8, right: 8, color: 'var(--on-accent)', zIndex: 2, '&:hover': { backgroundColor: 'rgba(255,255,255,.12)' } }}
          >
            <Close />
          </IconButton>

          {photos.length > 1 && (
            <>
              <IconButton
                onClick={() => setLightboxIndex((p) => (p > 0 ? p - 1 : photos.length - 1))}
                aria-label="Photo precedente"
                sx={{ position: 'absolute', left: 8, color: 'var(--on-accent)', zIndex: 2, '&:hover': { backgroundColor: 'rgba(255,255,255,.12)' } }}
              >
                <ChevronLeft />
              </IconButton>
              <IconButton
                onClick={() => setLightboxIndex((p) => (p < photos.length - 1 ? p + 1 : 0))}
                aria-label="Photo suivante"
                sx={{ position: 'absolute', right: 8, color: 'var(--on-accent)', zIndex: 2, '&:hover': { backgroundColor: 'rgba(255,255,255,.12)' } }}
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

          <Typography sx={{ position: 'absolute', bottom: 12, color: 'var(--on-accent)', fontSize: '0.75rem', fontVariantNumeric: 'tabular-nums' }}>
            {lightboxIndex + 1} / {photos.length}
          </Typography>
        </Box>
      </Dialog>
    </>
  );
};

export default PanelPhotoGallery;
