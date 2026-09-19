import type { TFunction } from 'i18next';
import {
  ACTION_LABELS,
  TRIGGER_LABELS,
  isLifecycleTrigger,
  parseConditions,
  type AutomationAction,
  type AutomationRule,
  type AutomationTrigger,
} from '../../services/api/automationRulesApi';

export type RuleStatusFilter = '' | 'active' | 'paused';
export type RuleTriggerFilter = '' | 'scheduled' | 'event';

export const triggerLabel = (t: TFunction, trigger: AutomationTrigger) =>
  t(`automation.triggers.${trigger}`, TRIGGER_LABELS[trigger] ?? trigger);

export const actionLabel = (t: TFunction, action: AutomationAction) =>
  t(`automation.actions.${action}`, ACTION_LABELS[action] ?? action);

export function ruleTiming(
  t: TFunction,
  rule: Pick<
    AutomationRule,
    'triggerType' | 'triggerOffsetDays' | 'triggerTime'
  >,
) {
  if (!isLifecycleTrigger(rule.triggerType))
    return t('automation.immediate', 'À réception de l’événement');
  const days = rule.triggerOffsetDays;
  const offset =
    days === 0
      ? t('automation.sameDay', 'Le jour même')
      : days < 0
        ? t('automation.daysBefore', '{{count}} j avant', {
            count: Math.abs(days),
          })
        : t('automation.daysAfter', '{{count}} j après', { count: days });
  return [offset, rule.triggerTime?.slice(0, 5)].filter(Boolean).join(' · ');
}

export function ruleScope(
  t: TFunction,
  rule: Pick<AutomationRule, 'conditions'>,
) {
  const conditions = parseConditions(rule.conditions);
  const labels = [
    conditions.propertyIds?.length
      ? t('automation.propertyCount', '{{count}} logement(s)', {
          count: conditions.propertyIds.length,
        })
      : t('automation.allProperties', 'Tous les logements'),
  ];
  if (conditions.minNights)
    labels.push(
      t('automation.minNights', '{{count}} nuits min.', {
        count: conditions.minNights,
      }),
    );
  if (conditions.maxNights)
    labels.push(
      t('automation.maxNights', '{{count}} nuits max.', {
        count: conditions.maxNights,
      }),
    );
  if (conditions.guestLanguage)
    labels.push(conditions.guestLanguage.toUpperCase());
  return labels.join(' · ');
}

const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase();

export function filterRules(
  rules: AutomationRule[],
  filters: {
    status: RuleStatusFilter;
    trigger: RuleTriggerFilter;
    search: string;
  },
  t: TFunction,
) {
  const query = normalize(filters.search.trim());
  return rules
    .filter((rule) => {
      if (filters.status && rule.enabled !== (filters.status === 'active'))
        return false;
      if (
        filters.trigger &&
        isLifecycleTrigger(rule.triggerType) !==
          (filters.trigger === 'scheduled')
      )
        return false;
      return (
        !query ||
        normalize(
          [
            rule.name,
            rule.templateName,
            triggerLabel(t, rule.triggerType),
            actionLabel(t, rule.actionType),
          ].join(' '),
        ).includes(query)
      );
    })
    .sort((a, b) => a.sortOrder - b.sortOrder);
}
