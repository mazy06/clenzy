import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AlertDescription, Button } from '../../components/ui';
import { TriangleAlert } from 'lucide-react';
import { Spinner } from '../../components/ui';
import { Card } from '../../components/ui';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldDescription,
  FieldLabel,
  Input,
  Textarea,
  NativeSelect,
  Separator,
} from '../../components/ui';
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
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className="max-w-[1200px] min-h-[70vh] max-h-[90vh] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle>{t('messaging.templates.editor.editSystemTitle')}</DialogTitle>
        </DialogHeader>

        {/* Les filets haut/bas remplacent le `dividers` de la modale MUI. */}
        <div className="border-y border-solid border-[var(--line)] py-3">
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
                  <Field>
                    <FieldLabel htmlFor="systpl-name">{t('messaging.templates.editor.name')}</FieldLabel>
                    <Input id="systpl-name" value={friendlyName} readOnly />
                    <FieldDescription>{t('messaging.templates.editor.systemNameHelper')}</FieldDescription>
                  </Field>
                </div>
                {/* Type / Destinataire (readonly) */}
                <div className="col-span-6 min-[600px]:col-span-3">
                  <Field>
                    <FieldLabel htmlFor="systpl-recipient">{t('messaging.templates.editor.recipient')}</FieldLabel>
                    <Input id="systpl-recipient" value={recipientLabel} readOnly />
                  </Field>
                </div>
                {/* Langue (select fr/en/ar) */}
                <div className="col-span-6 min-[600px]:col-span-3">
                  <Field>
                    <FieldLabel htmlFor="systpl-language">{t('messaging.templates.editor.language')}</FieldLabel>
                    <NativeSelect
                      id="systpl-language"
                      className="w-full"
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                    >
                      {LANGUAGES.map((lang) => {
                        const tpl = group.languages[lang.value];
                        const isCustom = tpl && !tpl.isSystem;
                        // Une <option> ne peut pas contenir d'element : la pastille
                        // « surcharge locale » devient une puce textuelle.
                        return (
                          <option key={lang.value} value={lang.value} disabled={!tpl}>
                            {lang.label}{isCustom ? ' •' : ''}
                          </option>
                        );
                      })}
                    </NativeSelect>
                  </Field>
                </div>
                {/* Les refs visent l'element de saisie lui-meme : l'insertion de
                    variable se fait A LA POSITION DU CURSEUR, pas en fin de champ. */}
                {/* Subject */}
                <div className="col-span-12">
                  <Field>
                    <FieldLabel htmlFor="sys-tpl-subject">
                      {t('messaging.templates.editor.subject')}
                    </FieldLabel>
                    <Input
                      id="sys-tpl-subject"
                      ref={subjectRef}
                      value={subject}
                      onChange={(e) => { setSubject(e.target.value); setTouched(true); }}
                      onFocus={() => { activeFieldRef.current = 'subject'; }}
                      required
                    />
                    <FieldDescription>{t('messaging.templates.editor.subjectHelper')}</FieldDescription>
                  </Field>
                </div>
                {/* Body multiline */}
                <div className="col-span-12">
                  <Field>
                    <FieldLabel htmlFor="sys-tpl-body">
                      {t('messaging.templates.editor.body')}
                    </FieldLabel>
                    <Textarea
                      id="sys-tpl-body"
                      ref={bodyRef}
                      value={body}
                      onChange={(e) => { setBody(e.target.value); setTouched(true); }}
                      onFocus={() => { activeFieldRef.current = 'body'; }}
                      required
                      // `field-sizing: content` du kit neutralise `rows`.
                      className={cn('min-h-[12lh]', language === 'ar' && '[direction:rtl]')}
                    />
                    <FieldDescription>{t('systemEmailTemplates.dialog.bodyHelper')}</FieldDescription>
                  </Field>
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
                  <Separator className="my-1.5" />
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
              <div className="sticky top-4 rounded-[11px] border border-solid border-[var(--line)] bg-[var(--card)] p-3">
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
              </div>
            </div>
          </div>
        )}
        </div>

        <DialogFooter>
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SystemTemplateEditDialog;
