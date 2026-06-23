import { useRef, useState, type DragEvent, type ChangeEvent } from 'react';
import { Box, ButtonBase } from '@mui/material';
import { keyframes } from '@mui/system';
import { FileUp, Loader2, FileText } from 'lucide-react';
import type { Editor } from 'grapesjs';
import { loadHtmlIntoEditor } from './loadIntoEditor';
import { importToHtml } from './import/registry';

/**
 * Onglet « Fichier » de l'Importer.
 *
 * Sélection (clic) ou dépôt (drag & drop) d'un fichier local lu en mémoire via `FileReader.readAsText`,
 * puis converti en HTML+CSS et chargé dans l'éditeur. Comportement :
 *   1. l'utilisateur choisit / dépose un fichier `.html`, `.htm`, `.json` (export de builder) ou `.md` ;
 *   2. lecture locale (aucun upload réseau : le fichier ne quitte pas le navigateur) ;
 *   3. selon l'extension :
 *        - `.html` / `.htm` → injection directe via `loadHtmlIntoEditor` (le HTML brut est assaini à
 *          l'injection) ;
 *        - sinon (`.json` / `.md` / inconnu) → `importToHtml(content)` (auto-détection du format dans le
 *          registre) puis injection du `{ html, css }` retourné, et affichage des `report.warnings` ;
 *   4. `onDone()` (ferme le panneau) en cas de succès.
 *
 * Aucune nouvelle dépendance npm (FileReader natif).
 *
 * ⚠️ NON VÉRIFIÉ AU NAVIGATEUR (login Keycloak requis) : l'enchaînement lecture fichier → conversion →
 * injection (`setComponents`/`Css.addRules`) est à valider manuellement dans le Studio.
 */
export interface ImportFileProps {
  /** Éditeur GrapesJS cible (injection du contenu converti). */
  editor: Editor;
  /** Appelé après un import réussi (ferme le panneau). */
  onDone: () => void;
}

/** Rotation continue de l'indicateur de chargement (respecte `prefers-reduced-motion` via le navigateur). */
const spin = keyframes`from { transform: rotate(0deg); } to { transform: rotate(360deg); }`;

/** Extensions acceptées par le sélecteur de fichier (filtre UI, non contraignant côté lecture). */
const ACCEPT = '.html,.htm,.json,.md';

/** Vrai si le nom de fichier porte une extension HTML brute (injection directe sans détection). */
function isHtmlFile(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.endsWith('.html') || lower.endsWith('.htm');
}

