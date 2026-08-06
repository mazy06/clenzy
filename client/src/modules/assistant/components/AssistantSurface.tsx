import React from 'react';
import { SmartToy as BotIcon } from '../../../icons';
import { cn } from '../../../utils/cn';
import { useTranslation } from '../../../hooks/useTranslation';
import { AssistantThread } from './AssistantThread';
import { AssistantSuggestions } from './AssistantSuggestions';
import { AssistantComposer } from './AssistantComposer';
import { AssistantEmptyState } from './AssistantEmptyState';
import { AssistantContextChips } from './AssistantContextChips';
import type { AgentStatus, DisplayMessage } from '../../../hooks/useAgent';

type Attachment = NonNullable<DisplayMessage['attachments']>[number];

interface AssistantSurfaceProps {
  messages: DisplayMessage[];
  status: AgentStatus;
  error: string | null;
  onSend: (text: string, attachments?: Attachment[]) => void;
  onAbort?: () => void;
  /** Boutons de fenêtre (agrandir / réduire / fermer) posés à droite du titre. */
  headerActions?: React.ReactNode;
  /** {@code compact} = panneau docké : moins d'amorces, invitation courte. */
  compact?: boolean;
  autoFocus?: boolean;
  className?: string;
}

/**
 * Surface de conversation de l'assistant — reprise fidèle de la projection
 * « Assistant Baitly » (galerie design-system, {@code BAssistantSectionDemo}),
 * elle-même reprise par la maquette du site produit.
 *
 * <p>Structure, de haut en bas :</p>
 * <ol>
 *   <li><b>En-tête</b> : badge d'agent carré teinte de marque, titre, sous-titre,
 *       actions de fenêtre à la fin de la ligne.</li>
 *   <li><b>Bandeau de contexte</b> : chips de ce qui attend l'opérateur.</li>
 *   <li><b>La carte</b> : fil bordé (fond {@code background} sur carte
 *       {@code card}), rangée d'amorces permanente, composeur.</li>
 * </ol>
 *
 * <p>Les deux présentations (encoche dockée et plein écran) montent cette même
 * surface : la fidélité au design ne dépend plus de la coquille.</p>
 */
export const AssistantSurface: React.FC<AssistantSurfaceProps> = ({
  messages,
  status,
  error,
  onSend,
  onAbort,
  headerActions,
  compact = false,
  autoFocus = false,
  className,
}) => {
  const { t } = useTranslation();
  const isBusy = status === 'sending' || status === 'streaming';

  return (
    // Le rythme suit la PRÉSENTATION, pas la largeur du viewport : le panneau
    // docké reste plus étroit que le plein écran même sur un grand moniteur.
    <div className={cn('flex min-h-0 flex-1 flex-col', compact ? 'gap-3 p-3.5' : 'gap-4 p-4', className)}>
      {/* En-tête sur UNE seule ligne : pastille, titre, chips de contexte,
          actions de fenêtre.

          Le sous-titre (« Analyse, actions et réponses… ») a été retiré : c'est
          une phrase de présentation, relue à chaque ouverture alors que l'état
          vide juste en dessous dit déjà ce que l'assistant sait faire. Il reste
          porté par la description accessible du plein écran. Les chips ont
          rejoint cette ligne pour la même raison — deux étages d'en-tête pour
          une pastille, c'était autant de hauteur volée au fil. */}
      <div className="flex shrink-0 items-center gap-2">
        <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
          <BotIcon className="size-4" />
        </span>
        <p className="min-w-0 truncate text-sm font-semibold">{t('assistant.dockLabel')}</p>

        <div className="ms-auto flex shrink-0 items-center gap-1.5">
          <AssistantContextChips />
          {headerActions && (
            <div className="-me-1 flex shrink-0 items-center gap-0.5">{headerActions}</div>
          )}
        </div>
      </div>

      {/* Fil, amorces et composeur posés DIRECTEMENT sur le panneau.

          La projection les enveloppe dans une carte, mais elle est démontrée sur
          une page : là, cette carte est déjà à l'intérieur du panneau flottant,
          et le fil a lui-même son propre contour — trois surfaces emboîtées pour
          deux niveaux d'information. On retire l'intermédiaire : le filet du fil
          suffit à détacher la conversation. */}
      <AssistantThread
        messages={messages}
        emptyState={<AssistantEmptyState compact={compact} />}
      />

      {error && (
        <div className="rounded-lg bg-destructive-soft px-2.5 py-1.5 text-xs font-medium text-destructive-ink">
          {error}
        </div>
      )}

      <AssistantSuggestions onPick={onSend} disabled={isBusy} />

      <AssistantComposer
        status={status}
        onSend={onSend}
        onAbort={onAbort}
        autoFocus={autoFocus}
        hint={t('assistant.composer.hint')}
      />
    </div>
  );
};
