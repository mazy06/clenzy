import { useMemo, useState } from 'react';
import { cn } from '../../../../utils/cn';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Field,
  FieldLabel,
  Label,
  NativeSelect,
  NativeSelectOption,
  Textarea,
} from '../../../../components/ui';
import { AlertTriangle, ClipboardPaste } from 'lucide-react';
import type { Editor } from 'grapesjs';
import { importToHtml } from './import/registry';
import { IMPORTERS } from './import/registry';
import { loadHtmlIntoEditor } from './loadIntoEditor';

/**
 * Onglet « Coller » de l'Importer.
 *
 * L'utilisateur colle du code dans deux zones distinctes : le HTML (ou un export de builder /
 * Markdown) et, optionnellement, du CSS. À la validation :
 *   1. `importToHtml(html, forceId?)` (registry) normalise l'entrée vers `{ html, css, report }`
 *      (auto-détection du format, ou format imposé via le sélecteur) ;
 *   2. le CSS collé est concaténé au CSS issu de l'adaptateur (le format collé peut déjà en porter) ;
 *   3. `loadHtmlIntoEditor` injecte le tout (HTML RÉ-assaini + CSS assaini avant `setComponents` /
 *      `Css.addRules`) — le canevas actuel est remplacé ;
 *   4. `onDone()` ferme le panneau ; les éventuels avertissements du rapport sont affichés avant.
 *
 * ⚠️ NON VÉRIFIÉ AU NAVIGATEUR (login Keycloak requis) : le rendu réel du pipeline
 * importToHtml → setComponents/addRules est à valider manuellement dans le Studio.
 */
export interface ImportPasteProps {
  /** Éditeur GrapesJS cible (injection du contenu converti). */
  editor: Editor;
  /** Appelé après un import réussi (ferme le panneau). */
  onDone: () => void;
}

/** Valeur du sélecteur de format : `auto` = auto-détection, sinon `TemplateImporter.id` imposé. */
const AUTO = 'auto';

/** Classes des 2 zones de collage (litteral entier : Tailwind scanne le texte source). */
const CODE_FIELD_CLASS =
  'resize-y font-[ui-monospace,_SFMono-Regular,_Menlo,_Consolas,_monospace] text-sm leading-normal';

export default function ImportPaste({ editor, onDone }: ImportPasteProps) {
  const [html, setHtml] = useState('');
  const [css, setCss] = useState('');
  // `auto` (défaut) délègue la détection au registre ; un id force le format (`forceId`).
  const [format, setFormat] = useState<string>(AUTO);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  // Liste stable des formats sélectionnables (auto + tous les adaptateurs du registre).
  const formats = useMemo(() => IMPORTERS.map((i) => ({ id: i.id, label: i.label })), []);

  const runImport = () => {
    setError(null);
    setWarnings([]);
    if (!html.trim()) {
      setError('Collez du HTML (ou un export de builder / du Markdown) avant d’importer.');
      return;
    }
    // `importToHtml` ne jette jamais : au pire repli HTML assaini + warning dans le rapport.
    const result = importToHtml(html, format === AUTO ? undefined : format);
    // CSS = celui porté par le format collé, complété par le CSS saisi à part.
    const cssParts = [result.css ?? '', css].map((c) => c.trim()).filter(Boolean);
    loadHtmlIntoEditor(editor, { html: result.html, css: cssParts.join('\n\n') });

    if (result.report.warnings.length > 0) {
      // On a tout de même injecté : on signale les dégradations mais on n'interrompt pas.
      setWarnings(result.report.warnings);
      return;
    }
    onDone();
  };

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm leading-normal text-muted-foreground">
        Collez votre HTML ci-dessous (et, si besoin, le CSS séparément). Le contenu est converti puis
        assaini avant d’être chargé dans l’éditeur. Le canevas actuel sera remplacé.
      </p>

      {/* Sélecteur de format : auto-détection par défaut, ou format imposé (forceId). */}
      <div className="flex items-center gap-1.5">
        <Label htmlFor="paste-format" className="text-sm text-muted-foreground">
          Format
        </Label>
        <NativeSelect
          size="sm"
          id="paste-format"
          value={format}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormat(e.target.value)}
        >
          <NativeSelectOption value={AUTO}>Détection automatique</NativeSelectOption>
          {formats.map((f) => (
            <NativeSelectOption key={f.id} value={f.id}>
              {f.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      {/* Zone HTML (requise). */}
      <Field>
        <FieldLabel htmlFor="paste-html">HTML</FieldLabel>
        <Textarea
          id="paste-html"
          value={html}
          placeholder="<section>…</section>"
          spellCheck={false}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setHtml(e.target.value)}
          className={cn(CODE_FIELD_CLASS, 'min-h-[160px]')}
        />
      </Field>

      {/* Zone CSS (optionnelle). */}
      <Field>
        <FieldLabel htmlFor="paste-css">
          CSS <span className="font-normal text-faint">(optionnel)</span>
        </FieldLabel>
        <Textarea
          id="paste-css"
          value={css}
          placeholder=".hero { … }"
          spellCheck={false}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCss(e.target.value)}
          className={cn(CODE_FIELD_CLASS, 'min-h-[100px]')}
        />
      </Field>

      {error ? (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {warnings.length > 0 ? (
        <Alert variant="warning" role="status">
          <AlertTriangle />
          <AlertTitle>Contenu importé avec des avertissements</AlertTitle>
          <AlertDescription>
            <ul className="m-0 ps-3.5 leading-normal">
              {warnings.map((w, i) => (
                <li key={i}>
                  {w}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="flex justify-end gap-1.5">
        {/* Après un import avec avertissements, l'utilisateur confirme la fermeture (le contenu est déjà injecté). */}
        {warnings.length > 0 ? (
          <Button type="button" variant="outline" onClick={onDone}>
            Fermer
          </Button>
        ) : null}
        <Button type="button" onClick={runImport} disabled={!html.trim()}>
          <ClipboardPaste size={15} strokeWidth={2} />
          {warnings.length > 0 ? 'Réimporter' : 'Importer'}
        </Button>
      </div>
    </div>
  );
}
