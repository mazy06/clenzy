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
import {
  Box, Typography, Button, Chip, Switch, Select, MenuItem, TextField, FormControl,
  Card, Tooltip,
} from '@mui/material';
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
const pillSx = (bg: string, color: string) => ({
  height: 22,
  fontSize: '0.6875rem',
  fontWeight: 600,
  backgroundColor: bg,
  color,
  border: 'none',
  borderRadius: 'var(--radius-pill)',
  '& .MuiChip-label': { px: 1 },
});

// Switch compact identique à la vue liste des règles.
const switchSx = {
  justifySelf: 'start',
  width: 30, height: 18, p: 0, display: 'flex',
  '& .MuiSwitch-switchBase': {
    p: 0, m: '2px',
    '&.Mui-checked': { transform: 'translateX(12px)' },
  },
  '& .MuiSwitch-thumb': { width: 14, height: 14, boxShadow: 'none' },
  '& .MuiSwitch-track': { borderRadius: 9, opacity: 1 },
} as const;

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
    <Box sx={{ mt: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        <Typography sx={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--ink)' }}>
          {t('automation.constellation.title', 'Constellation — actions automatiques')}
        </Typography>
      </Box>
      <Typography sx={{ fontSize: '0.8125rem', color: 'text.secondary', mb: 1.5 }}>
        {t(
          'automation.constellation.subtitle',
          'Les agents appliquent eux-mêmes certaines actions sûres, sous enveloppe. Le niveau de chaque agent reste le plafond ; hors enveloppe, une carte à valider est créée comme aujourd’hui.',
        )}
      </Typography>

      <Card sx={{ overflowX: 'auto' }}>
        {rules.map((rule, idx) => {
          const ceiling = rule.moduleCeiling; // 'suggest' | 'notify' | 'full'
          const cappedToSuggest = ceiling === 'suggest';
          const acceptance = acceptanceFor(rule);
          const decided = acceptance ? acceptance.applied + acceptance.dismissed : 0;
          const moduleLabel = t(`supervision.agents.${rule.moduleKey}.name`, rule.moduleKey);

          return (
            <Box
              key={rule.actionType}
              sx={{
                display: 'grid',
                gridTemplateColumns: 'auto minmax(220px, 1.6fr) auto minmax(150px, auto) auto auto',
                alignItems: 'center',
                columnGap: 1.5, px: 2, py: 1.25, minWidth: 760,
                borderTop: idx === 0 ? 'none' : '1px solid var(--hairline)',
              }}
            >
              <Tooltip
                title={cappedToSuggest
                  ? t('automation.constellation.cappedTooltip',
                      'Niveau de l’agent {{agent}} : Suggestion — passez-le en « Agir puis notifier » ou « Auto » pour activer.',
                      { agent: moduleLabel })
                  : ''}
              >
                <span>
                  <Switch
                    checked={rule.enabled}
                    onChange={(e) => saveRule(rule, { enabled: e.target.checked })}
                    disabled={!canEdit || cappedToSuggest || updateMutation.isPending}
                    sx={switchSx}
                  />
                </span>
              </Tooltip>

              <Box sx={{ minWidth: 0 }}>
                <Typography noWrap sx={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--ink)' }}>
                  {t(`automation.constellation.types.${rule.actionType}.label`, rule.actionType)}
                </Typography>
                <Typography noWrap sx={{ fontSize: '0.6875rem', color: 'text.secondary' }}>
                  {t(`automation.constellation.types.${rule.actionType}.description`, '')}
                </Typography>
                {t(`automation.constellation.types.${rule.actionType}.conditions`, '') !== '' && (
                  <Typography noWrap sx={{ fontSize: '0.6875rem', color: 'var(--muted)' }}>
                    {t(`automation.constellation.types.${rule.actionType}.conditions`, '')}
                  </Typography>
                )}
                {cappedToSuggest && (
                  <Typography sx={{ fontSize: '0.6875rem', color: 'var(--warn)', fontWeight: 600 }}>
                    {t('automation.constellation.cappedBySuggest',
                      'Plafonné par le niveau de l’agent {{agent}} : Suggestion',
                      { agent: moduleLabel })}
                  </Typography>
                )}
                {!cappedToSuggest && ceiling === 'notify' && rule.level === 'full' && (
                  <Typography sx={{ fontSize: '0.6875rem', color: 'var(--warn)', fontWeight: 600 }}>
                    {t('automation.constellation.cappedByNotify',
                      'Plafonné par le niveau de l’agent {{agent}} : Agir puis notifier',
                      { agent: moduleLabel })}
                  </Typography>
                )}
                {/* Règles de Confiance (V3) : recommandation « gagnée par l'historique »
                    — INERTE, l'humain active ou ignore. Jamais sur un type déjà ON. */}
                {!rule.enabled && rule.suggestedAt && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.5 }}>
                    <Chip
                      label={t('automation.constellation.recommended',
                        'Recommandé — {{count}} approbations consécutives',
                        { count: rule.consecutiveApprovals })}
                      size="small"
                      sx={{ ...pillSx('var(--ok-soft)', 'var(--ok)'), fontVariantNumeric: 'tabular-nums' }}
                    />
                    {canEdit && (
                      <>
                        <Button
                          size="small"
                          variant="text"
                          onClick={() => saveRule(rule, { enabled: true })}
                          disabled={cappedToSuggest || updateMutation.isPending || dismissSuggestionMutation.isPending}
                          sx={{ minWidth: 0, px: 0.75, fontSize: '0.6875rem', fontWeight: 700, textTransform: 'none' }}
                        >
                          {t('automation.constellation.enableSuggestion', 'Activer')}
                        </Button>
                        <Button
                          size="small"
                          variant="text"
                          onClick={() => dismissSuggestionMutation.mutate(rule.actionType)}
                          disabled={updateMutation.isPending || dismissSuggestionMutation.isPending}
                          sx={{ minWidth: 0, px: 0.75, fontSize: '0.6875rem', fontWeight: 600, textTransform: 'none', color: 'var(--muted)' }}
                        >
                          {t('automation.constellation.ignoreSuggestion', 'Ignorer')}
                        </Button>
                      </>
                    )}
                  </Box>
                )}
              </Box>

              <Chip label={moduleLabel} size="small" sx={pillSx('var(--accent-soft)', 'var(--accent)')} />

              {/* Taux d'acceptation du type (30 j) — aide à la décision d'activation. */}
              <Tooltip
                title={t('automation.constellation.acceptanceTooltip',
                  'Taux d’acceptation des cartes de ce type sur 30 jours ({{count}} décisions). Activez quand il est durablement élevé.',
                  { count: decided })}
              >
                <Chip
                  label={decided > 0
                    ? `${t('automation.constellation.acceptance', 'Acceptation')} ${Math.round((acceptance?.acceptanceRate ?? 0) * 100)} % · ${decided}`
                    : t('automation.constellation.noDecisions', 'Pas encore de décision')}
                  size="small"
                  sx={{
                    ...pillSx('var(--field)', decided > 0 ? 'var(--body)' : 'var(--muted)'),
                    fontVariantNumeric: 'tabular-nums',
                  }}
                />
              </Tooltip>

              <FormControl size="small" sx={{ minWidth: 168 }}>
                <Select
                  value={rule.level}
                  onChange={(e) => saveRule(rule, { level: e.target.value as 'notify' | 'full' })}
                  disabled={!canEdit || cappedToSuggest || updateMutation.isPending}
                  sx={{ fontSize: '0.8125rem' }}
                >
                  <MenuItem value="notify" sx={{ fontSize: '0.8125rem' }}>
                    {t('automation.constellation.levelNotify', 'Appliquer et notifier')}
                  </MenuItem>
                  {/* « Silencieux » : borné par le plafond du module ET le max du type
                      (cautions / blocage calendrier = notify max, jamais proposé). */}
                  {rule.maxLevel === 'full' && (
                    <MenuItem value="full" disabled={ceiling !== 'full'} sx={{ fontSize: '0.8125rem' }}>
                      {t('automation.constellation.levelFull', 'Appliquer en silence')}
                    </MenuItem>
                  )}
                </Select>
              </FormControl>

              {/* Enveloppe éditable du type (défauts serveur AutoApplyGate) ; les
                  conditions non éditables sont affichées en texte informatif. */}
              {ENVELOPE_FIELDS[rule.actionType] ? (
                <TextField
                  label={t(ENVELOPE_FIELDS[rule.actionType].labelKey,
                    ENVELOPE_FIELDS[rule.actionType].labelDefault)}
                  type="number"
                  size="small"
                  value={envelopeInt(rule.envelope, ENVELOPE_FIELDS[rule.actionType].key,
                    ENVELOPE_FIELDS[rule.actionType].defaultValue)}
                  onChange={(e) => {
                    const field = ENVELOPE_FIELDS[rule.actionType];
                    const value = Math.max(field.min, Math.min(field.max, Number(e.target.value) || 0));
                    saveRule(rule, { envelope: JSON.stringify({ [field.key]: value }) });
                  }}
                  disabled={!canEdit || cappedToSuggest || updateMutation.isPending}
                  inputProps={{
                    min: ENVELOPE_FIELDS[rule.actionType].min,
                    max: ENVELOPE_FIELDS[rule.actionType].max,
                    step: 1,
                    style: { fontVariantNumeric: 'tabular-nums' },
                  }}
                  sx={{ width: 148 }}
                />
              ) : (
                <Box />
              )}
            </Box>
          );
        })}
      </Card>
    </Box>
  );
};

export default ConstellationAutoRulesSection;
