import React, { useState, useCallback } from 'react';
import StatusChip, { type ToneTokens } from '../../components/StatusChip';
import { Alert, AlertDescription } from '../../components/ui';
import { TriangleAlert } from 'lucide-react';
import { Spinner } from '../../components/ui';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
  Button, Field, FieldLabel, FieldDescription, Input,
  Card, Skeleton, Switch,
  Tooltip, TooltipTrigger, TooltipContent,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  NativeSelect, NativeSelectOption, NativeSelectOptGroup,
} from '../../components/ui';
import { cn } from '../../utils/cn';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  PlayArrow as ExecutionsIcon,
  SmartToy as AutomationIcon,
  Email as EmailIcon,
  Sms as SmsIcon,
  WhatsApp as WhatsAppIcon,
  ViewList as ListViewIcon,
  GridView as CardViewIcon,
} from '../../icons';
import PageHeader from '../../components/PageHeader';
import { useUserPreference } from '../../hooks/useUserPreference';
import EmptyState from '../../components/EmptyState';
import ConfirmationModal from '../../components/ConfirmationModal';
import ConditionsEditor from './ConditionsEditor';
import ConstellationAutoRulesSection from './ConstellationAutoRulesSection';
import { useTranslation } from '../../hooks/useTranslation';
import { useAuth } from '../../hooks/useAuth';
import {
  useAutomationRules,
  useSystemAutomations,
  useCreateRule,
  useUpdateRule,
  useToggleRule,
  useDeleteRule,
  useRuleExecutions,
} from '../../hooks/useAutomationRules';
import type {
  AutomationRule,
  CreateAutomationRuleData,
  AutomationTrigger,
  AutomationAction,
  MessageChannelType,
} from '../../services/api/automationRulesApi';
import {
  TRIGGER_LABELS,
  ACTION_LABELS,
  TRIGGER_GROUPS,
  TRIGGER_ACTIONS,
  isLifecycleTrigger,
  isMessagingAction,
  actionNeedsTemplate,
  actionUsesGraceHours,
  parseActionConfig,
  stringifyGraceHours,
} from '../../services/api/automationRulesApi';
import { guestMessagingApi } from '../../services/api/guestMessagingApi';
import type { MessageTemplate } from '../../services/api/guestMessagingApi';
import { useQuery } from '@tanstack/react-query';
import PagePagination from '../../components/PagePagination';

// ─── Constants ──────────────────────────────────────────────────────────────

const CHANNEL_OPTIONS: { value: MessageChannelType; label: string; icon: React.ReactNode }[] = [
  { value: 'EMAIL', label: 'Email', icon: <EmailIcon size={'0.875rem'} strokeWidth={1.75} /> },
  { value: 'SMS', label: 'SMS', icon: <SmsIcon size={'0.875rem'} strokeWidth={1.75} /> },
  { value: 'WHATSAPP', label: 'WhatsApp', icon: <WhatsAppIcon size={'0.875rem'} strokeWidth={1.75} /> },
];

// ─── Chips soft (pilule fond -soft + texte couleur — pattern baseline §2) ────
// La géométrie est portée par StatusChip (`pill`) ; il ne reste ici que le
// mapping statut → tons, qui lui est propre au domaine.

// Canaux : constantes locales VALIDÉES messagerie (baseline §1 — WhatsApp /
// Email / SMS) ; fond soft dérivé du même hex (texte couleur + fond -soft).
const CHANNEL_HEX: Record<MessageChannelType, string> = {
  WHATSAPP: '#25A36F',
  EMAIL: '#7BA3C2',
  SMS: '#C28A52',
};

// Statuts d'exécution : tokens sémantiques désaturés.
const EXEC_STATUS_TOKENS: Record<string, { color: string; soft: string }> = {
  SUCCESS: { color: 'var(--ok)', soft: 'var(--ok-soft)' },
  FAILED: { color: 'var(--err)', soft: 'var(--err-soft)' },
  SKIPPED: { color: 'var(--warn)', soft: 'var(--warn-soft)' },
};

