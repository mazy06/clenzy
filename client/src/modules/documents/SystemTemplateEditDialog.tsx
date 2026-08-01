import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AlertDescription, Button } from '../../components/ui';
import { TriangleAlert } from 'lucide-react';
import { Spinner } from '../../components/ui';
import { Card } from '../../components/ui';
import { Dialog, DialogActions, DialogContent, DialogTitle, Divider, MenuItem, Paper, TextField } from '@mui/material';
import { cn } from '../../utils/cn';
import { Save, Replay } from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import {
  useRemoveSystemEmailTemplateOverride,
  useSystemEmailTemplateDetail,
  useSystemEmailTemplateVariables,
  useUpsertSystemEmailTemplate,
} from '../../hooks/useSystemEmailTemplates';
import VariablePicker from './components/VariablePicker';

/**
 * Langues supportees pour les templates systeme (matching le seed migration 0155).
 */
const LANGUAGES = [
  { value: 'fr', label: 'Français' },
  { value: 'en', label: 'English' },
  { value: 'ar', label: 'العربية' },
];

/**
 * Variables systeme HTML-safe (pre-rendues cote serveur, non insertables).
 * Aligne sur HTML_SAFE_VARIABLES dans TemplateInterpolationService.java.
 */
const SYSTEM_VARIABLES = new Set([
  'detailsHtml',
  'urgencyBanner',
  'severityColor',
  'severityLabel',
]);

interface Props {
  templateKey: string;
  open: boolean;
  onClose: () => void;
}

/**
 * Dialog d'edition d'un template email systeme (alertes bruit, invitations,
 * notifications landing). Layout VOLONTAIREMENT IDENTIQUE a
 * {@link MessageTemplateEditor} pour coherence visuelle dans la tab
 * "Templates messages" qui mixte les 2 types.
 *
 * <h3>Differences vs MessageTemplateEditor (mode user)</h3>
 * <ul>
 *   <li>Champs Nom + Type sont readonly (immuables — slug systeme Baitly)</li>
 *   <li>Selecteur Langue limite a fr/en/ar (3 langues seed). Au change, hydrate
 *       les fields subject/body avec le contenu de cette langue.</li>
 *   <li>Save = upsertOverride (cree un fork per-org au lieu d'un nouveau template)</li>
 *   <li>Bouton "Restaurer le defaut systeme" en plus si override deja en place</li>
 * </ul>
 *
 * <h3>Plain text only</h3>
 * Le body est edite en plain text (markdown leger : *gras* _italique_). Le
 * wrapper HTML uniforme (header Baitly + footer) est applique cote serveur via
 * {@code EmailWrapperService} avant l'envoi.
 */
