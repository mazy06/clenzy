import React, { useState, forwardRef, useImperativeHandle } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  Visibility,
  Delete,
  CheckCircle,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTemplates, useActivateTemplate, useDeleteTemplate } from './hooks/useDocuments';
import TemplateUpload from './TemplateUpload';

export interface TemplatesListRef {
  fetchTemplates: () => void;
  openUpload: () => void;
}

const TemplatesList = forwardRef<TemplatesListRef>((_, ref) => {
  const navigate = useNavigate();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: templates = [], isLoading, error, refetch } = useTemplates();
  const activateMutation = useActivateTemplate();
  const deleteMutation = useDeleteTemplate();

  const handleActivate = async (id: number) => {
    setActionError(null);
    try {
      await activateMutation.mutateAsync(id);
    } catch {
      setActionError('Erreur lors de l\'activation du template');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Supprimer ce template ?')) return;
    setActionError(null);
    try {
      await deleteMutation.mutateAsync(id);
    } catch {
      setActionError('Erreur lors de la suppression');
    }
  };

  useImperativeHandle(ref, () => ({
    fetchTemplates: () => refetch(),
    openUpload: () => setUploadOpen(true),
  }));

  const handleUploadSuccess = () => {
    setUploadOpen(false);
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  const displayError = actionError || (error ? 'Erreur lors du chargement des templates' : null);

  return (
    <Box>
      {displayError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setActionError(null)}>{displayError}</Alert>}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Nom</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Fichier</TableCell>
              <TableCell>Tags</TableCell>
              <TableCell>Statut</TableCell>
              <TableCell>Version</TableCell>
              <TableCell>Créé par</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {templates.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">Aucun template. Cliquez sur "Nouveau template" pour en ajouter un.</Typography>
                </TableCell>
              </TableRow>
            ) : (
              templates.map((t) => (
                <TableRow key={t.id} hover sx={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/documents/templates/${t.id}`)}>
                  <TableCell>
                    <Typography fontWeight={500}>{t.name}</Typography>
                    {t.description && (
                      <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 200, display: 'block' }}>
                        {t.description}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip label={t.documentType} size="small" variant="outlined"
                      sx={{ borderWidth: 1.5, borderColor: 'primary.main' }} />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" noWrap sx={{ maxWidth: 150 }}>
                      {t.originalFilename}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={`${t.tags?.length || 0} tags`} size="small" variant="outlined"
                      sx={{ borderWidth: 1.5, borderColor: 'info.main', color: 'info.main' }} />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={t.active ? 'Actif' : 'Inactif'}
                      size="small"
                      variant="outlined"
                      color={t.active ? 'success' : 'default'}
                      sx={{ borderWidth: 1.5 }}
                    />
                  </TableCell>
                  <TableCell>v{t.version}</TableCell>
                  <TableCell>
                    <Typography variant="body2" noWrap sx={{ maxWidth: 120 }}>
                      {t.createdBy}
                    </Typography>
                  </TableCell>
                  <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                    <Tooltip title="Voir détails">
                      <IconButton size="small" onClick={() => navigate(`/documents/templates/${t.id}`)}>
                        <Visibility />
                      </IconButton>
                    </Tooltip>
                    {!t.active && (
                      <Tooltip title="Activer">
                        <IconButton size="small" color="success" onClick={() => handleActivate(t.id)}>
                          <CheckCircle />
                        </IconButton>
                      </Tooltip>
                    )}
                    <Tooltip title="Supprimer">
                      <IconButton size="small" color="error" onClick={() => handleDelete(t.id)}>
                        <Delete />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <TemplateUpload open={uploadOpen} onClose={() => setUploadOpen(false)} onSuccess={handleUploadSuccess} />
    </Box>
  );
});

TemplatesList.displayName = 'TemplatesList';

export default TemplatesList;
