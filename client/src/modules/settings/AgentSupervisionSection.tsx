import React from 'react';
import { Alert, AlertDescription } from '../../components/ui';
import { TriangleAlert, Info } from 'lucide-react';
import { Spinner } from '../../components/ui';
import { Box, Switch, Divider, Select, MenuItem, TextField, Snackbar, useTheme, alpha } from '@mui/material';
import AiSettingsCard from './AiSettingsCard';
import { useTranslation } from '../../hooks/useTranslation';
import { useAuth } from '../../hooks/useAuth';
import {
  useSupervisionConfig,
  useUpdateSupervisionConfig,
  type SupervisionConfig,
  type SupervisionModuleConfig,
} from '../../modules/supervision/useSupervisionConfig';
import { AGENT_META } from '../../modules/supervision/constants';
import type { AgentId, AutonomyLevel } from '../../modules/supervision/types';

const AUTONOMY_LEVELS: AutonomyLevel[] = ['suggest', 'notify', 'full'];
const AUTONOMY_LABEL_KEY: Record<AutonomyLevel, string> = {
  suggest: 'supervision.autonomy.suggest',
  notify: 'supervision.autonomy.notify',
  full: 'supervision.autonomy.full',
};

/** Pastille de couleur du module (lie visuellement à la constellation). */
function ModuleDot({ moduleKey }: { moduleKey: string }) {
  const color = AGENT_META[moduleKey as AgentId]?.color ?? 'var(--accent)';
  return (
    <Box
      sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: color, flexShrink: 0 }}
      aria-hidden
    />
  );
}

/**
 * Section Settings > IA : config de la constellation Superviseur d'agents.
 * Master (activation org) + par module : activer/désactiver + niveau d'autonomie.
 * Source de vérité backend (org-scopée) via {@link useSupervisionConfig}.
 */
