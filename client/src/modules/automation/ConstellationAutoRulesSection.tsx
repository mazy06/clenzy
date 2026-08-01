/* ============================================================
   « Constellation — actions automatiques » (Vagues 1-2 autonomie)

   Section du menu Automatisation : toggles d'auto-application PAR TYPE
   d'action de la constellation (catalogue serveur — V1 : ménage manquant,
   brouillon d'avis, ajustement tarifaire · V2 : blocage calendrier,
   libération/remboursement de caution). Par type : toggle, niveau
   (Notifier / Silencieux) borné par le PLAFOND du module (niveau de
   l'agent — affiché quand il bride) ET par le niveau MAX du type
   (cautions/blocage = jamais silencieux), enveloppe éditable, conditions
   non éditables affichées en texte informatif, et taux d'acceptation du
   type (aide à la décision d'activation).

   Rien n'est activé par défaut (opt-in total). La section se masque si
   l'utilisateur n'a pas les rôles de supervision (403 sur le GET).
   ============================================================ */

import React, { useCallback } from 'react';
import StatusChip from '../../components/StatusChip';
import {
  Button,
  Card,
  Field,
  FieldLabel,
  Input,
  NativeSelect,
  NativeSelectOption,
  Switch,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../components/ui';
import { useTranslation } from '../../hooks/useTranslation';
import { useAuth } from '../../hooks/useAuth';
import {
  useSupervisionAutoRules,
  useUpdateSupervisionAutoRules,
  useDismissAutoRuleSuggestion,
  type SupervisionAutoRule,
} from '../supervision/useSupervisionAutoRules';
import { useSupervisionReport } from '../supervision/core/useSupervisionReport';

// Chips soft (pilule fond -soft + texte couleur — même pattern que la page).

/** Lit une borne entière de l'enveloppe JSON (repli sur le défaut serveur). */
function envelopeInt(envelope: string | null, key: string, defaultValue: number): number {
  if (!envelope) return defaultValue;
  try {
    const parsed = JSON.parse(envelope) as Record<string, unknown>;
    return typeof parsed[key] === 'number' ? (parsed[key] as number) : defaultValue;
  } catch {
    return defaultValue;
  }
}

/** Champ d'enveloppe éditable d'un type (défauts alignés sur AutoApplyGate). */
interface EnvelopeField {
  key: string;
  labelKey: string;
  labelDefault: string;
  defaultValue: number;
  min: number;
  max: number;
}

const ENVELOPE_FIELDS: Record<string, EnvelopeField> = {
  PRICE_DROP: {
    key: 'maxSegmentPercent',
    labelKey: 'automation.constellation.maxSegmentPercent',
    labelDefault: '% max / segment',
    defaultValue: 12,
    min: 1,
    max: 50,
  },
  CALENDAR_BLOCK: {
    key: 'maxAutoBlockDays',
    labelKey: 'automation.constellation.maxAutoBlockDays',
    labelDefault: 'Jours max (auto)',
    defaultValue: 7,
    min: 1,
    max: 30,
  },
  DEPOSIT_RELEASE: {
    key: 'minDaysAfterCheckout',
    labelKey: 'automation.constellation.minDaysAfterCheckout',
    labelDefault: 'Délai post-départ (j)',
    defaultValue: 2,
    min: 0,
    max: 30,
  },
};

const ConstellationAutoRulesSection: React.FC = () => {
  const { t } = useTranslation();
  const { hasAnyRole } = useAuth();
  // Écriture : mêmes rôles que PUT /api/ai/supervision/config (admins d'org inclus).
  const canEdit = hasAnyRole(['SUPER_ADMIN', 'SUPER_MANAGER', 'HOST']);

  const { data: rules, isError, isLoading } = useSupervisionAutoRules();
  const updateMutation = useUpdateSupervisionAutoRules();
  const dismissSuggestionMutation = useDismissAutoRuleSuggestion();
  // Acceptation par type (fenêtre 30 j) — aide à la décision d'activation.
  const { report } = useSupervisionReport(30);

  const saveRule = useCallback(
    (rule: SupervisionAutoRule, patch: Partial<SupervisionAutoRule>) => {
      updateMutation.mutate([{ ...rule, ...patch }]);
    },
    [updateMutation],
  );

  // 403 (rôle sans supervision) / erreur / chargement / vide → pas de section.
  if (isLoading || isError || !rules || rules.length === 0) return null;

  const acceptanceFor = (rule: SupervisionAutoRule) =>
    report?.acceptanceByType?.find(
      (row) => row.moduleKey === rule.moduleKey && row.actionType === rule.actionType,
    );

  return (
    <div className="mt-6">
      <div className="flex items-center gap-1.5 mb-0.5">
        <p className="cn-text-body1 text-[0.95rem] font-semibold text-[var(--ink)]">
          {t('automation.constellation.title', 'Constellation — actions automatiques')}
        </p>
      </div>
      <p className="cn-text-body1 text-[0.8125rem] text-muted-foreground mb-2">
        {t(
          'automation.constellation.subtitle',
          'Les agents appliquent eux-mêmes certaines actions sûres, sous enveloppe. Le niveau de chaque agent reste le plafond ; hors enveloppe, une carte à valider est créée comme aujourd’hui.',
        )}
      </p>

      <Card className="overflow-x-auto">
        {rules.map((rule, idx) => {
          const ceiling = rule.moduleCeiling; // 'suggest' | 'notify' | 'full'
          const cappedToSuggest = ceiling === 'suggest';
          const acceptance = acceptanceFor(rule);
          const decided = acceptance ? acceptance.applied + acceptance.dismissed : 0;
          const moduleLabel = t(`supervision.agents.${rule.moduleKey}.name`, rule.moduleKey);

          // Le Switch du kit ne transmet pas de ref : span d'ancrage pour le Tooltip.
          const switchCell = (
            <span className="inline-flex justify-self-start">
              <Switch
                size="sm"
                aria-label={t(`automation.constellation.types.${rule.actionType}.label`, rule.actionType)}
                checked={rule.enabled}
                onCheckedChange={(checked) => saveRule(rule, { enabled: checked })}
                disabled={!canEdit || cappedToSuggest || updateMutation.isPending}
              />
            </span>
          );

          return (
            <div className="grid grid-cols-[auto_minmax(220px,_1.6fr)_auto_minmax(150px,_auto)_auto_auto] items-center gap-x-[9px] px-3 py-[7.5px] min-w-[760px]" style={{ borderTop: idx === 0 ? 'none' : '1px solid var(--hairline)' }} key={rule.actionType}>
              {cappedToSuggest ? (
                <Tooltip>
                  <TooltipTrigger asChild>{switchCell}</TooltipTrigger>
                  <TooltipContent>
                    {t('automation.constellation.cappedTooltip',
                      'Niveau de l’agent {{agent}} : Suggestion — passez-le en « Agir puis notifier » ou « Auto » pour activer.',
                      { agent: moduleLabel })}
                  </TooltipContent>
                </Tooltip>
              ) : (
                switchCell
              )}

              <div className="min-w-0">
                <p className="cn-text-body1 truncate text-[0.8125rem] font-semibold text-[var(--ink)]">
                  {t(`automation.constellation.types.${rule.actionType}.label`, rule.actionType)}
                </p>
                <p className="cn-text-body1 truncate text-[0.6875rem] text-muted-foreground">
                  {t(`automation.constellation.types.${rule.actionType}.description`, '')}
                </p>
                {t(`automation.constellation.types.${rule.actionType}.conditions`, '') !== '' && (
                  <p className="cn-text-body1 truncate text-[0.6875rem] text-[var(--muted)]">
                    {t(`automation.constellation.types.${rule.actionType}.conditions`, '')}
                  </p>
                )}
                {cappedToSuggest && (
                  <p className="cn-text-body1 text-[0.6875rem] text-[var(--warn)] font-semibold">
                    {t('automation.constellation.cappedBySuggest',
                      'Plafonné par le niveau de l’agent {{agent}} : Suggestion',
                      { agent: moduleLabel })}
                  </p>
                )}
                {!cappedToSuggest && ceiling === 'notify' && rule.level === 'full' && (
                  <p className="cn-text-body1 text-[0.6875rem] text-[var(--warn)] font-semibold">
                    {t('automation.constellation.cappedByNotify',
                      'Plafonné par le niveau de l’agent {{agent}} : Agir puis notifier',
                      { agent: moduleLabel })}
                  </p>
                )}
                {/* Règles de Confiance (V3) : recommandation « gagnée par l'historique »
                    — INERTE, l'humain active ou ignore. Jamais sur un type déjà ON. */}
                {!rule.enabled && rule.suggestedAt && (
                  <div className="flex items-center gap-1 mt-0.5">
                    <StatusChip pill tokens={{ color: 'var(--ok)', bg: 'var(--ok-soft)' }} label={t('automation.constellation.recommended',
                        'Recommandé — {{count}} approbations consécutives',
                        { count: rule.consecutiveApprovals })} className="tabular-nums" />
                    {canEdit && (
                      <>
                        {/* Micro-actions accolees a une pastille dans une ligne dense :
                            ghost xs, « Ignorer » en sourdine pour ne pas peser autant. */}
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => saveRule(rule, { enabled: true })}
                          disabled={cappedToSuggest || updateMutation.isPending || dismissSuggestionMutation.isPending}
                        >
                          {t('automation.constellation.enableSuggestion', 'Activer')}
                        </Button>
                        <Button
                          variant="ghost"
                          size="xs"
                          className="text-[var(--muted)]"
                          onClick={() => dismissSuggestionMutation.mutate(rule.actionType)}
                          disabled={updateMutation.isPending || dismissSuggestionMutation.isPending}
                        >
                          {t('automation.constellation.ignoreSuggestion', 'Ignorer')}
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>

              <StatusChip pill tokens={{ color: 'var(--accent)', bg: 'var(--accent-soft)' }} label={moduleLabel} />

              {/* Taux d'acceptation du type (30 j) — aide à la décision d'activation. */}
              <Tooltip>
                {/* StatusChip ne transmet pas de ref : span d'ancrage. */}
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <StatusChip pill tokens={{ color: decided > 0 ? 'var(--body)' : 'var(--muted)', bg: 'var(--field)' }} label={decided > 0
                        ? `${t('automation.constellation.acceptance', 'Acceptation')} ${Math.round((acceptance?.acceptanceRate ?? 0) * 100)} % · ${decided}`
                        : t('automation.constellation.noDecisions', 'Pas encore de décision')} className="tabular-nums" />
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {t('automation.constellation.acceptanceTooltip',
                    'Taux d’acceptation des cartes de ce type sur 30 jours ({{count}} décisions). Activez quand il est durablement élevé.',
                    { count: decided })}
                </TooltipContent>
              </Tooltip>

              <NativeSelect
                size="sm"
                aria-label={t('automation.constellation.levelLabel', 'Niveau d’automatisation')}
                className="min-w-[168px] [&>select]:w-full [&>select]:text-[0.8125rem]"
                value={rule.level}
                onChange={(e) => saveRule(rule, { level: e.target.value as 'notify' | 'full' })}
                disabled={!canEdit || cappedToSuggest || updateMutation.isPending}
              >
                <NativeSelectOption value="notify">
                  {t('automation.constellation.levelNotify', 'Appliquer et notifier')}
                </NativeSelectOption>
                {/* « Silencieux » : borné par le plafond du module ET le max du type
                    (cautions / blocage calendrier = notify max, jamais proposé). */}
                {rule.maxLevel === 'full' && (
                  <NativeSelectOption value="full" disabled={ceiling !== 'full'}>
                    {t('automation.constellation.levelFull', 'Appliquer en silence')}
                  </NativeSelectOption>
                )}
              </NativeSelect>

              {/* Enveloppe éditable du type (défauts serveur AutoApplyGate) ; les
                  conditions non éditables sont affichées en texte informatif. */}
              {ENVELOPE_FIELDS[rule.actionType] ? (
                // L'id derive du type d'action (une ligne par type) : stable et
                // unique dans la liste, contrairement a l'index de boucle.
                <Field className="w-[148px]">
                  <FieldLabel htmlFor={`constellation-envelope-${rule.actionType}`}>
                    {t(ENVELOPE_FIELDS[rule.actionType].labelKey,
                      ENVELOPE_FIELDS[rule.actionType].labelDefault)}
                  </FieldLabel>
                  <Input
                    id={`constellation-envelope-${rule.actionType}`}
                    className="w-full tabular-nums"
                    type="number"
                    value={envelopeInt(rule.envelope, ENVELOPE_FIELDS[rule.actionType].key,
                      ENVELOPE_FIELDS[rule.actionType].defaultValue)}
                    onChange={(e) => {
                      const field = ENVELOPE_FIELDS[rule.actionType];
                      const value = Math.max(field.min, Math.min(field.max, Number(e.target.value) || 0));
                      saveRule(rule, { envelope: JSON.stringify({ [field.key]: value }) });
                    }}
                    disabled={!canEdit || cappedToSuggest || updateMutation.isPending}
                    min={ENVELOPE_FIELDS[rule.actionType].min}
                    max={ENVELOPE_FIELDS[rule.actionType].max}
                    step={1}
                  />
                </Field>
              ) : (
                <div />
              )}
            </div>
          );
        })}
      </Card>
    </div>
  );
};

export default ConstellationAutoRulesSection;
