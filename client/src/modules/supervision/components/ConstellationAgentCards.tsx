/* ============================================================
   <ConstellationAgentCards> — vue AGENTS du tableau

   Une LIGNE par agent, pas une carte : à dix agents, la grille de
   cartes identiques (interdit Impeccable) affichait quatre rangées
   dont huit pavés « En veille » sans information, et repoussait la
   file HITL hors du cadre. Ici la densité sert la lecture — ce qui
   attend une décision remonte en tête et porte seul de la couleur,
   le reste s'efface.

   Chaque ligne : médaillon, identité, décisions et autonomie.
   Le bouton ouvre la file ; le sélecteur voisin règle l'autonomie
   sans sélectionner l'agent. Les deux sont accessibles au clavier.
   ============================================================ */

import { useId, useState } from 'react';
import {
  Badge,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  NativeSelect,
  NativeSelectOption,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../../components/ui';
import { useTranslation } from '../../../hooks/useTranslation';
import { ErrorOutline, Lock } from '../../../icons';
import { AGENT_META, STATUS, STATUS_PRIORITY, autonomyChoicesFor } from '../constants';
import { AgentPortrait } from '../renderers/AgentPortrait';
import type { ConstellationAgentView } from '../renderers/ConstellationRenderer';
import type { AgentId, AutonomyLevel, FeedEntry, PortfolioFeedEntry } from '../types';
import '../supervision-surfaces.css';
import './constellation-agent-list.css';

/** Libellé court de chaque cran — il dit ce que l'agent FAIT, pas un niveau. */
const AUTONOMY_LABEL: Record<AutonomyLevel, { key: string; fallback: string }> = {
  suggest: { key: 'supervision.autonomy.suggest', fallback: 'Propose' },
  notify: { key: 'supervision.autonomy.notify', fallback: 'Agit et notifie' },
  full: { key: 'supervision.autonomy.full', fallback: 'Pleine autonomie' },
};

export interface ConstellationAgentCardsProps {
  agents: ConstellationAgentView[];
  /** Journal — sert à dater le dernier passage de chaque agent. */
  feed: (FeedEntry | PortfolioFeedEntry)[];
  /** Agent dont la file est ouverte (mise en avant + clic ligne). */
  selected: AgentId | null;
  onSelect: (id: AgentId) => void;
  onAutonomyChange: (id: AgentId, level: AutonomyLevel) => void;
}

export function ConstellationAgentCards({
  agents,
  feed,
  selected,
  onSelect,
  onAutonomyChange,
}: ConstellationAgentCardsProps) {
  const { t } = useTranslation();
  const headingId = useId();

  // Passage en PLEINE autonomie : l'agent agira seul et en silence. On ne le
  // fait pas glisser d'un sélecteur — l'exploitant doit voir ce qu'il engage et
  // l'accepter explicitement (la responsabilité des actions lui revient).
  const [pendingFull, setPendingFull] = useState<AgentId | null>(null);
  const [accepted, setAccepted] = useState(false);

  const requestLevel = (id: AgentId, level: AutonomyLevel) => {
    if (level === 'full') {
      setAccepted(false);
      setPendingFull(id);
      return;
    }
    onAutonomyChange(id, level);
  };

  const confirmFull = () => {
    if (pendingFull) onAutonomyChange(pendingFull, 'full');
    setPendingFull(null);
  };

  // Ce qui réclame une décision d'abord, la veille en bas : la liste se lit du
  // haut, on ne doit pas chercher l'agent qui attend parmi ceux qui dorment.
  const ordered = [...agents].sort((a, b) => {
    const aWait = (a.pendingCount ?? 0) > 0 || a.status === 'wait';
    const bWait = (b.pendingCount ?? 0) > 0 || b.status === 'wait';
    if (aWait !== bWait) return aWait ? -1 : 1;
    const byStatus = STATUS_PRIORITY[b.status] - STATUS_PRIORITY[a.status];
    if (byStatus !== 0) return byStatus;
    return (b.pendingCount ?? 0) - (a.pendingCount ?? 0);
  });

  return (
    <section className="baitly-supervision-surface baitly-agent-list" aria-labelledby={headingId}>
      <h2 id={headingId} className="sr-only">{t('supervision.board.agents', 'Agents')}</h2>

      <ul className="baitly-agent-list-rows">
        {ordered.map((agent) => {
          const meta = AGENT_META[agent.id];
          const pending = agent.pendingCount ?? 0;
          const isSelected = agent.id === selected;
          // Le statut dérive de la file, comme le nœud du diagramme : un agent
          // qui porte une proposition attend, quel que soit son statut brut.
          const waiting = pending > 0 || agent.status === 'wait';
          const attention = agent.status === 'esc' || agent.status === 'err';
          const working = agent.status === 'act' || agent.status === 'think';
          const statusLabel = attention ? t(STATUS[agent.status].labelKey) : waiting ? t(STATUS.wait.labelKey) : t(STATUS[agent.status].labelKey);
          const choices = autonomyChoicesFor(agent.id);
          const lastAt = feed.find((entry) => entry.agentId === agent.id)?.at;
          const lastActivity = lastAt && Number.isFinite(Date.parse(lastAt))
            ? `${t('supervision.board.lastActivity', 'Dernière activité')} : ${new Date(lastAt).toLocaleString()}`
            : null;

          return (
            <li
              key={agent.id}
              data-agent-card={agent.id}
              data-selected={isSelected || undefined}
              data-attention={attention || undefined}
              data-working={working || undefined}
              className="baitly-agent-list-row"
            >
              <button
                type="button"
                className="baitly-agent-list-select"
                aria-pressed={isSelected}
                onClick={() => onSelect(agent.id)}
                title={[
                  `${t(meta.nameKey)} · ${t(meta.roleKey)}`,
                  pending > 0 ? `${pending} ${t('supervision.board.toValidate', 'à valider')}` : statusLabel,
                  lastActivity,
                  t('supervision.board.tooltipOpenQueue', 'Cliquer pour ouvrir la file'),
                ].filter(Boolean).join('\n')}
              >
                <span className="baitly-agent-list-emblem" aria-hidden="true">
                  <AgentPortrait agentId={agent.id} receiving={false} />
                  {working && <span className="baitly-agent-list-activity" />}
                </span>

                <span className="baitly-agent-list-identity">
                  <span className="baitly-agent-list-name">{t(meta.nameKey)}</span>{' '}
                  <span className="baitly-agent-list-role">{t(meta.roleKey)}</span>
                </span>

                <span className="baitly-agent-list-state">
                  {pending > 0 && (
                    <Badge variant="warning" className="baitly-agent-list-count whitespace-normal">
                      <strong>{pending}</strong>{' '}
                      <span className="baitly-agent-list-count-label">{t('supervision.board.toValidate', 'à valider')}</span>
                    </Badge>
                  )}
                  {(pending === 0 || attention) && (
                    <span className="baitly-agent-list-status" title={agent.task ?? statusLabel}>
                      {attention ? <ErrorOutline size={14} aria-hidden="true" /> : <span className="baitly-agent-list-dot" aria-hidden="true" />}
                      <span>{attention ? statusLabel : agent.task ?? statusLabel}</span>
                    </span>
                  )}
                </span>
              </button>

              {/* Contrôle frère du bouton : modifier l'autonomie ne doit pas
                  ouvrir la file, ni imbriquer deux contrôles interactifs. */}
              <div className="baitly-agent-list-autonomy">
                {choices.length > 1 ? (
                  <NativeSelect
                    value={agent.autonomy}
                    onChange={(event) => requestLevel(agent.id, event.target.value as AutonomyLevel)}
                    aria-label={`${t('supervision.board.autonomy', 'Autonomie')} : ${t(meta.nameKey)}`}
                    className="baitly-agent-list-mode"
                  >
                    {choices.map((level) => (
                      <NativeSelectOption key={level} value={level}>
                        {t(AUTONOMY_LABEL[level].key, AUTONOMY_LABEL[level].fallback)}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" className="baitly-agent-list-locked">
                        <Lock size={14} aria-hidden="true" />
                        {t('supervision.board.alwaysValidated', 'Validation requise')}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[16rem]">
                      {t(
                        'supervision.board.alwaysValidatedHint',
                        "Les actions de cet agent engagent trop (légal, contractuel, public) pour partir sans vous : elles arrivent toujours en carte à valider.",
                      )}
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {/* Consentement à la pleine autonomie : dire ce qui change, qui en
          répond, et exiger une case cochée — pas un simple « OK ». */}
      <Dialog open={pendingFull != null} onOpenChange={(next) => { if (!next) setPendingFull(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t('supervision.autonomy.confirmTitle', 'Activer la pleine autonomie ?')}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 text-[13px] leading-relaxed">
            <p className="m-0">
              {t('supervision.autonomy.confirmBody', {
                name: pendingFull ? t(AGENT_META[pendingFull].nameKey) : '',
                defaultValue:
                  "L'agent {{name}} exécutera ses actions seul, sans validation préalable et sans notification — vous les retrouverez dans le journal, une fois faites.",
              })}
            </p>
            <p className="m-0 text-muted-foreground">
              {t(
                'supervision.autonomy.confirmLiability',
                "Ces actions sont réalisées au nom de votre organisation, qui en assume la responsabilité — y compris leurs effets vis-à-vis des voyageurs, des propriétaires et des canaux de distribution. Vous pouvez revenir à tout moment sur « Agit et notifie » ou « Propose ».",
              )}
            </p>
            <label className="flex cursor-pointer items-start gap-2.5">
              <Checkbox
                checked={accepted}
                onCheckedChange={(next) => setAccepted(next === true)}
                className="mt-0.5"
              />
              <span>
                {t(
                  'supervision.autonomy.confirmAccept',
                  "J'ai compris et j'active la pleine autonomie sous la responsabilité de mon organisation.",
                )}
              </span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingFull(null)}>
              {t('common.cancel', 'Annuler')}
            </Button>
            <Button disabled={!accepted} onClick={confirmFull}>
              {t('supervision.autonomy.confirmCta', 'Activer la pleine autonomie')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
