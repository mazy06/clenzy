import { useMemo, useState } from 'react';
import { cn } from '../../../../utils/cn';
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
const FIELD_CLASS = 'w-full font-[ui-monospace,_SFMono-Regular,_Menlo,_Consolas,_monospace] text-[var(--text-sm)] leading-[1.5] text-[var(--ink)] bg-[var(--field)] border border-solid border-[var(--line)] rounded-[var(--radius-md)] p-[7.5px] resize-y outline-none focus:border-[var(--accent)] disabled:opacity-60';

/**
 * Boutons maison de l'Importer (l'ancien `ButtonBase` + `sx`) : le kit n'a pas de
 * variante calee sur les tokens `--text-md` / `--fw-*` du Studio. `font-[number:…]`
 * car Tailwind v4 n'infere pas le type d'une graisse derriere `var(`.
 */
const IMPORT_BTN_BASE_CLASS =
  'inline-flex items-center px-[15px] h-10 rounded-[var(--radius-md)] text-[var(--text-md)] cursor-pointer ' +
  'focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-2';

const IMPORT_BTN_GHOST_CLASS =
  `${IMPORT_BTN_BASE_CLASS} text-[var(--ink)] border border-solid border-[var(--line)] bg-transparent ` +
  'font-[number:var(--fw-medium)] hover:bg-[var(--hover)]';

const IMPORT_BTN_SOLID_CLASS =
  `${IMPORT_BTN_BASE_CLASS} gap-[4.5px] border-none bg-[var(--accent)] text-[var(--on-accent)] ` +
  'font-[number:var(--fw-semibold)] hover:bg-[var(--accent-deep,var(--accent))] disabled:opacity-50';

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
      <div className="text-[var(--text-sm)] text-[var(--muted)] leading-[1.5]">
        Collez votre HTML ci-dessous (et, si besoin, le CSS séparément). Le contenu est converti puis
        assaini avant d’être chargé dans l’éditeur. Le canevas actuel sera remplacé.
      </div>

      {/* Sélecteur de format : auto-détection par défaut, ou format imposé (forceId). */}
      <div className="flex items-center gap-1.5">
        <label className="text-[var(--text-sm)] text-[var(--muted)]" htmlFor="paste-format">
          Format
        </label>
        <select className="h-[34px] px-1.5 text-[var(--text-sm)] text-[var(--ink)] bg-[var(--field)] border border-solid border-[var(--line)] rounded-[var(--radius-md)] cursor-pointer focus:border-[var(--accent)]" style={{ outline: 'none' }} id="paste-format" value={format} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormat(e.target.value)}>
          <option value={AUTO}>Détection automatique</option>
          {formats.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      {/* Zone HTML (requise). */}
      <div className="flex flex-col gap-0.5">
        <label className="text-[var(--text-sm)] font-[family-name:var(--fw-medium)] text-[var(--ink)]" htmlFor="paste-html">
          HTML
        </label>
        <textarea
          id="paste-html"
          value={html}
          placeholder="<section>…</section>"
          spellCheck={false}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setHtml(e.target.value)}
          className={cn(FIELD_CLASS, 'min-h-[160px]')}
        />
      </div>

      {/* Zone CSS (optionnelle). */}
      <div className="flex flex-col gap-0.5">
        <label className="text-[var(--text-sm)] font-[family-name:var(--fw-medium)] text-[var(--ink)]" htmlFor="paste-css">
          CSS <span className="text-[var(--faint)]" style={{ fontWeight: 'var(--fw-regular, 400)' }}>(optionnel)</span>
        </label>
        <textarea
          id="paste-css"
          value={css}
          placeholder=".hero { … }"
          spellCheck={false}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCss(e.target.value)}
          className={cn(FIELD_CLASS, 'min-h-[100px]')}
        />
      </div>

      {error ? (
        <div className="text-[var(--text-sm)] text-[var(--err,_#c0392b)]" role="alert">
          {error}
        </div>
      ) : null}

      {warnings.length > 0 ? (
        <div className="flex flex-col gap-0.5 p-2 bg-[var(--hover)] border border-[var(--line)] rounded-[var(--radius-md)]" role="status">
          <div className="inline-flex items-center gap-1 text-[var(--text-sm)] font-[family-name:var(--fw-semibold)] text-[var(--ink)]">
            <AlertTriangle size={15} strokeWidth={2} style={{ color: 'var(--err, #c0392b)' }} />
            Contenu importé avec des avertissements
          </div>
          <ul className="m-0 ps-3.5 text-[var(--text-sm)] text-[var(--muted)] leading-[1.5]">
            {warnings.map((w, i) => (
              <li key={i}>
                {w}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex justify-end gap-1.5">
        {/* Après un import avec avertissements, l'utilisateur confirme la fermeture (le contenu est déjà injecté). */}
        {warnings.length > 0 ? (
          <button type="button" onClick={onDone} className={IMPORT_BTN_GHOST_CLASS}>
            Fermer
          </button>
        ) : null}
        <button
          type="button"
          onClick={runImport}
          disabled={!html.trim()}
          className={IMPORT_BTN_SOLID_CLASS}
        >
          <ClipboardPaste size={15} strokeWidth={2} />
          {warnings.length > 0 ? 'Réimporter' : 'Importer'}
        </button>
      </div>
    </div>
  );
}
