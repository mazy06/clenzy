import React from 'react';
import { cn } from '../../utils/cn';
import { useFitRows } from '../../hooks/useFitRows';

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
  /**
   * Ce qui situe la ligne : le logement, le fournisseur, la periode.
   *
   * <p>Deux lignes peuvent porter le meme intitule — le meme consommable dans
   * deux logements — sans que la liste devienne ambigue.</p>
   */
  hint?: string;
  /** Attire l'œil : la valeur appelle une action. */
  alert?: boolean;
  /** Cle de rendu quand l'intitule se repete. Par defaut, l'intitule. */
  id?: string;
}

export const HighlightList: React.FC<{ items: Highlight[] }> = ({ items }) => {
  // Les reperes qui ne tiennent pas se comptent, ils ne defilent plus : sous
  // `no-scrollbar`, la moitie de la liste disparaissait sans qu'un rail ne le
  // laisse deviner. `justify-center` est parti avec — le rab doit rester au
  // BAS du cadre, c'est lui qui dit a la ligne qu'elle peut se resserrer.
  const { ref, hidden } = useFitRows<HTMLDListElement>();
  return (
  <div className="flex h-full flex-col">
  <dl ref={ref} className="m-0 flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
    {items.map((item) => (
      // Etroite, la rangee empile : cote a cote, une valeur longue (« Equipe
      // Entretien Clenzy - Paris ») ecrasait son intitule jusqu'a l'illisible.
      <div
        key={item.id ?? item.label}
        className="flex flex-col gap-0.5 border-b border-border pb-1.5 last:border-b-0 last:pb-0 @[340px]:flex-row @[340px]:items-baseline @[340px]:justify-between @[340px]:gap-3"
      >
        <dt className="min-w-0 text-xs text-muted-foreground">
          <span className="block truncate">{item.label}</span>
          {item.hint ? <span className="block truncate text-2xs text-muted-foreground">{item.hint}</span> : null}
        </dt>
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
  {hidden > 0 && (
    <p className="m-0 shrink-0 pt-1.5 text-2xs font-semibold text-muted-foreground tabular-nums">
      +{hidden}
    </p>
  )}
  </div>
  );
};
