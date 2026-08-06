import React from 'react';
import StatusChip from '../../../components/baitly/StatusChip';
import { useTranslation } from '../../../hooks/useTranslation';
import { useCanSuperviseAgents } from '../../supervision/useCanSuperviseAgents';
import { useSupervisionPendingCounts } from '../../supervision/useSupervisionPendingCounts';

/**
 * Chips de contexte de l'en-tête — ce qui attend l'opérateur, posé sur la MÊME
 * ligne que le titre (une rangée dédiée coûtait un étage d'en-tête entier pour
 * une seule pastille).
 *
 * <p>Règle : une chip n'existe QUE si la donnée existe. Pas de valeur de
 * démonstration en dur — un chiffre inventé dans l'en-tête de l'assistant
 * serait pire que pas de chiffre du tout. Aujourd'hui une seule source est
 * branchée (les validations en attente, {@code useSupervisionPendingCounts}) ;
 * les autres viendront avec les chantiers correspondants.</p>
 *
 * <p>Le hook partage sa clé react-query avec la sidebar et le planning : aucun
 * appel réseau supplémentaire n'est déclenché par l'assistant.</p>
 */
export const AssistantContextChips: React.FC = () => {
  const { t } = useTranslation();
  const { canView } = useCanSuperviseAgents();
  const { total } = useSupervisionPendingCounts(canView);

  if (total <= 0) return null;

  return (
    <StatusChip
      tone="warn"
      size="sm"
      label={t('assistant.context.pending', { count: total })}
      className="hidden shrink-0 min-[420px]:inline-flex"
    />
  );
};
