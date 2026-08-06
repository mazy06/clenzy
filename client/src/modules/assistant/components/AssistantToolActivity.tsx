import React from 'react';
import { Badge } from '../../../components/ui';
import { Warning as AlertIcon } from '../../../icons';
import { useTranslation } from '../../../hooks/useTranslation';
import { toolIconFor } from '../../supervision/renderers/toolIcon';
import { toolLabelKey } from '../toolDomains';
import type { ToolCallExecuted } from '../../../hooks/useAgent';

interface AssistantToolActivityProps {
  calls: ToolCallExecuted[];
}

/**
 * Rangée de pastilles « ce que l'assistant est allé chercher », affichée
 * au-dessus de sa réponse.
 *
 * <p>Remplace l'ancienne chip qui exposait le nom technique de l'outil en
 * {@code font-mono} ({@code get_dashboard_summary}) : on affiche le domaine
 * métier et la nature de l'accès (cf. {@code toolDomains.ts}), avec l'icône
 * partagée avec le feed de supervision pour que les deux surfaces parlent la
 * même langue.</p>
 *
 * <p>Les outils d'un même domaine sont fusionnés en une seule pastille — trois
 * lectures du calendrier dans un tour ne produisent pas trois pastilles.</p>
 */
export const AssistantToolActivity: React.FC<AssistantToolActivityProps> = ({ calls }) => {
  const { t } = useTranslation();
  if (calls.length === 0) return null;

  // Dédoublonnage par (libellé, erreur) : on garde le premier outil de chaque
  // groupe pour son icône, et l'état d'erreur prime (une lecture ratée doit
  // rester visible même si une autre du même domaine a réussi).
  const groups = new Map<string, { call: ToolCallExecuted; isError: boolean }>();
  calls.forEach((call) => {
    const key = toolLabelKey(call.toolName);
    const previous = groups.get(key);
    if (!previous) {
      groups.set(key, { call, isError: Boolean(call.toolError) });
    } else if (call.toolError) {
      groups.set(key, { call: previous.call, isError: true });
    }
  });

  return (
    <div className="mb-1.5 flex flex-wrap gap-1.5">
      {Array.from(groups.entries()).map(([labelKey, { call, isError }]) => (
        <Badge key={labelKey} variant={isError ? 'warning' : 'info'}>
          {isError ? <AlertIcon size={12} strokeWidth={1.9} /> : toolIconFor(call.toolName, 12)}
          {t(labelKey)}
          {isError && <span className="lowercase">· {t('assistant.tool.failed')}</span>}
        </Badge>
      ))}
    </div>
  );
};
