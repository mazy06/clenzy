import React, { useState, useEffect, useCallback, forwardRef, useImperativeHandle, useMemo } from 'react';
import StatusChip, { STATUS_TONES, type ToneTokens } from '../../components/StatusChip';
import { Alert as BuiAlert, AlertDescription, AlertAction, Button as BuiButton } from '../../components/ui';
import { TriangleAlert, X } from 'lucide-react';
import { Spinner } from '../../components/ui';
import { IconButton, Tooltip } from '@mui/material';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui';
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
  ok: STATUS_TONES.ok,
  warn: STATUS_TONES.warn,
  info: STATUS_TONES.info,
  muted: STATUS_TONES.neutral,
} as const;

const TYPE_TONE: Record<string, ToneTokens> = {
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
      <div className="flex justify-center p-6">
        <Spinner className="size-10" />
      </div>
    );
  }

  return (
    <div>
      {error && (
        <BuiAlert variant="destructive" className="mb-3">
          <TriangleAlert />
          <AlertDescription>{error}</AlertDescription>
          <AlertAction>
            <BuiButton variant="ghost" size="icon-xs" aria-label="Fermer" onClick={() => setError(null)}>
              <X />
            </BuiButton>
          </AlertAction>
        </BuiAlert>
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon={<Email />}
          title={t('messaging.templates.empty')}
          description={t('messaging.templates.emptyDesc')}
          action={(
            <BuiButton
              size="sm"
              onClick={() => {
                setEditingTemplate(null);
                setEditorOpen(true);
              }}
            >
              <Add size={14} strokeWidth={1.75} />
              {t('messaging.templates.createFirst')}
            </BuiButton>
          )}
        />
      ) : (
        // Rayon 10px + fond --card : report de la surface MUI par defaut
        // (elevation 0, sans bordure) que portait l'ancien conteneur.
        <div className="overflow-x-auto rounded-[10px] bg-[var(--card)]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('messaging.templates.name')}</TableHead>
                <TableHead>{t('messaging.templates.origin')}</TableHead>
                <TableHead>{t('messaging.templates.subject')}</TableHead>
                <TableHead>{t('messaging.templates.language')}</TableHead>
                <TableHead className="text-center">{t('messaging.templates.status')}</TableHead>
                <TableHead className="text-center">{t('messaging.templates.version')}</TableHead>
                <TableHead>{t('messaging.templates.createdBy')}</TableHead>
                <TableHead className="text-end">{t('common.actions')}</TableHead>
              </TableRow>
            </TableHeader>
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
        </div>
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
    </div>
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
    <TableRow>
      <TableCell>
        <Stack0Spaced>
          <p className="cn-text-body2 font-semibold text-[var(--ink)]">{template.name}</p>
          <StatusChip
            label={TYPE_LABELS[template.type] || template.type} tokens={TYPE_TONE[template.type] ?? TONE.muted}
          />
        </Stack0Spaced>
      </TableCell>
      <TableCell>
        <StatusChip
          label={t('messaging.templates.originUser')} tokens={TONE.muted}
        />
      </TableCell>
      <TableCell>
        <p className="cn-text-body2 truncate max-w-[280px] text-[0.8125rem]">
          {template.subject}
        </p>
      </TableCell>
      <TableCell>
        <StatusChip label={template.language?.toUpperCase()} tokens={TONE.muted} />
      </TableCell>
      <TableCell className="text-center">
        <StatusChip
          label={template.isActive ? t('messaging.templates.active') : t('messaging.templates.inactive')} tokens={template.isActive ? TONE.ok : TONE.muted}
        />
      </TableCell>
      <TableCell className="text-center">
        <span className="cn-text-caption font-mono text-muted-foreground">v1</span>
      </TableCell>
      <TableCell>
        {/* Pas de createdBy dans le DTO actuel pour les user templates.
            Affiche un dash pour ne pas mentir et garder la colonne alignee. */}
        <p className="cn-text-body2 text-muted-foreground text-[0.8125rem]">—</p>
      </TableCell>
      <TableCell className="text-end">
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
    <TableRow>
      <TableCell>
        <Stack0Spaced>
          <p className="cn-text-body2 font-semibold text-[var(--ink)]">
            {t(`systemEmailTemplates.keys.${group.templateKey}`)}
          </p>
          <StatusChip
            label={t(`systemEmailTemplates.recipientShort.${group.recipientType}`)} tokens={group.recipientType === 'GUEST' ? TONE.info : group.recipientType === 'OWNER' ? TONE.ok : TONE.muted}
          />
        </Stack0Spaced>
      </TableCell>
      <TableCell>
        <StatusChip
          label={group.isCustomized
            ? t('messaging.templates.originCustomized')
            : t('messaging.templates.originSystem')} tokens={group.isCustomized ? TONE.ok : TONE.muted}
        />
      </TableCell>
      <TableCell>
        <p className="cn-text-body2 truncate max-w-[280px] text-[0.8125rem]">
          {firstLang?.subject ?? '—'}
        </p>
      </TableCell>
      <TableCell>
        {/* Chip langue identique a UserRow pour coherence (1ere langue dispo —
            les autres sont accessibles dans le dialog d'edition via le selecteur). */}
        <StatusChip
          label={Object.keys(group.languages)[0]?.toUpperCase() ?? '—'} tokens={TONE.muted}
        />
      </TableCell>
      <TableCell className="text-center">
        {/* Templates systeme toujours actifs (pas de notion d'activation cote BDD). */}
        <StatusChip
          label={t('messaging.templates.active')} tokens={TONE.ok}
        />
      </TableCell>
      <TableCell className="text-center">
        <span className="cn-text-caption font-mono text-muted-foreground">v1</span>
      </TableCell>
      <TableCell>
        <p className="cn-text-body2 text-muted-foreground text-[0.8125rem]">
          {t('messaging.templates.systemAuthor')}
        </p>
      </TableCell>
      <TableCell className="text-end">
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
  <div className="inline-flex items-center gap-1.5">{children}</div>
);

export default MessageTemplatesSection;
