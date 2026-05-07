import React, { useState, useCallback } from 'react';
import { Box, IconButton } from '@mui/material';
import { ChevronLeft, ChevronRight } from '@mui/icons-material';
import { API_CONFIG } from '../config/api';
import defaultPropertyImg from '../assets/images/autres.png';

interface PropertyImageCarouselProps {
  /** URLs des photos de la propriete (relatives ou absolues). */
  photoUrls?: string[] | null;
  /** Largeur du carrousel. */
  width?: number | string;
  /** Hauteur du carrousel. '100%' pour s'adapter a la cellule parente. */
  height?: number | string;
  alt?: string;
}

function resolveUrl(url: string): string {
  if (url.startsWith('http') || url.startsWith('blob:') || url.startsWith('data:')) return url;
  return `${API_CONFIG.BASE_URL}${url}`;
}

export function PropertyImageCarousel({
  photoUrls,
  width = 80,
  height = '100%',
  alt = 'Photo de la propriete',
}: PropertyImageCarouselProps) {
  const urls = (photoUrls ?? []).filter(Boolean);
  const hasPhotos = urls.length > 0;
  const hasMultiple = urls.length > 1;

  const [index, setIndex] = useState(0);
  const [errored, setErrored] = useState<Record<number, boolean>>({});

  const next = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIndex((i) => (i + 1) % urls.length);
  }, [urls.length]);

  const prev = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIndex((i) => (i - 1 + urls.length) % urls.length);
  }, [urls.length]);

  const currentUrl = hasPhotos && !errored[index] ? resolveUrl(urls[index]) : null;

  return (
    <Box
      sx={{
        width,
        height,
        position: 'relative',
        flexShrink: 0,
        overflow: 'hidden',
        bgcolor: 'action.hover',
        '&:hover .carousel-nav': hasMultiple ? { opacity: 1 } : undefined,
      }}
    >
      <Box
        component="img"
        src={currentUrl ?? defaultPropertyImg}
        alt={alt}
        loading="lazy"
        onError={() => {
          if (hasPhotos) setErrored((prev) => ({ ...prev, [index]: true }));
        }}
        sx={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
        }}
      />

      {hasMultiple && (
        <>
          <IconButton
            size="small"
            className="carousel-nav"
            onClick={prev}
            sx={{
              position: 'absolute',
              top: '50%',
              left: 2,
              transform: 'translateY(-50%)',
              opacity: 0,
              transition: 'opacity 0.15s ease',
              bgcolor: 'rgba(255,255,255,0.85)',
              width: 20,
              height: 20,
              p: 0,
              '&:hover': { bgcolor: '#fff' },
            }}
          >
            <ChevronLeft sx={{ fontSize: 14 }} />
          </IconButton>
          <IconButton
            size="small"
            className="carousel-nav"
            onClick={next}
            sx={{
              position: 'absolute',
              top: '50%',
              right: 2,
              transform: 'translateY(-50%)',
              opacity: 0,
              transition: 'opacity 0.15s ease',
              bgcolor: 'rgba(255,255,255,0.85)',
              width: 20,
              height: 20,
              p: 0,
              '&:hover': { bgcolor: '#fff' },
            }}
          >
            <ChevronRight sx={{ fontSize: 14 }} />
          </IconButton>
          <Box
            sx={{
              position: 'absolute',
              bottom: 2,
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              gap: 0.25,
              pointerEvents: 'none',
            }}
          >
            {urls.map((_, i) => (
              <Box
                key={i}
                sx={{
                  width: 4,
                  height: 4,
                  borderRadius: '50%',
                  bgcolor: i === index ? '#fff' : 'rgba(255,255,255,0.55)',
                  border: '0.5px solid rgba(0,0,0,0.25)',
                }}
              />
            ))}
          </Box>
        </>
      )}
    </Box>
  );
}
