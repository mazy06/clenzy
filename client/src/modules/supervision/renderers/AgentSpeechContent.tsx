import { useMemo } from 'react';
import { ArrowRight, Clock, Check } from 'lucide-react';
import { useTranslation } from '../../../hooks/useTranslation';
import { intlLocale } from '../../../utils/localeDate';
import { StockActionThumbnail } from '../../stock/StockActionThumbnail';
import { ActionIllustration } from '../components/ActionIllustration';
import { actionIllustration } from '../core/actionIllustration';
import { descriptionTitle, parseStockDescription, readActionParams } from '../core/actionDescription';
import { AGENT_META, STATUS } from '../constants';
import type { PendingAction } from '../types';
import type { ConstellationAgentView } from './ConstellationRenderer';
import { AgentPortrait } from './AgentPortrait';

const MAX_ITEMS = 3;

/** The same action imagery as the approval queue, including actual stock photos. */
function SpeechActionImage({ action, agent }: { action?: PendingAction; agent: ConstellationAgentView }) {
  const stock = action && parseStockDescription(action);
  if (stock) return <StockActionThumbnail name={stock.name} stockItemId={readActionParams(action.actionParams).stockItemId} size={48} />;
  const visual = actionIllustration(action, agent.id);
  return visual ? <ActionIllustration visual={visual} /> : null;
}

function SpeechAction({ action, agent }: { action?: PendingAction; agent: ConstellationAgentView }) {
  const { t, currentLanguage } = useTranslation();
  const number = useMemo(() => new Intl.NumberFormat(intlLocale(currentLanguage)), [currentLanguage]);
  const stock = action && parseStockDescription(action);
  const property = action && 'propertyName' in action && typeof action.propertyName === 'string' ? action.propertyName : null;
  const remaining = action ? new Date(action.expiresAt).getTime() - Date.now() : NaN;
  const hasDeadline = action && action.kind !== 'payment' && action.kind !== 'reminder' && Number.isFinite(remaining);
  const expired = hasDeadline && remaining <= 0;
  const urgent = hasDeadline && remaining > 0 && remaining < 3_600_000;
  const hours = Math.floor(remaining / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  const time = hours >= 1
    ? `${number.format(hours)} ${t('supervision.hitl.unitHour')} ${number.format(minutes).padStart(2, number.format(0))}`
    : minutes >= 1 ? `${number.format(minutes)} ${t('supervision.hitl.unitMin')}` : t('supervision.hitl.lessThanMin');
  const detail = !action ? t('supervision.board.inProgress')
    : action.kind === 'payment' ? t('supervision.speech.payment')
    : action.kind === 'reminder' ? t('supervision.speech.reminder')
    : expired ? t('supervision.hitl.expired')
    : hasDeadline ? t('supervision.hitl.expiresIn', { time })
    : t('supervision.board.queueTitle');

  return <li className="baitly-agent-speech-item">
    <SpeechActionImage action={action} agent={agent} />
    <div className="baitly-agent-speech-item-copy">
      <p className="baitly-agent-speech-item-title" dir="auto">
        {action ? descriptionTitle(action).trim() || t('supervision.payment.fallbackTitle') : agent.task}
      </p>
      {property && <p className="baitly-agent-speech-property" dir="auto">{property}</p>}
      <div className="baitly-agent-speech-item-meta" data-urgent={urgent || expired || undefined}>
        {stock && <span className="baitly-agent-speech-stock">{t('supervision.description.lowStock')}</span>}
        <span className="baitly-agent-speech-deadline">
          {hasDeadline && <Clock size={12} aria-hidden="true" />}
          <span>{detail}</span>
        </span>
      </div>
    </div>
  </li>;
}

/** A compact, illustrated preview. Decisions remain in the existing approval queue. */
export function AgentSpeechContent({ agent, waiting, isSelected }: {
  agent: ConstellationAgentView;
  waiting: readonly PendingAction[];
  isSelected: boolean;
}) {
  const { t, currentLanguage } = useTranslation();
  const meta = AGENT_META[agent.id];
  const number = useMemo(() => new Intl.NumberFormat(intlLocale(currentLanguage)), [currentLanguage]);
  const shown = waiting.slice(0, MAX_ITEMS);
  const showTask = !!agent.task && shown.length < MAX_ITEMS;
  const total = waiting.length + (agent.task ? 1 : 0);
  const rest = total - shown.length - (showTask ? 1 : 0);
  const pending = agent.pendingCount ?? waiting.length;

  return <div className="baitly-agent-speech-content">
    <header className="baitly-agent-speech-heading">
      <div className="baitly-agent-speech-identity">
        <div className="baitly-agent-speech-avatar"><AgentPortrait agentId={agent.id} /></div>
        <div className="baitly-agent-speech-heading-copy">
          <p className="baitly-agent-speech-title">{t('supervision.feed.agentLine', { name: t(meta.nameKey), defaultValue: 'Agent {{name}}' })}</p>
          <p className="baitly-agent-speech-role">{t(meta.roleKey)}</p>
        </div>
      </div>
      <div className="baitly-agent-speech-summary">
        <span className="baitly-agent-speech-count">
          <span className="baitly-agent-speech-status-dot" aria-hidden="true" />
          {pending > 0 ? <><strong>{number.format(pending)}</strong> {t('supervision.board.toValidate')}</> : t(STATUS[agent.status].labelKey)}
        </span>
        {agent.badge != null && agent.badge > 0 && <span className="baitly-agent-speech-scope">{number.format(agent.badge)} {t('supervision.portfolio.propertiesShort')}</span>}
      </div>
    </header>

    {total > 0 ? <ul className="baitly-agent-speech-items">
      {shown.map((action) => <SpeechAction key={action.id} action={action} agent={agent} />)}
      {showTask && <SpeechAction agent={agent} />}
    </ul> : <p className="baitly-agent-speech-empty">{t(pending > 0 ? 'supervision.speech.openPending' : 'supervision.speech.empty')}</p>}

    <p className="baitly-agent-speech-hint">
      <span>{isSelected ? t('supervision.speech.queueOpen')
        : rest > 0 ? t('supervision.speech.seeMore', { count: rest, number: number.format(rest) })
        : t('supervision.speech.openAgent')}</span>
      {isSelected ? <Check size={15} aria-hidden="true" /> : <ArrowRight size={15} className="baitly-agent-speech-arrow" aria-hidden="true" />}
    </p>
  </div>;
}
