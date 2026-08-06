/* ============================================================
   ConstellationSkeleton — attente de la constellation

   Un squelette Baitly UI qui a la FORME de ce qui arrive : en-tête, anneau,
   file. L'ancien état montrait une sphère indigo pulsante sur un dégradé nuit
   — écrit en @emotion/styled avec ses couleurs en dur, dernier reste du
   registre MUI, et surtout sans rapport avec l'écran qu'il annonçait.
   ============================================================ */

import { Skeleton } from '../../../components/ui';
import { cn } from '../../../utils/cn';
import { useTranslation } from '../../../hooks/useTranslation';

export function ConstellationSkeleton({ flush }: { flush?: boolean } = {}) {
  const { t } = useTranslation();
  return (
    <div
      data-supervision-skeleton
      role="status"
      aria-live="polite"
      aria-busy
      aria-label={t('supervision.states.loading')}
      className={cn(
        'flex h-full min-h-[380px] flex-col gap-3 overflow-hidden bg-card p-3',
        !flush && 'rounded-2xl border border-solid border-border',
      )}
    >
      {/* En-tête : pastille d'état, identité, compteurs. */}
      <div className="flex shrink-0 items-center gap-2">
        <Skeleton className="size-2 rounded-full" />
        <Skeleton className="h-3.5 w-28 rounded" />
        <Skeleton className="h-3 w-40 rounded max-[520px]:hidden" />
        <Skeleton className="ms-auto h-7 w-7 rounded-lg" />
      </div>

      {/* L'anneau : le noyau, puis les satellites sur leur orbite. Le carré
          garde le rapport 1:1 du diagramme — au chargement l'écran ne bouge
          donc plus quand la constellation arrive. */}
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <div className="relative aspect-square h-full max-h-[460px]">
          <Skeleton className="absolute start-1/2 top-1/2 size-[70%] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-40" />
          <Skeleton className="absolute start-1/2 top-1/2 size-[15%] -translate-x-1/2 -translate-y-1/2 rounded-full" />
          {/* Six satellites suffisent à dire « un anneau » : au-delà, le
              squelette dessinerait plus que ce qu'il annonce. */}
          {[0, 60, 120, 180, 240, 300].map((angle) => {
            const rad = (angle * Math.PI) / 180;
            return (
              <Skeleton
                key={angle}
                className="absolute size-[13%] rounded-full"
                style={{
                  left: `${50 + 35 * Math.cos(rad)}%`,
                  top: `${50 + 35 * Math.sin(rad)}%`,
                  transform: 'translate(-50%, -50%)',
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Pied : le bilan de valeur. */}
      <div className="flex shrink-0 items-center gap-3">
        <Skeleton className="h-3 w-16 rounded" />
        <Skeleton className="h-3 w-24 rounded" />
        <Skeleton className="h-3 w-20 rounded max-[520px]:hidden" />
      </div>
    </div>
  );
}
