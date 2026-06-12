import React, { useState, useEffect, useCallback, forwardRef, useImperativeHandle, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Alert,
  CircularProgress,
  IconButton,
  Tooltip,
  Button,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Email,
} from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import {
  guestMessagingApi,
  type MessageTemplate,
} from '../../services/api/guestMessagingApi';
import { systemEmailTemplatesApi, type SystemEmailTemplateGroup } from '../../services/api/systemEmailTemplatesApi';
import MessageTemplateEditor from '../messaging/MessageTemplateEditor';
import SystemTemplateEditDialog from './SystemTemplateEditDialog';
import EmptyState from '../../components/EmptyState';

// ─── Constants ──────────────────────────────────────────────────────────────

/** Tons sémantiques (tokens Signature) pour les chips -soft. */
const TONE = {
  ok:    { color: 'var(--ok)',    bgcolor: 'var(--ok-soft)' },
  warn:  { color: 'var(--warn)',  bgcolor: 'var(--warn-soft)' },
  info:  { color: 'var(--info)',  bgcolor: 'var(--info-soft)' },
  muted: { color: 'var(--muted)', bgcolor: 'var(--hover)' },
} as const;

const TYPE_TONE: Record<string, { color: string; bgcolor: string }> = {
  CHECK_IN: TONE.ok,
  CHECK_OUT: TONE.warn,
  WELCOME: TONE.info,
  CUSTOM: TONE.muted,
};

const TYPE_LABELS: Record<string, string> = {
  CHECK_IN: 'Check-in',
  CHECK_OUT: 'Check-out',
  WELCOME: 'Bienvenue',
  CUSTOM: 'Personnalisé',
};

// ─── Types ──────────────────────────────────────────────────────────────────

/**
 * Vue unifiee dans la table : les 2 origines (user/system) sont fusionnees
 * via cette interface commune. Click "Edit" route vers le bon dialog selon
 * l'origine.
 */
type UnifiedRow =
  | { origin: 'user'; data: MessageTemplate }
  | { origin: 'system'; data: SystemEmailTemplateGroup };

