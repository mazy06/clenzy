/* ============================================================
   NavigationResult — displayHint="navigation"

   Payload backend (suggest_navigation) : { path, label, reason }
   → carte cliquable qui route vers la page suggérée (react-router).
   ============================================================ */
import React from 'react';
import { Button } from '@mui/material';
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
    <Overline sx={{ mb: 0.5 }}>Navigation suggérée</Overline>
    <p className="cn-text-body1 text-[13.5px] font-semibold text-[var(--ink)]">
      {data.label ?? 'Page suggérée'}
    </p>
    {data.reason && (
      <p className="cn-text-body1 text-[12px] text-[var(--muted)] mt-0.5 leading-[1.5]">
        {data.reason}
      </p>
    )}
    {data.path && onNavigate && (
      <div className="mt-2">
        <Button
          size="small"
          variant="outlined"
          endIcon={<ArrowForward size={15} strokeWidth={1.85} />}
          onClick={() => onNavigate(data.path as string)}
          sx={{ textTransform: 'none', borderRadius: '8px', fontWeight: 600 }}
        >
          {data.label ? `Ouvrir ${data.label}` : 'Y aller'}
        </Button>
      </div>
    )}
  </SurfaceCard>
);
