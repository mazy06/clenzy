import React, { useState, useCallback } from 'react';
import { Alert as UiAlert, AlertDescription, Button } from '../../components/ui';
import { TriangleAlert } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldLabel,
  NativeSelect,
  NativeSelectOption,
} from '../../components/ui';
import { cn } from '../../utils/cn';
import {
  CloudUpload,
  InsertDriveFile,
  CheckCircle,
} from '../../icons';
import { useImportProspects } from '../../hooks/useProspects';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ProspectImportModalProps {
  open: boolean;
  onClose: () => void;
}

const CATEGORY_OPTIONS = [
  { value: 'CONCIERGERIES', label: 'Conciergeries & Agences' },
  { value: 'MENAGE', label: 'Societes de menage' },
  { value: 'ARTISANS', label: 'Artisans & Travaux' },
  { value: 'ENTRETIEN', label: 'Entretien exterieur' },
  { value: 'BLANCHISSERIES', label: 'Blanchisseries' },
];

// ─── Component ──────────────────────────────────────────────────────────────

const ProspectImportModal: React.FC<ProspectImportModalProps> = ({ open, onClose }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [category, setCategory] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [successCount, setSuccessCount] = useState<number | null>(null);

  const importMutation = useImportProspects();

  const handleReset = useCallback(() => {
    setSelectedFile(null);
    setCategory('');
    setSuccessCount(null);
    importMutation.reset();
  }, [importMutation]);

  const handleClose = useCallback(() => {
    handleReset();
    onClose();
  }, [handleReset, onClose]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setSuccessCount(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.name.endsWith('.csv')) {
      setSelectedFile(file);
      setSuccessCount(null);
    }
  };

  const handleImport = async () => {
    if (!selectedFile || !category) return;

    try {
      const result = await importMutation.mutateAsync({ file: selectedFile, category });
      setSuccessCount(result.imported);
    } catch {
      // Error handled by mutation state
    }
  };

  const canImport = selectedFile && category && !importMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="flex-row items-center gap-1.5 border-b pb-2">
          <CloudUpload className="text-[var(--mui-primary)]" />
          <DialogTitle className="cn-text-h6">
            Importer des prospects
          </DialogTitle>
        </DialogHeader>

        {/* Success message */}
        {successCount !== null && (
          <UiAlert variant="success" className="mb-3">
            <CheckCircle />
            <AlertDescription>
              <strong>{successCount}</strong> prospects importes avec succes !
            </AlertDescription>
          </UiAlert>
        )}

        {/* Error message */}
        {importMutation.isError && (
          <UiAlert variant="destructive" className="mb-3">
            <TriangleAlert />
            <AlertDescription>Erreur lors de l&apos;import. Verifiez le format du fichier CSV.</AlertDescription>
          </UiAlert>
        )}

        {/* Category selector */}
        <Field className="mb-[18px]">
          <FieldLabel htmlFor="prospect-import-category">Categorie</FieldLabel>
          <NativeSelect
            id="prospect-import-category"
            className="w-full"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            disabled={importMutation.isPending}
          >
            {/* Option vide : le select natif afficherait sinon la 1re categorie
                sans que l'etat ait change (le bouton Importer resterait bloque). */}
            <NativeSelectOption value="">—</NativeSelectOption>
            {CATEGORY_OPTIONS.map((opt) => (
              <NativeSelectOption key={opt.value} value={opt.value}>
                {opt.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>

        {/* File drop zone */}
        <div
          onDrop={handleDrop}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          className={cn(
            'border border-dashed rounded-[12px] p-6 text-center cursor-pointer',
            'transition-[border-color,background-color] duration-200 motion-reduce:transition-none',
            dragOver
              ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
              : 'border-[var(--line-2)] bg-[var(--field)]',
          )}
          onClick={() => document.getElementById('csv-file-input')?.click()}
        >
          <input
            id="csv-file-input"
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          {selectedFile ? (
            <div className="flex items-center justify-center gap-1.5">
              <InsertDriveFile className="text-[var(--mui-primary)]" />
              <p className="cn-text-body1 text-foreground">
                {selectedFile.name}
              </p>
              <p className="cn-text-body2 text-muted-foreground">
                ({(selectedFile.size / 1024).toFixed(1)} Ko)
              </p>
            </div>
          ) : (
            <>
              <span className="inline-flex text-muted-foreground opacity-60 mb-1.5"><CloudUpload size={48} strokeWidth={1.75} /></span>
              <p className="cn-text-body1 text-muted-foreground">
                Deposez votre fichier CSV ici
              </p>
              <p className="cn-text-body2 text-muted-foreground opacity-60">
                ou cliquez pour parcourir
              </p>
            </>
          )}
        </div>

        {/* Progress. Le primitif Progress traduit un POURCENTAGE et l'import n'en
            expose aucun : une barre pulsee dit « en cours » sans mentir sur une
            avancee, la ou un Progress serait fige a 0 %. */}
        {importMutation.isPending && (
          <div
            role="progressbar"
            aria-label="Import en cours"
            className="mt-3 h-1 w-full overflow-hidden rounded-full bg-[var(--line)]"
          >
            <div className="h-full w-full bg-[var(--accent)] animate-pulse motion-reduce:animate-none" />
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button onClick={handleClose} variant="outline" disabled={importMutation.isPending}>
            {successCount !== null ? 'Fermer' : 'Annuler'}
          </Button>
          {successCount === null && (
            <Button onClick={handleImport} disabled={!canImport}>
              <CloudUpload />
              {importMutation.isPending ? 'Import en cours...' : 'Importer'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ProspectImportModal;
