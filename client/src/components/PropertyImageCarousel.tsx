import React, { useState, useCallback, useEffect } from 'react';
import { Box, IconButton, Dialog } from '@mui/material';
import type { SxProps, Theme } from '@mui/material';
import { ChevronLeft, ChevronRight, Close, Fullscreen, ImageNotSupported } from '../icons';
import { API_CONFIG } from '../config/api';

type ResponsiveSize = number | string | { [key: string]: number | string };

interface PropertyImageCarouselProps {
  /** URLs des photos de la propriete (relatives ou absolues). */
  photoUrls?: string[] | null;
  /** Largeur fixe (px) ou responsive (objet de breakpoints MUI). */
  width?: ResponsiveSize;
  /** Hauteur fixe (px) ou responsive (objet de breakpoints MUI). */
  height?: ResponsiveSize;
  alt?: string;
  sx?: SxProps<Theme>;
  /** Affiche les controles nav en permanence (sinon visibles uniquement au hover). */
  alwaysShowNav?: boolean;
  /** Active l'ouverture en plein ecran au clic sur l'image. */
  enableFullscreen?: boolean;
  /** Affiche un compteur "n / total" en bas a droite. */
  showCounter?: boolean;
}

function resolveUrl(url: string): string {
  if (url.startsWith('http') || url.startsWith('blob:') || url.startsWith('data:')) return url;
  return `${API_CONFIG.BASE_URL}${url}`;
}

