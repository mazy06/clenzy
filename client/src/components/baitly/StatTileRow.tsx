import * as React from 'react';
import { cn } from '../../utils/cn';

/**
 * Rangée de tuiles KPI — surface UNIQUE des écrans qui en affichent.
 *
 * <h2>Pourquoi cette primitive existe</h2>
 * <p>Chaque écran redéclarait sa propre grille, et presque toujours de la même
 * façon : une colonne sur mobile, N colonnes au-dessus. Empilées, trois tuiles
 * mangeaient 302 px des 812 px d'un écran de téléphone — avant même le contenu
 * de la page. Six tuiles en occupaient le double.</p>
 *
 * <p>Ici les tuiles restent TOUJOURS sur une ligne : sous `sm`, la rangée défile
 * horizontalement au lieu de s'empiler. Le même bloc passe de 302 px à 125 px.</p>
 *
 * <h2>Détails qui comptent</h2>
 * <ul>
 *   <li><b>68 % de largeur</b> par tuile sur mobile : assez pour lire la valeur,
 *       et la suivante dépasse juste assez pour signaler qu'il y a à faire
 *       défiler. À 100 % rien n'indiquerait qu'il reste des tuiles.</li>
 *   <li><b>`snap-x snap-mandatory`</b> : le défilement se cale sur une tuile, pas
 *       entre deux.</li>
 *   <li>Le nombre de colonnes est écrit en classes LITTÉRALES : une classe
 *       Tailwind ne peut pas naître d'une variable, elle ne serait jamais émise.</li>
 * </ul>
 *
 * <p>Cette primitive vise les rangées de tuiles ÉGALES. Les grilles à 12 colonnes
 * dont chaque enfant porte son propre `col-span`, et les grilles `auto-fit`, ont
 * un autre contrat : elles restent telles quelles.</p>
 */

/** Colonnes à partir de `sm`. Littéral par valeur — cf. note sur Tailwind. */
const COLUMNS_CLASS: Record<number, string> = {
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-3',
  4: 'sm:grid-cols-4',
  5: 'sm:grid-cols-5',
  6: 'sm:grid-cols-6',
};

export interface StatTileRowProps {
  children: React.ReactNode;
  /**
   * Nombre de colonnes à partir de `sm`. Défaut : le nombre de tuiles fournies,
   * borné à 6 — au-delà, chacune deviendrait illisible.
   */
  columns?: number;
  className?: string;
}

export default function StatTileRow({ children, columns, className }: StatTileRowProps) {
  const count = columns ?? Math.min(6, Math.max(2, React.Children.count(children)));
  const cols = COLUMNS_CLASS[Math.min(6, Math.max(2, count))];

  return (
    <div
      className={cn(
        // Mobile : une rangée qui défile, jamais une colonne.
        'flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1',
        '[&>*]:w-[68%] [&>*]:shrink-0 [&>*]:snap-start',
        // À partir de `sm` : la grille attendue, et plus rien qui défile.
        'sm:grid sm:overflow-visible sm:pb-0 sm:[&>*]:w-auto',
        cols,
        className,
      )}
    >
      {children}
    </div>
  );
}
