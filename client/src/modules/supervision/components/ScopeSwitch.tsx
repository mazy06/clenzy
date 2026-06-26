/* ============================================================
   <ScopeSwitch> — sélecteur de portée « Par logement / Vue d'ensemble »

   Placé au-dessus du planning. Bascule entre les deux échelles de
   supervision ; toute la grammaire visuelle reste identique.
   ============================================================ */

import type { ReactNode } from 'react';
import { Box } from '@mui/material';
import { HomeWork, CorporateFare } from '../../../icons';
import { useTranslation } from '../../../hooks/useTranslation';

export type SupervisionScope = 'property' | 'portfolio';

export function ScopeSwitch({ value, onChange }: { value: SupervisionScope; onChange: (scope: SupervisionScope) => void }) {
  const { t } = useTranslation();

  const option = (scope: SupervisionScope, icon: ReactNode, label: string) => {
    const active = value === scope;
    return (
      <Box
        component="button"
        type="button"
        onClick={() => onChange(scope)}
        aria-pressed={active}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
          px: 2,
          py: 1,
          borderRadius: '9px',
          border: 'none',
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: 700,
          background: active ? 'var(--card, #fff)' : 'transparent',
          color: active ? 'var(--accent, #5453D6)' : 'var(--muted, #6b7196)',
          boxShadow: active ? 'var(--sh-sm, 0 1px 2px rgba(20,24,58,.1))' : 'none',
          transition: 'color .15s, background .15s',
          '&:hover': { color: 'var(--ink, #1b2240)' },
        }}
      >
        {icon}
        {label}
      </Box>
    );
  };

  return (
    <Box
      data-scope-switch
      sx={{ display: 'inline-flex', gap: 0.5, p: 0.5, borderRadius: '12px', bgcolor: 'var(--surface-2, #f1f3f7)' }}
    >
      {option('property', <HomeWork size={16} />, t('supervision.scope.byProperty'))}
      {option('portfolio', <CorporateFare size={16} />, t('supervision.scope.portfolio'))}
    </Box>
  );
}
