import {
  Badge,
  Button,
  Switch,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '../../components/ui';
import {
  History,
  MoreHoriz,
  Edit,
  Delete,
  ArrowForward,
  Schedule,
  Bolt,
  Email,
  Sms,
  WhatsApp,
  Lock,
} from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import { useIconSize } from '../../hooks/useResponsiveSize';
import {
  isLifecycleTrigger,
  isMessagingAction,
  type AutomationRule,
} from '../../services/api/automationRulesApi';
import {
  actionLabel,
  triggerLabel,
  ruleScope,
  ruleTiming,
} from './automationPresentation';

interface AutomationRuleRowProps {
  rule: AutomationRule;
  canEdit: boolean;
  busy: boolean;
  onToggle: (id: number) => void;
  onEdit: (rule: AutomationRule) => void;
  onDelete: (rule: AutomationRule) => void;
  onHistory: (rule: AutomationRule) => void;
}

export default function AutomationRuleRow({
  rule,
  canEdit,
  busy,
  onToggle,
  onEdit,
  onDelete,
  onHistory,
}: AutomationRuleRowProps) {
  const { t } = useTranslation();
  const iconSize = useIconSize('action');
  const TriggerIcon = isLifecycleTrigger(rule.triggerType) ? Schedule : Bolt;
  const ChannelIcon =
    rule.deliveryChannel === 'SMS'
      ? Sms
      : rule.deliveryChannel === 'WHATSAPP'
        ? WhatsApp
        : Email;

  return (
    <li className="automation-rule" data-paused={!rule.enabled || undefined}>
      <div className="automation-rule-identity">
        <div className="automation-rule-title">
          <h3>
            {canEdit ? (
              <button type="button" onClick={() => onEdit(rule)}>
                {rule.name}
              </button>
            ) : (
              rule.name
            )}
          </h3>
          {!rule.enabled && (
            <Badge variant="secondary">
              {t('automation.paused', 'En pause')}
            </Badge>
          )}
        </div>
        <p className="automation-meta">{ruleScope(t, rule)}</p>
      </div>
      <div className="automation-rule-trigger">
        <span className="automation-mobile-label">
          {t('automation.when', 'Quand')}
        </span>
        <div className="automation-flow-label">
          <TriggerIcon size={iconSize} aria-hidden />
          <span>{triggerLabel(t, rule.triggerType)}</span>
        </div>
        <p className="automation-meta tabular-nums">{ruleTiming(t, rule)}</p>
      </div>
      <ArrowForward
        className="automation-flow-arrow cn-rtl-flip"
        size={iconSize}
        aria-hidden
      />
      <div className="automation-rule-action">
        <span className="automation-mobile-label">
          {t('automation.then', 'Alors')}
        </span>
        <p className="automation-action-label">
          {actionLabel(t, rule.actionType)}
        </p>
        <div className="automation-meta automation-delivery">
          {isMessagingAction(rule.actionType) && (
            <span>
              <ChannelIcon size={iconSize} aria-hidden />
              {rule.deliveryChannel === 'EMAIL'
                ? t('automation.email', 'Email')
                : rule.deliveryChannel === 'WHATSAPP'
                  ? 'WhatsApp'
                  : 'SMS'}
            </span>
          )}
          {rule.templateName && <span>{rule.templateName}</span>}
          {rule.actionType.startsWith('SUGGEST_') && (
            <span>
              <Lock size={iconSize} aria-hidden />
              {t('automation.approvalRequired', 'Validation humaine requise')}
            </span>
          )}
        </div>
      </div>
      <div className="automation-rule-controls">
        <label className="automation-rule-toggle">
          <Switch
            size="sm"
            checked={rule.enabled}
            onCheckedChange={() => onToggle(rule.id)}
            disabled={!canEdit || busy}
            aria-label={t(
              'automation.toggleRule',
              'Activer ou suspendre : {{name}}',
              { name: rule.name },
            )}
          />
          <span>
            {rule.enabled
              ? t('automation.active', 'Active')
              : t('automation.paused', 'En pause')}
          </span>
        </label>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t('automation.historyFor', 'Historique : {{name}}', {
                name: rule.name,
              })}
              onClick={() => onHistory(rule)}
            >
              <History size={iconSize} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {t('automation.executionsTitle', 'Historique des exécutions')}
          </TooltipContent>
        </Tooltip>
        {canEdit && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t('automation.actionsFor', 'Actions : {{name}}', {
                  name: rule.name,
                })}
              >
                <MoreHoriz size={iconSize} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="cursor-pointer"
                onSelect={() => onEdit(rule)}
              >
                <Edit size={iconSize} />
                {t('common.edit', 'Modifier')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer"
                variant="destructive"
                onSelect={() => onDelete(rule)}
              >
                <Delete size={iconSize} />
                {t('common.delete', 'Supprimer')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </li>
  );
}
