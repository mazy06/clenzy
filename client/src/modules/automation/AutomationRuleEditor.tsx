import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  AlertDescription,
  Button,
  Field,
  FieldLabel,
  FieldDescription,
  Input,
  NativeSelect,
  NativeSelectOption,
  NativeSelectOptGroup,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '../../components/ui';
import { ArrowForward, ChevronRight, Close } from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import { useCreateRule, useUpdateRule } from '../../hooks/useAutomationRules';
import { guestMessagingApi } from '../../services/api/guestMessagingApi';
import {
  TRIGGER_GROUPS,
  TRIGGER_ACTIONS,
  isLifecycleTrigger,
  isMessagingAction,
  actionNeedsTemplate,
  actionUsesGraceHours,
  parseActionConfig,
  stringifyGraceHours,
  type AutomationRule,
  type CreateAutomationRuleData,
  type AutomationTrigger,
  type AutomationAction,
  type MessageChannelType,
} from '../../services/api/automationRulesApi';
import ConditionsEditor from './ConditionsEditor';
import {
  actionLabel,
  triggerLabel,
  ruleTiming,
} from './automationPresentation';

const EMPTY_FORM: CreateAutomationRuleData = {
  name: '',
  triggerType: 'RESERVATION_CONFIRMED',
  triggerOffsetDays: 0,
  triggerTime: '09:00',
  conditions: '',
  actionType: 'SEND_MESSAGE',
  deliveryChannel: 'EMAIL',
};

