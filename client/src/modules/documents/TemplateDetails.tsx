import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Chip,
  Button,
  Grid,
  CircularProgress,
  Alert,
  Divider,
  TextField,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  ArrowBack,
  Edit,
  Save,
  Cancel,
  CheckCircle,
  Refresh,
  Delete,
} from '@mui/icons-material';
import {
  useTemplate,
  useUpdateTemplate,
  useActivateTemplate,
  useReparseTemplate,
  useDeleteTemplate,
} from './hooks/useDocuments';
import TemplateTagsViewer from './TemplateTagsViewer';

const TemplateDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const templateId = Number(id);

  const { data: template, isLoading, error: fetchError, refetch } = useTemplate(templateId);
  const updateMutation = useUpdateTemplate();
  const activateMutation = useActivateTemplate();
  const reparseMutation = useReparseTemplate();
  const deleteMutation = useDeleteTemplate();

  const [editing, setEditing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editData, setEditData] = useState({
    name: '',
    description: '',
    eventTrigger: '',
    emailSubject: '',
    emailBody: '',
  });

  useEffect(() => {
    if (template) {
      setEditData({
        name: template.name || '',
        description: template.description || '',
        eventTrigger: template.eventTrigger || '',
        emailSubject: template.emailSubject || '',
        emailBody: template.emailBody || '',
      });
    }
  }, [template]);

  const handleSave = async () => {
    setActionError(null);
    try {
      await updateMutation.mutateAsync({ id: templateId, data: editData });
      setEditing(false);
    } catch {
      setActionError('Erreur lors de la sauvegarde');
    }
  };

  const handleActivate = async () => {
    setActionError(null);
    try {
      await activateMutation.mutateAsync(templateId);
    } catch {
      setActionError('Erreur lors de l\'activation');
    }
  };

  const handleReparse = async () => {
    setActionError(null);
    try {
      await reparseMutation.mutateAsync(templateId);
    } catch {
      setActionError('Erreur lors du re-scan');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Supprimer ce template ?')) return;
    setActionError(null);
    try {
      await deleteMutation.mutateAsync(templateId);
      navigate('/documents');
    } catch {
      setActionError('Erreur lors de la suppression');
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (fetchError || !template) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Template introuvable</Alert>
        <Button startIcon={<ArrowBack />} onClick={() => navigate('/documents')} size="small" sx={{ mt: 2 }}>
          Retour
        </Button>
      </Box>
    );
  }

  const error = actionError;

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button startIcon={<ArrowBack />} onClick={() => navigate('/documents')} size="small">
            Retour
          </Button>
          <Typography variant="h5" fontWeight={600}>{template.name}</Typography>
          <Chip
            label={template.active ? 'Actif' : 'Inactif'}
            color={template.active ? 'success' : 'default'}
            size="small"
            variant="outlined"
          />
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {!template.active && (
            <Button variant="contained" color="success" startIcon={<CheckCircle />} onClick={handleActivate} size="small">
              Activer
            </Button>
          )}
          <Button startIcon={<Refresh />} onClick={handleReparse} variant="outlined" size="small">
            Re-scanner tags
          </Button>
          {editing ? (
            <>
              <Button startIcon={<Save />} variant="contained" onClick={handleSave} size="small">Sauvegarder</Button>
              <Button startIcon={<Cancel />} onClick={() => setEditing(false)} size="small">Annuler</Button>
            </>
          ) : (
            <Button startIcon={<Edit />} onClick={() => setEditing(true)} size="small">Modifier</Button>
          )}
          <Tooltip title="Supprimer">
            <IconButton color="error" onClick={handleDelete}>
              <Delete />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setActionError(null)}>{error}</Alert>}

      <Grid container spacing={3}>
        {/* Infos generales */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Informations</Typography>

            {editing ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField label="Nom" value={editData.name} onChange={(e) => setEditData({ ...editData, name: e.target.value })} fullWidth size="small" />
                <TextField label="Description" value={editData.description} onChange={(e) => setEditData({ ...editData, description: e.target.value })} fullWidth size="small" multiline rows={2} />
                <TextField label="Déclencheur" value={editData.eventTrigger} onChange={(e) => setEditData({ ...editData, eventTrigger: e.target.value })} fullWidth size="small" />
                <Divider />
                <TextField label="Objet email" value={editData.emailSubject} onChange={(e) => setEditData({ ...editData, emailSubject: e.target.value })} fullWidth size="small" />
                <TextField label="Corps email" value={editData.emailBody} onChange={(e) => setEditData({ ...editData, emailBody: e.target.value })} fullWidth size="small" multiline rows={3} />
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <InfoRow label="Type de document" value={template.documentType} />
                <InfoRow label="Fichier original" value={template.originalFilename} />
                <InfoRow label="Version" value={`v${template.version}`} />
                <InfoRow label="Déclencheur" value={template.eventTrigger || '—'} />
                <InfoRow label="Créé par" value={template.createdBy || '—'} />
                <InfoRow label="Créé le" value={template.createdAt ? new Date(template.createdAt).toLocaleDateString('fr-FR') : '—'} />
                {template.emailSubject && (
                  <>
                    <Divider sx={{ my: 1 }} />
                    <InfoRow label="Objet email" value={template.emailSubject} />
                  </>
                )}
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Tags */}
        <Grid item xs={12} md={6}>
          <TemplateTagsViewer tags={template.tags || []} />
        </Grid>
      </Grid>
    </Box>
  );
};

const InfoRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
    <Typography variant="body2" color="text.secondary">{label}</Typography>
    <Typography variant="body2" fontWeight={500}>{value}</Typography>
  </Box>
);

export default TemplateDetails;
