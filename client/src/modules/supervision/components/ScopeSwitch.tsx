/* ============================================================
   <ScopeSwitch> — sélecteur de portée « Par logement / Vue d'ensemble »

   Placé au-dessus du planning. Bascule entre les deux échelles de
   supervision ; toute la grammaire visuelle reste identique.
   ============================================================ */

import type { ReactNode } from 'react';
import { cn } from '../../../utils/cn';

import { HomeWork, CorporateFare } from '../../../icons';
import { useTranslation } from '../../../hooks/useTranslation';

export type SupervisionScope = 'property' | 'portfolio';

export function ScopeSwitch({ value, onChange }: { value: SupervisionScope; onChange: (scope: SupervisionScope) => void }) {
  const { t } = useTranslation();

  // Icône seule : le libellé passe en aria-label + title (tooltip natif).
  const option = (scope: SupervisionScope, icon: ReactNode, label: string) => {
    const active = value === scope;
    return (
      <button
        type="button"
        className={cn(
          'flex items-center justify-center rounded-lg px-[7.5px] py-1.5 cursor-pointer',
          'transition-colors duration-150 motion-reduce:transition-none hover:text-foreground',
          active ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground',
        )}
        onClick={() => onChange(scope)}
        aria-pressed={active}
        aria-label={label}
        title={label}
      >
        {icon}
      </button>
    );
  };

  return (
    <div className="inline-flex gap-[3px] rounded-xl bg-muted p-[3px]" data-scope-switch>
      {option('property', <HomeWork size={16} />, t('supervision.scope.byProperty'))}
      {option('portfolio', <CorporateFare size={16} />, t('supervision.scope.portfolio'))}
    </div>
  );
}
