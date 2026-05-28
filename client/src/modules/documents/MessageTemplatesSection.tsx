import React, { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
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
import MessageTemplateEditor from '../messaging/MessageTemplateEditor';
import { softChipSx } from '../../utils/statusUtils';

// ─── Constants ──────────────────────────────────────────────────────────────

// Palette Baitly : remplace les couleurs MUI brutes (ED6C02, 0288d1...) par
// les accents valides du produit.
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
  CUSTOM: 'Personnalise',
};

// ─── Ref Interface ──────────────────────────────────────────────────────────

export interface MessageTemplatesSectionRef {
  fetchTemplates: () => void;
  openEditor: () => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

const MessageTemplatesSection = forwardRef<MessageTemplatesSectionRef>((_, ref) => {
  const { t } = useTranslation();
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);

  const loadTemplates = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await guestMessagingApi.getTemplates();
      setTemplates(data);
    } catch {
      setError(t('messaging.templates.loadError'));
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

      {templates.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Box component="span" sx={{ display: 'inline-flex', color: 'text.disabled', mb: 2 }}><Email size={48} strokeWidth={1.75} /></Box>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            {t('messaging.templates.empty')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t('messaging.templates.emptyDesc')}
          </Typography>
          <Button
            variant="contained"
            startIcon={<Add />}
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
                <TableCell>{t('messaging.templates.type')}</TableCell>
                <TableCell>{t('messaging.templates.subject')}</TableCell>
                <TableCell>{t('messaging.templates.language')}</TableCell>
                <TableCell align="center">{t('messaging.templates.status')}</TableCell>
                <TableCell align="right">{t('common.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {templates.map((template) => (
                <TableRow key={template.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>
                      {template.name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={TYPE_LABELS[template.type] || template.type}
                      size="small"
                      sx={softChipSx(TYPE_HEX[template.type] ?? NEUTRAL)}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" noWrap sx={{ maxWidth: 250, fontSize: '0.8125rem' }}>
                      {template.subject}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {/* Langue affichee en chip neutre (lieu de uppercase brut) */}
                    <Chip
                      label={template.language?.toUpperCase()}
                      size="small"
                      sx={softChipSx(NEUTRAL)}
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={template.isActive ? t('messaging.templates.active') : t('messaging.templates.inactive')}
                      size="small"
                      sx={softChipSx(template.isActive ? ACCENT_TEAL : NEUTRAL)}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title={t('common.edit')} arrow>
                      <IconButton
                        size="small"
                        onClick={() => handleEdit(template)}
                        aria-label={t('common.edit')}
                        sx={{ cursor: 'pointer', '&:hover': { color: ACCENT_TEAL } }}
                      >
                        <Edit fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={t('common.delete')} arrow>
                      <IconButton
                        size="small"
                        onClick={() => handleDelete(template.id)}
                        aria-label={t('common.delete')}
                        sx={{
                          cursor: 'pointer',
                          color: 'text.secondary',
                          '&:hover': { color: DANGER_SOFT, backgroundColor: `${DANGER_SOFT}14` },
                        }}
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Editor Dialog */}
      {editorOpen && (
        <MessageTemplateEditor
          open={editorOpen}
          template={editingTemplate}
          onClose={handleEditorClose}
          onSave={handleEditorSave}
        />
      )}
    </Box>
  );
});

MessageTemplatesSection.displayName = 'MessageTemplatesSection';

export default MessageTemplatesSection;
