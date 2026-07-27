import * as React from 'react';
import { PlusIcon } from 'lucide-react';
import { cn } from '../../utils/cn';

/**
 * Baitly — bloc de section optionnelle dans un formulaire long.
 *
 * Problème résolu : dans un formulaire riche, les sections facultatives
 * (planification, conditions, options avancées) ont le même poids visuel que
 * les champs obligatoires, ce qui allonge la lecture inutilement. Ici la
 * section est **dégradée visuellement** (panneau teinté, mention « optionnel »
 * en gris) et ne déploie ses champs que sur demande.
 *
 * Usage :
 *   <OptionalSection
 *     title="Conditions d'envoi"
 *     description="N'envoyer que si la réservation correspond aux critères."
 *     addLabel="Ajouter une condition"
 *     help={<a href="#">Comment ça marche&nbsp;?</a>}
 *   >
 *     <ConditionsEditor … />
 *   </OptionalSection>
 */
export interface OptionalSectionProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Libellé de l'action de déploiement. Défaut : « Ajouter ». */
  addLabel?: React.ReactNode;
  /** Mention entre parenthèses après le titre. Défaut : « optionnel ». */
  optionalLabel?: string;
  /** Lien d'aide aligné à droite du titre. */
  help?: React.ReactNode;
  /** Déploiement contrôlé. Sinon le composant gère son propre état. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
}

export default function OptionalSection({
  title,
  description,
  addLabel = 'Ajouter',
  optionalLabel = 'optionnel',
  help,
  open,
  onOpenChange,
  defaultOpen = false,
  disabled = false,
  children,
  className,
}: OptionalSectionProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const isOpen = open ?? uncontrolledOpen;

  const setOpen = (next: boolean) => {
    if (open === undefined) setUncontrolledOpen(next);
    onOpenChange?.(next);
  };

  return (
    <section className={cn('rounded-xl bg-muted/60 p-4', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="m-0 text-sm font-semibold text-foreground">
            {title}{' '}
            <span className="font-normal text-muted-foreground">({optionalLabel})</span>
          </h3>
          {description && (
            <p className="m-0 mt-1 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {help && <div className="shrink-0 text-xs">{help}</div>}
      </div>

      {isOpen ? (
        <div className="mt-3">{children}</div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(true)}
          className={cn(
            'mt-3 inline-flex cursor-pointer items-center gap-1.5 rounded-md text-sm font-medium text-success-ink',
            'outline-none transition-colors duration-150 hover:text-foreground',
            'focus-visible:ring-[3px] focus-visible:ring-ring/50',
            'disabled:pointer-events-none disabled:opacity-55',
            '[&>svg]:size-4'
          )}
        >
          <PlusIcon />
          {addLabel}
        </button>
      )}
    </section>
  );
}
