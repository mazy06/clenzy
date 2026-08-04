import React from 'react';
import { cn } from '../../../utils/cn';

import { CheckCircle as CheckCircleIcon, ErrorOutline as AlertCircleIcon } from '../../../icons';
import type { ToolCallExecuted } from '../../../hooks/useAgent';

interface ToolCallCardProps {
  call: ToolCallExecuted;
}

/**
 * Chip representant l'execution d'un tool par l'assistant — pattern statut
 * « Signature » : pilule fond `-soft` + texte/icone couleur semantique.
 *
 * <p>Affiche un recap discret : icone status + nom du tool. Le contenu complet
 * du resultat n'est PAS affiche ici (le LLM le synthetise dans le texte suivant).</p>
 */
export const ToolCallCard: React.FC<ToolCallCardProps> = ({ call }) => {
  const isError = Boolean(call.toolError);

  return (
    <div className={cn('inline-flex items-center gap-[4.5px] h-[22px] px-2.5 me-[4.5px] mb-[3px] rounded-[7992px]', isError ? 'bg-[var(--err-soft)]' : 'bg-[var(--ok-soft)]', isError ? 'text-[var(--err)]' : 'text-[var(--ok)]')}>
      {isError ? (
        <AlertCircleIcon size={12} strokeWidth={1.75} />
      ) : (
        <CheckCircleIcon size={12} strokeWidth={1.75} />
      )}
      <span className="font-mono text-[10.5px] font-bold tracking-[.02em] text-inherit">
        {call.toolName}
      </span>
      {isError && (
        <span className="text-[10.5px] font-bold uppercase tracking-[.05em] text-[var(--err)]">
          erreur
        </span>
      )}
    </div>
  );
};
