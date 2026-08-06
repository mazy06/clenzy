import React, { useState, useCallback, useEffect } from 'react';
import { cn } from '../utils/cn';
import { Button, Dialog, DialogContent, DialogTitle } from './ui';
import { ChevronLeft, ChevronRight, Close, Fullscreen, ImageNotSupported } from '../icons';
import { API_CONFIG } from '../config/api';

type ResponsiveSize = number | string | { [key: string]: number | string };

/**
 * `width`, `height` et `sx` sont l'API PUBLIQUE de ce composant : PropertyDetails
 * et PanelPropertyDetails passent encore des objets de breakpoints MUI et un
 * `borderRadius` en jeton. Les deux helpers ci-dessous traduisent ce vocabulaire
 * sans que les appelants aient a changer — c'est la seule facon de sortir ce
 * fichier de MUI sans casser leur mise en page en silence.
 */

// Les seuils MUI (0 / 600 / 900 / 1200 px) sont ecrits en clair dans les classes
// `min-[…]` du conteneur : Tailwind emet ses classes en scannant les sources, il
// ne peut pas les lire depuis une constante.
type BreakpointKey = 'xs' | 'sm' | 'md' | 'lg';
const BREAKPOINT_ORDER: BreakpointKey[] = ['xs', 'sm', 'md', 'lg'];

/** Une longueur nue est en px, comme dans le systeme MUI. */
function toCssLength(value: number | string): string {
  return typeof value === 'number' ? `${value}px` : value;
}

/**
 * Etale une taille responsive sur les quatre paliers, chaque palier absent
 * heritant du precedent — c'est le comportement mobile-first de MUI.
 */
function resolveResponsive(value: ResponsiveSize): Record<BreakpointKey, string> {
  if (typeof value === 'number' || typeof value === 'string') {
    const unique = toCssLength(value);
    return { xs: unique, sm: unique, md: unique, lg: unique };
  }
  const out = {} as Record<BreakpointKey, string>;
  let courant = 'auto';
  BREAKPOINT_ORDER.forEach((bp) => {
    if (value[bp] !== undefined) courant = toCssLength(value[bp]);
    out[bp] = courant;
  });
  return out;
}

/**
 * `sx` residuel des appelants : proprietes CSS ordinaires, a une exception pres
 * — un `borderRadius` NUMERIQUE est un jeton de forme MUI, pas des pixels.
 */
function sxToStyle(sx?: React.CSSProperties): React.CSSProperties {
  if (!sx) return {};
  if (typeof sx.borderRadius !== 'number') return sx;
  return { ...sx, borderRadius: `${sx.borderRadius * 8}px` };
}

interface PropertyImageCarouselProps {
  /** URLs des photos de la propriete (relatives ou absolues). */
  photoUrls?: string[] | null;
  /** Largeur fixe (px) ou responsive (objet de breakpoints MUI). */
  width?: ResponsiveSize;
  /** Hauteur fixe (px) ou responsive (objet de breakpoints MUI). */
  height?: ResponsiveSize;
  alt?: string;
  /** Styles additionnels du conteneur (un `borderRadius` numerique = jeton MUI). */
  sx?: React.CSSProperties;
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

  // Les tailles sont des valeurs d'execution : aucune classe Tailwind ne peut en
  // naitre. Les classes restent litterales et lisent des custom properties, une
  // par palier — ce que l'objet de breakpoints MUI faisait via des media queries.
  const w = resolveResponsive(width);
  const h = resolveResponsive(height);

