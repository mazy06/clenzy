/* ============================================================
   NavigationResult — displayHint="navigation"

   Payload backend (suggest_navigation) : { path, label, reason }
   → carte cliquable qui route vers la page suggérée (react-router).
   ============================================================ */
import React from 'react';
import { Button } from '../../../../components/ui';
import { ArrowForward } from '../../../../icons';
import { SurfaceCard, Overline } from './shared';

interface NavigationData {
  path?: string;
  label?: string;
  reason?: string;
}

export const NavigationResult: React.FC<{
  data: NavigationData;
  onNavigate?: (path: string) => void;
}> = ({ data, onNavigate }) => (
  <SurfaceCard>
    <Overline className="mb-1">Navigation suggérée</Overline>
    <p className="text-sm font-semibold text-balance text-foreground">
      {data.label ?? 'Page suggérée'}
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
          {data.label ? `Ouvrir ${data.label}` : 'Y aller'}
          <ArrowForward size={15} strokeWidth={1.85} />
        </Button>
      </div>
    )}
  </SurfaceCard>
);
