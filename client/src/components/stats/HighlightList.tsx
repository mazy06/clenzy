import React from 'react';
import { cn } from '../../utils/cn';

/**
 * Repères chiffrés d'un écran de statistiques.
 *
 * <p>Ces lignes portent ce qu'AUCUN graphique de l'écran ne montre. Répéter
 * dans une liste ce qu'une barre voisine dit déjà n'ajoute rien : un tableau de
 * bord n'a pas à dire deux fois la même chose.</p>
 */
export interface Highlight {
  label: string;
  value: React.ReactNode;
  /** Attire l'œil : la valeur appelle une action. */
  alert?: boolean;
}

export const HighlightList: React.FC<{ items: Highlight[] }> = ({ items }) => (
  <dl className="no-scrollbar m-0 flex h-full flex-col justify-center gap-2 overflow-y-auto">
    {items.map((item) => (
      // Etroite, la rangee empile : cote a cote, une valeur longue (« Equipe
      // Entretien Clenzy - Paris ») ecrasait son intitule jusqu'a l'illisible.
      <div
        key={item.label}
        className="flex flex-col gap-0.5 border-b border-border pb-1.5 last:border-b-0 last:pb-0 @[340px]:flex-row @[340px]:items-baseline @[340px]:justify-between @[340px]:gap-3"
      >
        <dt className="min-w-0 truncate text-xs text-muted-foreground">{item.label}</dt>
        <dd
          className={cn(
            'm-0 min-w-0 truncate text-sm font-semibold tabular-nums @[340px]:shrink-0 @[340px]:text-end',
            item.alert ? 'text-warning-ink' : 'text-foreground',
          )}
        >
          {item.value}
        </dd>
      </div>
    ))}
  </dl>
);
