/* ============================================================
   NavigationResult — displayHint="navigation"

   Payload backend (suggest_navigation) : { path, label, reason }
   → carte cliquable qui route vers la page suggérée (react-router).
   ============================================================ */
import React from 'react';
import { Button } from '../../../../components/ui';
import { ArrowForward } from '../../../../icons';
import { SurfaceCard, Overline } from './shared';
import { useTranslation } from '../../../../hooks/useTranslation';

interface NavigationData {
  path?: string;
  label?: string;
  reason?: string;
}

export const NavigationResult: React.FC<{
  data: NavigationData;
  onNavigate?: (path: string) => void;
}> = ({ data, onNavigate }) => {
  const { t } = useTranslation();
  return (
  <SurfaceCard>
    <Overline className="mb-1">{t('supervision.agui.suggestedNavigation')}</Overline>
    <p className="text-sm font-semibold text-balance text-foreground">
      {data.label ?? t('supervision.agui.suggestedPage')}
    </p>
    {data.reason && (
      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{data.reason}</p>
    )}
    {data.path && onNavigate && (
      <div className="mt-2">
        <Button
          size="sm"
          variant="outline"
          className="cursor-pointer"
          onClick={() => onNavigate(data.path as string)}
        >
          {data.label
            ? t('supervision.agui.openTarget', { label: data.label })
            : t('supervision.agui.goThere')}
          <ArrowForward size={15} strokeWidth={1.85} />
        </Button>
      </div>
    )}
  </SurfaceCard>
  );
};
