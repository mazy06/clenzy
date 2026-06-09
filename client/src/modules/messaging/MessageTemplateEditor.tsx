import React, { useState, useEffect, useRef } from 'react';
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
  Paper,
  CircularProgress,
  Alert,
  Divider,
} from '@mui/material';
import { Save } from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import {
  guestMessagingApi,
  type MessageTemplate,
  type TemplateVariable,
} from '../../services/api/guestMessagingApi';
import VariablePicker from '../documents/components/VariablePicker';
import { EmailMarkdownPreview } from '../../utils/emailMarkdown';

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
  { value: 'PAYMENT_LINK', label: 'Lien de paiement' },
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

  // Champ actif (subject ou body) pour decider ou inserer la variable au click.
  // Default: body — c'est la zone la plus large/utilisee.
  const [activeField, setActiveField] = useState<'subject' | 'body'>('body');
  // Refs vers les <input>/<textarea> sous-jacents pour insérer une variable
  // à la position du curseur (et non en fin de champ).
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const handleInsertVariable = (key: string) => {
    const variable = `{${key}}`;
    const isSubject = activeField === 'subject';
    const el = isSubject ? subjectRef.current : bodyRef.current;
    const value = isSubject ? subject : body;
    const setValue = isSubject ? setSubject : setBody;

    if (!el) {
      setValue(value + variable);
    } else {
      const start = el.selectionStart ?? value.length;
      const end = el.selectionEnd ?? value.length;
      setValue(value.slice(0, start) + variable + value.slice(end));
      const caret = start + variable.length;
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(caret, caret);
      });
    }
  };

  // Variables actuellement utilisees dans subject + body (highlight dans le picker)
  const usedVariables = (() => {
    const all = subject + ' ' + body;
    const matches = all.match(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g);
    if (!matches) return new Set<string>();
    return new Set(matches.map((m) => m.slice(1, -1)));
  })();

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
                  onFocus={() => setActiveField('subject')}
                  inputRef={subjectRef}
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
                  onFocus={() => setActiveField('body')}
                  inputRef={bodyRef}
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
                {body ? (
                  <Typography variant="body2" component="div" sx={{ fontFamily: 'inherit' }}>
                    {/* Rendu identique à l'email envoyé (gras, puces, paragraphes) */}
                    <EmailMarkdownPreview text={getPreviewText(body)} />
                  </Typography>
                ) : (
                  <Typography variant="body2">—</Typography>
                )}
              </Paper>
            </Box>
          </Grid>

          {/* Variables sidebar — refactor sur VariablePicker (chips colorees
              par categorie, palette Baitly). Composant partage avec
              SystemTemplateEditDialog pour coherence visuelle. */}
          <Grid item xs={12} md={5}>
            <Paper variant="outlined" sx={{ p: 2, position: 'sticky', top: 16 }}>
              <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                {t('messaging.templates.editor.variables')}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5 }}>
                {t('messaging.templates.editor.variablesDesc')}
              </Typography>
              <VariablePicker
                variables={variables}
                usedKeys={usedVariables}
                onInsert={handleInsertVariable}
                showDetails
              />
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
