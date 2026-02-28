import React, { useState, useCallback } from 'react';
import {
  Box, Paper, Typography, Button, Chip, Switch, IconButton, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  MenuItem, Select, FormControl, InputLabel, CircularProgress, Alert,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Card, CardContent, Grid, TablePagination,
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
} from '@mui/icons-material';
import PageHeader from '../../components/PageHeader';
import ConfirmationModal from '../../components/ConfirmationModal';
import { useTranslation } from '../../hooks/useTranslation';
import { SPACING } from '../../theme/spacing';
import {
  useAutomationRules,
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
import { TRIGGER_LABELS, CHANNEL_TYPE_COLORS } from '../../services/api/automationRulesApi';
import { guestMessagingApi } from '../../services/api/guestMessagingApi';
import type { MessageTemplate } from '../../services/api/guestMessagingApi';
import { useQuery } from '@tanstack/react-query';

// ─── Constants ──────────────────────────────────────────────────────────────

const TRIGGER_OPTIONS: { value: AutomationTrigger; label: string }[] = [
  { value: 'RESERVATION_CONFIRMED', label: 'Reservation confirmee' },
  { value: 'CHECK_IN_APPROACHING', label: 'Check-in approche' },
  { value: 'CHECK_IN_DAY', label: 'Jour du check-in' },
  { value: 'CHECK_OUT_DAY', label: 'Jour du check-out' },
  { value: 'CHECK_OUT_PASSED', label: 'Apres le check-out' },
  { value: 'REVIEW_REMINDER', label: 'Rappel avis' },
];

const CHANNEL_OPTIONS: { value: MessageChannelType; label: string; icon: React.ReactNode }[] = [
  { value: 'EMAIL', label: 'Email', icon: <EmailIcon sx={{ fontSize: '0.875rem' }} /> },
  { value: 'SMS', label: 'SMS', icon: <SmsIcon sx={{ fontSize: '0.875rem' }} /> },
  { value: 'WHATSAPP', label: 'WhatsApp', icon: <WhatsAppIcon sx={{ fontSize: '0.875rem' }} /> },
];

const CARD_SX = {
  border: '1px solid',
  borderColor: 'divider',
  boxShadow: 'none',
  borderRadius: 1.5,
} as const;

const CELL_SX = { fontSize: '0.8125rem', py: 1.25 } as const;
const HEAD_CELL_SX = { fontSize: '0.75rem', fontWeight: 700, py: 1, color: 'text.secondary' } as const;

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
      templateId: rule.templateId ?? undefined,
      deliveryChannel: rule.deliveryChannel ?? 'EMAIL',
    });
    setFormOpen(true);
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

  return (
    <Box sx={{ p: SPACING.PAGE_PADDING }}>
      <PageHeader
        title={t('automation.title', 'Regles d\'automatisation')}
        subtitle={t('automation.subtitle', 'Automatisez les messages et actions pour vos reservations')}
        showBackButton={false}
        backPath="/settings"
        actions={
          <Button
            size="small"
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleOpenCreate}
            sx={{ textTransform: 'none', fontSize: '0.75rem' }}
          >
            {t('automation.create', 'Nouvelle regle')}
          </Button>
        }
      />

      {/* ── Rules list ── */}
      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={32} />
        </Box>
      ) : isError ? (
        <Alert severity="error" sx={{ fontSize: '0.8125rem' }}>
          {t('automation.error', 'Erreur lors du chargement des regles')}
        </Alert>
      ) : sortedRules.length === 0 ? (
        <Paper sx={{ ...CARD_SX, p: 4, textAlign: 'center' }}>
          <AutomationIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
          <Typography sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>
            {t('automation.empty', 'Aucune regle d\'automatisation configuree')}
          </Typography>
          <Button
            size="small"
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={handleOpenCreate}
            sx={{ mt: 1.5, textTransform: 'none', fontSize: '0.75rem' }}
          >
            {t('automation.create', 'Nouvelle regle')}
          </Button>
        </Paper>
      ) : (
        <Grid container spacing={1.5}>
          {sortedRules.map((rule) => (
            <Grid item xs={12} md={6} key={rule.id}>
              <Card sx={{ ...CARD_SX, p: 0 }}>
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  {/* Header row */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, flex: 1 }}>
                      {rule.name}
                    </Typography>
                    <Switch
                      size="small"
                      checked={rule.enabled}
                      onChange={() => handleToggle(rule.id)}
                      disabled={toggleMutation.isPending}
                    />
                  </Box>

                  {/* Info row */}
                  <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 1.5 }}>
                    <Chip
                      label={TRIGGER_LABELS[rule.triggerType] ?? rule.triggerType}
                      size="small"
                      sx={{ fontSize: '0.625rem', height: 22, fontWeight: 600 }}
                    />
                    {rule.triggerOffsetDays !== 0 && (
                      <Chip
                        label={`${rule.triggerOffsetDays > 0 ? '+' : ''}${rule.triggerOffsetDays}j`}
                        size="small"
                        variant="outlined"
                        sx={{ fontSize: '0.625rem', height: 22 }}
                      />
                    )}
                    {rule.triggerTime && (
                      <Chip
                        label={rule.triggerTime}
                        size="small"
                        variant="outlined"
                        sx={{ fontSize: '0.625rem', height: 22 }}
                      />
                    )}
                    <Chip
                      icon={channelIcon(rule.deliveryChannel) as React.ReactElement}
                      label={rule.deliveryChannel}
                      size="small"
                      sx={{
                        fontSize: '0.625rem',
                        height: 22,
                        fontWeight: 700,
                        backgroundColor: CHANNEL_TYPE_COLORS[rule.deliveryChannel] ?? '#666',
                        color: '#fff',
                        '& .MuiChip-icon': { color: '#fff' },
                      }}
                    />
                  </Box>

                  {/* Template */}
                  {rule.templateName && (
                    <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mb: 1 }}>
                      Template: {rule.templateName}
                    </Typography>
                  )}

                  {/* Actions */}
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <Tooltip title={t('common.edit', 'Modifier')}>
                      <IconButton size="small" onClick={() => handleOpenEdit(rule)}>
                        <EditIcon sx={{ fontSize: '0.875rem' }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={t('automation.executions', 'Executions')}>
                      <IconButton size="small" color="info" onClick={() => { setExecRuleId(rule.id); setExecPage(0); }}>
                        <ExecutionsIcon sx={{ fontSize: '0.875rem' }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={t('common.delete', 'Supprimer')}>
                      <IconButton size="small" color="error" onClick={() => setDeleteTarget(rule)}>
                        <DeleteIcon sx={{ fontSize: '0.875rem' }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          Create / Edit Dialog
          ═══════════════════════════════════════════════════════════════════════ */}
      <Dialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle sx={{ fontSize: '0.9375rem', fontWeight: 700 }}>
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
            InputProps={{ sx: { fontSize: '0.8125rem' } }}
            InputLabelProps={{ sx: { fontSize: '0.8125rem' } }}
          />

          <FormControl size="small" fullWidth>
            <InputLabel sx={{ fontSize: '0.8125rem' }}>{t('automation.form.trigger', 'Declencheur')}</InputLabel>
            <Select
              value={formData.triggerType}
              onChange={(e) => setFormData({ ...formData, triggerType: e.target.value as AutomationTrigger })}
              label={t('automation.form.trigger', 'Declencheur')}
              sx={{ fontSize: '0.8125rem' }}
            >
              {TRIGGER_OPTIONS.map((o) => (
                <MenuItem key={o.value} value={o.value} sx={{ fontSize: '0.8125rem' }}>
                  {o.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <TextField
              label={t('automation.form.offset', 'Delai (jours)')}
              type="number"
              size="small"
              fullWidth
              value={formData.triggerOffsetDays}
              onChange={(e) => setFormData({ ...formData, triggerOffsetDays: Number(e.target.value) })}
              inputProps={{ min: -30, max: 30, step: 1 }}
              InputProps={{ sx: { fontSize: '0.8125rem' } }}
              InputLabelProps={{ sx: { fontSize: '0.8125rem' } }}
            />
            <TextField
              label={t('automation.form.time', 'Heure')}
              type="time"
              size="small"
              fullWidth
              value={formData.triggerTime ?? '09:00'}
              onChange={(e) => setFormData({ ...formData, triggerTime: e.target.value })}
              InputLabelProps={{ shrink: true, sx: { fontSize: '0.8125rem' } }}
              InputProps={{ sx: { fontSize: '0.8125rem' } }}
            />
          </Box>

          <FormControl size="small" fullWidth>
            <InputLabel sx={{ fontSize: '0.8125rem' }}>{t('automation.form.channel', 'Canal d\'envoi')}</InputLabel>
            <Select
              value={formData.deliveryChannel ?? 'EMAIL'}
              onChange={(e) => setFormData({ ...formData, deliveryChannel: e.target.value as MessageChannelType })}
              label={t('automation.form.channel', 'Canal d\'envoi')}
              sx={{ fontSize: '0.8125rem' }}
            >
              {CHANNEL_OPTIONS.map((c) => (
                <MenuItem key={c.value} value={c.value} sx={{ fontSize: '0.8125rem' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {c.icon}
                    {c.label}
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" fullWidth>
            <InputLabel sx={{ fontSize: '0.8125rem' }}>{t('automation.form.template', 'Template')}</InputLabel>
            <Select
              value={formData.templateId ?? ''}
              onChange={(e) => setFormData({ ...formData, templateId: e.target.value ? Number(e.target.value) : undefined })}
              label={t('automation.form.template', 'Template')}
              sx={{ fontSize: '0.8125rem' }}
            >
              <MenuItem value="">
                <em>{t('common.none', 'Aucun')}</em>
              </MenuItem>
              {templates.map((tmpl: MessageTemplate) => (
                <MenuItem key={tmpl.id} value={tmpl.id} sx={{ fontSize: '0.8125rem' }}>
                  {tmpl.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label={t('automation.form.conditions', 'Conditions (JSON, optionnel)')}
            size="small"
            fullWidth
            multiline
            rows={2}
            value={formData.conditions ?? ''}
            onChange={(e) => setFormData({ ...formData, conditions: e.target.value || undefined })}
            InputProps={{ sx: { fontSize: '0.75rem', fontFamily: 'monospace' } }}
            InputLabelProps={{ sx: { fontSize: '0.8125rem' } }}
            placeholder='{"minNights": 3}'
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setFormOpen(false)} size="small" sx={{ textTransform: 'none', fontSize: '0.8125rem' }}>
            {t('common.cancel', 'Annuler')}
          </Button>
          <Button
            variant="contained"
            size="small"
            onClick={handleSubmit}
            disabled={isMutating || !formData.name.trim()}
            sx={{ textTransform: 'none', fontSize: '0.8125rem' }}
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

  const statusColor = (status: string) => {
    switch (status) {
      case 'SUCCESS': return '#4A9B8E';
      case 'FAILED': return '#ef5350';
      case 'SKIPPED': return '#D4A574';
      default: return '#9e9e9e';
    }
  };

  return (
    <Dialog
      open={ruleId !== null}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { borderRadius: 2 } }}
    >
      <DialogTitle sx={{ fontSize: '0.9375rem', fontWeight: 700 }}>
        {t('automation.executionsTitle', 'Historique des executions')}
      </DialogTitle>
      <DialogContent>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress size={28} />
          </Box>
        ) : executions.length === 0 ? (
          <Typography sx={{ fontSize: '0.8125rem', color: 'text.secondary', textAlign: 'center', py: 3 }}>
            {t('automation.noExecutions', 'Aucune execution trouvee')}
          </Typography>
        ) : (
          <>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={HEAD_CELL_SX}>{t('automation.exec.date', 'Date')}</TableCell>
                    <TableCell sx={HEAD_CELL_SX}>{t('automation.exec.guest', 'Client')}</TableCell>
                    <TableCell sx={HEAD_CELL_SX}>{t('automation.exec.reservation', 'Reservation')}</TableCell>
                    <TableCell sx={HEAD_CELL_SX} align="center">{t('automation.exec.status', 'Status')}</TableCell>
                    <TableCell sx={HEAD_CELL_SX}>{t('automation.exec.error', 'Erreur')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {executions.map((exec) => (
                    <TableRow key={exec.id} hover>
                      <TableCell sx={{ ...CELL_SX, fontSize: '0.75rem' }}>{fmtDate(exec.createdAt)}</TableCell>
                      <TableCell sx={CELL_SX}>{exec.guestName}</TableCell>
                      <TableCell sx={CELL_SX}>#{exec.reservationId}</TableCell>
                      <TableCell align="center">
                        <Chip
                          label={exec.status}
                          size="small"
                          sx={{
                            fontSize: '0.625rem',
                            height: 20,
                            fontWeight: 700,
                            backgroundColor: statusColor(exec.status),
                            color: '#fff',
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ ...CELL_SX, fontSize: '0.75rem', color: 'error.main' }}>
                        {exec.errorMessage ?? '—'}
                      </TableCell>
                    </TableRow>
                  ))}
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
              sx={{ fontSize: '0.75rem' }}
            />
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} size="small" sx={{ textTransform: 'none', fontSize: '0.8125rem' }}>
          {t('common.close', 'Fermer')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AutomationRulesPage;
