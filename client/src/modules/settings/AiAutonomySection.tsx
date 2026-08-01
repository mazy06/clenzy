import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, AlertDescription } from '../../components/ui';
import { TriangleAlert } from 'lucide-react';
import { Card } from '../../components/ui';
import { Button, FormControl, InputLabel, LinearProgress, MenuItem, Select, Skeleton, Switch, Table, TableBody, TableCell, TableHead, TableRow, TextField } from '@mui/material';
import { ShieldCheck, Gauge } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import StatusChip, { type StatusTone } from '../../components/StatusChip';
import {
  aiAutonomyApi,
  type AutonomyBudget,
  type TrustRule,
} from '../../services/api/aiAutonomyApi';

/**
 * Autonomie des agents (campagnes X2 + X4) : sous-budget premium (plafond,
 * comportement au plafond, toggles de comportements) + Règles de Confiance
 * (validations apprises, visibles et révocables). Rendu dans
 * Paramètres > IA > Supervision.
 */

const TRUST_STATUS_TONE: Record<TrustRule['status'], StatusTone> = {
  SUGGESTED: 'warn',
  ACTIVE: 'ok',
  DISMISSED: 'neutral',
  REVOKED: 'neutral',
};

// Comportements premium branchés côté serveur (X8-b) — affichés même absents du
// JSON de l'org (défaut : désactivé). S'allonge au fil des branchements.
const KNOWN_BEHAVIOR_KEYS = ['supervision_scan'];

function parseBehaviors(json: string): Record<string, boolean> {
  let parsed: Record<string, boolean> = {};
  try {
    const raw = JSON.parse(json);
    if (raw && typeof raw === 'object') parsed = raw;
  } catch {
    /* JSON invalide → défauts */
  }
  return {
    ...Object.fromEntries(KNOWN_BEHAVIOR_KEYS.map((k) => [k, false])),
    ...parsed,
  };
}

