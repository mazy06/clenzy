import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  MenuItem,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import { Save, Replay } from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import {
  useRemoveWhatsAppTemplateOverride,
  useUpsertWhatsAppTemplate,
  useWhatsAppTemplateDetail,
  useWhatsAppTemplateVariables,
} from '../../hooks/useWhatsAppTemplates';
import type { WhatsAppTemplateContent } from '../../services/api/whatsappTemplatesApi';
import VariablePicker from './components/VariablePicker';

/**
 * Locales Meta exact format (cf. seed migration 0154). Differentes des locales
 * email systeme (fr/en/ar) car Meta exige le format ISO 639-1 + region.
 */
const LANGUAGES = [
  { value: 'fr_FR', label: 'Français' },
  { value: 'en_US', label: 'English' },
  { value: 'ar_AR', label: 'العربية' },
];

interface Props {
  templateKey: string;
  open: boolean;
  onClose: () => void;
}

/**
 * Dialog d'edition d'un template WhatsApp — layout VOLONTAIREMENT IDENTIQUE a
 * {@link MessageTemplateEditor} et {@link SystemTemplateEditDialog} pour
 * coherence visuelle dans la suite "Documents & Communications".
 *
 * <h3>Differences specifiques WhatsApp</h3>
 * <ul>
 *   <li>Pas de champ "Sujet" (WhatsApp n'a pas d'objet, juste un body)</li>
 *   <li>Categorie Meta (UTILITY/MARKETING/AUTHENTICATION) en readonly au lieu de "Destinataire"</li>
 *   <li>Langue : selecteur fr_FR/en_US/ar_AR (locales Meta natives)</li>
 *   <li>Limite body : 1024 caracteres (impose par WhatsApp Cloud API)</li>
 *   <li>Preview : bulle WhatsApp verte au lieu de Paper email plain
 *       (composant {@link WhatsAppBubblePreview}). C'est la SEULE difference
 *       visuelle volontaire, car elle apporte de la valeur metier (l'user
 *       voit exactement ce que recevra le voyageur sur son tel).</li>
 * </ul>
 *
 * <h3>Mode "override per-org"</h3>
 * Quand l'user edite un template systeme, le service backend cree un fork
 * pour son org au save. Le bouton "Restaurer le defaut systeme" supprime
 * l'override → retour au template Baitly.
 */
/**
 * Resoud la locale Meta par defaut a l'ouverture du dialog selon la langue
 * active du PMS (fr → fr_FR, en → en_US, ar → ar_AR). Fallback fr_FR sinon.
 */
function defaultLanguageFor(pmsLang: string): string {
  switch (pmsLang) {
    case 'en': return 'en_US';
    case 'ar': return 'ar_AR';
    default: return 'fr_FR';
  }
}

