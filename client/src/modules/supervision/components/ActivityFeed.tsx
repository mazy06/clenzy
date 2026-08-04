/* ============================================================
   <ActivityFeed> — journal « en direct » (chrono inversé)

   Réutilisable par logement (FeedEntry) et portefeuille (taggé du logement).
   Texte rendu en clair (jamais de HTML).
   ============================================================ */

import { memo, useState, type KeyboardEvent } from 'react';
import { Button } from '../../../components/ui';
import { AutoAwesome, ChevronDown } from '../../../icons';
import { useTranslation } from '../../../hooks/useTranslation';
import { cn } from '../../../utils/cn';
import { AGENT_META } from '../constants';
import { AgentIcon } from '../renderers/agentIcon';
import { toolIconFor, isIncidentTool } from '../renderers/toolIcon';
import type { FeedEntry, PendingAction, PortfolioFeedEntry, PortfolioPendingAction } from '../types';
import { FeedMessageModal } from './FeedMessageModal';
import { FeedInvoiceModal } from './FeedInvoiceModal';

function hhmm(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// Mémoïsé (audit perf) : ~40 lignes de JSX — ne re-rendre que quand `entries` change,
// pas à chaque re-render du panneau (events SSE agents, toasts, report).
export const ActivityFeed = memo(ActivityFeedInner);

/**
 * Fenêtre de rapprochement entrée ↔ action en attente : le contrat FeedEntry
 * ne porte pas le lien vers l'action, mais l'entrée qui ANNONCE une
 * proposition naît au même instant qu'elle — même agent, même minute.
 */
const VALIDATION_MATCH_MS = 60_000;

function ActivityFeedInner({
  entries,
  pending,
}: {
  entries: (FeedEntry | PortfolioFeedEntry)[];
  /** File HITL courante — étiquette ambre « validation requise » sur les
   *  entrées qui annoncent une action ENCORE en attente (cf. rapprochement). */
  pending?: readonly (PendingAction | PortfolioPendingAction)[];
}) {
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
        // L'entrée annonce une action encore en attente de validation → l'ambre
        // le dit, comme sur la carte et son attache.
        const entryAt = new Date(entry.at).getTime();
        const awaitsValidation = (pending ?? []).some(
          (action) =>
            action.agentId === entry.agentId
            && Math.abs(new Date(action.createdAt).getTime() - entryAt) < VALIDATION_MATCH_MS,
        );
        // Nature incident (échec, anomalie, écart) : étiquetée en ambre — on
        // n'étiquette que l'EXCEPTION, l'exécution ordinaire reste muette.
        const incident = !isOrchestrator && isIncidentTool(entry.toolName);
        return (
          // Ligne au dessin de la projection : icône discrète (la NATURE de
          // l'action, monochrome — plus de tuile colorée), libellé, ligne
          // « Agent X », horodatage à droite. Filets 1 px entre les lignes.
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
              'flex items-start gap-3 border-t border-solid border-border px-2 py-2.5 first-of-type:border-t-0 transition-colors duration-100 hover:bg-muted/60',
              clickable && 'cursor-pointer focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
            )}
          >
            <span className="mt-px shrink-0 text-muted-foreground [&>svg]:size-3.5">
              {isOrchestrator ? <AutoAwesome size={14} strokeWidth={1.75} /> : (toolIcon ?? <AgentIcon token={meta.icon} size={14} />)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="m-0 max-w-[75ch] text-xs text-foreground">{labelFor(entry)}</p>
              <p className="m-0 mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                {isOrchestrator
                  ? t('supervision.hud.orchestrator')
                  : t('supervision.feed.agentLine', { name: t(meta.nameKey), defaultValue: 'Agent {{name}}' })}
                {propertyName && <span className="min-w-0 truncate">· {propertyName}</span>}
                {awaitsValidation && (
                  <span className="font-medium text-warning-ink">
                    {t('supervision.feed.validationRequired', 'validation requise')}
                  </span>
                )}
                {incident && (
                  <span className="font-medium text-warning-ink">
                    {t('supervision.feed.incident', 'incident')}
                  </span>
                )}
                {/* Natures persistées (Phase 5) — nommées mais MUETTES en couleur :
                    seule l'exception qui appelle une décision reste ambre. */}
                {entry.tag === 'GUARDRAIL' && (
                  <span className="text-muted-foreground/80">
                    {t('supervision.feed.guardrail', 'garde-fou')}
                  </span>
                )}
                {entry.tag === 'LEARNED' && (
                  <span className="text-muted-foreground/80">
                    {t('supervision.feed.learned', 'règle apprise')}
                  </span>
                )}
                {entry.tag === 'DEFERRED' && (
                  <span className="text-muted-foreground/80">
                    {t('supervision.feed.deferred', 'différé')}
                  </span>
                )}
                {detail && (
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => toggle(entry.id)}
                    aria-label={t('common.details', { defaultValue: 'Détails' })}
                    aria-expanded={isOpen}
                    className={cn(
                      'size-4 text-muted-foreground',
                      '[&_svg]:transition-transform [&_svg]:duration-200 [&_svg]:ease-[ease] motion-reduce:[&_svg]:transition-none',
                      isOpen && '[&_svg]:rotate-180',
                    )}
                  >
                    <ChevronDown size={14} />
                  </Button>
                )}
              </p>
              {detail && isOpen && (
                <p className="m-0 mt-1 max-w-[75ch] text-xs leading-relaxed text-muted-foreground break-words">
                  {detail}
                </p>
              )}
            </div>
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{hhmm(entry.at)}</span>
          </div>
        );
      })}
    </div>
    <FeedMessageModal logId={openMessageLogId} onClose={() => setOpenMessageLogId(null)} />
    <FeedInvoiceModal invoiceId={openInvoiceId} onClose={() => setOpenInvoiceId(null)} />
    </>
  );
}
