import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Grid,
  Box,
  Typography,
  Chip,
  Paper,
  CircularProgress,
  Alert,
  Divider,
} from '@mui/material';
import { Save, ContentCopy } from '@mui/icons-material';
import { useTranslation } from '../../hooks/useTranslation';
import {
  guestMessagingApi,
  type MessageTemplate,
  type TemplateVariable,
} from '../../services/api/guestMessagingApi';

interface MessageTemplateEditorProps {
  open: boolean;
  template: MessageTemplate | null;
  onClose: () => void;
  onSave: () => void;
}

const TEMPLATE_TYPES = [
  { value: 'CHECK_IN', label: 'Check-in' },
  { value: 'CHECK_OUT', label: 'Check-out' },
  { value: 'WELCOME', label: 'Bienvenue' },
  { value: 'CUSTOM', label: 'Personnalise' },
];

const LANGUAGES = [
  { value: 'fr', label: 'Francais' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Espanol' },
];

export default function MessageTemplateEditor({
  open,
  template,
  onClose,
  onSave,
}: MessageTemplateEditorProps) {
  const { t } = useTranslation();
  const isEditing = Boolean(template);

  const [name, setName] = useState('');
  const [type, setType] = useState('CHECK_IN');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [language, setLanguage] = useState('fr');
  const [variables, setVariables] = useState<TemplateVariable[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (template) {
      setName(template.name);
      setType(template.type);
      setSubject(template.subject);
      setBody(template.body);
      setLanguage(template.language);
    } else {
      setName('');
      setType('CHECK_IN');
      setSubject('');
      setBody('');
      setLanguage('fr');
    }
  }, [template]);

  useEffect(() => {
    guestMessagingApi.getVariables().then(setVariables).catch(() => {});
  }, []);

  const handleInsertVariable = (key: string) => {
    const variable = `{${key}}`;
    setBody((prev) => prev + variable);
  };

  const handleInsertVariableInSubject = (key: string) => {
    const variable = `{${key}}`;
    setSubject((prev) => prev + variable);
  };

  const handleSave = async () => {
    if (!name.trim() || !subject.trim() || !body.trim()) {
      setError(t('messaging.templates.editor.requiredFields'));
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const data = { name, type, subject, body, language };

      if (isEditing && template) {
        await guestMessagingApi.updateTemplate(template.id, data);
      } else {
        await guestMessagingApi.createTemplate(data);
      }

      onSave();
    } catch (err) {
      setError(t('messaging.templates.editor.saveError'));
    } finally {
      setSaving(false);
    }
  };

  // Preview : remplace les variables par des exemples
  const getPreviewText = (text: string): string => {
    let preview = text;
    for (const v of variables) {
      preview = preview.replace(new RegExp(`\\{${v.key}\\}`, 'g'), v.example);
    }
    return preview;
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{ sx: { minHeight: '70vh' } }}
    >
      <DialogTitle>
        {isEditing
          ? t('messaging.templates.editor.editTitle')
          : t('messaging.templates.editor.createTitle')}
      </DialogTitle>

      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Grid container spacing={3}>
          {/* Formulaire */}
          <Grid item xs={12} md={7}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label={t('messaging.templates.editor.name')}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  size="small"
                  required
                />
              </Grid>
              <Grid item xs={6} sm={3}>
                <TextField
                  fullWidth
                  select
                  label={t('messaging.templates.editor.type')}
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  size="small"
                >
                  {TEMPLATE_TYPES.map((t) => (
                    <MenuItem key={t.value} value={t.value}>
                      {t.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={6} sm={3}>
                <TextField
                  fullWidth
                  select
                  label={t('messaging.templates.editor.language')}
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  size="small"
                >
                  {LANGUAGES.map((l) => (
                    <MenuItem key={l.value} value={l.value}>
                      {l.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label={t('messaging.templates.editor.subject')}
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  size="small"
                  required
                  helperText={t('messaging.templates.editor.subjectHelper')}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label={t('messaging.templates.editor.body')}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  multiline
                  rows={12}
                  required
                  helperText={t('messaging.templates.editor.bodyHelper')}
                />
              </Grid>
            </Grid>

            {/* Preview */}
            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                {t('messaging.templates.editor.preview')}
              </Typography>
              <Paper variant="outlined" sx={{ p: 2, bgcolor: 'action.hover' }}>
                <Typography variant="subtitle2" gutterBottom>
                  {t('messaging.templates.editor.previewSubject')}: {getPreviewText(subject) || '—'}
                </Typography>
                <Divider sx={{ my: 1 }} />
                <Typography
                  variant="body2"
                  sx={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}
                >
                  {getPreviewText(body) || '—'}
                </Typography>
              </Paper>
            </Box>
          </Grid>

          {/* Variables sidebar */}
          <Grid item xs={12} md={5}>
            <Paper variant="outlined" sx={{ p: 2, position: 'sticky', top: 16 }}>
              <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                {t('messaging.templates.editor.variables')}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5 }}>
                {t('messaging.templates.editor.variablesDesc')}
              </Typography>

              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {variables.map((v) => (
                  <Chip
                    key={v.key}
                    label={`{${v.key}}`}
                    size="small"
                    variant="outlined"
                    onClick={() => handleInsertVariable(v.key)}
                    title={`${v.description} — ex: ${v.example}`}
                    sx={{
                      cursor: 'pointer',
                      fontFamily: 'monospace',
                      fontSize: '0.75rem',
                      '&:hover': { bgcolor: 'primary.light', color: 'primary.contrastText' },
                    }}
                  />
                ))}
              </Box>

              {variables.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Divider sx={{ mb: 1.5 }} />
                  <Typography variant="caption" fontWeight={600} display="block" gutterBottom>
                    {t('messaging.templates.editor.variablesList')}
                  </Typography>
                  {variables.map((v) => (
                    <Box key={v.key} sx={{ mb: 0.5 }}>
                      <Typography variant="caption" component="span" fontFamily="monospace" color="primary">
                        {`{${v.key}}`}
                      </Typography>
                      <Typography variant="caption" component="span" color="text.secondary">
                        {' — '}{v.description}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </Paper>
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button
          variant="contained"
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Save />}
          onClick={handleSave}
          disabled={saving || !name.trim() || !subject.trim() || !body.trim()}
        >
          {saving ? t('common.processing') : t('common.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
