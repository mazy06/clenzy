import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  AlertDescription,
  Button,
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  Input,
  Textarea,
  NativeSelect,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui';
import { TriangleAlert } from 'lucide-react';
import { Spinner } from '../../components/ui';
import { cn } from '../../utils/cn';
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
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="sm:max-w-[1200px] min-h-[70vh] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('messaging.templates.editor.editWhatsappTitle')}</DialogTitle>
        </DialogHeader>

        {/* Les filets haut/bas remplacent le `dividers` de la modale MUI. */}
        <div className="border-y border-solid border-border py-3">
        {isLoading && (
          <div className="flex justify-center p-6">
            <Spinner className="size-10" />
          </div>
        )}

        {error && (
          <Alert variant="destructive" className="mb-3">
            <TriangleAlert />
            <AlertDescription>{t('whatsappTemplates.dialog.loadError')}</AlertDescription>
          </Alert>
        )}

        {upsertMutation.error && (
          <Alert variant="destructive" className="mb-3">
            <TriangleAlert />
            <AlertDescription>{t('whatsappTemplates.dialog.saveError')}{upsertMutation.error.message}</AlertDescription>
          </Alert>
        )}
        {removeMutation.error && (
          <Alert variant="destructive" className="mb-3">
            <TriangleAlert />
            <AlertDescription>{t('whatsappTemplates.dialog.resetError')}</AlertDescription>
          </Alert>
        )}

        {group && (
          <div className="grid grid-cols-12 gap-[18px]">
            {/* ── Formulaire (gauche 7/12) ── */}
            <div className="col-span-12 min-[900px]:col-span-7">
              <div className="grid grid-cols-12 gap-3">
                {/* Nom du template (readonly — slug systeme immuable) */}
                <div className="col-span-12 min-[600px]:col-span-6">
                  <Field>
                    <FieldLabel htmlFor="wa-template-name">
                      {t('messaging.templates.editor.name')}
                    </FieldLabel>
                    <Input id="wa-template-name" value={friendlyName} readOnly />
                    <FieldDescription>
                      {t('messaging.templates.editor.systemNameHelper')}
                    </FieldDescription>
                  </Field>
                </div>
                {/* Categorie Meta (readonly) */}
                <div className="col-span-6 min-[600px]:col-span-3">
                  <Field>
                    <FieldLabel htmlFor="wa-template-category">
                      {t('messaging.templates.editor.metaCategory')}
                    </FieldLabel>
                    <Input id="wa-template-category" value={group.category} readOnly />
                  </Field>
                </div>
                {/* Selecteur Langue */}
                <div className="col-span-6 min-[600px]:col-span-3">
                  <Field>
                    <FieldLabel htmlFor="wa-template-language">
                      {t('messaging.templates.editor.language')}
                    </FieldLabel>
                    {/* Une <option> native ne peut contenir que du texte : la pastille
                        « traduction personnalisee » devient un suffixe textuel. */}
                    <NativeSelect
                      id="wa-template-language"
                      className="w-full"
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                    >
                      {LANGUAGES.map((lang) => {
                        const tpl = group.languages[lang.value];
                        const isCustom = tpl && !tpl.isSystem;
                        return (
                          <option key={lang.value} value={lang.value} disabled={!tpl}>
                            {isCustom ? `${lang.label} •` : lang.label}
                          </option>
                        );
                      })}
                    </NativeSelect>
                  </Field>
                </div>
                {/* Body multiline (pas de subject pour WhatsApp). La ref porte
                    l'insertion de variable A LA POSITION DU CURSEUR : elle vise
                    donc le <textarea> lui-meme, pas son enveloppe. */}
                <div className="col-span-12">
                  <Field data-invalid={isOverLimit || undefined}>
                    <FieldLabel htmlFor="wa-template-body">
                      {t('messaging.templates.editor.body')}
                    </FieldLabel>
                    <Textarea
                      id="wa-template-body"
                      ref={bodyRef}
                      value={body}
                      onChange={(e) => { setBody(e.target.value); setTouched(true); }}
                      required
                      aria-invalid={isOverLimit || undefined}
                      // `field-sizing: content` du kit neutralise `rows` : la
                      // hauteur se pose en lignes (`lh`).
                      className={cn('min-h-[12lh]', language === 'ar_AR' && '[direction:rtl]')}
                    />
                    {isOverLimit ? (
                      <FieldError>
                        {t('whatsappTemplates.dialog.tooLong', { count: charCount })}
                      </FieldError>
                    ) : (
                      <FieldDescription>
                        {t('whatsappTemplates.dialog.charCount', { count: charCount })}
                      </FieldDescription>
                    )}
                  </Field>
                </div>
              </div>

              {/* ── Preview : SEULE difference visuelle vs SystemTemplate — bulle WhatsApp ── */}
              <div className="mt-4">
                <h6 className="text-xs font-medium text-muted-foreground mb-[0.35em]">
                  {t('whatsappTemplates.dialog.preview')}
                </h6>
                <WhatsAppBubblePreview body={body} rtl={language === 'ar_AR'} />
              </div>
            </div>

            {/* ── Sidebar variables (droite 5/12) ── */}
            <div className="col-span-12 min-[900px]:col-span-5">
              <div className="sticky top-4 p-3 rounded-xl border border-solid border-border bg-card">
                <h6 className="text-xs font-semibold mb-[0.35em]">
                  {t('messaging.templates.editor.variables')}
                </h6>
                <span className="text-xs text-muted-foreground block mb-2">
                  {t('messaging.templates.editor.variablesDesc')}
                </span>
                <VariablePicker
                  variables={availableVariables}
                  usedKeys={usedVariables}
                  onInsert={handleInsertVariable}
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
              className="text-warning-ink border-warning hover:bg-warning-soft"
              onClick={handleResetToSystem}
              disabled={saving}
            >
              <Replay size={16} strokeWidth={1.75} />
              {t('whatsappTemplates.dialog.resetToSystem')}
            </Button>
          )}
          {/* Cale-espace : masque en colonne (mobile), ou `flex-1` grandirait en
              hauteur au lieu de repousser les actions. */}
          <div className="hidden sm:block flex-1" />
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !touched || !body.trim() || isOverLimit}
          >
            {saving ? <Spinner className="size-4" /> : <Save />}
            {saving ? t('common.processing') : t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
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
    // Le callback de theme du sx ne faisait qu'un aiguillage clair/sombre : la
    // variante `dark:` du kit lit le meme signal ([data-theme="dark"]).
    // Le motif pointille reste en style : la syntaxe arbitraire de Tailwind
    // n'accepte pas les espaces d'un `radial-gradient()`.
    <div
      className="bg-[#e5ddd5] dark:bg-[#0b141a] p-3 rounded-lg min-h-[80px]"
      style={{
        backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.04) 1px, transparent 1px)',
        backgroundSize: '10px 10px',
      }}
    >
      {/* px 1.5 = 9px, py 1 = 6px (spacing 6) ; borderRadius 2 = 16px (shape 8),
          alors que borderTop*Radius n'est PAS un prop systeme MUI : 8/2 = px bruts.
          fontFamily reste en style : `font-[...]` est ambigu (famille vs graisse). */}
      <div
        style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
        className={cn(
          'bg-[#dcf8c6] text-[#111] max-w-[85%] px-[9px] py-1.5 rounded-[16px]',
          'shadow-[0_1px_2px_rgba(0,0,0,0.1)] whitespace-pre-wrap break-words text-[0.875rem] leading-[1.45]',
          rtl
            ? 'ml-0 mr-auto rounded-tr-[8px] rounded-tl-[2px] [direction:rtl]'
            : 'ml-auto mr-0 rounded-tr-[2px] rounded-tl-[8px] [direction:ltr]',
        )}
      >
        {renderedNodes}
      </div>
    </div>
  );
};

function renderWhatsAppBody(body: string): React.ReactNode {
  if (!body) return null;

  // Split par variables d'abord — variables rendues en monospace distinct.
  const partsWithVars = body.split(/(\{[a-zA-Z][a-zA-Z0-9_]*\})/);
  return partsWithVars.map((part, idx) => {
    if (/^\{[a-zA-Z][a-zA-Z0-9_]*\}$/.test(part)) {
      return (
        <span className="font-mono text-[0.85em] bg-[rgba(37,211,102,0.18)] text-[#075E54] px-0.5 rounded-[4px]" key={idx}>
          {part}
        </span>
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