export default function ImportFile({ editor, onDone }: ImportFileProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  // Mémorise le nom du dernier fichier lu (feedback visuel pendant/après lecture).
  const [fileName, setFileName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  /** Lit le fichier en texte, convertit puis injecte dans l'éditeur. */
  const handleFile = (file: File) => {
    if (loading) return;
    setError(null);
    setWarnings([]);
    setFileName(file.name);
    setLoading(true);

    const reader = new FileReader();
    reader.onerror = () => {
      setError("Échec de la lecture du fichier. Réessayez ou choisissez un autre fichier.");
      setLoading(false);
    };
    reader.onload = () => {
      try {
        const text = typeof reader.result === 'string' ? reader.result : '';
        if (isHtmlFile(file.name)) {
          // HTML brut : injection directe (assainissement appliqué par loadHtmlIntoEditor).
          loadHtmlIntoEditor(editor, { html: text });
        } else {
          // .json (export de builder) / .md / inconnu : auto-détection du format via le registre.
          const { html, css, report } = importToHtml(text);
          loadHtmlIntoEditor(editor, { html, css });
          if (report.warnings.length) {
            // On expose brièvement les dégradations avant de fermer (relecture conseillée côté Studio).
            setWarnings(report.warnings);
          }
        }
        onDone();
      } catch {
        // Garde-fou : importToHtml ne jette pas, mais l'injection GrapesJS pourrait échouer.
        setError("Impossible de charger ce fichier dans l'éditeur. Vérifiez son contenu et réessayez.");
        setLoading(false);
      }
    };
    reader.readAsText(file);
  };

  const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Réinitialise la valeur pour permettre de re-sélectionner le même fichier après une erreur.
    e.target.value = '';
    if (file) handleFile(file);
  };

  const onDrop = (e: DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (loading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const onDragOver = (e: DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (!loading) setDragOver(true);
  };

  const onDragLeave = (e: DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setDragOver(false);
  };

  const openPicker = () => {
    if (!loading) inputRef.current?.click();
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box sx={{ fontSize: 'var(--text-sm)', color: 'var(--muted)', lineHeight: 1.5 }}>
        Déposez ou sélectionnez un fichier <strong>.html</strong>, <strong>.htm</strong>,{' '}
        <strong>.json</strong> (export de builder) ou <strong>.md</strong>. Le contenu est lu localement,
        converti en HTML + styles puis assaini avant d'être chargé. Le canevas actuel sera remplacé.
      </Box>

      {/* Input fichier masqué, piloté par la zone de dépôt et le bouton. */}
      <Box
        component="input"
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        onChange={onInputChange}
        sx={{ display: 'none' }}
      />

      {/* Zone de dépôt / sélection cliquable. */}
      <ButtonBase
        onClick={openPicker}
        disabled={loading}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        sx={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 1, width: '100%', minHeight: 168, px: 2, py: 3, textAlign: 'center', cursor: 'pointer',
          color: 'var(--muted)', bgcolor: dragOver ? 'var(--hover)' : 'var(--field)',
          border: `1.5px dashed ${dragOver ? 'var(--accent)' : 'var(--line)'}`,
          borderRadius: 'var(--radius-lg)',
          transition:
            'border-color var(--duration-fast) var(--ease-out), background-color var(--duration-fast) var(--ease-out)',
          '&:hover': { borderColor: 'var(--accent)', bgcolor: 'var(--hover)' },
          '&.Mui-disabled': { opacity: 0.6, cursor: 'default' },
          '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: 2 },
        }}
      >
        {loading ? (
          <Box sx={{ display: 'inline-flex', color: 'var(--accent)', animation: `${spin} 0.8s linear infinite` }}>
            <Loader2 size={28} strokeWidth={1.75} />
          </Box>
        ) : fileName ? (
          <FileText size={28} strokeWidth={1.75} style={{ color: 'var(--accent)' }} />
        ) : (
          <FileUp size={28} strokeWidth={1.75} style={{ color: 'var(--faint)' }} />
        )}
        <Box sx={{ fontSize: 'var(--text-md)', fontWeight: 'var(--fw-semibold)', color: 'var(--ink)' }}>
          {loading
            ? 'Lecture du fichier…'
            : fileName
              ? fileName
              : 'Glissez un fichier ici, ou cliquez pour parcourir'}
        </Box>
        {!loading && !fileName ? (
          <Box sx={{ fontSize: 'var(--text-sm)', color: 'var(--faint)' }}>
            .html · .htm · .json · .md
          </Box>
        ) : null}
      </ButtonBase>

      {error ? (
        <Box sx={{ fontSize: 'var(--text-sm)', color: 'var(--err, #c0392b)' }} role="alert">
          {error}
        </Box>
      ) : null}

      {warnings.length ? (
        <Box
          sx={{
            fontSize: 'var(--text-sm)', color: 'var(--muted)', bgcolor: 'var(--field)',
            border: '1px solid var(--line)', borderRadius: 'var(--radius-md)', px: 1.5, py: 1.25,
          }}
        >
          <Box sx={{ fontWeight: 'var(--fw-semibold)', color: 'var(--ink)', mb: 0.5 }}>
            Conversion partielle — relecture conseillée
          </Box>
          <Box component="ul" sx={{ m: 0, pl: 2.25, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </Box>
        </Box>
      ) : null}

      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <ButtonBase
          onClick={openPicker}
          disabled={loading}
          sx={{
            display: 'inline-flex', alignItems: 'center', gap: 0.75, px: 2.5, height: 40,
            borderRadius: 'var(--radius-md)', bgcolor: 'var(--accent)', color: 'var(--on-accent)',
            fontWeight: 'var(--fw-semibold)', fontSize: 'var(--text-md)', cursor: 'pointer',
            '&.Mui-disabled': { opacity: 0.5 }, '&:hover': { bgcolor: 'var(--accent-deep, var(--accent))' },
          }}
        >
          {loading ? (
            <Box sx={{ display: 'inline-flex', animation: `${spin} 0.8s linear infinite` }}>
              <Loader2 size={15} strokeWidth={2} />
            </Box>
          ) : (
            <FileUp size={15} strokeWidth={2} />
          )}
          {loading ? 'Lecture en cours…' : 'Choisir un fichier'}
        </ButtonBase>
      </Box>
    </Box>
  );
}
