import React, { useState, useEffect, useRef } from 'react';
import { Alert as BuiAlert, AlertDescription, AlertAction, Button as BuiButton } from '../../components/ui';
import { TriangleAlert, X } from 'lucide-react';
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
  NativeSelectOption,
  Separator,
} from '../../components/ui';
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
  // Default: body — c'est la zone la plus large/utilisee. Instance value lue
  // uniquement dans le handler : ref (pas de re-render a chaque focus).
  const activeFieldRef = useRef<'subject' | 'body'>('body');
  // Refs vers les <input>/<textarea> sous-jacents pour insérer une variable
  // à la position du curseur (et non en fin de champ).
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const handleInsertVariable = (key: string) => {
    const variable = `{${key}}`;
    const isSubject = activeFieldRef.current === 'subject';
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
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="sm:max-w-[1200px] min-h-[70vh] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing
              ? t('messaging.templates.editor.editTitle')
              : t('messaging.templates.editor.createTitle')}
          </DialogTitle>
        </DialogHeader>

        {/* Les filets haut/bas remplacent le `dividers` de la modale MUI. */}
        <div className="border-y border-solid border-[var(--line)] py-3">
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

        <div className="grid grid-cols-12 gap-[18px]">
          {/* Formulaire */}
          <div className="col-span-12 min-[900px]:col-span-7">
            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-12 min-[600px]:col-span-6">
                <Field>
                  <FieldLabel htmlFor="template-name">{t('messaging.templates.editor.name')}</FieldLabel>
                  <Input
                    id="template-name"
                    className="w-full"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </Field>
              </div>
              <div className="col-span-6 min-[600px]:col-span-3">
                <Field>
                  <FieldLabel htmlFor="template-type">{t('messaging.templates.editor.type')}</FieldLabel>
                  <NativeSelect
                    id="template-type"
                    className="w-full"
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                  >
                    {TEMPLATE_TYPES.map((templateType) => (
                      <NativeSelectOption key={templateType.value} value={templateType.value}>
                        {templateType.label}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
              </div>
              <div className="col-span-6 min-[600px]:col-span-3">
                <Field>
                  <FieldLabel htmlFor="template-language">{t('messaging.templates.editor.language')}</FieldLabel>
                  <NativeSelect
                    id="template-language"
                    className="w-full"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                  >
                    {LANGUAGES.map((l) => (
                      <NativeSelectOption key={l.value} value={l.value}>
                        {l.label}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
              </div>
              {/* Les refs visent l'element de saisie lui-meme : l'insertion de
                  variable se fait A LA POSITION DU CURSEUR, pas en fin de champ. */}
              <div className="col-span-12">
                <Field>
                  <FieldLabel htmlFor="tpl-subject">
                    {t('messaging.templates.editor.subject')}
                  </FieldLabel>
                  <Input
                    id="tpl-subject"
                    ref={subjectRef}
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    onFocus={() => { activeFieldRef.current = 'subject'; }}
                    required
                  />
                  <FieldDescription>{t('messaging.templates.editor.subjectHelper')}</FieldDescription>
                </Field>
              </div>
              <div className="col-span-12">
                <Field>
                  <FieldLabel htmlFor="tpl-body">
                    {t('messaging.templates.editor.body')}
                  </FieldLabel>
                  <Textarea
                    id="tpl-body"
                    ref={bodyRef}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    onFocus={() => { activeFieldRef.current = 'body'; }}
                    required
                    // `field-sizing: content` du kit neutralise `rows`.
                    className="min-h-[12lh]"
                  />
                  <FieldDescription>{t('messaging.templates.editor.bodyHelper')}</FieldDescription>
                </Field>
              </div>
            </div>

            {/* Preview */}
            <div className="mt-4">
              <h6 className="cn-text-subtitle2 text-muted-foreground mb-[0.35em]">
                {t('messaging.templates.editor.preview')}
              </h6>
              <Card className="gap-0 py-0 p-3 bg-[var(--hover)]">
                <h6 className="cn-text-subtitle2 mb-[0.35em]">
                  {t('messaging.templates.editor.previewSubject')}: {getPreviewText(subject) || '—'}
                </h6>
                <Separator className="my-1.5" />
                {body ? (
                  <div className="cn-text-body2 font-[inherit]">
                    {/* Rendu identique à l'email envoyé (gras, puces, paragraphes) */}
                    <EmailMarkdownPreview text={getPreviewText(body)} />
                  </div>
                ) : (
                  <p className="cn-text-body2">—</p>
                )}
              </Card>
            </div>
          </div>

          {/* Variables sidebar — refactor sur VariablePicker (chips colorees
              par categorie, palette Baitly). Composant partage avec
              SystemTemplateEditDialog pour coherence visuelle. */}
          <div className="col-span-12 min-[900px]:col-span-5">
            <div className="sticky top-4 p-3 rounded-xl border border-solid border-[var(--line)] bg-[var(--card)]">
              <h6 className="cn-text-subtitle2 font-semibold mb-[0.35em]">
                {t('messaging.templates.editor.variables')}
              </h6>
              <span className="cn-text-caption text-muted-foreground block mb-2">
                {t('messaging.templates.editor.variablesDesc')}
              </span>
              <VariablePicker
                variables={variables}
                usedKeys={usedVariables}
                onInsert={handleInsertVariable}
                showDetails
              />
            </div>
          </div>
        </div>
        </div>

        <DialogFooter>
          <BuiButton variant="ghost" onClick={onClose}>{t('common.cancel')}</BuiButton>
          <BuiButton
            onClick={handleSave}
            disabled={saving || !name.trim() || !subject.trim() || !body.trim()}
          >
            {saving ? <Spinner className="size-4" /> : <Save />}
            {saving ? t('common.processing') : t('common.save')}
          </BuiButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
