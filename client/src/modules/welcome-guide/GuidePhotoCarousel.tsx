import React, { useMemo, useRef, useState } from 'react';
import { cn } from '../../utils/cn';
import { Skeleton } from '../../components/ui';
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
  /** Rayon d'arrondi — valeur CSS (un nombre est lu en px). Défaut 14px. */
  radius?: number | string;
}

/** Pendant en classes de l'ancien objet `frame` (le rayon reste en style : prop). */
const FRAME_CLASS = 'relative w-full aspect-[16/11] overflow-hidden bg-[var(--hover)] shrink-0';

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
    const prioSet = new Set(prio);
    const rest = photos
      .filter((p) => !prioSet.has(p.id))
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

  if (propertyId != null && isLoading) {
    return <Skeleton className={FRAME_CLASS} style={{ borderRadius: radius }} />;
  }

  const allFailed = count > 0 && slides.every((s) => failed.has(s.id));
  if (!count || allFailed) {
    return (
      <div
        className={cn(FRAME_CLASS, 'grid place-items-center')}
        // Le degrade et la teinte derivent du theme du livret : valeurs d'execution.
        style={{
          borderRadius: radius,
          background: `linear-gradient(135deg, ${accent}22, ${accent}0d)`,
          color: accent,
        }}
        aria-label={alt || 'Aucune photo'}
        role="img"
      >
        <ImageOff size={22} strokeWidth={1.5} style={{ opacity: 0.65 }} />
      </div>
    );
  }

  return (
    <div
      className={cn(FRAME_CLASS, '[&:hover_.gpc-nav]:opacity-100 [&:focus-within_.gpc-nav]:opacity-100')}
      style={{ borderRadius: radius }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {slides.map((s, i) => {
        if (failed.has(s.id)) return null;
        return (
          <img
            key={s.id}
            src={s.url}
            alt={alt ? `${alt} — photo ${i + 1}` : `photo ${i + 1}`}
            loading="lazy"
            decoding="async"
            draggable={false}
            onError={() => setFailed((prev) => new Set(prev).add(s.id))}
            // Le crossfade passe en classe : `motion-reduce` remplace le
            // useMediaQuery MUI, sans re-render au changement de preference.
            className="absolute inset-0 w-full h-full object-cover pointer-events-none transition-opacity duration-[450ms] ease-[ease] motion-reduce:transition-none"
            style={{ opacity: i === current ? 1 : 0 }}
          />
        );
      })}

      {count > 1 && (
        <>
          <CarouselArrow side="left" onClick={() => go(-1)} />
          <CarouselArrow side="right" onClick={() => go(1)} />
          <div className="absolute start-[0px] end-[0px] bottom-[7px] flex justify-center gap-0.5 pointer-events-none">
            {slides.map((s, i) => (
              <div
                key={s.id}
                className={cn(
                  'h-[5px] rounded-[5px] shadow-[0_0_2px_rgba(0,0,0,0.4)]',
                  i === current ? 'w-[14px] bg-white' : 'w-[5px] bg-[rgba(255,255,255,0.55)]',
                )}
                style={{ transition: 'width .25s ease, background-color .25s ease' }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function CarouselArrow({ side, onClick }: { side: 'left' | 'right'; onClick: () => void }) {
  const Icon = side === 'left' ? ChevronLeft : ChevronRight;
  return (
    <button
      className={cn(
        // `gpc-nav` reste : le conteneur parent (Box) revele les fleches via
        // `&:hover .gpc-nav`.
        'gpc-nav absolute top-1/2 -translate-y-1/2 w-[28px] h-[28px] grid place-items-center',
        'p-0 border-none rounded-full text-white bg-[rgba(20,20,25,0.45)] backdrop-blur-[2px]',
        'cursor-pointer opacity-0 transition-[opacity,background-color] duration-200',
        'hover:bg-[rgba(20,20,25,0.7)]',
        'focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-white',
        side === 'left' ? 'left-[6px]' : 'right-[6px]',
      )}
      type="button"
      aria-label={side === 'left' ? 'Photo précédente' : 'Photo suivante'}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <Icon size={16} strokeWidth={2} />
    </button>
  );
}
