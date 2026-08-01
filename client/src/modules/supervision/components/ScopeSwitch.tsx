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
      <button className={cn('flex items-center justify-center px-[7.5px] py-1.5 rounded-[9px] border-none cursor-pointer hover:text-[var(--ink,_#1b2240)]', active ? 'text-[var(--accent,_#5453D6)]' : 'text-[var(--muted,_#6b7196)]')} style={{ background: active ? 'var(--card, #fff)' : 'transparent', boxShadow: active ? 'var(--sh-sm, 0 1px 2px rgba(20,24,58,.1))' : 'none', transition: 'color .15s, background .15s' }} type="button" onClick={() => onChange(scope)} aria-pressed={active} aria-label={label} title={label}>
        {icon}
      </button>
    );
  };

  return (
    <div className="inline-flex gap-[3px] p-[3px] rounded-[12px] bg-[var(--surface-2,_#f1f3f7)]" data-scope-switch>
      {option('property', <HomeWork size={16} />, t('supervision.scope.byProperty'))}
      {option('portfolio', <CorporateFare size={16} />, t('supervision.scope.portfolio'))}
    </div>
  );
}
