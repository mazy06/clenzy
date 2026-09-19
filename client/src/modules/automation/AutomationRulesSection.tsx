import { useState } from 'react';
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Card,
  NativeSelect,
  NativeSelectOption,
  Skeleton,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../components/ui';
import { Add, ViewList, Layers, Bolt, Lock, FilterListOff } from '../../icons';
import { usePageHeaderActions } from '../../components/PageHeaderActionsContext';
import FilterChipRow from '../../components/FilterChipRow';
import NavCountBadge from '../../components/NavCountBadge';
import EmptyState from '../../components/EmptyState';
import ConfirmationModal from '../../components/ConfirmationModal';
import { useScreenSearch } from '../../components/ScreenChrome';
import { useTranslation } from '../../hooks/useTranslation';
import { useAuth } from '../../hooks/useAuth';
import { useIconSize } from '../../hooks/useResponsiveSize';
import { useUserPreference } from '../../hooks/useUserPreference';
import {
  useAutomationRules,
  useToggleRule,
  useDeleteRule,
} from '../../hooks/useAutomationRules';
import type { AutomationRule } from '../../services/api/automationRulesApi';
import AutomationRuleRow from './AutomationRuleRow';
import AutomationRuleEditor from './AutomationRuleEditor';
import AutomationExecutionSheet from './AutomationExecutionSheet';
import {
  filterRules,
  type RuleStatusFilter,
  type RuleTriggerFilter,
} from './automationPresentation';

