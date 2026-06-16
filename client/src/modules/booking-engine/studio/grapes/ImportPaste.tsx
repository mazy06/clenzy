import { useMemo, useState } from 'react';
import { Box, ButtonBase } from '@mui/material';
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

const fieldSx = {
  width: '100%',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  fontSize: 'var(--text-sm)',
  lineHeight: 1.5,
  color: 'var(--ink)',
  bgcolor: 'var(--field)',
  border: '1px solid var(--line)',
  borderRadius: 'var(--radius-md)',
  p: 1.25,
  resize: 'vertical' as const,
  outline: 'none',
  '&:focus': { borderColor: 'var(--accent)' },
  '&:disabled': { opacity: 0.6 },
} as const;

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
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box sx={{ fontSize: 'var(--text-sm)', color: 'var(--muted)', lineHeight: 1.5 }}>
        Collez votre HTML ci-dessous (et, si besoin, le CSS séparément). Le contenu est converti puis
        assaini avant d’être chargé dans l’éditeur. Le canevas actuel sera remplacé.
      </Box>

      {/* Sélecteur de format : auto-détection par défaut, ou format imposé (forceId). */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box component="label" htmlFor="paste-format" sx={{ fontSize: 'var(--text-sm)', color: 'var(--muted)' }}>
          Format
        </Box>
        <Box
          component="select"
          id="paste-format"
          value={format}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormat(e.target.value)}
          sx={{
            height: 34, px: 1, fontSize: 'var(--text-sm)', color: 'var(--ink)', bgcolor: 'var(--field)',
            border: '1px solid var(--line)', borderRadius: 'var(--radius-md)', outline: 'none', cursor: 'pointer',
            '&:focus': { borderColor: 'var(--accent)' },
          }}
        >
          <option value={AUTO}>Détection automatique</option>
          {formats.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </Box>
      </Box>

      {/* Zone HTML (requise). */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <Box component="label" htmlFor="paste-html" sx={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-medium)', color: 'var(--ink)' }}>
          HTML
        </Box>
        <Box
          component="textarea"
          id="paste-html"
          value={html}
          placeholder="<section>…</section>"
          spellCheck={false}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setHtml(e.target.value)}
          sx={{ ...fieldSx, minHeight: 160 }}
        />
      </Box>

      {/* Zone CSS (optionnelle). */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <Box component="label" htmlFor="paste-css" sx={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-medium)', color: 'var(--ink)' }}>
          CSS <Box component="span" sx={{ color: 'var(--faint)', fontWeight: 'var(--fw-regular, 400)' }}>(optionnel)</Box>
        </Box>
        <Box
          component="textarea"
          id="paste-css"
          value={css}
          placeholder=".hero { … }"
          spellCheck={false}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCss(e.target.value)}
          sx={{ ...fieldSx, minHeight: 100 }}
        />
      </Box>

      {error ? (
        <Box sx={{ fontSize: 'var(--text-sm)', color: 'var(--err, #c0392b)' }} role="alert">
          {error}
        </Box>
      ) : null}

      {warnings.length > 0 ? (
        <Box
          role="status"
          sx={{
            display: 'flex', flexDirection: 'column', gap: 0.5, p: 1.25,
            bgcolor: 'var(--hover)', border: '1px solid var(--line)', borderRadius: 'var(--radius-md)',
          }}
        >
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-semibold)', color: 'var(--ink)' }}>
            <AlertTriangle size={15} strokeWidth={2} style={{ color: 'var(--err, #c0392b)' }} />
            Contenu importé avec des avertissements
          </Box>
          <Box component="ul" sx={{ m: 0, pl: 2.5, fontSize: 'var(--text-sm)', color: 'var(--muted)', lineHeight: 1.5 }}>
            {warnings.map((w, i) => (
              <Box component="li" key={i}>
                {w}
              </Box>
            ))}
          </Box>
        </Box>
      ) : null}

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
        {/* Après un import avec avertissements, l'utilisateur confirme la fermeture (le contenu est déjà injecté). */}
        {warnings.length > 0 ? (
          <ButtonBase
            onClick={onDone}
            sx={{
              display: 'inline-flex', alignItems: 'center', px: 2.5, height: 40, borderRadius: 'var(--radius-md)',
              color: 'var(--ink)', border: '1px solid var(--line)', fontWeight: 'var(--fw-medium)',
              fontSize: 'var(--text-md)', cursor: 'pointer', '&:hover': { bgcolor: 'var(--hover)' },
              '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: 2 },
            }}
          >
            Fermer
          </ButtonBase>
        ) : null}
        <ButtonBase
          onClick={runImport}
          disabled={!html.trim()}
          sx={{
            display: 'inline-flex', alignItems: 'center', gap: 0.75, px: 2.5, height: 40,
            borderRadius: 'var(--radius-md)', bgcolor: 'var(--accent)', color: 'var(--on-accent)',
            fontWeight: 'var(--fw-semibold)', fontSize: 'var(--text-md)', cursor: 'pointer',
            '&.Mui-disabled': { opacity: 0.5 }, '&:hover': { bgcolor: 'var(--accent-deep, var(--accent))' },
            '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: 2 },
          }}
        >
          <ClipboardPaste size={15} strokeWidth={2} />
          {warnings.length > 0 ? 'Réimporter' : 'Importer'}
        </ButtonBase>
      </Box>
    </Box>
  );
}