const EMPTY_FORM: CreateAutomationRuleData = {
  name: '',
  triggerType: 'RESERVATION_CONFIRMED',
  triggerOffsetDays: 0,
  triggerTime: '09:00',
  conditions: '',
  actionType: 'SEND_MESSAGE',
  templateId: undefined,
  deliveryChannel: 'EMAIL',
};

// ─── Helpers ────────────────────────────────────────────────────────────────

const channelIcon = (ch: MessageChannelType) => {
  const found = CHANNEL_OPTIONS.find((c) => c.value === ch);
  return found?.icon ?? null;
};

// Style du chip de statut d'une automatisation système (carte et liste).
const systemStatusTokens = (status: string): ToneTokens =>
  status === 'ACTIVE' ? { color: 'var(--ok)', bg: 'var(--ok-soft)' }
    : status === 'INACTIVE' ? { color: 'var(--muted)', bg: 'var(--field)' }
      : { color: 'var(--info)', bg: 'var(--info-soft)' };

// Chips par colonne : déclencheur (+ timing), action, canal — pour aligner
// les colonnes en vue liste et les regrouper en vue carte.
const renderTriggerChips = (rule: AutomationRule) => (
  <>
    <StatusChip pill tokens={{ color: 'var(--accent)', bg: 'var(--accent-soft)' }} label={TRIGGER_LABELS[rule.triggerType] ?? rule.triggerType} />
    {isLifecycleTrigger(rule.triggerType) && rule.triggerOffsetDays !== 0 && (
      <StatusChip pill tokens={{ color: 'var(--body)', bg: 'var(--field)' }} label={`${rule.triggerOffsetDays > 0 ? '+' : ''}${rule.triggerOffsetDays}j`} className="tabular-nums" />
    )}
    {isLifecycleTrigger(rule.triggerType) && rule.triggerTime && (
      <StatusChip pill tokens={{ color: 'var(--body)', bg: 'var(--field)' }} label={rule.triggerTime} className="tabular-nums" />
    )}
  </>
);

const renderActionChip = (rule: AutomationRule) => (
  <StatusChip pill tokens={{ color: 'var(--info)', bg: 'var(--info-soft)' }} label={ACTION_LABELS[rule.actionType] ?? rule.actionType} />
);

const renderChannelChip = (rule: AutomationRule) =>
  isMessagingAction(rule.actionType) ? (
    <StatusChip pill tokens={{ color: CHANNEL_HEX[rule.deliveryChannel] ?? 'var(--muted)', bg: `${CHANNEL_HEX[rule.deliveryChannel] ?? '#67757C'}1F` }} label={rule.deliveryChannel} icon={channelIcon(rule.deliveryChannel) as React.ReactElement} />
  ) : null;

// ─── Component ──────────────────────────────────────────────────────────────