const WhatsAppTemplateEditorDialog: React.FC<Props> = ({ templateKey, open, onClose }) => {
  const { t, currentLanguage } = useTranslation();
  const { data: group, isLoading, error } = useWhatsAppTemplateDetail(templateKey, open);
  const { data: availableVariables = [] } = useWhatsAppTemplateVariables();
  const upsertMutation = useUpsertWhatsAppTemplate();
  const removeMutation = useRemoveWhatsAppTemplateOverride();

  // Initialise sur la langue PMS active — sinon l'utilisateur en interface FR
  // ouvre le dialog par defaut en arabe si fr_FR n'est pas la 1ere cle d'objet
  // (cf. bug fix sur la table). Reset au prochain open() avec la langue courante.
  const [language, setLanguage] = useState(() => defaultLanguageFor(currentLanguage));
  const [body, setBody] = useState('');
  const [touched, setTouched] = useState(false);
  // Ref vers le <textarea> sous-jacent pour insérer une variable à la position
  // du curseur (et non en fin de champ).
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const currentTemplate: WhatsAppTemplateContent | undefined = group?.languages[language];
  const isOverride = currentTemplate && !currentTemplate.isSystem;

  // Sync body quand on change de langue ou de template
  useEffect(() => {
    if (currentTemplate) {
      setBody(currentTemplate.bodyNamed);
      setTouched(false);
    }
  }, [currentTemplate?.id, currentTemplate?.bodyNamed]); // eslint-disable-line react-hooks/exhaustive-deps

  // A chaque (re)ouverture, repositionne sur la langue du PMS.
  useEffect(() => {
    if (open) setLanguage(defaultLanguageFor(currentLanguage));
  }, [open, currentLanguage]);

  // Variables utilisees pour highlight (subset de availableVariables)
  const usedVariables = useMemo(() => {
    if (!body) return new Set<string>();
    const matches = body.match(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g);
    if (!matches) return new Set<string>();
    return new Set(matches.map((m) => m.slice(1, -1)));
  }, [body]);

  const handleInsertVariable = (key: string) => {
    const variable = `{${key}}`;
    const el = bodyRef.current;
    if (!el) {
      setBody((prev) => prev + variable);
    } else {
      const start = el.selectionStart ?? body.length;
      const end = el.selectionEnd ?? body.length;
      setBody(body.slice(0, start) + variable + body.slice(end));
      const caret = start + variable.length;
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(caret, caret);
      });
    }
    setTouched(true);
  };

  const handleSave = async () => {
    if (!group || !body.trim()) return;
    try {
      await upsertMutation.mutateAsync({
        key: templateKey,
        language,
        payload: { bodyNamed: body },
      });
      setTouched(false);
    } catch { /* exposed via mutation */ }
  };

  const handleResetToSystem = async () => {
    if (!group || !currentTemplate || currentTemplate.isSystem) return;
    try {
      await removeMutation.mutateAsync({ key: templateKey, language });
    } catch { /* idem */ }
  };

  const friendlyName = t(`whatsappTemplates.keys.${templateKey}`);
  const charCount = body.length;
  const isOverLimit = charCount > 1024;
  const saving = upsertMutation.isPending || removeMutation.isPending;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth PaperProps={{ sx: { minHeight: '70vh' } }}>
      <DialogTitle>{t('messaging.templates.editor.editWhatsappTitle')}</DialogTitle>

      <DialogContent dividers>
        {isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {t('whatsappTemplates.dialog.loadError')}
          </Alert>
        )}

        {upsertMutation.error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {t('whatsappTemplates.dialog.saveError')} {upsertMutation.error.message}
          </Alert>
        )}
        {removeMutation.error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {t('whatsappTemplates.dialog.resetError')}
          </Alert>
        )}

        {group && (
          <Grid container spacing={3}>
            {/* ── Formulaire (gauche 7/12) ── */}
            <Grid item xs={12} md={7}>
              <Grid container spacing={2}>
                {/* Nom du template (readonly — slug systeme immuable) */}
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label={t('messaging.templates.editor.name')}
                    value={friendlyName}
                    size="small"
                    InputProps={{ readOnly: true }}
                    helperText={t('messaging.templates.editor.systemNameHelper')}
                  />
                </Grid>
                {/* Categorie Meta (readonly) */}
                <Grid item xs={6} sm={3}>
                  <TextField
                    fullWidth
                    label={t('messaging.templates.editor.metaCategory')}
                    value={group.category}
                    size="small"
                    InputProps={{ readOnly: true }}
                  />
                </Grid>
                {/* Selecteur Langue */}
                <Grid item xs={6} sm={3}>
                  <TextField
                    fullWidth
                    select
                    label={t('messaging.templates.editor.language')}
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    size="small"
                  >
                    {LANGUAGES.map((lang) => {
                      const tpl = group.languages[lang.value];
                      const isCustom = tpl && !tpl.isSystem;
                      return (
                        <MenuItem key={lang.value} value={lang.value} disabled={!tpl}>
                          {lang.label}
                          {isCustom && (
                            <Box
                              component="span"
                              sx={{
                                ml: 1,
                                width: 6,
                                height: 6,
                                borderRadius: '50%',
                                bgcolor: 'primary.main',
                                display: 'inline-block',
                              }}
                            />
                          )}
                        </MenuItem>
                      );
                    })}
                  </TextField>
                </Grid>
                {/* Body multiline (pas de subject pour WhatsApp) */}
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label={t('messaging.templates.editor.body')}
                    value={body}
                    onChange={(e) => { setBody(e.target.value); setTouched(true); }}
                    inputRef={bodyRef}
                    multiline
                    rows={12}
                    required
                    error={isOverLimit}
                    helperText={
                      isOverLimit
                        ? t('whatsappTemplates.dialog.tooLong', { count: charCount })
                        : t('whatsappTemplates.dialog.charCount', { count: charCount })
                    }
                    InputProps={{
                      sx: language === 'ar_AR' ? { direction: 'rtl' } : undefined,
                    }}
                  />
                </Grid>
              </Grid>

              {/* ── Preview : SEULE difference visuelle vs SystemTemplate — bulle WhatsApp ── */}
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  {t('whatsappTemplates.dialog.preview')}
                </Typography>
                <WhatsAppBubblePreview body={body} rtl={language === 'ar_AR'} />
              </Box>
            </Grid>

            {/* ── Sidebar variables (droite 5/12) ── */}
            <Grid item xs={12} md={5}>
              <Paper variant="outlined" sx={{ p: 2, position: 'sticky', top: 16 }}>
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                  {t('messaging.templates.editor.variables')}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5 }}>
                  {t('messaging.templates.editor.variablesDesc')}
                </Typography>
                <VariablePicker
                  variables={availableVariables}
                  usedKeys={usedVariables}
                  onInsert={handleInsertVariable}
                  showDetails
                />
              </Paper>
            </Grid>
          </Grid>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 1.5 }}>
        {isOverride && (
          <Button
            startIcon={<Replay size={16} strokeWidth={1.75} />}
            onClick={handleResetToSystem}
            disabled={saving}
            color="warning"
          >
            {t('whatsappTemplates.dialog.resetToSystem')}
          </Button>
        )}
        <Box sx={{ flex: 1 }} />
        <Button onClick={onClose} disabled={saving}>
          {t('common.cancel')}
        </Button>
        <Button
          variant="contained"
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Save />}
          onClick={handleSave}
          disabled={saving || !touched || !body.trim() || isOverLimit}
        >
          {saving ? t('common.processing') : t('common.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ─── Preview bulle WhatsApp ─────────────────────────────────────────────────

/**
 * Rendu visuel approximatif d'une bulle WhatsApp recue par le voyageur.
 * <p>Markdown WhatsApp basique : *gras*, _italique_, ~barre~. Les variables
 * {nameVar} apparaissent en monospace pour les distinguer du texte normal.</p>
 *
 * <p><b>Securite</b> : on parse les tokens et on rend chaque morceau en
 * composant React natif (jamais de dangerouslySetInnerHTML). Meme si l'user
 * colle du HTML, il est rendu en texte litteral par React.</p>
 */
const WhatsAppBubblePreview: React.FC<{ body: string; rtl: boolean }> = ({ body, rtl }) => {
  const renderedNodes = useMemo(() => renderWhatsAppBody(body), [body]);

  return (
    <Box
      sx={{
        bgcolor: (theme) => theme.palette.mode === 'dark' ? '#0b141a' : '#e5ddd5',
        backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.04) 1px, transparent 1px)',
        backgroundSize: '10px 10px',
        p: 2,
        borderRadius: 1,
        minHeight: 80,
      }}
    >
      <Box
        sx={{
          bgcolor: '#dcf8c6',
          color: '#111',
          maxWidth: '85%',
          ml: rtl ? 0 : 'auto',
          mr: rtl ? 'auto' : 0,
          px: 1.5,
          py: 1,
          borderRadius: 2,
          borderTopRightRadius: rtl ? 8 : 2,
          borderTopLeftRadius: rtl ? 2 : 8,
          boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          fontSize: '0.875rem',
          lineHeight: 1.45,
          direction: rtl ? 'rtl' : 'ltr',
        }}
      >
        {renderedNodes}
      </Box>
    </Box>
  );
};

