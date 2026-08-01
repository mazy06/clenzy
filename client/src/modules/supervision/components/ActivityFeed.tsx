/* ============================================================
   <ActivityFeed> — journal « en direct » (chrono inversé)

   Réutilisable par logement (FeedEntry) et portefeuille (taggé du logement).
   Texte rendu en clair (jamais de HTML).
   ============================================================ */

import { memo, useState, type KeyboardEvent } from 'react';
import { IconButton } from '@mui/material';
import { AutoAwesome, ChevronDown } from '../../../icons';
import { useTranslation } from '../../../hooks/useTranslation';
import { cn } from '../../../utils/cn';
import { AGENT_META } from '../constants';
import { AgentIcon } from '../renderers/agentIcon';
import { toolIconFor } from '../renderers/toolIcon';
import type { FeedEntry, PortfolioFeedEntry } from '../types';
import { FeedMessageModal } from './FeedMessageModal';
import { FeedInvoiceModal } from './FeedInvoiceModal';

function hhmm(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// Mémoïsé (audit perf) : ~40 lignes MUI — ne re-rendre que quand `entries` change,
// pas à chaque re-render du panneau (events SSE agents, toasts, report).
export const ActivityFeed = memo(ActivityFeedInner);

function ActivityFeedInner({ entries }: { entries: (FeedEntry | PortfolioFeedEntry)[] }) {
  const { t } = useTranslation();
  // Détail métier replié par défaut : on ne montre que le libellé, la description
  // (motif d'échec, montant…) s'ouvre au clic sur le chevron.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  // Message envoyé (ex. « Message de check-out ») : la ligne ouvre une modale qui
  // prévisualise le contenu envoyé. Seules les entrées porteuses d'un `messageLogId`
  // sont cliquables — les autres gardent leur détail dépliable (chevron).
  const [openMessageLogId, setOpenMessageLogId] = useState<number | null>(null);
  // Relance de paiement : la ligne ouvre la modale de détail de la facture
  // (rattachement réservation/prestation + payer / envoyer un lien de paiement).
  const [openInvoiceId, setOpenInvoiceId] = useState<number | null>(null);
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
    <>
    <div className="flex flex-col" data-activity-feed>
      {entries.map((entry) => {
        // Entrée orchestrateur (réponse chat) : identité d'accent + icône assistant.
        const isOrchestrator = 'orchestrator' in entry && entry.orchestrator;
        const meta = AGENT_META[entry.agentId];
        // Icône = NATURE de l'action (toolName) ; repli sur l'icône d'agent si le
        // toolName est absent/inconnu (résumés & entrées mock). La couleur du carré
        // encode l'agent, donc l'icône n'a pas à le redoubler.
        const toolIcon = isOrchestrator ? null : toolIconFor(entry.toolName, 14);
        const propertyName = 'propertyName' in entry ? entry.propertyName : undefined;
        const messageLogId = entry.messageLogId ?? null;
        const invoiceId = ('invoiceId' in entry ? entry.invoiceId : null) ?? null;
        const hasMessage = messageLogId != null;
        // Relance de paiement : cliquable vers la modale facture (le message, s'il
        // existe aussi, garde priorité — c'est le contenu envoyé qui prime).
        const hasInvoice = !hasMessage && invoiceId != null;
        const clickable = hasMessage || hasInvoice;
        const openModal = () =>
          hasMessage ? setOpenMessageLogId(messageLogId) : setOpenInvoiceId(invoiceId);
        // Détail dépliable réservé aux entrées SANS modale : pour les autres, la ligne
        // ouvre la modale (le chevron ferait doublon).
        const detail = clickable ? null : detailFor(entry);
        const isOpen = expanded.has(entry.id);
        return (
          <div
            key={entry.id}
            {...(clickable
              ? {
                  role: 'button' as const,
                  tabIndex: 0,
                  onClick: openModal,
                  onKeyDown: (e: KeyboardEvent) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openModal();
                    }
                  },
                  'aria-label': hasMessage
                    ? t('supervision.feed.openMessage', { defaultValue: 'Voir le message envoyé' })
                    : t('supervision.feed.openInvoice', { defaultValue: 'Voir la facture' }),
                }
              : {})}
            className={cn(
              'flex gap-[7.5px] py-1.5 px-[3px] border-b border-solid border-b-[var(--line,_#eef0f4)] last-of-type:border-b-0',
              clickable &&
                'cursor-pointer rounded-[6px] transition-[background] duration-150 ease-[ease] hover:bg-[var(--hover,_rgba(107,138,154,0.08))] focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-[-2px]',
            )}
          >
            <div className="w-[26px] h-[26px] rounded-[8px] text-[#fff] flex items-center justify-center shrink-0" style={{ background: isOrchestrator ? 'var(--accent)' : meta.color }}>
              {isOrchestrator ? <AutoAwesome size={14} strokeWidth={1.75} /> : (toolIcon ?? <AgentIcon token={meta.icon} size={14} />)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] text-[var(--muted,_#6b7196)] tabular-nums">
                {hhmm(entry.at)}
                {propertyName ? ` · ${propertyName}` : ''}
              </div>
              <div className="flex items-center gap-0.5 justify-between">
                <div className="text-[12.5px] text-[var(--ink,_#1b2240)] leading-[1.4] min-w-0">
                  {labelFor(entry)}
                </div>
                {detail && (
                  <IconButton
                    size="small"
                    onClick={() => toggle(entry.id)}
                    aria-label={t('common.details', { defaultValue: 'Détails' })}
                    aria-expanded={isOpen}
                    sx={{
                      p: 0.25,
                      color: 'var(--muted, #6b7196)',
                      flexShrink: 0,
                      '& svg': {
                        transition: 'transform 200ms ease',
                        transform: isOpen ? 'rotate(180deg)' : 'none',
                      },
                    }}
                  >
                    <ChevronDown size={14} />
                  </IconButton>
                )}
              </div>
              {detail && isOpen && (
                <div className="text-[11.5px] text-[var(--muted,_#6b7196)] leading-[1.35] mt-[1.5px] break-words">
                  {detail}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
    <FeedMessageModal logId={openMessageLogId} onClose={() => setOpenMessageLogId(null)} />
    <FeedInvoiceModal invoiceId={openInvoiceId} onClose={() => setOpenInvoiceId(null)} />
    </>
  );
}
