/* ============================================================
   « Constellation : actions automatiques » (Vagues 1-2 autonomie)

   Section du menu Automatisation : toggles d'auto-application PAR TYPE
   d'action de la constellation (catalogue serveur, V1 : ménage manquant,
   brouillon d'avis, ajustement tarifaire · V2 : blocage calendrier,
   libération/remboursement de caution). Par type : toggle, niveau
   (Notifier / Silencieux) borné par le PLAFOND du module (niveau de
   l'agent, affiché quand il bride) ET par le niveau MAX du type
   (cautions/blocage = jamais silencieux), enveloppe éditable, conditions
   non éditables affichées en texte informatif, et taux d'acceptation du
   type (aide à la décision d'activation).

   Rien n'est activé par défaut (opt-in total). L'onglet est réservé aux
   rôles autorisés à consulter la supervision.
   ============================================================ */

import React, { useCallback } from 'react';
import StatusChip, { type ToneTokens } from '../../components/StatusChip';
import {
  Alert,
  AlertDescription,
  Button,
  Card,
  Field,
  FieldLabel,
  Input,
  NativeSelect,
  NativeSelectOption,
  Switch,
  Skeleton,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../components/ui';
import EmptyState from '../../components/EmptyState';
import { Bolt } from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import { useAuth } from '../../hooks/useAuth';
import {
  useSupervisionAutoRules,
  useUpdateSupervisionAutoRules,
  useDismissAutoRuleSuggestion,
  type SupervisionAutoRule,
} from '../supervision/useSupervisionAutoRules';
import { useSupervisionReport } from '../supervision/core/useSupervisionReport';

// Chips soft (fond `-soft` + texte `-ink`, Baitly UI §2.4, comme la page).
const TONE_SUCCESS: ToneTokens = {
  color: 'var(--bui-success-ink)',
  bg: 'var(--bui-success-soft)',
};
const TONE_PRIMARY: ToneTokens = {
  color: 'var(--bui-primary)',
  bg: 'var(--bui-primary-soft)',
};
/** Puce « donnée brute » : encre de lecture sur fond de champ. */
const TONE_PLAIN: ToneTokens = {
  color: 'var(--bui-foreground)',
  bg: 'var(--bui-field)',
};
/** Même puce, en sourdine quand la valeur n'est pas encore renseignée. */
const TONE_MUTED: ToneTokens = {
  color: 'var(--bui-muted-foreground)',
  bg: 'var(--bui-field)',
};

/** Lit une borne entière de l'enveloppe JSON (repli sur le défaut serveur). */
function envelopeInt(
  envelope: string | null,
  key: string,
  defaultValue: number,
): number {
  if (!envelope) return defaultValue;
  try {
    const parsed = JSON.parse(envelope) as Record<string, unknown>;
    return typeof parsed[key] === 'number'
      ? (parsed[key] as number)
      : defaultValue;
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

  const {
    data: rules = [],
    isError,
    isLoading,
    refetch,
  } = useSupervisionAutoRules();
  const updateMutation = useUpdateSupervisionAutoRules();
  const dismissSuggestionMutation = useDismissAutoRuleSuggestion();
  // Acceptation par type (fenêtre 30 j), aide à la décision d'activation.
  const { report } = useSupervisionReport(30);

  const saveRule = useCallback(
    (rule: SupervisionAutoRule, patch: Partial<SupervisionAutoRule>) => {
      updateMutation.mutate([{ ...rule, ...patch }]);
    },
    [updateMutation],
  );

  const acceptanceFor = (rule: SupervisionAutoRule) =>
    report?.acceptanceByType?.find(
      (row) =>
        row.moduleKey === rule.moduleKey && row.actionType === rule.actionType,
    );

  return (
    <section
      className="automation-agents"
      aria-labelledby="automation-agents-heading"
    >
      <div className="flex items-center gap-1.5 mb-0.5">
        <h2 id="automation-agents-heading">
          {t('automation.constellation.title', 'Actions des agents')}
        </h2>
      </div>
      <p className="mb-5 mt-1 max-w-[70ch] text-[0.8125rem] leading-relaxed text-muted-foreground">
        {t(
          'automation.constellation.subtitle',
          'Les agents appliquent eux-mêmes certaines actions sûres, sous enveloppe. Le niveau de chaque agent reste le plafond ; hors enveloppe, une carte à valider est créée comme aujourd’hui.',
        )}
      </p>

      {isLoading ? (
        <Card
          className="automation-loading"
          aria-label={t('common.loading', 'Chargement…')}
        >
          {[0, 1, 2].map((id) => (
            <div key={id}>
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="mt-3 h-3 w-3/5" />
            </div>
          ))}
        </Card>
      ) : isError ? (
        <Alert variant="destructive">
          <AlertDescription>
            {t(
              'automation.constellation.error',
              'Impossible de charger les actions des agents.',
            )}
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              {t('common.retry', 'Réessayer')}
            </Button>
          </AlertDescription>
        </Alert>
      ) : !rules.length ? (
        <EmptyState
          icon={<Bolt />}
          title={t(
            'automation.constellation.empty',
            'Aucune action disponible',
          )}
          description={t(
            'automation.constellation.emptyDesc',
            'Les actions automatisables de vos agents apparaîtront ici.',
          )}
        />
      ) : (
        <Card className="automation-agent-list">
          {rules.map((rule) => {
            const ceiling = rule.moduleCeiling; // 'suggest' | 'notify' | 'full'
            const cappedToSuggest = ceiling === 'suggest';
            const acceptance = acceptanceFor(rule);
            const decided = acceptance
              ? acceptance.applied + acceptance.dismissed
              : 0;
            const moduleLabel = t(
              `supervision.agents.${rule.moduleKey}.name`,
              rule.moduleKey,
            );

            // Le Switch du kit ne transmet pas de ref : span d'ancrage pour le Tooltip.
            const switchCell = (
              <span className="inline-flex justify-self-start">
                <Switch
                  size="sm"
                  aria-label={t(
                    `automation.constellation.types.${rule.actionType}.label`,
                    rule.actionType,
                  )}
                  checked={rule.enabled}
                  onCheckedChange={(checked) =>
                    saveRule(rule, { enabled: checked })
                  }
                  disabled={
                    !canEdit || cappedToSuggest || updateMutation.isPending
                  }
                />
              </span>
            );

            return (
              <div className="automation-agent-row" key={rule.actionType}>
                {cappedToSuggest ? (
                  <Tooltip>
                    <TooltipTrigger asChild>{switchCell}</TooltipTrigger>
                    <TooltipContent>
                      {t(
                        'automation.constellation.cappedTooltip',
                        'Niveau de l’agent {{agent}} : Suggestion. Passez-le en « Agir puis notifier » ou « Auto » pour activer.',
                        { agent: moduleLabel },
                      )}
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  switchCell
                )}

                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {t(
                      `automation.constellation.types.${rule.actionType}.label`,
                      rule.actionType,
                    )}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {t(
                      `automation.constellation.types.${rule.actionType}.description`,
                      '',
                    )}
                  </p>
                  {t(
                    `automation.constellation.types.${rule.actionType}.conditions`,
                    '',
                  ) !== '' && (
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {t(
                        `automation.constellation.types.${rule.actionType}.conditions`,
                        '',
                      )}
                    </p>
                  )}
                  {cappedToSuggest && (
                    <p className="text-xs font-semibold text-warning-ink">
                      {t(
                        'automation.constellation.cappedBySuggest',
                        'Plafonné par le niveau de l’agent {{agent}} : Suggestion',
                        { agent: moduleLabel },
                      )}
                    </p>
                  )}
                  {!cappedToSuggest &&
                    ceiling === 'notify' &&
                    rule.level === 'full' && (
                      <p className="text-xs font-semibold text-warning-ink">
                        {t(
                          'automation.constellation.cappedByNotify',
                          'Plafonné par le niveau de l’agent {{agent}} : Agir puis notifier',
                          { agent: moduleLabel },
                        )}
                      </p>
                    )}
                  {/* Règles de Confiance (V3) : recommandation « gagnée par l'historique »
                    INERTE, l'humain active ou ignore. Jamais sur un type déjà ON. */}
                  {!rule.enabled && rule.suggestedAt && (
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <StatusChip
                        tokens={TONE_SUCCESS}
                        label={t(
                          'automation.constellation.recommended',
                          'Recommandé : {{count}} approbations consécutives',
                          { count: rule.consecutiveApprovals },
                        )}
                        className="tabular-nums"
                      />
                      {canEdit && (
                        <>
                          {/* Micro-actions accolees a une pastille dans une ligne dense :
                            ghost xs, « Ignorer » en sourdine pour ne pas peser autant. */}
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => saveRule(rule, { enabled: true })}
                            disabled={
                              cappedToSuggest ||
                              updateMutation.isPending ||
                              dismissSuggestionMutation.isPending
                            }
                          >
                            {t(
                              'automation.constellation.enableSuggestion',
                              'Activer',
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="xs"
                            className="text-muted-foreground"
                            onClick={() =>
                              dismissSuggestionMutation.mutate(rule.actionType)
                            }
                            disabled={
                              updateMutation.isPending ||
                              dismissSuggestionMutation.isPending
                            }
                          >
                            {t(
                              'automation.constellation.ignoreSuggestion',
                              'Ignorer',
                            )}
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </div>

                <StatusChip tokens={TONE_PRIMARY} label={moduleLabel} />

                {/* Taux d'acceptation du type (30 j), aide à la décision d'activation. */}
                <Tooltip>
                  {/* StatusChip ne transmet pas de ref : span d'ancrage. */}
                  <TooltipTrigger asChild>
                    <span className="inline-flex">
                      <StatusChip
                        tokens={decided > 0 ? TONE_PLAIN : TONE_MUTED}
                        label={
                          decided > 0
                            ? `${t('automation.constellation.acceptance', 'Acceptation')} ${Math.round((acceptance?.acceptanceRate ?? 0) * 100)} % · ${decided}`
                            : t(
                                'automation.constellation.noDecisions',
                                'Pas encore de décision',
                              )
                        }
                        className="tabular-nums"
                      />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {t(
                      'automation.constellation.acceptanceTooltip',
                      'Taux d’acceptation des cartes de ce type sur 30 jours ({{count}} décisions). Activez quand il est durablement élevé.',
                      { count: decided },
                    )}
                  </TooltipContent>
                </Tooltip>

                <NativeSelect
                  size="sm"
                  aria-label={t(
                    'automation.constellation.levelLabel',
                    'Niveau d’automatisation',
                  )}
                  className="min-w-[168px] [&>select]:w-full [&>select]:text-[0.8125rem]"
                  value={rule.level}
                  onChange={(e) =>
                    saveRule(rule, {
                      level: e.target.value as 'notify' | 'full',
                    })
                  }
                  disabled={
                    !canEdit || cappedToSuggest || updateMutation.isPending
                  }
                >
                  <NativeSelectOption value="notify">
                    {t(
                      'automation.constellation.levelNotify',
                      'Appliquer et notifier',
                    )}
                  </NativeSelectOption>
                  {/* « Silencieux » : borné par le plafond du module ET le max du type
                    (cautions / blocage calendrier = notify max, jamais proposé). */}
                  {rule.maxLevel === 'full' && (
                    <NativeSelectOption
                      value="full"
                      disabled={ceiling !== 'full'}
                    >
                      {t(
                        'automation.constellation.levelFull',
                        'Appliquer en silence',
                      )}
                    </NativeSelectOption>
                  )}
                </NativeSelect>

                {/* Enveloppe éditable du type (défauts serveur AutoApplyGate) ; les
                  conditions non éditables sont affichées en texte informatif. */}
                {ENVELOPE_FIELDS[rule.actionType] ? (
                  // L'id derive du type d'action (une ligne par type) : stable et
                  // unique dans la liste, contrairement a l'index de boucle.
                  <Field className="w-[148px]">
                    <FieldLabel
                      htmlFor={`constellation-envelope-${rule.actionType}`}
                    >
                      {t(
                        ENVELOPE_FIELDS[rule.actionType].labelKey,
                        ENVELOPE_FIELDS[rule.actionType].labelDefault,
                      )}
                    </FieldLabel>
                    <Input
                      id={`constellation-envelope-${rule.actionType}`}
                      className="w-full tabular-nums"
                      type="number"
                      value={envelopeInt(
                        rule.envelope,
                        ENVELOPE_FIELDS[rule.actionType].key,
                        ENVELOPE_FIELDS[rule.actionType].defaultValue,
                      )}
                      onChange={(e) => {
                        const field = ENVELOPE_FIELDS[rule.actionType];
                        const value = Math.max(
                          field.min,
                          Math.min(field.max, Number(e.target.value) || 0),
                        );
                        saveRule(rule, {
                          envelope: JSON.stringify({ [field.key]: value }),
                        });
                      }}
                      disabled={
                        !canEdit || cappedToSuggest || updateMutation.isPending
                      }
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
      )}
    </section>
  );
};

export default ConstellationAutoRulesSection;
