/* ============================================================
   <ScopeSwitch> — sélecteur de portée « Par logement / Vue d'ensemble »

   Placé au-dessus du planning. Bascule entre les deux échelles de
   supervision ; toute la grammaire visuelle reste identique.
   ============================================================ */

import type { ReactNode } from 'react';
import { cn } from '../../../utils/cn';

import { HomeWork, CorporateFare } from '../../../icons';
import { Button, Tooltip, TooltipContent, TooltipTrigger } from '../../../components/ui';
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

/* ============================================================
   <ScopeToggle> — la meme portee, reduite a UNE icone

   Variante pour la barre de titre, ou le segmente a deux cases ne tient pas :
   la barre n'admet qu'une forme de bouton, l'icone expliquee par une infobulle.
   Elle y remplace le declencheur « Filtres », qui n'ouvrait plus qu'un panneau
   a un seul reglage — une couche pour deux options.

   L'icone dit OU L'ON EST (le pictogramme de la portee courante), l'infobulle
   dit ce que le clic fera. Montrer la portee cible aurait rendu le bouton
   illisible a l'arret : on ne saurait plus laquelle des deux vues est a
   l'ecran.
   ============================================================ */

export function ScopeToggle({
  value,
  onChange,
}: {
  value: SupervisionScope;
  onChange: (scope: SupervisionScope) => void;
}) {
  const { t } = useTranslation();

  const isPortfolio = value === 'portfolio';
  const next: SupervisionScope = isPortfolio ? 'property' : 'portfolio';
  // Libelle de l'ACTION, pas de l'etat : l'icone porte deja l'etat.
  const label = isPortfolio
    ? t('supervision.scope.switchToProperty')
    : t('supervision.scope.switchToPortfolio');

  return (
    <Tooltip>
      {/* Le Button du kit ne transmet pas de ref (React 18) : le span porte
          celle que Radix pose pour ancrer l'infobulle. */}
      <TooltipTrigger asChild>
        <span className="inline-flex">
          <Button
            variant="ghost"
            size="icon"
            aria-label={label}
            onClick={() => onChange(next)}
          >
            {isPortfolio ? <CorporateFare size={18} /> : <HomeWork size={18} />}
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
