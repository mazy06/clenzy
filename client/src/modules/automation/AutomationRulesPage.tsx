import React, { useState, useCallback } from 'react';
import {
  Box, Typography, Button, Chip, Switch, IconButton, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  MenuItem, ListSubheader, Select, FormControl, InputLabel, CircularProgress, Alert,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Card, CardContent, Grid, Skeleton, TablePagination,
} from '@mui/material';
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
import { SPACING } from '../../theme/spacing';
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

// ─── Constants ──────────────────────────────────────────────────────────────

const CHANNEL_OPTIONS: { value: MessageChannelType; label: string; icon: React.ReactNode }[] = [
  { value: 'EMAIL', label: 'Email', icon: <EmailIcon size={'0.875rem'} strokeWidth={1.75} /> },
  { value: 'SMS', label: 'SMS', icon: <SmsIcon size={'0.875rem'} strokeWidth={1.75} /> },
  { value: 'WHATSAPP', label: 'WhatsApp', icon: <WhatsAppIcon size={'0.875rem'} strokeWidth={1.75} /> },
];

const CELL_SX = { py: 1.25 } as const;

// ─── Chips soft (pilule fond -soft + texte couleur — pattern baseline §2) ────

const pillSx = (bg: string, color: string) => ({
  height: 22,
  fontSize: '0.6875rem',
  fontWeight: 600,
  backgroundColor: bg,
  color,
  border: 'none',
  borderRadius: 'var(--radius-pill)',
  '& .MuiChip-icon': { color },
  '& .MuiChip-label': { px: 1 },
});

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

  // Style du chip de statut d'une automatisation système (carte et liste).
  const systemStatusStyle = (status: string) =>
    status === 'ACTIVE' ? pillSx('var(--ok-soft)', 'var(--ok)')
      : status === 'INACTIVE' ? pillSx('var(--field)', 'var(--muted)')
        : pillSx('var(--info-soft)', 'var(--info)');

  // Ligne « liste » d'une automatisation système (lecture seule), mêmes colonnes
  // que les règles pour une liste unifiée.
  const renderSystemRow = (sa: (typeof systemAutomations)[number]) => (
    <Box
      key={sa.key}
      sx={{
        display: 'grid', gridTemplateColumns: LIST_COLUMNS, alignItems: 'center',
        columnGap: 1.5, px: 2, py: 1.25, minWidth: 720,
        borderTop: '1px solid var(--hairline)',
      }}
    >
      <Chip label={sa.statusLabel} size="small" sx={{ ...systemStatusStyle(sa.status), justifySelf: 'start' }} />
      <Box sx={{ minWidth: 0 }}>
        <Typography noWrap sx={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--ink)' }}>{sa.label}</Typography>
        <Typography noWrap sx={{ fontSize: '0.6875rem', color: 'text.secondary' }}>{sa.description}</Typography>
      </Box>
      <Box sx={{ display: 'flex', minWidth: 0 }}>
        <Chip label={sa.triggerLabel} size="small" sx={pillSx('var(--accent-soft)', 'var(--accent)')} />
      </Box>
      <Box sx={{ display: 'flex', minWidth: 0 }}>
        <Chip label={sa.actionLabel} size="small" sx={pillSx('var(--info-soft)', 'var(--info)')} />
      </Box>
      <Box sx={{ display: 'flex', minWidth: 0 }}>
        <Chip label={sa.mechanism} size="small" sx={pillSx('var(--field)', 'var(--muted)')} />
      </Box>
      <Box />
    </Box>
  );

  // Chips par colonne : déclencheur (+ timing), action, canal — pour aligner
  // les colonnes en vue liste et les regrouper en vue carte.
  const renderTriggerChips = (rule: AutomationRule) => (
    <>
      <Chip
        label={TRIGGER_LABELS[rule.triggerType] ?? rule.triggerType}
        size="small"
        sx={pillSx('var(--accent-soft)', 'var(--accent)')}
      />
      {isLifecycleTrigger(rule.triggerType) && rule.triggerOffsetDays !== 0 && (
        <Chip
          label={`${rule.triggerOffsetDays > 0 ? '+' : ''}${rule.triggerOffsetDays}j`}
          size="small"
          sx={{ ...pillSx('var(--field)', 'var(--body)'), fontVariantNumeric: 'tabular-nums' }}
        />
      )}
      {isLifecycleTrigger(rule.triggerType) && rule.triggerTime && (
        <Chip
          label={rule.triggerTime}
          size="small"
          sx={{ ...pillSx('var(--field)', 'var(--body)'), fontVariantNumeric: 'tabular-nums' }}
        />
      )}
    </>
  );

  const renderActionChip = (rule: AutomationRule) => (
    <Chip
      label={ACTION_LABELS[rule.actionType] ?? rule.actionType}
      size="small"
      sx={pillSx('var(--info-soft)', 'var(--info)')}
    />
  );

  const renderChannelChip = (rule: AutomationRule) =>
    isMessagingAction(rule.actionType) ? (
      <Chip
        icon={channelIcon(rule.deliveryChannel) as React.ReactElement}
        label={rule.deliveryChannel}
        size="small"
        sx={pillSx(
          `${CHANNEL_HEX[rule.deliveryChannel] ?? '#67757C'}1F`,
          CHANNEL_HEX[rule.deliveryChannel] ?? 'var(--muted)',
        )}
      />
    ) : null;

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
  const renderRuleActions = (rule: AutomationRule) => (
    <>
      {canEdit && (
        <Tooltip title={t('common.edit', 'Modifier')}>
          <IconButton size="small" onClick={() => handleOpenEdit(rule)}>
            <EditIcon size={'0.875rem'} strokeWidth={1.75} />
          </IconButton>
        </Tooltip>
      )}
      <Tooltip title={t('automation.executions', 'Executions')}>
        <IconButton size="small" color="info" onClick={() => { setExecRuleId(rule.id); setExecPage(0); }}>
          <ExecutionsIcon size={'0.875rem'} strokeWidth={1.75} />
        </IconButton>
      </Tooltip>
      {canEdit && (
        <Tooltip title={t('common.delete', 'Supprimer')}>
          <IconButton size="small" color="error" onClick={() => setDeleteTarget(rule)}>
            <DeleteIcon size={'0.875rem'} strokeWidth={1.75} />
          </IconButton>
        </Tooltip>
      )}
    </>
  );

  return (
    <Box sx={{ p: SPACING.PAGE_PADDING }}>
      <PageHeader
        title={t('automation.title', 'Regles d\'automatisation')}
        subtitle={t('automation.subtitle', 'Automatisez les messages et actions pour vos reservations')}
        showBackButton={false}
        backPath="/settings"
        actions={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {/* Sélecteur d'affichage : liste (défaut) / cartes */}
            <Box sx={{ display: 'flex', border: '1px solid var(--hairline)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
              <Tooltip title={t('automation.view.list', 'Vue liste')}>
                <IconButton
                  size="small"
                  onClick={() => setViewMode('list')}
                  sx={{
                    borderRadius: 0,
                    color: viewMode === 'list' ? 'var(--accent)' : 'var(--muted)',
                    backgroundColor: viewMode === 'list' ? 'var(--accent-soft)' : 'transparent',
                  }}
                >
                  <ListViewIcon size={16} strokeWidth={1.75} />
                </IconButton>
              </Tooltip>
              <Tooltip title={t('automation.view.card', 'Vue cartes')}>
                <IconButton
                  size="small"
                  onClick={() => setViewMode('card')}
                  sx={{
                    borderRadius: 0,
                    color: viewMode === 'card' ? 'var(--accent)' : 'var(--muted)',
                    backgroundColor: viewMode === 'card' ? 'var(--accent-soft)' : 'transparent',
                  }}
                >
                  <CardViewIcon size={16} strokeWidth={1.75} />
                </IconButton>
              </Tooltip>
            </Box>
            {canEdit && (
              <Button
                size="small"
                variant="contained"
                startIcon={<AddIcon size={16} strokeWidth={2} />}
                onClick={handleOpenCreate}
              >
                {t('automation.create', 'Nouvelle regle')}
              </Button>
            )}
          </Box>
        }
      />

      {/* ── Rules list ── */}
      {isLoading ? (
        <Grid container spacing={1.5}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Grid item xs={12} md={6} key={i}>
              <Skeleton variant="rounded" height={150} sx={{ borderRadius: 'var(--radius-lg)' }} />
            </Grid>
          ))}
        </Grid>
      ) : isError ? (
        <Alert severity="error" sx={{ fontSize: '0.8125rem' }}>
          {t('automation.error', 'Erreur lors du chargement des regles')}
        </Alert>
      ) : sortedRules.length === 0 ? (
        <EmptyState
          icon={<AutomationIcon />}
          title={t('automation.empty', 'Aucune regle d\'automatisation configuree')}
          description={t('automation.emptyDesc', "Les regles d'automatisation apparaitront ici.")}
          action={
            canEdit ? (
              <Button
                size="small"
                variant="contained"
                startIcon={<AddIcon size={16} strokeWidth={1.75} />}
                onClick={handleOpenCreate}
              >
                {t('automation.create', 'Nouvelle regle')}
              </Button>
            ) : undefined
          }
        />
      ) : viewMode === 'card' ? (
        <Grid container spacing={1.5}>
          {sortedRules.map((rule) => (
            <Grid item xs={12} md={6} key={rule.id}>
              {/* Carte règle : peau MuiCard du thème (hairline r14, pas d'ombre) */}
              <Card>
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  {/* Header row : nom + toggle (Switch thème, nu) */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--ink)', flex: 1 }}>
                      {rule.name}
                    </Typography>
                    <Switch
                      checked={rule.enabled}
                      onChange={() => handleToggle(rule.id)}
                      disabled={toggleMutation.isPending}
                    />
                  </Box>

                  {/* Conditions / actions : chips -soft (déclencheur = accent) */}
                  <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 1.5 }}>
                    {renderRuleChips(rule)}
                  </Box>

                  {/* Template */}
                  {rule.templateName && (
                    <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mb: 1 }}>
                      Template: {rule.templateName}
                    </Typography>
                  )}

                  {/* Actions */}
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    {renderRuleActions(rule)}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      ) : (
        // ── Vue LISTE (défaut) : lignes denses, chips alignés en colonnes ────
        <Card sx={{ overflowX: 'auto' }}>
          {sortedRules.map((rule, idx) => (
            <Box
              key={rule.id}
              sx={{
                display: 'grid', gridTemplateColumns: LIST_COLUMNS, alignItems: 'center',
                columnGap: 1.5, px: 2, py: 1.25, minWidth: 720,
                borderTop: idx === 0 ? 'none' : '1px solid var(--hairline)',
              }}
            >
              <Switch
                checked={rule.enabled}
                onChange={() => handleToggle(rule.id)}
                disabled={!canEdit || toggleMutation.isPending}
                sx={{
                  justifySelf: 'start',
                  width: 30, height: 18, p: 0, display: 'flex',
                  '& .MuiSwitch-switchBase': {
                    p: 0, m: '2px',
                    '&.Mui-checked': { transform: 'translateX(12px)' },
                  },
                  '& .MuiSwitch-thumb': { width: 14, height: 14, boxShadow: 'none' },
                  '& .MuiSwitch-track': { borderRadius: 9, opacity: 1 },
                }}
              />
              <Box sx={{ minWidth: 0 }}>
                <Typography noWrap sx={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--ink)' }}>
                  {rule.name}
                </Typography>
                {rule.templateName && (
                  <Typography noWrap sx={{ fontSize: '0.6875rem', color: 'text.secondary' }}>
                    Template: {rule.templateName}
                  </Typography>
                )}
              </Box>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', minWidth: 0 }}>
                {renderTriggerChips(rule)}
              </Box>
              <Box sx={{ display: 'flex', minWidth: 0 }}>
                {renderActionChip(rule)}
              </Box>
              <Box sx={{ display: 'flex', minWidth: 0 }}>
                {renderChannelChip(rule)}
              </Box>
              <Box sx={{ display: 'flex', gap: 0.25, justifyContent: 'flex-end' }}>
                {renderRuleActions(rule)}
              </Box>
            </Box>
          ))}
          {/* Automatisations système (lecture seule) fusionnées dans la même liste */}
          {systemAutomations.length > 0 && (
            <>
              <Box sx={{ px: 2, py: 1, borderTop: '1px solid var(--hairline)', backgroundColor: 'var(--field)' }}>
                <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--faint)' }}>
                  {t('automation.system.title', 'Automatisations système')} · {t('automation.system.readOnly', 'Lecture seule')}
                </Typography>
              </Box>
              {systemAutomations.map((sa) => renderSystemRow(sa))}
            </>
          )}
        </Card>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          Automatisations système (hors hub) — lecture seule, statut réel
          ═══════════════════════════════════════════════════════════════════════ */}
      {/* En vue CARTE, les automatisations système restent une section dédiée en
          dessous ; en vue LISTE elles sont fusionnées dans la liste ci-dessus. */}
      {viewMode === 'card' && systemAutomations.length > 0 && (
        <Box sx={{ mt: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <Typography sx={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--ink)' }}>
              {t('automation.system.title', 'Automatisations système')}
            </Typography>
            <Chip
              label={t('automation.system.readOnly', 'Lecture seule')}
              size="small"
              sx={pillSx('var(--field)', 'var(--muted)')}
            />
          </Box>
          <Typography sx={{ fontSize: '0.8125rem', color: 'text.secondary', mb: 1.5 }}>
            {t('automation.system.subtitle', 'Automatisations gérées ailleurs dans le produit (hors règles). Affichées ici pour visibilité — leur statut reflète l’état réel.')}
          </Typography>
          <Grid container spacing={1.5}>
            {systemAutomations.map((sa) => (
              <Grid item xs={12} md={6} key={sa.key}>
                <Card sx={{ opacity: 0.94 }}>
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
                      <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--ink)', flex: 1 }}>
                        {sa.label}
                      </Typography>
                      <Chip label={sa.statusLabel} size="small" sx={systemStatusStyle(sa.status)} />
                    </Box>
                    <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary', mb: 1 }}>
                      {sa.description}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                      <Chip label={sa.triggerLabel} size="small" sx={pillSx('var(--accent-soft)', 'var(--accent)')} />
                      <Chip label={sa.actionLabel} size="small" sx={pillSx('var(--info-soft)', 'var(--info)')} />
                      <Chip label={sa.mechanism} size="small" sx={pillSx('var(--field)', 'var(--muted)')} />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
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
      <Dialog open={formOpen} onClose={() => setFormOpen(false)} maxWidth="sm" fullWidth>
        {/* Peau modale + tailles de champs : portées par le thème global */}
        <DialogTitle>
          {editingRule
            ? t('automation.editTitle', 'Modifier la regle')
            : t('automation.createTitle', 'Nouvelle regle d\'automatisation')}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <TextField
            label={t('automation.form.name', 'Nom de la regle')}
            size="small"
            fullWidth
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />

          <FormControl size="small" fullWidth>
            <InputLabel>{t('automation.form.trigger', 'Declencheur')}</InputLabel>
            <Select
              value={formData.triggerType}
              onChange={(e) => handleTriggerChange(e.target.value as AutomationTrigger)}
              label={t('automation.form.trigger', 'Declencheur')}
            >
              {TRIGGER_GROUPS.flatMap((group) => [
                <ListSubheader key={`grp-${group.label}`}>{group.label}</ListSubheader>,
                ...group.triggers.map((tg) => (
                  <MenuItem key={tg} value={tg}>
                    {TRIGGER_LABELS[tg]}
                  </MenuItem>
                )),
              ])}
            </Select>
          </FormControl>

          <FormControl size="small" fullWidth>
            <InputLabel>{t('automation.form.action', 'Action')}</InputLabel>
            <Select
              value={formData.actionType ?? ''}
              onChange={(e) => setFormData({ ...formData, actionType: e.target.value as AutomationAction })}
              label={t('automation.form.action', 'Action')}
            >
              {Array.from(new Set([
                ...(TRIGGER_ACTIONS[formData.triggerType] ?? []),
                ...(formData.actionType ? [formData.actionType] : []),
              ])).map((a) => (
                <MenuItem key={a} value={a}>
                  {ACTION_LABELS[a]}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Décalage/heure : uniquement pour les déclencheurs « cycle de vie ». */}
          {isLifecycleTrigger(formData.triggerType) && (
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <TextField
                label={t('automation.form.offset', 'Delai (jours)')}
                type="number"
                size="small"
                fullWidth
                value={formData.triggerOffsetDays}
                onChange={(e) => setFormData({ ...formData, triggerOffsetDays: Number(e.target.value) })}
                inputProps={{ min: -30, max: 30, step: 1 }}
              />
              <TextField
                label={t('automation.form.time', 'Heure')}
                type="time"
                size="small"
                fullWidth
                value={formData.triggerTime ?? '09:00'}
                onChange={(e) => setFormData({ ...formData, triggerTime: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Box>
          )}

          {/* Canal d'envoi : uniquement pour les actions de messagerie. */}
          {formData.actionType && isMessagingAction(formData.actionType) && (
            <FormControl size="small" fullWidth>
              <InputLabel>{t('automation.form.channel', 'Canal d\'envoi')}</InputLabel>
              <Select
                value={formData.deliveryChannel ?? 'EMAIL'}
                onChange={(e) => setFormData({ ...formData, deliveryChannel: e.target.value as MessageChannelType })}
                label={t('automation.form.channel', 'Canal d\'envoi')}
              >
                {CHANNEL_OPTIONS.map((c) => (
                  <MenuItem key={c.value} value={c.value}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {c.icon}
                      {c.label}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {/* Template : uniquement pour « Envoyer un message » (contenu libre). */}
          {formData.actionType && actionNeedsTemplate(formData.actionType) && (
            <FormControl size="small" fullWidth>
              <InputLabel>{t('automation.form.template', 'Template')}</InputLabel>
              <Select
                value={formData.templateId ?? ''}
                onChange={(e) => setFormData({ ...formData, templateId: e.target.value ? Number(e.target.value) : undefined })}
                label={t('automation.form.template', 'Template')}
              >
                <MenuItem value="">
                  <em>{t('common.none', 'Aucun')}</em>
                </MenuItem>
                {templates.map((tmpl: MessageTemplate) => (
                  <MenuItem key={tmpl.id} value={tmpl.id}>
                    {tmpl.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {/* Délai de grâce (action_config) : uniquement pour la révocation de code. */}
          {formData.actionType && actionUsesGraceHours(formData.actionType) && (
            <TextField
              label={t('automation.form.graceHours', 'Delai de grace (heures)')}
              type="number"
              size="small"
              fullWidth
              value={parseActionConfig(formData.actionConfig).graceHours ?? 4}
              onChange={(e) => setFormData({ ...formData, actionConfig: stringifyGraceHours(Number(e.target.value)) })}
              inputProps={{ min: 0, max: 72, step: 1 }}
              helperText={t('automation.form.graceHoursHelp', "Le code d'acces est revoque ce nombre d'heures apres le check-out.")}
            />
          )}

          <ConditionsEditor
            value={formData.conditions ?? undefined}
            onChange={(conditions) => setFormData({ ...formData, conditions })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFormOpen(false)} size="small">
            {t('common.cancel', 'Annuler')}
          </Button>
          <Button
            variant="contained"
            size="small"
            onClick={handleSubmit}
            disabled={isMutating || !formData.name.trim()}
          >
            {isMutating ? <CircularProgress size={16} /> : editingRule ? t('common.save', 'Enregistrer') : t('common.create', 'Creer')}
          </Button>
        </DialogActions>
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
    </Box>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
//  Executions Dialog
// ═══════════════════════════════════════════════════════════════════════════

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

  const fmtDate = (d: string) => new Date(d).toLocaleString('fr-FR');

  return (
    <Dialog open={ruleId !== null} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {t('automation.executionsTitle', 'Historique des executions')}
      </DialogTitle>
      <DialogContent sx={{ pt: '16px !important' }}>
        {isLoading ? (
          <Skeleton variant="rounded" height={220} sx={{ borderRadius: 'var(--radius-lg)' }} />
        ) : executions.length === 0 ? (
          <Typography sx={{ fontSize: '0.8125rem', color: 'text.secondary', textAlign: 'center', py: 3 }}>
            {t('automation.noExecutions', 'Aucune execution trouvee')}
          </Typography>
        ) : (
          <>
            <TableContainer>
              {/* Entêtes overline + hairlines : portées par le thème global */}
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{t('automation.exec.date', 'Date')}</TableCell>
                    <TableCell>{t('automation.exec.guest', 'Client')}</TableCell>
                    <TableCell>{t('automation.exec.reservation', 'Reservation')}</TableCell>
                    <TableCell align="center">{t('automation.exec.status', 'Status')}</TableCell>
                    <TableCell>{t('automation.exec.error', 'Erreur')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {executions.map((exec) => {
                    const tokens = EXEC_STATUS_TOKENS[exec.status] ?? { color: 'var(--muted)', soft: 'var(--hover)' };
                    return (
                      <TableRow key={exec.id} hover>
                        <TableCell sx={{ ...CELL_SX, fontVariantNumeric: 'tabular-nums' }}>{fmtDate(exec.createdAt)}</TableCell>
                        <TableCell sx={CELL_SX}>{exec.guestName}</TableCell>
                        <TableCell sx={{ ...CELL_SX, fontVariantNumeric: 'tabular-nums' }}>#{exec.reservationId}</TableCell>
                        <TableCell align="center">
                          <Chip label={exec.status} size="small" sx={pillSx(tokens.soft, tokens.color)} />
                        </TableCell>
                        <TableCell sx={{ ...CELL_SX, color: exec.errorMessage ? 'var(--err)' : 'var(--faint)' }}>
                          {exec.errorMessage ?? '—'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component="div"
              count={totalElements}
              page={page}
              onPageChange={(_, p) => onPageChange(p)}
              rowsPerPage={20}
              rowsPerPageOptions={[20]}
            />
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} size="small">
          {t('common.close', 'Fermer')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AutomationRulesPage;
