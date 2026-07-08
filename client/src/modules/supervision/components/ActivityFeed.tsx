/* ============================================================
   <ActivityFeed> — journal « en direct » (chrono inversé)

   Réutilisable par logement (FeedEntry) et portefeuille (taggé du logement).
   Texte rendu en clair (jamais de HTML).
   ============================================================ */

import { Box } from '@mui/material';
import { AutoAwesome } from '../../../icons';
import { useTranslation } from '../../../hooks/useTranslation';
import { AGENT_META } from '../constants';
import { AgentIcon } from '../renderers/agentIcon';
import type { FeedEntry, PortfolioFeedEntry } from '../types';

function hhmm(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function ActivityFeed({ entries }: { entries: (FeedEntry | PortfolioFeedEntry)[] }) {
  const { t } = useTranslation();
  // Feed RÉEL : le libellé est traduit via le nom d'outil stable
  // (`supervision.tools.<toolName>`). Repli sur `text` (résumé/mock) si pas de clé.
  const labelFor = (entry: FeedEntry | PortfolioFeedEntry) =>
    entry.toolName
      ? t(`supervision.tools.${entry.toolName}`, { defaultValue: entry.text || entry.toolName })
      : entry.text;
  // Détail métier (résumé porté par l'outil : logement, montant, MOTIF d'échec…).
  // Affiché sous le libellé quand il apporte une info que le libellé générique n'a pas.
  const detailFor = (entry: FeedEntry | PortfolioFeedEntry) => {
    const text = (entry.text ?? '').trim();
    return text && text !== labelFor(entry) ? text : null;
  };
  return (
    <Box data-activity-feed sx={{ display: 'flex', flexDirection: 'column' }}>
      {entries.map((entry) => {
        // Entrée orchestrateur (réponse chat) : identité d'accent + icône assistant.
        const isOrchestrator = 'orchestrator' in entry && entry.orchestrator;
        const meta = AGENT_META[entry.agentId];
        const propertyName = 'propertyName' in entry ? entry.propertyName : undefined;
        return (
          <Box
            key={entry.id}
            sx={{ display: 'flex', gap: 1.25, py: 1, px: 0.5, borderBottom: '1px solid var(--line, #eef0f4)', '&:last-of-type': { borderBottom: 'none' } }}
          >
            <Box
              sx={{
                width: 26,
                height: 26,
                borderRadius: '8px',
                background: isOrchestrator ? 'var(--accent)' : meta.color,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {isOrchestrator ? <AutoAwesome size={14} strokeWidth={1.75} /> : <AgentIcon token={meta.icon} size={14} />}
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Box sx={{ fontSize: 11, color: 'var(--muted, #6b7196)', fontVariantNumeric: 'tabular-nums' }}>
                {hhmm(entry.at)}
                {propertyName ? ` · ${propertyName}` : ''}
              </Box>
              <Box sx={{ fontSize: 12.5, color: 'var(--ink, #1b2240)', lineHeight: 1.4 }}>{labelFor(entry)}</Box>
              {detailFor(entry) && (
                <Box sx={{ fontSize: 11.5, color: 'var(--muted, #6b7196)', lineHeight: 1.35, mt: 0.25, wordBreak: 'break-word' }}>
                  {detailFor(entry)}
                </Box>
              )}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