const AutomationRulesPage: React.FC = () => {
  const { t } = useTranslation();
  const { hasAnyRole } = useAuth();
  // Écriture réservée à la plateforme ; les orgs sont en lecture seule.
  const canEdit = hasAnyRole(['SUPER_ADMIN', 'SUPER_MANAGER']);

  // Dialog states
  const [formOpen, setFormOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AutomationRule | null>(null);
  const [execRuleId, setExecRuleId] = useState<number | null>(null);
  const [execPage, setExecPage] = useState(0);

  // Form state
  const [formData, setFormData] = useState<CreateAutomationRuleData>({ ...EMPTY_FORM });

  // Data queries
  const { data: rules = [], isLoading, isError } = useAutomationRules();
  const { data: systemAutomations = [] } = useSystemAutomations();
  // Affichage des règles : liste (défaut) ou cartes. Persisté cross-devices.
  const [viewMode, setViewMode] = useUserPreference<'list' | 'card'>('automation.viewMode', 'list');
  const { data: templates = [] } = useQuery({
    queryKey: ['message-templates'],
    queryFn: () => guestMessagingApi.getTemplates(),
    staleTime: 120_000,
  });

  // Mutations
  const createMutation = useCreateRule();
  const updateMutation = useUpdateRule();
  const toggleMutation = useToggleRule();
  const deleteMutation = useDeleteRule();

  const isMutating = createMutation.isPending || updateMutation.isPending;

  // ── Handlers ──

  const handleOpenCreate = useCallback(() => {
    setEditingRule(null);
    setFormData({ ...EMPTY_FORM });
    setFormOpen(true);
  }, []);

  const handleOpenEdit = useCallback((rule: AutomationRule) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      triggerType: rule.triggerType,
      triggerOffsetDays: rule.triggerOffsetDays,
      triggerTime: rule.triggerTime ?? '09:00',
      conditions: rule.conditions ?? '',
      actionType: rule.actionType ?? 'SEND_MESSAGE',
      actionConfig: rule.actionConfig ?? undefined,
      templateId: rule.templateId ?? undefined,
      deliveryChannel: rule.deliveryChannel ?? 'EMAIL',
    });
    setFormOpen(true);
  }, []);

  // Changement de déclencheur : si l'action courante n'est pas valide pour ce
  // déclencheur, retomber sur la première action recommandée (évite les
  // combinaisons vides). Les événementiels remettent le décalage à 0.
  const handleTriggerChange = useCallback((triggerType: AutomationTrigger) => {
    setFormData((prev) => {
      const allowed = TRIGGER_ACTIONS[triggerType] ?? [];
      const actionType = prev.actionType && allowed.includes(prev.actionType)
        ? prev.actionType
        : allowed[0];
      return {
        ...prev,
        triggerType,
        actionType,
        triggerOffsetDays: isLifecycleTrigger(triggerType) ? prev.triggerOffsetDays : 0,
      };
    });
  }, []);

  const handleSubmit = useCallback(async () => {
    if (editingRule) {
      await updateMutation.mutateAsync({ id: editingRule.id, data: formData });
    } else {
      await createMutation.mutateAsync(formData);
    }
    setFormOpen(false);
  }, [editingRule, formData, createMutation, updateMutation]);

  const handleToggle = useCallback(
    (id: number) => toggleMutation.mutate(id),
    [toggleMutation],
  );

  const handleDelete = useCallback(() => {
    if (deleteTarget) {
      deleteMutation.mutate(deleteTarget.id);
      setDeleteTarget(null);
    }
  }, [deleteTarget, deleteMutation]);

  // ── Sorted rules ──
  const sortedRules = [...rules].sort((a, b) => a.sortOrder - b.sortOrder);

  // Ligne « liste » d'une automatisation système (lecture seule), mêmes colonnes
  // que les règles pour une liste unifiée.
  const renderSystemRow = (sa: (typeof systemAutomations)[number]) => (
    <div className="grid items-center gap-x-[9px] px-3 py-[7.5px] min-w-[720px]" style={{ gridTemplateColumns: LIST_COLUMNS, borderTop: '1px solid var(--hairline)' }} key={sa.key}>
      <StatusChip pill tokens={systemStatusTokens(sa.status)} label={sa.statusLabel} className="justify-self-start" />
      <div className="min-w-0">
        <p className="cn-text-body1 truncate text-[0.8125rem] font-semibold text-[var(--ink)]">{sa.label}</p>
        <p className="cn-text-body1 truncate text-[0.6875rem] text-muted-foreground">{sa.description}</p>
      </div>
      <div className="flex min-w-0">
        <StatusChip pill tokens={{ color: 'var(--accent)', bg: 'var(--accent-soft)' }} label={sa.triggerLabel} />
      </div>
      <div className="flex min-w-0">
        <StatusChip pill tokens={{ color: 'var(--info)', bg: 'var(--info-soft)' }} label={sa.actionLabel} />
      </div>
      <div className="flex min-w-0">
        <StatusChip pill tokens={{ color: 'var(--muted)', bg: 'var(--field)' }} label={sa.mechanism} />
      </div>
      <div />
    </div>
  );

  // Vue carte : tous les chips regroupés.
  const renderRuleChips = (rule: AutomationRule) => (
    <>
      {renderTriggerChips(rule)}
      {renderActionChip(rule)}
      {renderChannelChip(rule)}
    </>
  );

  // Gabarit de colonnes partagé par la vue liste (règles + automatisations système)
  // pour que les chips s'alignent verticalement d'une ligne à l'autre.
  const LIST_COLUMNS = 'auto minmax(180px, 1.4fr) minmax(180px, 1.6fr) minmax(150px, 1.2fr) 130px auto';

  // Exécutions (lecture seule) visibles par tous ; Modifier / Supprimer réservés
  // à la plateforme (les orgs sont en lecture seule).
  // Le <span> autour de chaque bouton n'est pas decoratif : TooltipTrigger
  // asChild pose une ref DOM sur son enfant, or les primitifs du kit sont des
  // fonctions sans forwardRef (React 18) — sans le span, l'ancrage du tooltip
  // serait perdu.
  const renderRuleActions = (rule: AutomationRule) => (
    <>
      {canEdit && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">
              <Button variant="ghost" size="icon-sm" aria-label={t('common.edit', 'Modifier')} onClick={() => handleOpenEdit(rule)}>
                <EditIcon size={'0.875rem'} strokeWidth={1.75} />
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>{t('common.edit', 'Modifier')}</TooltipContent>
        </Tooltip>
      )}
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">
            <Button variant="ghost" size="icon-sm" className="text-[var(--info)]" aria-label={t('automation.executions', 'Executions')} onClick={() => { setExecRuleId(rule.id); setExecPage(0); }}>
              <ExecutionsIcon size={'0.875rem'} strokeWidth={1.75} />
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>{t('automation.executions', 'Executions')}</TooltipContent>
      </Tooltip>
      {canEdit && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">
              <Button variant="ghost" size="icon-sm" className="text-[var(--err)]" aria-label={t('common.delete', 'Supprimer')} onClick={() => setDeleteTarget(rule)}>
                <DeleteIcon size={'0.875rem'} strokeWidth={1.75} />
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>{t('common.delete', 'Supprimer')}</TooltipContent>
        </Tooltip>
      )}
    </>
  );

  return (
    // Padding de page : SPACING.PAGE_PADDING (2) = 12px avec theme.spacing = 6
    <div className="p-3">
      <PageHeader
        title={t('automation.title', 'Regles d\'automatisation')}
        subtitle={t('automation.subtitle', 'Automatisez les messages et actions pour vos reservations')}
        showBackButton={false}
        backPath="/settings"
        actions={
          <div className="flex items-center gap-1.5">
            {/* Sélecteur d'affichage : liste (défaut) / cartes */}
            <div className="flex border border-[var(--hairline)] rounded-[var(--radius-md)] overflow-hidden">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t('automation.view.list', 'Vue liste')}
                      aria-pressed={viewMode === 'list'}
                      onClick={() => setViewMode('list')}
                      className={viewMode === 'list'
                        ? 'rounded-none text-[var(--accent)] bg-[var(--accent-soft)]'
                        : 'rounded-none text-[var(--muted)]'}
                    >
                      <ListViewIcon size={16} strokeWidth={1.75} />
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>{t('automation.view.list', 'Vue liste')}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t('automation.view.card', 'Vue cartes')}
                      aria-pressed={viewMode === 'card'}
                      onClick={() => setViewMode('card')}
                      className={viewMode === 'card'
                        ? 'rounded-none text-[var(--accent)] bg-[var(--accent-soft)]'
                        : 'rounded-none text-[var(--muted)]'}
                    >
                      <CardViewIcon size={16} strokeWidth={1.75} />
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>{t('automation.view.card', 'Vue cartes')}</TooltipContent>
              </Tooltip>
            </div>
            {canEdit && (
              <Button size="sm" onClick={handleOpenCreate}>
                <AddIcon size={16} strokeWidth={2} />
                {t('automation.create', 'Nouvelle regle')}
              </Button>
            )}
          </div>
        }
      />

      {/* ── Rules list ── */}
      {isLoading ? (
        <div className="grid grid-cols-12 gap-[9px]">
          {Array.from({ length: 4 }).map((_, i) => (
            <div className="col-span-12 min-[900px]:col-span-6" key={i}>
              <Skeleton className="h-[150px] w-full rounded-[var(--radius-lg)]" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <Alert variant="destructive" className="text-[0.8125rem]">
          <TriangleAlert />
          <AlertDescription>{t('automation.error', 'Erreur lors du chargement des regles')}</AlertDescription>
        </Alert>
      ) : sortedRules.length === 0 ? (
        <EmptyState
          icon={<AutomationIcon />}
          title={t('automation.empty', 'Aucune regle d\'automatisation configuree')}
          description={t('automation.emptyDesc', "Les regles d'automatisation apparaitront ici.")}
          action={
            canEdit ? (
              <Button size="sm" onClick={handleOpenCreate}>
                <AddIcon size={16} strokeWidth={1.75} />
                {t('automation.create', 'Nouvelle regle')}
              </Button>
            ) : undefined
          }
        />
      ) : viewMode === 'card' ? (
        <div className="grid grid-cols-12 gap-[9px]">
          {sortedRules.map((rule) => (
            <div className="col-span-12 min-[900px]:col-span-6" key={rule.id}>
              {/* Carte règle : peau Card du kit (p: 2 MUI = 12 px avec spacing 6) */}
              <Card className="gap-0 py-0 p-3">
                {/* Header row : nom + toggle */}
                <div className="flex items-center gap-1.5 mb-1.5">
                  <p className="cn-text-body1 text-[0.875rem] font-semibold text-[var(--ink)] flex-1">
                    {rule.name}
                  </p>
                  <Switch
                    checked={rule.enabled}
                    onCheckedChange={() => handleToggle(rule.id)}
                    disabled={toggleMutation.isPending}
                  />
                </div>

                {/* Conditions / actions : chips -soft (déclencheur = accent) */}
                <div className="flex gap-1 flex-wrap mb-2">
                  {renderRuleChips(rule)}
                </div>

                {/* Template */}
                {rule.templateName && (
                  <p className="cn-text-body1 text-[0.75rem] text-muted-foreground mb-1.5">
                    Template: {rule.templateName}
                  </p>
                )}

                {/* Actions */}
                <div className="flex gap-0.5">
                  {renderRuleActions(rule)}
                </div>
              </Card>
            </div>
          ))}
        </div>
      ) : (
        // ── Vue LISTE (défaut) : lignes denses, chips alignés en colonnes ────
        // Le defilement horizontal est porte par un div interne : la Card du kit
        // pose deja overflow-hidden, qui gagnerait sur un overflow-x sur elle.
        <Card className="gap-0 py-0">
          <div className="overflow-x-auto">
          {sortedRules.map((rule, idx) => (
            <div className="grid items-center gap-x-[9px] px-3 py-[7.5px] min-w-[720px]" style={{ gridTemplateColumns: LIST_COLUMNS, borderTop: idx === 0 ? 'none' : '1px solid var(--hairline)' }} key={rule.id}>
              {/* Le sx d'origine ne faisait que retailler le Switch en version
                  compacte : c'est exactement size="sm" dans le kit. */}
              <Switch
                size="sm"
                className="justify-self-start"
                checked={rule.enabled}
                onCheckedChange={() => handleToggle(rule.id)}
                disabled={!canEdit || toggleMutation.isPending}
              />
              <div className="min-w-0">
                <p className="cn-text-body1 truncate text-[0.8125rem] font-semibold text-[var(--ink)]">
                  {rule.name}
                </p>
                {rule.templateName && (
                  <p className="cn-text-body1 truncate text-[0.6875rem] text-muted-foreground">
                    Template: {rule.templateName}
                  </p>
                )}
              </div>
              <div className="flex gap-0.5 flex-wrap min-w-0">
                {renderTriggerChips(rule)}
              </div>
              <div className="flex min-w-0">
                {renderActionChip(rule)}
              </div>
              <div className="flex min-w-0">
                {renderChannelChip(rule)}
              </div>
              <div className="flex gap-0.5 justify-end">
                {renderRuleActions(rule)}
              </div>
            </div>
          ))}
          {/* Automatisations système (lecture seule) fusionnées dans la même liste */}
          {systemAutomations.length > 0 && (
            <>
              <div className="px-3 py-1.5 border-t border-[var(--hairline)] bg-[var(--field)]">
                <p className="cn-text-body1 text-[0.6875rem] font-bold uppercase tracking-[0.06em] text-[var(--faint)]">
                  {t('automation.system.title', 'Automatisations système')} · {t('automation.system.readOnly', 'Lecture seule')}
                </p>
              </div>
              {systemAutomations.map((sa) => renderSystemRow(sa))}
            </>
          )}
          </div>
        </Card>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          Automatisations système (hors hub) — lecture seule, statut réel
          ═══════════════════════════════════════════════════════════════════════ */}
      {/* En vue CARTE, les automatisations système restent une section dédiée en
          dessous ; en vue LISTE elles sont fusionnées dans la liste ci-dessus. */}
      {viewMode === 'card' && systemAutomations.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center gap-1.5 mb-0.5">
            <p className="cn-text-body1 text-[0.95rem] font-semibold text-[var(--ink)]">
              {t('automation.system.title', 'Automatisations système')}
            </p>
            <StatusChip pill tokens={{ color: 'var(--muted)', bg: 'var(--field)' }} label={t('automation.system.readOnly', 'Lecture seule')} />
          </div>
          <p className="cn-text-body1 text-[0.8125rem] text-muted-foreground mb-2">
            {t('automation.system.subtitle', 'Automatisations gérées ailleurs dans le produit (hors règles). Affichées ici pour visibilité — leur statut reflète l’état réel.')}
          </p>
          <div className="grid grid-cols-12 gap-[9px]">
            {systemAutomations.map((sa) => (
              <div className="col-span-12 min-[900px]:col-span-6" key={sa.key}>
                <Card className="gap-0 py-0 p-3 opacity-[0.94]">
                  <div className="flex items-center gap-1.5 mb-1">
                    <p className="cn-text-body1 text-[0.875rem] font-semibold text-[var(--ink)] flex-1">
                      {sa.label}
                    </p>
                    <StatusChip pill tokens={systemStatusTokens(sa.status)} label={sa.statusLabel} />
                  </div>
                  <p className="cn-text-body1 text-[0.78rem] text-muted-foreground mb-1.5">
                    {sa.description}
                  </p>
                  <div className="flex gap-1 flex-wrap">
                    <StatusChip pill tokens={{ color: 'var(--accent)', bg: 'var(--accent-soft)' }} label={sa.triggerLabel} />
                    <StatusChip pill tokens={{ color: 'var(--info)', bg: 'var(--info-soft)' }} label={sa.actionLabel} />
                    <StatusChip pill tokens={{ color: 'var(--muted)', bg: 'var(--field)' }} label={sa.mechanism} />
                  </div>
                </Card>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          Constellation — actions automatiques (Vague 1 autonomie)
          Toggles d'auto-application par type (opt-in, plafonnés par le niveau
          de chaque agent). Se masque pour les rôles sans supervision.
          ═══════════════════════════════════════════════════════════════════════ */}
      <ConstellationAutoRulesSection />

      {/* ═══════════════════════════════════════════════════════════════════════
          Create / Edit Dialog
          ═══════════════════════════════════════════════════════════════════════ */}
      <Dialog open={formOpen} onOpenChange={(next) => { if (!next) setFormOpen(false); }}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {editingRule
                ? t('automation.editTitle', 'Modifier la regle')
                : t('automation.createTitle', 'Nouvelle regle d\'automatisation')}
            </DialogTitle>
          </DialogHeader>
          {/* Le defilement est sur le corps du formulaire, pas sur DialogContent :
              titre et pied restent visibles, comme avec le Dialog MUI. */}
          <div className="flex flex-col gap-3 max-h-[65vh] overflow-y-auto">
          <Field>
            <FieldLabel htmlFor="automation-rule-name">
              {t('automation.form.name', 'Nom de la regle')}
            </FieldLabel>
            <Input
              id="automation-rule-name"
              className="w-full"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="automation-trigger">
              {t('automation.form.trigger', 'Declencheur')}
            </FieldLabel>
            {/* Les ListSubheader MUI deviennent des <optgroup> : meme regroupement,
                mais non selectionnables par construction. */}
            <NativeSelect
              id="automation-trigger"
              className="w-full"
              value={formData.triggerType}
              onChange={(e) => handleTriggerChange(e.target.value as AutomationTrigger)}
            >
              {TRIGGER_GROUPS.map((group) => (
                <NativeSelectOptGroup key={group.label} label={group.label}>
                  {group.triggers.map((tg) => (
                    <NativeSelectOption key={tg} value={tg}>
                      {TRIGGER_LABELS[tg]}
                    </NativeSelectOption>
                  ))}
                </NativeSelectOptGroup>
              ))}
            </NativeSelect>
          </Field>

          <Field>
            <FieldLabel htmlFor="automation-action">
              {t('automation.form.action', 'Action')}
            </FieldLabel>
            <NativeSelect
              id="automation-action"
              className="w-full"
              value={formData.actionType ?? ''}
              onChange={(e) => setFormData({ ...formData, actionType: e.target.value as AutomationAction })}
            >
              {Array.from(new Set([
                ...(TRIGGER_ACTIONS[formData.triggerType] ?? []),
                ...(formData.actionType ? [formData.actionType] : []),
              ])).map((a) => (
                <NativeSelectOption key={a} value={a}>
                  {ACTION_LABELS[a]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>

          {/* Décalage/heure : uniquement pour les déclencheurs « cycle de vie ». */}
          {isLifecycleTrigger(formData.triggerType) && (
            <div className="flex gap-2">
              <Field className="flex-1">
                <FieldLabel htmlFor="automation-offset-days">
                  {t('automation.form.offset', 'Delai (jours)')}
                </FieldLabel>
                <Input
                  id="automation-offset-days"
                  type="number"
                  value={formData.triggerOffsetDays}
                  onChange={(e) => setFormData({ ...formData, triggerOffsetDays: Number(e.target.value) })}
                  min={-30}
                  max={30}
                  step={1}
                />
              </Field>
              <Field className="flex-1">
                <FieldLabel htmlFor="automation-trigger-time">
                  {t('automation.form.time', 'Heure')}
                </FieldLabel>
                <Input
                  id="automation-trigger-time"
                  type="time"
                  value={formData.triggerTime ?? '09:00'}
                  onChange={(e) => setFormData({ ...formData, triggerTime: e.target.value })}
                />
              </Field>
            </div>
          )}

          {/* Canal d'envoi : uniquement pour les actions de messagerie. */}
          {formData.actionType && isMessagingAction(formData.actionType) && (
            <Field>
              <FieldLabel htmlFor="automation-channel">
                {t('automation.form.channel', 'Canal d\'envoi')}
              </FieldLabel>
              {/* Une <option> native ne peut pas porter d'icone : le libelle seul
                  suffit ici, les chips de la liste gardent l'icone du canal. */}
              <NativeSelect
                id="automation-channel"
                className="w-full"
                value={formData.deliveryChannel ?? 'EMAIL'}
                onChange={(e) => setFormData({ ...formData, deliveryChannel: e.target.value as MessageChannelType })}
              >
                {CHANNEL_OPTIONS.map((c) => (
                  <NativeSelectOption key={c.value} value={c.value}>
                    {c.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          )}

          {/* Template : uniquement pour « Envoyer un message » (contenu libre). */}
          {formData.actionType && actionNeedsTemplate(formData.actionType) && (
            <Field>
              <FieldLabel htmlFor="automation-template">
                {t('automation.form.template', 'Template')}
              </FieldLabel>
              <NativeSelect
                id="automation-template"
                className="w-full"
                value={formData.templateId ?? ''}
                onChange={(e) => setFormData({ ...formData, templateId: e.target.value ? Number(e.target.value) : undefined })}
              >
                <NativeSelectOption value="">
                  {t('common.none', 'Aucun')}
                </NativeSelectOption>
                {templates.map((tmpl: MessageTemplate) => (
                  <NativeSelectOption key={tmpl.id} value={tmpl.id}>
                    {tmpl.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          )}

          {/* Délai de grâce (action_config) : uniquement pour la révocation de code. */}
          {formData.actionType && actionUsesGraceHours(formData.actionType) && (
            <Field>
              <FieldLabel htmlFor="automation-grace-hours">
                {t('automation.form.graceHours', 'Delai de grace (heures)')}
              </FieldLabel>
              <Input
                id="automation-grace-hours"
                type="number"
                className="w-full"
                value={parseActionConfig(formData.actionConfig).graceHours ?? 4}
                onChange={(e) => setFormData({ ...formData, actionConfig: stringifyGraceHours(Number(e.target.value)) })}
                min={0}
                max={72}
                step={1}
              />
              <FieldDescription>
                {t('automation.form.graceHoursHelp', "Le code d'acces est revoque ce nombre d'heures apres le check-out.")}
              </FieldDescription>
            </Field>
          )}

          <ConditionsEditor
            value={formData.conditions ?? undefined}
            onChange={(conditions) => setFormData({ ...formData, conditions })}
          />
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setFormOpen(false)}>
              {t('common.cancel', 'Annuler')}
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={isMutating || !formData.name.trim()}
            >
              {isMutating ? <Spinner className="size-4" /> : editingRule ? t('common.save', 'Enregistrer') : t('common.create', 'Creer')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════════════
          Executions Dialog
          ═══════════════════════════════════════════════════════════════════════ */}
      <ExecutionsDialog
        ruleId={execRuleId}
        page={execPage}
        onPageChange={setExecPage}
        onClose={() => setExecRuleId(null)}
      />

      {/* ── Delete confirmation ── */}
      <ConfirmationModal
        open={!!deleteTarget}
        title={t('automation.deleteTitle', 'Supprimer la regle')}
        message={t('automation.deleteMessage', 'Voulez-vous vraiment supprimer cette regle d\'automatisation ?')}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
//  Executions Dialog
// ═══════════════════════════════════════════════════════════════════════════

const fmtDate = (d: string) => new Date(d).toLocaleString('fr-FR');

const ExecutionsDialog: React.FC<{
  ruleId: number | null;
  page: number;
  onPageChange: (page: number) => void;
  onClose: () => void;
}> = ({ ruleId, page, onPageChange, onClose }) => {
  const { t } = useTranslation();
  const { data, isLoading } = useRuleExecutions(ruleId ?? 0, page);

  const executions = data?.content ?? [];
  const totalElements = data?.totalElements ?? 0;

  return (
    <Dialog open={ruleId !== null} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="sm:max-w-[900px]">
        <DialogHeader>
          <DialogTitle>
            {t('automation.executionsTitle', 'Historique des executions')}
          </DialogTitle>
        </DialogHeader>
        <div className="max-h-[65vh] overflow-y-auto">
        {isLoading ? (
          <Skeleton className="h-[220px] w-full rounded-[var(--radius-lg)]" />
        ) : executions.length === 0 ? (
          <p className="cn-text-body1 text-[0.8125rem] text-muted-foreground text-center py-4">
            {t('automation.noExecutions', 'Aucune execution trouvee')}
          </p>
        ) : (
          <>
            {/* Entêtes overline + hairlines : portées par le primitif ;
                le conteneur overflow-x-auto est déjà rendu par <Table>. */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('automation.exec.date', 'Date')}</TableHead>
                  <TableHead>{t('automation.exec.guest', 'Client')}</TableHead>
                  <TableHead>{t('automation.exec.reservation', 'Reservation')}</TableHead>
                  <TableHead className="text-center">{t('automation.exec.status', 'Status')}</TableHead>
                  <TableHead>{t('automation.exec.error', 'Erreur')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {executions.map((exec) => {
                  const tokens = EXEC_STATUS_TOKENS[exec.status] ?? { color: 'var(--muted)', soft: 'var(--hover)' };
                  return (
                    <TableRow key={exec.id}>
                      <TableCell className="py-[7.5px] tabular-nums">{fmtDate(exec.createdAt)}</TableCell>
                      <TableCell className="py-[7.5px]">{exec.guestName}</TableCell>
                      <TableCell className="py-[7.5px] tabular-nums">#{exec.reservationId}</TableCell>
                      <TableCell className="text-center">
                        <StatusChip pill tokens={{ color: tokens.color, bg: tokens.soft }} label={exec.status} />
                      </TableCell>
                      <TableCell className={cn('py-[7.5px]', exec.errorMessage ? 'text-[var(--err)]' : 'text-[var(--faint)]')}>
                        {exec.errorMessage ?? '—'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <PagePagination
              count={totalElements}
              page={page}
              onPageChange={(p) => onPageChange(p)}
              rowsPerPage={20}
            />
          </>
        )}
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>
            {t('common.close', 'Fermer')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AutomationRulesPage;