  return (
    <>
      <div
        className={cn(
          'group relative shrink-0 overflow-hidden bg-muted',
          'w-[var(--pic-w-xs)] min-[600px]:w-[var(--pic-w-sm)] min-[900px]:w-[var(--pic-w-md)] min-[1200px]:w-[var(--pic-w-lg)]',
          'h-[var(--pic-h-xs)] min-[600px]:h-[var(--pic-h-sm)] min-[900px]:h-[var(--pic-h-md)] min-[1200px]:h-[var(--pic-h-lg)]',
          canFullscreen ? 'cursor-zoom-in' : 'cursor-default',
        )}
        style={{
          '--pic-w-xs': w.xs, '--pic-w-sm': w.sm, '--pic-w-md': w.md, '--pic-w-lg': w.lg,
          '--pic-h-xs': h.xs, '--pic-h-sm': h.sm, '--pic-h-md': h.md, '--pic-h-lg': h.lg,
          ...sxToStyle(sx),
        } as React.CSSProperties}
        onClick={handleImageClick}
      >
        {showPlaceholder ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-0.5 bg-muted text-faint">
            <ImageNotSupported size={alwaysShowNav ? 48 : 24} strokeWidth={1.5} />
            {alwaysShowNav && (
              <p className="text-xs font-medium">
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
              // La pastille prend la surface de carte (et non un blanc fige) :
              // en sombre l'icone restait claire sur une pastille blanche.
              className={cn(
                'carousel-nav absolute top-1/2 p-0 rounded-full bg-card/90 text-foreground hover:bg-card hover:text-foreground',
                alwaysShowNav ? 'start-[8px] opacity-100' : 'start-[2px] opacity-0 group-hover:opacity-100',
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
                'carousel-nav absolute top-1/2 p-0 rounded-full bg-card/90 text-foreground hover:bg-card hover:text-foreground',
                alwaysShowNav ? 'end-[8px] opacity-100' : 'end-[2px] opacity-0 group-hover:opacity-100',
              )}
              style={{ width: navButtonSize, height: navButtonSize, transform: 'translateY(-50%)', transition: 'opacity 0.15s ease' }}
              onClick={next}
            >
              <ChevronRight size={navIconSize} strokeWidth={1.75} />
            </Button>
            <div className={cn('absolute start-[50%] flex pointer-events-none', alwaysShowNav ? 'bottom-[10px]' : 'bottom-[2px]', alwaysShowNav ? 'gap-[4.5px]' : 'gap-[1.5px]')} style={{ transform: 'translateX(-50%)' }}>
              {urls.map((url, i) => (
                <div className={cn('rounded-full border-[0.5px] border-solid border-black/25', alwaysShowNav ? 'w-[8px]' : 'w-[4px]', alwaysShowNav ? 'h-[8px]' : 'h-[4px]', i === index ? 'bg-white' : 'bg-white/55')} key={url} />
              ))}
            </div>
          </>
        )}

        {showCounter && hasMultiple && (
          <div className="absolute top-[8px] end-[8px] px-1.5 py-0.5 rounded-md bg-black/60 text-white text-2xs font-semibold tabular-nums pointer-events-none">
            {index + 1} / {urls.length}
          </div>
        )}

        {canFullscreen && (
          <div className={cn('carousel-fullscreen-hint absolute bottom-[8px] end-[8px] w-[32px] h-[32px] flex items-center justify-center rounded-md bg-black/55 text-white pointer-events-none group-hover:opacity-100', alwaysShowNav ? 'opacity-85' : 'opacity-0')} style={{ transition: 'opacity 0.15s ease' }}>
            <Fullscreen size={20} strokeWidth={1.75} />
          </div>
        )}
      </div>

      {canFullscreen && (
        <Dialog open={fullscreenOpen} onOpenChange={(next) => { if (!next) setFullscreenOpen(false); }}>
          {/* Plein ecran : on neutralise le centrage du gabarit DialogContent.
              `inset-0` et NON `top-0 start-0` — `start-*` est une propriete
              LOGIQUE que tailwind-merge ne met pas en conflit avec le `left-1/2`
              du gabarit, qui survivait donc et decalait la visionneuse d'une
              demi-largeur. On laisse aussi le `fixed` du gabarit s'appliquer
              (le `relative` d'origine sortait la boite du viewport) : il ancre
              tout aussi bien le bouton de fermeture en absolu. */}
          <DialogContent
            showCloseButton={false}
            className="inset-0 translate-x-0 translate-y-0 max-w-none rounded-none border-0 p-0 bg-black/95"
          >
            {/* Titre requis par le dialogue du kit pour l'accessibilite. */}
            <DialogTitle className="sr-only">{alt}</DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Fermer"
              onClick={() => setFullscreenOpen(false)}
              className="absolute top-[16px] end-[16px] z-[2] rounded-full bg-white/15 text-white hover:bg-white/30 hover:text-white"
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
                  className="absolute top-1/2 start-[24px] size-[56px] rounded-full bg-white/15 text-white hover:bg-white/30 hover:text-white"
                  style={{ transform: 'translateY(-50%)' }}
                >
                  <ChevronLeft size={36} strokeWidth={1.75} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-lg"
                  aria-label="Photo suivante"
                  onClick={next}
                  className="absolute top-1/2 end-[24px] size-[56px] rounded-full bg-white/15 text-white hover:bg-white/30 hover:text-white"
                  style={{ transform: 'translateY(-50%)' }}
                >
                  <ChevronRight size={36} strokeWidth={1.75} />
                </Button>
                <div className="absolute bottom-[24px] start-[50%] px-3 py-[4.5px] rounded-xl bg-black/60 text-white text-sm font-semibold tabular-nums" style={{ transform: 'translateX(-50%)' }}>
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
