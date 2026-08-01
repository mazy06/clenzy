import React, { useState, useCallback } from 'react';
import { Alert as UiAlert, AlertDescription } from '../../components/ui';
import { TriangleAlert } from 'lucide-react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, IconButton, Alert, FormControl, InputLabel, Select, MenuItem, LinearProgress } from '@mui/material';
import {
  Close as CloseIcon,
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
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 2, boxShadow: '0 8px 32px rgba(0,0,0,0.12)' },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pb: 1,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <div className="flex items-center gap-1.5">
          <CloudUpload color="primary" />
          <div className="cn-text-h6">
            Importer des prospects
          </div>
        </div>
        <IconButton onClick={handleClose} size="small" sx={{ color: 'text.secondary' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 3, pb: 2 }}>
        {/* Success message */}
        {successCount !== null && (
          <Alert severity="success" icon={<CheckCircle />} sx={{ mb: 2 }}>
            <p className="cn-text-body1">
              <strong>{successCount}</strong> prospects importes avec succes !
            </p>
          </Alert>
        )}

        {/* Error message */}
        {importMutation.isError && (
          <UiAlert variant="destructive" className="mb-3">
            <TriangleAlert />
            <AlertDescription>Erreur lors de l&apos;import. Verifiez le format du fichier CSV.</AlertDescription>
          </UiAlert>
        )}

        {/* Category selector */}
        <FormControl fullWidth sx={{ mb: 3 }}>
          <InputLabel>Categorie</InputLabel>
          <Select
            value={category}
            label="Categorie"
            onChange={(e) => setCategory(e.target.value)}
            disabled={importMutation.isPending}
          >
            {CATEGORY_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* File drop zone */}
        <Box
          onDrop={handleDrop}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          sx={{
            border: '1px dashed',
            borderColor: dragOver ? 'var(--accent)' : 'var(--line-2)',
            borderRadius: '12px',
            p: 4,
            textAlign: 'center',
            bgcolor: dragOver ? 'var(--accent-soft)' : 'var(--field)',
            transition: 'border-color 0.2s, background-color 0.2s',
            '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
            cursor: 'pointer',
          }}
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
              <InsertDriveFile color="primary" />
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
        </Box>

        {/* Progress */}
        {importMutation.isPending && <LinearProgress sx={{ mt: 2 }} />}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, gap: 1, justifyContent: 'flex-end' }}>
        <Button onClick={handleClose} variant="outlined" disabled={importMutation.isPending}>
          {successCount !== null ? 'Fermer' : 'Annuler'}
        </Button>
        {successCount === null && (
          <Button
            onClick={handleImport}
            variant="contained"
            disabled={!canImport}
            startIcon={<CloudUpload />}
          >
            {importMutation.isPending ? 'Import en cours...' : 'Importer'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default ProspectImportModal;