function renderWhatsAppBody(body: string): React.ReactNode {
  if (!body) return null;

  // Split par variables d'abord — variables rendues en monospace distinct.
  const partsWithVars = body.split(/(\{[a-zA-Z][a-zA-Z0-9_]*\})/);
  return partsWithVars.map((part, idx) => {
    if (/^\{[a-zA-Z][a-zA-Z0-9_]*\}$/.test(part)) {
      return (
        <Box
          key={idx}
          component="span"
          sx={{
            fontFamily: 'monospace',
            fontSize: '0.85em',
            bgcolor: 'rgba(37,211,102,0.18)',
            color: '#075E54',
            px: 0.5,
            borderRadius: 0.5,
          }}
        >
          {part}
        </Box>
      );
    }
    return <React.Fragment key={idx}>{renderMarkdownTokens(part)}</React.Fragment>;
  });
}

/**
 * Tokenize et rend le markdown WhatsApp basique (*gras*, _italique_, ~barre~)
 * en composants React safe (pas de HTML brut).
 */
function renderMarkdownTokens(text: string): React.ReactNode {
  if (!text) return null;
  const tokenRegex = /(\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~)/g;
  const parts = text.split(tokenRegex);

  return parts.map((part, idx) => {
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return <strong key={idx}>{part.slice(1, -1)}</strong>;
    }
    if (part.startsWith('_') && part.endsWith('_') && part.length > 2) {
      return <em key={idx}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith('~') && part.endsWith('~') && part.length > 2) {
      return <s key={idx}>{part.slice(1, -1)}</s>;
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

export default WhatsAppTemplateEditorDialog;
