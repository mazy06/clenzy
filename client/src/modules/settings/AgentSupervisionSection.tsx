import React from 'react';
import { cn } from '../../utils/cn';
import { Alert, AlertDescription } from '../../components/ui';
import { TriangleAlert, Info } from 'lucide-react';
import { Spinner } from '../../components/ui';
// Reste en MUI : le Snackbar de confirmation — changer le mecanisme de
// notification de l'ecran depasse le cadre de cette migration.
import { Snackbar } from '@mui/material';
import { Input, NativeSelect, Separator, Switch } from '../../components/ui';
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
    <div className="w-[10px] h-[10px] rounded-[50%] shrink-0" style={{ backgroundColor: color }} aria-hidden />
  );
}

/**
 * Section Settings > IA : config de la constellation Superviseur d'agents.
 * Master (activation org) + par module : activer/désactiver + niveau d'autonomie.
 * Source de vérité backend (org-scopée) via {@link useSupervisionConfig}.
 */
export default function AgentSupervisionSection() {
  const { t } = useTranslation();
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
        <div className="flex justify-center py-[18px]">
          <Spinner className="size-6" />
        </div>
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
              {/* Le titre du reglage EST le libelle de l'interrupteur : rendu en
                  <label> pour que le clic et le lecteur d'ecran l'atteignent. */}
              <label htmlFor="supervision-master" className="cn-text-body2 font-semibold block">
                {t('settings.ai.supervision.master.label', 'Activer le superviseur')}
              </label>
              <span className="cn-text-caption text-muted-foreground text-[0.72rem]">
                {t(
                  'settings.ai.supervision.master.description',
                  "Affiche la constellation dans le planning et autorise les agents à proposer des actions.",
                )}
              </span>
            </div>
            <Switch
              id="supervision-master"
              checked={config.enabled}
              onCheckedChange={handleMaster}
              disabled={!canEdit || busy}
              size="sm"
            />
          </div>

          <Separator />

          {/* ── Pause globale ── */}
          <div className={cn('flex items-center py-[9px]', config.enabled ? 'opacity-100' : 'opacity-50')}>
            <div className="flex-1 min-w-0">
              <label htmlFor="supervision-paused" className="cn-text-body2 font-semibold block">
                {t('settings.ai.supervision.paused.label', 'Mettre en pause')}
              </label>
              <span className="cn-text-caption text-muted-foreground text-[0.72rem]">
                {t(
                  'settings.ai.supervision.paused.description',
                  "Suspend temporairement l'activité automatique des agents (la config est conservée).",
                )}
              </span>
            </div>
            <Switch
              id="supervision-paused"
              checked={config.paused}
              onCheckedChange={handlePaused}
              disabled={!canEdit || busy || !config.enabled}
              size="sm"
            />
          </div>

          <Separator />

          {/* ── Budget (plafond de scans automatiques) ── */}
          <div className={cn('flex items-center py-[9px]', config.enabled ? 'opacity-100' : 'opacity-50')}>
            <div className="flex-1 min-w-0 pe-3">
              {/* Le titre du reglage EST le libelle du champ : rendu en <label>
                  pour que le clic et le lecteur d'ecran atteignent l'input. */}
              <label htmlFor="supervision-daily-budget" className="cn-text-body2 font-semibold block">
                {t('settings.ai.supervision.budget.label', 'Plafond de scans automatiques')}
              </label>
              <span className="cn-text-caption text-muted-foreground text-[0.72rem]">
                {t(
                  'settings.ai.supervision.budget.description',
                  "Nombre maximum d'analyses automatiques par jour pour l'organisation (0 = aucune analyse automatique). Limite le coût IA.",
                )}
              </span>
            </div>
            <Input
              id="supervision-daily-budget"
              type="number"
              min={0}
              step={1}
              className="w-16 shrink-0 text-end tabular-nums"
              value={budgetInput}
              onChange={(e) => setBudgetInput(e.target.value)}
              onBlur={handleBudgetCommit}
              disabled={!canEdit || busy || !config.enabled}
            />
          </div>

          <Separator className="mb-1.5" />

          {/* ── Modules ── */}
          <span className="cn-text-overline text-muted-foreground mt-1.5 mb-0.5 font-bold tracking-[0.04em]">
            {t('settings.ai.supervision.modules.title', 'Modules')}
          </span>

          {config.modules.map((module, index) => {
            const disabled = !canEdit || busy || !config.enabled;
            return (
              <React.Fragment key={module.key}>
                {index > 0 && <Separator className="ms-[18px] data-horizontal:w-auto" />}
                <div className={cn('flex items-center gap-[9px] py-[7.5px]', config.enabled && module.enabled ? 'opacity-100' : 'opacity-55')} style={{ transition: 'opacity 0.15s ease' }}>
                  <ModuleDot moduleKey={module.key} />
                  <div className="flex-1 min-w-0">
                    <p className="cn-text-body2 font-semibold leading-[1.3]">
                      {t(module.labelKey, module.key)}
                    </p>
                  </div>

                  {/* Niveau d'autonomie */}
                  <NativeSelect
                    aria-label={t('settings.ai.supervision.modules.autonomyLabel', "Niveau d'autonomie")}
                    className="min-w-[168px] shrink-0 [&_select]:text-[0.8rem]"
                    value={module.autonomy}
                    onChange={(e) => handleModule(module.key, { autonomy: e.target.value as AutonomyLevel })}
                    disabled={disabled || !module.enabled}
                  >
                    {AUTONOMY_LEVELS.map((level) => (
                      <option key={level} value={level}>
                        {t(AUTONOMY_LABEL_KEY[level], level)}
                      </option>
                    ))}
                  </NativeSelect>

                  {/* Activer/désactiver le module */}
                  <Switch
                    aria-label={t(module.labelKey, module.key)}
                    checked={module.enabled}
                    onCheckedChange={(checked) => handleModule(module.key, { enabled: checked })}
                    disabled={disabled}
                    size="sm"
                  />
                </div>
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