const SystemTemplateEditDialog: React.FC<Props> = ({ templateKey, open, onClose }) => {
  const { t, currentLanguage } = useTranslation();
  const { data: group, isLoading, error } = useSystemEmailTemplateDetail(templateKey, open);
  const { data: availableVariables = [] } = useSystemEmailTemplateVariables();
  const upsertMutation = useUpsertSystemEmailTemplate();
  const removeMutation = useRemoveSystemEmailTemplateOverride();

  // Langue active du PMS comme valeur initiale (au lieu de 'fr' hard-codé).
  // Pour les emails systeme on est en codes courts (fr/en/ar) — pas besoin
  // de mapping comme WhatsApp (qui exige fr_FR/en_US/ar_AR pour Meta).
  const [language, setLanguage] = useState<string>(currentLanguage || 'fr');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [touched, setTouched] = useState(false);
  // Dernier champ focus (instance value, lue uniquement dans handleInsertVariable) :
  // ref plutot que state — pas de re-render a chaque focus.
  const activeFieldRef = useRef<'subject' | 'body'>('body');
  // Refs vers les <input>/<textarea> sous-jacents pour insérer une variable
  // à la position du curseur (et non en fin de champ).
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const currentTemplate = group?.languages[language];
  const isOverride = currentTemplate && !currentTemplate.isSystem;

  // Sync les fields quand on change de langue ou de template
  useEffect(() => {
    if (currentTemplate) {
      setSubject(currentTemplate.subject);
      setBody(currentTemplate.body);
      setTouched(false);
    }
  }, [currentTemplate?.id, currentTemplate?.subject, currentTemplate?.body]); // eslint-disable-line react-hooks/exhaustive-deps

  // A chaque (re)ouverture, repositionne sur la langue active du PMS.
  useEffect(() => {
    if (open) setLanguage(currentLanguage || 'fr');
  }, [open, currentLanguage]);

  // Variables utilisees (toutes) — pour highlight dans le picker
  const usedVariables = useMemo(() => {
    const all = subject + ' ' + body;
    const matches = all.match(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g);
    if (!matches) return new Set<string>();
    return new Set(matches.map((m) => m.slice(1, -1)));
  }, [subject, body]);

  // Variables systeme utilisees (subset de usedVariables — affichees en warning)
  const systemVarsUsed = useMemo(
    () => Array.from(usedVariables).filter((v) => SYSTEM_VARIABLES.has(v)),
    [usedVariables],
  );

  // Variables user (exclut les systeme pour eviter qu'on les insere par accident)
  const userVariables = useMemo(
    () => availableVariables.filter((v) => !SYSTEM_VARIABLES.has(v.key)),
    [availableVariables],
  );

  const handleInsertVariable = (key: string) => {
    const placeholder = `{${key}}`;
    const isSubject = activeFieldRef.current === 'subject';
    const el = isSubject ? subjectRef.current : bodyRef.current;
    const value = isSubject ? subject : body;
    const setValue = isSubject ? setSubject : setBody;

    if (!el) {
      // Fallback : pas de ref (champ jamais monté) → on append en fin.
      setValue(value + placeholder);
    } else {
      // Insère à la position du curseur (ou remplace la sélection courante).
      const start = el.selectionStart ?? value.length;
      const end = el.selectionEnd ?? value.length;
      const next = value.slice(0, start) + placeholder + value.slice(end);
      setValue(next);
      // Repositionne le curseur juste après la variable insérée, après le re-render.
      const caret = start + placeholder.length;
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(caret, caret);
      });
    }
    setTouched(true);
  };

  const handleSave = async () => {
    if (!group || !subject.trim() || !body.trim()) return;
    try {
      await upsertMutation.mutateAsync({
        key: templateKey,
        language,
        payload: { subject, body },
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

  // Preview : remplace les variables par des valeurs mock (pattern MessageTemplateEditor)
  const getPreviewText = (text: string): string => {
    let preview = text;
    for (const v of availableVariables) {
      preview = preview.replace(new RegExp(`\\{${v.key}\\}`, 'g'), v.example);
    }
    return preview;
  };

  const friendlyName = t(`systemEmailTemplates.keys.${templateKey}`);
  const recipientLabel = group
    ? t(`systemEmailTemplates.recipientShort.${group.recipientType}`)
    : '';

  const saving = upsertMutation.isPending || removeMutation.isPending;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth PaperProps={{ sx: { minHeight: '70vh' } }}>
      <DialogTitle>{t('messaging.templates.editor.editSystemTitle')}</DialogTitle>

      <DialogContent dividers>
        {isLoading && (
          <div className="flex justify-center p-6">
            <Spinner className="size-10" />
          </div>
        )}

        {error && (
          <Alert variant="destructive" className="mb-3">
            <TriangleAlert />
            <AlertDescription>{t('systemEmailTemplates.dialog.loadError')}</AlertDescription>
          </Alert>
        )}

        {upsertMutation.error && (
          <Alert variant="destructive" className="mb-3">
            <TriangleAlert />
            <AlertDescription>{t('systemEmailTemplates.dialog.saveError')}{upsertMutation.error.message}</AlertDescription>
          </Alert>
        )}
        {removeMutation.error && (
          <Alert variant="destructive" className="mb-3">
            <TriangleAlert />
            <AlertDescription>{t('systemEmailTemplates.dialog.resetError')}</AlertDescription>
          </Alert>
        )}

        {group && (
          <div className="grid grid-cols-12 gap-[18px]">
            {/* ── Formulaire (gauche, 7/12) ── */}
            <div className="col-span-12 min-[900px]:col-span-7">
              <div className="grid grid-cols-12 gap-3">
                {/* Nom du template (readonly — slug systeme immuable) */}
                <div className="col-span-12 min-[600px]:col-span-6">
                  <TextField
                    fullWidth
                    label={t('messaging.templates.editor.name')}
                    value={friendlyName}
                    size="small"
                    InputProps={{ readOnly: true }}
                    helperText={t('messaging.templates.editor.systemNameHelper')}
                  />
                </div>
                {/* Type / Destinataire (readonly) */}
                <div className="col-span-6 min-[600px]:col-span-3">
                  <TextField
                    fullWidth
                    label={t('messaging.templates.editor.recipient')}
                    value={recipientLabel}
                    size="small"
                    InputProps={{ readOnly: true }}
                  />
                </div>
                {/* Langue (select fr/en/ar) */}
                <div className="col-span-6 min-[600px]:col-span-3">
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
                            <span className="ms-1.5 w-[6px] h-[6px] rounded-[50%] bg-[var(--accent)] inline-block" />
                          )}
                        </MenuItem>
                      );
                    })}
                  </TextField>
                </div>
                {/* Subject */}
                <div className="col-span-12">
                  <TextField
                    fullWidth
                    label={t('messaging.templates.editor.subject')}
                    value={subject}
                    onChange={(e) => { setSubject(e.target.value); setTouched(true); }}
                    onFocus={() => { activeFieldRef.current = 'subject'; }}
                    inputRef={subjectRef}
                    size="small"
                    required
                    helperText={t('messaging.templates.editor.subjectHelper')}
                  />
                </div>
                {/* Body multiline */}
                <div className="col-span-12">
                  <TextField
                    fullWidth
                    label={t('messaging.templates.editor.body')}
                    value={body}
                    onChange={(e) => { setBody(e.target.value); setTouched(true); }}
                    onFocus={() => { activeFieldRef.current = 'body'; }}
                    inputRef={bodyRef}
                    multiline
                    rows={12}
                    required
                    helperText={t('systemEmailTemplates.dialog.bodyHelper')}
                    InputProps={{
                      sx: language === 'ar' ? { direction: 'rtl' } : undefined,
                    }}
                  />
                </div>
              </div>

              {/* ── Preview (apercu plain text avec variables remplacees) ── */}
              <div className="mt-4">
                <h6 className="cn-text-subtitle2 text-muted-foreground mb-[0.35em]">
                  {t('messaging.templates.editor.preview')}
                </h6>
                <Card className="gap-0 py-0 p-3 bg-[var(--surface-2)] border-[var(--line)]">
                  <h6 className="cn-text-subtitle2 mb-[0.35em]">
                    {t('messaging.templates.editor.previewSubject')}: {getPreviewText(subject) || '—'}
                  </h6>
                  <Divider sx={{ my: 1 }} />
                  <p
                    className={cn(
                      'cn-text-body2 whitespace-pre-wrap font-[inherit]',
                      language === 'ar' ? '[direction:rtl]' : '[direction:ltr]',
                    )}
                  >
                    {getPreviewText(body) || '—'}
                  </p>
                </Card>
                <span className="cn-text-caption text-muted-foreground opacity-60 block mt-0.5">
                  {t('systemEmailTemplates.dialog.previewNote')}
                </span>
              </div>
            </div>

            {/* ── Sidebar variables (droite, 5/12) ── */}
            <div className="col-span-12 min-[900px]:col-span-5">
              <Paper variant="outlined" sx={{ p: 2, position: 'sticky', top: 16 }}>
                <h6 className="cn-text-subtitle2 font-semibold mb-[0.35em]">
                  {t('messaging.templates.editor.variables')}
                </h6>
                <span className="cn-text-caption text-muted-foreground block mb-2">
                  {t('messaging.templates.editor.variablesDesc')}
                </span>
                <VariablePicker
                  variables={userVariables}
                  usedKeys={usedVariables}
                  onInsert={handleInsertVariable}
                  systemVariablesUsed={systemVarsUsed}
                  showDetails
                />
              </Paper>
            </div>
          </div>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 1.5 }}>
        {isOverride && (
          <Button
            variant="outline"
            className="text-[var(--warn)] border-[var(--warn)] hover:bg-[var(--warn-soft)]"
            onClick={handleResetToSystem}
            disabled={saving}
          >
            <Replay size={16} strokeWidth={1.75} />
            {t('systemEmailTemplates.dialog.resetToSystem')}
          </Button>
        )}
        <div className="flex-1" />
        <Button variant="ghost" onClick={onClose} disabled={saving}>
          {t('common.cancel')}
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving || !touched || !subject.trim() || !body.trim()}
        >
          {saving ? <Spinner className="size-4" /> : <Save />}
          {saving ? t('common.processing') : t('common.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SystemTemplateEditDialog;
