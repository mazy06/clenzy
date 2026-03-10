import React, { useState, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  IconButton,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  LinearProgress,
} from '@mui/material';
import {
  Close as CloseIcon,
  CloudUpload,
  InsertDriveFile,
  CheckCircle,
} from '@mui/icons-material';
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
        <Box display="flex" alignItems="center" gap={1}>
          <CloudUpload color="primary" />
          <Typography variant="h6" component="div">
            Importer des prospects
          </Typography>
        </Box>
        <IconButton onClick={handleClose} size="small" sx={{ color: 'text.secondary' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 3, pb: 2 }}>
        {/* Success message */}
        {successCount !== null && (
          <Alert severity="success" icon={<CheckCircle />} sx={{ mb: 2 }}>
            <Typography variant="body1">
              <strong>{successCount}</strong> prospects importes avec succes !
            </Typography>
          </Alert>
        )}

        {/* Error message */}
        {importMutation.isError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            Erreur lors de l&apos;import. Verifiez le format du fichier CSV.
          </Alert>
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
            border: '2px dashed',
            borderColor: dragOver ? 'primary.main' : 'divider',
            borderRadius: 2,
            p: 4,
            textAlign: 'center',
            bgcolor: dragOver ? 'action.hover' : 'background.default',
            transition: 'all 0.2s',
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
            <Box display="flex" alignItems="center" justifyContent="center" gap={1}>
              <InsertDriveFile color="primary" />
              <Typography variant="body1" color="text.primary">
                {selectedFile.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                ({(selectedFile.size / 1024).toFixed(1)} Ko)
              </Typography>
            </Box>
          ) : (
            <>
              <CloudUpload sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
              <Typography variant="body1" color="text.secondary">
                Deposez votre fichier CSV ici
              </Typography>
              <Typography variant="body2" color="text.disabled">
                ou cliquez pour parcourir
              </Typography>
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