export function PropertyImageCarousel({
  photoUrls,
  width = { xs: 72, sm: 88, md: 104 },
  height = { xs: 56, sm: 64, md: 72 },
  alt = 'Photo de la propriete',
  sx,
  alwaysShowNav = false,
  enableFullscreen = false,
  showCounter = false,
}: PropertyImageCarouselProps) {
  const urls = (photoUrls ?? []).filter(Boolean);
  const hasPhotos = urls.length > 0;
  const hasMultiple = urls.length > 1;

  const [index, setIndex] = useState(0);
  const [errored, setErrored] = useState<Record<number, boolean>>({});
  const [fullscreenOpen, setFullscreenOpen] = useState(false);

  const next = useCallback((e?: React.MouseEvent | KeyboardEvent) => {
    if (e && 'stopPropagation' in e) e.stopPropagation();
    setIndex((i) => (i + 1) % urls.length);
  }, [urls.length]);

  const prev = useCallback((e?: React.MouseEvent | KeyboardEvent) => {
    if (e && 'stopPropagation' in e) e.stopPropagation();
    setIndex((i) => (i - 1 + urls.length) % urls.length);
  }, [urls.length]);

  useEffect(() => {
    if (!fullscreenOpen || !hasMultiple) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreenOpen, hasMultiple, next, prev]);

  const currentUrl = hasPhotos && !errored[index] ? resolveUrl(urls[index]) : null;
  const showPlaceholder = currentUrl === null;
  const canFullscreen = enableFullscreen && hasPhotos && !showPlaceholder;

  const handleImageClick = useCallback(() => {
    if (canFullscreen) setFullscreenOpen(true);
  }, [canFullscreen]);

  const navButtonSize = alwaysShowNav ? 36 : 20;
  const navIconSize = alwaysShowNav ? 22 : 14;

  return (
    <>
      <Box
        sx={[
          {
            width,
            height,
            position: 'relative',
            flexShrink: 0,
            overflow: 'hidden',
            bgcolor: 'action.hover',
            cursor: canFullscreen ? 'zoom-in' : 'default',
            '&:hover .carousel-nav': hasMultiple && !alwaysShowNav ? { opacity: 1 } : undefined,
            '&:hover .carousel-fullscreen-hint': canFullscreen ? { opacity: 1 } : undefined,
          },
          ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
        ]}
        onClick={handleImageClick}
      >
        {showPlaceholder ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-0.5 bg-[grey.100] text-muted-foreground opacity-60">
            <ImageNotSupported size={alwaysShowNav ? 48 : 24} strokeWidth={1.5} />
            {alwaysShowNav && (
              <p className="cn-text-body1 text-[0.75rem] font-medium">
                Aucune photo
              </p>
            )}
          </div>
        ) : (
          <img className="w-full h-full object-cover block" src={currentUrl as string} alt={alt} loading="lazy" onError={() => {
              setErrored((prev) => ({ ...prev, [index]: true }));
            }} />
        )}

        {hasMultiple && (
          <>
            <IconButton
              size="small"
              className="carousel-nav"
              onClick={prev}
              sx={{
                position: 'absolute',
                top: '50%',
                left: alwaysShowNav ? 8 : 2,
                transform: 'translateY(-50%)',
                opacity: alwaysShowNav ? 1 : 0,
                transition: 'opacity 0.15s ease',
                bgcolor: 'rgba(255,255,255,0.9)',
                width: navButtonSize,
                height: navButtonSize,
                p: 0,
                '&:hover': { bgcolor: '#fff' },
              }}
            >
              <ChevronLeft size={navIconSize} strokeWidth={1.75} />
            </IconButton>
            <IconButton
              size="small"
              className="carousel-nav"
              onClick={next}
              sx={{
                position: 'absolute',
                top: '50%',
                right: alwaysShowNav ? 8 : 2,
                transform: 'translateY(-50%)',
                opacity: alwaysShowNav ? 1 : 0,
                transition: 'opacity 0.15s ease',
                bgcolor: 'rgba(255,255,255,0.9)',
                width: navButtonSize,
                height: navButtonSize,
                p: 0,
                '&:hover': { bgcolor: '#fff' },
              }}
            >
              <ChevronRight size={navIconSize} strokeWidth={1.75} />
            </IconButton>
            <Box
              sx={{
                position: 'absolute',
                bottom: alwaysShowNav ? 10 : 2,
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                gap: alwaysShowNav ? 0.75 : 0.25,
                pointerEvents: 'none',
              }}
            >
              {urls.map((url, i) => (
                <Box
                  key={url}
                  sx={{
                    width: alwaysShowNav ? 8 : 4,
                    height: alwaysShowNav ? 8 : 4,
                    borderRadius: '50%',
                    bgcolor: i === index ? '#fff' : 'rgba(255,255,255,0.55)',
                    border: '0.5px solid rgba(0,0,0,0.25)',
                  }}
                />
              ))}
            </Box>
          </>
        )}

        {showCounter && hasMultiple && (
          <div className="absolute top-[8px] end-[8px] px-1.5 py-0.5 rounded-[1px] bg-[rgba(0,0,0,0.6)] text-[#fff] text-[0.7rem] font-semibold pointer-events-none">
            {index + 1} / {urls.length}
          </div>
        )}

        {canFullscreen && (
          <Box
            className="carousel-fullscreen-hint"
            sx={{
              position: 'absolute',
              bottom: 8,
              right: 8,
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 1,
              bgcolor: 'rgba(0,0,0,0.55)',
              color: '#fff',
              opacity: alwaysShowNav ? 0.85 : 0,
              transition: 'opacity 0.15s ease',
              pointerEvents: 'none',
            }}
          >
            <Fullscreen size={20} strokeWidth={1.75} />
          </Box>
        )}
      </Box>

      {canFullscreen && (
        <Dialog
          open={fullscreenOpen}
          onClose={() => setFullscreenOpen(false)}
          fullScreen
          PaperProps={{
            sx: { bgcolor: 'rgba(0,0,0,0.95)', position: 'relative' },
          }}
        >
          <IconButton
            onClick={() => setFullscreenOpen(false)}
            sx={{
              position: 'absolute',
              top: 16,
              right: 16,
              zIndex: 2,
              bgcolor: 'rgba(255,255,255,0.15)',
              color: '#fff',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' },
            }}
          >
            <Close size={24} strokeWidth={1.75} />
          </IconButton>

          <div className="w-full h-full flex items-center justify-center relative" onClick={(e) => {
              if (e.target === e.currentTarget) setFullscreenOpen(false);
            }}>
            <img className="max-w-full max-h-[100%] object-contain block" src={currentUrl ?? undefined} alt={alt} />

            {hasMultiple && (
              <>
                <IconButton
                  onClick={prev}
                  sx={{
                    position: 'absolute',
                    top: '50%',
                    left: 24,
                    transform: 'translateY(-50%)',
                    bgcolor: 'rgba(255,255,255,0.15)',
                    color: '#fff',
                    width: 56,
                    height: 56,
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' },
                  }}
                >
                  <ChevronLeft size={36} strokeWidth={1.75} />
                </IconButton>
                <IconButton
                  onClick={next}
                  sx={{
                    position: 'absolute',
                    top: '50%',
                    right: 24,
                    transform: 'translateY(-50%)',
                    bgcolor: 'rgba(255,255,255,0.15)',
                    color: '#fff',
                    width: 56,
                    height: 56,
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' },
                  }}
                >
                  <ChevronRight size={36} strokeWidth={1.75} />
                </IconButton>
                <Box
                  sx={{
                    position: 'absolute',
                    bottom: 24,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    px: 2,
                    py: 0.75,
                    borderRadius: 2,
                    bgcolor: 'rgba(0,0,0,0.6)',
                    color: '#fff',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                  }}
                >
                  {index + 1} / {urls.length}
                </Box>
              </>
            )}
          </div>
        </Dialog>
      )}
    </>
  );
}
