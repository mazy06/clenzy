import React, { useState, useCallback, useEffect } from 'react';
import { cn } from '../utils/cn';
// Box + SxProps restent MUI : `sx`, `width` et `height` sont l'API PUBLIQUE de ce
// composant (objets de breakpoints MUI + `borderRadius: 1.5` = jeton d'espacement),
// consommee par PropertyDetails et PanelPropertyDetails. Les traduire ici sans
// toucher aux appelants casserait leur mise en page en silence.
import { Box } from '@mui/material';
import type { SxProps, Theme } from '@mui/material';
import { Button, Dialog, DialogContent, DialogTitle } from './ui';
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
          <div className="w-full h-full flex flex-col items-center justify-center gap-0.5 bg-[var(--hover)] text-muted-foreground opacity-60">
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
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Photo précédente"
              className={cn(
                'carousel-nav absolute top-1/2 p-0 rounded-full bg-[rgba(255,255,255,0.9)] text-[var(--ink)] hover:bg-[#fff]',
                alwaysShowNav ? 'start-[8px] opacity-100' : 'start-[2px] opacity-0',
              )}
              // navButtonSize est une valeur runtime : aucune classe Tailwind ne peut en naitre.
              style={{ width: navButtonSize, height: navButtonSize, transform: 'translateY(-50%)', transition: 'opacity 0.15s ease' }}
              onClick={prev}
            >
              <ChevronLeft size={navIconSize} strokeWidth={1.75} />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Photo suivante"
              className={cn(
                'carousel-nav absolute top-1/2 p-0 rounded-full bg-[rgba(255,255,255,0.9)] text-[var(--ink)] hover:bg-[#fff]',
                alwaysShowNav ? 'end-[8px] opacity-100' : 'end-[2px] opacity-0',
              )}
              style={{ width: navButtonSize, height: navButtonSize, transform: 'translateY(-50%)', transition: 'opacity 0.15s ease' }}
              onClick={next}
            >
              <ChevronRight size={navIconSize} strokeWidth={1.75} />
            </Button>
            <div className={cn('absolute start-[50%] flex pointer-events-none', alwaysShowNav ? 'bottom-[10px]' : 'bottom-[2px]', alwaysShowNav ? 'gap-[4.5px]' : 'gap-[1.5px]')} style={{ transform: 'translateX(-50%)' }}>
              {urls.map((url, i) => (
                <div className={cn('rounded-[50%] border-[0.5px] border-solid border-[rgba(0,0,0,0.25)]', alwaysShowNav ? 'w-[8px]' : 'w-[4px]', alwaysShowNav ? 'h-[8px]' : 'h-[4px]', i === index ? 'bg-[#fff]' : 'bg-[rgba(255,255,255,0.55)]')} key={url} />
              ))}
            </div>
          </>
        )}

        {showCounter && hasMultiple && (
          <div className="absolute top-[8px] end-[8px] px-1.5 py-0.5 rounded-[1px] bg-[rgba(0,0,0,0.6)] text-[#fff] text-[0.7rem] font-semibold pointer-events-none">
            {index + 1} / {urls.length}
          </div>
        )}

        {canFullscreen && (
          <div className={cn('carousel-fullscreen-hint absolute bottom-[8px] end-[8px] w-[32px] h-[32px] flex items-center justify-center rounded-[8px] bg-[rgba(0,0,0,0.55)] text-[#fff] pointer-events-none', alwaysShowNav ? 'opacity-85' : 'opacity-0')} style={{ transition: 'opacity 0.15s ease' }}>
            <Fullscreen size={20} strokeWidth={1.75} />
          </div>
        )}
      </Box>

      {canFullscreen && (
        <Dialog open={fullscreenOpen} onOpenChange={(next) => { if (!next) setFullscreenOpen(false); }}>
          {/* fullScreen MUI : on neutralise le centrage/gabarit du DialogContent du kit. */}
          <DialogContent
            showCloseButton={false}
            className="relative top-0 start-0 translate-x-0 translate-y-0 w-screen h-screen max-w-none rounded-none border-0 p-0 bg-[rgba(0,0,0,0.95)]"
          >
            {/* Titre requis par le dialogue du kit pour l'accessibilite. */}
            <DialogTitle className="sr-only">{alt}</DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Fermer"
              onClick={() => setFullscreenOpen(false)}
              className="absolute top-[16px] end-[16px] z-[2] rounded-full bg-[rgba(255,255,255,0.15)] text-[#fff] hover:bg-[rgba(255,255,255,0.3)] hover:text-[#fff]"
            >
              <Close size={24} strokeWidth={1.75} />
            </Button>

            <div className="w-full h-full flex items-center justify-center relative" onClick={(e) => {
              if (e.target === e.currentTarget) setFullscreenOpen(false);
            }}>
            <img className="max-w-full max-h-[100%] object-contain block" src={currentUrl ?? undefined} alt={alt} />

            {hasMultiple && (
              <>
                <Button
                  variant="ghost"
                  size="icon-lg"
                  aria-label="Photo précédente"
                  onClick={prev}
                  className="absolute top-1/2 start-[24px] size-[56px] rounded-full bg-[rgba(255,255,255,0.15)] text-[#fff] hover:bg-[rgba(255,255,255,0.3)] hover:text-[#fff]"
                  style={{ transform: 'translateY(-50%)' }}
                >
                  <ChevronLeft size={36} strokeWidth={1.75} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-lg"
                  aria-label="Photo suivante"
                  onClick={next}
                  className="absolute top-1/2 end-[24px] size-[56px] rounded-full bg-[rgba(255,255,255,0.15)] text-[#fff] hover:bg-[rgba(255,255,255,0.3)] hover:text-[#fff]"
                  style={{ transform: 'translateY(-50%)' }}
                >
                  <ChevronRight size={36} strokeWidth={1.75} />
                </Button>
                <div className="absolute bottom-[24px] start-[50%] px-3 py-[4.5px] rounded-[16px] bg-[rgba(0,0,0,0.6)] text-[#fff] text-[0.875rem] font-semibold" style={{ transform: 'translateX(-50%)' }}>
                  {index + 1} / {urls.length}
                </div>
              </>
            )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
