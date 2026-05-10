import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Alert,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Email,
  Visibility,
} from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import PageHeader from '../../components/PageHeader';
import {
  guestMessagingApi,
  type MessageTemplate,
} from '../../services/api/guestMessagingApi';
import MessageTemplateEditor from './MessageTemplateEditor';
import AiMessagingControls from './AiMessagingControls';
import { useIsAiFeatureEnabled } from '../../hooks/useAi';

const TYPE_COLORS: Record<string, 'success' | 'warning' | 'info' | 'default'> = {
  CHECK_IN: 'success',
  CHECK_OUT: 'warning',
  WELCOME: 'info',
  PAYMENT_LINK: 'info',
  CUSTOM: 'default',
};

const TYPE_LABELS: Record<string, string> = {
  CHECK_IN: 'Check-in',
  CHECK_OUT: 'Check-out',
  WELCOME: 'Bienvenue',
  PAYMENT_LINK: 'Lien de paiement',
  CUSTOM: 'Personnalise',
};

export default function MessageTemplatesPage() {
  const { t } = useTranslation();
  const isMessagingAiEnabled = useIsAiFeatureEnabled('MESSAGING');
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
    } catch (err) {
      setError(t('messaging.templates.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const handleCreate = () => {
    setEditingTemplate(null);
    setEditorOpen(true);
  };

  const handleEdit = (template: MessageTemplate) => {
    setEditingTemplate(template);
    setEditorOpen(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await guestMessagingApi.deleteTemplate(id);
      await loadTemplates();
    } catch (err) {
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

  return (
    <Box>
      <PageHeader
        title={t('messaging.templates.title')}
        subtitle={t('messaging.templates.subtitle')}
        backPath="/settings"
        actions={
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={handleCreate}
            size="small"
          >
            {t('messaging.templates.create')}
          </Button>
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box display="flex" justifyContent="center" py={6}>
          <CircularProgress />
        </Box>
      ) : templates.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Box component="span" sx={{ display: 'inline-flex', color: 'text.disabled', mb: 2 }}><Email size={48} strokeWidth={1.75} /></Box>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            {t('messaging.templates.empty')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t('messaging.templates.emptyDesc')}
          </Typography>
          <Button variant="contained" startIcon={<Add />} onClick={handleCreate}>
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
                      color={TYPE_COLORS[template.type] || 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" noWrap sx={{ maxWidth: 250 }}>
                      {template.subject}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" textTransform="uppercase">
                      {template.language}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={template.isActive ? t('messaging.templates.active') : t('messaging.templates.inactive')}
                      color={template.isActive ? 'success' : 'default'}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title={t('common.edit')}>
                      <IconButton size="small" onClick={() => handleEdit(template)}>
                        <Edit fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={t('common.delete')}>
                      <IconButton size="small" color="error" onClick={() => handleDelete(template.id)}>
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

      {/* AI Messaging Controls */}
      {isMessagingAiEnabled && (
        <Box sx={{ mt: 2 }}>
          <AiMessagingControls />
        </Box>
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
}
