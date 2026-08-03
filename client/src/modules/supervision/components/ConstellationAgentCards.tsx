/* ============================================================
   <ConstellationAgentCards> — vue CARTES du tableau (projection)

   Reproduction de la vue « cartes » de la projection (AgentCard) :
   une carte par agent — identité (icône, nom, rôle), ligne de
   statut (seule l'attente sort du gris), charge (« N à valider »
   ou tâche en cours) + dernier passage, et l'interrupteur
   d'autonomie. La carte porte une surface parce qu'on agit dessus
   (l'interrupteur) ; cliquer la carte ouvre la file de l'agent.

   L'interrupteur pilote la VRAIE autonomie par agent
   (setAgentAutonomy) : Auto-application = niveau « notify »
   (agit puis notifie, le défaut auto), Validation humaine =
   « suggest ». Le niveau « full » compte comme auto.
   ============================================================ */

import { Switch } from '../../../components/ui';
import { useTranslation } from '../../../hooks/useTranslation';
import { cn } from '../../../utils/cn';
import { AGENT_META, STATUS } from '../constants';
import { AgentIcon } from '../renderers/agentIcon';
import type { ConstellationAgentView } from '../renderers/ConstellationRenderer';
import type { AgentId, AutonomyLevel, FeedEntry, PortfolioFeedEntry } from '../types';

function hhmm(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export interface ConstellationAgentCardsProps {
  agents: ConstellationAgentView[];
  /** Journal — sert à dater le dernier passage de chaque agent. */
  feed: (FeedEntry | PortfolioFeedEntry)[];
  /** Agent dont la file est ouverte (mise en avant + clic carte). */
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

  return (
    <section className="flex flex-col gap-2">
      <h2 className="m-0 text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase">
        {t('supervision.board.agents', 'Agents')}
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {agents.map((agent) => {
          const meta = AGENT_META[agent.id];
          const pending = agent.pendingCount ?? 0;
          const isSelected = agent.id === selected;
          // Le statut dérive de la file, comme le nœud du diagramme : un agent
          // qui porte une proposition attend, quel que soit son statut brut.
          const waiting = pending > 0 || agent.status === 'wait';
          const statusLabel = waiting ? t(STATUS.wait.labelKey) : t(STATUS[agent.status].labelKey);
          // « Auto » = l'agent agit sans validation préalable (notify ou full).
          const auto = agent.autonomy !== 'suggest';
          const lastAt = feed.find((entry) => entry.agentId === agent.id)?.at;

          return (
            <article
              key={agent.id}
              data-agent-card={agent.id}
              onClick={() => onSelect(agent.id)}
              className={cn(
                'flex cursor-pointer flex-col gap-2 rounded-md bg-card p-3.5 transition-shadow duration-100',
                isSelected ? 'ring-1 ring-primary/25' : 'hover:shadow-sm',
              )}
            >
              {/* Identité : icône + nom + rôle */}
              <div className="flex items-center gap-3">
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                  <AgentIcon token={meta.icon} size={18} strokeWidth={1.75} />
                </span>
                <div className="min-w-0">
                  <h3 className="m-0 truncate text-sm font-medium text-foreground">
                    {t('supervision.feed.agentLine', { name: t(meta.nameKey), defaultValue: 'Agent {{name}}' })}
                  </h3>
                  <p className="m-0 truncate text-xs text-muted-foreground">{t(meta.roleKey)}</p>
                </div>
              </div>

              {/* Statut : seule l'attente (et l'exception) sort du gris. */}
              <p className="m-0 flex items-center gap-1.5 border-b border-border pb-2 text-xs">
                <span
                  aria-hidden
                  className={cn(
                    'size-1.5 shrink-0 rounded-full',
                    waiting
                      ? 'bg-warning'
                      : agent.status === 'esc' || agent.status === 'err'
                        ? 'bg-destructive'
                        : 'bg-muted-foreground/30',
                  )}
                />
                <span
                  className={cn(
                    waiting
                      ? 'font-medium text-warning-ink'
                      : agent.status === 'esc' || agent.status === 'err'
                        ? 'font-medium text-destructive'
                        : 'text-muted-foreground',
                  )}
                >
                  {statusLabel}
                </span>
              </p>

              {/* Charge + dernier passage (daté par le journal). */}
              <p className="m-0 flex items-baseline justify-between gap-2 border-b border-border pb-2 text-xs">
                <span className="min-w-0 truncate text-foreground">
                  {pending > 0
                    ? `${pending} ${t('supervision.board.toValidate', 'à valider')}`
                    : (agent.task ?? statusLabel)}
                </span>
                {lastAt && <span className="shrink-0 text-muted-foreground tabular-nums">{hhmm(lastAt)}</span>}
              </p>

              {/* Autonomie — le VRAI réglage par agent. stopPropagation : le
                  clic sur l'interrupteur ne doit pas ouvrir la file. */}
              <label
                className="flex cursor-pointer items-center justify-between gap-2 text-xs text-muted-foreground"
                onClick={(event) => event.stopPropagation()}
              >
                {auto
                  ? t('supervision.board.autoApply', 'Auto-application')
                  : t('supervision.board.humanValidation', 'Validation humaine')}
                <Switch
                  checked={auto}
                  onCheckedChange={(next) => onAutonomyChange(agent.id, next ? 'notify' : 'suggest')}
                  aria-label={`${t('supervision.board.autoApply', 'Auto-application')} — ${t(meta.nameKey)}`}
                />
              </label>
            </article>
          );
        })}
      </div>
    </section>
  );
}
