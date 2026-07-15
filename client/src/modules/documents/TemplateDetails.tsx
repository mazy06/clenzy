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
  Menu,
  MenuItem,
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
  Upload,
  Description,
  MoreVert,
} from '../../icons';
import {
  useTemplate,
  useUpdateTemplate,
  useActivateTemplate,
  useReparseTemplate,
  useDeleteTemplate,
  useReplaceTemplateFile,
} from './hooks/useDocuments';
import TemplateTagsViewer from './TemplateTagsViewer';
import ConfirmationModal from '../../components/ConfirmationModal';
import PageHeader from '../../components/PageHeader';
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
  const replaceFileMutation = useReplaceTemplateFile();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // Modal de confirmation pour le remplacement du fichier (remplace window.confirm)
  const [pendingReplaceFile, setPendingReplaceFile] = useState<File | null>(null);
  // Modal de confirmation pour la suppression du template (remplace window.confirm)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Kebab menu (regroupe les actions secondaires du header pour reduire l'encombrement)
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const handleMenuOpen = (e: React.MouseEvent<HTMLElement>) => setMenuAnchor(e.currentTarget);
  const handleMenuClose = () => setMenuAnchor(null);
  const runFromMenu = (fn: () => void | Promise<void>) => () => {
    handleMenuClose();
    void fn();
  };

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

  const handleDelete = () => {
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    setActionError(null);
    try {
      await deleteMutation.mutateAsync(templateId);
      setDeleteConfirmOpen(false);
      navigate('/documents');
    } catch {
      setActionError('Erreur lors de la suppression');
      setDeleteConfirmOpen(false);
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

  // Remplacer le fichier .odt source du template tout en gardant le meme id /
  // les memes metadata. Re-parse les tags et regenere l'apercu apres succes.
  // Workflow : clic → input file → selection → ouvre modal de confirmation
  // (ConfirmationModal) → onConfirm → mutation + reload preview.
  const handleReplaceFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleReplaceFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset l'input pour permettre de re-selectionner le meme fichier plus tard
    e.target.value = '';
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.odt')) {
      setActionError('Seuls les fichiers .odt sont acceptes');
      return;
    }
    setActionError(null);
    setPendingReplaceFile(file);
  };

  const handleConfirmReplace = async () => {
    if (!pendingReplaceFile) return;
    const file = pendingReplaceFile;
    setActionError(null);
    try {
      await replaceFileMutation.mutateAsync({ id: templateId, file });
      setPendingReplaceFile(null);
      // Regenere l'apercu PDF avec le nouveau contenu
      await loadPreview();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Erreur lors du remplacement du fichier');
      setPendingReplaceFile(null);
    }
  };

  const handleCancelReplace = () => {
    setPendingReplaceFile(null);
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
      <Box>
        <Alert severity="error">Template introuvable</Alert>
        <Button startIcon={<ArrowBack />} onClick={() => navigate('/documents')} size="small" sx={{ mt: 2 }}>
          Retour
        </Button>
      </Box>
    );
  }

  const error = actionError;

  const statusTone = template.active
    ? { color: 'var(--ok)', bgcolor: 'var(--ok-soft)' }
    : { color: 'var(--muted)', bgcolor: 'var(--hover)' };
  const replacePending = replaceFileMutation.isPending;
  const reparsePending = reparseMutation.isPending;

  return (
    <Box>
      <PageHeader
        title={template.name}
        subtitle={`Modèle de document · v${template.version}`}
        iconBadge={<Description />}
        backPath="/documents"
        backLabel="Documents"
        titleAdornment={
          <Chip
            label={template.active ? 'Actif' : 'Inactif'}
            size="small"
            sx={statusTone}
          />
        }
        actions={
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            {!template.active && (
              <Button
                variant="contained"
                color="success"
                startIcon={<CheckCircle size={14} strokeWidth={1.75} />}
                onClick={handleActivate}
                size="small"
              >
                Activer
              </Button>
            )}
            {editing ? (
              <>
                <Button startIcon={<Save size={14} strokeWidth={1.75} />} variant="contained" onClick={handleSave} size="small">
                  Sauvegarder
                </Button>
                <Button startIcon={<Cancel size={14} strokeWidth={1.75} />} variant="outlined" onClick={() => setEditing(false)} size="small">
                  Annuler
                </Button>
              </>
            ) : (
              <Button
                startIcon={<Edit size={14} strokeWidth={1.75} />}
                variant="outlined"
                onClick={() => setEditing(true)}
                size="small"
              >
                Modifier
              </Button>
            )}
            <Tooltip title="Plus d'actions" arrow>
              <IconButton
                size="small"
                onClick={handleMenuOpen}
                aria-label="Plus d'actions"
                aria-haspopup="menu"
                aria-expanded={Boolean(menuAnchor)}
                sx={{
                  width: 30,
                  height: 30,
                  border: '1px solid var(--line-2)',
                  borderRadius: '9px',
                  cursor: 'pointer',
                  '&:hover': {
                    borderColor: 'var(--faint)',
                    backgroundColor: 'var(--hover)',
                  },
                }}
              >
                <MoreVert size={16} strokeWidth={1.75} />
              </IconButton>
            </Tooltip>
            <input
              ref={fileInputRef}
              type="file"
              accept=".odt,application/vnd.oasis.opendocument.text"
              style={{ display: 'none' }}
              onChange={handleReplaceFileChange}
            />
          </Box>
        }
      />

      {error && <Alert severity="error" sx={{ mt: 2, mb: 2 }} onClose={() => setActionError(null)}>{error}</Alert>}

      <Grid container spacing={3} alignItems="flex-start">
        {/* Colonne gauche : Informations + Apercu PDF empiles */}
        <Grid item xs={12} md={6}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Informations */}
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 'var(--radius-lg)', borderColor: 'var(--line)', boxShadow: 'none' }}>
              <Typography sx={{ mb: 2, fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--faint)' }}>
                Informations
              </Typography>

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
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 'var(--radius-lg)', borderColor: 'var(--line)', boxShadow: 'none' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
                <Box>
                  <Typography sx={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--faint)' }}>
                    Aperçu
                  </Typography>
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
                  backgroundColor: 'var(--field)',
                  border: '1px solid',
                  borderColor: 'var(--line)',
                  borderRadius: '12px',
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
                    backgroundColor: 'color-mix(in srgb, var(--card) 60%, transparent)',
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
                    sandbox="allow-same-origin"
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

      {/* ── Menu kebab : actions secondaires du header ─────────────── */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { minWidth: 240, mt: 0.5 } } }}
      >
        <MenuItem onClick={runFromMenu(handleDownloadOriginal)} sx={{ fontSize: '0.85rem', py: 0.75 }}>
          <Box component="span" sx={{ display: 'inline-flex', mr: 1, color: 'text.secondary' }}>
            <Download size={18} strokeWidth={1.75} />
          </Box>
          Télécharger le fichier source (.odt)
        </MenuItem>
        <MenuItem onClick={runFromMenu(handleDownloadPreview)} sx={{ fontSize: '0.85rem', py: 0.75 }}>
          <Box component="span" sx={{ display: 'inline-flex', mr: 1, color: 'text.secondary' }}>
            <Visibility size={18} strokeWidth={1.75} />
          </Box>
          Télécharger l'aperçu PDF
        </MenuItem>
        <Divider sx={{ my: 0.5 }} />
        <MenuItem
          onClick={runFromMenu(handleReplaceFileClick)}
          disabled={replacePending}
          sx={{ fontSize: '0.85rem', py: 0.75 }}
        >
          <Box component="span" sx={{ display: 'inline-flex', mr: 1, color: 'text.secondary' }}>
            {replacePending ? <CircularProgress size={16} /> : <Upload size={18} strokeWidth={1.75} />}
          </Box>
          {replacePending ? 'Remplacement…' : 'Remplacer le fichier (.odt)'}
        </MenuItem>
        <MenuItem
          onClick={runFromMenu(handleReparse)}
          disabled={reparsePending}
          sx={{ fontSize: '0.85rem', py: 0.75 }}
        >
          <Box component="span" sx={{ display: 'inline-flex', mr: 1, color: 'text.secondary' }}>
            {reparsePending ? <CircularProgress size={16} /> : <Refresh size={18} strokeWidth={1.75} />}
          </Box>
          Re-scanner les tags
        </MenuItem>
        <Divider sx={{ my: 0.5 }} />
        <MenuItem
          onClick={runFromMenu(handleDelete)}
          disabled={deleteMutation.isPending}
          sx={{ fontSize: '0.85rem', py: 0.75, color: 'var(--err)' }}
        >
          <Box component="span" sx={{ display: 'inline-flex', mr: 1, color: 'var(--err)' }}>
            <Delete size={18} strokeWidth={1.75} />
          </Box>
          Supprimer
        </MenuItem>
      </Menu>

      {/* ── Modal de confirmation du remplacement de fichier ─────────── */}
      <ConfirmationModal
        open={Boolean(pendingReplaceFile)}
        onClose={handleCancelReplace}
        onConfirm={handleConfirmReplace}
        title="Remplacer le fichier du template ?"
        message={
          pendingReplaceFile
            ? `Le contenu actuel sera remplacé par « ${pendingReplaceFile.name} » et les tags seront re-scannés. Le nom, le type et le statut actif du template restent inchangés.`
            : ''
        }
        confirmText="Remplacer"
        cancelText="Annuler"
        severity="info"
        loading={replaceFileMutation.isPending}
        icon={<Upload size={22} strokeWidth={1.75} />}
        confirmIcon={<Upload size={18} strokeWidth={1.75} />}
        confirmColor="primary"
      />

      {/* ── Modal de confirmation de suppression du template ─────────── */}
      <ConfirmationModal
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={confirmDelete}
        title="Supprimer le template ?"
        message={`Le template « ${template.name} » sera définitivement supprimé. Cette action est irréversible.`}
        confirmText="Supprimer"
        cancelText="Annuler"
        severity="error"
        loading={deleteMutation.isPending}
        icon={<Delete size={22} strokeWidth={1.75} />}
        confirmIcon={<Delete size={18} strokeWidth={1.75} />}
      />
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