export default function AutomationRuleEditor({
  rule,
  onClose,
}: {
  rule: AutomationRule | null;
  onClose: () => void;
}) {
  const { t, isArabic } = useTranslation();
  const [form, setForm] = useState<CreateAutomationRuleData>(() =>
    rule
      ? {
          name: rule.name,
          triggerType: rule.triggerType,
          triggerOffsetDays: rule.triggerOffsetDays,
          triggerTime: rule.triggerTime ?? '09:00',
          conditions: rule.conditions ?? '',
          actionType: rule.actionType,
          actionConfig: rule.actionConfig ?? undefined,
          templateId: rule.templateId ?? undefined,
          deliveryChannel: rule.deliveryChannel ?? 'EMAIL',
        }
      : { ...EMPTY_FORM },
  );
  const createMutation = useCreateRule();
  const updateMutation = useUpdateRule();
  const busy = createMutation.isPending || updateMutation.isPending;
  const failed = createMutation.isError || updateMutation.isError;
  const needsTemplate =
    !!form.actionType && actionNeedsTemplate(form.actionType);
  const {
    data: templates = [],
    isLoading: templatesLoading,
    isError: templatesFailed,
    refetch: reloadTemplates,
  } = useQuery({
    queryKey: ['message-templates'],
    queryFn: () => guestMessagingApi.getTemplates(),
    staleTime: 120_000,
    enabled: needsTemplate,
  });
  const patch = (values: Partial<CreateAutomationRuleData>) =>
    setForm((previous) => ({ ...previous, ...values }));
  const changeTrigger = (triggerType: AutomationTrigger) => {
    const allowed = TRIGGER_ACTIONS[triggerType] ?? [];
    patch({
      triggerType,
      actionType:
        form.actionType && allowed.includes(form.actionType)
          ? form.actionType
          : allowed[0],
      triggerOffsetDays: isLifecycleTrigger(triggerType)
        ? form.triggerOffsetDays
        : 0,
    });
  };
  const submit = () => {
    const data = { ...form, name: form.name.trim() };
    if (rule)
      updateMutation.mutate({ id: rule.id, data }, { onSuccess: onClose });
    else createMutation.mutate(data, { onSuccess: onClose });
  };

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <SheetContent
        side={isArabic ? 'left' : 'right'}
        className="automation-sheet"
        showCloseButton={false}
      >
        <SheetHeader className="automation-sheet-header">
          <p className="automation-eyebrow">
            {t('automation.title', 'Règles d’automatisation')}
          </p>
          <SheetTitle>
            {rule
              ? t('automation.editTitle', 'Modifier la règle')
              : t('automation.createTitle', 'Nouvelle règle')}
          </SheetTitle>
          <SheetDescription>
            {t(
              'automation.editorDescription',
              'Choisissez quand agir, puis ce que Baitly doit faire.',
            )}
          </SheetDescription>
          <Button
            className="automation-sheet-close"
            variant="ghost"
            size="icon"
            onClick={onClose}
            disabled={busy}
            aria-label={t('common.close', 'Fermer')}
          >
            <Close size={18} />
          </Button>
        </SheetHeader>
        <form
          id="automation-editor"
          className="automation-editor-body"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          {failed && (
            <Alert variant="destructive">
              <AlertDescription>
                {t(
                  'automation.saveError',
                  'Impossible d’enregistrer la règle. Vos modifications sont conservées, réessayez.',
                )}
              </AlertDescription>
            </Alert>
          )}
          <fieldset disabled={busy} className="automation-editor-fields">
            <Field>
              <FieldLabel htmlFor="automation-rule-name">
                {t('automation.form.name', 'Nom de la règle')}
              </FieldLabel>
              <Input
                id="automation-rule-name"
                autoFocus
                required
                value={form.name}
                onChange={(event) => patch({ name: event.target.value })}
                placeholder={t(
                  'automation.form.namePlaceholder',
                  'Ex. Envoyer les informations d’arrivée',
                )}
              />
            </Field>
            <section className="automation-editor-section">
              <h3>
                <span>01</span>
                {t('automation.editorWhen', 'Quand déclencher la règle ?')}
              </h3>
              <Field>
                <FieldLabel htmlFor="automation-trigger">
                  {t('automation.form.trigger', 'Déclencheur')}
                </FieldLabel>
                <NativeSelect
                  id="automation-trigger"
                  className="w-full"
                  value={form.triggerType}
                  onChange={(event) =>
                    changeTrigger(event.target.value as AutomationTrigger)
                  }
                >
                  {TRIGGER_GROUPS.map((group, index) => (
                    <NativeSelectOptGroup
                      key={group.label}
                      label={
                        index === 0
                          ? t('automation.scheduled', 'Cycle du séjour')
                          : t('automation.event', 'Événements')
                      }
                    >
                      {group.triggers.map((trigger) => (
                        <NativeSelectOption key={trigger} value={trigger}>
                          {triggerLabel(t, trigger)}
                        </NativeSelectOption>
                      ))}
                    </NativeSelectOptGroup>
                  ))}
                </NativeSelect>
              </Field>
              {isLifecycleTrigger(form.triggerType) ? (
                <div className="automation-field-pair">
                  <Field>
                    <FieldLabel htmlFor="automation-offset-days">
                      {t('automation.form.offset', 'Décalage (jours)')}
                    </FieldLabel>
                    <Input
                      id="automation-offset-days"
                      type="number"
                      required
                      min={-30}
                      max={30}
                      step={1}
                      className="tabular-nums"
                      value={form.triggerOffsetDays}
                      onChange={(event) =>
                        patch({ triggerOffsetDays: Number(event.target.value) })
                      }
                    />
                    <FieldDescription>
                      {t(
                        'automation.form.offsetHelp',
                        'Négatif avant, positif après.',
                      )}
                    </FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="automation-trigger-time">
                      {t('automation.form.time', 'Heure')}
                    </FieldLabel>
                    <Input
                      id="automation-trigger-time"
                      type="time"
                      required
                      className="tabular-nums"
                      value={form.triggerTime ?? '09:00'}
                      onChange={(event) =>
                        patch({ triggerTime: event.target.value })
                      }
                    />
                  </Field>
                </div>
              ) : (
                <p className="automation-meta">
                  {t('automation.immediate', 'À réception de l’événement')}
                </p>
              )}
            </section>
            <section className="automation-editor-section">
              <h3>
                <span>02</span>
                {t('automation.editorThen', 'Quelle action effectuer ?')}
              </h3>
              <Field>
                <FieldLabel htmlFor="automation-action">
                  {t('automation.form.action', 'Action')}
                </FieldLabel>
                <NativeSelect
                  id="automation-action"
                  className="w-full"
                  value={form.actionType ?? ''}
                  onChange={(event) =>
                    patch({
                      actionType: event.target.value as AutomationAction,
                    })
                  }
                >
                  {Array.from(
                    new Set([
                      ...(TRIGGER_ACTIONS[form.triggerType] ?? []),
                      ...(form.actionType ? [form.actionType] : []),
                    ]),
                  ).map((action) => (
                    <NativeSelectOption key={action} value={action}>
                      {actionLabel(t, action)}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              {form.actionType && isMessagingAction(form.actionType) && (
                <Field>
                  <FieldLabel htmlFor="automation-channel">
                    {t('automation.form.channel', 'Canal d’envoi')}
                  </FieldLabel>
                  <NativeSelect
                    id="automation-channel"
                    className="w-full"
                    value={form.deliveryChannel ?? 'EMAIL'}
                    onChange={(event) =>
                      patch({
                        deliveryChannel: event.target
                          .value as MessageChannelType,
                      })
                    }
                  >
                    <NativeSelectOption value="EMAIL">
                      {t('automation.email', 'Email')}
                    </NativeSelectOption>
                    <NativeSelectOption value="SMS">SMS</NativeSelectOption>
                    <NativeSelectOption value="WHATSAPP">
                      WhatsApp
                    </NativeSelectOption>
                  </NativeSelect>
                </Field>
              )}
              {needsTemplate && (
                <Field>
                  <FieldLabel htmlFor="automation-template">
                    {t('automation.form.template', 'Modèle de message')}
                  </FieldLabel>
                  <NativeSelect
                    id="automation-template"
                    className="w-full"
                    disabled={templatesLoading || templatesFailed}
                    value={form.templateId ?? ''}
                    onChange={(event) =>
                      patch({
                        templateId: event.target.value
                          ? Number(event.target.value)
                          : undefined,
                      })
                    }
                  >
                    <NativeSelectOption value="">
                      {templatesLoading
                        ? t('common.loading', 'Chargement…')
                        : t('automation.form.noTemplate', 'Aucun')}
                    </NativeSelectOption>
                    {form.templateId &&
                      !templates.some(
                        (template) => template.id === form.templateId,
                      ) && (
                        <NativeSelectOption value={form.templateId}>
                          {rule?.templateName ?? `#${form.templateId}`}
                        </NativeSelectOption>
                      )}
                    {templates.map((template) => (
                      <NativeSelectOption key={template.id} value={template.id}>
                        {template.name}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                  {templatesFailed && (
                    <div className="automation-meta">
                      {t(
                        'automation.templatesError',
                        'Impossible de charger les modèles.',
                      )}{' '}
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        onClick={() => void reloadTemplates()}
                      >
                        {t('common.retry', 'Réessayer')}
                      </Button>
                    </div>
                  )}
                </Field>
              )}
              {form.actionType && actionUsesGraceHours(form.actionType) && (
                <Field>
                  <FieldLabel htmlFor="automation-grace-hours">
                    {t('automation.form.graceHours', 'Délai de grâce (heures)')}
                  </FieldLabel>
                  <Input
                    id="automation-grace-hours"
                    type="number"
                    min={0}
                    max={72}
                    step={1}
                    required
                    className="tabular-nums"
                    value={parseActionConfig(form.actionConfig).graceHours ?? 4}
                    onChange={(event) =>
                      patch({
                        actionConfig: stringifyGraceHours(
                          Number(event.target.value),
                        ),
                      })
                    }
                  />
                  <FieldDescription>
                    {t(
                      'automation.form.graceHoursHelp',
                      'Le code d’accès est révoqué ce nombre d’heures après le départ.',
                    )}
                  </FieldDescription>
                </Field>
              )}
            </section>
            <details className="automation-editor-conditions">
              <summary>
                <ChevronRight
                  size={16}
                  className="automation-disclosure-icon cn-rtl-flip"
                />
                <span>
                  {t(
                    'automation.form.conditionsSection',
                    'Conditions et logements',
                  )}
                </span>
                <span className="automation-meta">
                  {form.conditions && form.conditions !== '{}'
                    ? t('automation.configured', 'Configurées')
                    : t('automation.optional', 'Facultatif')}
                </span>
              </summary>
              <ConditionsEditor
                value={form.conditions ?? undefined}
                onChange={(conditions) => patch({ conditions })}
              />
            </details>
          </fieldset>
          <div className="automation-editor-recap">
            <p className="automation-eyebrow">
              {t('automation.summary', 'Résumé de la règle')}
            </p>
            <p>
              {triggerLabel(t, form.triggerType)}
              <span className="automation-meta tabular-nums">
                {ruleTiming(t, {
                  ...form,
                  triggerTime: form.triggerTime ?? '',
                })}
              </span>
            </p>
            <ArrowForward size={16} className="cn-rtl-flip" aria-hidden />
            <p>{form.actionType && actionLabel(t, form.actionType)}</p>
          </div>
        </form>
        <SheetFooter className="automation-sheet-footer">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={busy}
          >
            {t('common.cancel', 'Annuler')}
          </Button>
          <Button
            type="submit"
            form="automation-editor"
            disabled={busy || !form.name.trim()}
          >
            {busy
              ? t('automation.saving', 'Enregistrement…')
              : rule
                ? t('common.save', 'Enregistrer')
                : t('automation.create', 'Créer la règle')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