export default function AutomationRulesSection() {
  const { t } = useTranslation();
  const { hasAnyRole } = useAuth();
  const iconSize = useIconSize('action');
  const canEdit = hasAnyRole(['SUPER_ADMIN', 'SUPER_MANAGER']);
  const [editor, setEditor] = useState<{ rule: AutomationRule | null } | null>(
    null,
  );
  const [historyRule, setHistoryRule] = useState<AutomationRule | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AutomationRule | null>(null);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useUserPreference<'list' | 'card'>(
    'automation.viewMode',
    'list',
  );
  const [status, setStatus] = useUserPreference<RuleStatusFilter>(
    'baitly.automation.status',
    '',
  );
  const [trigger, setTrigger] = useUserPreference<RuleTriggerFilter>(
    'baitly.automation.trigger',
    '',
  );
  useScreenSearch(
    search,
    setSearch,
    t('automation.search', 'Rechercher une règle, un déclencheur…'),
  );
  const {
    data: rules = [],
    isLoading,
    isError,
    refetch,
  } = useAutomationRules();
  const toggleMutation = useToggleRule();
  const deleteMutation = useDeleteRule();
  const activeCount = rules.filter((rule) => rule.enabled).length;
  const visibleRules = filterRules(rules, { status, trigger, search }, t);
  const hasFilters = !!(status || trigger || search);
  const clearFilters = () => {
    setStatus('');
    setTrigger('');
    setSearch('');
  };
  const openCreate = () => setEditor({ rule: null });

  const headerActions = usePageHeaderActions(
    canEdit ? (
      <Button size="sm" onClick={openCreate}>
        <Add size={iconSize} />
        {t('automation.createTitle', 'Nouvelle règle')}
      </Button>
    ) : null,
  );

  return (
    <>
      {headerActions}
      <section aria-labelledby="automation-rules-heading">
        <div className="automation-section-heading automation-rules-heading">
          <div className="automation-section-title">
            <h2 id="automation-rules-heading">
              {t('automation.yourRules', 'Vos règles')}
            </h2>
            {!isLoading && !isError && (
              <NavCountBadge className="text-xs" count={rules.length} />
            )}
            {!canEdit && (
              <Badge variant="outline">
                <Lock size={iconSize} />
                {t('automation.system.readOnly', 'Lecture seule')}
              </Badge>
            )}
          </div>
          <p>
            {t(
              'automation.rulesDescription',
              'Définissez un déclencheur. Baitly s’occupe de la suite.',
            )}
          </p>
          <div className="automation-toolbar">
            <FilterChipRow<Exclude<RuleStatusFilter, ''>>
              value={status}
              onChange={setStatus}
              allLabel={t('automation.all', 'Toutes')}
              allCount={isLoading || isError ? undefined : rules.length}
              options={[
                {
                  value: 'active',
                  label: t('automation.activePlural', 'Actives'),
                  count: isLoading || isError ? undefined : activeCount,
                  color: 'var(--bui-primary)',
                },
                {
                  value: 'paused',
                  label: t('automation.paused', 'En pause'),
                  count:
                    isLoading || isError
                      ? undefined
                      : rules.length - activeCount,
                  color: 'var(--bui-primary)',
                },
              ]}
            />
            <div className="automation-toolbar-options">
              <NativeSelect
                size="sm"
                value={trigger}
                onChange={(event) =>
                  setTrigger(event.target.value as RuleTriggerFilter)
                }
                aria-label={t(
                  'automation.filterTrigger',
                  'Filtrer les déclencheurs',
                )}
              >
                <NativeSelectOption value="">
                  {t('automation.allTriggers', 'Tous les déclencheurs')}
                </NativeSelectOption>
                <NativeSelectOption value="scheduled">
                  {t('automation.scheduled', 'Cycle du séjour')}
                </NativeSelectOption>
                <NativeSelectOption value="event">
                  {t('automation.event', 'Événements')}
                </NativeSelectOption>
              </NativeSelect>
              <div
                className="automation-view-switch"
                role="group"
                aria-label={t('automation.view.label', 'Affichage des règles')}
              >
                {(['list', 'card'] as const).map((view) => (
                  <Tooltip key={view}>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t(
                          `automation.view.${view}`,
                          view === 'list' ? 'Vue liste' : 'Vue détaillée',
                        )}
                        aria-pressed={viewMode === view}
                        onClick={() => setViewMode(view)}
                      >
                        {view === 'list' ? (
                          <ViewList size={iconSize} />
                        ) : (
                          <Layers size={iconSize} />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {t(
                        `automation.view.${view}`,
                        view === 'list' ? 'Vue liste' : 'Vue détaillée',
                      )}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </div>
          </div>
        </div>
        {(toggleMutation.isError || deleteMutation.isError) && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>
              {t(
                'automation.mutationError',
                'La modification n’a pas été enregistrée. Réessayez.',
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  toggleMutation.reset();
                  deleteMutation.reset();
                }}
              >
                {t('common.close', 'Fermer')}
              </Button>
            </AlertDescription>
          </Alert>
        )}
        {isLoading ? (
          <Card
            className="automation-loading"
            aria-label={t('common.loading', 'Chargement…')}
          >
            {[0, 1, 2, 3, 4].map((id) => (
              <div key={id}>
                <Skeleton className="h-4 w-2/5" />
                <Skeleton className="mt-3 h-3 w-3/5" />
              </div>
            ))}
          </Card>
        ) : isError ? (
          <Alert variant="destructive">
            <AlertDescription>
              {t('automation.error', 'Impossible de charger les règles.')}
              <Button
                variant="outline"
                size="sm"
                onClick={() => void refetch()}
              >
                {t('common.retry', 'Réessayer')}
              </Button>
            </AlertDescription>
          </Alert>
        ) : !rules.length ? (
          <EmptyState
            icon={<Bolt />}
            title={t('automation.empty', 'Votre première règle commence ici')}
            description={t(
              'automation.emptyDesc',
              'Envoyez un message avant l’arrivée, prévenez votre équipe ou préparez le départ.',
            )}
            action={
              canEdit ? (
                <Button onClick={openCreate}>
                  <Add size={iconSize} />
                  {t('automation.createTitle', 'Nouvelle règle')}
                </Button>
              ) : undefined
            }
          />
        ) : !visibleRules.length ? (
          <EmptyState
            icon={<FilterListOff />}
            title={t('automation.noResults', 'Aucune règle ne correspond')}
            description={t(
              'automation.noResultsDesc',
              'Essayez un autre mot ou ajustez les filtres.',
            )}
            action={
              <Button variant="outline" onClick={clearFilters}>
                {t('automation.resetFilters', 'Réinitialiser les filtres')}
              </Button>
            }
          />
        ) : (
          <Card className="automation-rules-surface" data-view={viewMode}>
            <div className="automation-column-headings" aria-hidden>
              <span>{t('automation.rule', 'Règle')}</span>
              <span>{t('automation.when', 'Quand')}</span>
              <span />
              <span>{t('automation.then', 'Alors')}</span>
              <span>
                {t('automation.statusAndActions', 'Statut et actions')}
              </span>
            </div>
            <ul
              className="automation-rules-list"
              aria-label={t('automation.yourRules', 'Vos règles')}
            >
              {visibleRules.map((rule) => (
                <AutomationRuleRow
                  key={rule.id}
                  rule={rule}
                  canEdit={canEdit}
                  busy={toggleMutation.isPending || deleteMutation.isPending}
                  onToggle={(id) => toggleMutation.mutate(id)}
                  onEdit={(selected) => setEditor({ rule: selected })}
                  onDelete={setDeleteTarget}
                  onHistory={setHistoryRule}
                />
              ))}
            </ul>
          </Card>
        )}
        {!isLoading && !isError && rules.length > 0 && (
          <div className="automation-list-footer">
            <p role="status" className="tabular-nums">
              {t('automation.resultCount', '{{shown}} sur {{total}} règles', {
                shown: visibleRules.length,
                total: rules.length,
              })}
            </p>
            {hasFilters && (
              <Button variant="link" size="sm" onClick={clearFilters}>
                {t('automation.resetFilters', 'Réinitialiser les filtres')}
              </Button>
            )}
          </div>
        )}
      </section>
      {canEdit && editor && (
        <AutomationRuleEditor
          key={editor.rule?.id ?? 'new'}
          rule={editor.rule}
          onClose={() => setEditor(null)}
        />
      )}
      {historyRule && (
        <AutomationExecutionSheet
          key={historyRule.id}
          rule={historyRule}
          onClose={() => setHistoryRule(null)}
        />
      )}
      <ConfirmationModal
        open={!!deleteTarget}
        loading={deleteMutation.isPending}
        confirmText={t('common.delete', 'Supprimer')}
        cancelText={t('common.cancel', 'Annuler')}
        title={t('automation.deleteTitle', 'Supprimer la règle')}
        message={
          deleteMutation.isError
            ? t(
                'automation.mutationError',
                'La modification n’a pas été enregistrée. Réessayez.',
              )
            : t(
                'automation.deleteNamed',
                'Supprimer « {{name}} » ? Cette règle ne déclenchera plus aucune action.',
                { name: deleteTarget?.name },
              )
        }
        onConfirm={() => {
          if (deleteTarget && !deleteMutation.isPending)
            deleteMutation.mutate(deleteTarget.id, {
              onSuccess: () => setDeleteTarget(null),
            });
        }}
        onClose={() => {
          if (!deleteMutation.isPending) setDeleteTarget(null);
        }}
      />
    </>
  );
}
