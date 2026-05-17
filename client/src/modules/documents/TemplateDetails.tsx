import React, { useState, useEffect, useRef } from 'react';
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
  Download,
  Visibility,
} from '../../icons';
import {
  useTemplate,
  useUpdateTemplate,
  useActivateTemplate,
  useReparseTemplate,
  useDeleteTemplate,
} from './hooks/useDocuments';
import TemplateTagsViewer from './TemplateTagsViewer';
import { documentsApi } from '../../services/api/documentsApi';

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
    emailSubject: '',
    emailBody: '',
  });

  // Apercu PDF du template avec donnees factices.
  // L'URL est un blob local cree au load, libere quand le composant unmount
  // ou quand on regenere l'apercu apres un re-scan / une edition.
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const currentBlobUrl = useRef<string | null>(null);

  const releaseBlobUrl = () => {
    if (currentBlobUrl.current) {
      window.URL.revokeObjectURL(currentBlobUrl.current);
      currentBlobUrl.current = null;
    }
  };

  const loadPreview = async () => {
    setPreviewError(null);
    setPreviewLoading(true);
    try {
      const blobUrl = await documentsApi.fetchTemplatePreviewBlobUrl(templateId);
      releaseBlobUrl();
      currentBlobUrl.current = blobUrl;
      setPreviewUrl(blobUrl);
    } catch (e) {
      setPreviewError(e instanceof Error ? e.message : 'Erreur lors de la generation de l\'apercu');
    } finally {
      setPreviewLoading(false);
    }
  };

  useEffect(() => {
    if (template) {
      setEditData({
        name: template.name || '',
        description: template.description || '',
        emailSubject: template.emailSubject || '',
        emailBody: template.emailBody || '',
      });
    }
  }, [template]);

  // Charge l'apercu PDF des le premier load du template, et libere
  // l'URL blob lorsque le composant unmount.
  useEffect(() => {
    if (template?.id) {
      loadPreview();
    }
    return () => {
      releaseBlobUrl();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template?.id]);

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

  const handleDownloadOriginal = async () => {
    setActionError(null);
    try {
      const filename = template?.originalFilename || 'template.odt';
      await documentsApi.downloadTemplateOriginal(templateId, filename);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Erreur lors du telechargement');
    }
  };

  const handleDownloadPreview = async () => {
    setActionError(null);
    try {
      const baseName = (template?.name || 'template').replace(/[^a-zA-Z0-9_-]+/g, '_');
      await documentsApi.downloadTemplatePreview(templateId, `${baseName}_apercu.pdf`);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Erreur lors du telechargement de l\'apercu');
    }
  };

  const handleOpenPreviewInNewTab = () => {
    if (previewUrl) {
      window.open(previewUrl, '_blank', 'noopener,noreferrer');
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
          {(() => { const c = template.active ? '#4A9B8E' : '#757575'; return (
          <Chip
            label={template.active ? 'Actif' : 'Inactif'}
            size="small"
            sx={{ backgroundColor: `${c}18`, color: c, border: `1px solid ${c}40`, borderRadius: '6px', fontWeight: 600, fontSize: '0.75rem', height: 24, '& .MuiChip-label': { px: 1 } }}
          />
          ); })()}
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {!template.active && (
            <Button variant="contained" color="success" startIcon={<CheckCircle />} onClick={handleActivate} size="small">
              Activer
            </Button>
          )}
          <Tooltip title="Telecharger le fichier source (.odt)">
            <span>
              <Button startIcon={<Download />} onClick={handleDownloadOriginal} variant="outlined" size="small">
                Telecharger
              </Button>
            </span>
          </Tooltip>
          <Tooltip title="Telecharger l'apercu PDF (donnees factices)">
            <span>
              <Button startIcon={<Visibility />} onClick={handleDownloadPreview} variant="outlined" size="small">
                Telecharger l'apercu
              </Button>
            </span>
          </Tooltip>
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

      <Grid container spacing={3} alignItems="flex-start">
        {/* Colonne gauche : Informations + Apercu PDF empiles */}
        <Grid item xs={12} md={6}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Informations */}
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>Informations</Typography>

              {editing ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <TextField label="Nom" value={editData.name} onChange={(e) => setEditData({ ...editData, name: e.target.value })} fullWidth size="small" />
                  <TextField label="Description" value={editData.description} onChange={(e) => setEditData({ ...editData, description: e.target.value })} fullWidth size="small" multiline rows={2} />
                  <Divider />
                  <TextField label="Objet email" value={editData.emailSubject} onChange={(e) => setEditData({ ...editData, emailSubject: e.target.value })} fullWidth size="small" />
                  <TextField label="Corps email" value={editData.emailBody} onChange={(e) => setEditData({ ...editData, emailBody: e.target.value })} fullWidth size="small" multiline rows={3} />
                </Box>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  <InfoRow label="Type de document" value={template.documentType} />
                  <InfoRow label="Fichier original" value={template.originalFilename} />
                  <InfoRow label="Version" value={`v${template.version}`} />
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

            {/* Apercu PDF — affiche systematiquement sous les Informations */}
            <Paper sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
                <Box>
                  <Typography variant="h6">Aperçu</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Prévisualisation générée avec des données factices.
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  <Tooltip title="Regénérer l'aperçu">
                    <span>
                      <IconButton onClick={loadPreview} disabled={previewLoading} size="small">
                        <Refresh />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Ouvrir dans un nouvel onglet">
                    <span>
                      <IconButton onClick={handleOpenPreviewInNewTab} disabled={!previewUrl || previewLoading} size="small">
                        <Visibility />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Télécharger en PDF">
                    <span>
                      <IconButton onClick={handleDownloadPreview} disabled={previewLoading} size="small">
                        <Download />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Box>
              </Box>

              {previewError && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setPreviewError(null)}>
                  {previewError}
                </Alert>
              )}

              {/* Hauteur calee sur le ratio A4 portrait : la largeur du panneau
                  est ~50vw sur desktop md+, donc 1.4x cette largeur donne un
                  rendu equilibre. Min/max evitent les extremes. */}
              <Box
                sx={{
                  position: 'relative',
                  width: '100%',
                  height: { xs: 520, sm: 640, md: 780, lg: 880 },
                  backgroundColor: 'rgba(0,0,0,0.04)',
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  overflow: 'hidden',
                }}
              >
                {previewLoading && (
                  <Box sx={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 1.5,
                    backgroundColor: (th) => th.palette.mode === 'dark'
                      ? 'rgba(0,0,0,0.4)'
                      : 'rgba(255,255,255,0.6)',
                    zIndex: 1,
                  }}>
                    <CircularProgress size={28} />
                    <Typography variant="caption" color="text.secondary">
                      Génération de l'aperçu en cours...
                    </Typography>
                  </Box>
                )}
                {previewUrl ? (
                  <iframe
                    title="Aperçu PDF du template"
                    src={previewUrl}
                    style={{ width: '100%', height: '100%', border: 0 }}
                  />
                ) : !previewLoading && (
                  <Box sx={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Typography variant="body2" color="text.secondary">
                      Aperçu non disponible.
                    </Typography>
                  </Box>
                )}
              </Box>
            </Paper>
          </Box>
        </Grid>

        {/* Colonne droite : Tags detectes (sticky sur grand ecran pour rester
            visible quand on scrolle l'apercu). */}
        <Grid item xs={12} md={6}>
          <Box sx={{ position: { md: 'sticky' }, top: { md: 16 } }}>
            <TemplateTagsViewer tags={template.tags || []} />
          </Box>
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
