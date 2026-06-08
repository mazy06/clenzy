import React, { useMemo, useRef, useState } from 'react';
import { Box, Skeleton, useMediaQuery } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, ImageOff } from 'lucide-react';
import { propertyPhotosApi } from '../../services/api/propertyPhotosApi';
import { themeAccent } from './welcomeBookThemes';

interface GuidePhotoCarouselProps {
  /** Logement dont on affiche les photos. `null` → placeholder. */
  propertyId: number | null | undefined;
  /** Thème du livret : teinte le placeholder quand aucune photo. */
  theme?: string;
  /** Texte alternatif de base (ex: nom du logement). */
  alt?: string;
  /** Ids à afficher en premier (ex: photos de couverture du livret). */
  priorityIds?: number[];
  /** Rayon d'arrondi (clé spacing MUI ou valeur CSS). Défaut 14px. */
  radius?: number | string;
}

/**
 * Mini-carrousel des photos d'un logement, pensé pour les cartes de liste.
 * - Source unique : {@link propertyPhotosApi} (cache React Query par logement →
 *   un seul fetch même si plusieurs livrets partagent le même logement).
 * - Navigation : flèches au survol (desktop), swipe tactile, points indicateurs.
 * - Dégradé teinté par le thème en l'absence de photo, skeleton au chargement.
 * - Respecte {@code prefers-reduced-motion} (crossfade désactivé).
 */
export default function GuidePhotoCarousel({
  propertyId,
  theme,
  alt = '',
  priorityIds = [],
  radius = '14px',
}: GuidePhotoCarouselProps) {
  const accent = themeAccent(theme);
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

  const { data: photos = [], isLoading } = useQuery({
    queryKey: ['property-photos', propertyId],
    queryFn: () => propertyPhotosApi.list(propertyId as number),
    enabled: propertyId != null,
    staleTime: 5 * 60_000,
  });

  // Ordre : photos de couverture du livret d'abord, puis le reste par sortOrder.
  const slides = useMemo(() => {
    if (!photos.length || propertyId == null) return [] as { id: number; url: string }[];
    const prio = priorityIds.filter((id) => photos.some((p) => p.id === id));
    const rest = photos
      .filter((p) => !prio.includes(p.id))
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((p) => p.id);
    return [...prio, ...rest].map((id) => ({ id, url: propertyPhotosApi.getPhotoUrl(propertyId, id) }));
  }, [photos, priorityIds, propertyId]);

  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState<Set<number>>(new Set());
  const touchX = useRef<number | null>(null);

  const count = slides.length;
  const current = count ? ((index % count) + count) % count : 0;
  const go = (dir: number) => setIndex((i) => i + dir);

  const onTouchStart = (e: React.TouchEvent) => {
    touchX.current = e.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX.current == null) return;
    const delta = (e.changedTouches[0]?.clientX ?? touchX.current) - touchX.current;
    if (Math.abs(delta) > 40) go(delta < 0 ? 1 : -1);
    touchX.current = null;
  };

  const frame = {
    position: 'relative' as const,
    width: '100%',
    aspectRatio: '16 / 11',
    borderRadius: radius,
    overflow: 'hidden',
    bgcolor: 'action.hover',
    flexShrink: 0,
  };

  if (propertyId != null && isLoading) {
    return <Skeleton variant="rounded" sx={{ ...frame, borderRadius: radius }} animation="wave" />;
  }

  const allFailed = count > 0 && slides.every((s) => failed.has(s.id));
  if (!count || allFailed) {
    return (
      <Box
        sx={{
          ...frame,
          display: 'grid',
          placeItems: 'center',
          background: `linear-gradient(135deg, ${accent}22, ${accent}0d)`,
          color: accent,
        }}
        aria-label={alt || 'Aucune photo'}
        role="img"
      >
        <ImageOff size={22} strokeWidth={1.5} style={{ opacity: 0.65 }} />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        ...frame,
        '&:hover .gpc-nav, &:focus-within .gpc-nav': { opacity: 1 },
      }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {slides.map((s, i) => {
        if (failed.has(s.id)) return null;
        return (
          <Box
            key={s.id}
            component="img"
            src={s.url}
            alt={alt ? `${alt} — photo ${i + 1}` : `photo ${i + 1}`}
            loading="lazy"
            decoding="async"
            draggable={false}
            onError={() => setFailed((prev) => new Set(prev).add(s.id))}
            sx={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              opacity: i === current ? 1 : 0,
              transition: reduceMotion ? 'none' : 'opacity .45s ease',
              pointerEvents: 'none',
            }}
          />
        );
      })}

      {count > 1 && (
        <>
          <CarouselArrow side="left" onClick={() => go(-1)} />
          <CarouselArrow side="right" onClick={() => go(1)} />
          <Box
            sx={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 7,
              display: 'flex',
              justifyContent: 'center',
              gap: 0.5,
              pointerEvents: 'none',
            }}
          >
            {slides.map((s, i) => (
              <Box
                key={s.id}
                sx={{
                  width: i === current ? 14 : 5,
                  height: 5,
                  borderRadius: 5,
                  bgcolor: i === current ? 'common.white' : 'rgba(255,255,255,0.55)',
                  boxShadow: '0 0 2px rgba(0,0,0,0.4)',
                  transition: 'width .25s ease, background-color .25s ease',
                }}
              />
            ))}
          </Box>
        </>
      )}
    </Box>
  );
}

function CarouselArrow({ side, onClick }: { side: 'left' | 'right'; onClick: () => void }) {
  const Icon = side === 'left' ? ChevronLeft : ChevronRight;
  return (
    <Box
      className="gpc-nav"
      component="button"
      type="button"
      aria-label={side === 'left' ? 'Photo précédente' : 'Photo suivante'}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      sx={{
        position: 'absolute',
        top: '50%',
        [side]: 6,
        transform: 'translateY(-50%)',
        width: 28,
        height: 28,
        display: 'grid',
        placeItems: 'center',
        p: 0,
        border: 'none',
        borderRadius: '50%',
        color: 'common.white',
        bgcolor: 'rgba(20,20,25,0.45)',
        backdropFilter: 'blur(2px)',
        cursor: 'pointer',
        opacity: 0,
        transition: 'opacity .2s ease, background-color .2s ease',
        '&:hover': { bgcolor: 'rgba(20,20,25,0.7)' },
        '&:focus-visible': { opacity: 1, outline: '2px solid', outlineColor: 'common.white' },
      }}
    >
      <Icon size={16} strokeWidth={2} />
    </Box>
  );
}