export interface MessageTemplatesSectionRef {
  fetchTemplates: () => void;
  openEditor: () => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

const MessageTemplatesSection = forwardRef<MessageTemplatesSectionRef>((_, ref) => {
  const { t } = useTranslation();
  const [userTemplates, setUserTemplates] = useState<MessageTemplate[]>([]);
  const [systemTemplates, setSystemTemplates] = useState<SystemEmailTemplateGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [systemEditingKey, setSystemEditingKey] = useState<string | null>(null);

  const loadTemplates = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      // Fetch en parallele : user templates (table message_templates) + system
      // templates (table system_email_template). Best-effort : si une des
      // 2 echoue, on affiche l'autre + une banniere d'erreur.
      const [users, systems] = await Promise.allSettled([
        guestMessagingApi.getTemplates(),
        systemEmailTemplatesApi.list(),
      ]);
      if (users.status === 'fulfilled') {
        setUserTemplates(users.value);
      } else {
        setError(t('messaging.templates.loadError'));
      }
      if (systems.status === 'fulfilled') {
        setSystemTemplates(systems.value);
      }
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  useImperativeHandle(ref, () => ({
    fetchTemplates: () => loadTemplates(),
    openEditor: () => {
      setEditingTemplate(null);
      setEditorOpen(true);
    },
  }));

  const handleEdit = (template: MessageTemplate) => {
    setEditingTemplate(template);
    setEditorOpen(true);
  };

  const handleEditSystem = (templateKey: string) => {
    setSystemEditingKey(templateKey);
  };

  const handleDelete = async (id: number) => {
    try {
      await guestMessagingApi.deleteTemplate(id);
      await loadTemplates();
    } catch {
      setError(t('messaging.templates.deleteError'));
    }
  };

  const handleEditorClose = () => {
    setEditorOpen(false);
    setEditingTemplate(null);
  };

  const handleEditorSave = async () => {
    handleEditorClose();
    await loadTemplates();
  };

  const handleSystemDialogClose = () => {
    setSystemEditingKey(null);
    // Refetch pour reflechir un eventuel override save/delete.
    loadTemplates();
  };

  // Construction de la liste unifiee. Systeme d'abord (templates "officiels"
  // Baitly), puis les custom user. Au sein de chaque groupe, tri stable.
  const rows: UnifiedRow[] = useMemo(() => {
    const systemRows: UnifiedRow[] = [...systemTemplates]
      .sort((a, b) => a.templateKey.localeCompare(b.templateKey))
      .map((g) => ({ origin: 'system' as const, data: g }));
    const userRows: UnifiedRow[] = [...userTemplates]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((t) => ({ origin: 'user' as const, data: t }));
    return [...systemRows, ...userRows];
  }, [systemTemplates, userTemplates]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon={<Email />}
          title={t('messaging.templates.empty')}
          description={t('messaging.templates.emptyDesc')}
          action={(
            <Button
              variant="contained"
              startIcon={<Add size={14} strokeWidth={1.75} />}
              size="small"
              onClick={() => {
                setEditingTemplate(null);
                setEditorOpen(true);
              }}
            >
              {t('messaging.templates.createFirst')}
            </Button>
          )}
        />
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t('messaging.templates.name')}</TableCell>
                <TableCell>{t('messaging.templates.origin')}</TableCell>
                <TableCell>{t('messaging.templates.subject')}</TableCell>
                <TableCell>{t('messaging.templates.language')}</TableCell>
                <TableCell align="center">{t('messaging.templates.status')}</TableCell>
                <TableCell align="center">{t('messaging.templates.version')}</TableCell>
                <TableCell>{t('messaging.templates.createdBy')}</TableCell>
                <TableCell align="right">{t('common.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                row.origin === 'user'
                  ? <UserRow
                      key={`u-${row.data.id}`}
                      template={row.data}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  : <SystemRow
                      key={`s-${row.data.templateKey}`}
                      group={row.data}
                      onEdit={handleEditSystem}
                    />
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Editor user templates (flow existant inchange) */}
      {editorOpen && (
        <MessageTemplateEditor
          open={editorOpen}
          template={editingTemplate}
          onClose={handleEditorClose}
          onSave={handleEditorSave}
        />
      )}

      {/* Editor system templates (plain text + 3 langues + override per-org) */}
      {systemEditingKey && (
        <SystemTemplateEditDialog
          templateKey={systemEditingKey}
          open={true}
          onClose={handleSystemDialogClose}
        />
      )}
    </Box>
  );
});

MessageTemplatesSection.displayName = 'MessageTemplatesSection';

// ─── Row : template user (custom messages voyageurs) ─────────────────────────

interface UserRowProps {
  template: MessageTemplate;
  onEdit: (template: MessageTemplate) => void;
  onDelete: (id: number) => void;
}

const UserRow: React.FC<UserRowProps> = ({ template, onEdit, onDelete }) => {
  const { t } = useTranslation();
  return (
    <TableRow hover>
      <TableCell>
        <Stack0Spaced>
          <Typography variant="body2" fontWeight={600} sx={{ color: 'var(--ink)' }}>{template.name}</Typography>
          <Chip
            label={TYPE_LABELS[template.type] || template.type}
            size="small"
            sx={TYPE_TONE[template.type] ?? TONE.muted}
          />
        </Stack0Spaced>
      </TableCell>
      <TableCell>
        <Chip
          label={t('messaging.templates.originUser')}
          size="small"
          sx={TONE.muted}
        />
      </TableCell>
      <TableCell>
        <Typography variant="body2" noWrap sx={{ maxWidth: 280, fontSize: '0.8125rem' }}>
          {template.subject}
        </Typography>
      </TableCell>
      <TableCell>
        <Chip label={template.language?.toUpperCase()} size="small" sx={TONE.muted} />
      </TableCell>
      <TableCell align="center">
        <Chip
          label={template.isActive ? t('messaging.templates.active') : t('messaging.templates.inactive')}
          size="small"
          sx={template.isActive ? TONE.ok : TONE.muted}
        />
      </TableCell>
      <TableCell align="center">
        <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>v1</Typography>
      </TableCell>
      <TableCell>
        {/* Pas de createdBy dans le DTO actuel pour les user templates.
            Affiche un dash pour ne pas mentir et garder la colonne alignee. */}
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem' }}>—</Typography>
      </TableCell>
      <TableCell align="right">
        <Tooltip title={t('common.edit')} arrow>
          <IconButton
            size="small"
            onClick={() => onEdit(template)}
            aria-label={t('common.edit')}
            sx={{ cursor: 'pointer', '&:hover': { color: 'var(--accent)', backgroundColor: 'var(--accent-soft)' } }}
          >
            <Edit size={16} strokeWidth={1.75} />
          </IconButton>
        </Tooltip>
        <Tooltip title={t('common.delete')} arrow>
          <IconButton
            size="small"
            onClick={() => onDelete(template.id)}
            aria-label={t('common.delete')}
            sx={{
              cursor: 'pointer',
              color: 'var(--muted)',
              '&:hover': { color: 'var(--err)', backgroundColor: 'var(--err-soft)' },
            }}
          >
            <Delete size={16} strokeWidth={1.75} />
          </IconButton>
        </Tooltip>
      </TableCell>
    </TableRow>
  );
};

// ─── Row : template systeme Baitly (alertes, invitations, notifications) ────

interface SystemRowProps {
  group: SystemEmailTemplateGroup;
  onEdit: (templateKey: string) => void;
}

const SystemRow: React.FC<SystemRowProps> = ({ group, onEdit }) => {
  const { t } = useTranslation();

  // Affichage compact : nom system + subject de la 1ere langue dispo (fr en general)
  const firstLang = Object.values(group.languages)[0];

  return (
    <TableRow hover>
      <TableCell>
        <Stack0Spaced>
          <Typography variant="body2" fontWeight={600} sx={{ color: 'var(--ink)' }}>
            {t(`systemEmailTemplates.keys.${group.templateKey}`)}
          </Typography>
          <Chip
            label={t(`systemEmailTemplates.recipientShort.${group.recipientType}`)}
            size="small"
            sx={group.recipientType === 'GUEST' ? TONE.info : group.recipientType === 'OWNER' ? TONE.ok : TONE.muted}
          />
        </Stack0Spaced>
      </TableCell>
      <TableCell>
        <Chip
          label={group.isCustomized
            ? t('messaging.templates.originCustomized')
            : t('messaging.templates.originSystem')}
          size="small"
          sx={group.isCustomized ? TONE.ok : TONE.muted}
        />
      </TableCell>
      <TableCell>
        <Typography variant="body2" noWrap sx={{ maxWidth: 280, fontSize: '0.8125rem' }}>
          {firstLang?.subject ?? '—'}
        </Typography>
      </TableCell>
      <TableCell>
        {/* Chip langue identique a UserRow pour coherence (1ere langue dispo —
            les autres sont accessibles dans le dialog d'edition via le selecteur). */}
        <Chip
          label={Object.keys(group.languages)[0]?.toUpperCase() ?? '—'}
          size="small"
          sx={TONE.muted}
        />
      </TableCell>
      <TableCell align="center">
        {/* Templates systeme toujours actifs (pas de notion d'activation cote BDD). */}
        <Chip
          label={t('messaging.templates.active')}
          size="small"
          sx={TONE.ok}
        />
      </TableCell>
      <TableCell align="center">
        <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>v1</Typography>
      </TableCell>
      <TableCell>
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem' }}>
          {t('messaging.templates.systemAuthor')}
        </Typography>
      </TableCell>
      <TableCell align="right">
        <Tooltip title={t('common.edit')} arrow>
          <IconButton
            size="small"
            onClick={() => onEdit(group.templateKey)}
            aria-label={t('common.edit')}
            sx={{ cursor: 'pointer', '&:hover': { color: 'var(--accent)', backgroundColor: 'var(--accent-soft)' } }}
          >
            <Edit size={16} strokeWidth={1.75} />
          </IconButton>
        </Tooltip>
      </TableCell>
    </TableRow>
  );
};

// Petit helper layout : inline-flex stack horizontale avec gap.
const Stack0Spaced: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>{children}</Box>
);

export default MessageTemplatesSection;