export default function AiAutonomySection() {
  const { t } = useTranslation();

  const [budget, setBudget] = useState<AutonomyBudget | null>(null);
  const [rules, setRules] = useState<TrustRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [acting, setActing] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Brouillon local de la config budget (enregistré via PUT explicite).
  const [capCredits, setCapCredits] = useState<string>('0');
  const [onCap, setOnCap] = useState<string>('NOTIFY_ONLY');
  const [behaviors, setBehaviors] = useState<Record<string, boolean>>({});

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([aiAutonomyApi.getBudget(), aiAutonomyApi.getTrustRules()])
      .then(([b, r]) => {
        setBudget(b);
        setRules(r);
        setCapCredits(String(b.premiumCapMillicredits / 1000));
        setOnCap(b.onCapBehavior);
        setBehaviors(parseBehaviors(b.behaviors));
        setError(null);
      })
      .catch(() => setError(t('aiAutonomy.loadError', "Impossible de charger la configuration d'autonomie.")))
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSaveBudget = useCallback(() => {
    const credits = Number(capCredits);
    if (!Number.isFinite(credits) || credits < 0) {
      setError(t('aiAutonomy.invalidCap', 'Plafond invalide.'));
      return;
    }
    setSaving(true);
    aiAutonomyApi
      .updateBudget({
        premiumCapMillicredits: Math.round(credits * 1000),
        onCapBehavior: onCap,
        behaviors: JSON.stringify(behaviors),
      })
      .then((saved) => {
        setBudget(saved);
        setError(null);
      })
      .catch(() => setError(t('aiAutonomy.saveError', "Impossible d'enregistrer la configuration.")))
      .finally(() => setSaving(false));
  }, [capCredits, onCap, behaviors, t]);

  const handleRuleAction = useCallback(
    (rule: TrustRule, action: 'accept' | 'dismiss' | 'revoke') => {
      setActing(rule.id);
      const call =
        action === 'accept'
          ? aiAutonomyApi.acceptTrustRule(rule.id)
          : action === 'dismiss'
            ? aiAutonomyApi.dismissTrustRule(rule.id)
            : aiAutonomyApi.revokeTrustRule(rule.id);
      call
        .then((updated) => {
          setRules((current) => current.map((r) => (r.id === updated.id ? updated : r)));
          setError(null);
        })
        .catch(() => setError(t('aiAutonomy.ruleActionError', "Impossible d'appliquer la décision.")))
        .finally(() => setActing(null));
    },
    [t],
  );

  const consumedCredits = budget ? budget.consumedMillicredits / 1000 : 0;
  const capValue = budget ? budget.premiumCapMillicredits / 1000 : 0;
  const gaugeRatio = useMemo(() => {
    if (!budget || budget.premiumCapMillicredits <= 0) return 0;
    return Math.min(100, (budget.consumedMillicredits / budget.premiumCapMillicredits) * 100);
  }, [budget]);
  const behaviorKeys = Object.keys(behaviors);

  if (loading) {
    return (
      <div className="flex flex-col gap-2 mb-3">
        <Skeleton variant="rounded" height={140} />
        <Skeleton variant="rounded" height={96} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 mb-3">
      {error && <Alert variant="warning">
        <TriangleAlert />
        <AlertDescription>{error}</AlertDescription>
      </Alert>}

      {/* ── Sous-budget d'autonomie premium (X4) ── */}
      <Card className="gap-0 py-0 p-2.5">
        <div className="flex items-center gap-1.5 mb-0.5">
          <Gauge size={18} aria-hidden />
          <h6 className="cn-text-subtitle2">
            {t('aiAutonomy.budgetTitle', "Budget d'autonomie premium")}
          </h6>
        </div>
        <span className="cn-text-caption text-muted-foreground block mb-2">
          {t(
            'aiAutonomy.budgetSubtitle',
            "Plafond mensuel des actions proactives premium. L'autonomie socle (auto-réponses, alertes, briefings) reste incluse et n'est jamais décomptée. Plafond à 0 = autonomie premium désactivée.",
          )}
        </span>

        <div className="mb-2">
          <div className="flex justify-between mb-0.5">
            <span className="cn-text-caption text-muted-foreground">
              {t('aiAutonomy.consumedThisCycle', 'Consommé ce cycle')}
            </span>
            <span className="cn-text-caption tabular-nums">
              {consumedCredits.toLocaleString()} / {capValue.toLocaleString()}{' '}
              {t('aiAutonomy.credits', 'crédits')}
            </span>
          </div>
          <LinearProgress
            variant="determinate"
            value={gaugeRatio}
            sx={{
              height: 6,
              borderRadius: 3,
              '& .MuiLinearProgress-bar': {
                backgroundColor: gaugeRatio >= 100 ? '#C97A7A' : gaugeRatio >= 80 ? '#D4A574' : '#4A9B8E',
              },
            }}
          />
        </div>

        <div className="flex gap-2 flex-wrap items-center">
          <TextField
            label={t('aiAutonomy.capLabel', 'Plafond (crédits / mois)')}
            type="number"
            size="small"
            value={capCredits}
            onChange={(e) => setCapCredits(e.target.value)}
            inputProps={{ min: 0, style: { fontVariantNumeric: 'tabular-nums' } }}
            sx={{ width: 200 }}
          />
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel>{t('aiAutonomy.onCapLabel', 'Au plafond')}</InputLabel>
            <Select
              value={onCap}
              label={t('aiAutonomy.onCapLabel', 'Au plafond')}
              onChange={(e) => setOnCap(e.target.value)}
            >
              <MenuItem value="NOTIFY_ONLY">
                {t('aiAutonomy.onCapNotify', 'Notifier seulement (suggestions sans exécution)')}
              </MenuItem>
              <MenuItem value="PAUSE">
                {t('aiAutonomy.onCapPause', "Mettre l'autonomie en pause")}
              </MenuItem>
            </Select>
          </FormControl>
          <Button
            variant="outlined"
            size="small"
            onClick={handleSaveBudget}
            disabled={saving}
            sx={{ textTransform: 'none' }}
          >
            {t('aiAutonomy.save', 'Enregistrer')}
          </Button>
        </div>

        {/* Toggles des comportements premium — alimentés au fil des branchements (X8-b). */}
        <div className="mt-2">
          {behaviorKeys.length === 0 ? (
            <span className="cn-text-caption text-muted-foreground">
              {t(
                'aiAutonomy.noBehaviors',
                'Aucun comportement premium branché pour le moment — les interrupteurs apparaîtront ici (ex. optimisation tarifaire proactive).',
              )}
            </span>
          ) : (
            behaviorKeys.map((key) => (
              <div className="flex items-center gap-0.5" key={key}>
                <Switch
                  size="small"
                  checked={Boolean(behaviors[key])}
                  onChange={(e) => setBehaviors((cur) => ({ ...cur, [key]: e.target.checked }))}
                />
                <p className="cn-text-body2">
                  {t(`aiAutonomy.behavior.${key}`, key)}
                </p>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* ── Règles de Confiance (X2) ── */}
      <Card className="gap-0 py-0 p-2.5">
        <div className="flex items-center gap-1.5 mb-0.5">
          <ShieldCheck size={18} aria-hidden />
          <h6 className="cn-text-subtitle2">
            {t('aiAutonomy.trustTitle', 'Règles de Confiance')}
          </h6>
        </div>
        <span className="cn-text-caption text-muted-foreground block mb-1.5">
          {t(
            'aiAutonomy.trustSubtitle',
            "Quand vous confirmez plusieurs fois la même action, l'assistant propose de ne plus demander. Chaque règle est visible et révocable ici — les actions d'argent ne sont jamais éligibles.",
          )}
        </span>

        {rules.length === 0 ? (
          <span className="cn-text-caption text-muted-foreground">
            {t('aiAutonomy.noRules', 'Aucune règle pour le moment — elles apparaissent après plusieurs confirmations de la même action.')}
          </span>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('aiAutonomy.rule.tool', 'Action')}</TableCell>
                <TableCell>{t('aiAutonomy.rule.status', 'Statut')}</TableCell>
                <TableCell align="right">{t('aiAutonomy.rule.confirmations', 'Confirmations')}</TableCell>
                <TableCell align="right">{t('aiAutonomy.rule.actions', '')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rules.map((rule) => (
                <TableRow key={rule.id} hover>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>
                    {rule.toolName}
                  </TableCell>
                  <TableCell>
                    <StatusChip
                      tone={TRUST_STATUS_TONE[rule.status]}
                      label={t(`aiAutonomy.status.${rule.status}`, rule.status)}
                    />
                  </TableCell>
                  <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    {rule.confirmationsSeen}
                  </TableCell>
                  <TableCell align="right">
                    {rule.status === 'SUGGESTED' && (
                      <>
                        <Button
                          size="small"
                          disabled={acting === rule.id}
                          onClick={() => handleRuleAction(rule, 'accept')}
                          sx={{ textTransform: 'none' }}
                        >
                          {t('aiAutonomy.accept', 'Accepter')}
                        </Button>
                        <Button
                          size="small"
                          color="inherit"
                          disabled={acting === rule.id}
                          onClick={() => handleRuleAction(rule, 'dismiss')}
                          sx={{ textTransform: 'none' }}
                        >
                          {t('aiAutonomy.dismiss', 'Ignorer')}
                        </Button>
                      </>
                    )}
                    {rule.status === 'ACTIVE' && (
                      <Button
                        size="small"
                        color="inherit"
                        disabled={acting === rule.id}
                        onClick={() => handleRuleAction(rule, 'revoke')}
                        sx={{ textTransform: 'none' }}
                      >
                        {t('aiAutonomy.revoke', 'Révoquer')}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
