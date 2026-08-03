/* ============================================================
   <ConstellationAgentCards> — vue AGENTS du tableau

   Une LIGNE par agent, pas une carte : à dix agents, la grille de
   cartes identiques (interdit Impeccable) affichait quatre rangées
   dont huit pavés « En veille » sans information, et repoussait la
   file HITL hors du cadre. Ici la densité sert la lecture — ce qui
   attend une décision remonte en tête et porte seul de la couleur,
   le reste s'efface.

   Chaque ligne : identité (icône, nom, rôle), état, charge
   (« N à valider » ou tâche), dernier passage, et l'interrupteur
   d'autonomie. Cliquer la ligne ouvre la file de l'agent.

   L'interrupteur pilote la VRAIE autonomie par agent
   (setAgentAutonomy) : activé = niveau « notify » (l'agent agit
   puis notifie), désactivé = « suggest » (il propose et attend).
   Le niveau « full » compte comme activé.
   ============================================================ */

import { useState } from 'react';
import {
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
import { cn } from '../../../utils/cn';
import { AGENT_META, STATUS, STATUS_PRIORITY, autonomyChoicesFor } from '../constants';
import { AgentIcon } from '../renderers/agentIcon';
import type { ConstellationAgentView } from '../renderers/ConstellationRenderer';
import type { AgentId, AutonomyLevel, FeedEntry, PortfolioFeedEntry } from '../types';

function hhmm(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

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
    <section className="flex flex-col gap-2">
      <h2 className="m-0 text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase">
        {t('supervision.board.agents', 'Agents')}
      </h2>

      <div className="overflow-hidden rounded-md bg-card">
        {ordered.map((agent, index) => {
          const meta = AGENT_META[agent.id];
          const pending = agent.pendingCount ?? 0;
          const isSelected = agent.id === selected;
          // Le statut dérive de la file, comme le nœud du diagramme : un agent
          // qui porte une proposition attend, quel que soit son statut brut.
          const waiting = pending > 0 || agent.status === 'wait';
          const attention = agent.status === 'esc' || agent.status === 'err';
          const statusLabel = waiting ? t(STATUS.wait.labelKey) : t(STATUS[agent.status].labelKey);
          const choices = autonomyChoicesFor(agent.id);
          const lastAt = feed.find((entry) => entry.agentId === agent.id)?.at;

          return (
            <div
              key={agent.id}
              data-agent-card={agent.id}
              onClick={() => onSelect(agent.id)}
              className={cn(
                'flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors duration-100',
                index > 0 && 'border-t border-border',
                isSelected ? 'bg-primary-soft' : 'hover:bg-muted',
                !waiting && !attention && 'text-muted-foreground',
              )}
            >
              {/* Identité — l'icône reste au même diamètre pour tous : le
                  volume ne se lit pas ici (grammaire de la constellation). */}
              <span
                className={cn(
                  'inline-flex size-8 shrink-0 items-center justify-center rounded-lg',
                  waiting ? 'bg-warning-soft text-warning-ink' : attention ? 'bg-destructive/10 text-destructive' : 'bg-muted text-foreground',
                )}
              >
                <AgentIcon token={meta.icon} size={16} strokeWidth={1.75} />
              </span>

              <span className="flex min-w-0 flex-[2] flex-col">
                <span className="truncate text-[13px] font-medium text-foreground">
                  {t(meta.nameKey)}
                </span>
                <span className="truncate text-xs text-muted-foreground">{t(meta.roleKey)}</span>
              </span>

              {/* UNE cellule d'état : le chiffre qui appelle une décision s'il
                  y en a un, sinon la tâche, sinon la veille. Afficher « Attend
                  ta validation » ET « 5 à valider » côte à côte disait deux
                  fois la même chose et mangeait la largeur pour rien. La
                  pastille porte l'état, le texte porte le fond. */}
              <span className="flex min-w-0 flex-1 items-center gap-1.5 text-xs">
                <span
                  aria-hidden
                  className={cn(
                    'size-1.5 shrink-0 rounded-full',
                    waiting ? 'bg-warning' : attention ? 'bg-destructive' : 'bg-muted-foreground/30',
                  )}
                />
                {pending > 0 ? (
                  <b className="truncate font-semibold text-warning-ink tabular-nums">
                    {pending} {t('supervision.board.toValidate', 'à valider')}
                  </b>
                ) : (
                  <span
                    className={cn(
                      'truncate',
                      waiting
                        ? 'font-medium text-warning-ink'
                        : attention
                          ? 'font-medium text-destructive'
                          : 'text-muted-foreground',
                    )}
                  >
                    {agent.task ?? statusLabel}
                  </span>
                )}
              </span>

              <span className="hidden w-10 shrink-0 text-end text-xs text-muted-foreground tabular-nums md:inline">
                {lastAt ? hhmm(lastAt) : ''}
              </span>

              {/* Autonomie — le VRAI réglage par agent, borné au plafond que
                  le serveur applique de toute façon. Un agent sans action
                  automatisable n'affiche pas de sélecteur : on ne propose pas
                  un réglage sans effet. stopPropagation : régler n'ouvre pas
                  la file. */}
              <span
                className="flex shrink-0 items-center"
                onClick={(event) => event.stopPropagation()}
              >
                {choices.length > 1 ? (
                  <NativeSelect
                    value={agent.autonomy}
                    onChange={(event) => requestLevel(agent.id, event.target.value as AutonomyLevel)}
                    aria-label={`${t('supervision.board.autonomy', 'Autonomie')} — ${t(meta.nameKey)}`}
                    className="h-8 w-[152px] text-xs"
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
                      <span className="w-[152px] text-end text-xs text-muted-foreground">
                        {t('supervision.board.alwaysValidated', 'Validation requise')}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="max-w-[16rem]">
                      {t(
                        'supervision.board.alwaysValidatedHint',
                        "Les actions de cet agent engagent trop (légal, contractuel, public) pour partir sans vous : elles arrivent toujours en carte à valider.",
                      )}
                    </TooltipContent>
                  </Tooltip>
                )}
              </span>
            </div>
          );
        })}
      </div>

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
