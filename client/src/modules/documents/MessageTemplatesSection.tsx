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
import { softChipSx } from '../../utils/statusUtils';

// ─── Constants ──────────────────────────────────────────────────────────────

// Palette Baitly : remplace les couleurs MUI brutes par les accents valides du produit.
const ACCENT_TEAL = '#4A9B8E';
const WARM = '#D4A574';
const SOFT_BLUE = '#7BA3C2';
const NEUTRAL = '#8A8378';
const DANGER_SOFT = '#C97A7A';

const TYPE_HEX: Record<string, string> = {
  CHECK_IN: ACCENT_TEAL,
  CHECK_OUT: WARM,
  WELCOME: SOFT_BLUE,
  CUSTOM: NEUTRAL,
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
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Box component="span" sx={{ display: 'inline-flex', color: 'text.disabled', mb: 2 }}>
            <Email size={40} strokeWidth={1.5} />
          </Box>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            {t('messaging.templates.empty')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t('messaging.templates.emptyDesc')}
          </Typography>
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
        </Paper>
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
          <Typography variant="body2" fontWeight={600}>{template.name}</Typography>
          <Chip
            label={TYPE_LABELS[template.type] || template.type}
            size="small"
            sx={softChipSx(TYPE_HEX[template.type] ?? NEUTRAL)}
          />
        </Stack0Spaced>
      </TableCell>
      <TableCell>
        <Chip
          label={t('messaging.templates.originUser')}
          size="small"
          sx={softChipSx(NEUTRAL)}
        />
      </TableCell>
      <TableCell>
        <Typography variant="body2" noWrap sx={{ maxWidth: 280, fontSize: '0.8125rem' }}>
          {template.subject}
        </Typography>
      </TableCell>
      <TableCell>
        <Chip label={template.language?.toUpperCase()} size="small" sx={softChipSx(NEUTRAL)} />
      </TableCell>
      <TableCell align="center">
        <Chip
          label={template.isActive ? t('messaging.templates.active') : t('messaging.templates.inactive')}
          size="small"
          sx={softChipSx(template.isActive ? ACCENT_TEAL : NEUTRAL)}
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
            sx={{ cursor: 'pointer', '&:hover': { color: ACCENT_TEAL } }}
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
              color: 'text.secondary',
              '&:hover': { color: DANGER_SOFT, backgroundColor: `${DANGER_SOFT}14` },
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
          <Typography variant="body2" fontWeight={600}>
            {t(`systemEmailTemplates.keys.${group.templateKey}`)}
          </Typography>
          <Chip
            label={t(`systemEmailTemplates.recipientShort.${group.recipientType}`)}
            size="small"
            sx={softChipSx(group.recipientType === 'GUEST' ? SOFT_BLUE : group.recipientType === 'OWNER' ? ACCENT_TEAL : NEUTRAL)}
          />
        </Stack0Spaced>
      </TableCell>
      <TableCell>
        <Chip
          label={group.isCustomized
            ? t('messaging.templates.originCustomized')
            : t('messaging.templates.originSystem')}
          size="small"
          sx={softChipSx(group.isCustomized ? ACCENT_TEAL : NEUTRAL)}
          variant={group.isCustomized ? 'filled' : 'outlined'}
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
          sx={softChipSx(NEUTRAL)}
        />
      </TableCell>
      <TableCell align="center">
        {/* Templates systeme toujours actifs (pas de notion d'activation cote BDD). */}
        <Chip
          label={t('messaging.templates.active')}
          size="small"
          sx={softChipSx(ACCENT_TEAL)}
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
            sx={{ cursor: 'pointer', '&:hover': { color: ACCENT_TEAL } }}
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
