import { useRef, useState, type DragEvent, type ChangeEvent } from 'react';
import { cn } from '../../../../utils/cn';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Spinner,
} from '../../../../components/ui';
import { FileUp, FileText, TriangleAlert } from 'lucide-react';
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

  const onDrop = (e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (loading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const onDragOver = (e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    if (!loading) setDragOver(true);
  };

  const onDragLeave = (e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    setDragOver(false);
  };

  const openPicker = () => {
    if (!loading) inputRef.current?.click();
  };

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm leading-normal text-muted-foreground">
        Déposez ou sélectionnez un fichier <strong>.html</strong>, <strong>.htm</strong>,{' '}
        <strong>.json</strong> (export de builder) ou <strong>.md</strong>. Le contenu est lu localement,
        converti en HTML + styles puis assaini avant d'être chargé. Le canevas actuel sera remplacé.
      </p>

      {/* Input fichier masqué, piloté par la zone de dépôt et le bouton. */}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        onChange={onInputChange}
        className="hidden"
      />

      {/* Zone de dépôt / sélection cliquable. */}
      <button
        type="button"
        onClick={openPicker}
        disabled={loading}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={cn(
          'flex w-full min-h-[168px] cursor-pointer flex-col items-center justify-center gap-1.5 px-3 py-[18px] text-center',
          'rounded-xl border-[1.5px] border-dashed text-muted-foreground',
          'transition-[border-color,background-color] duration-150 ease-out-quart motion-reduce:transition-none',
          'hover:border-primary hover:bg-muted',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
          'disabled:cursor-default disabled:opacity-60',
          dragOver ? 'border-primary bg-muted' : 'border-border bg-field',
        )}
      >
        {loading ? (
          <Spinner className="size-7 text-primary" />
        ) : fileName ? (
          <FileText size={28} strokeWidth={1.75} className="text-primary" />
        ) : (
          <FileUp size={28} strokeWidth={1.75} className="text-faint" />
        )}
        <span className="text-sm font-semibold text-foreground">
          {loading
            ? 'Lecture du fichier…'
            : fileName
              ? fileName
              : 'Glissez un fichier ici, ou cliquez pour parcourir'}
        </span>
        {!loading && !fileName ? (
          <span className="text-sm text-faint">
            .html · .htm · .json · .md
          </span>
        ) : null}
      </button>

      {error ? (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {warnings.length ? (
        <Alert variant="warning">
          <TriangleAlert />
          <AlertTitle>Conversion partielle — relecture conseillée</AlertTitle>
          <AlertDescription>
            <ul className="m-0 flex flex-col gap-0.5 ps-3.5">
              {warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="flex justify-end">
        <Button type="button" onClick={openPicker} disabled={loading}>
          {loading ? <Spinner /> : <FileUp size={15} strokeWidth={2} />}
          {loading ? 'Lecture en cours…' : 'Choisir un fichier'}
        </Button>
      </div>
    </div>
  );
}