export default function AgentSupervisionSection() {
  const { t } = useTranslation();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { hasAnyRole } = useAuth();
  // Écriture réservée aux admins d'org (aligné sur le PUT backend).
  const canEdit = hasAnyRole(['SUPER_ADMIN', 'SUPER_MANAGER', 'HOST']);

  const { data: config, isLoading, error } = useSupervisionConfig();
  const updateMutation = useUpdateSupervisionConfig();
  const [savedOpen, setSavedOpen] = React.useState(false);
  // Champ budget : édité localement, persisté au blur (évite un PUT par frappe).
  const [budgetInput, setBudgetInput] = React.useState('');
  React.useEffect(() => {
    if (config) setBudgetInput(String(config.dailyScanBudget));
  }, [config]);

  const persist = (next: SupervisionConfig) => {
    updateMutation.mutate(next, { onSuccess: () => setSavedOpen(true) });
  };

  const handleBudgetCommit = () => {
    if (!config) return;
    const parsed = Math.max(0, Math.floor(Number(budgetInput)));
    const value = Number.isFinite(parsed) ? parsed : config.dailyScanBudget;
    setBudgetInput(String(value));
    if (value !== config.dailyScanBudget) persist({ ...config, dailyScanBudget: value });
  };

  const handleMaster = (enabled: boolean) => {
    if (!config) return;
    persist({ ...config, enabled });
  };

  const handlePaused = (paused: boolean) => {
    if (!config) return;
    persist({ ...config, paused });
  };

  const handleModule = (key: string, patch: Partial<SupervisionModuleConfig>) => {
    if (!config) return;
    persist({
      ...config,
      modules: config.modules.map((m) => (m.key === key ? { ...m, ...patch } : m)),
    });
  };

  const busy = updateMutation.isPending;

  return (
    <AiSettingsCard
      title={t('settings.ai.supervision.title', "Superviseur d'agents (constellation)")}
      subtitle={t(
        'settings.ai.supervision.subtitle',
        "Activez la constellation et réglez l'autonomie de chaque module IA. Les modules importés apparaîtront ici.",
      )}
    >
      {isLoading ? (
        <Box display="flex" justifyContent="center" py={3}>
          <Spinner className="size-6" />
        </Box>
      ) : error ? (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertDescription>{t('settings.ai.supervision.loadError', "Impossible de charger la configuration.")}</AlertDescription>
        </Alert>
      ) : config ? (
        <div className="flex flex-col">
          {/* ── Master : activation de la feature ── */}
          <div className="flex items-center py-2">
            <div className="flex-1 min-w-0">
              <p className="cn-text-body2 font-semibold">
                {t('settings.ai.supervision.master.label', 'Activer le superviseur')}
              </p>
              <span className="cn-text-caption text-muted-foreground text-[0.72rem]">
                {t(
                  'settings.ai.supervision.master.description',
                  "Affiche la constellation dans le planning et autorise les agents à proposer des actions.",
                )}
              </span>
            </div>
            <Switch
              checked={config.enabled}
              onChange={(e) => handleMaster(e.target.checked)}
              disabled={!canEdit || busy}
              size="small"
            />
          </div>

          <Divider />

          {/* ── Pause globale ── */}
          <Box sx={{ display: 'flex', alignItems: 'center', py: 1.5, opacity: config.enabled ? 1 : 0.5 }}>
            <div className="flex-1 min-w-0">
              <p className="cn-text-body2 font-semibold">
                {t('settings.ai.supervision.paused.label', 'Mettre en pause')}
              </p>
              <span className="cn-text-caption text-muted-foreground text-[0.72rem]">
                {t(
                  'settings.ai.supervision.paused.description',
                  "Suspend temporairement l'activité automatique des agents (la config est conservée).",
                )}
              </span>
            </div>
            <Switch
              checked={config.paused}
              onChange={(e) => handlePaused(e.target.checked)}
              disabled={!canEdit || busy || !config.enabled}
              size="small"
            />
          </Box>

          <Divider />

          {/* ── Budget (plafond de scans automatiques) ── */}
          <Box sx={{ display: 'flex', alignItems: 'center', py: 1.5, opacity: config.enabled ? 1 : 0.5 }}>
            <div className="flex-1 min-w-0 pe-3">
              <p className="cn-text-body2 font-semibold">
                {t('settings.ai.supervision.budget.label', 'Plafond de scans automatiques')}
              </p>
              <span className="cn-text-caption text-muted-foreground text-[0.72rem]">
                {t(
                  'settings.ai.supervision.budget.description',
                  "Nombre maximum d'analyses automatiques par jour pour l'organisation (0 = aucune analyse automatique). Limite le coût IA.",
                )}
              </span>
            </div>
            <TextField
              type="number"
              size="small"
              value={budgetInput}
              onChange={(e) => setBudgetInput(e.target.value)}
              onBlur={handleBudgetCommit}
              disabled={!canEdit || busy || !config.enabled}
              inputProps={{ min: 0, step: 1, style: { textAlign: 'right', width: 64 } }}
              sx={{ flexShrink: 0 }}
            />
          </Box>

          <Divider sx={{ mb: 1 }} />

          {/* ── Modules ── */}
          <span className="cn-text-overline text-muted-foreground mt-1.5 mb-0.5 font-bold tracking-[0.04em]">
            {t('settings.ai.supervision.modules.title', 'Modules')}
          </span>

          {config.modules.map((module, index) => {
            const disabled = !canEdit || busy || !config.enabled;
            return (
              <React.Fragment key={module.key}>
                {index > 0 && <Divider sx={{ ml: 3 }} />}
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    py: 1.25,
                    opacity: config.enabled && module.enabled ? 1 : 0.55,
                    transition: 'opacity 0.15s ease',
                  }}
                >
                  <ModuleDot moduleKey={module.key} />
                  <div className="flex-1 min-w-0">
                    <p className="cn-text-body2 font-semibold leading-[1.3]">
                      {t(module.labelKey, module.key)}
                    </p>
                  </div>

                  {/* Niveau d'autonomie */}
                  <Select
                    value={module.autonomy}
                    onChange={(e) => handleModule(module.key, { autonomy: e.target.value as AutonomyLevel })}
                    disabled={disabled || !module.enabled}
                    size="small"
                    sx={{
                      minWidth: 168,
                      fontSize: '0.8rem',
                      bgcolor: isDark ? alpha('#fff', 0.03) : alpha('#000', 0.015),
                    }}
                  >
                    {AUTONOMY_LEVELS.map((level) => (
                      <MenuItem key={level} value={level} sx={{ fontSize: '0.8rem' }}>
                        {t(AUTONOMY_LABEL_KEY[level], level)}
                      </MenuItem>
                    ))}
                  </Select>

                  {/* Activer/désactiver le module */}
                  <Switch
                    checked={module.enabled}
                    onChange={(e) => handleModule(module.key, { enabled: e.target.checked })}
                    disabled={disabled}
                    size="small"
                  />
                </Box>
              </React.Fragment>
            );
          })}

          {!canEdit && (
            <Alert variant="info" className="mt-3">
              <Info />
              <AlertDescription>{t('settings.ai.supervision.readOnly', 'Lecture seule — seul un administrateur peut modifier ces réglages.')}</AlertDescription>
            </Alert>
          )}
          {updateMutation.isError && (
            <Alert variant="destructive" className="mt-3">
              <TriangleAlert />
              <AlertDescription>{t('settings.ai.supervision.saveError', "Échec de l'enregistrement. Réessayez.")}</AlertDescription>
            </Alert>
          )}
        </div>
      ) : null}

      <Snackbar
        open={savedOpen}
        autoHideDuration={2200}
        onClose={() => setSavedOpen(false)}
        message={t('settings.ai.supervision.saved', 'Configuration enregistrée')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </AiSettingsCard>
  );
}
